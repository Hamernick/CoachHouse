import { spawnSync } from "node:child_process"
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

const template = process.env.DATA_VIEW_BUSINESS_CONFLICT_TEST_DATABASE_URL
const env = { ...process.env, PGOPTIONS: "-c statement_timeout=5000 -c coach_house.workspace_sharing_fixture=isolated-test-only" }
const migration = "supabase/migrations/20261103260000_data_view_business_conflicts.sql"
let url: string, directory: string
const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const target = { organizationId: id(1), viewId: id(2001) }
const read = { ...target, action: "read", page: 0 }
const create = { ...target, action: "create_view", requestId: id(2100), name: "Conflict fixture", source: {
  kind: "new_table", columns: [{ key: "name", label: "Name", type: "text", writable: true, options: [] }], rows: [{ name: "Initial" }],
  provenance: { kind: "new", filename: null, rowCount: 1 }, audienceConfirmed: true,
} }
function command(program: string, args: string[], input?: string) {
  const result = spawnSync(program, args, { env, input, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 })
  expect(result.status, result.stderr).toBe(0)
  return result.stdout.trim()
}
const sql = (query: string) => command("psql", ["-XqAt", "-v", "ON_ERROR_STOP=1", "-d", url], query)
const query = (value: unknown) => `set role authenticated; set request.jwt.claim.sub='${id(1)}';select public.workspace_data_view_command('${JSON.stringify(value).replaceAll("'", "''")}'::jsonb);`
const call = (value: unknown) => JSON.parse(sql(query(value)))
function conflict(value: unknown) {
  const result = spawnSync("psql", ["-XqAt", "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=verbose", "-d", url], { env, input: query(value), encoding: "utf8" })
  expect(result.status).not.toBe(0)
  expect(result.stderr).toContain("PT409")
}
const receipts = () => sql("select count(*) from public.organization_data_view_receipts")

describe.skipIf(!template).sequential("saved-view permanent business conflicts", () => {
  beforeAll(() => {
    const source = new URL(template!)
    if (!["localhost", "127.0.0.1", "[::1]"].includes(source.hostname) || !/^\/workspace_sharing_fixture_[a-z0-9_]+$/.test(source.pathname) || source.password) throw new Error("Explicit disposable local fixture required")
    directory = mkdtempSync(join(tmpdir(), "ch-data-view-conflicts-"))
    const dump = join(directory, "source.sql"), name = `workspace_sharing_fixture_viewconflict_${process.pid}_${Date.now()}`
    command("pg_dump", ["--format=plain", "--file", dump, "--dbname", template!])
    command("createdb", ["--maintenance-db", template!, name]); source.pathname = "/" + name; url = source.toString()
    sql(readFileSync(dump, "utf8"))
    const acl = "select proname||':'||proowner::text||':'||proacl::text from pg_proc where proname in ('workspace_data_view_command','workspace_data_view_command_nonlinked','workspace_data_view_command_nonresponse') order by proname"
    const before = sql(acl), wrappers = sql("select pg_get_functiondef('public.workspace_data_view_command(jsonb)'::regprocedure)||pg_get_functiondef('public.workspace_data_view_command_nonlinked(jsonb)'::regprocedure)")
    sql(readFileSync(migration, "utf8")); expect(sql(acl)).toBe(before)
    expect(sql("select pg_get_functiondef('public.workspace_data_view_command(jsonb)'::regprocedure)||pg_get_functiondef('public.workspace_data_view_command_nonlinked(jsonb)'::regprocedure)")).toBe(wrappers)
  }, 30_000)
  beforeEach(() => sql(`set request.jwt.claim.sub='${id(1)}';
    delete from public.organization_closure_operations; delete from public.organization_closures;
    truncate public.organization_data_view_receipts,public.organization_data_views,public.organization_data_rows,public.organization_data_tables cascade;
    update public.subscriptions set status='active' where user_id='${id(1)}';
    update public.organization_projects set status='backlog' where id='${id(1401)}';`))
  afterAll(() => { if (directory) writeFileSync(join(directory, "fixture.json"), JSON.stringify({ url, directory, migration })) })
  it("returns row conflicts without changing accepted values or receipts; exact retries still reconcile", () => {
    call(create)
    const row = call(read).rows[0]
    const edit = { ...target, action: "edit_cell", requestId: id(2101), rowId: row.id, revision: row.revision, column: "name", value: "Accepted" }
    const receipt = call(edit); expect(call(edit)).toEqual(receipt)
    const before = call(read), count = receipts()
    conflict({ ...edit, requestId: id(2102), value: "Rejected stale value" })
    expect(call(read)).toEqual(before); expect(receipts()).toBe(count)
  })
  it("returns stale settings, reused identity and existing view conflicts atomically", () => {
    call(create)
    const config = call(read).view.config
    call({ ...target, action: "save_view", requestId: id(2101), revision: 1, config })
    const before = call(read), count = receipts()
    conflict({ ...target, action: "save_view", requestId: id(2102), revision: 1, config })
    conflict({ ...create, name: "Reused request" })
    conflict({ ...create, requestId: id(2103) })
    expect(call(read)).toEqual(before); expect(receipts()).toBe(count)
  })
  it("preserves the canonical project transition after a stale status request", () => {
    call({ ...create, source: { kind: "projects" } })
    const row = call(read).rows.find((value: { id: string }) => value.id === id(1401))
    expect(row).toBeDefined()
    const edit = { ...target, action: "edit_cell", requestId: id(2101), rowId: row.id, revision: row.revision, column: "status", value: "active" }
    call(edit); const count = receipts(), before = call(read)
    conflict({ ...edit, requestId: id(2102), value: "completed" })
    expect(call(read)).toEqual(before); expect(receipts()).toBe(count)
    expect(sql(`select status from public.organization_projects where id='${row.id}'`)).toBe("active")
  })
  it("retains private implementation ACLs and genuine isolation rejection", () => {
    for (const role of ["anon", "authenticated", "service_role"]) expect(sql(`select has_function_privilege('${role}','public.workspace_data_view_command_nonresponse(jsonb)','execute')`)).toBe("f")
    const result = spawnSync("psql", ["-XqAt", "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=verbose", "-d", url], { env, input: "begin isolation level repeatable read;" + query(read), encoding: "utf8" })
    expect(result.status).not.toBe(0); expect(result.stderr).toContain("40001")
  })
})
