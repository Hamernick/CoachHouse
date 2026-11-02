import { createHash } from "node:crypto"
import { spawn, spawnSync } from "node:child_process"
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

const templateUrl = process.env.ORGANIZATION_FORM_MANAGER_REPLAY_TEST_DATABASE_URL
const collector = "docs/agent/organization-suppression-capture.py"
const migration = "supabase/migrations/20261103140000_organization_form_manager_invalidation.sql"
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

type Event = { kind: string; revision: number; operationId: string; invitation?: { invitationId: string }; reviewer?: { grantId: string } }
type Manifest = { sourceId: string; highWater: number; events: Event[] }
type Operator = ReturnType<typeof operatorSession>
const operators: Operator[] = [], targets: string[] = []
let operator: Operator, current: Operator
let sourceUrl: string, directory: string, manifest: Manifest, manifestText: string, beforeProfiles: string, beforeOther: string
const state = `select jsonb_build_object(
  'forms',(select jsonb_agg(to_jsonb(f) order by org_id,id) from public.organization_forms f),
  'reviewers',(select jsonb_agg(to_jsonb(g) order by grant_id) from public.organization_form_reviewers g),
  'invitations',(select jsonb_agg(to_jsonb(g) order by id) from public.organization_form_viewer_invitations g),
  'profiles',(select jsonb_agg(to_jsonb(p) order by id) from public.profiles p),
  'responses',(select jsonb_agg(to_jsonb(r) order by id) from public.organization_form_responses r),
  'capture',public.read_organization_suppression_events(),
  'contexts',(select count(*) from public.organization_suppression_replay_context),
  'quarantined',(select not datallowconn from pg_database where datname=current_database()));`
