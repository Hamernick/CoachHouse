import { spawn } from "node:child_process"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { databaseUrl, createClosureDatabaseHarness } from "./organization-closure-database-helpers"

const { clients, query, hold, queued } = createClosureDatabaseHarness(spawn)
const stores = [
  ["file", "organization_document_files", "org_id=public.fixture_form_id(1)", "name='Changed.md'"],
  ["room", "document_collaboration_rooms", "org_id=public.fixture_form_id(1)", "recovery_bytes=2"],
  ["update", "document_collaboration_updates", "room_id=public.fixture_form_id(1011)", "payload=decode('02','hex')"],
  ["version", "document_file_versions", "org_id=public.fixture_form_id(1)", "name='Changed.md'"],
  ["operation", "document_version_operations", "org_id=public.fixture_form_id(1)", "fingerprint='Changed'"],
] as const
const effects = [
  ...stores.map(([name, table, scope, edit]) => [name, `update public.${table} set ${edit} where ${scope}`, "service_role"]),
  ["reservation replay", "select public.fixture_document_reserve()", "service_role"],
  ["new reservation", "select public.fixture_document_reserve(1052)", "service_role"],
  ["canonical save", "select public.fixture_document_commit()", "service_role"],
  ["compaction", "select public.fixture_document_compact()", "service_role"],
  ["append", "select public.fixture_document_append()", "authenticated"],
]
const privileged = (sql: string, role = "service_role") => `set local role ${role}; set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001'; ${sql}`
const effectQuery = (sql: string, role = "service_role") => query(`begin; ${privileged(sql, role)}; commit`)
const stateSql = `select jsonb_build_object(${stores.map(([name, table, scope]) => `'${name}',(select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text) from public.${table} t where ${scope})`).join(",")})::text`
let baseline: string

// Provision organization-closure-documents-fixture.sql. Run mutation suites sequentially.
describe.skipIf(!databaseUrl)("closure uploaded-document serialization", () => {
  beforeEach(async () => {
    const result = await query("begin; set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001'; select public.fixture_closure_documents(); commit")
    expect(result.code, result.stderr).toBe(0)
    const state = await query(stateSql)
    expect(state.code, state.stderr).toBe(0)
    baseline = state.stdout.trim()
  })
  afterEach(() => { for (const child of clients) child.kill("SIGTERM") })

  it.each(effects)("finishes admitted %s before closure", async (_name, sql, role) => {
    const release = await hold(privileged(sql, role))
    const closing = await queued("select public.fixture_closure('request',600,0)->>'state'")
    await release()
    const result = await closing.result
    expect(result.code, result.stderr).toBe(0)
    expect(result.stdout.trim()).toBe("closing")
  })
  it.each(effects)("denies busy and committed closure for %s without partial effects", async (_name, sql, role) => {
    const release = await hold("select public.fixture_closure('request',600,0)")
    const busy = await effectQuery(sql, role)
    expect(busy.code).not.toBe(0)
    expect(busy.stderr).toContain("Organization is changing; retry document edit")
    await release()
    const closed = await effectQuery(sql, role)
    expect(closed.code).not.toBe(0)
    expect(closed.stderr).toContain("Organization unavailable")
    expect((await query(stateSql)).stdout.trim()).toBe(baseline)
  })
  it.each(stores)("rechecks queued %s after a tuple wait", async (_name, table, scope, edit) => {
    const release = await hold(`select 1 from public.${table} where ${scope} for update`)
    const writing = await queued(`begin; ${privileged(`update public.${table} set ${edit} where ${scope}`)}; commit`)
    expect((await query("select public.fixture_closure('request',600,0)")).code).toBe(0)
    await release()
    const result = await writing.result
    expect(result.code).not.toBe(0)
    expect(result.stderr).toContain("Organization unavailable")
    expect((await query(stateSql)).stdout.trim()).toBe(baseline)
  })
  it("rechecks a canonical save queued behind its file tuple", async () => {
    const release = await hold("select 1 from public.organization_document_files where id=public.fixture_form_id(1001) for update")
    const writing = await queued(`begin; ${privileged("select public.fixture_document_commit()")}; commit`)
    expect((await query("select public.fixture_closure('request',600,0)")).code).toBe(0)
    await release()
    const result = await writing.result
    expect(result.code).not.toBe(0)
    expect(result.stderr).toContain("Organization unavailable")
    expect((await query(stateSql)).stdout.trim()).toBe(baseline)
  })
  it("allows exact staged cancellation under held closure without reopening the request", async () => {
    const release = await hold("select public.fixture_closure('request',600,0)")
    // The application uses separate RPC transactions, with Storage removal between.
    // Combining both UPDATEs creates a same-transaction FK recheck/organization wait.
    const canceled = await effectQuery("select public.abandon_uploaded_document_version(public.fixture_form_id(1001),public.fixture_form_id(1),public.fixture_form_id(1051))")
    expect(canceled.code, canceled.stderr).toBe(0)
    expect(canceled.stdout.trim()).toBe("t")
    const finished = await effectQuery("select public.finish_abandoned_document_version(public.fixture_form_id(1001),public.fixture_form_id(1),public.fixture_form_id(1051))")
    expect(finished.code, finished.stderr).toBe(0)
    expect(finished.stdout.trim()).toBe("t")
    await release()
    expect((await query("select public.fixture_closure('cancel',601,1)")).code).toBe(0)
    const replay = await effectQuery("select public.fixture_document_reserve()")
    expect(replay.code).not.toBe(0)
    expect(replay.stderr).toContain("Document stage was canceled")
    expect((await query("select state,staged_bytes from public.document_version_operations where request_id=public.fixture_form_id(1051); select visibility from public.organization_workspace_pages where id=public.fixture_form_id(10)")).stdout.trim()).toBe("cleaned|0\nprivate")
  })
  it("preserves another organization's file and shared identity under held closure", async () => {
    const release = await hold("select public.fixture_closure('request',600,0)")
    const result = await effectQuery("update public.organization_document_files set name='Other.md' where org_id=public.fixture_form_id(2)")
    expect(result.code, result.stderr).toBe(0)
    await release()
    expect((await query("select name from public.organization_document_files where org_id=public.fixture_form_id(2); select count(*) from auth.users where id=public.fixture_form_id(2)")).stdout.trim()).toBe("Other.md\n1")
  })
  it("rolls back an earlier independent write when a closing document effect rejects", async () => {
    expect((await query("select public.fixture_closure('request',600,0)")).code).toBe(0)
    const result = await effectQuery("update public.organization_document_files set name='Must rollback.md' where org_id=public.fixture_form_id(2); select public.fixture_document_commit()")
    expect(result.code).not.toBe(0)
    expect(result.stderr).toContain("Organization unavailable")
    expect((await query("select name from public.organization_document_files where org_id=public.fixture_form_id(2)")).stdout.trim()).toBe("source.md")
    expect((await query(stateSql)).stdout.trim()).toBe(baseline)
  })
  it.each(["repeatable read", "serializable"])("rejects %s admission", async (isolation) => {
    const result = await query(`begin isolation level ${isolation}; ${privileged("select public.fixture_document_reserve()")}; commit`)
    expect(result.code).not.toBe(0)
    expect(result.stderr).toContain("Closure boundary requires read committed isolation")
  })
})
