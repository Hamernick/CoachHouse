import { createHash } from "node:crypto"
import { spawn, spawnSync } from "node:child_process"
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

const templateUrl = process.env.ORGANIZATION_FORM_REVOCATION_REPLAY_TEST_DATABASE_URL
const collector = "docs/agent/organization-suppression-capture.py"
const migration = "supabase/migrations/20261103110000_organization_form_invitation_suppression.sql"
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
  invitation: { formId: string; invitationId: string; parentInvitationId: string | null; permission: string; createdAt: string }
}
type Manifest = { format: string; sourceId: string; capturedSince: string; historyRequiresReconciliation: boolean; highWater: number; events: Event[] }
type Operator = ReturnType<typeof operatorSession>
const operators: Operator[] = []
const targets: string[] = []
let operator: Operator, absent: Operator, current: Operator
let sourceUrl: string, manifest: Manifest, manifestText: string, directory: string, journalPath: string, manifestPath: string
let beforeProfiles: string, beforeOther: string
const replay = (text: string, hash = digest(text)) =>
  `select public.replay_organization_suppression_history(${literal(text)},${literal(hash)});`
const state = `select jsonb_build_object(
  'invitations',(select jsonb_agg(to_jsonb(g) order by id) from public.organization_form_viewer_invitations g),
  'profiles',(select jsonb_agg(to_jsonb(p) order by id) from public.profiles p),
  'responses',(select jsonb_agg(to_jsonb(r) order by id) from public.organization_form_responses r),
  'capture',public.read_organization_suppression_events(),
  'contexts',(select count(*) from public.organization_suppression_replay_context),
  'quarantined',(select not datallowconn from pg_database where datname=current_database()));`
function sql(text: string) {
  return command("psql", ["-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-d", sourceUrl], text)
}
async function denied(statement: string, codes = ["22023", "40001", "42501"], target = operator) {
  expect(await target.query(`do $test$ begin
    begin ${statement} raise exception 'Unexpected successful operation' using errcode='P9999';
    exception when others then if sqlstate not in (${codes.map(literal).join(",")}) then raise; end if; end;
  end $test$;`)).toBe("")
}
async function restore(path: string) {
  const name = `workspace_sharing_fixture_revocation_target_${process.pid}_${targets.length}`
  const url = new URL(sourceUrl); url.pathname = `/${name}`
  command("createdb", ["--maintenance-db", sourceUrl, name]); targets.push(name)
  const target = operatorSession(url.toString()); operators.push(target)
  await target.query("select 1;")
  sql(`alter database "${name}" allow_connections false;`)
  const refused = spawnSync("psql", ["-X", "-qAt", "-d", url.toString(), "-c", "select 1"], { env, encoding: "utf8" })
  expect(refused.status).not.toBe(0)
  expect(refused.stderr).toContain("not currently accepting connections")
  await target.query(readFileSync(path, "utf8"))
  return target
}
const fixture = `
select public.fixture_closure_storage();
insert into public.organization_memberships(org_id,member_id,role) values(public.fixture_form_id(1),public.fixture_form_id(4),'staff') on conflict(org_id,member_id) do update set role='staff';
update public.organization_workspace_boards set state='{}',updated_by=(select intake_manager from public.organization_forms limit 1);
truncate public.organization_forms cascade;
delete from public.organization_workspace_pages;
delete from public.organization_memberships where org_id=public.fixture_form_id(1) and member_id in (select public.fixture_form_id(n) from unnest(array[2,3,5,6,7,8,11,12]) n);
select public.fixture_form_publish(0,'publish',80,4);
select public.fixture_form_command('submit');
create function public.fixture_revoke_access(actor integer,action text,patch jsonb default '{}') returns jsonb language sql as $$
 select public.organization_form_viewer_access(public.fixture_form_id(actor),jsonb_build_object('action',action,'versionId',public.fixture_form_id(80))||patch);
$$;
create function public.fixture_revoke_invite(actor integer,person integer,scope text,op integer) returns jsonb language sql as $$
 select public.fixture_revoke_access(actor,'invite_viewer',jsonb_build_object('email','person'||person||'@example.org','responsePermission',scope,'operationId',public.fixture_form_id(op),'expectedRevision',(select access_revision from public.organization_forms where org_id=public.fixture_form_id(1) and id=public.fixture_form_id(20))));
$$;
create function public.fixture_revoke_accept(actor integer,op integer) returns jsonb language sql as $$
 select public.fixture_revoke_access(actor,'accept_viewer',jsonb_build_object('invitationId',public.fixture_form_id(op)));
$$;
select public.fixture_revoke_invite(4,2,'manage',800); select public.fixture_revoke_accept(2,800);
select public.fixture_revoke_invite(2,3,'edit',801); select public.fixture_revoke_accept(3,801);
select public.fixture_revoke_invite(4,5,'view',802); select public.fixture_revoke_accept(5,802);
select public.fixture_revoke_invite(2,6,'edit',803); select public.fixture_revoke_accept(6,803);
select public.fixture_revoke_invite(4,6,'edit',804); select public.fixture_revoke_accept(6,804);
select public.fixture_revoke_invite(4,7,'manage',810); select public.fixture_revoke_accept(7,810);
select public.fixture_revoke_invite(7,8,'edit',811); select public.fixture_revoke_accept(8,811);
select public.fixture_revoke_invite(4,11,'manage',830); select public.fixture_revoke_accept(11,830);
select public.fixture_revoke_invite(11,12,'edit',831); select public.fixture_revoke_accept(12,831);
insert into public.organization_forms(org_id,id,intake_manager,creator_id) values(public.fixture_form_id(2),public.fixture_form_id(30),public.fixture_form_id(2),public.fixture_form_id(2));
insert into public.organization_form_viewer_invitations(id,org_id,form_id,email,invited_by,manager_revision,accepted_by,accepted_at,response_permission)
 values(public.fixture_form_id(900),public.fixture_form_id(2),public.fixture_form_id(30),'person3@example.org',public.fixture_form_id(2),1,public.fixture_form_id(3),clock_timestamp(),'edit');
`

