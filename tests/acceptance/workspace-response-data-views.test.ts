import { spawn } from "node:child_process"
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"
import { createClosureDatabaseHarness, databaseUrl } from "./organization-closure-database-helpers"
import { dataViewPageSchema, dataViewCommandSchema } from "@/features/workspace-data-views/lib/schema"
import { runResponseDataView } from "@/features/workspace-data-views/server/response-source"
const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ rpc: mocks.rpc }) }))
const db = createClosureDatabaseHarness(spawn)
const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12,"0")}`
const target = { organizationId: id(1), viewId: id(5101) }
const create = { ...target, action: "create_view" as const, requestId: id(5100), name: "Private response table", source: { kind: "responses" as const, versionId: id(80) } }
const read = { ...target, action: "read" as const, page: 0 }
const quote = (value: unknown) => `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`
const sql = (command: unknown, actor = 4) => `set role service_role; select public.workspace_response_view_command('${id(actor)}',${quote(command)})`
async function execute(command: unknown, actor = 4) {
  const result = await db.query(sql(command,actor)); expect(result.code,result.stderr).toBe(0); return JSON.parse(result.stdout.trim())
}
async function denied(command: unknown, actor = 1) { const result = await db.query(sql(command,actor)); expect(result.code).not.toBe(0) }
describe.skipIf(!databaseUrl)("native response views use the actual source owner", () => {
  beforeEach(async () => {
    const result = await db.query("select public.fixture_response_data_views();"); expect(result.code,result.stderr).toBe(0)
    mocks.rpc.mockImplementation(async (name: string, args: { p_actor_id: string; p_command: unknown }) => {
      if (!["organization_form_intake","workspace_response_view_command"].includes(name)) throw new Error("Unexpected RPC")
      const result = await db.query(`\\set VERBOSITY verbose\nset role service_role; select public.${name}('${args.p_actor_id}',${quote(args.p_command)});`)
      return result.code === 0 ? { data: JSON.parse(result.stdout.trim()), error: null } : { data: null, error: { code: result.stderr.match(/ERROR:\s+([A-Z0-9]{5}):/)?.[1] ?? "XX000", message: result.stderr } }
    })
  })
  afterAll(() => { for (const child of db.clients) child.kill() })
  it("saves and reads a reference-only view, independently of source versions and canonical answers", async () => {
    const result = await execute(create); expect(await execute(create)).toEqual(result)
    const page = dataViewPageSchema.parse(await execute(read))
    expect(page.view?.source).toBe("responses"); expect(page.total).toBe(1)
    expect(page.responseSource?.responses[0].answers[0].value).toBe("Joan")
    expect(page.columns.map(column => column.key)).toEqual(["submitted_at",`q_${id(90).replaceAll("-","")}`])
    const tables = await db.query("select count(*) from public.organization_data_rows")
    expect(tables.stdout.trim()).toBe("0")
    expect(dataViewCommandSchema.safeParse(create).success).toBe(true)
  })
  it("does not give the owner, another organization or ungranted staff response access or metadata", async () => {
    await execute(create)
    await denied(read,1); await denied(read,2); await denied(read,3)
    await denied({...target,action:"edit_response_cell",requestId:id(5198),rowId:id(91),questionId:id(99),revision:1,value:"Wrong question"},4)
    await denied({...target,action:"edit_response_cell",requestId:id(5199),rowId:id(999),questionId:id(90),revision:1,value:"Wrong response"},4)
    await denied({ action: "response_views", versionId: id(80) },1)
    const ordinary = await db.query(`set role authenticated; set request.jwt.claim.sub='${id(1)}'; select public.workspace_data_view_command(${quote(read)})`)
    expect(ordinary.code).not.toBe(0)
    const privateRpc = await db.query(`set role authenticated; select public.workspace_response_view_command('${id(4)}',${quote(read)})`)
    expect(privateRpc.code).not.toBe(0)
    const ordinaryCreate={...create,viewId:id(5501),requestId:id(5500),name:"Ordinary table",source:{kind:"new_table",columns:[{key:"name",label:"Name",type:"text",options:[],writable:true}],rows:[{name:"Workspace record"}],provenance:{kind:"new",filename:null,rowCount:1},audienceConfirmed:true}}
    const ordinaryTable=await db.query(`set role authenticated; set request.jwt.claim.sub='${id(1)}'; select public.workspace_data_view_command(${quote(ordinaryCreate)})`)
    expect(ordinaryTable.code,ordinaryTable.stderr).toBe(0)

  })
  it("keeps filtered counts and pages stable against independently counted canonical response rows", async () => {
    await execute(create)
    const seeded = await db.query(`insert into public.organization_form_responses(version_id,id,original_hash,answers) select '${id(80)}',public.fixture_form_id(n),repeat('b',64),jsonb_build_array(jsonb_build_object('questionId','${id(90)}','value',case when n%2=0 then 'Even' else 'Odd' end)) from generate_series(5200,5256)n`)
    expect(seeded.code,seeded.stderr).toBe(0)
    const first=dataViewPageSchema.parse(await execute(read)), second=dataViewPageSchema.parse(await execute({...read,page:1}))
    expect(first.total).toBe(58); expect(first.rows).toHaveLength(25); expect(new Set([...first.rows,...second.rows].map(row=>row.id)).size).toBe(50)
    const column=`q_${id(90).replaceAll("-","")}`
    await execute({...target,action:"save_view",requestId:id(5102),revision:1,config:{columns:[column],filter:{column,value:"Even"},sort:{column,direction:"asc"}}})
    const filtered=dataViewPageSchema.parse(await execute(read))
    const independent=await db.query(`select count(*) from public.organization_form_responses where answers @> '[{"questionId":"${id(90)}","value":"Even"}]'`)
    expect(filtered.total).toBe(Number(independent.stdout.trim()))
    await denied({...target,action:"save_view",requestId:id(5103),revision:1,config:filtered.view!.config},4)
  })
  it("executes the real canonical correction service with stale-write denial and unchanged retry identity", async () => {
    await execute(create)
    const command={...target,action:"edit_response_cell" as const,requestId:id(5102),rowId:id(91),questionId:id(90),revision:1,value:"Updated canonical answer"}
    const result=await runResponseDataView(id(4),command); expect(result,JSON.stringify(result)).toMatchObject({ok:true})
    expect((await runResponseDataView(id(4),command))?.ok).toBe(true)
    await db.query("select public.fixture_form_command('submit')")
    const canonical=await db.query("select answers->0->>'value' from public.organization_form_responses")
    expect(canonical.stdout.trim()).toBe(command.value)
    const counts=await db.query("select count(*) from public.organization_form_corrections")
    expect(counts.stdout.trim()).toBe("1")
    expect(await runResponseDataView(id(4),{...command,requestId:id(5103),value:"Lost update"})).toMatchObject({ok:false,code:"conflict"})
    expect(await runResponseDataView(id(4),{...command,requestId:id(5104),revision:2,value:""})).toMatchObject({ok:false,code:"invalid"})
    expect(await runResponseDataView(id(1),{...command,requestId:id(5105),revision:2})).toMatchObject({ok:false,code:"denied"})
  })
  it("supports a separately invited corrector without joining the organization, and revokes existing views immediately", async () => {
    await execute(create)
    const invite=await db.query("select public.fixture_response_view_invite('correct')");expect(invite.code,invite.stderr).toBe(0)
    expect(dataViewPageSchema.parse(await execute(read,2)).canEdit).toBe(true)
    expect((await runResponseDataView(id(2),{...target,action:"edit_response_cell",requestId:id(5102),rowId:id(91),questionId:id(90),revision:1,value:"External correction"}))?.ok).toBe(true)
    const member=await db.query(`select count(*) from public.organization_memberships where org_id='${id(1)}' and member_id='${id(2)}'`);expect(member.stdout.trim()).toBe("0")
    const revoke=await db.query("update public.organization_form_viewer_invitations set revoked_at=clock_timestamp()");expect(revoke.code,revoke.stderr).toBe(0)
    await denied(read,2)
    expect((await runResponseDataView(id(2),{...target,action:"edit_response_cell",requestId:id(5103),rowId:id(91),questionId:id(90),revision:2,value:"After revocation"}))?.ok).toBe(false)
  })
  it("lets a read-only invite use the saved view without correcting or changing its settings", async () => {
    await execute(create); await db.query("select public.fixture_response_view_invite('view')")
    const page=dataViewPageSchema.parse(await execute(read,2));expect(page.canEdit).toBe(false)
    await denied({...target,action:"save_view",requestId:id(5102),revision:1,config:page.view!.config},2)
    await denied({...target,action:"edit_response_cell",requestId:id(5103),rowId:id(91),questionId:id(90),revision:1,value:"No"},2)
  })
  it("retains only existing authorized export-window reads during closure and never restores revoked grants on cancel", async () => {
    await execute(create); await db.query("select public.fixture_response_view_invite('correct')")
    const closed=await db.query("select public.fixture_closure('request',5300,0)");expect(closed.code,closed.stderr).toBe(0)
    expect(dataViewPageSchema.parse(await execute(read,4)).canEdit).toBe(false)
    await denied(read,1)
    await denied({...target,action:"edit_response_cell",requestId:id(5102),rowId:id(91),questionId:id(90),revision:1,value:"Closed"},4)
    await db.query("select public.fixture_closure('cancel',5301,1)")
    expect(dataViewPageSchema.parse(await execute(read,4)).canEdit).toBe(true)
    await db.query("update public.organization_form_viewer_invitations set revoked_at=clock_timestamp()")
    await denied(read,2)
  })
  it("serializes canonical authority and closure against view creation in independent sessions", async () => {
    const release=await db.hold(sql(create))
    await db.blocked("select public.fixture_closure('request',5300,0)")
    await release()
    const closing=await db.hold("select public.fixture_closure('request',5300,0)")
    const waiting=await db.queued(sql({...read}))
    await closing()
    const result=await waiting.result;expect(result.code,result.stderr).toBe(0)
    expect(dataViewPageSchema.parse(JSON.parse(result.stdout.trim())).canEdit).toBe(false)
  })
})
