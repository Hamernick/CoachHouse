import { spawnSync } from "node:child_process"
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"
import { noteFixtureId as id, noteFixtureQuote as quote, noteFixturePage as pageId, noteFixtureParticle as particleId, seedPageNoteFixture } from "./fixtures/workspace-page-note-source"

const template = process.env.WORKSPACE_SHARING_BUSINESS_CONFLICT_TEST_DATABASE_URL
const migration = "supabase/migrations/20261103270000_workspace_sharing_business_conflicts.sql"
const env = { ...process.env, PGOPTIONS: "-c statement_timeout=5000 -c coach_house.workspace_sharing_fixture=isolated-test-only" }
let url: string, directory: string
function command(program: string, args: string[], input?: string) {
  const result = spawnSync(program, args, { env, input, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 })
  expect(result.status, result.stderr).toBe(0)
  return result.stdout.trim()
}
const query = (input: string) => {
  const result = spawnSync("psql", ["-XqAt", "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=verbose", "-d", url], { env, input, encoding: "utf8" })
  return { code: result.status, stdout: result.stdout, stderr: result.stderr }
}
const sql = (input: string) => command("psql", ["-XqAt", "-v", "ON_ERROR_STOP=1", "-d", url], input)
const guest = (actor: number, value: unknown) => `set role service_role;select public.workspace_page_guest_command('${id(actor)}','${pageId}',${quote(value)},repeat('b',64));`
const note = (actor: number, value: unknown, graph?: unknown, next?: unknown) => `set role service_role;select public.workspace_page_note_command('${id(actor)}','${pageId}',${quote(value)},repeat('c',64),${graph ? quote(graph) : "null"},${next ? quote(next) : "null"});`
const enable = (operation = 7020, revision = 1) => ({ action: "set_scope", particleId, operationId: id(operation), expectedPageRevision: revision, expectedNoteRevision: 1, enabled: true })
function conflict(input: string) {
  const result = query(input)
  expect(result.code).not.toBe(0)
  expect(result.stderr).toContain("PT409")
}
const state = () => sql(`select jsonb_build_object('page',(select to_jsonb(p) from public.organization_workspace_pages p where id='${pageId}'),'board',(select state from public.organization_workspace_boards where org_id='${id(1)}'),'receipts',(select count(*) from public.workspace_page_note_receipts));`)

describe.skipIf(!template).sequential("sharing permanent business conflicts", () => {
  beforeAll(() => {
    const source = new URL(template!)
    if (!["localhost", "127.0.0.1", "[::1]"].includes(source.hostname) || !/^\/workspace_sharing_fixture_[a-z0-9_]+$/.test(source.pathname) || source.password) throw new Error("Explicit disposable local fixture required")
    directory = mkdtempSync(join(tmpdir(), "ch-sharing-conflicts-"))
    const dump = join(directory, "source.sql"), name = `workspace_sharing_fixture_guestconflict_${process.pid}_${Date.now()}`
    command("pg_dump", ["--format=plain", "--file", dump, "--dbname", template!])
    command("createdb", ["--maintenance-db", template!, name]); source.pathname = "/" + name; url = source.toString()
    sql(readFileSync(dump, "utf8"))
    const acl = "select proname||':'||proowner::text||':'||coalesce(proacl::text,'null') from pg_proc where proname like 'workspace_page_guest_command%' or proname='workspace_page_note_command' order by proname"
    const before = sql(acl), wrapper = sql("select pg_get_functiondef('public.workspace_page_guest_command(uuid,uuid,jsonb,text)'::regprocedure)")
    sql(readFileSync(migration, "utf8"))
    expect(sql(acl)).toBe(before)
    expect(sql("select pg_get_functiondef('public.workspace_page_guest_command(uuid,uuid,jsonb,text)'::regprocedure)")).toBe(wrapper)
  }, 30_000)
  beforeEach(async () => { await seedPageNoteFixture(async input => query(input)) })
  afterAll(() => { if (directory) writeFileSync(join(directory, "fixture.json"), JSON.stringify({ url, directory, migration })) })
  it("preserves the accepted page edit and exact retry while returning stale revision conflicts", () => {
    const edit = { action: "edit", operationId: id(7100), expectedRevision: 1, title: "Accepted", description: "Saved description" }
    const first = JSON.parse(sql(guest(2, edit)))
    const retry = JSON.parse(sql(guest(2, edit)))
    expect(first.draft.title).toBe("Accepted"); expect(retry.replayed).toBe(true)
    const before = state()
    conflict(guest(2, { ...edit, operationId: id(7101), title: "Rejected" }))
    expect(state()).toBe(before)
    expect(query(guest(13, { ...edit, expectedRevision: 2, operationId: id(7102) })).stderr).toContain("42501")
  })
  it("rejects stale reviewed source scope without creating grants or receipts", () => {
    sql(note(1, enable()))
    const before = state()
    conflict(note(1, enable(7021)))
    expect(state()).toBe(before)
    expect(sql("select count(*) from public.workspace_page_note_scopes where enabled")).toBe("1")
  })
  it("preserves canonical note content, exact replay and other fields after a stale guest write", () => {
    sql(note(1, enable()))
    const read = JSON.parse(sql(note(2, { action: "read", particleId })))
    const next = structuredClone(read.graph); next.revision++
    next.particles[0].revision = next.revision
    next.particles[0].data.widget.source.content = "Accepted note"
    const write = { action: "write", particleId, operationId: id(7030), expectedNoteRevision: 1, content: "Accepted note", html: "<p>Shared source</p>" }
    expect(JSON.parse(sql(note(2, write, read.graph, next))).note.content).toBe("Accepted note")
    expect(JSON.parse(sql(note(2, write, read.graph, next))).replayed).toBe(true)
    const before = state()
    conflict(note(2, { ...write, operationId: id(7031), content: "Rejected note" }, read.graph, next))
    expect(state()).toBe(before)
    expect(JSON.parse(sql(note(2, { action: "read", particleId }))).note.revision).toBe(2)
  })
  it("retains closure isolation rejection and private implementation ACLs", () => {
    for (const role of ["anon", "authenticated", "service_role"]) expect(sql(`select has_function_privilege('${role}','public.workspace_page_guest_command_before_closure(uuid,uuid,jsonb,text)','execute')`)).toBe("f")
    const result = query("begin isolation level repeatable read;" + guest(2, { action: "read" }))
    expect(result.code).not.toBe(0); expect(result.stderr).toContain("40001")
  })
})
