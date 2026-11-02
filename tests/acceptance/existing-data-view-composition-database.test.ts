import { spawn } from "node:child_process"
import { afterAll,beforeEach,describe,expect,it } from "vitest"
import { createClosureDatabaseHarness,databaseUrl } from "./organization-closure-database-helpers"
const db=createClosureDatabaseHarness(spawn),id=(n:number)=>`10000000-0000-4000-8000-${String(n).padStart(12,"0")}`
const quote=(value:unknown)=>`'${JSON.stringify(value).replaceAll("'","''")}'::jsonb`
const auth=(actor=4)=>`set role authenticated;set request.jwt.claim.sub='${id(actor)}';`
const source={action:"create_view",organizationId:id(1),viewId:id(6101),requestId:id(6100),name:"Native source",source:{kind:"responses",versionId:id(80)}}
async function sql(text:string){const r=await db.query(text);expect(r.code,r.stderr).toBe(0);return r.stdout.trim()}
async function denied(text:string,reason?:string){const r=await db.query(text);expect(r.code).not.toBe(0);if(reason)expect(r.stderr).toContain(reason)}
const metadata=(view=id(6101),actor=4)=>`${auth(actor)}select public.read_composable_data_view_source('${id(1)}','${view}');`
const receipt=(command:unknown=source,actor=4)=>`${auth(actor)}select public.read_existing_data_view_creation(${quote(command)});`
const create=(command:unknown=source,actor=4)=>`set role service_role;select public.workspace_response_view_command('${id(actor)}',${quote(command)});`
describe.skipIf(!databaseUrl)("existing view composition metadata and exact canonical receipts",()=>{
 beforeEach(async()=>{await sql("select public.fixture_response_data_views();")})
 afterAll(()=>{for(const child of db.clients)child.kill()})
 it("returns only immutable source identity/title after canonical response permission, no answers or definition",async()=>{
  await sql(create());const value=JSON.parse(await sql(metadata()))
  expect(Object.keys(value).sort()).toEqual(["canCreate","name","source","sourceTitle","updatedAt","viewId"])
  expect(value).toMatchObject({viewId:source.viewId,source:source.source,canCreate:true});expect(JSON.stringify(value)).not.toContain("Joan");expect(JSON.stringify(value)).not.toContain("questions")
  await denied(metadata(source.viewId,1),"Form access required")
  await denied(`${auth()}select public.read_composable_data_view_source('${id(2)}','${source.viewId}')`,"Source unavailable")
 })
 it.each(["view","correct"])("matches manual creation for invited %s permission",async permission=>{
  await sql(create());await sql(`select public.fixture_response_view_invite('${permission}')`)
  const next={...source,viewId:id(6103),requestId:id(6102)}
  if(permission==="view"){await denied(metadata(source.viewId,2),"Source unavailable");await denied(create(next,2));await denied(receipt(next,2))}
  else {expect(JSON.parse(await sql(metadata(source.viewId,2))).canCreate).toBe(true);await sql(create(next,2));expect(JSON.parse(await sql(receipt(next,2))).receipt.viewId).toBe(next.viewId)}
 })
 it("never creates on receipt read, binds full command and actor, and preserves tombstoned creation",async()=>{
  expect(JSON.parse(await sql(receipt()))).toEqual({receipt:null,view:null});await sql(create())
  expect(JSON.parse(await sql(receipt())).receipt).toEqual({viewId:source.viewId,revision:1})
  await denied(receipt({...source,name:"Changed"}),"Creation request changed")
  await sql("select public.fixture_response_view_invite('correct')");await denied(receipt(source,2),"Creation receipt unavailable")
  const before=await sql("select count(*) from public.organization_data_view_receipts")
  await sql(`delete from public.organization_data_views where id='${source.viewId}'`)
  expect(JSON.parse(await sql(receipt())).view).toBeNull();expect(await sql("select count(*) from public.organization_data_view_receipts")).toBe(before)
  await denied(metadata(),"Source unavailable")
 })
 it("serializes invited-source revocation and denies both metadata and receipt after revocation",async()=>{
  await sql(create());await sql("select public.fixture_response_view_invite('correct')")
  const command={...source,viewId:id(6103),requestId:id(6102)};await sql(create(command,2))
  const revision=Number(await sql(`select access_revision from public.organization_forms where id='${id(20)}'`))
  const revoke=`set role service_role;select public.organization_form_viewer_access('${id(4)}',${quote({action:"revoke_viewer",versionId:id(80),invitationId:id(5000),operationId:id(6200),expectedRevision:revision})})`
  const release=await db.hold(metadata(source.viewId,2));await db.blocked(revoke);await release();await sql(revoke)
  await denied(metadata(source.viewId,2));await denied(receipt(command,2));await denied(create({...command,viewId:id(6201),requestId:id(6202)},2))
 })
 it("distinguishes a restored source-view incarnation without recreating it from a receipt",async()=>{
  await sql(create());const before=JSON.parse(await sql(metadata()))
  await sql(`delete from public.organization_data_views where id='${source.viewId}'`);await denied(metadata())
  await sql(create({...source,requestId:id(6300)}));const after=JSON.parse(await sql(metadata()))
  expect(after.source).toEqual(before.source);expect(after.updatedAt).not.toBe(before.updatedAt)
 })
 it("uses table workspace rights, preserves shared rows and rechecks removed membership",async()=>{
  const table={...source,source:{kind:"new_table",columns:[{key:"name",label:"Name",type:"text",options:[],writable:true}],rows:[{name:"PRIVATE_ROW"}],provenance:{kind:"new",filename:null,rowCount:1},audienceConfirmed:true}}
  await sql(`${auth(1)}select public.workspace_data_view_command(${quote(table)})`)
  const value=JSON.parse(await sql(metadata(source.viewId,1)));expect(JSON.stringify(value)).not.toContain("PRIVATE_ROW")
  const view={...source,viewId:id(6103),requestId:id(6102),source:value.source}
  await sql(`${auth(1)}select public.workspace_data_view_command(${quote(view)})`)
  expect(JSON.parse(await sql(receipt(view,1))).receipt.viewId).toBe(view.viewId)
  expect(await sql("select count(*) from public.organization_data_rows")).toBe("1")
  await sql(`insert into public.organization_memberships(org_id,member_id,role) values('${id(1)}','${id(18)}','staff')`)
  await sql(metadata(source.viewId,18));await sql(`delete from public.organization_memberships where org_id='${id(1)}' and member_id='${id(18)}'`);await denied(metadata(source.viewId,18),"Source unavailable")
 })
 it("serializes permission revocation and closure, allows only fixed-window read recovery",async()=>{
  await sql(create());const release=await db.hold(metadata())
  await db.blocked("select public.fixture_closure('request',3000,0)");await release()
  await sql("select public.fixture_closure('request',3000,0)")
  expect(JSON.parse(await sql(metadata())).canCreate).toBe(false);expect(JSON.parse(await sql(receipt())).receipt.viewId).toBe(source.viewId)
  await denied(create({...source,viewId:id(6104),requestId:id(6105)}))
  await sql("update public.organization_closures set requested_at='2000-01-01Z',export_until='2000-01-31Z'")
  await denied(metadata(),"Organization unavailable");await denied(receipt(),"Organization unavailable")
 })
 it("keeps API entrypoints authenticated and helpers private",async()=>{
  await denied(`set role anon;select public.read_existing_data_view_creation(${quote(source)})`,"permission denied")
  await denied(`set role service_role;select public.read_composable_data_view_source('${id(1)}','${source.viewId}')`,"permission denied")
  await denied(`${auth()}select public.require_composable_data_view_source('${id(1)}',${quote(source.source)})`,"permission denied")
 })
})
