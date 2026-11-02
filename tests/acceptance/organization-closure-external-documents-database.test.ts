import { spawn } from "node:child_process"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { databaseUrl, createClosureDatabaseHarness } from "./organization-closure-database-helpers"

const { clients, query, hold, queued } = createClosureDatabaseHarness(spawn)
const effects = [
  ["insert", "insert into public.organization_external_documents(org_id,provider_file_id,name,mime_type,web_view_link) values(public.fixture_form_id(1),'syntheticDriveNew','New','application/pdf','https://example.org/synthetic')"],
  ["metadata", "update public.organization_external_documents set name='Changed' where id=public.fixture_form_id(1101)"],
  ["detach", "delete from public.organization_external_documents where id=public.fixture_form_id(1101)"],
  ["reattach", "select public.fixture_external_reattach()"],
] as const
const cleanup = [
  ["disconnect", "select public.fixture_drive_disconnect()", true, "select bool_and(status='needs_reconnect') from public.organization_external_documents"],
  ["connection deletion", "delete from public.google_drive_connections where id=public.fixture_form_id(1110)", true, "select bool_and(connection_id is null and status='needs_reconnect') from public.organization_external_documents"],
  ["connection owner's account deletion", "delete from auth.users where id=public.fixture_form_id(12)", false, "select bool_and(connection_id is null and status='needs_reconnect') from public.organization_external_documents"],
  ["attribution account deletion", "delete from auth.users where id=public.fixture_form_id(13)", false, "select bool_and(attached_by is null) from public.organization_external_documents"],
] as const
const privileged = (sql: string) => `set local role service_role; ${sql}`
const effectQuery = (sql: string) => query(`begin; ${privileged(sql)}; commit`)
const stateSql = "select (select jsonb_agg(to_jsonb(d) order by id) from public.organization_external_documents d)::text,(select count(*) from public.organization_project_activity_events where metadata->>'source'='organization_external_documents')"
let baseline: string

// Provision organization-closure-external-documents-fixture.sql. Mutate fixtures sequentially.
describe.skipIf(!databaseUrl)("closure external-document serialization", () => {
  beforeEach(async () => {
    const result = await query("begin; set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001'; select public.fixture_closure_external_documents(); commit")
    expect(result.code, result.stderr).toBe(0)
    const state = await query(stateSql)
    expect(state.code, state.stderr).toBe(0)
    baseline = state.stdout.trim()
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
  it.each(effects)("denies busy and committed closure for %s without reference/audit effects", async (_name, sql) => {
    const release = await hold("select public.fixture_closure('request',600,0)")
    const busy = await effectQuery(sql)
    expect(busy.code).not.toBe(0)
    expect(busy.stderr).toContain("Organization is changing; retry document edit")
    await release()
    const closed = await effectQuery(sql)
    expect(closed.code).not.toBe(0)
    expect(closed.stderr).toContain("Organization unavailable")
    expect((await query(stateSql)).stdout.trim()).toBe(baseline)
  })
  it.each(effects.filter(([name]) => name === "metadata" || name === "detach"))("rechecks queued %s after a tuple wait", async (_name, sql) => {
    const release = await hold("select 1 from public.organization_external_documents where id=public.fixture_form_id(1101) for update")
    const writing = await queued(`begin; ${privileged(sql)}; commit`)
    expect((await query("select public.fixture_closure('request',600,0)")).code).toBe(0)
    await release()
    const result = await writing.result
    expect(result.code).not.toBe(0)
    expect(result.stderr).toContain("Organization unavailable")
    expect((await query(stateSql)).stdout.trim()).toBe(baseline)
  })
  it("keeps UPSERT admission while its conflict tuple is blocked", async () => {
    const release = await hold("select 1 from public.organization_external_documents where id=public.fixture_form_id(1101) for update")
    const writing = await queued(`begin; ${privileged("select public.fixture_external_reattach()")}; commit`)
    const closing = await query("set lock_timeout='150ms'; select public.fixture_closure('request',600,0)")
    expect(closing.code).not.toBe(0)
    expect(closing.stderr).toContain("lock timeout")
    expect((await query("select count(*) from public.organization_closures; select count(*) from public.organization_closure_operations")).stdout.trim()).toBe("0\n0")
    await release()
    const result = await writing.result
    expect(result.code, result.stderr).toBe(0)
    const retry = await query("select public.fixture_closure('request',600,0)->>'state'")
    expect(retry.code, retry.stderr).toBe(0)
    expect(retry.stdout.trim()).toBe("closing")
  })
  it.each(cleanup)("preserves %s after its activity FK waits for closure", async (_name, sql, service, readback) => {
    const release = await hold("select public.fixture_closure('request',600,0)")
    // The real activity trigger inserts an org-owned audit row. Its FK waits for
    // closure's organization lock; the revocation itself must never be denied.
    const writing = await queued(`begin; ${service ? privileged(sql) : sql}; commit`)
    await release()
    const result = await writing.result
    expect(result.code, result.stderr).toBe(0)
    expect((await query(readback)).stdout.trim()).toBe("t")
    expect((await query("select count(*) from public.organization_external_documents; select count(*) from public.organizations where user_id in(public.fixture_form_id(1),public.fixture_form_id(2))")).stdout.trim()).toBe("2\n2")
  })
  it("preserves another organization's writes and the shared connection during closure", async () => {
    const release = await hold("select public.fixture_closure('request',600,0)")
    const result = await effectQuery("update public.organization_external_documents set name='Other saved' where org_id=public.fixture_form_id(2)")
    expect(result.code, result.stderr).toBe(0)
    await release()
    expect((await query("select name from public.organization_external_documents where org_id=public.fixture_form_id(2); select status from public.google_drive_connections where id=public.fixture_form_id(1110)")).stdout.trim()).toBe("Other saved\nconnected")
  })
  it("rolls back a mixed-organization batch and its activity events", async () => {
    expect((await query("select public.fixture_closure('request',600,0)")).code).toBe(0)
    const result = await effectQuery("update public.organization_external_documents set name='Must rollback' where org_id=public.fixture_form_id(2); select public.fixture_external_reattach()")
    expect(result.code).not.toBe(0)
    expect(result.stderr).toContain("Organization unavailable")
    expect((await query(stateSql)).stdout.trim()).toBe(baseline)
  })
  it("requires explicit retry after cancel without reconnecting references or republishing", async () => {
    expect((await effectQuery("select public.fixture_drive_disconnect()")).code).toBe(0)
    expect((await query("select public.fixture_closure('request',600,0)")).code).toBe(0)
    const release = await hold("select public.fixture_closure('cancel',601,1)")
    const busy = await effectQuery("select public.fixture_external_reattach()")
    expect(busy.code).not.toBe(0)
    expect(busy.stderr).toContain("Organization is changing; retry document edit")
    await release()
    expect((await query("select status from public.organization_external_documents where org_id=public.fixture_form_id(1); select visibility from public.organization_workspace_pages where id=public.fixture_form_id(10)")).stdout.trim()).toBe("needs_reconnect\nprivate")
    const retry = await effectQuery("select public.fixture_drive_reconnect(); select public.fixture_external_reattach()")
    expect(retry.code, retry.stderr).toBe(0)
  })
  it.each(["repeatable read", "serializable"])("rejects %s reference writes", async (isolation) => {
    const result = await query(`begin isolation level ${isolation}; ${privileged("select public.fixture_external_reattach()")}; commit`)
    expect(result.code).not.toBe(0)
    expect(result.stderr).toContain("Closure boundary requires read committed isolation")
  })
})
