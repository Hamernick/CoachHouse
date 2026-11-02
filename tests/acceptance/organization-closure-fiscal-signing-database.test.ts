import { spawn } from "node:child_process"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { databaseUrl, createClosureDatabaseHarness } from "./organization-closure-database-helpers"

const { clients, query, hold, queued } = createClosureDatabaseHarness(spawn)
const direct = [
  ["packet insert", "insert into public.fiscal_sponsorship_signature_packets(application_id,document_id,org_id,project_id) values(public.fixture_form_id(1601),public.fixture_form_id(1720),public.fixture_form_id(1),public.fixture_form_id(1403))"],
  ["packet update", "update public.fiscal_sponsorship_signature_packets set status='voided' where id=public.fixture_form_id(1701)"],
  ["packet delete", "delete from public.fiscal_sponsorship_signature_packets where id=public.fixture_form_id(1701)"],
  ["packet upsert", "insert into public.fiscal_sponsorship_signature_packets select * from public.fiscal_sponsorship_signature_packets where id=public.fixture_form_id(1701) on conflict(id) do update set status=excluded.status"],
  ["draft insert", "insert into public.fiscal_sponsorship_signing_drafts(packet_id,application_id,org_id,project_id,signer_id,signer_role) values(public.fixture_form_id(1701),public.fixture_form_id(1501),public.fixture_form_id(1),public.fixture_form_id(1401),public.fixture_form_id(1),'coach_house')"],
  ["draft update", "update public.fiscal_sponsorship_signing_drafts set field_values='{\"edited\":true}',revision=revision+1 where id=public.fixture_form_id(1711)"],
  ["draft delete", "delete from public.fiscal_sponsorship_signing_drafts where id=public.fixture_form_id(1711)"],
  ["draft upsert", "insert into public.fiscal_sponsorship_signing_drafts select * from public.fiscal_sponsorship_signing_drafts where id=public.fixture_form_id(1711) on conflict(packet_id,signer_role) do update set revision=excluded.revision+1"],
  ["event insert", "insert into public.fiscal_sponsorship_events(application_id,org_id,project_id,event_type,summary) values(public.fixture_form_id(1501),public.fixture_form_id(1),public.fixture_form_id(1401),'test','Synthetic event')"],
  ["signature insert", "insert into public.fiscal_sponsorship_signatures(packet_id,application_id,org_id,project_id,signer_id,signer_role,signer_name,signer_title,signature_method,signature_value,consent_version,consent_text,consent_sha256,signed_document_sha256,signature_sha256,signed_at) values(public.fixture_form_id(1701),public.fixture_form_id(1501),public.fixture_form_id(1),public.fixture_form_id(1401),public.fixture_form_id(13),'applicant','Synthetic','Director','typed','Synthetic','test','Synthetic consent',repeat('a',64),repeat('a',64),repeat('a',64),now())"],
  ["atomic send", "select public.fixture_fiscal_send()"],
  ["atomic signature", "select public.fixture_fiscal_sign()"],
] as const
const privileged = (sql: string) => `set local role service_role; set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001'; ${sql}`
const effect = (sql: string) => query(`begin; ${privileged(sql)}; commit`)
const signer = (sql: string) => `set local role authenticated; set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000013'; ${sql}`
const stateSql = "select jsonb_build_object('applications',(select jsonb_agg(to_jsonb(a) order by id) from public.fiscal_sponsorship_applications a),'packets',(select jsonb_agg(to_jsonb(p) order by id) from public.fiscal_sponsorship_signature_packets p),'drafts',(select jsonb_agg(to_jsonb(d) order by id) from public.fiscal_sponsorship_signing_drafts d),'signatures',(select jsonb_agg(to_jsonb(s) order by id) from public.fiscal_sponsorship_signatures s),'events',(select jsonb_agg(to_jsonb(e) order by id) from public.fiscal_sponsorship_events e),'documents',(select jsonb_agg(to_jsonb(d) order by id) from public.fiscal_sponsorship_documents d))::text"
const save = direct[5][1]
let baseline: string

