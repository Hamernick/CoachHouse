import { createHash } from "node:crypto"
import { spawn, spawnSync } from "node:child_process"
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

const templateUrl = process.env.ORGANIZATION_SUPPRESSION_REPLAY_TEST_DATABASE_URL
const collector = "docs/agent/organization-suppression-capture.py"
const migration = "supabase/migrations/20261103100000_organization_suppression_history_replay.sql"
const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const literal = (value: string) => `'${value.replaceAll("'", "''")}'`
const digest = (value: string) => createHash("sha256").update(value).digest("hex")
const env = { ...process.env, PGOPTIONS: "-c statement_timeout=5000 -c coach_house.workspace_sharing_fixture=isolated-test-only -c timezone=UTC" }
function command(program: string, args: string[], input?: string) {
  const result = spawnSync(program, args, { env, input, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 })
  expect(result.status, result.stderr).toBe(0)
  return result.stdout.trim()
}
function operatorSession(url: string) {
  const child = spawn("psql", ["-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-d", url], { env })
  let stdout = "", stderr = "", counter = 0
  let pending: { marker: string; resolve: (text: string) => void; reject: (error: Error) => void } | undefined
  child.stdout.on("data", (chunk) => {
    stdout += chunk.toString()
    if (pending && stdout.includes(pending.marker)) {
      const result = stdout.slice(0, stdout.indexOf(pending.marker)).trim()
      stdout = stdout.slice(stdout.indexOf(pending.marker) + pending.marker.length)
      const done = pending; pending = undefined; done.resolve(result)
    }
  })
  child.stderr.on("data", (chunk) => { stderr += chunk.toString() })
  child.on("error", (error) => { pending?.reject(error); pending = undefined })
  child.on("close", (code) => { pending?.reject(new Error(`Operator exited ${code}: ${stderr}`)); pending = undefined })
  return {
    child,
    query(sql: string): Promise<string> {
      if (child.exitCode !== null) throw new Error(`Operator already exited: ${stderr}`)
      if (pending) throw new Error("Operator queries must be sequential")
      return new Promise((resolve, reject) => {
        const marker = `__RESTORE_DONE_${++counter}__`
        pending = { marker, resolve, reject }
        child.stdin.write(`${sql}\n\\echo ${marker}\n`)
      })
    },
  }
}

type Event = {
  sequence: number; eventId: string; kind: string; organizationId: string; operationId: string
  revision: number; occurredAt: string
  request?: { requestId: string; requestedAt: string; exportUntil: string }
  response?: { formId: string; versionId: string; responseId: string; submittedAt: string }
}
type Manifest = { format: string; sourceId: string; capturedSince: string; historyRequiresReconciliation: boolean; highWater: number; events: Event[] }
type Operator = ReturnType<typeof operatorSession>
const operators: Operator[] = []
const targets: string[] = []
let operator: Operator, middle: Operator, current: Operator
let sourceUrl: string, manifest: Manifest, manifestText: string, directory: string, journalPath: string, manifestPath: string
let beforeProfiles: string
const replay = (text: string, hash = digest(text)) =>
  `select public.replay_organization_suppression_history(${literal(text)},${literal(hash)});`
const prefix = (count: number) => JSON.stringify({ ...manifest, highWater: count, events: manifest.events.slice(0, count) })
const state = `select jsonb_build_object(
  'public',cardinality(public.filter_public_organization_ids(array[public.fixture_form_id(1),public.fixture_form_id(2)])),
  'closures',(select jsonb_agg(to_jsonb(c) order by org_id) from public.organization_closures c),
  'responses',(select jsonb_agg(to_jsonb(r) order by id) from public.organization_form_responses r),
  'corrections',(select count(*) from public.organization_form_corrections),
  'deletions',(select jsonb_agg(to_jsonb(d) order by response_id) from public.organization_form_response_deletions d),
  'grants',(select count(*) from public.workspace_page_image_grants where org_id=public.fixture_form_id(1)),
  'otherGrants',(select count(*) from public.workspace_page_image_grants where org_id=public.fixture_form_id(2)),
  'profiles',(select jsonb_agg(to_jsonb(p) order by id) from public.profiles p),
  'capture',public.read_organization_suppression_events(),
  'contexts',(select count(*) from public.organization_suppression_replay_context),
  'quarantined',(select not datallowconn from pg_database where datname=current_database()));`
