import { spawn } from "node:child_process"
import path from "node:path"
import type { AddressInfo } from "node:net"
import { afterAll,beforeAll,describe,expect,it } from "vitest"
import { chromium,type Browser } from "@playwright/test"
import { createServer,type ViteDevServer } from "vite"
import { dataViewCommandSchema,composableDataViewSchema } from "@/features/workspace-data-views"
import { createResearchOutputBindings } from "@/features/workspace-ai/lib/research-data-view"
import { createClosureDatabaseHarness,databaseUrl } from "./organization-closure-database-helpers"
const db=createClosureDatabaseHarness(spawn),id=(n:number)=>`10000000-0000-4000-8000-${String(n).padStart(12,"0")}`
const quote=(value:unknown)=>`'${JSON.stringify(value).replaceAll("'","''")}'::jsonb`
const auth=`set role authenticated;set request.jwt.claim.sub='${id(4)}';`
async function sql(query:string){const reply=await db.query(query);expect(reply.code,reply.stderr).toBe(0);return reply.stdout.trim()}

describe.skipIf(!databaseUrl)("existing-source AI review and real canonical view effects",()=>{
 let server:ViteDevServer,browser:Browser,origin:string,result:unknown
 let loseReply=true
 const calls:{method:string;action:string}[]=[]
 beforeAll(async()=>{
  await sql("select public.fixture_response_data_views()")
  const table={action:"create_view",organizationId:id(1),viewId:id(7101),requestId:id(7102),name:"Partners source",source:{kind:"new_table",columns:[{key:"name",label:"Name",type:"text",options:[],writable:true}],rows:[{name:"PRIVATE_PARTNER"}],provenance:{kind:"new",filename:null,rowCount:1},audienceConfirmed:true}}
  await sql(`${auth}select public.workspace_data_view_command(${quote(table)})`)
  await sql(`set role service_role;select public.workspace_response_view_command('${id(4)}',${quote({...table,viewId:id(7103),requestId:id(7104),name:"Intake source",source:{kind:"responses",versionId:id(80)}})})`)
  const sources=[]
  for(const view of [id(7101),id(7103)])sources.push(composableDataViewSchema.parse(JSON.parse(await sql(`${auth}select public.read_composable_data_view_source('${id(1)}','${view}')`))))
  const items=sources.map((source,i)=>({key:`view${i}`,kind:"data_view" as const,title:source.name,description:"Existing canonical source",dataView:{kind:source.source.kind,sourceViewId:source.viewId},referenceId:null,evidenceIds:[],dependsOn:[]}))
  let next=7200
  result={runId:id(7000),target:{organizationId:id(1),objectiveId:id(7001),revision:0},title:"Review existing sources",summary:"",questions:[],sources:[],decisions:[],items,outputBindings:createResearchOutputBindings(items,()=>id(++next),sources)}
  server=await createServer({configFile:false,root:process.cwd(),cacheDir:"/tmp/ch-s10-existing-views-vite-cache",resolve:{alias:{"@":path.resolve("src")}},esbuild:{jsx:"automatic"},define:{"process.env.NEXT_PUBLIC_WORKSPACE_AI_PRESENTATION":JSON.stringify("1")},server:{host:"127.0.0.1",port:0},plugins:[{name:"disposable-existing-source-bridge",enforce:"pre",transform(code,module){
   if(module.endsWith("/workspace-ai/server/research-data-view-effects.ts"))return code.replace('import "server-only"','')
   if(module.endsWith("/workspace-data-views/server.ts"))return `const send=async(method,command)=>(await fetch('/fixture-source',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({method,command})})).json();export const runDataViewCommand=command=>send('write',command);export const readExistingDataViewCreation=command=>send('receipt',command);export const readProjectDataViewCreation=()=>{throw Error('Unexpected projects source')};`
   if(module.endsWith("/workspace-data-views/server/actions.ts"))return `export async function runDataViewCommand(command){return(await fetch('/fixture-source',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({method:'manual',command})})).json()}`
  },configureServer(instance){instance.middlewares.use(async(request,response,next)=>{
   if(request.url==="/"){response.setHeader("Content-Type","text/html");response.end('<!doctype html><html><body><div id="root"></div><script type="module" src="/tests/acceptance/fixtures/workspace-research-existing-views-browser.tsx"></script></body></html>');return}
   if(request.url==="/fixture-result"){response.setHeader("Content-Type","application/json");response.end(JSON.stringify(result));return}
   if(request.url!=="/fixture-source"||request.method!=="POST")return next()
   let body="";for await(const chunk of request)body+=chunk
   const {method,command}=JSON.parse(body),parsed=dataViewCommandSchema.safeParse(command)
   response.setHeader("Content-Type","application/json")
   if(!parsed.success||!["write","receipt","manual"].includes(method)){response.end(JSON.stringify({ok:false,code:"invalid"}));return}
   calls.push({method,action:parsed.data.action})
   // Fixed synthetic actor and transport; actual production source functions, no app auth substitute.
   let reply=await db.query(`${auth}select public.${method==="receipt"?"read_existing_data_view_creation":"workspace_data_view_command"}(${quote(parsed.data)})`)
   if(reply.code!==0&&method!=="receipt")reply=await db.query(`set role service_role;select public.workspace_response_view_command('${id(4)}',${quote(parsed.data)})`)
   if(reply.code===0&&method==="write"&&loseReply){loseReply=false;response.end(JSON.stringify({ok:false,code:"unavailable",error:"Synthetic response lost after real source commit."}));return}
   response.end(JSON.stringify(reply.code===0?{ok:true,data:JSON.parse(reply.stdout.trim())}:{ok:false,code:"denied",error:"Source unavailable"}))
  })}}]})
  await server.listen();origin=`http://127.0.0.1:${(server.httpServer!.address() as AddressInfo).port}`;browser=await chromium.launch({headless:true})
  // Compile this isolated fixture during setup. Interaction checks retain their
  // bounded timeout; this functional test makes no cold-load performance claim.
  const warm=await browser.newPage();warm.on("pageerror",error=>console.error(error.stack));await warm.goto(origin)
  try{await warm.getByLabel("Item 1 title",{exact:true}).waitFor()}catch(error){console.error(await warm.locator("body").innerText());throw error}
  await warm.close()
 },30000)
 afterAll(async()=>{await browser?.close();await server?.close();for(const child of db.clients)child.kill()})
 it("reviews both metadata-only previews, reconciles lost replies on reload, opens existing records explicitly, and rejects revoked response access",async()=>{
  const page=await browser.newPage({viewport:{width:1100,height:900}});page.setDefaultTimeout(7000)
  const errors:string[]=[];page.on("pageerror",error=>errors.push(error.message));await page.goto(origin)
  const title=page.getByLabel("Item 1 title",{exact:true});await title.fill("Reviewed partners");await page.getByLabel("Item 2 title",{exact:true}).fill("Reviewed intake")
  expect(calls).toEqual([]);expect(await page.locator("body").innerText()).not.toContain("PRIVATE_PARTNER");expect(await page.locator("body").innerText()).not.toContain("Joan")
  await page.getByRole("button",{name:"Apply reviewed output"}).click();await page.getByText("Synthetic response lost after real source commit.").waitFor()
  expect(calls.filter(call=>call.method==="write")).toHaveLength(2);expect(await title.isDisabled()).toBe(true)
  await page.reload();await title.waitFor();expect(await title.inputValue()).toBe("Reviewed partners")
  await page.getByRole("button",{name:"Check saved outputs"}).click();await expect.poll(()=>page.getByRole("button",{name:"Open saved view",exact:true}).count()).toBe(2)
  await page.getByRole("button",{name:"Apply reviewed output"}).click();await page.getByRole("alert").filter({hasText:"Synthetic plan transaction failed"}).waitFor()
  expect(calls.filter(call=>call.method==="write")).toHaveLength(2);expect(calls.some(call=>call.action==="read")).toBe(false)
  await page.getByRole("button",{name:"Open saved view",exact:true}).nth(0).click();await page.getByText("PRIVATE_PARTNER",{exact:true}).waitFor();await page.getByRole("button",{name:"Close saved view"}).click()
  await page.getByRole("button",{name:"Open saved view",exact:true}).nth(1).click();await page.getByText("Joan",{exact:true}).waitFor()
  expect(await sql("select count(*) from public.organization_data_views")).toBe("4");expect(await sql("select count(*) from public.organization_data_rows")).toBe("1");expect(await sql("select count(*) from public.organization_form_responses")).toBe("1")
  await sql(`update public.organization_forms set intake_manager='${id(1)}',manager_revision=manager_revision+1 where id='${id(20)}'`)
  await page.getByRole("button",{name:"Check saved outputs"}).click();await expect.poll(()=>page.getByRole("button",{name:"Open saved view",exact:true}).count()).toBe(1)
  expect(await page.getByText("Joan",{exact:true}).count()).toBe(0)
  expect(calls.filter(call=>call.method==="write")).toHaveLength(2);expect(errors).toEqual([]);await page.close()
 },30000)
})