describe.skipIf(!templateUrl).sequential("native form invitation revocation recovery", () => {
  beforeAll(async () => {
    const template = new URL(templateUrl!)
    if (!["localhost", "127.0.0.1", "[::1]"].includes(template.hostname)
      || !/^\/workspace_sharing_fixture_[a-z0-9_]+$/.test(template.pathname) || template.password)
      throw new Error("Only an explicitly provisioned disposable local fixture is allowed")
    directory = mkdtempSync(join(tmpdir(), "ch-form-revocation-replay-"))
    const initialDump = join(directory, "template.sql")
    command("pg_dump", ["--format=plain", "--file", initialDump, "--dbname", templateUrl!])
    const name = `workspace_sharing_fixture_revocation_${process.pid}_${Date.now()}`
    const source = new URL(template); source.pathname = `/${name}`; sourceUrl = source.toString()
    command("createdb", ["--maintenance-db", templateUrl!, name])
    command("psql", ["-X", "-q", "-v", "ON_ERROR_STOP=1", "-d", sourceUrl], readFileSync(initialDump, "utf8"))
    command("psql", ["-X", "-q", "-v", "ON_ERROR_STOP=1", "-d", sourceUrl], readFileSync("supabase/migrations/20261103070000_unpublished_form_collaboration.sql", "utf8"))
    sql(fixture)
    for (const file of ["supabase/migrations/20261103090000_organization_suppression_capture.sql",
      "supabase/migrations/20261103100000_organization_suppression_history_replay.sql", migration])
      command("psql", ["-X", "-q", "-v", "ON_ERROR_STOP=1", "-d", sourceUrl], readFileSync(file, "utf8"))
    for (const actor of [2,3,5,6,7,8,11,12]) expect(JSON.parse(sql(`select public.fixture_form_command('responses',${actor})`))).toBeTruthy()
    expect(sql("select public.can_edit_invited_form(public.fixture_form_id(1),public.fixture_form_id(20),public.fixture_form_id(3))")).toBe("t")
    const beforePath = join(directory, "before-revocations.sql")
    command("pg_dump", ["--format=plain", "--file", beforePath, "--dbname", sourceUrl])
    const revision = sql("select access_revision from public.organization_forms where org_id=public.fixture_form_id(1) and id=public.fixture_form_id(20)")
    const revoke = `select public.fixture_revoke_access(4,'revoke_viewer',jsonb_build_object('invitationId',public.fixture_form_id(800),'operationId',public.fixture_form_id(850),'expectedRevision',${revision}));`
    sql("begin; " + revoke + " rollback;")
    expect(sql("select public.read_organization_suppression_events()->>'highWater'")).toBe("0")
    const reply = sql(revoke); expect(sql(revoke)).toBe(reply)
    sql("delete from public.organization_form_viewer_invitations where id=public.fixture_form_id(810);")
    sql("delete from auth.users where id=public.fixture_form_id(11);")
    sql("select public.fixture_revoke_invite(4,13,'view',840); select public.fixture_revoke_accept(13,840);")
    sql("select public.fixture_revoke_access(4,'revoke_viewer',jsonb_build_object('invitationId',public.fixture_form_id(840),'operationId',public.fixture_form_id(851),'expectedRevision',(select access_revision from public.organization_forms where org_id=public.fixture_form_id(1) and id=public.fixture_form_id(20))));")
    const currentPath = join(directory, "after-revocations.sql")
    command("pg_dump", ["--format=plain", "--file", currentPath, "--dbname", sourceUrl])
    const sourceId = sql("select source_id from public.organization_restore_identity")
    journalPath = join(directory, "suppression.sqlite"); manifestPath = join(directory, "manifest.json")
    const collected = JSON.parse(command("python3", [collector, "--source", sourceUrl, "--journal", journalPath, "--expected-source-id", sourceId]))
    const exported = JSON.parse(command("python3", [collector, "--journal", journalPath, "--expected-source-id", sourceId,
      "--expected-sha256", collected.sha256, "--export", manifestPath]))
    manifestText = readFileSync(manifestPath, "utf8"); manifest = JSON.parse(manifestText)
    expect(exported).toMatchObject({ exported: 7, sha256: digest(manifestText), captureComplete: false, releaseQualified: false })
    expect(manifest.events.map((event) => event.kind)).toEqual(Array(7).fill("form_invitation_revoked"))
    expect(manifestText).not.toMatch(/example.org|acceptedBy|invitedBy|actor|answers|Private/)
    operator = await restore(beforePath); absent = await restore(beforePath); current = await restore(currentPath)
    const before = JSON.parse(await operator.query(state))
    expect(before).toMatchObject({ capture: { highWater: 0 }, contexts: 0, quarantined: true })
    beforeProfiles = JSON.stringify(before.profiles)
    beforeOther = JSON.stringify(before.invitations.find((row: {id:string}) => row.id === id(900)))
    writeFileSync(join(directory, "fixtures.json"), JSON.stringify({ sourceUrl, targets, journalPath, manifestPath, beforePath, currentPath }))
  }, 30_000)

  afterAll(async () => {
    await Promise.all(operators.map((target) => new Promise<void>((resolve) => {
      if (target.child.exitCode !== null) { resolve(); return }
      target.child.once("close", () => resolve()); target.child.stdin.end("\\q\n")
    })))
  })

  it("has actual accepted external read/edit access before replay without implicit owner access", async () => {
    for (const actor of [2,3,7,8,11,12]) expect(JSON.parse(await operator.query(`select public.fixture_form_command('responses',${actor});`))).toBeTruthy()
    expect(await operator.query("select public.can_edit_invited_form(public.fixture_form_id(1),public.fixture_form_id(20),public.fixture_form_id(3));")).toBe("t")
    await denied("perform public.fixture_form_command('responses',1);", ["42501"])
  })

  it("rejects content-bearing or invalid invitation journal fields before export", () => {
    const cases = [
      { patch: { email: "person3@example.org" }, error: "Invalid invitation suppression event" },
      { patch: { permission: "owner" }, error: "Invalid invitation permission" },
      { patch: { parentInvitationId: manifest.events[0].operationId }, error: "Invalid invitation parent" },
    ]
    for (const [index, test] of cases.entries()) {
      const damaged = join(directory, `invalid-${index}.sqlite`)
      command("python3", ["-c", "import os,shutil,sqlite3,json,hashlib,sys; shutil.copyfile(sys.argv[1],sys.argv[2]); os.chmod(sys.argv[2],0o600); c=sqlite3.connect(sys.argv[2]); e=json.loads(c.execute('select payload from suppression_events where sequence=1').fetchone()[0]); e['invitation'].update(json.loads(sys.argv[3])); p=json.dumps(e,ensure_ascii=True,sort_keys=True,separators=(',',':')); c.execute('update suppression_events set payload=?,sha256=? where sequence=1',(p,hashlib.sha256(p.encode()).hexdigest())); c.commit()", journalPath, damaged, JSON.stringify(test.patch)])
      const result = spawnSync("python3", [collector, "--journal", damaged, "--expected-source-id", manifest.sourceId,
        "--expected-sha256", digest(manifestText), "--export", join(directory, `invalid-${index}.json`)], { env, encoding: "utf8" })
      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain(test.error)
    }
    expect(readFileSync(manifestPath, "utf8")).toBe(manifestText)
  })

  it("rejects new helper access and disabled capture or identity-fence hooks", async () => {
    for (const role of ["anon", "authenticated", "service_role"]) {
      expect(sql(`select has_function_privilege('${role}','public.record_form_invitation_suppression(public.organization_form_viewer_invitations,timestamptz)','execute')`)).toBe("f")
    }
    const before = await operator.query(state)
    for (const trigger of ["organization_form_invitation_suppression_capture", "organization_form_invitation_suppression_guard"]) {
      await operator.query(`begin; alter table public.organization_form_viewer_invitations disable trigger ${trigger};`)
      await denied(`perform public.replay_organization_suppression_history(${literal(manifestText)},${literal(digest(manifestText))});`, ["42501"])
      await operator.query("rollback;")
    }
    expect(await operator.query(state)).toBe(before)
  })

  it("rolls canonical revocation back retryably when capture is contended", async () => {
    const blocker = operatorSession(sourceUrl); operators.push(blocker)
    await blocker.query("begin; select high_water from public.organization_suppression_capture_state for share;")
    try {
      const result = spawnSync("psql", ["-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-d", sourceUrl], {
        env, encoding: "utf8", input: "\\set VERBOSITY verbose\nselect public.fixture_revoke_access(4,'revoke_viewer',jsonb_build_object('invitationId',public.fixture_form_id(802),'operationId',public.fixture_form_id(860),'expectedRevision',(select access_revision from public.organization_forms where org_id=public.fixture_form_id(1) and id=public.fixture_form_id(20))));\n",
      })
      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain("40001")
      expect(result.stderr).toContain("Suppression capture busy")
    } finally { await blocker.query("rollback;") }
    expect(sql("select revoked_at is null from public.organization_form_viewer_invitations where id=public.fixture_form_id(802)")).toBe("t")
    expect(sql("select public.read_organization_suppression_events()->>'highWater'")).toBe("7")
  })

  it("rejects mismatched grant identity and rolls back a valid earlier revocation", async () => {
    const before = await operator.query(state)
    const wrong = structuredClone(manifest)
    wrong.events[1].invitation.permission = "view"
    const text = JSON.stringify(wrong)
    await denied(`perform public.replay_organization_suppression_history(${literal(text)},${literal(digest(text))});`)
    expect(await operator.query(state)).toBe(before)
  })

  it("revokes exact restored grants and descendants, preserving replacement and unrelated authority", async () => {
    expect(JSON.parse(await operator.query(replay(manifestText)))).toMatchObject({ applied: 7, exact: 0, highWater: 7, quarantined: true, releaseQualified: false })
    for (const actor of [2,3,7,8,11,12]) {
      await denied(`perform public.fixture_form_command('responses',${actor});`, ["42501"])
      await denied(`perform public.fixture_form_command('correct',${actor});`, ["42501"])
      await denied(`perform public.organization_form_source_command(public.fixture_form_id(${actor}),jsonb_build_object('action','read_form_source','versionId',public.fixture_form_id(80)));`, ["42501"])
    }
    for (const actor of [5,6]) expect(JSON.parse(await operator.query(`select public.fixture_form_command('responses',${actor});`))).toBeTruthy()
    expect(await operator.query("select public.can_edit_invited_form(public.fixture_form_id(2),public.fixture_form_id(30),public.fixture_form_id(3));")).toBe("t")
    const after = JSON.parse(await operator.query(state))
    expect(after.capture).toEqual(manifest)
    expect(after.contexts).toBe(0)
    expect(JSON.stringify(after.profiles)).toBe(beforeProfiles)
    expect(JSON.stringify(after.invitations.find((row: {id:string}) => row.id === id(900)))).toBe(beforeOther)
    expect(after.invitations.find((row: {id:string}) => row.id === id(804)).revoked_at).toBeNull()
    expect(after.responses).toHaveLength(1)
  })

  it("keeps exact retry inert and rejects reactivation or reinsertion of the old identity", async () => {
    const before = await operator.query(state)
    expect(JSON.parse(await operator.query(replay(manifestText)))).toMatchObject({ applied: 0, exact: 7 })
    expect(await operator.query(state)).toBe(before)
    await denied("update public.organization_form_viewer_invitations set revoked_at=null where id=public.fixture_form_id(800);", ["42501", "40001", "23505"])
    await denied("perform public.fixture_revoke_accept(3,801);", ["42501"])
    expect(await operator.query(state)).toBe(before)
  })

  it("retains suppression when a restored grant is absent without recreating identity or access", async () => {
    expect(JSON.parse(await absent.query(replay(manifestText)))).toMatchObject({ applied: 7, exact: 0, releaseQualified: false })
    const missing = JSON.parse(await absent.query(state))
    expect(missing.invitations.some((row: {id:string}) => row.id === id(840))).toBe(false)
    await denied(`insert into public.organization_form_viewer_invitations(id,org_id,form_id,email,invited_by,manager_revision,response_permission)
      values(public.fixture_form_id(840),public.fixture_form_id(1),public.fixture_form_id(20),'person13@example.org',public.fixture_form_id(4),1,'view');`, ["42501", "40001", "23505"], absent)
    expect(JSON.parse(await current.query(replay(manifestText)))).toMatchObject({ applied: 0, exact: 7, releaseQualified: false })
    const after = JSON.parse(await current.query(state))
    expect(after.invitations.some((row: {id:string}) => row.id === id(810) || row.id === id(811))).toBe(false)
    await denied(`insert into public.organization_form_viewer_invitations(id,org_id,form_id,email,invited_by,manager_revision,response_permission)
      values(public.fixture_form_id(810),public.fixture_form_id(1),public.fixture_form_id(20),'person7@example.org',public.fixture_form_id(4),1,'manage');`, ["42501", "40001", "23505"], current)
  })

  it("refuses shorter or changed evidence without altering the restored prefix", async () => {
    const before = await operator.query(state)
    const shorter = JSON.stringify({ ...manifest, highWater: 5, events: manifest.events.slice(0,5) })
    await denied(`perform public.replay_organization_suppression_history(${literal(shorter)},${literal(digest(shorter))});`)
    expect(await operator.query(state)).toBe(before)
  })
  it("serializes a same-ID insert against live deletion and denies reuse after commit", async () => {
    const blocker = operatorSession(sourceUrl); operators.push(blocker)
    await blocker.query("begin; delete from public.organization_form_viewer_invitations where id=public.fixture_form_id(802);")
    const insert = `insert into public.organization_form_viewer_invitations(id,org_id,form_id,email,invited_by,manager_revision,response_permission)
      values(public.fixture_form_id(802),public.fixture_form_id(1),public.fixture_form_id(20),'person5@example.org',public.fixture_form_id(4),1,'view');`
    const attempt = () => spawnSync("psql", ["-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-d", sourceUrl],
      { env, encoding: "utf8", input: "\\set VERBOSITY verbose\n" + insert + "\n" })
    const contended = attempt()
    expect(contended.status).not.toBe(0)
    expect(contended.stderr).toContain("40001")
    expect(contended.stderr).toContain("Suppression capture busy")
    await blocker.query("commit;")
    const suppressed = attempt()
    expect(suppressed.status).not.toBe(0)
    expect(suppressed.stderr).toContain("42501")
    expect(suppressed.stderr).toContain("identity is suppressed")
    expect(sql("select count(*) from public.organization_form_viewer_invitations where id=public.fixture_form_id(802)")).toBe("0")
  })

})
