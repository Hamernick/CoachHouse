import { spawn } from "node:child_process"
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"
import { createClosureDatabaseHarness, databaseUrl } from "./organization-closure-database-helpers"
import { runSheetDataView } from "@/features/workspace-data-views/server/sheet-source"
import { dataViewPageSchema, type DataViewCommand } from "@/features/workspace-data-views/lib/schema"
const mocks=vi.hoisted(()=>({rpc:vi.fn(),read:vi.fn()}))
vi.mock("@/lib/supabase/admin",()=>({createSupabaseAdminClient:()=>({rpc:(...args:unknown[])=>({abortSignal:()=>mocks.rpc(...args)})})}))
vi.mock("@/features/google-drive",async()=>{const actual=await import("@/features/google-drive/types");return {...actual,readGoogleSheetRange:mocks.read}})
const db=createClosureDatabaseHarness(spawn),id=(n:number)=>`10000000-0000-4000-8000-${String(n).padStart(12,"0")}`
const target={organizationId:id(1),viewId:id(6101)}
const range={spreadsheetId:"isolated-sheet-fixture",sheetId:7,startRow:1,rowCount:101,startColumn:1,columnCount:2}
const create={...target,action:"create_view" as const,requestId:id(6100),name:"Linked source",source:{kind:"sheets" as const,range}}
const read={...target,action:"read" as const,page:0}
const sheet=()=>({title:"Fixture",sheetTitle:"Current",email:"viewer@example.org",revision:"a".repeat(64),rows:[["Name","Value"],...Array.from({length:57},(_,i)=>[`Record ${String(i).padStart(2,"0")}`,String(i)])]})
const quote=(value:unknown)=>`'${JSON.stringify(value).replaceAll("'","''")}'::jsonb`
const query=(command:unknown,actor=1,commit=false,hash="b".repeat(64))=>`set role service_role;select public.workspace_sheet_view_command('${id(actor)}',${quote(command)},${commit},'${hash}')`
async function run(command:DataViewCommand=read,actor=1){return runSheetDataView(id(actor),command)}
async function page(command:DataViewCommand=read,actor=1){const result=await run(command,actor);expect(result,JSON.stringify(result)).toMatchObject({ok:true});return dataViewPageSchema.parse(result?.ok?result.data:null)}
describe.skipIf(!databaseUrl)("linked Sheets saved views through actual local SQL and controlled provider boundary",()=>{
 beforeEach(async()=>{
  const reset=await db.query("select public.fixture_response_data_views()");expect(reset.code,reset.stderr).toBe(0)
  mocks.read.mockReset();mocks.read.mockResolvedValue(sheet())
  mocks.rpc.mockImplementation(async(name:string,args:{p_actor_id:string;p_command:unknown;p_commit:boolean;p_header_hash:string|null})=>{
   expect(name).toBe("workspace_sheet_view_command")
   const result=await db.query(`\\set VERBOSITY verbose\nset role service_role;select public.workspace_sheet_view_command('${args.p_actor_id}',${quote(args.p_command)},${args.p_commit},${args.p_header_hash?`'${args.p_header_hash}'`:"null"})`)
   return result.code===0?{data:result.stdout.trim()?JSON.parse(result.stdout.trim()):null,error:null}:{data:null,error:{code:result.stderr.match(/ERROR:\s+([A-Z0-9]{5}):/)?.[1]??"XX000",message:result.stderr}}
  })
 })
 afterAll(()=>{for(const child of db.clients)child.kill()})
 it("stores only a reference and settings; reads through each viewer and counts/orders/pages the same selected range",async()=>{
  expect(await run()).toBeNull();expect(mocks.read).not.toHaveBeenCalled()
  expect(await run(create)).toMatchObject({ok:true});expect(await run(create)).toMatchObject({ok:true})
  const first=await page(),second=await page({...read,page:1,sourceRevision:"a".repeat(64)})
  expect(first.total).toBe(57);expect(first.rows).toHaveLength(25);expect(new Set([...first.rows,...second.rows].map(row=>row.id)).size).toBe(50)
  expect(first.rows[0].values.column_1).toBe("Record 00");expect(first.columns.every(column=>!column.writable)).toBe(true)
  expect(mocks.read).toHaveBeenCalledWith(id(1),range)
  const readonly=await page(read,13);expect(readonly.canEdit).toBe(false)
  const stored=await db.query("select count(*) from public.organization_data_rows;select command::text from public.organization_data_view_receipts")
  expect(stored.stdout).toContain("0\n");expect(stored.stdout).not.toContain("Record 00");expect(stored.stdout).not.toContain("viewer@example")
 })
 it("requires current workspace and provider access without owner proxy or direct API metadata access",async()=>{
  await run(create);await page(read,4);expect(mocks.read).toHaveBeenLastCalledWith(id(4),range)
  expect(await run(read,2)).toMatchObject({ok:false,code:"denied"})
  const direct=await db.query(`set role authenticated;set request.jwt.claim.sub='${id(1)}';select public.workspace_data_view_command(${quote(read)})`);expect(direct.code).not.toBe(0)
  expect((await db.query(`set role authenticated;select public.workspace_sheet_view_command('${id(1)}',${quote(read)})`)).code).not.toBe(0)
  const {GoogleDriveError}=await import("@/features/google-drive/types");mocks.read.mockRejectedValue(new GoogleDriveError("file_not_authorized",403))
  expect(await run()).toMatchObject({ok:false,code:"denied"})
 })
 it("saves bounded independent view revisions, reconciles retries, and never routes a source-cell write",async()=>{
  await run(create);const current=await page()
  const save={...target,action:"save_view" as const,requestId:id(6102),revision:1,config:{...current.view!.config,filter:{column:"column_1",value:"Record 1"}}}
  expect(await run(save)).toMatchObject({ok:true});expect(await run(save)).toMatchObject({ok:true})
  expect((await page()).total).toBe(10)
  expect(await run({...save,requestId:id(6103)})).toMatchObject({ok:false,code:"conflict"})
  expect((await db.query(`update public.organization_data_views set sheet_source=jsonb_set(sheet_source,'{sheetId}','8') where id='${id(6101)}'`)).code).not.toBe(0)
  expect((await db.query(`update public.organization_data_views set sheet_header_hash=repeat('c',64) where id='${id(6101)}'`)).code).not.toBe(0)
  const cell={...target,action:"edit_cell",requestId:id(6104),rowId:current.rows[0].id,revision:current.rows[0].revision,column:"column_1",value:"unsafe"}
  expect((await db.query(`set role authenticated;set request.jwt.claim.sub='${id(1)}';select public.workspace_data_view_command(${quote(cell)})`)).code).not.toBe(0)
  expect((await db.query(query({...save,requestId:id(6105),extra:"unbounded"},1,true))).code).not.toBe(0)
 })
 it("detects moved/replaced headers and changed pagination snapshots without claiming a provider CAS",async()=>{
  await run(create)
  mocks.read.mockResolvedValue({...sheet(),revision:"c".repeat(64)})
  expect(await run({...read,page:1,sourceRevision:"a".repeat(64)})).toMatchObject({ok:false,code:"conflict"})
  const changed=sheet();changed.rows[0][0]="Different meaning";mocks.read.mockResolvedValue(changed)
  expect(await run()).toMatchObject({ok:false,code:"invalid"})
 })
 it("rechecks authority after provider dispatch, and closure keeps authorized reads but denies settings and privileged writes",async()=>{
  await run(create)
  mocks.read.mockImplementationOnce(async()=>{const result=await db.query("select public.fixture_closure('request',6300,0)");expect(result.code,result.stderr).toBe(0);return sheet()})
  expect(await run()).toMatchObject({ok:false,code:"conflict"})
  const closed=await page();expect(closed.canEdit).toBe(false)
  expect(await run({...target,action:"save_view",requestId:id(6301),revision:1,config:closed.view!.config})).toMatchObject({ok:false,code:"denied"})
  expect((await db.query(`update public.organization_data_views set name='Forbidden' where id='${id(6101)}'`)).code).not.toBe(0)
 })
 it("serializes source-view writes against closure with independent database sessions",async()=>{
  const release=await db.hold(query(create,1,true))
  await db.blocked("select public.fixture_closure('request',6300,0)");await release()
  const closing=await db.hold("select public.fixture_closure('request',6300,0)")
  const rejected=await db.query(query({...create,viewId:id(6102),requestId:id(6103)},1,true));expect(rejected.code).not.toBe(0)
  await closing()
 })
})
