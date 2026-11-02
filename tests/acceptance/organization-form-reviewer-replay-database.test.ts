import { createHash } from "node:crypto"
import { spawn, spawnSync } from "node:child_process"
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

const templateUrl = process.env.ORGANIZATION_FORM_REVIEWER_REPLAY_TEST_DATABASE_URL
const collector = "docs/agent/organization-suppression-capture.py"
const migration = "supabase/migrations/20261103130000_organization_form_reviewer_history_replay.sql"
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
  reviewer: { formId: string; grantId: string; generationId: string; permission: string; createdAt: string }
}
type Manifest = { format: string; sourceId: string; capturedSince: string; historyRequiresReconciliation: boolean; highWater: number; events: Event[] }
type Operator = ReturnType<typeof operatorSession>
const operators: Operator[] = []
const targets: string[] = []
let operator: Operator, current: Operator, upgraded: Operator
let sourceUrl: string, manifest: Manifest, manifestText: string, directory: string, journalPath: string, manifestPath: string
let beforeProfiles: string, beforeOther: string, oldGenerations: Record<string, string>
const replay = (text: string, hash = digest(text)) =>
  `select public.replay_organization_suppression_history(${literal(text)},${literal(hash)});`
const state = `select jsonb_build_object(
  'reviewers',(select jsonb_agg(to_jsonb(g) order by grant_id) from public.organization_form_reviewers g),
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
  const name = `workspace_sharing_fixture_reviewer_target_${process.pid}_${targets.length}`
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
insert into public.organization_memberships(org_id,member_id,role)
 select public.fixture_form_id(1),public.fixture_form_id(n),'staff' from unnest(array[2,3,4,5,6,7,8,11,12,13]) n
 on conflict(org_id,member_id) do update set role='staff';
update public.organization_workspace_boards set state='{}',updated_by=(select intake_manager from public.organization_forms limit 1);
truncate public.organization_forms cascade;
delete from public.organization_workspace_pages;
select public.fixture_form_publish(0,'publish',80,4);
select public.fixture_form_command('submit');
create function public.fixture_reviewer_access(actor integer,action text,patch jsonb default '{}') returns jsonb language sql as $$
 select public.organization_form_review_access(public.fixture_form_id(actor),jsonb_build_object('action',action,'versionId',public.fixture_form_id(80))||patch);
$$;
create function public.fixture_reviewer_grant(actor integer,person integer,scope text,op integer) returns jsonb language sql as $$
 select public.fixture_reviewer_access(actor,'grant_reviewer',jsonb_build_object('email','person'||person||'@example.org','role',scope,'operationId',public.fixture_form_id(op),'expectedRevision',(select access_revision from public.organization_forms where org_id=public.fixture_form_id(1) and id=public.fixture_form_id(20))));
$$;
select public.fixture_reviewer_grant(4,2,'manage',800);
select public.fixture_reviewer_grant(2,3,'edit',801);
select public.fixture_reviewer_grant(4,5,'view',802);
select public.fixture_reviewer_grant(2,6,'edit',803);
select public.fixture_reviewer_grant(4,6,'edit',804);
select public.fixture_reviewer_grant(4,7,'manage',810);
select public.fixture_reviewer_grant(7,8,'edit',811);
select public.fixture_reviewer_grant(4,11,'edit',830);
select public.fixture_reviewer_grant(4,12,'edit',831);
insert into public.organization_forms(org_id,id,intake_manager,creator_id) values(public.fixture_form_id(2),public.fixture_form_id(30),public.fixture_form_id(2),public.fixture_form_id(2));
insert into public.organization_memberships(org_id,member_id,role) values(public.fixture_form_id(2),public.fixture_form_id(3),'staff') on conflict(org_id,member_id) do update set role='staff';
insert into public.organization_form_reviewers(org_id,form_id,member_id,manager_revision,granted_by,role)
 values(public.fixture_form_id(2),public.fixture_form_id(30),public.fixture_form_id(3),1,public.fixture_form_id(2),'edit');
`

