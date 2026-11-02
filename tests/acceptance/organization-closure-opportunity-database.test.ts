import { spawn } from "node:child_process"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { databaseUrl, createClosureDatabaseHarness } from "./organization-closure-database-helpers"

const { clients, query, hold, queued } = createClosureDatabaseHarness(spawn)
const stores = [
  ["opportunity", "organization_finance_opportunities", 920, "title='Edited'"],
  ["engagement", "organization_finance_engagement_events", 940, "event_type='click'"],
  ["scan", "finance_opportunity_scan_runs", 950, "status='running'"],
  ["match", "organization_resource_opportunity_matches", 930, "status='dismissed'"],
] as const
const effects = [
  ...stores.map(([name, table, id, edit]) => [name, `update public.${table} set ${edit} where id=public.fixture_form_id(${id})`]),
  ["reorder", "select public.fixture_opportunity_reorder()"],
  ["match save", "select public.fixture_opportunity_match()"],
]
const privileged = (sql: string) => `set local role service_role; ${sql}`
const stateSql = "select (select title from public.organization_finance_opportunities where id=public.fixture_form_id(920)), (select feed_position from public.organization_finance_opportunities where id=public.fixture_form_id(920)), (select event_type from public.organization_finance_engagement_events where id=public.fixture_form_id(940)), (select status from public.finance_opportunity_scan_runs where id=public.fixture_form_id(950)), (select status from public.organization_resource_opportunity_matches where id=public.fixture_form_id(930)), (select count(*) from public.organization_finance_opportunities)"
const serviceQuery = (sql: string) => query(`begin; ${privileged(sql)}; commit`)