// Provision organization-closure-fiscal-signing-fixture.sql; sequential mutations.
describe.skipIf(!databaseUrl)("closure fiscal signing serialization", () => {
  beforeEach(async () => {
    const reset = await query("begin; set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001'; select public.fixture_closure_fiscal_signing(); commit")
    expect(reset.code, reset.stderr).toBe(0)
    const state = await query(stateSql)
    expect(state.code, state.stderr).toBe(0)
    baseline = state.stdout.trim()
  })
  afterEach(() => { for (const child of clients) child.kill("SIGTERM") })

  it.each(direct)("finishes admitted %s before closure", async (_name, sql) => {
    const release = await hold(privileged(sql))
    const closing = await queued("select public.fixture_closure('request',600,0)->>'state'")
    await release()
    const result = await closing.result
    expect(result.code, result.stderr).toBe(0)
    expect(result.stdout.trim()).toBe("closing")
  })
  it.each(direct)("denies busy and committed closure for %s atomically", async (_name, sql) => {
    const release = await hold("select public.fixture_closure('request',600,0)")
    const busy = await effect(sql)
    expect(busy.code).not.toBe(0)
    expect(busy.stderr).toContain("Organization is changing; retry document edit")
    await release()
    const closed = await effect(sql)
    expect(closed.code).not.toBe(0)
    expect(closed.stderr).toContain("Organization unavailable")
    expect((await query(stateSql)).stdout.trim()).toBe(baseline)
  })
  it.each([direct[1], direct[2], direct[5], direct[6]])("rechecks queued %s after a document tuple wait", async (name, sql) => {
    const table = name.startsWith("packet") ? "fiscal_sponsorship_signature_packets" : "fiscal_sponsorship_signing_drafts"
    const release = await hold(`select 1 from public.${table} where org_id=public.fixture_form_id(1) for update`)
    const writing = await queued(`begin; ${privileged(sql)}; commit`)
    expect((await query("select public.fixture_closure('request',600,0)")).code).toBe(0)
    await release()
    const result = await writing.result
    expect(result.code).not.toBe(0)
    expect(result.stderr).toContain("Organization unavailable")
    expect((await query(stateSql)).stdout.trim()).toBe(baseline)
  })
  it("preserves authenticated signer revision checks", async () => {
    const sql = "update public.fiscal_sponsorship_signing_drafts set revision=revision+1 where id=public.fixture_form_id(1711) and revision=0 returning revision"
    const results = await Promise.all([query(`begin; ${signer(sql)}; commit`), query(`begin; ${signer(sql)}; commit`)])
    expect(results.every(result => result.code === 0)).toBe(true)
    expect(results.filter(result => result.stdout.trim() === "1")).toHaveLength(1)
    expect((await query("select revision from public.fiscal_sponsorship_signing_drafts where id=public.fixture_form_id(1711)")).stdout.trim()).toBe("1")
  })
  it("finishes an admitted countersignature before closure", async () => {
    expect((await effect("select public.fixture_fiscal_sign()")).code).toBe(0)
    const release = await hold(privileged("select public.fixture_fiscal_countersign()"))
    const closing = await queued("select public.fixture_closure('request',600,0)")
    await release()
    expect((await closing.result).code).toBe(0)
    expect((await query("select status from public.fiscal_sponsorship_signature_packets where id=public.fixture_form_id(1701); select count(*) from public.fiscal_sponsorship_signatures")).stdout.trim()).toBe("completed\n2")
  })
  it("rolls back countersigning during and after closure", async () => {
    const signed = await effect("select public.fixture_fiscal_sign()")
    expect(signed.code, signed.stderr).toBe(0)
    const signedState = (await query(stateSql)).stdout.trim()
    const release = await hold("select public.fixture_closure('request',600,0)")
    expect((await effect("select public.fixture_fiscal_countersign()")).stderr).toContain("Organization is changing; retry document edit")
    await release()
    expect((await effect("select public.fixture_fiscal_countersign()")).stderr).toContain("Organization unavailable")
    expect((await query(stateSql)).stdout.trim()).toBe(signedState)
  })
  it("rechecks signature completion after waiting for the packet", async () => {
    const release = await hold("select 1 from public.fiscal_sponsorship_signature_packets where id=public.fixture_form_id(1701) for update")
    const signing = await queued(`begin; ${privileged("select public.fixture_fiscal_sign()")}; commit`)
    expect((await query("select public.fixture_closure('request',600,0)")).code).toBe(0)
    await release()
    const result = await signing.result
    expect(result.code).not.toBe(0)
    expect(result.stderr).toContain("Organization unavailable")
    expect((await query(stateSql)).stdout.trim()).toBe(baseline)
  })
  it("fences authenticated signer saves before and after closure", async () => {
    const release = await hold(signer(save))
    const closing = await queued("select public.fixture_closure('request',600,0)")
    await release()
    expect((await closing.result).code).toBe(0)
    const rejected = await query(`begin; ${signer(save)}; commit`)
    expect(rejected.code).not.toBe(0)
    expect(rejected.stderr).toContain("Organization unavailable")
  })
  it("preserves profile attribution cleanup during closure", async () => {
    const release = await hold("select public.fixture_closure('request',600,0)")
    // Actual external-document activity FK may wait; account cleanup must finish.
    const cleanup = await queued("delete from auth.users where id=public.fixture_form_id(13)")
    await release()
    const result = await cleanup.result
    expect(result.code, result.stderr).toBe(0)
    expect((await query("select count(*) from public.fiscal_sponsorship_signature_packets where sent_by is null and applicant_signer_id is null and coach_signer_id is null and status='sent'; select count(*) from public.fiscal_sponsorship_signing_drafts; select count(*) from public.organizations where user_id in(public.fixture_form_id(1),public.fixture_form_id(2))")).stdout.trim()).toBe("2\n0\n2")
  })
  it("preserves other organization writes and rolls back mixed batches", async () => {
    const release = await hold("select public.fixture_closure('request',600,0)")
    const other = "update public.fiscal_sponsorship_signature_packets set status='voided' where org_id=public.fixture_form_id(2)"
    expect((await effect(other)).code).toBe(0)
    await release()
    const result = await effect(`update public.fiscal_sponsorship_signature_packets set status='error' where org_id=public.fixture_form_id(2); ${direct[1][1]}`)
    expect(result.code).not.toBe(0)
    expect(result.stderr).toContain("Organization unavailable")
    expect((await query("select status from public.fiscal_sponsorship_signature_packets order by org_id")).stdout.trim()).toBe("sent\nvoided")
  })
  it("permits explicit retry after cancel without restoring publication", async () => {
    expect((await query("select public.fixture_closure('request',600,0)")).code).toBe(0)
    const release = await hold("select public.fixture_closure('cancel',601,1)")
    expect((await effect(save)).stderr).toContain("Organization is changing; retry document edit")
    await release()
    const retried = await effect(save)
    expect(retried.code, retried.stderr).toBe(0)
    expect((await query("select revision from public.fiscal_sponsorship_signing_drafts where id=public.fixture_form_id(1711)")).stdout.trim()).toBe("1")
    expect((await query("select visibility from public.organization_workspace_pages where id=public.fixture_form_id(10)")).stdout.trim()).toBe("private")
  })
  it.each(["repeatable read", "serializable"])("rejects %s admission", async isolation => {
    const result = await query(`begin isolation level ${isolation}; ${privileged(direct[1][1])}; commit`)
    expect(result.code).not.toBe(0)
    expect(result.stderr).toContain("Closure boundary requires read committed isolation")
  })
})