describe.skipIf(!templateUrl).sequential("native member reviewer generation recovery", () => {
  beforeAll(async () => {
    const template = new URL(templateUrl!)
    if (!["localhost", "127.0.0.1", "[::1]"].includes(template.hostname)
      || !/^\/workspace_sharing_fixture_[a-z0-9_]+$/.test(template.pathname) || template.password)
      throw new Error("Only an explicitly provisioned disposable local fixture is allowed")
    directory = mkdtempSync(join(tmpdir(), "ch-reviewer-replay-"))
    const initialDump = join(directory, "template.sql")
    command("pg_dump", ["--format=plain", "--file", initialDump, "--dbname", templateUrl!])
    const name = `workspace_sharing_fixture_reviewer_${process.pid}_${Date.now()}`
    const source = new URL(template); source.pathname = `/${name}`; sourceUrl = source.toString()
    command("createdb", ["--maintenance-db", templateUrl!, name])
    command("psql", ["-X", "-q", "-v", "ON_ERROR_STOP=1", "-d", sourceUrl], readFileSync(initialDump, "utf8"))
    command("psql", ["-X", "-q", "-v", "ON_ERROR_STOP=1", "-d", sourceUrl], readFileSync("supabase/migrations/20261103070000_unpublished_form_collaboration.sql", "utf8"))
    sql(fixture)
    for (const file of ["supabase/migrations/20261103090000_organization_suppression_capture.sql",
      "supabase/migrations/20261103100000_organization_suppression_history_replay.sql",
      "supabase/migrations/20261103110000_organization_form_invitation_suppression.sql"])
      command("psql", ["-X", "-q", "-v", "ON_ERROR_STOP=1", "-d", sourceUrl], readFileSync(file, "utf8"))
    const preGenerationPath = join(directory, "before-reviewer-generation.sql")
    command("pg_dump", ["--format=plain", "--file", preGenerationPath, "--dbname", sourceUrl])
    for (const file of ["supabase/migrations/20261103120000_organization_form_reviewer_suppression.sql", migration])
      command("psql", ["-X", "-q", "-v", "ON_ERROR_STOP=1", "-d", sourceUrl], readFileSync(file, "utf8"))
    oldGenerations = JSON.parse(sql("select jsonb_object_agg(member_id,grant_id) from public.organization_form_reviewers where org_id=public.fixture_form_id(1)"))
    const beforePath = join(directory, "before-revocations.sql")
    command("pg_dump", ["--format=plain", "--file", beforePath, "--dbname", sourceUrl])
    const revision = sql("select access_revision from public.organization_forms where org_id=public.fixture_form_id(1) and id=public.fixture_form_id(20)")
    const downgrade = `select public.fixture_reviewer_access(4,'grant_reviewer',jsonb_build_object('email','person2@example.org','role','view','operationId',public.fixture_form_id(850),'expectedRevision',${revision}));`
    sql("begin; " + downgrade + " rollback;")
    expect(sql("select public.read_organization_suppression_events()->>'highWater'")).toBe("0")
    const reply = sql(downgrade); expect(sql(downgrade)).toBe(reply)
    sql("select public.fixture_reviewer_grant(4,3,'edit',851);")
    sql("delete from public.organization_memberships where org_id=public.fixture_form_id(1) and member_id in (public.fixture_form_id(7),public.fixture_form_id(11));")
    sql("select public.fixture_reviewer_access(4,'revoke_reviewer',jsonb_build_object('memberId',public.fixture_form_id(12),'operationId',public.fixture_form_id(852),'expectedRevision',(select access_revision from public.organization_forms where org_id=public.fixture_form_id(1) and id=public.fixture_form_id(20))));")
    sql("select public.fixture_reviewer_grant(4,13,'edit',853);")
    sql("select public.fixture_reviewer_access(4,'revoke_reviewer',jsonb_build_object('memberId',public.fixture_form_id(13),'operationId',public.fixture_form_id(854),'expectedRevision',(select access_revision from public.organization_forms where org_id=public.fixture_form_id(1) and id=public.fixture_form_id(20))));")
    const currentPath = join(directory, "after-revocations.sql")
    command("pg_dump", ["--format=plain", "--file", currentPath, "--dbname", sourceUrl])
    const sourceId = sql("select source_id from public.organization_restore_identity")
    journalPath = join(directory, "suppression.sqlite"); manifestPath = join(directory, "manifest.json")
    const collected = JSON.parse(command("python3", [collector, "--source", sourceUrl, "--journal", journalPath, "--expected-source-id", sourceId]))
    const exported = JSON.parse(command("python3", [collector, "--journal", journalPath, "--expected-source-id", sourceId,
      "--expected-sha256", collected.sha256, "--export", manifestPath]))
    manifestText = readFileSync(manifestPath, "utf8"); manifest = JSON.parse(manifestText)
    expect(exported).toMatchObject({ exported: 7, sha256: digest(manifestText), captureComplete: false, releaseQualified: false })
    expect(manifest.events.map((event) => event.kind)).toEqual(Array(7).fill("form_reviewer_revoked"))
    expect(manifestText).not.toMatch(/example.org|memberId|grantedBy|actor|answers|Private/)
    operator = await restore(beforePath); current = await restore(currentPath)
    upgraded = await restore(preGenerationPath)
    for (const file of ["supabase/migrations/20261103120000_organization_form_reviewer_suppression.sql", migration])
      await upgraded.query(readFileSync(file, "utf8"))
    const before = JSON.parse(await operator.query(state))
    expect(before).toMatchObject({ capture: { highWater: 0 }, contexts: 0, quarantined: true })
    beforeProfiles = JSON.stringify(before.profiles)
    beforeOther = JSON.stringify(before.reviewers.find((row: {org_id:string}) => row.org_id === id(2)))
    writeFileSync(join(directory, "fixtures.json"), JSON.stringify({ sourceUrl, targets, journalPath, manifestPath, beforePath, currentPath, preGenerationPath }))
  }, 30_000)

  afterAll(async () => {
    await Promise.all(operators.map((target) => new Promise<void>((resolve) => {
      if (target.child.exitCode !== null) { resolve(); return }
      target.child.once("close", () => resolve()); target.child.stdin.end("\\q\n")
    })))
  })

  it("starts with actual member-grant authority and no implicit owner response access", async () => {
    for (const actor of [2,3,5,6,7,8,11,12]) expect(JSON.parse(await operator.query(`select public.fixture_form_command('responses',${actor});`))).toBeTruthy()
    expect(await operator.query("select public.can_manage_organization_form(public.fixture_form_id(1),public.fixture_form_id(20),public.fixture_form_id(2));")).toBe("t")
    await denied("perform public.fixture_form_command('responses',1);", ["42501"])
  })

  it("keeps a no-op upsert generation stable and does not manufacture a revocation", () => {
    const before = sql("select grant_id from public.organization_form_reviewers where org_id=public.fixture_form_id(1) and member_id=public.fixture_form_id(5)")
    sql("select public.fixture_reviewer_grant(4,5,'view',855)")
    expect(sql("select grant_id from public.organization_form_reviewers where org_id=public.fixture_form_id(1) and member_id=public.fixture_form_id(5)")).toBe(before)
    expect(sql("select public.read_organization_suppression_events()->>'highWater'")).toBe("7")
  })

  it("rotates a generation on canonical grantor adoption even when permission is unchanged", () => {
    const result = JSON.parse(sql(`begin;
      select public.fixture_reviewer_grant(4,2,'manage',857);
      select public.fixture_reviewer_grant(2,13,'edit',858);
      create temporary table adopted_before as select grant_id from public.organization_form_reviewers
        where org_id=public.fixture_form_id(1) and member_id=public.fixture_form_id(13);
      select public.fixture_reviewer_grant(4,13,'edit',859);
      select jsonb_build_object('rotated',g.grant_id<>(select grant_id from adopted_before),
        'permission',g.role,'primary',g.granted_by=public.fixture_form_id(4),
        'captured',(select count(*) from public.organization_suppression_events e
          where e.kind='form_reviewer_revoked' and e.operation_id=(select grant_id from adopted_before)))
        from public.organization_form_reviewers g where g.org_id=public.fixture_form_id(1) and g.member_id=public.fixture_form_id(13);
      rollback;`).split("\n").at(-1)!)
    expect(result).toEqual({ rotated: true, permission: "edit", primary: true, captured: 1 })
    expect(sql("select public.read_organization_suppression_events()->>'highWater'")).toBe("7")
  })

  it("rejects member/grantor identity or invalid permission in a retained journal", () => {
    const cases = [
      { patch: { memberId: id(2) }, error: "Invalid reviewer suppression event" },
      { patch: { grantedBy: id(4) }, error: "Invalid reviewer suppression event" },
      { patch: { permission: "owner" }, error: "Invalid reviewer permission" },
      { patch: { generationId: "not-a-uuid" }, error: "Invalid opaque identifier" },
      { patch: {}, removeGeneration: true, error: "Invalid reviewer suppression event" },
    ]
    for (const [index, test] of cases.entries()) {
      const damaged = join(directory, `invalid-${index}.sqlite`)
      command("python3", ["-c", "import os,shutil,sqlite3,json,hashlib,sys; shutil.copyfile(sys.argv[1],sys.argv[2]); os.chmod(sys.argv[2],0o600); c=sqlite3.connect(sys.argv[2]); e=json.loads(c.execute('select payload from suppression_events where sequence=1').fetchone()[0]); e['reviewer'].update(json.loads(sys.argv[3])); e['reviewer'].pop('generationId',None) if sys.argv[4]=='remove' else None; p=json.dumps(e,ensure_ascii=True,sort_keys=True,separators=(',',':')); c.execute('update suppression_events set payload=?,sha256=? where sequence=1',(p,hashlib.sha256(p.encode()).hexdigest())); c.commit()", journalPath, damaged, JSON.stringify(test.patch), test.removeGeneration ? "remove" : "keep"])
      const result = spawnSync("python3", [collector, "--journal", damaged, "--expected-source-id", manifest.sourceId,
        "--expected-sha256", digest(manifestText), "--export", join(directory, `invalid-${index}.json`)], { env, encoding: "utf8" })
      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain(test.error)
    }
    expect(readFileSync(manifestPath, "utf8")).toBe(manifestText)
  })

  it("refuses a backup predating grant generation installation without changing old authority", async () => {
    const before = await upgraded.query(state)
    const installation = await upgraded.query("select reviewer_generation_id from public.organization_suppression_capture_state;")
    expect(installation).not.toBe(manifest.events[0].reviewer.generationId)
    await denied(`perform public.replay_organization_suppression_history(${literal(manifestText)},${literal(digest(manifestText))});`, ["40001"], upgraded)
    expect(await upgraded.query(state)).toBe(before)
    expect(JSON.parse(await upgraded.query(state)).quarantined).toBe(true)
    expect(JSON.parse(await upgraded.query("select public.fixture_form_command('responses',2);")).permissions.canManageAccess).toBe(true)
    expect(JSON.parse(await upgraded.query("select public.fixture_form_command('responses',3);")).permissions.canCorrect).toBe(true)
  })

  it("denies private helper access and disabled generation/capture hooks", async () => {
    for (const role of ["anon", "authenticated", "service_role"])
      expect(sql(`select has_function_privilege('${role}','public.record_form_reviewer_suppression(public.organization_form_reviewers,timestamptz)','execute')`)).toBe("f")
    const before = await operator.query(state)
    for (const trigger of ["organization_form_reviewer_suppression_capture", "organization_form_reviewer_suppression_guard"]) {
      await operator.query(`begin; alter table public.organization_form_reviewers disable trigger ${trigger};`)
      await denied(`perform public.replay_organization_suppression_history(${literal(manifestText)},${literal(digest(manifestText))});`, ["42501"])
      await operator.query("rollback;")
    }
    expect(await operator.query(state)).toBe(before)
  })

  it("rolls a canonical authority change back when capture is contended", async () => {
    const blocker = operatorSession(sourceUrl); operators.push(blocker)
    await blocker.query("begin; select high_water from public.organization_suppression_capture_state for share;")
    try {
      const result = spawnSync("psql", ["-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-d", sourceUrl], {
        env, encoding: "utf8", input: "\\set VERBOSITY verbose\nselect public.fixture_reviewer_grant(4,5,'edit',856);\n",
      })
      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain("40001")
      expect(result.stderr).toContain("Suppression capture busy")
    } finally { await blocker.query("rollback;") }
    expect(sql("select grant_id from public.organization_form_reviewers where org_id=public.fixture_form_id(1) and member_id=public.fixture_form_id(5)")).toBe(oldGenerations[id(5)])
    expect(sql("select role from public.organization_form_reviewers where org_id=public.fixture_form_id(1) and member_id=public.fixture_form_id(5)")).toBe("view")
    expect(sql("select public.read_organization_suppression_events()->>'highWater'")).toBe("7")
  })

  it("rejects mismatched generations atomically after an otherwise valid event", async () => {
    const before = await operator.query(state)
    const wrong = structuredClone(manifest)
    wrong.events[1].reviewer.permission = wrong.events[1].reviewer.permission === "view" ? "edit" : "view"
    const text = JSON.stringify(wrong)
    await denied(`perform public.replay_organization_suppression_history(${literal(text)},${literal(digest(text))});`)
    expect(await operator.query(state)).toBe(before)
  })

  it("suppresses old higher and delegated grants without reconstructing new lower authority", async () => {
    expect(JSON.parse(await operator.query(replay(manifestText)))).toMatchObject({ applied: 7, exact: 0, highWater: 7, quarantined: true, releaseQualified: false })
    for (const actor of [2,3,7,8,11,12]) {
      await denied(`perform public.fixture_form_command('responses',${actor});`, ["42501"])
      await denied(`perform public.fixture_form_command('correct',${actor});`, ["42501"])
      expect(JSON.parse(await operator.query(`select public.fixture_reviewer_access(${actor},'source_access');`))).toMatchObject({ canEdit: false, canManageAccess: false })
    }
    for (const actor of [5,6]) expect(JSON.parse(await operator.query(`select public.fixture_form_command('responses',${actor});`))).toBeTruthy()
    expect(await operator.query("select public.can_edit_organization_form(public.fixture_form_id(2),public.fixture_form_id(30),public.fixture_form_id(3));")).toBe("t")
    const after = JSON.parse(await operator.query(state))
    expect(after.capture).toEqual(manifest)
    expect(after.contexts).toBe(0)
    expect(JSON.stringify(after.profiles)).toBe(beforeProfiles)
    expect(JSON.stringify(after.reviewers.find((row: {org_id:string}) => row.org_id === id(2)))).toBe(beforeOther)
    expect(after.reviewers.find((row: {member_id:string; org_id:string}) => row.org_id === id(1) && row.member_id === id(6)).grant_id).toBe(oldGenerations[id(6)])
    expect(after.responses).toHaveLength(1)
    expect(after.reviewers.some((row: {member_id:string;org_id:string}) => row.org_id === id(1) && row.member_id === id(13))).toBe(false)
  })

  it("keeps exact retry inert and blocks reinsertion of a revoked generation", async () => {
    const before = await operator.query(state)
    expect(JSON.parse(await operator.query(replay(manifestText)))).toMatchObject({ applied: 0, exact: 7 })
    await denied(`insert into public.organization_form_reviewers(org_id,form_id,member_id,manager_revision,granted_by,role,grant_id)
      values(public.fixture_form_id(1),public.fixture_form_id(20),public.fixture_form_id(2),1,public.fixture_form_id(4),'manage',${literal(oldGenerations[id(2)])});`, ["42501"])
    const shorter = JSON.stringify({ ...manifest, highWater: 5, events: manifest.events.slice(0,5) })
    await denied(`perform public.replay_organization_suppression_history(${literal(shorter)},${literal(digest(shorter))});`)
    expect(await operator.query(state)).toBe(before)
  })

  it("preserves the source's legitimate lower and later replacement generations", async () => {
    const before = await current.query(state)
    expect(JSON.parse(await current.query(replay(manifestText)))).toMatchObject({ applied: 0, exact: 7, highWater: 7 })
    expect(await current.query(state)).toBe(before)
    const lower = JSON.parse(await current.query("select public.fixture_form_command('responses',2);"))
    expect(lower.permissions).toMatchObject({ canCorrect: false, canManageAccess: false })
    await denied("perform public.fixture_form_command('correct',2);", ["42501"], current)
    expect(JSON.parse(await current.query("select public.fixture_form_command('responses',3);")).permissions.canCorrect).toBe(true)
    const rows = JSON.parse(await current.query(state)).reviewers
    for (const actor of [2,3]) expect(rows.find((row: {member_id:string;org_id:string}) => row.org_id === id(1) && row.member_id === id(actor)).grant_id).not.toBe(oldGenerations[id(actor)])
  })

  it("serializes generation reuse against a live DELETE and blocks it after commit", async () => {
    const blocker = operatorSession(sourceUrl); operators.push(blocker)
    await blocker.query("begin; delete from public.organization_form_reviewers where org_id=public.fixture_form_id(1) and member_id=public.fixture_form_id(5);")
    const insert = `insert into public.organization_form_reviewers(org_id,form_id,member_id,manager_revision,granted_by,role,grant_id)
      values(public.fixture_form_id(1),public.fixture_form_id(20),public.fixture_form_id(5),1,public.fixture_form_id(4),'view',${literal(oldGenerations[id(5)])});`
    const attempt = () => spawnSync("psql", ["-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-d", sourceUrl],
      { env, encoding: "utf8", input: "\\set VERBOSITY verbose\n" + insert + "\n" })
    const contended = attempt()
    expect(contended.status).not.toBe(0)
    expect(contended.stderr).toContain("40001")
    await blocker.query("commit;")
    const suppressed = attempt()
    expect(suppressed.status).not.toBe(0)
    expect(suppressed.stderr).toContain("42501")
    expect(sql("select count(*) from public.organization_form_reviewers where grant_id=" + literal(oldGenerations[id(5)]))).toBe("0")
  })
})
