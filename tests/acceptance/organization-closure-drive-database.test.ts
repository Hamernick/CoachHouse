import { spawn } from "node:child_process"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { databaseUrl, createClosureDatabaseHarness } from "./organization-closure-database-helpers"

const { clients, query, hold, queued } = createClosureDatabaseHarness(spawn)
const close = "select public.fixture_closure('request',600,0)"
const admit = (actor = 1, write = false, org = 1) => `select public.authorize_organization_drive_access(public.fixture_form_id(${actor}),public.fixture_form_id(${org}),${write})`
const effect = (sql: string) => query(`begin; set local role service_role; ${sql}; commit`)
const expire = "update public.organization_closures set requested_at=clock_timestamp()-interval '721 hours',export_until=clock_timestamp()-interval '1 hour' where org_id=public.fixture_form_id(1)"

describe.skipIf(!databaseUrl)("Drive closure admission and private export deadline", () => {
  beforeEach(async () => {
    const reset = await query("begin; set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001'; select public.fixture_closure_integrated(); commit")
    expect(reset.code, reset.stderr).toBe(0)
  })
  afterEach(() => { for (const client of clients) client.kill("SIGTERM") })
  it("preserves current role permissions without granting another organization", async () => {
    expect((await effect(admit(1, true))).stdout.trim()).toBe("t")
    expect((await effect(admit(999))).stdout.trim()).toBe("f")
    expect((await query("update public.organization_memberships set role='board' where org_id=public.fixture_form_id(1) and member_id=public.fixture_form_id(13)")).code).toBe(0)
    expect((await effect(admit(13))).stdout.trim()).toBe("t")
    expect((await effect(admit(13, true))).stdout.trim()).toBe("f")
  })
  it("finishes admitted work before closure then restricts it to existing export rights", async () => {
    const release = await hold(`set local role service_role; ${admit(1, true)}`)
    const closing = await queued(close)
    await release()
    expect((await closing.result).code).toBe(0)
    expect((await effect(admit())).stdout.trim()).toBe("t")
    expect((await effect(admit(1, true))).stdout.trim()).toBe("f")
    expect((await effect(admit(2, true, 2))).stdout.trim()).toBe("t")
  })
  it("rechecks a membership demotion after its tuple wait", async () => {
    const release = await hold("update public.organization_memberships set role='board' where org_id=public.fixture_form_id(1) and member_id=public.fixture_form_id(13)")
    const reading = await queued(`begin; set local role service_role; ${admit(13, true)}; commit`)
    await release()
    const result = await reading.result
    expect(result.code, result.stderr).toBe(0)
    expect(result.stdout.trim()).toBe("f")
  })
  it("denies expired RPC and direct private-table reads while retaining shared credentials", async () => {
    expect((await query(close)).code).toBe(0)
    // One timestamp preserves the exact fixed720h invariant.
    const expired = await query(expire.replaceAll("clock_timestamp()", "statement_timestamp()"))
    expect(expired.code, expired.stderr).toBe(0)
    expect((await effect(admit())).stdout.trim()).toBe("f")
    const rows = await query("begin; set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001'; set local role authenticated; select count(*) from public.organization_external_documents where org_id=public.fixture_form_id(1); commit")
    expect(rows.code, rows.stderr).toBe(0)
    expect(rows.stdout.trim()).toBe("0")
    expect((await query("select count(*) from public.google_drive_connections; select count(*) from public.organization_external_documents where org_id=public.fixture_form_id(2)")).stdout.trim()).toBe("1\n1")
  })
  it.each(["repeatable read", "serializable"])("denies stale %s snapshots", async isolation => {
    const result = await query(`begin isolation level ${isolation}; set local role service_role; ${admit()}; commit`)
    expect(result.code, result.stderr).toBe(0)
    expect(result.stdout.trim()).toBe("f")
  })
  it("does not expose service admission or lifecycle transitions to browser roles", async () => {
    expect((await query("select has_function_privilege('authenticated','public.authorize_organization_drive_access(uuid,uuid,boolean)','execute'); select has_function_privilege('service_role','public.organization_closure_command(uuid,uuid,text,uuid,integer)','execute')")).stdout.trim()).toBe("f\nf")
  })
})
