import { spawn } from "node:child_process"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { databaseUrl, createClosureDatabaseHarness } from "./organization-closure-database-helpers"

const { clients, query, hold, queued } = createClosureDatabaseHarness(spawn)
const recordEdit = "update public.organization_finance_records set amount_cents=125 where id=public.fixture_form_id(910)"
const accessEdit = "update public.organization_finance_access set access_level='manager' where member_id=public.fixture_form_id(5)"
const revoke = "delete from public.organization_finance_access where member_id=public.fixture_form_id(5)"
const effects = [
  ["record", recordEdit], ["grant", accessEdit],
  ["reconciliation", "select public.fixture_finance_reconcile()"],
  ["correction", "select public.fixture_finance_correct()"],
  ["import", "select public.fixture_finance_import()"],
] as const

// Provision organization-closure-finance-fixture.sql; tests share/reset its DB.
describe.skipIf(!databaseUrl)("closure accounting serialization", () => {
  beforeEach(async () => {
    const result = await query("select public.fixture_closure_finance()")
    expect(result.code, result.stderr).toBe(0)
  })
  afterEach(() => { for (const child of clients) child.kill("SIGTERM") })

  it.each(effects)("finishes admitted %s before closure", async (_name, sql) => {
    const release = await hold(sql)
    const closing = await queued("select public.fixture_closure('request',600,0)->>'state'")
    await release()
    const result = await closing.result
    expect(result.code, result.stderr).toBe(0)
    expect(result.stdout.trim()).toBe("closing")
  })
  it.each(effects)("rejects busy and committed closure for %s without partial effects", async (_name, sql) => {
    const release = await hold("select public.fixture_closure('request',600,0)")
    const busy = await query(sql)
    expect(busy.code).not.toBe(0)
    expect(busy.stderr).toContain("Organization is changing; retry finance edit")
    await release()
    const closed = await query(sql)
    expect(closed.code).not.toBe(0)
    expect(closed.stderr).toContain("Organization unavailable")
    const state = await query("select (select count(*) from public.organization_finance_records), (select count(*) from public.organization_finance_record_evidence), (select count(*) from public.organization_finance_record_events), (select count(*) from public.organization_finance_record_corrections), (select count(*) from public.organization_finance_record_provider_evidence)")
    expect(state.stdout.trim()).toBe("3|0|0|0|0")
  })
  it.each([
    ["record edit", "select 1 from public.organization_finance_records where id=public.fixture_form_id(910) for update", recordEdit],
    ["reconciliation", "select 1 from public.organization_finance_records where id=public.fixture_form_id(910) for update", "select public.fixture_finance_reconcile()"],
    ["grant", "select 1 from public.organization_finance_access where member_id=public.fixture_form_id(5) for update", accessEdit],
  ])("rechecks %s after a tuple wait", async (_name, lock, sql) => {
    const release = await hold(lock)
    const writing = await queued(sql)
    expect((await query("select public.fixture_closure('request',600,0)")).code).toBe(0)
    await release()
    const result = await writing.result
    expect(result.code).not.toBe(0)
    expect(result.stderr).toContain("Organization unavailable")
  })
  it("permits revocation and actual account cleanup during closure without restoring grants on cancel", async () => {
    const release = await hold("select public.fixture_closure('request',600,0)")
    const cleanup = await query(`${revoke}; delete from auth.users where id=public.fixture_form_id(12)`)
    expect(cleanup.code, cleanup.stderr).toBe(0)
    await release()
    const result = await query("select public.fixture_closure('cancel',601,1); select count(*) from public.organization_finance_access; select count(*) from public.organization_finance_records where created_by=public.fixture_form_id(12)")
    expect(result.code, result.stderr).toBe(0)
    expect(result.stdout.trim().split("\n").slice(-2)).toEqual(["0", "0"])
  })
  it("allows other-organization edits while closure owns its organization", async () => {
    const release = await hold("select public.fixture_closure('request',600,0)")
    const result = await query("update public.organization_finance_records set amount_cents=225 where id=public.fixture_form_id(911)")
    expect(result.code, result.stderr).toBe(0)
    await release()
  })
  it("requires an explicit retry after cancellation and keeps publication private", async () => {
    expect((await query("select public.fixture_closure('request',600,0)")).code).toBe(0)
    const release = await hold("select public.fixture_closure('cancel',601,1)")
    expect((await query("select public.fixture_finance_reconcile()")).stderr).toContain("Organization is changing; retry finance edit")
    await release()
    const result = await query("select public.fixture_finance_reconcile(); select visibility from public.organization_workspace_pages where id=public.fixture_form_id(10)")
    expect(result.code, result.stderr).toBe(0)
    expect(result.stdout.trim().split("\n").at(-1)).toBe("private")
  })
  it.each(["repeatable read", "serializable"])("rejects %s accounting snapshots", async (isolation) => {
    const result = await query(`begin isolation level ${isolation}; select public.fixture_finance_reconcile(); commit`)
    expect(result.code).not.toBe(0)
    expect(result.stderr).toContain("Closure boundary requires read committed isolation")
  })
})
