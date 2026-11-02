import { spawn } from "node:child_process"
import { afterAll, beforeEach, describe, expect, it } from "vitest"
import { createClosureDatabaseHarness, databaseUrl } from "./organization-closure-database-helpers"
const db = createClosureDatabaseHarness(spawn)
const id = (value: number) => `10000000-0000-4000-8000-${String(value).padStart(12, "0")}`
const command = () => ({ action: "create_view", organizationId: id(1), viewId: id(2401), requestId: id(2402), name: "Projects", source: { kind: "projects" } })
const quote = (value: unknown) => `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`
const auth = (actor = 1) => `set role authenticated; set request.jwt.claim.sub='${id(actor)}';`
const lookup = (value: unknown = command()) => `select public.read_project_data_view_creation(${quote(value)})`
async function sql(query: string) { const result = await db.query(query); expect(result.code, result.stderr).toBe(0); return result.stdout.trim() }
async function read(value: unknown = command(), actor = 1) { return JSON.parse(await sql(`${auth(actor)} ${lookup(value)}`)) }
async function create(actor = 1) { return JSON.parse(await sql(`${auth(actor)} select public.workspace_data_view_command(${quote(command())})`)) }
async function denied(query: string, message?: string) { const result = await db.query(query); expect(result.code).not.toBe(0); if (message) expect(result.stderr).toContain(message) }

describe.skipIf(!databaseUrl)("exact read-only projects-view receipts", () => {
  beforeEach(async () => { await sql("select public.fixture_data_views()") })
  afterAll(() => { for (const child of db.clients) child.kill() })
  it("never creates on missing recovery and confirms the exact manual creation without mutating anything", async () => {
    expect(await read()).toEqual({ receipt: null, view: null })
    expect(await sql("select count(*) from public.organization_data_views")).toBe("0")
    const receipt = await create()
    const counts = "select jsonb_build_array((select count(*) from public.organization_data_views),(select count(*) from public.organization_data_rows),(select count(*) from public.organization_data_view_receipts))"
    const before = await sql(counts)
    const recovered = await read()
    expect(recovered.receipt).toEqual(receipt)
    expect(recovered.view).toEqual({ id: command().viewId, name: "Projects", revision: 1 })
    expect(await read()).toEqual(recovered)
    expect(await sql(counts)).toBe(before)
  })
  it("requires actor ownership, full command equality and current source rights", async () => {
    await create()
    await sql(`insert into public.organization_memberships(org_id,member_id,role) values('${id(1)}','${id(18)}','staff')`)
    await denied(`${auth(18)} ${lookup()}`, "Creation receipt unavailable")
    await denied(`${auth()} ${lookup({ ...command(), name: "Different" })}`, "Creation request changed")
    await denied(`${auth()} ${lookup({ ...command(), viewId: id(2499) })}`, "Creation request changed")
    await denied(`${auth(2)} ${lookup()}`, "Creation receipt unavailable")
    await sql(`update public.subscriptions set status='canceled' where user_id='${id(1)}'`)
    await denied(`${auth()} ${lookup()}`, "Creation receipt unavailable")
  })
  it.each([{ extra: true }, { source: { kind: "responses" } }, { source: { kind: "projects", rows: [] } }, { name: "x".repeat(101) }])("rejects unsupported receipt requests %j", async change => {
    await denied(`${auth()} ${lookup({ ...command(), ...change })}`, "Invalid creation receipt request")
    expect(await sql("select count(*) from public.organization_data_views")).toBe("0")
  })
  it("keeps receipt execution private to the authenticated API boundary", async () => {
    await denied(`set role anon; ${lookup()}`, "permission denied")
    await denied(`set role service_role; ${lookup()}`, "permission denied")
    await denied(`${auth()} begin isolation level repeatable read; ${lookup()}`, "Read committed required")
  })
  it("admits fixed-window receipt recovery during closure and denies expiry or revoked membership", async () => {
    await sql(`insert into public.organization_memberships(org_id,member_id,role) values('${id(1)}','${id(13)}','staff') on conflict(org_id,member_id) do update set role='staff'`)
    await create(13)
    await sql("select public.fixture_closure('request',3000,0)")
    expect((await read(command(), 13)).receipt.viewId).toBe(command().viewId)
    await sql(`delete from public.organization_memberships where org_id='${id(1)}' and member_id='${id(13)}'`)
    await denied(`${auth(13)} ${lookup()}`, "Creation receipt unavailable")
    await sql("update public.organization_closures set requested_at='2000-01-01Z',export_until='2000-01-31Z'")
    await denied(`${auth()} ${lookup()}`, "Organization unavailable")
  })
  it("holds organization admission through read recovery and fails safely when closure owns it", async () => {
    await create()
    const release = await db.hold(`${auth()} ${lookup()}`)
    await db.blocked("select public.fixture_closure('request',3000,0)")
    await release()
    const closing = await db.hold("select public.fixture_closure('request',3000,0)")
    await denied(`${auth()} ${lookup()}`, "could not obtain lock")
    expect(await read({ ...command(), organizationId: id(2) }, 2)).toEqual({ receipt: null, view: null })
    await closing()
  })
  it("serializes member and subscription revocation after admitted recovery", async () => {
    await sql(`insert into public.organization_memberships(org_id,member_id,role) values('${id(1)}','${id(13)}','staff') on conflict(org_id,member_id) do update set role='staff'`)
    await create(13)
    const release = await db.hold(`${auth(13)} ${lookup()}`)
    await db.blocked(`delete from public.organization_memberships where org_id='${id(1)}' and member_id='${id(13)}'`)
    await db.blocked(`update public.subscriptions set status='canceled' where user_id='${id(1)}'`)
    await release()
    await sql(`delete from public.organization_memberships where org_id='${id(1)}' and member_id='${id(13)}'`)
    await denied(`${auth(13)} ${lookup()}`, "Creation receipt unavailable")
  })
})
