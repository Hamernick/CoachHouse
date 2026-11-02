import { createHash } from "node:crypto"
import { spawn, spawnSync } from "node:child_process"
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

const sourceUrl = process.env.ORGANIZATION_CLOSURE_RESTORE_TEST_DATABASE_URL
const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const literal = (value: string) => `'${value.replaceAll("'", "''")}'`
const digest = (value: string) => createHash("sha256").update(value).digest("hex")
const env = { ...process.env, PGOPTIONS: "-c coach_house.workspace_sharing_fixture=isolated-test-only -c timezone=UTC" }

function command(program: string, args: string[], input?: string) {
  const result = spawnSync(program, args, { env, input, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 })
  expect(result.status, result.stderr).toBe(0)
  return result.stdout.trim()
}

// One already-admitted operator session performs import and replay. ALLOW_CONNECTIONS
// is disabled before importing the older data and is never re-enabled by this test.
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
      if (pending) throw new Error("Operator queries must be sequential")
      return new Promise((resolve, reject) => {
        const marker = `__RESTORE_DONE_${++counter}__`
        pending = { marker, resolve, reject }
        child.stdin.write(`${sql}\n\\echo ${marker}\n`)
      })
    },
  }
}

type Closure = { organizationId: string; requestId: string; revision: number; requestedAt: string; exportUntil: string }
type Manifest = { format: string; sourceId: string; closures: Closure[] }
let operator: ReturnType<typeof operatorSession>
let manifest: Manifest
let evidencePath: string
let targetName: string
let beforeProfiles: string
const replay = (text: string, hash = digest(text)) =>
  `select public.replay_organization_closure_suppression(${literal(text)},${literal(hash)});`
const state = `select jsonb_build_object(
  'public',cardinality(public.filter_public_organization_ids(array[public.fixture_form_id(1),public.fixture_form_id(2)])),
  'closures',(select jsonb_agg(to_jsonb(c) order by org_id) from public.organization_closures c),
  'grants',(select count(*) from public.workspace_page_image_grants where org_id=public.fixture_form_id(1)),
  'otherGrants',(select count(*) from public.workspace_page_image_grants where org_id=public.fixture_form_id(2)),
  'profiles',(select jsonb_agg(to_jsonb(p) order by id) from public.profiles p),
  'quarantined',(select not datallowconn from pg_database where datname=current_database()));`

async function denied(sql: string, expectedCode = "22023") {
  const result = await operator.query(`do $test$ begin
    begin ${sql} raise exception 'Unexpected successful replay' using errcode='P0002';
    exception when others then if sqlstate<>${literal(expectedCode)} then raise; end if;
    raise notice 'Rejected as required: %',sqlerrm; end;
  end $test$;`)
  expect(result).toBe("")
}

