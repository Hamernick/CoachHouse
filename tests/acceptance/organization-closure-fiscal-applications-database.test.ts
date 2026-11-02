import { spawn } from "node:child_process"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { databaseUrl, createClosureDatabaseHarness } from "./organization-closure-database-helpers"

const { clients, query, hold, queued } = createClosureDatabaseHarness(spawn)
const direct = [
  ["application insert", "insert into public.fiscal_sponsorship_applications(org_id,project_id) values(public.fixture_form_id(1),public.fixture_form_id(1404))"],
  ["application update", "update public.fiscal_sponsorship_applications set project_name='Changed' where id=public.fixture_form_id(1501)"],
  ["application delete", "delete from public.fiscal_sponsorship_applications where id=public.fixture_form_id(1501)"],
  ["application upsert", "insert into public.fiscal_sponsorship_applications select * from public.fiscal_sponsorship_applications where id=public.fixture_form_id(1501) on conflict(org_id,project_id) do update set project_name=excluded.project_name"],
  ["review insert", "insert into public.fiscal_sponsorship_reviews(application_id,org_id,project_id,decision) values(public.fixture_form_id(1501),public.fixture_form_id(1),public.fixture_form_id(1401),'approved')"],
  ["review update", "update public.fiscal_sponsorship_reviews set notes='Changed' where id=public.fixture_form_id(1611)"],
  ["review delete", "delete from public.fiscal_sponsorship_reviews where id=public.fixture_form_id(1611)"],
  ["review upsert", "insert into public.fiscal_sponsorship_reviews select * from public.fiscal_sponsorship_reviews where id=public.fixture_form_id(1611) on conflict(application_id,decision,reviewed_at) do update set notes=excluded.notes"],
] as const
const transitions = [
  ["atomic review", "select public.fixture_fiscal_application_review()"],
  ["atomic submission", "select public.fixture_fiscal_application_submit()"],
  ["atomic budget save", "select public.fixture_fiscal_application_save()"],
  ["atomic creation", "select public.fixture_fiscal_application_create()"],
] as const
const privileged = (sql: string) => `set local role service_role; set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001'; ${sql}`
const effect = (sql: string) => query(`begin; ${privileged(sql)}; commit`)
const stateSql = "select jsonb_build_object('applications',(select jsonb_agg(to_jsonb(a) order by id) from public.fiscal_sponsorship_applications a),'reviews',(select jsonb_agg(to_jsonb(r) order by id) from public.fiscal_sponsorship_reviews r),'events',(select jsonb_agg(to_jsonb(e) order by id) from public.fiscal_sponsorship_events e),'documents',(select jsonb_agg(to_jsonb(d) order by id) from public.fiscal_sponsorship_documents d),'program',(select to_jsonb(p) from public.programs p where id=public.fixture_form_id(1620)))::text"
const review = "select public.fixture_fiscal_application_review()->>'ok'"
let baseline: string

