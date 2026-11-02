import { spawn } from "node:child_process"
import { createHash } from "node:crypto"
import path from "node:path"
import type { AddressInfo } from "node:net"
import { afterAll,beforeAll,describe,expect,it,vi } from "vitest"
import { chromium,type Browser } from "@playwright/test"
import { createServer,type ViteDevServer } from "vite"
const mocks=vi.hoisted(()=>({actor:"10000000-0000-4000-8000-000000000001",rpc:vi.fn(),provider:vi.fn()}))
vi.mock("@/lib/supabase/server",()=>({createSupabaseServerClient:async()=>({auth:{getUser:async()=>({data:{user:{id:mocks.actor}},error:null})}})}))
vi.mock("@/lib/supabase/admin",()=>({createSupabaseAdminClient:()=>({rpc:(...args:unknown[])=>({abortSignal:()=>mocks.rpc(...args)})})}))
vi.mock("@/features/google-drive",async()=>({...await import("@/features/google-drive/types"),readGoogleSheetRange:mocks.provider}))
import { createLinkedSheetView,readComposableSheetSource,readSheetViewCreation } from "@/features/workspace-data-views/server/sheet-composition"
import { runSheetDataView } from "@/features/workspace-data-views/server/sheet-source"
import { createResearchOutputBindings } from "@/features/workspace-ai/lib/research-data-view"
import { dataViewCommandSchema } from "@/features/workspace-data-views"
import { createClosureDatabaseHarness,databaseUrl } from "./organization-closure-database-helpers"
const db=createClosureDatabaseHarness(spawn),id=(n:number)=>`10000000-0000-4000-8000-${String(n).padStart(12,"0")}`
const quote=(value:unknown)=>value==null?"null":`'${JSON.stringify(value).replaceAll("'","''")}'::jsonb`
async function sql(query:string){const reply=await db.query(query);expect(reply.code,reply.stderr).toBe(0);return reply.stdout.trim()}
const range={spreadsheetId:"isolated-sheet-fixture",sheetId:7,startRow:1,rowCount:101,startColumn:1,columnCount:2}
describe.skipIf(!databaseUrl)("linked Sheet AI preview/review/apply/reload with real canonical source SQL",()=>{
 let server:ViteDevServer,browser:Browser,origin:string,result:unknown
 let loseReply=true
 const calls:{method:string;action:string}[]=[]
 beforeAll(async()=>{
  await sql("select public.fixture_response_data_views();truncate public.google_drive_connections cascade")
  await sql(`insert into public.google_drive_connections(id,user_id,google_subject,google_email,refresh_token_ciphertext,refresh_token_iv,refresh_token_auth_tag,key_version,connected_at) values('${id(8001)}','${id(1)}','subject-viewer','fixture@example.org','cipher','iv','tag','v1','2026-11-02T00:00:00Z')`)
  const executionIdentity=createHash("sha256").update(`google-sheet-viewer:${id(8001)}:subject-viewer:${new Date('2026-11-02T00:00:00Z').getTime()}`).digest("hex")
  mocks.provider.mockResolvedValue({title:"Private Google title",sheetTitle:"Private tab",email:"fixture@example.org",executionIdentity,revision:"a".repeat(64),rows:[["Name","Value"],["PRIVATE_SHEET_ROW","42"]]})
  mocks.rpc.mockImplementation(async(name:string,args:Record<string,unknown>)=>{
   const call=name==="workspace_sheet_view_composition"?`public.${name}('${args.p_actor_id}','${args.p_org}','${args.p_source_view}',${quote(args.p_expected)},${quote(args.p_command)},${args.p_commit})`:`public.workspace_sheet_view_command('${args.p_actor_id}',${quote(args.p_command)},${args.p_commit},${args.p_header_hash?`'${args.p_header_hash}'`:"null"})`
   const reply=await db.query(`\\set VERBOSITY verbose\nset role service_role;select ${call}`)
   return reply.code===0?{data:JSON.parse(reply.stdout.trim()),error:null}:{data:null,error:{code:reply.stderr.match(/ERROR:\s+([A-Z0-9]{5}):/)?.[1]??"XX000"}}
  })
  expect(await runSheetDataView(mocks.actor,{action:"create_view",organizationId:id(1),viewId:id(7101),requestId:id(7102),name:"Linked source",source:{kind:"sheets",range}})).toMatchObject({ok:true})
  const bound=await readComposableSheetSource(id(1),id(7101));expect(bound).toMatchObject({ok:true});if(!bound.ok)throw Error("Fixture source unavailable")
  const items=[{key:"sheet",kind:"data_view" as const,title:"Linked source view",description:"Read-only existing Sheet",dataView:{kind:"sheets" as const,sourceViewId:bound.data.viewId},referenceId:null,evidenceIds:[],dependsOn:[]}]
  let next=7200;result={runId:id(7000),target:{organizationId:id(1),objectiveId:id(7001),revision:0},title:"Review linked source",summary:"",questions:[],sources:[],decisions:[],items,outputBindings:createResearchOutputBindings(items,()=>id(++next),[bound.data])}
  server=await createServer({configFile:false,root:process.cwd(),cacheDir:"/tmp/ch-s10-sheet-views-vite-cache",resolve:{alias:{"@":path.resolve("src")}},esbuild:{jsx:"automatic"},define:{"process.env.NEXT_PUBLIC_WORKSPACE_AI_PRESENTATION":JSON.stringify("1")},server:{host:"127.0.0.1",port:0},plugins:[{name:"disposable-sheet-composition-bridge",enforce:"pre",transform(code,module){
   if(module.endsWith("/workspace-ai/server/research-data-view-effects.ts"))return code.replace('import "server-only"','')
   if(module.endsWith("/workspace-data-views/server.ts"))return `const send=async(method,command,binding)=>(await fetch('/fixture-source',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({method,command,binding})})).json();export const createLinkedSheetView=(command,binding)=>send('write',command,binding);export const readExistingDataViewCreation=(command,binding)=>send('receipt',command,binding);export const runDataViewCommand=()=>{throw Error('Unexpected alternate source writer')};export const readProjectDataViewCreation=()=>{throw Error('Unexpected projects source')};`
   if(module.endsWith("/workspace-data-views/server/actions.ts"))return `export async function runDataViewCommand(command){return(await fetch('/fixture-source',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({method:'manual',command})})).json()}`
  },configureServer(instance){instance.middlewares.use(async(request,response,next)=>{
   if(request.url==="/"){response.setHeader("Content-Type","text/html");response.end('<!doctype html><html><body><div id="root"></div><script type="module" src="/tests/acceptance/fixtures/workspace-research-existing-views-browser.tsx"></script></body></html>');return}
   if(request.url==="/fixture-result"){response.setHeader("Content-Type","application/json");response.end(JSON.stringify(result));return}
   if(request.url!=="/fixture-source"||request.method!=="POST")return next()
   let body="";for await(const chunk of request)body+=chunk
   const {method,command,binding}=JSON.parse(body),parsed=dataViewCommandSchema.safeParse(command)
   response.setHeader("Content-Type","application/json")
   if(!parsed.success||!["write","receipt","manual"].includes(method)){response.end(JSON.stringify({ok:false,code:"invalid"}));return}
   calls.push({method,action:parsed.data.action})
   const reply=method==="write"?await createLinkedSheetView(parsed.data,binding):method==="receipt"?await readSheetViewCreation(parsed.data,binding):await runSheetDataView(mocks.actor,parsed.data)
   if(reply?.ok&&method==="write"&&loseReply){loseReply=false;response.end(JSON.stringify({ok:false,code:"unavailable",error:"Synthetic reply lost after real linked-view commit."}));return}
   response.end(JSON.stringify(reply))
  })}}]})
  await server.listen();origin=`http://127.0.0.1:${(server.httpServer!.address() as AddressInfo).port}`;browser=await chromium.launch({headless:true})
  const warm=await browser.newPage();warm.on("pageerror",error=>console.error(error.stack));await warm.goto(origin);await warm.getByLabel("Item 1 title",{exact:true}).waitFor();await warm.close()
 },30000)
 afterAll(async()=>{await browser?.close();await server?.close();for(const child of db.clients)child.kill()})
 it("reviews metadata, recovers a committed effect after reload without replay, explicitly opens rows, and hides them after provider revocation",async()=>{
  const page=await browser.newPage({viewport:{width:1100,height:900}});page.setDefaultTimeout(7000)
  const errors:string[]=[];page.on("pageerror",error=>errors.push(error.message));await page.goto(origin)
  const title=page.getByLabel("Item 1 title",{exact:true});await title.fill("Reviewed linked source")
  expect(await page.locator("body").innerText()).toContain("Existing linked Sheet · read-only saved view");expect(await page.locator("body").innerText()).not.toContain("PRIVATE_SHEET_ROW");expect(calls).toEqual([])
  await page.getByRole("button",{name:"Apply reviewed output"}).click();await page.getByText("Synthetic reply lost after real linked-view commit.").waitFor();expect(await title.isDisabled()).toBe(true)
  expect(calls.filter(call=>call.method==="write")).toHaveLength(1)
  await page.reload();await title.waitFor();expect(await title.inputValue()).toBe("Reviewed linked source")
  await page.getByRole("button",{name:"Check saved outputs"}).click();await page.getByRole("button",{name:"Open saved view",exact:true}).waitFor()
  await page.getByRole("button",{name:"Apply reviewed output"}).click();await page.getByRole("alert").filter({hasText:"Synthetic plan transaction failed"}).waitFor()
  expect(calls.filter(call=>call.method==="write")).toHaveLength(1);expect(calls.some(call=>call.action==="read")).toBe(false)
  await page.getByRole("button",{name:"Open saved view",exact:true}).click();await page.getByText("PRIVATE_SHEET_ROW",{exact:true}).waitFor()
  expect(await page.getByText("42",{exact:true}).count()).toBe(1)
  expect(await sql("select count(*) from public.organization_data_views")).toBe("2");expect(await sql("select count(*) from public.organization_data_rows")).toBe("0")
  const {GoogleDriveError}=await import("@/features/google-drive/types");mocks.provider.mockRejectedValue(new GoogleDriveError("file_not_authorized",403))
  await page.getByRole("button",{name:"Check saved outputs"}).click();await expect.poll(()=>page.getByRole("button",{name:"Open saved view",exact:true}).count()).toBe(0)
  expect(await page.getByText("PRIVATE_SHEET_ROW",{exact:true}).count()).toBe(0);expect(calls.filter(call=>call.method==="write")).toHaveLength(1)
  expect(errors).toEqual([]);await page.close()
 },30000)
})
