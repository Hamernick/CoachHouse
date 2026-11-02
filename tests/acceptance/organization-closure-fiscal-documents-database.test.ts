import { spawn } from "node:child_process"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { databaseUrl, createClosureDatabaseHarness } from "./organization-closure-database-helpers"

const { clients, query, hold, queued } = createClosureDatabaseHarness(spawn)
const direct = [
  ["insert", "insert into public.fiscal_sponsorship_documents(org_id,project_id,application_id,kind,title,version) values(public.fixture_form_id(1),public.fixture_form_id(1401),public.fixture_form_id(1501),'application','New',2)"],
  ["update", "update public.fiscal_sponsorship_documents set title='Changed' where org_id=public.fixture_form_id(1)"],
  ["delete", "delete from public.fiscal_sponsorship_documents where org_id=public.fixture_form_id(1)"],
  ["upsert", "insert into public.fiscal_sponsorship_documents select * from public.fiscal_sponsorship_documents where org_id=public.fixture_form_id(1) on conflict(application_id,kind,version) do update set title=excluded.title"],
] as const
const privileged = (sql: string) => `set local role service_role; set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001'; ${sql}`
const effect = (sql: string) => query(`begin; ${privileged(sql)}; commit`)
const stateSql = "select jsonb_build_object('events',(select jsonb_agg(to_jsonb(p) order by id) from public.fiscal_sponsorship_events p),'documents',(select jsonb_agg(to_jsonb(d) order by id) from public.fiscal_sponsorship_documents d))::text"
const save = "select public.fixture_fiscal_review()->>'ok'"
let baseline: string

// Provision organization-closure-fiscal-documents-fixture.sql; sequential mutations.
describe.skipIf(!databaseUrl)("closure fiscal document serialization", () => {
  beforeEach(async () => {
    const reset = await query("begin; set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001'; select public.fixture_closure_fiscal_documents(); commit")
    expect(reset.code, reset.stderr).toBe(0)
    const state = await query(stateSql)
    expect(state.code, state.stderr).toBe(0)
    baseline = state.stdout.trim()
  })
  afterEach(() => { for (const child of clients) child.kill("SIGTERM") })

  it.each([...direct, ["atomic review", save], ["atomic connection", "select public.fixture_fiscal_connect()"]] as const)("finishes admitted %s before closure", async (_name, sql) => {
    const release = await hold(privileged(sql))
    const closing = await queued("select public.fixture_closure('request',600,0)->>'state'")
    await release()
    const result = await closing.result
    expect(result.code, result.stderr).toBe(0)
    expect(result.stdout.trim()).toBe("closing")
  })
  it.each([...direct, ["atomic review", save], ["atomic connection", "select public.fixture_fiscal_connect()"]] as const)("denies busy and committed closure for %s atomically", async (_name, sql) => {
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
  it.each(direct.slice(1, 3))("rechecks queued %s after a document tuple wait", async (_name, sql) => {
    const release = await hold("select 1 from public.fiscal_sponsorship_documents where org_id=public.fixture_form_id(1) for update")
    const writing = await queued(`begin; ${privileged(sql)}; commit`)
    expect((await query("select public.fixture_closure('request',600,0)")).code).toBe(0)
    await release()
    const result = await writing.result
    expect(result.code).not.toBe(0)
    expect(result.stderr).toContain("Organization unavailable")
    expect((await query(stateSql)).stdout.trim()).toBe(baseline)
  })
  it("rolls back an atomic review after waiting for its application", async () => {
    const release = await hold("select 1 from public.fiscal_sponsorship_applications where id=public.fixture_form_id(1501) for update")
    const writing = await queued(`begin; ${privileged(save)}; commit`)
    expect((await query("select public.fixture_closure('request',600,0)")).code).toBe(0)
    await release()
    const result = await writing.result
    expect(result.code).not.toBe(0)
    expect(result.stderr).toContain("Organization unavailable")
    expect((await query(stateSql)).stdout.trim()).toBe(baseline)
  })
  it("keeps one winner for concurrent same-revision document reviews", async () => {
    const revision = (await query("select updated_at from public.fiscal_sponsorship_documents where id=public.fixture_form_id(1521)")).stdout.trim()
    const results = await Promise.all([effect(`select public.fixture_fiscal_review('${revision}')->>'code'`), effect(`select public.fixture_fiscal_review('${revision}')->>'code'`)])
    expect(results.every(result => result.code === 0)).toBe(true)
    expect(results.filter(result => result.stdout.trim() === "stale")).toHaveLength(1)
    expect((await query("select review_status from public.fiscal_sponsorship_documents where id=public.fixture_form_id(1521); select count(*) from public.fiscal_sponsorship_events")).stdout.trim()).toBe("accepted\n1")
  })
  it("preserves profile attribution cleanup during closure", async () => {
    const release = await hold("select public.fixture_closure('request',600,0)")
    // Actual external-document activity FK may wait; account cleanup must finish.
    const cleanup = await queued("delete from auth.users where id=public.fixture_form_id(13)")
    await release()
    const result = await cleanup.result
    expect(result.code, result.stderr).toBe(0)
    expect((await query("select count(*) from public.fiscal_sponsorship_documents where generated_by is null and uploaded_by is null and reviewed_by is null and confirmed_by is null and title='Original'; select count(*) from public.organizations where user_id in(public.fixture_form_id(1),public.fixture_form_id(2))")).stdout.trim()).toBe("2\n2")
  })
  it("preserves other organization writes and rolls back mixed batches", async () => {
    const release = await hold("select public.fixture_closure('request',600,0)")
    const other = "update public.fiscal_sponsorship_documents set title='Other' where org_id=public.fixture_form_id(2)"
    expect((await effect(other)).code).toBe(0)
    await release()
    const result = await effect(`update public.fiscal_sponsorship_documents set title='Partial' where org_id=public.fixture_form_id(2); ${direct[1][1]}`)
    expect(result.code).not.toBe(0)
    expect(result.stderr).toContain("Organization unavailable")
    expect((await query("select title from public.fiscal_sponsorship_documents order by org_id")).stdout.trim()).toBe("Original\nOther")
  })
  it("permits explicit retry after cancel without restoring publication", async () => {
    expect((await query("select public.fixture_closure('request',600,0)")).code).toBe(0)
    const release = await hold("select public.fixture_closure('cancel',601,1)")
    expect((await effect(save)).stderr).toContain("Organization is changing; retry document edit")
    await release()
    const retried = await effect(save)
    expect(retried.code, retried.stderr).toBe(0)
    expect(retried.stdout.trim()).toBe("true")
    expect((await query("select visibility from public.organization_workspace_pages where id=public.fixture_form_id(10)")).stdout.trim()).toBe("private")
  })
  it.each(["repeatable read", "serializable"])("rejects %s admission", async isolation => {
    const result = await query(`begin isolation level ${isolation}; ${privileged(direct[1][1])}; commit`)
    expect(result.code).not.toBe(0)
    expect(result.stderr).toContain("Closure boundary requires read committed isolation")
  })
})
