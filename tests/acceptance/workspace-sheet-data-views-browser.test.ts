import { spawn } from "node:child_process"
import path from "node:path"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import type { AddressInfo } from "node:net"
import { afterAll,beforeAll,describe,expect,it,vi } from "vitest"
import {chromium,type Browser} from "@playwright/test"
import {createServer,type ViteDevServer} from "vite"
import {dataViewCommandSchema} from "@/features/workspace-data-views/lib/schema"
import {runSheetDataView} from "@/features/workspace-data-views/server/sheet-source"
import {createClosureDatabaseHarness,databaseUrl} from "./organization-closure-database-helpers"
const mocks=vi.hoisted(()=>({rpc:vi.fn(),read:vi.fn()}))
vi.mock("@/lib/supabase/admin",()=>({createSupabaseAdminClient:()=>({rpc:(...args:unknown[])=>({abortSignal:()=>mocks.rpc(...args)})})}))
vi.mock("@/features/google-drive",async()=>({...await import("@/features/google-drive/types"),readGoogleSheetRange:mocks.read}))
const db=createClosureDatabaseHarness(spawn),id=(n:number)=>`10000000-0000-4000-8000-${String(n).padStart(12,"0")}`
const quote=(value:unknown)=>`'${JSON.stringify(value).replaceAll("'","''")}'::jsonb`
describe.skipIf(!databaseUrl)("linked Sheet browser with actual SQL and controlled provider transport",()=>{
 let server:ViteDevServer,browser:Browser,origin:string
 beforeAll(async()=>{
  const reset=await db.query("select public.fixture_response_data_views()");expect(reset.code,reset.stderr).toBe(0)
  mocks.read.mockResolvedValue({title:"Fixture Sheet",sheetTitle:"Live range",email:"viewer@example.org",revision:"a".repeat(64),rows:[["Name","Total"],["Source record","42"],["Other record","7"],...Array.from({length:28},(_,index)=>[`Z record ${String(index).padStart(2,"0")}`,String(index)])]})
  mocks.rpc.mockImplementation(async(name:string,args:{p_actor_id:string;p_command:unknown;p_commit:boolean;p_header_hash:string|null})=>{
   expect(name).toBe("workspace_sheet_view_command")
   const result=await db.query(`\\set VERBOSITY verbose\nset role service_role;select public.workspace_sheet_view_command('${args.p_actor_id}',${quote(args.p_command)},${args.p_commit},${args.p_header_hash?`'${args.p_header_hash}'`:"null"})`)
   return result.code===0?{data:result.stdout.trim()?JSON.parse(result.stdout.trim()):null,error:null}:{data:null,error:{code:result.stderr.match(/ERROR:\s+([A-Z0-9]{5}):/)?.[1]??"XX000"}}
  })
  server=await createServer({configFile:false,root:process.cwd(),cacheDir:mkdtempSync(path.join(tmpdir(),"ch-s11-sheet-views-vite-")),define:{"process.env":"{}"},optimizeDeps:{entries:["tests/acceptance/fixtures/workspace-sheet-data-views-browser.tsx"]},resolve:{alias:{"@":path.resolve("src")}},esbuild:{jsx:"automatic"},server:{host:"127.0.0.1",port:0},plugins:[{name:"sheet-view-test-bridge",enforce:"pre",transform(_code,module){
   if(module.endsWith("/workspace-data-views/server/actions.ts"))return `export async function runDataViewCommand(command){return(await fetch('/fixture-command',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(command)})).json()}`
  },configureServer(instance){instance.middlewares.use(async(request,response,next)=>{
   if(request.url==="/"){response.setHeader("Content-Type","text/html");response.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/tests/acceptance/fixtures/workspace-sheet-data-views-browser.tsx"></script></body></html>');return}
   if(request.url!=="/fixture-command"||request.method!=="POST")return next()
   let body="";for await(const chunk of request)body+=chunk
   const command=dataViewCommandSchema.parse(JSON.parse(body));let result=await runSheetDataView(id(1),command)
   if(result===null){const sql=await db.query(`set role authenticated;set request.jwt.claim.sub='${id(1)}';select public.workspace_data_view_command(${quote(command)})`);result=sql.code===0?{ok:true,data:JSON.parse(sql.stdout.trim())}:{ok:false,code:"denied",error:"Source unavailable"}}
   response.setHeader("Content-Type","application/json");response.end(JSON.stringify(result))
  })}}]})
  await server.listen();origin=`http://127.0.0.1:${(server.httpServer!.address()as AddressInfo).port}`;browser=await chromium.launch({headless:true})
 },30000)
 afterAll(async()=>{await browser?.close();await server?.close();for(const child of db.clients)child.kill()})
 it("creates, pages and refreshes a linked range, persists filters and clears revoked data",async()=>{
  const page=await browser.newPage({viewport:{width:1100,height:850}}),errors:string[]=[];page.on("pageerror",error=>errors.push(error.message));page.setDefaultTimeout(5000)
  try{
   await page.goto(origin,{waitUntil:"domcontentloaded"});await page.getByRole("combobox",{name:"Source",exact:true}).selectOption({ label: "Linked Google Sheet…" })
   await page.getByRole("textbox",{name:"Spreadsheet ID"}).fill("isolated-sheet-fixture")
   await page.getByRole("spinbutton",{name:"Sheet tab ID (gid)"}).fill("7");await page.getByRole("spinbutton",{name:"Column count"}).fill("2")
   await page.getByRole("textbox",{name:"View name"}).fill("Linked records")
   await page.getByRole("button",{name:"Create saved view",exact:true}).click();await page.getByText("Source record",{exact:true}).waitFor()
   expect(await page.getByRole("button",{name:/^Edit /}).count()).toBe(0);expect(await page.getByRole("link",{name:"Open in Sheets"}).getAttribute("href")).toContain("isolated-sheet-fixture/edit#gid=7")
   await page.getByText("30 records · page 1",{exact:true}).waitFor();expect(await page.getByRole("row").count()).toBe(26)
   await page.getByRole("button",{name:"Next",exact:true}).click();await page.getByText("30 records · page 2",{exact:true}).waitFor();await page.getByText("Z record 27",{exact:true}).waitFor();expect(await page.getByRole("row").count()).toBe(6)
   expect(await page.getByText("Source record",{exact:true}).count()).toBe(0);expect(await page.getByText("Z record 27",{exact:true}).count()).toBe(1);expect(await page.getByRole("button",{name:"Next",exact:true}).isDisabled()).toBe(true)
   await page.getByRole("button",{name:"Previous",exact:true}).click();await page.getByText("30 records · page 1",{exact:true}).waitFor();await page.getByText("Source record",{exact:true}).waitFor()
   mocks.read.mockResolvedValue({title:"Fixture Sheet",sheetTitle:"Live range",email:"viewer@example.org",revision:"b".repeat(64),rows:[["Name","Total"],["Source record","43"],["Other record","7"],...Array.from({length:28},(_,index)=>[`Z record ${String(index).padStart(2,"0")}`,String(index)])]})
   await page.getByRole("button",{name:"Refresh",exact:true}).click();await page.getByText("43",{exact:true}).waitFor();expect(await page.getByText("42",{exact:true}).count()).toBe(0)
   await page.getByRole("button",{name:"View settings",exact:true}).click();await page.getByRole("combobox",{name:"Filter column"}).selectOption({ label: "Name contains" });await page.getByRole("textbox",{name:"Filter contains"}).fill("Source")
   await page.getByRole("button",{name:"Save view settings"}).click();await page.getByText("Other record",{exact:true}).waitFor({state:"hidden"})
   await page.reload();await page.getByText("Source record",{exact:true}).waitFor();expect(await page.getByText("Other record",{exact:true}).count()).toBe(0)
   await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)
   const {GoogleDriveError}=await import("@/features/google-drive/types");mocks.read.mockRejectedValue(new GoogleDriveError("file_not_authorized",403))
   await page.getByRole("button",{name:"Refresh",exact:true}).click();await page.getByRole("alert").waitFor();expect(await page.getByText("Source record",{exact:true}).count()).toBe(0);expect(await page.getByRole("link",{name:"Open in Sheets"}).count()).toBe(0)
   expect(errors).toEqual([])
  }catch(error){throw new Error(`${String(error)}\n${errors.join(";")}\n${await page.locator("body").innerText()}`)}finally{await page.close()}
 },30000)
})
