import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from "node:child_process"
import { copyFileSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

const templateUrl = process.env.ORGANIZATION_SUPPRESSION_CAPTURE_TEST_DATABASE_URL
const migration = "supabase/migrations/20261103090000_organization_suppression_capture.sql"
const collector = "docs/agent/organization-suppression-capture.py"
const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const env = { ...process.env, PGOPTIONS: "-c statement_timeout=5000 -c coach_house.workspace_sharing_fixture=isolated-test-only -c timezone=UTC" }
const clients = new Set<ChildProcessWithoutNullStreams>()
let sourceUrl: string, sourceId: string, directory: string, journalPath: string, backupPath: string
const retainedDatabases: string[] = []

function run(program: string, args: string[], input?: string) {
  return spawnSync(program, args, { env, input, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 })
}
function command(program: string, args: string[], input?: string) {
  const result = run(program, args, input)
  expect(result.status, result.stderr).toBe(0)
  return result.stdout.trim()
}
function sql(text: string, url = sourceUrl) {
  return command("psql", ["-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-d", url], text)
}
function query(text: string) {
  const child = spawn("psql", ["-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-d", sourceUrl], { env })
  clients.add(child)
  let stdout = "", stderr = ""
  const result = new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    child.stdout.on("data", (chunk) => { stdout += chunk.toString() })
    child.stderr.on("data", (chunk) => { stderr += chunk.toString() })
    child.on("error", reject)
    child.on("close", (code) => { clients.delete(child); resolve({ code, stdout, stderr }) })
  })
  child.stdin.end(text + "\n")
  return result
}
async function hold(text: string) {
  const child = spawn("psql", ["-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-d", sourceUrl], { env })
  clients.add(child)
  let stderr = ""
  child.stderr.on("data", (chunk) => { stderr += chunk.toString() })
  const closed = new Promise<number | null>((resolve) => child.on("close", (code) => { clients.delete(child); resolve(code) }))
  await new Promise<void>((resolve, reject) => {
    let stdout = ""
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); if (stdout.includes("__CAPTURE_HELD__")) resolve() })
    child.on("error", reject)
    child.on("close", () => reject(new Error(stderr || "Capture session ended before holding its lock")))
    child.stdin.write(`begin; ${text}; select '__CAPTURE_HELD__';\n`)
  })
  return async () => { child.stdin.end("commit;\n"); expect(await closed, stderr).toBe(0) }
}
type Event = {
  sequence: number; eventId: string; kind: string; organizationId: string; operationId: string
  revision: number; occurredAt: string
  request?: { requestId: string; requestedAt: string; exportUntil: string }
  response?: { formId: string; versionId: string; responseId: string; submittedAt: string }
}
type Snapshot = {
  format: string; sourceId: string; capturedSince: string; historyRequiresReconciliation: boolean
  highWater: number; events: Event[]
}
const snapshot = (): Snapshot => JSON.parse(sql("select public.read_organization_suppression_events()"))
function collect(url = sourceUrl, path = journalPath, expected = sourceId) {
  return run("python3", [collector, "--source", url, "--journal", path, "--expected-source-id", expected])
}
function journalRows(path = journalPath) {
  return JSON.parse(command("python3", ["-c", "import json,sqlite3,sys; print(json.dumps(sqlite3.connect(sys.argv[1]).execute('select sequence,event_id,payload,sha256 from suppression_events order by sequence').fetchall()))", path])) as [number, string, string, string][]
}

