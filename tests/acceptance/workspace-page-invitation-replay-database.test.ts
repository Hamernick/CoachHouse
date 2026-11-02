import { createHash } from "node:crypto"
import { spawn, spawnSync } from "node:child_process"
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

const templateUrl = process.env.WORKSPACE_PAGE_INVITATION_REPLAY_TEST_DATABASE_URL
const collector = "docs/agent/organization-suppression-capture.py"
const migration = "supabase/migrations/20261103170000_workspace_page_invitation_suppression.sql"
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
  pageInvitation: { pageId: string; invitationId: string; parentInvitationId: string | null; permission: string; createdAt: string }
}
type Manifest = { format: string; sourceId: string; capturedSince: string; historyRequiresReconciliation: boolean; highWater: number; events: Event[] }
type Operator = ReturnType<typeof operatorSession>
const operators: Operator[] = []
const targets: string[] = []
let operator: Operator, absent: Operator, current: Operator
let sourceUrl: string, manifest: Manifest, manifestText: string, directory: string, journalPath: string, manifestPath: string
let beforeProfiles: string, beforeOther: string, beforePreserved: string
const replay = (text: string, hash = digest(text)) =>
  `select public.replay_organization_suppression_history(${literal(text)},${literal(hash)});`
const state = `select jsonb_build_object(
  'invitations',(select jsonb_agg(to_jsonb(g) order by id) from public.workspace_page_invitations g),
  'profiles',(select jsonb_agg(to_jsonb(p) order by id) from public.profiles p),
  'users',(select jsonb_agg(to_jsonb(p) order by id) from auth.users p),
  'pages',(select jsonb_agg(to_jsonb(p) order by id) from public.organization_workspace_pages p),
  'files',(select jsonb_agg(to_jsonb(p) order by id) from public.organization_document_files p),
  'objects',(select jsonb_agg(to_jsonb(p) order by id) from storage.objects p),
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
  const name = `workspace_sharing_fixture_page_revoke_target_${process.pid}_${targets.length}`
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
update public.organization_forms set intake_manager=public.fixture_form_id(4),manager_revision=manager_revision+1 where org_id=public.fixture_form_id(1);
delete from public.organization_form_reviewers where org_id=public.fixture_form_id(1) and member_id=public.fixture_form_id(1);
delete from public.workspace_page_invitations;
delete from public.organization_memberships where org_id=public.fixture_form_id(1) and member_id=public.fixture_form_id(3);
create function public.fixture_page_access(actor integer,action text,patch jsonb default '{}',page integer default 10) returns jsonb language sql as $$
 select public.workspace_page_guest_command(public.fixture_form_id(actor),public.fixture_form_id(page),jsonb_build_object('action',action)||patch,repeat('a',64));
$$;
create function public.fixture_page_invite(actor integer,person integer,scope text,op integer,page integer default 10) returns jsonb language sql as $$
 select public.fixture_page_access(actor,'invite',jsonb_build_object('email','person'||person||'@example.org','permission',scope,'invitationId',public.fixture_form_id(op),'operationId',public.fixture_form_id(op)),page);
$$;
create function public.fixture_page_accept(actor integer,op integer,page integer default 10) returns jsonb language sql as $$
 select public.fixture_page_access(actor,'accept',jsonb_build_object('invitationId',public.fixture_form_id(op)),page);
$$;
create function public.fixture_page_revoke(actor integer,grant_number integer,op integer) returns jsonb language sql as $$
 select public.fixture_page_access(actor,'revoke',jsonb_build_object('invitationId',public.fixture_form_id(grant_number),'operationId',public.fixture_form_id(op)));
$$;
select public.fixture_page_invite(1,2,'manage',800); select public.fixture_page_accept(2,800);
select public.fixture_page_invite(2,3,'edit',801); select public.fixture_page_accept(3,801);
select public.fixture_page_invite(1,5,'view',802); select public.fixture_page_accept(5,802);
select public.fixture_page_invite(2,6,'edit',803); select public.fixture_page_accept(6,803);
select public.fixture_page_invite(1,6,'edit',804); select public.fixture_page_accept(6,804);
select public.fixture_page_invite(1,7,'manage',810); select public.fixture_page_accept(7,810);
select public.fixture_page_invite(7,8,'edit',811); select public.fixture_page_accept(8,811);
select public.fixture_page_invite(1,11,'manage',830); select public.fixture_page_accept(11,830);
select public.fixture_page_invite(11,12,'edit',831); select public.fixture_page_accept(12,831);
insert into public.organization_workspace_pages(id,org_id,link_id,title,particle_ids,guest_snapshot)
 select public.fixture_form_id(14),org_id,public.fixture_form_id(14),'Removed page',particle_ids,guest_snapshot from public.organization_workspace_pages where id=public.fixture_form_id(10);
select public.fixture_page_invite(1,13,'view',820,14); select public.fixture_page_accept(13,820,14);
select public.fixture_page_invite(2,3,'edit',900,11); select public.fixture_page_accept(3,900,11);
`
const dependencies = ["20261103090000_organization_suppression_capture.sql", "20261103100000_organization_suppression_history_replay.sql",
  "20261103110000_organization_form_invitation_suppression.sql", "20261103120000_organization_form_reviewer_suppression.sql", "20261103130000_organization_form_reviewer_history_replay.sql", "20261103140000_organization_form_manager_invalidation.sql",
  "20261103150000_organization_form_primary_manager_suppression.sql", "20261103160000_organization_form_primary_authority_fence.sql"]

