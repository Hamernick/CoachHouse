import { spawn } from "node:child_process"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { databaseUrl, createClosureDatabaseHarness } from "./organization-closure-database-helpers"

const { clients, query, hold, queued } = createClosureDatabaseHarness(spawn)
const stores = [
  ["public event", "roadmap_calendar_public_events", "title='Edited'"],
  ["internal event", "roadmap_calendar_internal_events", "title='Edited'"],
  ["public feed", "roadmap_calendar_public_feeds", "token='synthetic-rotated-public'"],
  ["internal feed", "roadmap_calendar_internal_feeds", "token='synthetic-rotated-internal'"],
  ["revision", "organization_workspace_calendar_revisions", "revision=revision+1"],
] as const
const write = (table: string, edit: string) => `update public.${table} set ${edit} where org_id=public.fixture_form_id(1)`
const privileged = (sql: string) => `set local role service_role; ${sql}`
const serviceQuery = (sql: string) => query(`begin; ${privileged(sql)}; commit`)
const stateSql = "select (select title from public.roadmap_calendar_public_events where org_id=public.fixture_form_id(1)), (select title from public.roadmap_calendar_internal_events where org_id=public.fixture_form_id(1)), (select token from public.roadmap_calendar_public_feeds where org_id=public.fixture_form_id(1)), (select token from public.roadmap_calendar_internal_feeds where org_id=public.fixture_form_id(1)), (select revision from public.organization_workspace_calendar_revisions where org_id=public.fixture_form_id(1))"
const baseline = "Public event|Internal event|synthetic-public-1|synthetic-internal-1|1"