// Provision organization-closure-opportunity-fixture.sql. Run mutation suites sequentially.
describe.skipIf(!databaseUrl)("closure opportunity serialization", () => {
  beforeEach(async () => {
    const result = await query("select public.fixture_closure_opportunities()")
    expect(result.code, result.stderr).toBe(0)
  })
  afterEach(() => { for (const child of clients) child.kill("SIGTERM") })

  it.each(effects)("finishes admitted %s before closure", async (_name, sql) => {
    const release = await hold(privileged(sql))
    const closing = await queued("select public.fixture_closure('request',600,0)->>'state'")
    await release()
    const result = await closing.result
    expect(result.code, result.stderr).toBe(0)
    expect(result.stdout.trim()).toBe("closing")
  })
  it.each(effects.filter(([name]) => name !== "match save"))("denies busy and committed closure for %s without partial effects", async (_name, sql) => {
    const release = await hold("select public.fixture_closure('request',600,0)")
    const busy = await serviceQuery(sql)
    expect(busy.code).not.toBe(0)
    expect(busy.stderr).toContain("Organization is changing; retry opportunity edit")
    await release()
    const closed = await serviceQuery(sql)
    expect(closed.code).not.toBe(0)
    expect(closed.stderr).toContain("Organization unavailable")
    expect((await query(stateSql)).stdout.trim()).toBe("First|1|view|queued|new|3")
  })
  it("rechecks match save after waiting on the closing transaction's board lock", async () => {
    const release = await hold("select public.fixture_closure('request',600,0)")
    const writing = await queued("begin; set local role service_role; select public.fixture_opportunity_match(); commit")
    await release()
    const result = await writing.result
    expect(result.code).not.toBe(0)
    expect(result.stderr).toContain("Organization unavailable")
    expect((await query(stateSql)).stdout.trim()).toBe("First|1|view|queued|new|3")
  })
  it.each(stores)("rechecks queued %s after a tuple wait", async (_name, table, id, edit) => {
    const release = await hold(`select 1 from public.${table} where id=public.fixture_form_id(${id}) for update`)
    const writing = await queued(`begin; ${privileged(`update public.${table} set ${edit} where id=public.fixture_form_id(${id})`)}; commit`)
    expect((await query("select public.fixture_closure('request',600,0)")).code).toBe(0)
    await release()
    const result = await writing.result
    expect(result.code).not.toBe(0)
    expect(result.stderr).toContain("Organization unavailable")
    expect((await query(stateSql)).stdout.trim()).toBe("First|1|view|queued|new|3")
  })
  it("rejects closure retryably while a match RPC holds its board and waits for its tuple", async () => {
    const release = await hold("select 1 from public.organization_resource_opportunity_matches where id=public.fixture_form_id(930) for update")
    const saving = await queued("begin; set local role service_role; select public.fixture_opportunity_match(); commit")
    const closed = await query("select public.fixture_closure('request',600,0)")
    expect(closed.code).not.toBe(0)
    expect(closed.stderr).toContain("Workspace is changing; retry closure")
    expect((await query("select count(*) from public.organization_closures; select count(*) from public.organization_closure_operations")).stdout.trim()).toBe("0\n0")
    await release()
    const saved = await saving.result
    expect(saved.code, saved.stderr).toBe(0)
    const retry = await query("select public.fixture_closure('request',600,0)->>'state'")
    expect(retry.code, retry.stderr).toBe(0)
    expect(retry.stdout.trim()).toBe("closing")
  })
  it("permits exact cross-org FK cleanup while closure holds the referencing organization", async () => {
    const release = await hold("select public.fixture_closure('request',600,0)")
    const result = await serviceQuery("delete from public.organization_finance_records where id=public.fixture_form_id(911); delete from public.organization_finance_opportunities where id=public.fixture_form_id(922)")
    expect(result.code, result.stderr).toBe(0)
    await release()
    const state = await query("select finance_record_id is null from public.organization_finance_engagement_events where id=public.fixture_form_id(940); select opportunity_id is null from public.organization_resource_opportunity_matches where id=public.fixture_form_id(931)")
    expect(state.stdout.trim()).toBe("t\nt")
  })
  it("preserves other-org and shared-source writes during closure", async () => {
    const release = await hold("select public.fixture_closure('request',600,0)")
    const result = await serviceQuery("update public.organization_finance_opportunities set title='Other edit' where id=public.fixture_form_id(922); update public.finance_opportunity_sources set enabled=true where source_key='grants_gov'")
    expect(result.code, result.stderr).toBe(0)
    await release()
  })
  it("rolls back a mixed-organization batch when a closing row is reached", async () => {
    expect((await query("select public.fixture_closure('request',600,0)")).code).toBe(0)
    const result = await serviceQuery("update public.organization_finance_opportunities set title='Must roll back' where id=public.fixture_form_id(922); select public.fixture_opportunity_match()")
    expect(result.code).not.toBe(0)
    expect(result.stderr).toContain("Organization unavailable")
    expect((await query("select title from public.organization_finance_opportunities where id=public.fixture_form_id(922)")).stdout.trim()).toBe("Other")
  })
  it("requires explicit retry after cancel without restoring publication", async () => {
    expect((await query("select public.fixture_closure('request',600,0)")).code).toBe(0)
    const release = await hold("select public.fixture_closure('cancel',601,1)")
    expect((await serviceQuery("select public.fixture_opportunity_match()")).stderr).toContain("Organization is changing; retry opportunity edit")
    await release()
    const result = await serviceQuery("select public.fixture_opportunity_match()")
    expect(result.code, result.stderr).toBe(0)
    expect((await query("select visibility from public.organization_workspace_pages where id=public.fixture_form_id(10)")).stdout.trim()).toBe("private")
  })
  it.each(["repeatable read", "serializable"])("rejects %s writes", async (isolation) => {
    const result = await query(`begin isolation level ${isolation}; ${privileged("select public.fixture_opportunity_reorder()")}; commit`)
    expect(result.code).not.toBe(0)
    expect(result.stderr).toContain("Closure boundary requires read committed isolation")
  })
})