describe.skipIf(!templateUrl).sequential("workspace page invitation revocation recovery", () => {
  beforeAll(async () => {
    const template = new URL(templateUrl!)
    if (!["localhost", "127.0.0.1", "[::1]"].includes(template.hostname)
      || !/^\/workspace_sharing_fixture_[a-z0-9_]+$/.test(template.pathname) || template.password)
      throw new Error("Only an explicitly provisioned disposable local fixture is allowed")
    directory = mkdtempSync(join(tmpdir(), "ch-page-revocation-replay-"))
    const initialDump = join(directory, "template.sql")
    command("pg_dump", ["--format=plain", "--file", initialDump, "--dbname", templateUrl!])
    const name = `workspace_sharing_fixture_page_revoke_${process.pid}_${Date.now()}`
    const source = new URL(template); source.pathname = `/${name}`; sourceUrl = source.toString()
    command("createdb", ["--maintenance-db", templateUrl!, name])
    command("psql", ["-X", "-q", "-v", "ON_ERROR_STOP=1", "-d", sourceUrl], readFileSync(initialDump, "utf8"))
    command("psql", ["-X", "-q", "-v", "ON_ERROR_STOP=1", "-d", sourceUrl], readFileSync("supabase/migrations/20261103070000_unpublished_form_collaboration.sql", "utf8"))
    sql(fixture)
    for (const file of [...dependencies.map((file) => "supabase/migrations/" + file),migration])
      command("psql", ["-X", "-q", "-v", "ON_ERROR_STOP=1", "-d", sourceUrl], readFileSync(file, "utf8"))
    for (const actor of [2,3,5,6,7,8,11,12]) expect(JSON.parse(sql(`select public.fixture_page_access(${actor},'read');`))).toBeTruthy()
    const beforePath = join(directory, "before-revocations.sql")
    command("pg_dump", ["--format=plain", "--file", beforePath, "--dbname", sourceUrl])
    const revoke = "select public.fixture_page_revoke(1,800,850);"
    sql("begin; " + revoke + " rollback;")
    expect(sql("select public.read_organization_suppression_events()->>'highWater'")).toBe("0")
    expect(JSON.parse(sql(revoke))).toMatchObject({ replayed: false })
    expect(JSON.parse(sql(revoke))).toMatchObject({ replayed: true })
    sql("delete from public.workspace_page_invitations where id=public.fixture_form_id(810);")
    sql("delete from auth.users where id=public.fixture_form_id(11);")
    sql("delete from public.organization_workspace_pages where id=public.fixture_form_id(14);")
    sql("select public.fixture_page_invite(1,13,'view',840); select public.fixture_page_accept(13,840); select public.fixture_page_revoke(1,840,851);")
    sql("select public.fixture_page_invite(1,2,'view',852); select public.fixture_page_accept(2,852);")
    const currentPath = join(directory, "after-revocations.sql")
    command("pg_dump", ["--format=plain", "--file", currentPath, "--dbname", sourceUrl])
    const sourceId = sql("select source_id from public.organization_restore_identity")
    journalPath = join(directory, "suppression.sqlite"); manifestPath = join(directory, "manifest.json")
    const collected = JSON.parse(command("python3", [collector, "--source", sourceUrl, "--journal", journalPath, "--expected-source-id", sourceId]))
    const exported = JSON.parse(command("python3", [collector, "--journal", journalPath, "--expected-source-id", sourceId,
      "--expected-sha256", collected.sha256, "--export", manifestPath]))
    manifestText = readFileSync(manifestPath, "utf8"); manifest = JSON.parse(manifestText)
    expect(exported).toMatchObject({ exported: 9, sha256: digest(manifestText), captureComplete: false, releaseQualified: false })
    expect(manifest.events.map((event) => event.kind)).toEqual(Array(9).fill("workspace_page_invitation_revoked"))
    expect(manifestText).not.toMatch(/example.org|acceptedBy|invitedBy|actor|answers|Private/)
    operator = await restore(beforePath); absent = await restore(beforePath); current = await restore(currentPath)
    const before = JSON.parse(await operator.query(state))
    expect(before).toMatchObject({ capture: { highWater: 0 }, contexts: 0, quarantined: true })
    beforeProfiles = JSON.stringify(before.profiles)
    beforeOther = JSON.stringify(before.invitations.find((row: {id:string}) => row.id === id(900)))
    beforePreserved = JSON.stringify([before.users,before.pages,before.files,before.objects,before.responses])
    writeFileSync(join(directory, "fixtures.json"), JSON.stringify({ sourceUrl, targets, journalPath, manifestPath, beforePath, currentPath }))
    console.info("Page invitation replay fixtures:", join(directory, "fixtures.json"))
  }, 30_000)
  afterAll(async () => {
    await Promise.all(operators.map((target) => new Promise<void>((resolve) => {
      if (target.child.exitCode !== null) { resolve(); return }
      target.child.once("close", () => resolve()); target.child.stdin.end("\\q\n")
    })))
  })

  it("starts with accepted guest read/edit/asset authority while private form responses stay separately protected", async () => {
    for (const actor of [2,3,7,8,11,12]) expect(JSON.parse(await operator.query(`select public.fixture_page_access(${actor},'read');`))).toBeTruthy()
    await operator.query("begin;")
    expect(JSON.parse(await operator.query("select public.fixture_page_access(3,'edit',jsonb_build_object('operationId',public.fixture_form_id(950),'expectedRevision',(select revision from public.organization_workspace_pages where id=public.fixture_form_id(10)),'title','Guest title','description',''));"))).toMatchObject({ permission: "edit", replayed: false })
    await operator.query("rollback;")
    for (const [asset,kind] of [[60,"image"],[61,"document"]] as const)
      expect(JSON.parse(await operator.query(`select public.read_workspace_page_${kind}(public.fixture_form_id(${asset}),'guest',public.fixture_form_id(3));`))).toBeTruthy()
    await denied("perform public.fixture_form_command('responses',1);", ["42501"])
  })

  it("rejects actor-bearing, malformed or non-exact event payloads in retained journals", () => {
    const cases = [
      { patch: { email: "person3@example.org" }, error: "Invalid page invitation suppression event" },
      { patch: { permission: "owner" }, error: "Invalid page invitation permission" },
      { patch: { parentInvitationId: manifest.events[0].operationId }, error: "Invalid page invitation parent" },
      { patch: { invitationId: id(999) }, error: "Page invitation suppression identity mismatch" },
    ]
    for (const [index, test] of cases.entries()) {
      const damaged = join(directory, `invalid-${index}.sqlite`)
      command("python3", ["-c", "import os,shutil,sqlite3,json,hashlib,sys; shutil.copyfile(sys.argv[1],sys.argv[2]); os.chmod(sys.argv[2],0o600); c=sqlite3.connect(sys.argv[2]); e=json.loads(c.execute('select payload from suppression_events where sequence=1').fetchone()[0]); e['pageInvitation'].update(json.loads(sys.argv[3])); p=json.dumps(e,ensure_ascii=True,sort_keys=True,separators=(',',':')); c.execute('update suppression_events set payload=?,sha256=? where sequence=1',(p,hashlib.sha256(p.encode()).hexdigest())); c.commit()", journalPath, damaged, JSON.stringify(test.patch)])
      const result = spawnSync("python3", [collector, "--journal", damaged, "--expected-source-id", manifest.sourceId,
        "--expected-sha256", digest(manifestText), "--export", join(directory, `invalid-${index}.json`)], { env, encoding: "utf8" })
      expect(result.status).not.toBe(0); expect(result.stderr).toContain(test.error)
    }
    expect(readFileSync(manifestPath, "utf8")).toBe(manifestText)
  })

  it("keeps helper/table access private and requires exact enabled capture and guard hooks", async () => {
    for (const role of ["anon", "authenticated", "service_role"]) {
      expect(sql(`select has_function_privilege('${role}','public.record_workspace_page_invitation_suppression(public.workspace_page_invitations,timestamptz)','execute')`)).toBe("f")
      expect(sql(`select has_table_privilege('${role}','public.workspace_page_invitations','INSERT,UPDATE,DELETE')`)).toBe("f")
    }
    expect(sql("select relrowsecurity from pg_class where oid='public.workspace_page_invitations'::regclass")).toBe("t")
    const before = await operator.query(state)
    for (const trigger of ["workspace_page_invitation_suppression_capture", "workspace_page_invitation_suppression_guard"]) {
      await operator.query(`begin; alter table public.workspace_page_invitations disable trigger ${trigger};`)
      await denied("perform public.read_organization_suppression_events();", ["42501"])
      await denied(`perform public.replay_organization_suppression_history(${literal(manifestText)},${literal(digest(manifestText))});`, ["42501"])
      await operator.query("rollback;")
    }
    await operator.query("begin; drop trigger workspace_page_invitation_suppression_capture on public.workspace_page_invitations; create trigger workspace_page_invitation_suppression_capture after update or delete on public.workspace_page_invitations for each row when (false) execute function public.capture_workspace_page_invitation_suppression();")
    await denied("perform public.read_organization_suppression_events();", ["42501"]); await operator.query("rollback;")
    expect(await operator.query(state)).toBe(before)
  })

  it("rolls back canonical revocation and operation receipts on capture contention", async () => {
    const before = sql("select jsonb_build_object('events',public.read_organization_suppression_events(),'receipts',(select jsonb_agg(to_jsonb(r) order by operation_id) from public.workspace_page_guest_receipts r));")
    const blocker = operatorSession(sourceUrl); operators.push(blocker)
    await blocker.query("begin; select high_water from public.organization_suppression_capture_state for share;")
    try {
      const result = spawnSync("psql", ["-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-d", sourceUrl], { env, encoding: "utf8", input: "\\set VERBOSITY verbose\nselect public.fixture_page_revoke(1,802,860);\n" })
      expect(result.status).not.toBe(0); expect(result.stderr).toContain("40001"); expect(result.stderr).toContain("Suppression capture busy")
    } finally { await blocker.query("rollback;") }
    expect(sql("select revoked_at is null from public.workspace_page_invitations where id=public.fixture_form_id(802)")).toBe("t")
    expect(sql("select jsonb_build_object('events',public.read_organization_suppression_events(),'receipts',(select jsonb_agg(to_jsonb(r) order by operation_id) from public.workspace_page_guest_receipts r));")).toBe(before)
  })

  it("rejects forged grant identity, revision, scope and source lineage atomically", async () => {
    const before = await operator.query(state)
    for (const change of [
      (m: Manifest) => { m.events[1].pageInvitation.permission = "view" },
      (m: Manifest) => { m.events[1].revision = 2 },
      (m: Manifest) => { m.events[1].organizationId = id(2) },
      (m: Manifest) => { m.sourceId = id(999) },
    ]) {
      const wrong = structuredClone(manifest); change(wrong); const text = JSON.stringify(wrong)
      await denied(`perform public.replay_organization_suppression_history(${literal(text)},${literal(digest(text))});`)
      expect(await operator.query(state)).toBe(before)
    }
  })

  it("suppresses exact restored grants and descendants through read, edit, acceptance and copied-asset readers", async () => {
    expect(JSON.parse(await operator.query(replay(manifestText)))).toMatchObject({ applied: 9, exact: 0, highWater: 9, quarantined: true, releaseQualified: false })
    for (const actor of [2,3,7,8,11,12]) {
      await denied(`perform public.fixture_page_access(${actor},'read');`, ["42501"])
      await denied(`perform public.fixture_page_access(${actor},'edit',jsonb_build_object('operationId',public.fixture_form_id(960),'expectedRevision',1,'title','Denied','description',''));`, ["42501"])
      for (const [asset,kind] of [[60,"image"],[61,"document"]] as const)
        expect(await operator.query(`select public.read_workspace_page_${kind}(public.fixture_form_id(${asset}),'guest',public.fixture_form_id(${actor}));`)).toBe("")
    }
    await denied("perform public.fixture_page_access(13,'read','{}',14);", ["42501"])
    await denied("perform public.fixture_page_accept(3,801);", ["42501"])
    await denied("perform public.fixture_form_command('responses',1);", ["42501"])
    for (const actor of [1,5,6]) expect(JSON.parse(await operator.query(`select public.fixture_page_access(${actor},'read');`))).toBeTruthy()
    expect(JSON.parse(await operator.query("select public.fixture_page_access(3,'read','{}',11);"))).toMatchObject({ permission: "edit" })
    const after = JSON.parse(await operator.query(state))
    expect(after.capture).toEqual(manifest); expect(after.contexts).toBe(0)
    expect(JSON.stringify(after.profiles)).toBe(beforeProfiles)
    expect(JSON.stringify(after.invitations.find((row: {id:string}) => row.id === id(900)))).toBe(beforeOther)
    expect(JSON.stringify([after.users,after.pages,after.files,after.objects,after.responses])).toBe(beforePreserved)
    expect(after.invitations.find((row: {id:string}) => row.id === id(804)).revoked_at).toBeNull()
  })

  it("keeps exact retry inert and prevents same-ID identity mutation or reactivation", async () => {
    const before = await operator.query(state)
    expect(JSON.parse(await operator.query(replay(manifestText)))).toMatchObject({ applied: 0, exact: 9 })
    for (const patch of ["revoked_at=null", "permission='view'", "page_id=public.fixture_form_id(11)", "org_id=public.fixture_form_id(2)", "created_at=created_at+interval '1 second'", "accepted_by=public.fixture_form_id(6)", "email='different@example.org'", "expires_at=expires_at+interval '1 day'"])
      await denied(`update public.workspace_page_invitations set ${patch} where id=public.fixture_form_id(800);`, ["42501", "40001"])
    expect(await operator.query(state)).toBe(before)
  })

  it("retains absent-grant suppression while preserving later lower authority and absent page history", async () => {
    expect(JSON.parse(await absent.query(replay(manifestText)))).toMatchObject({ applied: 9, exact: 0, releaseQualified: false })
    expect(JSON.parse(await absent.query(state)).invitations.some((row: {id:string}) => row.id === id(840))).toBe(false)
    const reuse = (grant: number) => `insert into public.workspace_page_invitations(id,page_id,email,permission,invited_by) values(public.fixture_form_id(${grant}),public.fixture_form_id(10),'person13@example.org','view',public.fixture_form_id(1));`
    await denied(reuse(840), ["42501", "40001", "23505"], absent)
    expect(JSON.parse(await current.query(replay(manifestText)))).toMatchObject({ applied: 0, exact: 9, releaseQualified: false })
    expect(JSON.parse(await current.query("select public.fixture_page_access(2,'read');"))).toMatchObject({ permission: "view" })
    await denied("perform public.fixture_page_access(2,'edit',jsonb_build_object('operationId',public.fixture_form_id(961),'expectedRevision',1,'title','Denied','description',''));", ["42501"], current)
    await denied(reuse(810), ["42501", "40001", "23505"], current)
    expect(await current.query("select count(*) from public.organization_workspace_pages where id=public.fixture_form_id(14);")).toBe("0")
  })

  it("refuses shortened or changed committed evidence without altering the prefix", async () => {
    const before = await operator.query(state)
    const shorter = JSON.stringify({ ...manifest, highWater: 5, events: manifest.events.slice(0,5) })
    await denied(`perform public.replay_organization_suppression_history(${literal(shorter)},${literal(digest(shorter))});`)
    expect(await operator.query(state)).toBe(before)
  })

  it("serializes a concurrent live DELETE against same-ID INSERT and denies reuse after commit", async () => {
    const blocker = operatorSession(sourceUrl); operators.push(blocker)
    await blocker.query("begin; delete from public.workspace_page_invitations where id=public.fixture_form_id(802);")
    const insert = "insert into public.workspace_page_invitations(id,page_id,email,permission,invited_by) values(public.fixture_form_id(802),public.fixture_form_id(10),'person5@example.org','view',public.fixture_form_id(1));"
    const attempt = () => spawnSync("psql", ["-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-d", sourceUrl], { env, encoding: "utf8", input: "\\set VERBOSITY verbose\n" + insert + "\n" })
    try {
      const contended = attempt(); expect(contended.status).not.toBe(0); expect(contended.stderr).toContain("40001"); expect(contended.stderr).toContain("Suppression capture busy")
      await blocker.query("commit;")
    } finally { if (blocker.child.exitCode === null) await blocker.query("rollback;") }
    const suppressed = attempt(); expect(suppressed.status).not.toBe(0); expect(suppressed.stderr).toContain("42501"); expect(suppressed.stderr).toContain("identity is suppressed")
    expect(sql("select count(*) from public.workspace_page_invitations where id=public.fixture_form_id(802)")).toBe("0")
  })

  it("replays closure-driven invitation retirement before request/cancel without duplicate events or restored sharing", async () => {
    const before = JSON.parse(await current.query(state))
    sql("select public.fixture_closure('request',980,0); select public.fixture_closure('cancel',981,1);")
    const mixedJournal = join(directory,"closure-suppression.sqlite"), mixedPath = join(directory,"closure-manifest.json")
    const collected = JSON.parse(command("python3", [collector,"--source",sourceUrl,"--journal",mixedJournal,"--expected-source-id",manifest.sourceId]))
    const exported = JSON.parse(command("python3", [collector,"--journal",mixedJournal,"--expected-source-id",manifest.sourceId,"--expected-sha256",collected.sha256,"--export",mixedPath]))
    const text = readFileSync(mixedPath,"utf8"), mixed: Manifest = JSON.parse(text)
    const requested = mixed.events.findIndex((event) => event.kind === "closure_request")
    expect(requested).toBeGreaterThan(9)
    expect(mixed.events.slice(10,requested).some((event) => event.kind === "workspace_page_invitation_revoked")).toBe(true)
    expect(mixed.events.at(-1)?.kind).toBe("closure_cancel")
    expect(exported).toMatchObject({ sha256: digest(text), captureComplete: false, releaseQualified: false })
    expect(JSON.parse(await current.query(replay(text)))).toMatchObject({ exact: 9, applied: mixed.highWater-9, highWater: mixed.highWater, releaseQualified: false })
    const after = JSON.parse(await current.query(state))
    expect(after.capture).toEqual(mixed); expect(after.contexts).toBe(0)
    expect(after.pages.find((page: {id:string}) => page.id===id(10))).toMatchObject({ visibility: "private", guest_snapshot: null })
    expect(after.invitations.filter((row: {org_id:string}) => row.org_id===id(1)).every((row: {revoked_at:string|null}) => row.revoked_at!==null)).toBe(true)
    expect(JSON.stringify([after.profiles,after.users,after.files,after.objects,after.responses])).toBe(JSON.stringify([before.profiles,before.users,before.files,before.objects,before.responses]))
    expect(after.pages.find((page: {id:string}) => page.id===id(11))).toEqual(before.pages.find((page: {id:string}) => page.id===id(11)))
    expect(after.invitations.find((row: {id:string}) => row.id===id(900))).toEqual(before.invitations.find((row: {id:string}) => row.id===id(900)))
    await denied("perform public.fixture_page_access(2,'read');",["42501"],current)
    expect(JSON.parse(await current.query("select public.fixture_page_access(3,'read','{}',11);"))).toMatchObject({ permission:"edit" })
    expect(JSON.parse(await current.query(replay(text)))).toMatchObject({ applied:0, exact:mixed.highWater })
    expect(JSON.parse(await current.query(state))).toEqual(after)
  })
})