function sql(text: string) {
  return command("psql", ["-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-d", sourceUrl], text)
}
async function denied(statement: string, codes = ["22023", "40001"], target = operator) {
  expect(await target.query(`do $test$ begin
    begin ${statement} raise exception 'Unexpected successful replay' using errcode='P9999';
    exception when others then if sqlstate not in (${codes.map(literal).join(",")}) then raise; end if; end;
  end $test$;`)).toBe("")
}
async function restore(path: string) {
  const name = `workspace_sharing_fixture_history_target_${process.pid}_${targets.length}`
  const url = new URL(sourceUrl); url.pathname = `/${name}`
  command("createdb", ["--maintenance-db", sourceUrl, name])
  targets.push(name)
  const target = operatorSession(url.toString()); operators.push(target)
  await target.query("select 1;")
  sql(`alter database "${name}" allow_connections false;`)
  const refused = spawnSync("psql", ["-X", "-qAt", "-d", url.toString(), "-c", "select 1"], { env, encoding: "utf8" })
  expect(refused.status).not.toBe(0)
  expect(refused.stderr).toContain("not currently accepting connections")
  await target.query(readFileSync(path, "utf8"))
  return target
}

describe.skipIf(!templateUrl).sequential("captured organization suppression history replay", () => {
  beforeAll(async () => {
    const template = new URL(templateUrl!)
    if (!["localhost", "127.0.0.1", "[::1]"].includes(template.hostname)
      || !/^\/workspace_sharing_fixture_[a-z0-9_]+$/.test(template.pathname) || template.password)
      throw new Error("Only an explicitly provisioned disposable local fixture is allowed")
    directory = mkdtempSync(join(tmpdir(), "ch-suppression-replay-"))
    const initialDump = join(directory, "template.sql")
    command("pg_dump", ["--format=plain", "--file", initialDump, "--dbname", templateUrl!])
    const name = `workspace_sharing_fixture_history_${process.pid}_${Date.now()}`
    const source = new URL(template); source.pathname = `/${name}`; sourceUrl = source.toString()
    command("createdb", ["--maintenance-db", templateUrl!, name])
    command("psql", ["-X", "-q", "-v", "ON_ERROR_STOP=1", "-d", sourceUrl], readFileSync(initialDump, "utf8"))
    sql("select public.fixture_closure_storage(); update public.organizations set is_public=true,is_public_roadmap=true;")
    for (const file of ["supabase/migrations/20261103090000_organization_suppression_capture.sql", migration,
      "supabase/migrations/20261103110000_organization_form_invitation_suppression.sql"])
      command("psql", ["-X", "-q", "-v", "ON_ERROR_STOP=1", "-d", sourceUrl], readFileSync(file, "utf8"))
    sql("select public.fixture_form_command('correct',1,jsonb_build_object('hash',repeat('c',64),'answers',jsonb_build_array(jsonb_build_object('questionId',public.fixture_form_id(90),'value','Private restore sentinel'))));")
    const beforePath = join(directory, "before-events.sql")
    command("pg_dump", ["--format=plain", "--file", beforePath, "--dbname", sourceUrl])
    sql("select public.fixture_form_command('correct',1,jsonb_build_object('expectedRevision',2,'operationId',public.fixture_form_id(93),'hash',repeat('d',64),'answers',jsonb_build_array(jsonb_build_object('questionId',public.fixture_form_id(90),'value','Post-backup private sentinel'))));")
    sql(`select public.organization_form_intake(public.fixture_form_id(1),jsonb_build_object(
      'action','delete_response','versionId',public.fixture_form_id(80),'id',public.fixture_form_id(91),
      'expectedRevision',3,'operationId',public.fixture_form_id(500)))`)
    sql("select public.fixture_closure('request',600,0)")
    const middlePath = join(directory, "before-cancel.sql")
    command("pg_dump", ["--format=plain", "--file", middlePath, "--dbname", sourceUrl])
    sql("select public.fixture_closure('cancel',601,1)")
    const currentPath = join(directory, "current.sql")
    command("pg_dump", ["--format=plain", "--file", currentPath, "--dbname", sourceUrl])
    const sourceId = sql("select source_id from public.organization_restore_identity")
    journalPath = join(directory, "suppression.sqlite"); manifestPath = join(directory, "manifest.json")
    const collected = JSON.parse(command("python3", [collector, "--source", sourceUrl, "--journal", journalPath, "--expected-source-id", sourceId]))
    expect(collected).toMatchObject({ captured: 3, retained: 3, captureComplete: false, releaseQualified: false })
    const exported = JSON.parse(command("python3", [collector, "--journal", journalPath, "--expected-source-id", sourceId, "--export", manifestPath, "--expected-sha256", collected.sha256]))
    manifestText = readFileSync(manifestPath, "utf8"); manifest = JSON.parse(manifestText)
    expect(exported).toMatchObject({ exported: 3, sha256: digest(manifestText), captureComplete: false, releaseQualified: false })
    expect(manifest.events.map((event) => event.kind)).toEqual(["response_deleted", "closure_request", "closure_cancel"])
    expect(manifestText).not.toMatch(/Private restore sentinel|Joan|answers|actor/)
    operator = await restore(beforePath); middle = await restore(middlePath); current = await restore(currentPath)
    const before = JSON.parse(await operator.query(state))
    expect(before).toMatchObject({ public: 2, corrections: 1, grants: 1, otherGrants: 1, capture: { highWater: 0 }, contexts: 0, quarantined: true })
    expect(before.responses).toHaveLength(1)
    beforeProfiles = JSON.stringify(before.profiles)
    writeFileSync(join(directory, "fixtures.json"), JSON.stringify({ sourceUrl, targets, journalPath, manifestPath, beforePath, middlePath, currentPath }))
  }, 30_000)

  afterAll(async () => {
    await Promise.all(operators.map((target) => new Promise<void>((resolve) => {
      if (target.child.exitCode !== null) { resolve(); return }
      target.child.once("close", () => resolve()); target.child.stdin.end("\\q\n")
    })))
  })

  it("refuses API roles and a target that still accepts connections", async () => {
    for (const role of ["anon", "authenticated", "service_role"]) {
      expect(sql(`select has_function_privilege('${role}','public.replay_organization_suppression_history(text,text)','execute')`)).toBe("f")
      expect(sql(`select has_table_privilege('${role}','public.organization_suppression_replay_context','select')`)).toBe("f")
    }
    const result = spawnSync("psql", ["-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-d", sourceUrl, "-c", replay(manifestText)], { env, encoding: "utf8" })
    expect(result.status).not.toBe(0)
    expect(result.stderr).toMatch(/offline|Isolated/i)
  })

  it("exports only pinned intact journal bytes and refuses overwrite or a missing suffix", () => {
    const invoke = (path: string, hash: string, journal = journalPath) => spawnSync("python3", [collector,
      "--journal", journal, "--expected-source-id", manifest.sourceId, "--export", path, "--expected-sha256", hash],
      { env, encoding: "utf8" })
    const original = readFileSync(manifestPath, "utf8")
    expect(invoke(manifestPath, digest(manifestText)).status).not.toBe(0)
    expect(readFileSync(manifestPath, "utf8")).toBe(original)
    const wrongPin = invoke(join(directory, "wrong-pin.json"), "0".repeat(64))
    expect(wrongPin.status).not.toBe(0)
    expect(wrongPin.stderr).toContain("Journal differs from the pinned capture receipt")
    const damaged = join(directory, "truncated.sqlite")
    command("python3", ["-c", "import os,shutil,sqlite3,sys; shutil.copyfile(sys.argv[1],sys.argv[2]); os.chmod(sys.argv[2],0o600); c=sqlite3.connect(sys.argv[2]); c.execute('delete from suppression_events where sequence=3'); c.commit()", journalPath, damaged])
    const truncated = invoke(join(directory, "truncated.json"), digest(manifestText), damaged)
    expect(truncated.status).not.toBe(0)
    expect(truncated.stderr).toContain("Journal differs from the pinned capture receipt")
  })

  it("refuses a restored response newer than the captured deletion without partial erasure", async () => {
    await operator.query("begin; update public.organization_form_responses set revision=4;")
    const before = await operator.query(state)
    await denied(`perform public.replay_organization_suppression_history(${literal(manifestText)},${literal(digest(manifestText))});`, ["40001"])
    expect(await operator.query(state)).toBe(before)
    await operator.query("rollback;")
  })

  it("replays deletion alone and rejects submission resurrection while public intake is otherwise available", async () => {
    await operator.query("begin;")
    expect(JSON.parse(await operator.query(replay(prefix(1))))).toMatchObject({ applied: 1, exact: 0, highWater: 1, quarantined: true, releaseQualified: false })
    const after = JSON.parse(await operator.query(state))
    expect(after).toMatchObject({ public: 2, responses: null, corrections: 0, grants: 1, otherGrants: 1, capture: { highWater: 1 } })
    expect(after.deletions[0]).toMatchObject({ response_id: id(91), operation_id: id(500), actor_id: null, response_revision: 3 })
    await denied("perform public.fixture_form_command('submit');", ["P0002"])
    await operator.query("rollback;")
  })

  it("preserves the original closure deadline before replaying cancellation", async () => {
    await operator.query("begin;")
    expect(JSON.parse(await operator.query(replay(prefix(2))))).toMatchObject({ applied: 2, highWater: 2 })
    const after = JSON.parse(await operator.query(state))
    expect(after).toMatchObject({ public: 1, responses: null, grants: 0, otherGrants: 1 })
    expect(after.closures[0]).toMatchObject({ state: "closing", revision: 1, request_id: id(600) })
    expect(new Date(after.closures[0].requested_at).getTime()).toBe(new Date(manifest.events[1].request!.requestedAt).getTime())
    expect(new Date(after.closures[0].export_until).getTime()).toBe(new Date(manifest.events[1].request!.exportUntil).getTime())
    await operator.query("rollback;")
  })

  it("replays a historically valid cancellation after its original export window has expired", async () => {
    const shift = (time: string) => new Date(new Date(time).getTime() - 31 * 24 * 60 * 60 * 1000).toISOString()
      .replace(/(\.\d*?)0+Z$/, "$1Z").replace(".Z", "Z").replace("Z", "+00:00")
    const aged: Manifest = { ...manifest, capturedSince: shift(manifest.capturedSince), events: manifest.events.map((event) => ({
      ...event, occurredAt: shift(event.occurredAt),
      ...(event.request ? { request: { ...event.request, requestedAt: shift(event.request.requestedAt), exportUntil: shift(event.request.exportUntil) } } : {}),
      ...(event.response ? { response: { ...event.response, submittedAt: shift(event.response.submittedAt) } } : {}),
    })) }
    await operator.query(`begin; update public.organization_suppression_capture_state set captured_since=${literal(aged.capturedSince)};
      update public.organization_form_responses set submitted_at=${literal(aged.events[0].response!.submittedAt)};`)
    expect(JSON.parse(await operator.query(replay(JSON.stringify(aged))))).toMatchObject({ applied: 3, highWater: 3, releaseQualified: false })
    const after = JSON.parse(await operator.query(state))
    expect(after).toMatchObject({ public: 1, responses: null, grants: 0, otherGrants: 1 })
    expect(after.closures[0]).toMatchObject({ state: "active", revision: 2 })
    await operator.query("rollback;")
  })

  it("retains a deletion tombstone even when the response did not exist in the backup", async () => {
    await operator.query("begin; delete from public.organization_form_responses;")
    expect(JSON.parse(await operator.query(replay(prefix(1))))).toMatchObject({ applied: 1, highWater: 1 })
    await denied("perform public.fixture_form_command('submit');", ["P0002"])
    expect(JSON.parse(await operator.query(state))).toMatchObject({ responses: null, corrections: 0, capture: { highWater: 1 } })
    await operator.query("rollback;")
  })

  it("rejects invalid evidence and rolls back earlier deletions when a later event conflicts", async () => {
    const before = await operator.query(state)
    const invalid = ["null", "{}", JSON.stringify({ ...manifest, sourceId: id(999) }),
      JSON.stringify({ ...manifest, capturedSince: "2020-01-01T00:00:00Z" }),
      JSON.stringify({ ...manifest, events: [manifest.events[0], { ...manifest.events[1], organizationId: id(999) }, manifest.events[2]] }),
      JSON.stringify({ ...manifest, events: [{ ...manifest.events[0], sequence: 2 }, ...manifest.events.slice(1)] }),
      JSON.stringify({ ...manifest, highWater: 1, events: [{ ...manifest.events[2], sequence: 1 }] })]
    for (const text of invalid) await denied(`perform public.replay_organization_suppression_history(${literal(text)},${literal(digest(text))});`)
    await denied(`perform public.replay_organization_suppression_history(${literal(manifestText)},${literal("0".repeat(64))});`, ["22023"])
    expect(await operator.query(state)).toBe(before)
  })

  it("rejects replica mode and disabled shutdown or capture hooks", async () => {
    const before = await operator.query(state)
    const call = `perform public.replay_organization_suppression_history(${literal(manifestText)},${literal(digest(manifestText))});`
    await operator.query("set session_replication_role=replica;")
    await denied(call, ["42501"])
    await operator.query("set session_replication_role=origin;")
    for (const [table, trigger] of [["organization_closures", "organization_closure_publication"],
      ["organization_form_response_deletions", "organization_response_suppression_capture"]]) {
      await operator.query(`begin; alter table public.${table} disable trigger ${trigger};`)
      await denied(call, ["42501"])
      await operator.query("rollback;")
    }
    expect(await operator.query(state)).toBe(before)
  })

  it("replays the retained full history without restoring publication, grants or deleted content", async () => {
    expect(JSON.parse(await operator.query(replay(manifestText)))).toMatchObject({ applied: 3, exact: 0, highWater: 3, quarantined: true, releaseQualified: false })
    const after = JSON.parse(await operator.query(state))
    expect(after).toMatchObject({ public: 1, responses: null, corrections: 0, grants: 0, otherGrants: 1, capture: { highWater: 3 }, contexts: 0, quarantined: true })
    expect(after.closures[0]).toMatchObject({ state: "active", revision: 2, request_id: null })
    expect(JSON.stringify(after.profiles)).toBe(beforeProfiles)
    expect(after.capture).toEqual(manifest)
    expect(JSON.parse(await operator.query(replay(manifestText)))).toMatchObject({ applied: 0, exact: 3, highWater: 3, releaseQualified: false })
    expect(JSON.parse(await operator.query(state))).toEqual(after)
  })

  it("extends an exact mid-history backup and accepts a current backup without regenerating event IDs", async () => {
    expect(JSON.parse(await middle.query(replay(manifestText)))).toMatchObject({ applied: 1, exact: 2, highWater: 3, releaseQualified: false })
    expect(JSON.parse(await current.query(replay(manifestText)))).toMatchObject({ applied: 0, exact: 3, highWater: 3, releaseQualified: false })
    for (const target of [middle, current]) {
      const after = JSON.parse(await target.query(state))
      expect(after).toMatchObject({ public: 1, responses: null, corrections: 0, grants: 0, otherGrants: 1, capture: manifest, quarantined: true })
      expect(after.closures[0]).toMatchObject({ state: "active", revision: 2 })
    }
  })

  it("refuses an exact event prefix whose deleted response has been restored corruptly", async () => {
    await operator.query(`begin; insert into public.organization_form_responses(version_id,id,original_hash,answers,submitted_at)
      values(public.fixture_form_id(80),public.fixture_form_id(91),repeat('a',64),'[]',${literal(manifest.events[0].response!.submittedAt)});`)
    const before = await operator.query(state)
    await denied(`perform public.replay_organization_suppression_history(${literal(manifestText)},${literal(digest(manifestText))});`, ["40001"])
    expect(await operator.query(state)).toBe(before)
    await operator.query("rollback;")
  })

  it("refuses shorter or conflicting retained prefixes atomically", async () => {
    const before = await operator.query(state)
    await denied(`perform public.replay_organization_suppression_history(${literal(prefix(2))},${literal(digest(prefix(2)))});`, ["40001"])
    const conflict = JSON.stringify({ ...manifest, events: [{ ...manifest.events[0], eventId: id(998) }, ...manifest.events.slice(1)] })
    await denied(`perform public.replay_organization_suppression_history(${literal(conflict)},${literal(digest(conflict))});`, ["40001"])
    expect(await operator.query(state)).toBe(before)
  })
})