describe.skipIf(!templateUrl).sequential("organization suppression capture and independent local journal", () => {
  beforeAll(() => {
    const template = new URL(templateUrl!)
    if (!["localhost", "127.0.0.1", "[::1]"].includes(template.hostname)
      || !/^\/workspace_sharing_fixture_[a-z0-9_]+$/.test(template.pathname) || template.password)
      throw new Error("Only an explicitly provisioned disposable local fixture is allowed")
    directory = mkdtempSync(join(tmpdir(), "ch-suppression-capture-"))
    const initialDump = join(directory, "template.sql")
    command("pg_dump", ["--format=plain", "--file", initialDump, "--dbname", templateUrl!])
    const name = `workspace_sharing_fixture_suppression_${process.pid}_${Date.now()}`
    const source = new URL(template); source.pathname = `/${name}`; sourceUrl = source.toString()
    command("createdb", ["--maintenance-db", templateUrl!, name]); retainedDatabases.push(name)
    command("psql", ["-X", "-q", "-v", "ON_ERROR_STOP=1", "-d", sourceUrl], readFileSync(initialDump, "utf8"))
    sql("select public.fixture_closure_storage(); update public.organizations set is_public=true,is_public_roadmap=true;")
    command("psql", ["-X", "-q", "-v", "ON_ERROR_STOP=1", "-d", sourceUrl], readFileSync(migration, "utf8"))
    sourceId = sql("select source_id from public.organization_restore_identity")
    journalPath = join(directory, "suppression.sqlite")
    backupPath = join(directory, "before-events.sql")
    command("pg_dump", ["--format=plain", "--file", backupPath, "--dbname", sourceUrl])
    writeFileSync(join(directory, "fixtures.json"), JSON.stringify({ sourceUrl, journalPath, backupPath, retainedDatabases }))
  }, 30_000)

  afterAll(() => {
    for (const client of clients) client.kill("SIGTERM")
    if (directory) writeFileSync(join(directory, "fixtures.json"), JSON.stringify({ sourceUrl, journalPath, backupPath, retainedDatabases }))
  })

  it("starts with an answer-free private source identity and a bounded empty prefix", () => {
    expect(snapshot()).toMatchObject({ format: "coach-house-suppression-capture-v1", sourceId,
      historyRequiresReconciliation: true, highWater: 0, events: [] })
    for (const role of ["anon", "authenticated", "service_role"]) {
      const denied = run("psql", ["-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-d", sourceUrl,
        "-c", `set role ${role}; select public.read_organization_suppression_events();`])
      expect(denied.status).not.toBe(0)
    }
    const result = collect()
    expect(result.status, result.stderr).toBe(0)
    expect(JSON.parse(result.stdout)).toMatchObject({ captureComplete: false, releaseQualified: false })
    expect(journalRows()).toEqual([])
  })

  it("rolls capture back with its canonical transaction without leaving a cursor gap", () => {
    const before = snapshot()
    expect(sql("begin; select public.fixture_closure('request',600,0); select public.read_organization_suppression_events()->>'highWater'; rollback;").split("\n").at(-1)).toBe("1")
    expect(snapshot()).toEqual(before)
    expect(sql("select count(*) from public.organization_closures")).toBe("0")
  })

  it("retains one opaque deletion event without answers, corrections or actor identity", () => {
    sql("select public.fixture_form_command('correct',1,jsonb_build_object('hash',repeat('c',64),'answers',jsonb_build_array(jsonb_build_object('questionId',public.fixture_form_id(90),'value','Private suppression sentinel'))));")
    const deletion = `select public.organization_form_intake(public.fixture_form_id(1),jsonb_build_object(
      'action','delete_response','versionId',public.fixture_form_id(80),'id',public.fixture_form_id(91),
      'expectedRevision',2,'operationId',public.fixture_form_id(500)))`
    const receipt = sql(deletion)
    expect(sql(deletion)).toBe(receipt)
    expect(sql("select count(*) from public.organization_form_responses; select count(*) from public.organization_form_corrections").split("\n")).toEqual(["0", "0"])
    const captured = snapshot()
    expect(captured.highWater).toBe(1)
    expect(captured.events).toHaveLength(1)
    expect(captured.events[0]).toMatchObject({ sequence: 1, kind: "response_deleted", organizationId: id(1),
      operationId: id(500), revision: 2, response: { formId: id(20), versionId: id(80), responseId: id(91) } })
    expect(Object.keys(captured.events[0]).sort()).toEqual([
      "eventId", "kind", "occurredAt", "operationId", "organizationId", "response", "revision", "sequence",
    ])
    expect(Object.keys(captured.events[0].response!).sort()).toEqual(["formId", "responseId", "submittedAt", "versionId"])
    expect(JSON.stringify(captured)).not.toMatch(/Private suppression sentinel|Joan|actor|answers|original_hash/)
    const result = collect()
    expect(result.status, result.stderr).toBe(0)
  })

  it("retains request and cancellation with the original window and retries collection exactly", () => {
    const requested = JSON.parse(sql("select public.fixture_closure('request',600,0)"))
    sql("select public.fixture_closure('cancel',601,1)")
    const captured = snapshot()
    expect(captured.highWater).toBe(3)
    expect(captured.events.map((event) => event.kind)).toEqual(["response_deleted", "closure_request", "closure_cancel"])
    expect(captured.events[1]).toMatchObject({ revision: 1, operationId: id(600), request: { requestId: id(600) } })
    expect(captured.events[2]).toMatchObject({ revision: 2, operationId: id(601) })
    expect(new Date(captured.events[1].request!.requestedAt).getTime()).toBe(new Date(requested.requestedAt).getTime())
    expect(new Date(captured.events[1].request!.exportUntil).getTime()).toBe(new Date(requested.exportUntil).getTime())
    expect(sql("select count(*) from public.workspace_page_image_grants where org_id=public.fixture_form_id(1)")).toBe("0")
    expect(sql("select count(*) from public.workspace_page_image_grants where org_id=public.fixture_form_id(2)")).toBe("1")
    for (let retry = 0; retry < 2; retry++) {
      const result = collect()
      expect(result.status, result.stderr).toBe(0)
      expect(JSON.parse(result.stdout)).toMatchObject({ captured: retry === 0 ? 2 : 0, retained: 3,
        captureComplete: false, releaseQualified: false })
    }
    expect(journalRows().map((row) => JSON.parse(row[2]))).toEqual(captured.events)
  })

  it("rejects contending capture/export retryably, then retains every committed event without gaps", async () => {
    const releaseReader = await hold("select public.read_organization_suppression_events()")
    try {
      const denied = await query("\\set VERBOSITY verbose\nselect public.fixture_closure('request',602,2);")
      expect(denied.code).not.toBe(0)
      expect(denied.stderr).toContain("40001")
      expect(denied.stderr).toContain("Suppression capture busy; retry transaction")
      expect(sql("select state from public.organization_closures where org_id=public.fixture_form_id(1)")).toBe("active")
    } finally {
      await releaseReader()
    }
    const releaseWriter = await hold("select public.fixture_closure('request',602,2)")
    try {
      const denied = await query("\\set VERBOSITY verbose\nselect public.read_organization_suppression_events();")
      expect(denied.code).not.toBe(0)
      expect(denied.stderr).toContain("40001")
      expect(denied.stderr).toContain("Suppression capture busy; retry transaction")
      const failedCapture = collect()
      expect(failedCapture.status).not.toBe(0)
      expect(journalRows()).toHaveLength(3)
    } finally {
      await releaseWriter()
    }
    const finished = await query("select public.fixture_closure('request',603,0,2,2);")
    expect(finished.code, finished.stderr).toBe(0)
    const captured = snapshot()
    expect(captured.highWater).toBe(5)
    expect(captured.events.map((event) => event.sequence)).toEqual([1, 2, 3, 4, 5])
    expect(captured.events.slice(-2).map((event) => event.organizationId)).toEqual([id(1), id(2)])
    const result = collect()
    expect(result.status, result.stderr).toBe(0)
    expect(journalRows().map((row) => JSON.parse(row[2]))).toEqual(captured.events)
  })

  it("rejects disabled capture hooks, replica sessions and journal mutation", () => {
    const before = snapshot()
    for (const text of [
      "set session_replication_role=replica; select public.read_organization_suppression_events();",
      "begin; alter table public.organization_closure_operations disable trigger organization_closure_suppression_capture; select public.read_organization_suppression_events();",
      "update public.organization_suppression_events set revision=revision+1 where sequence=1;",
      "delete from public.organization_suppression_events where sequence=1;",
      "truncate public.organization_suppression_events;",
    ]) {
      const denied = run("psql", ["-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-d", sourceUrl, "-c", text])
      expect(denied.status).not.toBe(0)
    }
    expect(snapshot()).toEqual(before)
  })

  it("rejects wrong lineage and conflicting retained payloads without changing the journal", () => {
    const before = journalRows()
    const wrongSource = collect(sourceUrl, journalPath, id(999))
    expect(wrongSource.status).not.toBe(0)
    expect(wrongSource.stderr).toContain("Source identity mismatch")
    expect(journalRows()).toEqual(before)
    const conflictPath = join(directory, "conflicting.sqlite")
    copyFileSync(journalPath, conflictPath)
    command("python3", ["-c", "import sqlite3,sys; c=sqlite3.connect(sys.argv[1]); c.execute(\"update suppression_events set payload='{}' where sequence=1\"); c.commit()", conflictPath])
    const conflicting = journalRows(conflictPath)
    const rejected = collect(sourceUrl, conflictPath)
    expect(rejected.status).not.toBe(0)
    expect(rejected.stderr).toContain("Suppression history conflict; retained journal unchanged")
    expect(journalRows(conflictPath)).toEqual(conflicting)
    expect(journalRows()).toEqual(before)
  })

  it("retains independently collected history when an older source backup has no captured events", () => {
    const before = journalRows()
    const older = new URL(sourceUrl)
    const name = `workspace_sharing_fixture_suppression_old_${process.pid}_${Date.now()}`
    older.pathname = `/${name}`
    command("createdb", ["--maintenance-db", templateUrl!, name]); retainedDatabases.push(name)
    // This isolated synthetic source tests capture divergence. No application is
    // configured to connect; this is not a production restore/reopening procedure.
    command("psql", ["-X", "-q", "-v", "ON_ERROR_STOP=1", "-d", older.toString()], readFileSync(backupPath, "utf8"))
    try {
      expect(sql("select public.read_organization_suppression_events()->>'highWater'", older.toString())).toBe("0")
      const rejected = collect(older.toString())
      expect(rejected.status).not.toBe(0)
      expect(rejected.stderr).toContain("Source history regressed; retained journal unchanged")
      expect(journalRows()).toEqual(before)
      expect(before).toHaveLength(5)
    } finally {
      sql(`alter database "${name}" allow_connections false`, templateUrl!)
    }
    const denied = run("psql", ["-X", "-qAt", "-d", older.toString(), "-c", "select 1"])
    expect(denied.status).not.toBe(0)
    expect(denied.stderr).toContain("not currently accepting connections")
  })
})
