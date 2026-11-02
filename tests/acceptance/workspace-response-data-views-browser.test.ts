import { spawn } from "node:child_process"
import path from "node:path"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import type { AddressInfo } from "node:net"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { chromium, type Browser } from "@playwright/test"
import { createServer, type ViteDevServer } from "vite"
import { dataViewCommandSchema } from "@/features/workspace-data-views/lib/schema"
import { runResponseDataView } from "@/features/workspace-data-views/server/response-source"
import { createClosureDatabaseHarness, databaseUrl } from "./organization-closure-database-helpers"
const mocks=vi.hoisted(()=>({rpc:vi.fn()}))
vi.mock("@/lib/supabase/admin",()=>({createSupabaseAdminClient:()=>({rpc:mocks.rpc})}))
const db=createClosureDatabaseHarness(spawn), id=(n:number)=>`10000000-0000-4000-8000-${String(n).padStart(12,"0")}`
const quote=(value:unknown)=>`'${JSON.stringify(value).replaceAll("'","''")}'::jsonb`
describe.skipIf(!databaseUrl)("native response view real browser/source writer",()=>{
 let server:ViteDevServer,browser:Browser,origin:string,actor=4
 beforeAll(async()=>{
  const reset=await db.query("select public.fixture_response_data_views()");expect(reset.code,reset.stderr).toBe(0)
  mocks.rpc.mockImplementation(async(name:string,args:{p_actor_id:string;p_command:unknown})=>{
   if(!["workspace_response_view_command","organization_form_intake"].includes(name))throw new Error("Unexpected RPC")
   const result=await db.query(`\\set VERBOSITY verbose\nset role service_role; select public.${name}('${args.p_actor_id}',${quote(args.p_command)})`)
   return result.code===0?{data:JSON.parse(result.stdout.trim()),error:null}:{data:null,error:{code:result.stderr.match(/ERROR:\s+([A-Z0-9]{5}):/)?.[1]??"XX000",message:result.stderr}}
  })
  server=await createServer({configFile:false,root:process.cwd(),cacheDir:mkdtempSync(path.join(tmpdir(),"ch-s11-native-views-vite-")),define:{"process.env":"{}"},optimizeDeps:{entries:["tests/acceptance/fixtures/workspace-response-data-views-browser.tsx"]},resolve:{alias:{"@":path.resolve("src")}},esbuild:{jsx:"automatic"},server:{host:"127.0.0.1",port:0},plugins:[{name:"native-view-test-bridge",enforce:"pre",transform(_code,module){
   if(module.endsWith("/workspace-data-views/server/actions.ts"))return `export async function runDataViewCommand(command){return (await fetch('/fixture-command',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(command)})).json()}`
  },configureServer(instance){instance.middlewares.use(async(request,response,next)=>{
   if(request.url==="/"){response.setHeader("Content-Type","text/html");response.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/tests/acceptance/fixtures/workspace-response-data-views-browser.tsx"></script></body></html>');return}
   if(request.url!=="/fixture-command"||request.method!=="POST")return next()
   let body="";for await(const chunk of request)body+=chunk
   const command=dataViewCommandSchema.parse(JSON.parse(body))
   response.setHeader("Content-Type","application/json");response.end(JSON.stringify(await runResponseDataView(id(actor),command)))
  })}}]})
  await server.listen();origin=`http://127.0.0.1:${(server.httpServer!.address()as AddressInfo).port}`;browser=await chromium.launch({headless:true})
 },30000)
 afterAll(async()=>{await browser?.close();await server?.close();for(const child of db.clients)child.kill()})
 it("creates, pages and filters response views, preserves correction drafts and clears revoked rows",async()=>{
  const page=await browser.newPage({viewport:{width:1100,height:850}}),errors:string[]=[];page.on("pageerror",error=>errors.push(error.message))
  page.setDefaultTimeout(5000)
  try {
  await page.goto(origin);await page.getByRole("textbox",{name:"Response view name",exact:true}).fill("Private responses")
  await page.getByRole("button",{name:"Create response view",exact:true}).click()
  await page.getByRole("button",{name:"Edit Name",exact:true}).click()
  expect(await page.getByRole("textbox",{name:/^Name/}).evaluate(element => element === document.activeElement)).toBe(true)
  await page.getByRole("textbox",{name:/^Name/}).fill("Changed through saved view")
  await page.getByRole("button",{name:"Save answer",exact:true}).click()
  await page.getByRole("button",{name:"Edit Name",exact:true}).waitFor()
  expect(await page.getByRole("button",{name:"Edit Name",exact:true}).textContent()).toBe("Changed through saved view")
  const source=await db.query("select answers->0->>'value' from public.organization_form_responses");expect(source.stdout.trim()).toBe("Changed through saved view")
  await page.getByRole("button",{name:"Edit Name",exact:true}).click();await page.getByRole("textbox",{name:/^Name/}).fill("Kept draft")
  const changed=await db.query("select public.fixture_form_command('correct',4,jsonb_build_object('operationId',public.fixture_form_id(5200),'expectedRevision',2,'hash',repeat('c',64),'answers',jsonb_build_array(jsonb_build_object('questionId',public.fixture_form_id(90),'value','Other editor'))))");expect(changed.code,changed.stderr).toBe(0)
  await page.getByRole("button",{name:"Save answer",exact:true}).click();await page.getByRole("alert").waitFor()
  expect(await page.getByRole("textbox",{name:/^Name/}).inputValue()).toBe("Kept draft")
  await page.getByRole("button",{name:"Refresh",exact:true}).click();await page.getByRole("button",{name:"Use latest response revision"}).click()
  await page.getByRole("button",{name:"Save answer",exact:true}).click();await page.getByRole("button",{name:"Edit Name",exact:true}).waitFor()
  await page.reload();await page.getByRole("button",{name:"Private responses",exact:true}).click();expect(await page.getByRole("button",{name:"Edit Name",exact:true}).textContent()).toBe("Kept draft")
  const seeded=await db.query("select public.fixture_form_command('submit',null,jsonb_build_object('id',public.fixture_form_id(6000+n),'operationId',public.fixture_form_id(6100+n),'answers',jsonb_build_array(jsonb_build_object('questionId',public.fixture_form_id(90),'value','Pagination record '||lpad(n::text,2,'0'))))) from generate_series(1,25)n");expect(seeded.code,seeded.stderr).toBe(0)
  await page.getByRole("button",{name:"Refresh",exact:true}).click();await page.getByText("26 records · page 1",{exact:true}).waitFor()
  expect(await page.getByRole("button",{name:"Edit Name",exact:true}).count()).toBe(25)
  await page.getByRole("button",{name:"Next",exact:true}).click();await page.getByText("26 records · page 2",{exact:true}).waitFor();await page.getByText("Kept draft",{exact:true}).waitFor()
  expect(await page.getByRole("button",{name:"Edit Name",exact:true}).count()).toBe(1)
  expect(await page.getByRole("button",{name:"Edit Name",exact:true}).textContent()).toBe("Kept draft")
  expect(await page.getByRole("button",{name:"Next",exact:true}).isDisabled()).toBe(true)
  await page.getByRole("button",{name:"Previous",exact:true}).click();await page.getByText("26 records · page 1",{exact:true}).waitFor();await page.getByText("Pagination record 25",{exact:true}).waitFor()
  await page.getByRole("button",{name:"View settings",exact:true}).click();await page.getByRole("combobox",{name:"Filter column"}).selectOption({label:"Name contains"});await page.getByRole("textbox",{name:"Filter contains"}).fill("Kept draft")
  await page.getByRole("button",{name:"Save view settings",exact:true}).click();await page.getByText("1 records · page 1",{exact:true}).waitFor()
  await page.reload();await page.getByRole("button",{name:"Private responses",exact:true}).click();await page.getByText("1 records · page 1",{exact:true}).waitFor()
  expect(await page.getByRole("button",{name:"Edit Name",exact:true}).textContent()).toBe("Kept draft")
  await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)
  actor=1;await page.getByRole("button",{name:"Refresh",exact:true}).click();await page.getByRole("alert").waitFor()
  expect(await page.getByRole("button",{name:"Edit Name",exact:true}).count()).toBe(0);expect(await page.getByText("Kept draft",{exact:true}).count()).toBe(0)
  expect(errors).toEqual([])
  } catch (failure) { throw new Error(`${String(failure)}\nPage errors: ${errors.join("; ")}\n${await page.locator("body").innerText()}`) } finally { await page.close() }
 },30000)
})