const replay = (text: string) => `select public.replay_organization_suppression_history(${literal(text)},${literal(digest(text))});`
const form = "org_id=public.fixture_form_id(1) and id=public.fixture_form_id(20)"
const revision = "(select access_revision from public.organization_forms where " + form + ")"
const primaryLoss = "update public.organization_memberships set role='member' where org_id=public.fixture_form_id(1) and member_id=public.fixture_form_id(6);"
const recover = "select public.organization_form_recovery(public.fixture_form_id(1),jsonb_build_object('action','recover_form','organizationId',public.fixture_form_id(1),'formId',public.fixture_form_id(20),'operationId',public.fixture_form_id(950),'expectedRevision',3));"
function sql(text: string) { return command("psql", ["-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-d", sourceUrl], text) }
async function denied(statement: string, codes = ["22023", "40001", "42501"], target = operator) {
  expect(await target.query(`do $test$ begin begin ${statement} raise exception 'Unexpected success' using errcode='P9999';
    exception when others then if sqlstate not in (${codes.map(literal).join(",")}) then raise; end if; end; end $test$;`)).toBe("")
}
async function restore(path: string) {
  const name = `workspace_sharing_fixture_manager_target_${process.pid}_${targets.length}`
  const url = new URL(sourceUrl); url.pathname = `/${name}`
  command("createdb", ["--maintenance-db", sourceUrl, name]); targets.push(name)
  const target = operatorSession(url.toString()); operators.push(target)
  await target.query("select 1;"); sql(`alter database "${name}" allow_connections false;`)
  const refused = spawnSync("psql", ["-X", "-qAt", "-d", url.toString(), "-c", "select 1"], { env, encoding: "utf8" })
  expect(refused.status).not.toBe(0); expect(refused.stderr).toContain("not currently accepting connections")
  await target.query(readFileSync(path, "utf8")); return target
}
const fixture = `
select public.fixture_closure_storage();
insert into public.organization_memberships(org_id,member_id,role)
 select public.fixture_form_id(1),public.fixture_form_id(n),'staff' from unnest(array[2,3,4,6,11]) n
 on conflict(org_id,member_id) do update set role='staff';
delete from public.organization_memberships where org_id=public.fixture_form_id(1) and member_id in (select public.fixture_form_id(n) from unnest(array[5,7,8,13]) n);
update public.organization_workspace_boards set state='{}',updated_by=(select intake_manager from public.organization_forms limit 1);
truncate public.organization_forms cascade; delete from public.organization_workspace_pages;
select public.fixture_form_publish(0,'publish',80,4); select public.fixture_form_command('submit');
update public.organization_forms set manager_revision=2;
create function public.fixture_manager_grant(actor integer,person integer,scope text,op integer) returns jsonb language sql as $$
 select public.organization_form_review_access(public.fixture_form_id(actor),jsonb_build_object('action','grant_reviewer','versionId',public.fixture_form_id(80),
 'email','person'||person||'@example.org','role',scope,'operationId',public.fixture_form_id(op),'expectedRevision',${revision}));
$$;
create function public.fixture_manager_invite(actor integer,person integer,scope text,op integer) returns jsonb language sql as $$
 select public.organization_form_viewer_access(public.fixture_form_id(actor),jsonb_build_object('action','invite_viewer','versionId',public.fixture_form_id(80),
 'email','person'||person||'@example.org','responsePermission',scope,'operationId',public.fixture_form_id(op),'expectedRevision',${revision}));
$$;
create function public.fixture_manager_accept(actor integer,op integer) returns jsonb language sql as $$
 select public.organization_form_viewer_access(public.fixture_form_id(actor),jsonb_build_object('action','accept_viewer','versionId',public.fixture_form_id(80),'invitationId',public.fixture_form_id(op)));
$$;
select public.fixture_manager_grant(4,2,'manage',800); select public.fixture_manager_grant(2,3,'edit',801);
select public.fixture_manager_invite(4,7,'manage',810); select public.fixture_manager_accept(7,810);
select public.fixture_manager_invite(7,8,'edit',811); select public.fixture_manager_accept(8,811);
select public.fixture_manager_invite(4,5,'view',812); select public.fixture_manager_accept(5,812);
insert into public.organization_form_reviewers(org_id,form_id,member_id,manager_revision,granted_by,role)
 values(public.fixture_form_id(1),public.fixture_form_id(20),public.fixture_form_id(11),1,public.fixture_form_id(4),'view');
insert into public.organization_form_viewer_invitations(id,org_id,form_id,email,invited_by,manager_revision,accepted_by,accepted_at,response_permission)
 values(public.fixture_form_id(813),public.fixture_form_id(1),public.fixture_form_id(20),'person13@example.org',public.fixture_form_id(4),1,public.fixture_form_id(13),clock_timestamp(),'edit');
insert into public.organization_forms(org_id,id,intake_manager,creator_id) values(public.fixture_form_id(2),public.fixture_form_id(30),public.fixture_form_id(2),public.fixture_form_id(2));
insert into public.organization_memberships(org_id,member_id,role) values(public.fixture_form_id(2),public.fixture_form_id(3),'staff') on conflict(org_id,member_id) do update set role='staff';
insert into public.organization_form_reviewers(org_id,form_id,member_id,manager_revision,granted_by,role)
 values(public.fixture_form_id(2),public.fixture_form_id(30),public.fixture_form_id(3),1,public.fixture_form_id(2),'edit');
insert into public.organization_form_viewer_invitations(id,org_id,form_id,email,invited_by,manager_revision,accepted_by,accepted_at,response_permission)
 values(public.fixture_form_id(900),public.fixture_form_id(2),public.fixture_form_id(30),'person8@example.org',public.fixture_form_id(2),1,public.fixture_form_id(8),clock_timestamp(),'edit');
`
const dependencies = ["20261103090000_organization_suppression_capture.sql", "20261103100000_organization_suppression_history_replay.sql",
  "20261103110000_organization_form_invitation_suppression.sql", "20261103120000_organization_form_reviewer_suppression.sql", "20261103130000_organization_form_reviewer_history_replay.sql"]

