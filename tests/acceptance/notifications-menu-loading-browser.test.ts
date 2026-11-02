import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { chromium, type Browser, type Page } from "@playwright/test"
import { createServer, type ViteDevServer } from "vite"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import type { AddressInfo } from "node:net"

let server: ViteDevServer, browser: Browser, origin: string
let count=0
const bridge = `
async function call(action){return(await fetch('/fixture-notifications',{method:'POST',body:action})).json()}
export const listNotificationsAction=()=>call('list');
export const markAllNotificationsReadAction=()=>call('all');
export const markNotificationReadAction=()=>call('read');
export const markNotificationUnreadAction=()=>call('unread');
export const acceptOrganizationAccessRequestAction=()=>call('accept');
export const declineOrganizationAccessRequestAction=()=>call('decline');`
function deferred() { let resolve!:()=>void; const promise=new Promise<void>(yes=>{resolve=yes});return {promise,resolve} }
async function setCount(page: Page, value: number) {
 await page.evaluate(async value=>{
  await fetch('/fixture-count',{method:'POST',body:String(value)})
  window.dispatchEvent(new Event('coach-house:workspace-saved'))
 },value)
 await expect.poll(()=>page.getByRole("button",{name:"Notifications",exact:true}).getAttribute("aria-description")).toBe(`${value} unread notifications`)
}
async function sameBell(page:Page) {
 return page.getByRole("button",{name:"Notifications",exact:true}).evaluate(button=>button===(window as unknown as {savedBell:Element}).savedBell)
}