describe.skipIf(!sourceUrl).sequential("isolated organization closure backup restore", () => {
  beforeAll(async () => {
    const source = new URL(sourceUrl!)
    if (!["localhost", "127.0.0.1", "[::1]"].includes(source.hostname)
      || !/^\/workspace_sharing_fixture_[a-z0-9_]+$/.test(source.pathname) || source.password)
      throw new Error("Only an explicitly provisioned disposable local fixture is allowed")
    command("psql", ["-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-d", sourceUrl!, "-c",
      "select public.fixture_closure_storage(); update public.organizations set is_public=true,is_public_roadmap=true;"])
    const directory = mkdtempSync(join(tmpdir(), "ch-closure-restore-"))
    const backupPath = join(directory, "before-closure.sql")
    command("pg_dump", ["--format=plain", "--file", backupPath, "--dbname", sourceUrl!])
    // This evidence is acquired after the dump and stored outside it. This is a
    // local rehearsal, not proof of durable independent capture or completeness.
    const closing = JSON.parse(command("psql", ["-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-d", sourceUrl!, "-c",
      "select public.fixture_closure('request',600,0)"]))
    delete closing.state
    const sourceId = command("psql", ["-X", "-qAt", "-d", sourceUrl!, "-c", "select source_id from public.organization_restore_identity"])
    manifest = { format: "coach-house-closure-suppression-v1", sourceId, closures: [closing] }
    evidencePath = join(directory, "post-backup-suppression.json")
    writeFileSync(evidencePath, JSON.stringify(manifest))
    targetName = `workspace_sharing_fixture_restore_${process.pid}_${Date.now()}`
    const target = new URL(source); target.pathname = `/${targetName}`
    command("createdb", ["--maintenance-db", sourceUrl!, targetName])
    operator = operatorSession(target.toString())
    await operator.query("select 1;")
    command("psql", ["-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-d", sourceUrl!, "-c",
      `alter database "${targetName}" allow_connections false;`])
    const refused = spawnSync("psql", ["-X", "-qAt", "-d", target.toString(), "-c", "select 1"], { env, encoding: "utf8" })
    expect(refused.status).not.toBe(0)
    expect(refused.stderr).toContain("not currently accepting connections")
    await operator.query(readFileSync(backupPath, "utf8"))
    const restored = JSON.parse(await operator.query(state))
    expect(restored).toMatchObject({ public: 2, closures: null, grants: 1, otherGrants: 1, quarantined: true })
    beforeProfiles = JSON.stringify(restored.profiles)
    writeFileSync(join(directory, "target.json"), JSON.stringify({ target: target.toString(), backupPath, evidencePath }))
  }, 30_000)

  afterAll(() => { operator?.child.stdin.end("\\q\n") })

  it("replays a post-backup closure without reopening, extending retention or changing other organizations", async () => {
    expect(JSON.parse(await operator.query(replay(readFileSync(evidencePath, "utf8"))))).toMatchObject({
      quarantined: true, applied: 1, exact: 0, releaseQualified: false,
    })
    const after = JSON.parse(await operator.query(state))
    expect(after).toMatchObject({ public: 1, grants: 0, otherGrants: 1, quarantined: true })
    expect(JSON.stringify(after.profiles)).toBe(beforeProfiles)
    expect(after.closures).toHaveLength(1)
    expect(after.closures[0]).toMatchObject({ org_id: id(1), state: "closing", revision: 1, request_id: id(600) })
    expect(new Date(after.closures[0].requested_at).getTime()).toBe(new Date(manifest.closures[0].requestedAt).getTime())
    expect(new Date(after.closures[0].export_until).getTime()).toBe(new Date(manifest.closures[0].exportUntil).getTime())
    await denied("perform public.guard_organization_closure(public.fixture_form_id(1));", "42501")
    expect(JSON.parse(await operator.query(replay(readFileSync(evidencePath, "utf8"))))).toMatchObject({
      quarantined: true, applied: 0, exact: 1, releaseQualified: false,
    })
    expect(JSON.parse(await operator.query(state))).toEqual(after)
    const acl = await operator.query("select has_function_privilege('service_role','public.replay_organization_closure_suppression(text,text)','execute');")
    expect(acl).toBe("f")
  })

  it("rejects missing, mismatched and malformed evidence without changing restored state", async () => {
    const before = await operator.query(state)
    const invalid = ["null", "{}", JSON.stringify({ ...manifest, sourceId: id(999) }),
      JSON.stringify({ ...manifest, closures: [] }), JSON.stringify({ ...manifest, closures: [...manifest.closures, ...manifest.closures] }),
      JSON.stringify({ ...manifest, closures: [{ ...manifest.closures[0], state: "active" }] })]
    for (const text of invalid) await denied(`perform public.replay_organization_closure_suppression(${literal(text)},${literal(digest(text))});`)
    await denied(`perform public.replay_organization_closure_suppression(${literal(JSON.stringify(manifest))},${literal("0".repeat(64))});`)
    expect(await operator.query(state)).toBe(before)
  })

  it("rolls back all effects if a suppression batch contains an unknown organization", async () => {
    const before = await operator.query(state)
    const text = JSON.stringify({ ...manifest, closures: [
      { ...manifest.closures[0], organizationId: id(2), requestId: id(602) },
      { ...manifest.closures[0], organizationId: id(999), requestId: id(603) },
    ] })
    await denied(`perform public.replay_organization_closure_suppression(${literal(text)},${literal(digest(text))});`)
    expect(await operator.query(state)).toBe(before)
  })

  it("rejects replication restore mode and disabled shutdown triggers", async () => {
    const before = await operator.query(state)
    const text = JSON.stringify(manifest)
    const call = `perform public.replay_organization_closure_suppression(${literal(text)},${literal(digest(text))});`
    await operator.query("set session_replication_role=replica;")
    await denied(call, "42501")
    await operator.query("set session_replication_role=origin;")
    await operator.query("alter table public.organization_closures disable trigger organization_closure_publication;")
    await denied(call, "42501")
    await operator.query("alter table public.organization_closures enable trigger organization_closure_publication;")
    await operator.query("begin; drop trigger organization_closure_publication on public.organization_closures;")
    await denied(call, "42501")
    await operator.query("rollback;")
    expect(await operator.query(state)).toBe(before)
  })

  it("retains an already-expired original deadline and denies export immediately", async () => {
    const before = await operator.query(state)
    const day = 24 * 60 * 60 * 1000, now = Date.now()
    const expired = { organizationId: id(2), requestId: id(604), revision: 1,
      requestedAt: new Date(now - 31 * day).toISOString(), exportUntil: new Date(now - day).toISOString() }
    await operator.query("begin;")
    const result = JSON.parse(await operator.query(replay(JSON.stringify({ ...manifest, closures: [expired] }))))
    expect(result).toMatchObject({ applied: 1, quarantined: true, releaseQualified: false })
    await denied("perform public.guard_organization_closure(public.fixture_form_id(2),true);", "42501")
    const deadline = await operator.query("select export_until from public.organization_closures where org_id=public.fixture_form_id(2);")
    expect(new Date(deadline).getTime()).toBe(new Date(expired.exportUntil).getTime())
    await operator.query("rollback;")
    expect(await operator.query(state)).toBe(before)
  })

  it("cancellation never restores publication or grants and stale closure replay cannot reverse it", async () => {
    await operator.query("select public.fixture_closure('cancel',601,1);")
    const canceled = JSON.parse(await operator.query(state))
    expect(canceled).toMatchObject({ public: 1, grants: 0, otherGrants: 1, quarantined: true })
    expect(canceled.closures[0]).toMatchObject({ state: "active", revision: 2, request_id: null })
    const text = JSON.stringify(manifest)
    await denied(`perform public.replay_organization_closure_suppression(${literal(text)},${literal(digest(text))});`, "40001")
    expect(JSON.parse(await operator.query(state))).toEqual(canceled)
  })
})
