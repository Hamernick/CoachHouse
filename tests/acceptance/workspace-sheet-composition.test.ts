import { spawn } from "node:child_process"
import { createHash } from "node:crypto"
import { afterAll,beforeEach,describe,expect,it,vi } from "vitest"
import { createClosureDatabaseHarness,databaseUrl } from "./organization-closure-database-helpers"
const mocks=vi.hoisted(()=>({actor:"",rpc:vi.fn(),read:vi.fn()}))
vi.mock("@/lib/supabase/server",()=>({createSupabaseServerClient:async()=>({auth:{getUser:async()=>({data:{user:{id:mocks.actor}},error:null})},rpc:(...args:unknown[])=>({abortSignal:()=>mocks.rpc("authenticated",...args)})})}))
vi.mock("@/lib/supabase/admin",()=>({createSupabaseAdminClient:()=>({rpc:(...args:unknown[])=>({abortSignal:()=>mocks.rpc("service_role",...args)})})}))
vi.mock("@/features/google-drive",async()=>({...await import("@/features/google-drive/types"),readGoogleSheetRange:mocks.read}))
import { runSheetDataView } from "@/features/workspace-data-views/server/sheet-source"
import { readComposableDataViewSource,readExistingDataViewCreation } from "@/features/workspace-data-views/server/existing-source"
import { createLinkedSheetView } from "@/features/workspace-data-views/server/sheet-composition"
import { applyResearchDataViewEffects,inspectResearchDataViewEffects } from "@/features/workspace-ai/server/research-data-view-effects"
import { createResearchOutputBindings,researchOutputBindingsSchema,researchDataViewSchema } from "@/features/workspace-ai/lib/research-data-view"
import { researchPrompt } from "@/features/workspace-ai/server/research-prompt"
import { assertResearchDataViewSources,researchDataViewFingerprint,withResearchDataViewSources } from "@/features/workspace-ai/server/research-data-view-sources"
import type { ResearchContext } from "@/features/workspace-ai/server/research-context"
import type { ResearchResult } from "@/features/workspace-ai/research-types"
import type { ComposableDataView } from "@/features/workspace-data-views"
import { graph,particle } from "./fixtures/particle-fixtures"
const db=createClosureDatabaseHarness(spawn),id=(n:number)=>`10000000-0000-4000-8000-${String(n).padStart(12,"0")}`
const quote=(value:unknown)=>value==null?"null":`'${JSON.stringify(value).replaceAll("'","''")}'::jsonb`
const range={spreadsheetId:"isolated-sheet-fixture",sheetId:7,startRow:1,rowCount:101,startColumn:1,columnCount:2}
const source={action:"create_view" as const,organizationId:id(1),viewId:id(6101),requestId:id(6100),name:"Linked source",source:{kind:"sheets" as const,range}}
const command={...source,viewId:id(6201),requestId:id(6200),name:"Reviewed linked view"}
const connection=(actor:string)=>id(8000+Number(actor.slice(-12)))
const identity=(actor:string)=>createHash("sha256").update(`google-sheet-viewer:${connection(actor)}:subject-${actor}:${new Date("2026-11-02T00:00:00Z").getTime()}`).digest("hex")
const sheet=(actor=mocks.actor)=>({title:"Private file title",sheetTitle:"Private tab",email:"viewer@example.org",executionIdentity:identity(actor),revision:"a".repeat(64),rows:[["Name","Value"],["PRIVATE_PROVIDER_CELL","42"]]})
async function sql(query:string){const reply=await db.query(query);expect(reply.code,reply.stderr).toBe(0);return reply.stdout.trim()}
async function binding(){const reply=await readComposableDataViewSource(id(1),source.viewId);expect(reply).toMatchObject({ok:true});return (reply as {ok:true;data:ComposableDataView}).data}
const metadataSQL=(expected:unknown=null,create:unknown=null,commit=false)=>`set role service_role;select public.workspace_sheet_view_composition('${mocks.actor}','${id(1)}','${source.viewId}',${quote(expected)},${quote(create)},${commit})`
function context():ResearchContext {const value=graph();const activity=particle(81,"activity");if(activity.type!=="activity")throw Error("Fixture activity required");value.particles=[particle(1,"objective"),{...activity,data:{...activity.data,widget:{kind:"data_view",viewId:source.viewId}}}];return {user:{id:mocks.actor},graph:value,objective:value.particles[0],target:{organizationId:id(1),objectiveId:id(1),revision:0},canvasId:null} as ResearchContext}
function research(bound:ComposableDataView):ResearchResult {const items=[{key:"sheet",kind:"data_view" as const,title:"Reviewed linked view",description:"Read-only source",dataView:{kind:"sheets" as const,sourceViewId:bound.viewId},evidenceIds:[],dependsOn:[],referenceId:null}];let next=6200;return {runId:id(7000),target:context().target,title:"Linked plan",summary:"",questions:[],sources:[],items,outputBindings:createResearchOutputBindings(items,()=>id(++next),[bound])}}
describe.skipIf(!databaseUrl)("read-only linked Sheet composition through actual canonical SQL and controlled provider reads",()=>{
 beforeEach(async()=>{
  vi.clearAllMocks();vi.unstubAllEnvs();vi.stubEnv("WORKSPACE_AI_DATA_VIEW_OUTPUTS","1");vi.stubEnv("NEXT_PUBLIC_WORKSPACE_AI_PRESENTATION","1");mocks.actor=id(1)
  await sql("select public.fixture_response_data_views();truncate public.google_drive_connections cascade;")
  for(const actor of [1,4,13])await sql(`insert into public.google_drive_connections(id,user_id,google_subject,google_email,refresh_token_ciphertext,refresh_token_iv,refresh_token_auth_tag,key_version,connected_at) values('${connection(id(actor))}','${id(actor)}','subject-${id(actor)}','synthetic@example.org','cipher','iv','tag','v1','2026-11-02T00:00:00Z')`)
  mocks.read.mockImplementation(async(actor:string)=>sheet(actor))
  mocks.rpc.mockImplementation(async(role:string,name:string,args:Record<string,unknown>)=>{
   let call:string
   if(name==="workspace_sheet_view_composition")call=`public.${name}('${args.p_actor_id}','${args.p_org}','${args.p_source_view}',${quote(args.p_expected)},${quote(args.p_command)},${args.p_commit})`
   else if(name==="workspace_sheet_view_command")call=`public.${name}('${args.p_actor_id}',${quote(args.p_command)},${args.p_commit},${args.p_header_hash?`'${args.p_header_hash}'`:"null"})`
   else if(name==="read_composable_data_view_source")call=`public.${name}('${args.p_org}','${args.p_view}')`
   else throw Error(`Unexpected RPC ${name}`)
   const reply=await db.query(`\\set VERBOSITY verbose\nset role ${role};set request.jwt.claim.sub='${mocks.actor}';select ${call}`)
   return reply.code===0?{data:reply.stdout.trim()?JSON.parse(reply.stdout.trim()):null,error:null}:{data:null,error:{code:reply.stderr.match(/ERROR:\s+([A-Z0-9]{5}):/)?.[1]??"XX000",message:reply.stderr}}
  })
  expect(await runSheetDataView(mocks.actor,source)).toMatchObject({ok:true})
 })
 afterAll(()=>{vi.unstubAllEnvs();for(const child of db.clients)child.kill()})
 it("lists only selected authorized handles and keeps provider cells/identity/ranges out of the model",async()=>{
  const loaded=await withResearchDataViewSources(context()),bound=loaded.dataViewSources![0]
  expect(bound.source).toEqual(source.source);expect(bound.sheet?.executionIdentity).toBe(identity(mocks.actor))
  await sql(`update public.google_drive_connections set refresh_token_ciphertext='rotated-cipher' where user_id='${mocks.actor}'`)
  expect(await binding()).toEqual(bound)
  const prompt=JSON.parse(researchPrompt(loaded,{prompt:"Organize this source",skill:"planning",target:loaded.target}))
  expect(prompt.outputs.availableSavedViews).toEqual([{kind:"sheets",sourceViewId:source.viewId,title:"Linked source",name:"Linked source"}])
  for(const hidden of ["PRIVATE_PROVIDER_CELL","Private file title","spreadsheetId","executionIdentity","headerHash","viewer@example.org"])expect(JSON.stringify(prompt)).not.toContain(hidden)
  expect(researchDataViewSchema.safeParse({kind:"sheets",sourceViewId:source.viewId,range}).success).toBe(false)
  const value=research(bound);delete value.outputBindings![0].existingSource!.sheet
  expect(researchOutputBindingsSchema.safeParse(value.outputBindings).success).toBe(false)
 })
 it("creates only another reference through the existing writer and recovers a lost response without another source effect",async()=>{
  const bound=await binding(),value=research(bound),original=mocks.rpc.getMockImplementation()!
  let lost=false
  mocks.rpc.mockImplementation(async(...args:unknown[])=>{const reply=await original(...args);if(args[1]==="workspace_sheet_view_composition"&&(args[2] as {p_commit:boolean}).p_commit&&!lost){lost=true;return {data:null,error:{code:"08006"}}}return reply})
  expect((await applyResearchDataViewEffects(value))[0].status).toBe("uncertain")
  expect((await inspectResearchDataViewEffects(value))[0].status).toBe("created")
  expect((await applyResearchDataViewEffects(value))[0].status).toBe("created")
  expect(mocks.rpc.mock.calls.filter(call=>call[1]==="workspace_sheet_view_composition"&&call[2].p_commit)).toHaveLength(1)
  expect(await sql("select count(*) from public.organization_data_views")).toBe("2")
  expect(await sql("select count(*) from public.organization_data_rows")).toBe("0")
  expect(await sql("select command::text from public.organization_data_view_receipts")).not.toContain("PRIVATE_PROVIDER_CELL")
  const opened=await runSheetDataView(mocks.actor,{action:"read",organizationId:id(1),viewId:value.outputBindings![0].viewId,page:0})
  expect(opened).toMatchObject({ok:true,data:{rows:[{values:{column_1:"PRIVATE_PROVIDER_CELL"}}]}})
 })
 it("never creates on recovery, matches the exact command/actor, and never recreates a removed target",async()=>{
  const bound=await binding();expect(await readExistingDataViewCreation(command,bound)).toEqual({ok:true,data:{receipt:null,view:null}})
  expect(await createLinkedSheetView({...command,source:{kind:"sheets",range:{...range,sheetId:8}}},bound)).toMatchObject({ok:false,code:"invalid"})
  expect(await createLinkedSheetView(command,bound)).toMatchObject({ok:true})
  expect(await readExistingDataViewCreation({...command,name:"Changed"},bound)).toMatchObject({ok:false,code:"conflict"})
  mocks.actor=id(4);const other=await binding();expect(await readExistingDataViewCreation(command,other)).toMatchObject({ok:false,code:"denied"});mocks.actor=id(1)
  await sql(`delete from public.organization_data_views where id='${command.viewId}'`)
  expect(await readExistingDataViewCreation(command,bound)).toMatchObject({ok:true,data:{receipt:{viewId:command.viewId},view:null}})
  expect(await sql("select count(*) from public.organization_data_views")).toBe("1")
  expect(await createLinkedSheetView(command,bound)).toMatchObject({ok:false,code:"denied"})
  expect(await runSheetDataView(mocks.actor,{...command,requestId:id(6901)})).toMatchObject({ok:true})
  expect(await readExistingDataViewCreation(command,bound)).toMatchObject({ok:true,data:{receipt:{viewId:command.viewId},view:null}})
  expect(await createLinkedSheetView(command,bound)).toMatchObject({ok:false,code:"denied"})
  expect(await sql("select count(*) from public.organization_data_views")).toBe("2")
 })
 it("uses the current viewer only, withholds revoked/temporary provider results, and permits a safe same-request retry",async()=>{
  const bound=await binding();mocks.actor=id(4);const staff=await binding();expect(mocks.read).toHaveBeenLastCalledWith(id(4),range)
  expect(await createLinkedSheetView(command,bound)).toMatchObject({ok:false,code:"conflict"})
  const {GoogleDriveError}=await import("@/features/google-drive/types")
  mocks.read.mockRejectedValueOnce(new GoogleDriveError("provider_unavailable",503));expect(await createLinkedSheetView(command,staff)).toMatchObject({ok:false,code:"unavailable"})
  expect(await sql("select count(*) from public.organization_data_views")).toBe("1")
  expect(await createLinkedSheetView(command,staff)).toMatchObject({ok:true})
  mocks.read.mockRejectedValueOnce(new GoogleDriveError("file_not_authorized",403));expect(await readExistingDataViewCreation(command,staff)).toMatchObject({ok:false,code:"denied"})
  mocks.actor=id(13);mocks.read.mockClear();expect(await readComposableDataViewSource(id(1),source.viewId)).toMatchObject({ok:false,code:"denied"});expect(mocks.read).not.toHaveBeenCalled()
 })
 it.each(["connection","source incarnation","source revision","header"])("invalidates saved binding after changed %s",async changed=>{
  const bound=await binding(),current=context(),dependencies=[{viewId:bound.viewId,fingerprint:researchDataViewFingerprint(bound)}]
  if(changed==="connection")await sql(`update public.google_drive_connections set connected_at=connected_at+interval '1 hour' where user_id='${mocks.actor}'`)
  if(changed==="source incarnation"){await sql(`delete from public.organization_data_views where id='${source.viewId}'`);await runSheetDataView(mocks.actor,{...source,requestId:id(6900)})}
  if(changed==="source revision")await sql(`update public.organization_data_views set name='Changed',revision=revision+1,updated_at=clock_timestamp() where id='${source.viewId}'`)
  if(changed==="header"){const changedSheet=sheet();changedSheet.rows[0][0]="Different meaning";mocks.read.mockResolvedValue(changedSheet)}
  await expect(assertResearchDataViewSources(current,dependencies)).rejects.toBeDefined()
  expect(await createLinkedSheetView(command,bound)).toMatchObject({ok:false})
  expect(await sql(`select count(*) from public.organization_data_views where id='${command.viewId}'`)).toBe("0")
 })
 it("rechecks identity and source after provider dispatch before a canonical write",async()=>{
  const bound=await binding();mocks.read.mockImplementationOnce(async()=>{await sql(`update public.google_drive_connections set connected_at=connected_at+interval '1 hour' where user_id='${mocks.actor}'`);return sheet()})
  expect(await createLinkedSheetView(command,bound)).toMatchObject({ok:false,code:"conflict"})
  expect(await sql("select count(*) from public.organization_data_views")).toBe("1")
 })
 it("locks the current source and connection against concurrent removal, reconnect and organization closure",async()=>{
  const release=await db.hold(metadataSQL())
  await db.blocked(`delete from public.organization_data_views where id='${source.viewId}'`)
  await db.blocked(`update public.google_drive_connections set connected_at=clock_timestamp() where user_id='${mocks.actor}'`)
  await db.blocked("select public.fixture_closure('request',6300,0)");await release()
 })
 it("preserves fixed-window read recovery during closure and rejects mutations, expired reads and direct API callers",async()=>{
  const bound=await binding();expect(await createLinkedSheetView(command,bound)).toMatchObject({ok:true})
  await sql("select public.fixture_closure('request',6300,0)")
  expect(await readExistingDataViewCreation(command,bound)).toMatchObject({ok:true,data:{receipt:{viewId:command.viewId}}})
  expect(await createLinkedSheetView({...command,viewId:id(6301),requestId:id(6302)},bound)).toMatchObject({ok:false,code:"denied"})
  await sql("update public.organization_closures set requested_at='2000-01-01Z',export_until='2000-01-31Z'")
  expect(await readExistingDataViewCreation(command,bound)).toMatchObject({ok:false,code:"denied"})
  for(const role of ["authenticated","anon"]){const reply=await db.query(`set role ${role};select public.workspace_sheet_view_composition('${mocks.actor}','${id(1)}','${source.viewId}')`);expect(reply.code).not.toBe(0);expect(reply.stderr).toContain("permission denied")}
 })
})