// Provision organization-closure-calendar-fixture.sql. Run mutation suites sequentially.
describe.skipIf(!databaseUrl)("closure calendar serialization", () => {
  beforeEach(async () => {
    // Reset the previous board event with its owner identity; the local OS login
    // is not a production calendar maintenance role.
    const result = await query("begin; set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001'; select public.fixture_closure_calendar(); commit")
    expect(result.code, result.stderr).toBe(0)
  })
  afterEach(() => { for (const child of clients) child.kill("SIGTERM") })

  it.each(stores)("finishes admitted %s before closure", async (_name, table, edit) => {
    const release = await hold(privileged(write(table, edit)))
    const closing = await queued("select public.fixture_closure('request',600,0)->>'state'")
    await release()
    const result = await closing.result
    expect(result.code, result.stderr).toBe(0)
    expect(result.stdout.trim()).toBe("closing")
  })
  it.each(stores)("denies busy and committed closure for %s", async (_name, table, edit) => {
    const release = await hold("select public.fixture_closure('request',600,0)")
    const busy = await serviceQuery(write(table, edit))
    expect(busy.code).not.toBe(0)
    expect(busy.stderr).toContain("Organization is changing; retry calendar edit")
    await release()
    const closed = await serviceQuery(write(table, edit))
    expect(closed.code).not.toBe(0)
    expect(closed.stderr).toContain("Organization unavailable")
    expect((await query(stateSql)).stdout.trim()).toBe(baseline)
  })
  it.each(stores)("rechecks queued %s after a tuple wait", async (_name, table, edit) => {
    const release = await hold(`select 1 from public.${table} where org_id=public.fixture_form_id(1) for update`)
    const writing = await queued(`begin; ${privileged(write(table, edit))}; commit`)
    expect((await query("select public.fixture_closure('request',600,0)")).code).toBe(0)
    await release()
    const result = await writing.result
    expect(result.code).not.toBe(0)
    expect(result.stderr).toContain("Organization unavailable")
    expect((await query(stateSql)).stdout.trim()).toBe(baseline)
  })
  it("finishes the board event and its real revision trigger before closure", async () => {
    const release = await hold(privileged("select public.fixture_calendar_board_event()"))
    const closing = await queued("select public.fixture_closure('request',600,0)->>'state'")
    await release()
    const result = await closing.result
    expect(result.code, result.stderr).toBe(0)
    expect(result.stdout.trim()).toBe("closing")
    expect((await query("select revision from public.organization_workspace_calendar_revisions where org_id=public.fixture_form_id(1)")).stdout.trim()).toBe("2")
  })
  it("rejects the board event after waiting behind closure without a revision effect", async () => {
    const release = await hold("select public.fixture_closure('request',600,0)")
    const writing = await queued("begin; set local role service_role; select public.fixture_calendar_board_event(); commit")
    await release()
    const result = await writing.result
    expect(result.code).not.toBe(0)
    expect(result.stderr).toContain("Organization unavailable")
    expect((await query(stateSql)).stdout.trim()).toBe(baseline)
    expect((await query("select public.workspace_particle_calendar_projection(state) from public.organization_workspace_boards where org_id=public.fixture_form_id(1)")).stdout.trim()).toBe("[]")
  })
  it("avoids lock inversion when a board event waits for its revision receipt", async () => {
    const release = await hold("select 1 from public.organization_workspace_calendar_revisions where org_id=public.fixture_form_id(1) for update")
    const writing = await queued("begin; set local role service_role; select public.fixture_calendar_board_event(); commit")
    // The INSERT side of the receipt UPSERT has already admitted the writer.
    const closing = await query("set lock_timeout='150ms'; select public.fixture_closure('request',600,0)")
    expect(closing.code).not.toBe(0)
    expect(closing.stderr).toContain("lock timeout")
    expect((await query("select count(*) from public.organization_closures; select count(*) from public.organization_closure_operations")).stdout.trim()).toBe("0\n0")
    await release()
    const saved = await writing.result
    expect(saved.code, saved.stderr).toBe(0)
    const retry = await query("select public.fixture_closure('request',600,0)->>'state'")
    expect(retry.code, retry.stderr).toBe(0)
    expect(retry.stdout.trim()).toBe("closing")
  })
  it("allows authorized revocation under held closure and never restores tokens on cancel", async () => {
    const release = await hold("select public.fixture_closure('request',600,0)")
    const revoked = await query("begin; set local role authenticated; set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001'; delete from public.roadmap_calendar_public_feeds where org_id=public.fixture_form_id(1); delete from public.roadmap_calendar_internal_feeds where org_id=public.fixture_form_id(1); commit")
    expect(revoked.code, revoked.stderr).toBe(0)
    await release()
    expect((await query("select public.fixture_closure('cancel',601,1)")).code).toBe(0)
    expect((await query("select count(*) from public.roadmap_calendar_public_feeds where org_id=public.fixture_form_id(1); select count(*) from public.roadmap_calendar_internal_feeds where org_id=public.fixture_form_id(1); select visibility from public.organization_workspace_pages where id=public.fixture_form_id(10)")).stdout.trim()).toBe("0\n0\nprivate")
    const retry = await serviceQuery("select public.fixture_calendar_board_event()")
    expect(retry.code, retry.stderr).toBe(0)
  })
  it("preserves another organization's calendar during closure", async () => {
    const release = await hold("select public.fixture_closure('request',600,0)")
    const result = await serviceQuery("update public.roadmap_calendar_internal_events set title='Other saved' where org_id=public.fixture_form_id(2); update public.roadmap_calendar_internal_feeds set token='synthetic-other' where org_id=public.fixture_form_id(2)")
    expect(result.code, result.stderr).toBe(0)
    await release()
    expect((await query("select title from public.roadmap_calendar_internal_events where org_id=public.fixture_form_id(2)")).stdout.trim()).toBe("Other saved")
  })
  it.each(["repeatable read", "serializable"])("rejects %s writes", async (isolation) => {
    const result = await query(`begin isolation level ${isolation}; ${privileged(write("roadmap_calendar_internal_events", "title='Unsafe'"))}; commit`)
    expect(result.code).not.toBe(0)
    expect(result.stderr).toContain("Closure boundary requires read committed isolation")
  })
})