describe.skipIf(!templateUrl).sequential("native form manager dependent-grant recovery", () => {
  beforeAll(async () => {
    const template = new URL(templateUrl!)
    if (!["localhost", "127.0.0.1", "[::1]"].includes(template.hostname) || !/^\/workspace_sharing_fixture_[a-z0-9_]+$/.test(template.pathname) || template.password)
      throw new Error("Only an explicitly provisioned disposable local fixture is allowed")
    directory = mkdtempSync(join(tmpdir(), "ch-manager-replay-"))
    const initialDump = join(directory, "template.sql")
    command("pg_dump", ["--format=plain", "--file", initialDump, "--dbname", templateUrl!])
    const name = `workspace_sharing_fixture_manager_${process.pid}_${Date.now()}`
    const source = new URL(template); source.pathname = `/${name}`; sourceUrl = source.toString()
    command("createdb", ["--maintenance-db", templateUrl!, name])
    command("psql", ["-X", "-q", "-v", "ON_ERROR_STOP=1", "-d", sourceUrl], readFileSync(initialDump, "utf8"))
    command("psql", ["-X", "-q", "-v", "ON_ERROR_STOP=1", "-d", sourceUrl], readFileSync("supabase/migrations/20261103070000_unpublished_form_collaboration.sql", "utf8"))
    sql(fixture)
    for (const file of [...dependencies.map((file) => "supabase/migrations/" + file), migration])
      command("psql", ["-X", "-q", "-v", "ON_ERROR_STOP=1", "-d", sourceUrl], readFileSync(file, "utf8"))
    expect(sql("select public.read_organization_suppression_events()->>'highWater'")).toBe("0")
    const beforePath = join(directory, "before-transition.sql"), currentPath = join(directory, "after-transition.sql")
    command("pg_dump", ["--format=plain", "--file", beforePath, "--dbname", sourceUrl])
    const transition = "update public.organization_forms set intake_manager=public.fixture_form_id(6),manager_revision=3 where " + form + ";"
    sql("begin; " + transition + " rollback;")
    expect(sql("select public.read_organization_suppression_events()->>'highWater'")).toBe("0")
    sql(transition)
    sql("select public.fixture_manager_grant(6,2,'view',850); select public.fixture_manager_invite(6,7,'view',851); select public.fixture_manager_accept(7,851);")
    command("pg_dump", ["--format=plain", "--file", currentPath, "--dbname", sourceUrl])
    const sourceId = sql("select source_id from public.organization_restore_identity")
    const journalPath = join(directory, "suppression.sqlite"), manifestPath = join(directory, "manifest.json")
    const collected = JSON.parse(command("python3", [collector, "--source", sourceUrl, "--journal", journalPath, "--expected-source-id", sourceId]))
    const exported = JSON.parse(command("python3", [collector, "--journal", journalPath, "--expected-source-id", sourceId,
      "--expected-sha256", collected.sha256, "--export", manifestPath]))
    manifestText = readFileSync(manifestPath, "utf8"); manifest = JSON.parse(manifestText)
    expect(exported).toMatchObject({ exported: 7, captureComplete: false, releaseQualified: false })
    expect(manifest.events.filter((event) => event.kind === "form_invitation_revoked")).toHaveLength(4)
    expect(manifest.events.filter((event) => event.kind === "form_reviewer_revoked")).toHaveLength(3)
    expect(manifestText).not.toMatch(/example.org|memberId|grantedBy|invitedBy|acceptedBy|actor|answers/)
    operator = await restore(beforePath); current = await restore(currentPath)
    const before = JSON.parse(await operator.query(state))
    beforeProfiles = JSON.stringify(before.profiles)
    beforeOther = JSON.stringify([before.reviewers.filter((row: { org_id: string }) => row.org_id === id(2)),before.invitations.filter((row: { org_id: string }) => row.org_id === id(2))])
    writeFileSync(join(directory, "fixtures.json"), JSON.stringify({ sourceUrl, targets, journalPath, manifestPath, beforePath, currentPath }))
    console.info("Manager replay fixtures:", join(directory, "fixtures.json"))
  }, 30_000)
  afterAll(async () => {
    await Promise.all(operators.map((target) => new Promise<void>((resolve) => {
      if (target.child.exitCode !== null) { resolve(); return }
      target.child.once("close", () => resolve()); target.child.stdin.end("\\q\n")
    })))
  })

  it("starts with real old descendant authority and no owner response access", async () => {
    for (const actor of [2,3,5,7,8]) expect(JSON.parse(await operator.query(`select public.fixture_form_command('responses',${actor});`))).toBeTruthy()
    await denied("perform public.fixture_form_command('responses',1);", ["42501"])
    for (const actor of [11,13]) await denied(`perform public.fixture_form_command('responses',${actor});`, ["42501"])
  })

  it("keeps same-manager metadata writes inert and preserves optional recipient membership independence", async () => {
    expect(sql("update public.organization_forms set intake_manager=intake_manager,manager_revision=manager_revision where " + form + "; select public.read_organization_suppression_events()->>'highWater';")).toBe("7")
    expect(sql("begin; update public.organization_forms set access_revision=access_revision+1 where " + form + "; select public.read_organization_suppression_events()->>'highWater'; rollback;")).toBe("7")
    const result = JSON.parse(await operator.query(`begin;
      insert into public.organization_memberships(org_id,member_id,role) values(public.fixture_form_id(1),public.fixture_form_id(7),'staff');
      delete from public.organization_memberships where org_id=public.fixture_form_id(1) and member_id=public.fixture_form_id(7);
      select jsonb_build_object('manager',public.can_manage_invited_form(public.fixture_form_id(1),public.fixture_form_id(20),public.fixture_form_id(7)),
        'child',public.can_edit_invited_form(public.fixture_form_id(1),public.fixture_form_id(20),public.fixture_form_id(8)),
        'highWater',public.read_organization_suppression_events()->'highWater'); rollback;`))
    expect(result).toEqual({ manager: true, child: true, highWater: 0 })
    expect(sql("select public.read_organization_suppression_events()->>'highWater'")).toBe("7")
  })

  it.each(["demotion", "deletion"])("captures actual primary membership %s and canonical recovery without restoring descendants", (mode) => {
    const loss = mode === "demotion" ? primaryLoss : "delete from public.organization_memberships where org_id=public.fixture_form_id(1) and member_id=public.fixture_form_id(6);"
    const result = JSON.parse(sql(`begin; ${loss}
      create temporary table recovery_reply as ${recover.replace(/^select /,"select ").replace(/;$/, " as reply;")}
      select jsonb_build_object('highWater',public.read_organization_suppression_events()->'highWater',
      'reviewers',(select count(*) from public.organization_form_reviewers where org_id=public.fixture_form_id(1)),
      'invitations',(select count(*) from public.organization_form_viewer_invitations where org_id=public.fixture_form_id(1) and revoked_at is null),
      'retry',(${recover.replace(/^select /, "").replace(/;$/, "")})=(select reply from recovery_reply),
      'manager',(select intake_manager=public.fixture_form_id(1) from public.organization_forms where ${form})); rollback;`).split("\n").at(-1)!)
    expect(result).toEqual({ highWater: 9, reviewers: 0, invitations: 0, retry: true, manager: true })
    expect(sql("select public.read_organization_suppression_events()->>'highWater'")).toBe("7")
  })

  it("retires only stale revisions on revision-only change and all preexisting grants on a manager-only change", () => {
    const result = JSON.parse(sql(`begin;
      insert into public.organization_form_reviewers(org_id,form_id,member_id,manager_revision,granted_by,role)
       values(public.fixture_form_id(1),public.fixture_form_id(20),public.fixture_form_id(3),4,public.fixture_form_id(6),'edit');
      update public.organization_forms set manager_revision=4 where ${form};
      select jsonb_build_object('futureSurvives',exists(select 1 from public.organization_form_reviewers where member_id=public.fixture_form_id(3) and org_id=public.fixture_form_id(1)),
       'retired',(select count(*) from public.organization_suppression_events where sequence>7)); rollback;`).split("\n").at(-1)!)
    expect(result).toEqual({ futureSurvives: true, retired: 2 })
    expect(sql(`begin; update public.organization_forms set intake_manager=public.fixture_form_id(4) where ${form};
      select public.read_organization_suppression_events()->>'highWater'; rollback;`)).toBe("9")
  })

  it("fails closed when capture is contended and rolls back the whole manager transition", async () => {
    const blocker = operatorSession(sourceUrl); operators.push(blocker)
    const before = sql(state)
    await blocker.query("begin; select high_water from public.organization_suppression_capture_state for share;")
    try {
      const result = spawnSync("psql", ["-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-d", sourceUrl], { env, encoding: "utf8",
        input: "\\set VERBOSITY verbose\nupdate public.organization_forms set manager_revision=4 where " + form + ";\n" })
      expect(result.status).not.toBe(0); expect(result.stderr).toContain("40001")
    } finally { await blocker.query("rollback;") }
    expect(sql(state)).toBe(before)
  })

  it("keeps capture/replay and manager invalidation private with RLS enforced on retained stores", async () => {
    for (const role of ["anon", "authenticated", "service_role"]) {
      expect(sql(`select has_function_privilege('${role}','public.invalidate_form_dependents_on_manager_change()','execute')
        or has_function_privilege('${role}','public.read_organization_suppression_events()','execute')
        or has_function_privilege('${role}','public.replay_organization_suppression_history(text,text)','execute')`)).toBe("f")
      await operator.query(`begin; set local role ${role};`)
      await denied("update public.organization_forms set manager_revision=99;", ["42501"])
      await denied("perform public.read_organization_suppression_events();", ["42501"])
      await operator.query("rollback;")
    }
    expect(sql("select bool_and(relrowsecurity) from pg_class where oid in ('public.organization_forms'::regclass,'public.organization_form_reviewers'::regclass,'public.organization_form_viewer_invitations'::regclass,'public.organization_suppression_events'::regclass,'public.organization_suppression_capture_state'::regclass)")).toBe("t")
  })

  it("rejects disabled or narrowed manager and membership hooks before export or replay", async () => {
    const before = await operator.query(state)
    const alterations = [
      "alter table public.organization_forms disable trigger organization_form_manager_invalidation;",
      "alter table public.organization_memberships disable trigger organization_form_membership_loss;",
      "drop trigger organization_form_manager_invalidation on public.organization_forms; create trigger organization_form_manager_invalidation after update of access_revision on public.organization_forms for each row execute function public.invalidate_form_dependents_on_manager_change();",
      "drop trigger organization_form_manager_invalidation on public.organization_forms; create trigger organization_form_manager_invalidation after update of intake_manager,manager_revision on public.organization_forms for each row when (false) execute function public.invalidate_form_dependents_on_manager_change();",
    ]
    for (const alteration of alterations) {
      await operator.query("begin; " + alteration)
      await denied("perform public.read_organization_suppression_events();", ["42501"])
      await denied(`perform public.replay_organization_suppression_history(${literal(manifestText)},${literal(digest(manifestText))});`, ["42501"])
      await operator.query("rollback;")
    }
    expect(await operator.query(state)).toBe(before)
  })

  it("suppresses old descendant grants through actual journal replay while retaining explicit primary-manager limitation", async () => {
    expect(JSON.parse(await operator.query(replay(manifestText)))).toMatchObject({ applied: 7, exact: 0, highWater: 7, quarantined: true, releaseQualified: false })
    for (const actor of [2,3,5,7,8,11,13]) await denied(`perform public.fixture_form_command('responses',${actor});`, ["42501"])
    await denied("perform public.fixture_form_command('responses',1);", ["42501"])
    // This slice suppresses descendants only; restored primary authority still requires reconciliation.
    expect(JSON.parse(await operator.query("select public.fixture_form_command('responses',4);"))).toBeTruthy()
    const after = JSON.parse(await operator.query(state))
    expect(after.capture).toEqual(manifest); expect(after.contexts).toBe(0); expect(after.quarantined).toBe(true)
    expect(JSON.stringify(after.profiles)).toBe(beforeProfiles)
    expect(JSON.stringify([after.reviewers.filter((row: {org_id:string}) => row.org_id === id(2)),after.invitations.filter((row: {org_id:string}) => row.org_id === id(2))])).toBe(beforeOther)
    expect(after.responses).toHaveLength(1)
    expect(await operator.query("select public.can_edit_organization_form(public.fixture_form_id(2),public.fixture_form_id(30),public.fixture_form_id(3));")).toBe("t")
    expect(await operator.query("select public.can_view_invited_form_responses(public.fixture_form_id(2),public.fixture_form_id(30),public.fixture_form_id(8));")).toBe("t")
    const stable = await operator.query(state)
    expect(JSON.parse(await operator.query(replay(manifestText)))).toMatchObject({ applied: 0, exact: 7 })
    expect(await operator.query(state)).toBe(stable)
  })

  it("preserves current legitimate lower replacement grants and new primary manager", async () => {
    const before = await current.query(state)
    expect(JSON.parse(await current.query(replay(manifestText)))).toMatchObject({ applied: 0, exact: 7 })
    expect(await current.query(state)).toBe(before)
    for (const actor of [2,7]) expect(JSON.parse(await current.query(`select public.fixture_form_command('responses',${actor});`)).permissions).toMatchObject({ canCorrect: false, canManageAccess: false })
    expect(JSON.parse(await current.query("select public.fixture_form_command('responses',6);"))).toBeTruthy()
    await denied("perform public.fixture_form_command('responses',4);", ["42501"], current)
  })
})