// Provision organization-closure-fiscal-applications-fixture.sql; sequential mutations.
describe.skipIf(!databaseUrl)("closure fiscal application and review serialization", () => {
  beforeEach(async () => {
    const reset = await query("begin; set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001'; select public.fixture_closure_fiscal_applications(); commit")
    expect(reset.code, reset.stderr).toBe(0)
    const state = await query(stateSql)
    expect(state.code, state.stderr).toBe(0)
    baseline = state.stdout.trim()
  })
  afterEach(() => { for (const child of clients) child.kill("SIGTERM") })

  it.each([...direct, ...transitions])("finishes admitted %s before closure", async (_name, sql) => {
    const release = await hold(privileged(sql))
    const closing = await queued("select public.fixture_closure('request',600,0)->>'state'")
    await release()
    const result = await closing.result
    expect(result.code, result.stderr).toBe(0)
    expect(result.stdout.trim()).toBe("closing")
  })
  it.each([...direct, ...transitions])("denies busy and committed closure for %s atomically", async (_name, sql) => {
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
  it.each([direct[1], direct[2], direct[5], direct[6]])("rechecks queued %s after a record tuple wait", async (name, sql) => {
    const table = name.startsWith("application") ? "fiscal_sponsorship_applications" : "fiscal_sponsorship_reviews"
    const release = await hold(`select 1 from public.${table} where org_id=public.fixture_form_id(1) for update`)
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
    const writing = await queued(`begin; ${privileged(review)}; commit`)
    expect((await query("select public.fixture_closure('request',600,0)")).code).toBe(0)
    await release()
    const result = await writing.result
    expect(result.code).not.toBe(0)
    expect(result.stderr).toContain("Organization unavailable")
    expect((await query(stateSql)).stdout.trim()).toBe(baseline)
  })
  it("keeps one winner for concurrent same-revision application reviews", async () => {
    const revision = (await query("select updated_at from public.fiscal_sponsorship_applications where id=public.fixture_form_id(1501)")).stdout.trim()
    const results = await Promise.all([effect(`select public.fixture_fiscal_application_review('${revision}')->>'code'`), effect(`select public.fixture_fiscal_application_review('${revision}')->>'code'`)])
    expect(results.every(result => result.code === 0)).toBe(true)
    expect(results.filter(result => result.stdout.trim() === "stale")).toHaveLength(1)
    expect((await query("select status from public.fiscal_sponsorship_applications where id=public.fixture_form_id(1501); select count(*) from public.fiscal_sponsorship_reviews; select count(*) from public.fiscal_sponsorship_events")).stdout.trim()).toBe("approved\n3\n1")
  })
  it.each([
    ["project", "select 1 from public.organization_projects where id=public.fixture_form_id(1401) for update"],
    ["program", "select 1 from public.programs where id=public.fixture_form_id(1620) for update"],
  ])("rechecks budget saves after waiting for the %s", async (_name, lock) => {
    const release = await hold(lock)
    const writing = await queued(`begin; ${privileged("select public.fixture_fiscal_application_save()")}; commit`)
    expect((await query("select public.fixture_closure('request',600,0)")).code).toBe(0)
    await release()
    const result = await writing.result
    expect(result.code).not.toBe(0)
    expect(result.stderr).toContain("Organization unavailable")
    expect((await query(stateSql)).stdout.trim()).toBe(baseline)
  })
  it("keeps application and budget atomic for same-revision saves", async () => {
    const revision = (await query("select updated_at from public.fiscal_sponsorship_applications where id=public.fixture_form_id(1501)")).stdout.trim()
    const results = await Promise.all([effect(`select public.fixture_fiscal_application_save('${revision}')->>'code'`), effect(`select public.fixture_fiscal_application_save('${revision}')->>'code'`)])
    expect(results.every(result => result.code === 0)).toBe(true)
    expect(results.filter(result => result.stdout.trim() === "stale")).toHaveLength(1)
    expect((await query("select project_name from public.fiscal_sponsorship_applications where id=public.fixture_form_id(1501); select goal_cents from public.programs where id=public.fixture_form_id(1620)")).stdout.trim()).toBe("Edited\n400")
  })
  it("preserves profile attribution cleanup during closure", async () => {
    const release = await hold("select public.fixture_closure('request',600,0)")
    // Actual external-document activity FK may wait; account cleanup must finish.
    const cleanup = await queued("delete from auth.users where id=public.fixture_form_id(13)")
    await release()
    const result = await cleanup.result
    expect(result.code, result.stderr).toBe(0)
    expect((await query("select count(*) from public.fiscal_sponsorship_applications where created_by is null and updated_by is null and reviewed_by is null and project_name='Original'; select count(*) from public.fiscal_sponsorship_reviews where reviewed_by is null and notes='Original'; select count(*) from public.organizations where user_id in(public.fixture_form_id(1),public.fixture_form_id(2))")).stdout.trim()).toBe("3\n2\n2")
  })
  it("preserves other organization writes and rolls back mixed batches", async () => {
    const release = await hold("select public.fixture_closure('request',600,0)")
    const other = "update public.fiscal_sponsorship_applications set project_name='Other' where org_id=public.fixture_form_id(2)"
    expect((await effect(other)).code).toBe(0)
    await release()
    const result = await effect(`update public.fiscal_sponsorship_applications set project_name='Partial' where org_id=public.fixture_form_id(2); ${direct[1][1]}`)
    expect(result.code).not.toBe(0)
    expect(result.stderr).toContain("Organization unavailable")
    expect((await query("select project_name from public.fiscal_sponsorship_applications where id in(public.fixture_form_id(1501),public.fixture_form_id(1502)) order by org_id")).stdout.trim()).toBe("Original\nOther")
  })
  it("permits explicit retry after cancel without restoring publication", async () => {
    expect((await query("select public.fixture_closure('request',600,0)")).code).toBe(0)
    const release = await hold("select public.fixture_closure('cancel',601,1)")
    expect((await effect(review)).stderr).toContain("Organization is changing; retry document edit")
    await release()
    const retried = await effect(review)
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
