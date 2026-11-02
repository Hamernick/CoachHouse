import { spawn } from "node:child_process"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { databaseUrl, createClosureDatabaseHarness } from "./organization-closure-database-helpers"

const { clients, query, hold } = createClosureDatabaseHarness(spawn)
const close = "select public.fixture_closure('request',600,0)"
const state = `select
 (select count(*) from public.organization_closures)||':'||
 (select count(*) from public.organization_invites where id=public.fixture_form_id(2001))||':'||
 (select status from public.organization_access_requests where id=public.fixture_form_id(2011))||':'||
 (select status from public.fiscal_guest_email_outbox where id=public.fixture_form_id(2111))||':'||
 (select (cancel_requested_at is not null)::text from public.workspace_ai_runs where id=public.fixture_form_id(1801))||':'||
 (select visibility from public.organization_workspace_pages where id=public.fixture_form_id(10))`

describe.skipIf(!databaseUrl)("integrated organization shutdown", () => {
  beforeEach(async () => {
    const result = await query("begin; set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001'; select public.fixture_closure_integrated(); commit")
    expect(result.code, result.stderr).toBe(0)
  })
  afterEach(() => { for (const client of clients) client.kill("SIGTERM") })

  it("withdraws publication, access, email and AI atomically without restoring them on cancel", async () => {
    const before = (await query(state)).stdout.trim()
    expect(before).toMatch(/^0:1:pending:pending:false:/)
    const closed = await query(close)
    expect(closed.code, closed.stderr).toBe(0)
    expect((await query(state)).stdout.trim()).toBe("1:0:revoked:failed:true:private")
    const denied = await query("update public.organization_tasks set title='Forbidden' where id=public.fixture_form_id(1801)")
    expect(denied.stderr).toContain("Organization unavailable")
    const other = await query("update public.organization_tasks set title='Allowed' where id=public.fixture_form_id(1802)")
    expect(other.code, other.stderr).toBe(0)
    const canceled = await query("select public.fixture_closure('cancel',601,1)")
    expect(canceled.code, canceled.stderr).toBe(0)
    expect((await query(state)).stdout.trim()).toBe("1:0:revoked:failed:true:private")
    expect((await query("select count(*) from public.organization_closure_activity_admissions")).stdout.trim()).toBe("0")
  })

  it.each([
    ["workspace_ai_runs", "AI run is changing; retry closure"],
    ["organization_access_requests", "Organization access is changing; retry closure"],
  ])("rolls back all earlier shutdown hooks when %s is busy", async (table, message) => {
    const before = (await query(state)).stdout.trim()
    const release = await hold(`select 1 from public.${table} for update`)
    const result = await query(close)
    expect(result.code).not.toBe(0)
    expect(result.stderr).toContain(message)
    expect((await query(state)).stdout.trim()).toBe(before)
    expect((await query("select count(*) from public.organization_closure_operations")).stdout.trim()).toBe("0")
    await release()
    const retried = await query(close)
    expect(retried.code, retried.stderr).toBe(0)
    expect((await query(state)).stdout.trim()).toBe("1:0:revoked:failed:true:private")
  })

  it("preserves shared account cleanup and consumes exact file audit admissions", async () => {
    expect((await query(close)).code).toBe(0)
    const cleanup = await query("delete from auth.users where id=public.fixture_form_id(13)")
    expect(cleanup.code, cleanup.stderr).toBe(0)
    expect((await query("select count(*) from public.organization_project_assets where created_by is not null; select count(*) from public.organization_closure_activity_admissions; select count(*) from public.organizations where user_id in(public.fixture_form_id(1),public.fixture_form_id(2))")).stdout.trim()).toBe("0\n0\n2")
  })
})
