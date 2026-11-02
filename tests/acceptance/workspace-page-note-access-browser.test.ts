import {spawn} from "node:child_process"
import path from "node:path"
import {mkdtempSync} from "node:fs"
import {tmpdir} from "node:os"
import type {AddressInfo} from "node:net"
import {afterAll,beforeAll,describe,expect,it,vi} from "vitest"
import {chromium,type Browser} from "@playwright/test"
import {createServer,type ViteDevServer} from "vite"
import {executePageNoteAccess} from "@/features/workspace-sharing/server/page-note-access"
import {executePageAccess} from "@/features/workspace-sharing/server/page-access"
import {WorkspaceSharingError} from "@/features/workspace-sharing/server/page-projection"
import {createClosureDatabaseHarness,databaseUrl} from "./organization-closure-database-helpers"
import {noteFixtureId as id,noteFixtureQuote as quote,seedPageNoteFixture} from "./fixtures/workspace-page-note-source"
const mocks=vi.hoisted(()=>({rpc:vi.fn(),actor:1}))
vi.mock("@/lib/supabase/admin",()=>({createSupabaseAdminClient:()=>({rpc:mocks.rpc})}))
vi.mock("@/lib/supabase/server",()=>({createSupabaseServerClient:async()=>({auth:{getUser:async()=>({data:{user:{id:`10000000-0000-4000-8000-${String(mocks.actor).padStart(12,"0")}`}},error:null})}})}))
const db=createClosureDatabaseHarness(spawn)
describe.skipIf(!databaseUrl)("selected-note opt-in and canonical guest editing browser",()=>{
 let server:ViteDevServer,browser:Browser,origin:string,lostReply=true
 const writes:unknown[]=[],pageEdits:unknown[]=[]
 beforeAll(async()=>{
  await seedPageNoteFixture(db.query);mocks.actor=1
  mocks.rpc.mockImplementation(async(name:string,args:Record<string,unknown>)=>{
   if(!["workspace_page_guest_command","workspace_page_note_command"].includes(name))throw new Error("Unexpected owner")
   const source=name==="workspace_page_note_command"?`,${args.p_expected_graph?quote(args.p_expected_graph):"null"},${args.p_next_graph?quote(args.p_next_graph):"null"}`:""
   const result=await db.query(`\\set VERBOSITY verbose\nset role service_role;select public.${name}('${args.p_actor_id}','${args.p_page_id}',${quote(args.p_command)},${args.p_hash?`'${args.p_hash}'`:"null"}${source})`)
   return result.code===0?{data:JSON.parse(result.stdout.trim()),error:null}:{data:null,error:{code:result.stderr.match(/ERROR:\s+([A-Z0-9]{5}):/)?.[1]??"XX000",message:result.stderr}}
  })
  // Vite does not split Next server-action/client barrels. Resolve the real
  // editor/menu/math exports and fail any out-of-scope AI action explicitly.
  server=await createServer({configFile:false,root:process.cwd(),cacheDir:mkdtempSync(path.join(tmpdir(),"ch-s06-note-vite-")),define:{"process.env":"{}"},optimizeDeps:{entries:["tests/acceptance/fixtures/workspace-page-note-access-browser.tsx"]},resolve:{alias:{"@":path.resolve("src")}},esbuild:{jsx:"automatic"},server:{host:"127.0.0.1",port:0,watch:null},plugins:[{name:"selected-note-test-bridge",enforce:"pre",resolveId(source,importer){
   if(["@/features/workspace-particles/client",path.resolve("src/features/workspace-particles/client"),path.resolve("src/features/workspace-particles/client.ts")].includes(source)&&importer?.includes("workspace-sharing/"))return path.resolve("src/features/workspace-particles/components/notes-rich-editor.tsx")
   if(["@/features/workspace-ai/client",path.resolve("src/features/workspace-ai/client"),path.resolve("src/features/workspace-ai/client.ts")].includes(source)&&importer?.includes("rich-text-editor"))return path.resolve("src/features/workspace-ai/components/selection-assistance-menu.tsx")
   if(["@/features/ai-credits/client",path.resolve("src/features/ai-credits/client"),path.resolve("src/features/ai-credits/client.ts")].includes(source)&&importer?.includes("use-selection-assistance"))return path.resolve("src/features/ai-credits/lib/index.ts")
  },transform(_code,module){
   if(module.endsWith("/workspace-ai/actions.ts"))return 'export async function quoteSelectionAssistance(){throw new Error("AI action is outside this note fixture")} export const readDocumentAssistance=quoteSelectionAssistance, stopDocumentAssistance=quoteSelectionAssistance'
   if(module.endsWith("/workspace-sharing/access-actions.ts"))return `export async function workspacePageAccessAction(command){return(await fetch('/fixture-page',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(command)})).json()}`
   if(module.endsWith("/workspace-sharing/note-actions.ts"))return `export async function workspacePageNoteAction(command){return(await fetch('/fixture-note',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(command)})).json()}`
  },configureServer(instance){instance.middlewares.use(async(request,response,next)=>{
   if(request.url==="/"){response.setHeader("Content-Type","text/html");response.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/tests/acceptance/fixtures/workspace-page-note-access-browser.tsx"></script></body></html>');return}
   if(!["/fixture-page","/fixture-note","/fixture-identity"].includes(request.url??"")||request.method!=="POST")return next()
   let body="";for await(const chunk of request)body+=chunk
   if(request.url==="/fixture-identity"){mocks.actor=Number(body);response.end("ok");return}
   let result;const command=JSON.parse(body)
   if(request.url==="/fixture-note"&&command.action==="write")writes.push(command)
   if(request.url==="/fixture-page"&&command.action==="edit")pageEdits.push(command)
   try{result={ok:true,...await (request.url==="/fixture-note"?executePageNoteAccess:executePageAccess)(command)}
    if(request.url==="/fixture-note"&&command.action==="write"&&lostReply){lostReply=false;result={ok:false,code:"unavailable",error:"Unable to confirm this note request. Retry the same request.",uncertain:true}}
   }
   catch(error){result=error instanceof WorkspaceSharingError?{ok:false,code:error.code,error:error.message,uncertain:error.uncertain}:{ok:false,code:"unavailable",error:"Fixture request failed",uncertain:false}}
   response.setHeader("Content-Type","application/json");response.end(JSON.stringify(result))
  })}}]})
  await server.listen();await server.warmupRequest("/src/features/workspace-particles/components/notes-rich-editor.tsx");origin=`http://127.0.0.1:${(server.httpServer!.address()as AddressInfo).port}`;browser=await chromium.launch({headless:true})
 },30000)
 afterAll(async()=>{await browser?.close();await server?.close();for(const child of db.clients)child.kill()})
 it("requires explicit full-source review, edits/reloads the original note, and leaves publication unchanged",async()=>{
  const page=await browser.newPage({viewport:{width:1100,height:900}}),errors:string[]=[];page.setDefaultTimeout(5000);page.on("pageerror",error=>errors.push(error.stack??error.message))
  page.on("requestfailed",request=>errors.push(`${request.url()}: ${request.failure()?.errorText}`));page.on("response",response=>{if(response.status()>=400)errors.push(`${response.status()} ${response.url()}`)})
  const external:string[]=[];await page.route("**/*",route=>{if(new URL(route.request().url()).origin!==origin){external.push(route.request().url());return route.abort()}return route.continue()})
  try{
   await page.goto(origin,{waitUntil:"domcontentloaded"});await page.getByRole("button",{name:"Review note editing",exact:true}).click()
   const reviewed=page.locator('[aria-label="Note content"]');await reviewed.waitFor();expect(await reviewed.innerText()).toBe("Shared source")
   await page.getByRole("button",{name:"Allow note editing",exact:true}).click();await page.getByRole("button",{name:"Remove note editing",exact:true}).waitFor()
   await page.getByRole("button",{name:"Switch to invited editor"}).click();await page.getByRole("button",{name:"Edit shared note: Selected note"}).click()
   const editor=page.locator('[aria-label="Note content"]');await editor.waitFor();expect(await editor.evaluate(element=>element===document.activeElement)).toBe(true);await editor.fill("Guest canonical edit")
   await page.getByRole("button",{name:"Save shared note",exact:true}).click();await page.getByRole("button",{name:"Retry same note save",exact:true}).waitFor()
   expect(await page.getByRole("button",{name:"Save shared note",exact:true}).isDisabled()).toBe(true);expect(await page.getByRole("button",{name:"Close note",exact:true}).isDisabled()).toBe(true)
   await page.getByRole("form",{name:"Edit shared page details"}).evaluate(form=>(form as HTMLFormElement).requestSubmit())
   await page.getByRole("button",{name:"Retry same note save",exact:true}).click();await page.getByText("Earlier save confirmed. Current source loaded.",{exact:true}).waitFor()
   expect(writes).toHaveLength(2);expect(writes[1]).toEqual(writes[0])
   const revision=await db.query(`select state#>>'{particleGraph,revision}' from public.organization_workspace_boards where org_id='${id(1)}'`);expect(revision.stdout.trim()).toBe("2")
   const stored=await db.query(`select state#>>'{particleGraph,particles,0,data,widget,source,content}' from public.organization_workspace_boards where org_id='${id(1)}'`);expect(stored.stdout.trim()).toBe("Guest canonical edit")
   await page.reload();await page.getByRole("button",{name:"Edit shared note: Selected note"}).click();expect(await editor.innerText()).toBe("Guest canonical edit")
   expect(await page.getByText("Shared source",{exact:true}).count()).toBeGreaterThan(0)
   await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)
   const revoke=await db.query("update public.workspace_page_note_scopes set enabled=false");expect(revoke.code,revoke.stderr).toBe(0)
   await page.getByRole("alert").filter({hasText:"editing access changed"}).waitFor({timeout:7000});expect(await editor.count()).toBe(0)
   expect(pageEdits).toEqual([]);expect(errors).toEqual([]);expect(external).toEqual([])
  }catch(error){const serverModules=[...server.moduleGraph.urlToModuleMap.values()].filter(module=>module.url.includes('/server/')).map(module=>module.url);throw new Error(`${String(error)}\n${errors.join(";")}\n${serverModules.join(";")}\n${await page.locator("body").innerText()}`)}finally{await page.close()}
 },30000)
})