describe.sequential("notification loading boundaries",()=>{
 beforeAll(async()=>{
  server=await createServer({configFile:false,root:process.cwd(),cacheDir:mkdtempSync(path.join(tmpdir(),"ch-notifications-vite-")),
   define:{"process.env":"{}"},resolve:{alias:{"@":path.resolve("src")}},esbuild:{jsx:"automatic"},
   optimizeDeps:{entries:["tests/acceptance/fixtures/notifications-menu-loading-browser.tsx"]},server:{host:"127.0.0.1",port:0,watch:null},plugins:[{
    name:"notification-action-bridge",enforce:"pre",
    resolveId(source){
     if(source==="next/navigation")return "\0notification-navigation"
     if(["@/app/actions/notifications","@/app/actions/organization-access",path.resolve("src/app/actions/notifications"),path.resolve("src/app/actions/notifications.ts"),path.resolve("src/app/actions/organization-access"),path.resolve("src/app/actions/organization-access.ts")].includes(source))return "\0notification-actions"
     if(["@/features/organization-access",path.resolve("src/features/organization-access"),path.resolve("src/features/organization-access/index.ts")].includes(source))return path.resolve("src/features/organization-access/lib/notification-metadata.ts")
    },load(id){
     if(id==="\0notification-navigation")return 'export function useRouter(){return {push(path){window.history.pushState(null,"",path)}}}'
     if(id==="\0notification-actions")return bridge
    },configureServer(instance){instance.middlewares.use(async(request,response,next)=>{
     if(request.url==="/"){response.setHeader("Content-Type","text/html");response.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/tests/acceptance/fixtures/notifications-menu-loading-browser.tsx"></script></body></html>');return}
     if(!["/fixture-count","/fixture-notifications"].includes(request.url??""))return next()
     let body="";for await(const chunk of request)body+=chunk
     if(request.url==="/fixture-count"){count=Number(body);response.end("ok");return}
     if(body==="all")count=0
     if(body==="read")count=Math.max(0,count-1)
     if(body==="unread")count++
     response.setHeader("Content-Type","application/json")
     response.end(JSON.stringify(body==="list"?{ok:true,totalCount:Math.max(count,1),unreadCount:count,inbox:[{id:"one",title:"Current notification",description:"Real controller fixture",href:null,tone:"info",createdAt:"2026-11-02T12:00:00Z",readAt:count?null:"2026-11-02T12:30:00Z",archivedAt:null,type:null,metadata:null}]}:{ok:true}))
    })},
   }]})
  await server.listen();origin=`http://127.0.0.1:${(server.httpServer!.address() as AddressInfo).port}`
  browser=await chromium.launch({headless:true})
 },30_000)
 afterAll(async()=>{await browser?.close();await server?.close()})

 it("keeps the live count, stable keyboard trigger and first-open intent while modules load",async()=>{
  count=0
  const page=await browser.newPage({viewport:{width:1100,height:900}})
  page.setDefaultTimeout(8000)
  const overlay=deferred(),badge=deferred();let overlayRequested=0,badgeRequested=0
  const errors:string[]=[];page.on("pageerror",error=>errors.push(error.message))
  await page.route("**/src/components/notifications/notifications-menu-overlay.tsx*",async route=>{overlayRequested++;await overlay.promise;await route.continue()})
  await page.route("**/src/components/ui/badge-counter.tsx*",async route=>{badgeRequested++;await badge.promise;await route.continue()})
  try{
   await page.goto(origin,{waitUntil:"domcontentloaded"})
   const bell=page.getByRole("button",{name:"Notifications",exact:true})
   await bell.waitFor();await expect.poll(()=>bell.getAttribute("aria-description")).toBe("0 unread notifications")
   await bell.evaluate(button=>{(window as unknown as {savedBell:Element}).savedBell=button})
   expect(overlayRequested).toBe(0);expect(badgeRequested).toBe(0)
   await setCount(page,12);expect(await bell.innerText()).toContain("12")
   await expect.poll(()=>badgeRequested).toBe(1)
   await setCount(page,120);expect(await bell.innerText()).toContain("99+")
   expect(overlayRequested).toBe(0)
   await bell.focus();await page.keyboard.press("Enter")
   await page.getByRole("status").filter({hasText:"Loading notifications"}).waitFor({state:"attached"})
   expect(await bell.getAttribute("aria-busy")).toBe("true")
   await page.keyboard.press("Escape");expect(await bell.getAttribute("aria-expanded")).toBe("false")
   overlay.resolve();await expect.poll(()=>bell.getAttribute("aria-controls")).not.toBeNull()
   expect(await sameBell(page)).toBe(true);expect(await bell.evaluate(button=>button===document.activeElement)).toBe(true)
   await page.keyboard.press("Enter");await page.getByRole("dialog",{name:"Notifications",exact:true}).waitFor()
   expect(await sameBell(page)).toBe(true)
   await page.keyboard.press("Escape");await expect.poll(()=>bell.getAttribute("aria-expanded")).toBe("false")
   await expect.poll(()=>bell.evaluate(button=>button===document.activeElement)).toBe(true)
   badge.resolve();await setCount(page,3)
   await bell.click();await page.getByRole("button",{name:"Mark all read",exact:true}).click()
   await expect.poll(()=>bell.getAttribute("aria-description")).toBe("0 unread notifications")
   await page.keyboard.press("Escape")
   await setCount(page,8);expect(await bell.innerText()).toContain("8")
   expect(await sameBell(page)).toBe(true);expect(overlayRequested).toBe(1);expect(badgeRequested).toBe(1)
   expect(errors).toEqual([])
  }catch(error){throw new Error(`${String(error)}; errors=${errors.join(";")}; body=${await page.locator("body").innerText()}; server=${JSON.stringify(await page.evaluate(()=>fetch("/fixture-notifications",{method:"POST",body:"list"}).then(r=>r.json())))}`)}finally{overlay.resolve();badge.resolve();await page.close()}
 },30_000)

 it("keeps mobile drawer open/close/reopen, reduced motion and current counts",async()=>{
  count=4
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:"reduce"})
  page.setDefaultTimeout(8000)
  try{
   await page.goto(origin,{waitUntil:"domcontentloaded"})
   const bell=page.getByRole("button",{name:"Notifications",exact:true})
   await expect.poll(()=>bell.getAttribute("aria-description")).toBe("4 unread notifications")
   await bell.evaluate(button=>{(window as unknown as {savedBell:Element}).savedBell=button})
   await bell.click();const dialog=page.getByRole("dialog",{name:"Notifications",exact:true});await dialog.waitFor()
   expect(await dialog.getAttribute("data-vaul-drawer")).not.toBeNull()
   await setCount(page,9);await page.getByRole("tab",{name:"Unread (9)",exact:true}).waitFor()
   await page.keyboard.press("Escape");await expect.poll(()=>bell.getAttribute("aria-expanded")).toBe("false")
   await expect.poll(()=>bell.evaluate(button=>button===document.activeElement)).toBe(true)
   await bell.click();await dialog.waitFor();expect(await sameBell(page)).toBe(true)
   await page.getByRole("button",{name:"Mark all read",exact:true}).click()
   await expect.poll(()=>bell.getAttribute("aria-description")).toBe("0 unread notifications")
   await page.keyboard.press("Escape");expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  }catch(error){throw new Error(`${String(error)}; body=${await page.locator("body").innerText()}; server=${JSON.stringify(await page.evaluate(()=>fetch("/fixture-notifications",{method:"POST",body:"list"}).then(r=>r.json())))}`)}finally{await page.close()}
 },30_000)
})
