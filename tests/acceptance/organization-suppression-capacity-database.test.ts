import { createHash } from "node:crypto"
import { spawnSync } from "node:child_process"
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

const templateUrl = process.env.ORGANIZATION_SUPPRESSION_CAPACITY_TEST_DATABASE_URL
const migration = "supabase/migrations/20261103190000_organization_suppression_capacity.sql"
const env = { ...process.env, PGOPTIONS: "-c statement_timeout=15000 -c coach_house.workspace_sharing_fixture=isolated-test-only -c timezone=UTC" }
let url: string, directory: string
const dependencies = ["20261103040000_workspace_page_note_edit_scope.sql", "20261103070000_unpublished_form_collaboration.sql",
  "20261103090000_organization_suppression_capture.sql", "20261103100000_organization_suppression_history_replay.sql",
  "20261103110000_organization_form_invitation_suppression.sql", "20261103120000_organization_form_reviewer_suppression.sql",
  "20261103130000_organization_form_reviewer_history_replay.sql", "20261103140000_organization_form_manager_invalidation.sql",
  "20261103150000_organization_form_primary_manager_suppression.sql", "20261103160000_organization_form_primary_authority_fence.sql",
  "20261103170000_workspace_page_invitation_suppression.sql", "20261103180000_workspace_page_note_scope_suppression.sql"]
function run(program: string, args: string[], input?: string) {
  return spawnSync(program, args, { env, input, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 })
}
function command(program: string, args: string[], input?: string) {
  const result = run(program, args, input)
  expect(result.status, result.stderr).toBe(0)
  return result.stdout.trim()
}
function sql(text: string, target = url) {
  return command("psql", ["-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-d", target], text)
}
const reject = (statement: string, code = "54000") => `do $test$ begin begin
 ${statement} raise exception 'Unexpected success' using errcode='P9999';
 exception when others then if sqlstate<>'${code}' then raise; end if; end; end $test$;`
// Synthetic answer-free events isolate bounded admission; they are not valid
// canonical closure histories and are never used to claim restore acceptance.
const seed = (count: number) => `update public.organization_suppression_capture_state set high_water=${count};
 insert into public.organization_suppression_events(sequence,kind,organization_id,operation_id,revision,occurred_at)
 select n,'closure_cancel',public.fixture_form_id(1),public.fixture_form_id(100000+n),n,clock_timestamp()
 from generate_series(1,${count}) n;`
const revoke = (invitation = 90001, operation = 91001) => `select public.workspace_page_guest_command(public.fixture_form_id(1),
 (select page_id from public.workspace_page_invitations where id=public.fixture_form_id(${invitation})),
 jsonb_build_object('action','revoke','invitationId',public.fixture_form_id(${invitation}),'operationId',public.fixture_form_id(${operation})),repeat('c',64));`
const checkState = `select jsonb_build_object('count',(select count(*) from public.organization_suppression_events),
 'highWater',(select high_water from public.organization_suppression_capture_state),
 'revoked',(select revoked_at is not null from public.workspace_page_invitations where id=public.fixture_form_id(90001)),
 'closure',(select state from public.organization_closures where org_id=public.fixture_form_id(1)),
 'receipts',(select count(*) from public.workspace_page_guest_receipts where operation_id=public.fixture_form_id(91001)));`
const results: string[] = []

describe.skipIf(!templateUrl).sequential("organization suppression bounded capacity admission", () => {
 beforeAll(() => {
  const template = new URL(templateUrl!)
  if (!["localhost", "127.0.0.1", "[::1]"].includes(template.hostname) || !/^\/workspace_sharing_fixture_[a-z0-9_]+$/.test(template.pathname) || template.password)
   throw new Error("Only an explicitly provisioned disposable local fixture is allowed")
  directory = mkdtempSync(join(tmpdir(), "ch-suppression-capacity-"))
  const dump = join(directory, "template.sql")
  command("pg_dump", ["--format=plain", "--file", dump, "--dbname", templateUrl!])
  const name = `workspace_sharing_fixture_capacity_${process.pid}_${Date.now()}`
  const target = new URL(template); target.pathname = `/${name}`; url = target.toString()
  command("createdb", ["--maintenance-db", templateUrl!, name])
  sql(readFileSync(dump, "utf8"))
  sql("alter table public.organization_workspace_boards add column created_at timestamptz not null default now(),add column updated_at timestamptz not null default now(); select public.fixture_closure_storage();")
  for (const file of dependencies) sql(readFileSync("supabase/migrations/" + file, "utf8"))
  sql(`insert into public.workspace_page_invitations(id,page_id,email,permission,invited_by)
   select public.fixture_form_id(n),(select id from public.organization_workspace_pages where org_id=public.fixture_form_id(1) order by id limit 1),
   'capacity'||n||'@example.org','view',public.fixture_form_id(1) from generate_series(90001,90002) n;`)
  command("pg_dump", ["--format=plain", "--file", join(directory,"before-capacity.sql"), "--dbname", url])
  sql(readFileSync(migration, "utf8"))
 }, 30_000)
 afterAll(() => {
  if (directory) writeFileSync(join(directory,"proof.json"), JSON.stringify({url,directory,migration,sha256:createHash("sha256").update(readFileSync(migration)).digest("hex"),results},null,2))
 })
 it("accepts the final event and rejects overflow without a revocation or receipt", () => {
  const result = sql(`begin;${seed(999)}${revoke()}${revoke()}${reject(revoke(90002,91002).replace(/^select /,"perform "))}${checkState}rollback;`)
  expect(JSON.parse(result.split("\n").at(-1)!)).toMatchObject({count:1000,highWater:1000,revoked:true,receipts:1})
  expect(sql(`select revoked_at is null from public.workspace_page_invitations where id=public.fixture_form_id(90002)`)).toBe("t")
  results.push("final slot and overflow rollback")
 })
 it("rolls back all shutdown effects when a multi-event closure exhausts capacity", () => {
  const result = sql(`begin;${seed(999)}${reject("perform public.fixture_closure('request',92001,0);")}${checkState}
   select count(*) from public.workspace_page_invitations where revoked_at is not null;rollback;`)
  const lines = result.split("\n")
  expect(JSON.parse(lines.at(-2)!)).toMatchObject({count:999,highWater:999,revoked:false,closure:null,receipts:0})
  expect(lines.at(-1)).toBe("0")
  results.push("multi-event canonical closure rollback")
 })
 it("permits canonical service writes without granting private capacity helpers", () => {
  const result=sql(`begin;do $test$ declare page uuid; begin
   select page_id into page from public.workspace_page_invitations where id=public.fixture_form_id(90001);
   set local role service_role;
   perform public.workspace_page_guest_command(public.fixture_form_id(1),page,
    jsonb_build_object('action','revoke','invitationId',public.fixture_form_id(90001),'operationId',public.fixture_form_id(91001)),repeat('c',64));
   reset role;end $test$;${checkState}rollback;`)
  expect(JSON.parse(result)).toMatchObject({count:1,highWater:1,revoked:true,receipts:1})
  for (const role of ["anon","authenticated","service_role"]) {
   expect(sql(`select has_function_privilege('${role}','public.assert_organization_suppression_capacity()','execute') or has_function_privilege('${role}','public.guard_organization_suppression_capacity()','execute') or has_function_privilege('${role}','public.read_organization_suppression_events_before_capacity()','execute')`)).toBe("f")
  }
  results.push("service role canonical write and private helpers")
 })
 it("enforces exact exported byte capacity with a controlled serializer boundary", () => {
  // All current opaque event kinds may fit below 1MiB at 1000 events. Inject only
  // serializer padding in a rolled-back transaction to exercise the actual guard.
  const result=sql(`begin;alter function public.organization_suppression_event_json(public.organization_suppression_events) rename to fixture_original_event_json;
   create function public.organization_suppression_event_json(e public.organization_suppression_events) returns jsonb language sql set search_path='' as $$
    select public.fixture_original_event_json(e)||jsonb_build_object('fixturePadding',repeat('x',1048576));$$;
   ${reject(revoke().replace(/^select /,"perform "))}${checkState}rollback;`)
  expect(JSON.parse(result)).toMatchObject({count:0,highWater:0,revoked:false,receipts:0})
  results.push("byte overflow rejects canonical operation atomically")
 })
 it("accepts exactly one MiB and rejects the next byte using the shared envelope", () => {
  const result=sql(`begin;${seed(1)}
   alter function public.organization_suppression_event_json(public.organization_suppression_events) rename to fixture_original_event_json;
   create function public.organization_suppression_event_json(e public.organization_suppression_events) returns jsonb language sql set search_path='' as $$
    select public.fixture_original_event_json(e)||jsonb_build_object('fixturePadding',repeat('x',current_setting('coach_house.capacity_padding')::integer));$$;
   do $test$ declare padding integer; begin
    perform set_config('coach_house.capacity_padding','0',true);
    padding:=1048576-octet_length(public.read_organization_suppression_events()::text);
    perform set_config('coach_house.capacity_padding',padding::text,true);
    perform public.assert_organization_suppression_capacity();
    if octet_length(public.read_organization_suppression_events()::text)<>1048576 then raise exception 'Boundary mismatch';end if;
    perform set_config('coach_house.capacity_padding',(padding+1)::text,true);
    begin perform public.assert_organization_suppression_capacity();raise exception 'Unexpected success' using errcode='P9999';
    exception when sqlstate '54000' then null;end;
   end $test$;select high_water from public.organization_suppression_capture_state;rollback;`)
  expect(result).toBe("1")
  results.push("exact 1048576-byte boundary and one-byte overflow")
 })
 it("rejects disabled or conditional capacity hooks at export", () => {
  sql(`begin;alter table public.organization_suppression_events disable trigger organization_suppression_capacity;
   ${reject("perform public.read_organization_suppression_events();","42501")}rollback;`)
  sql(`begin;drop trigger organization_suppression_capacity on public.organization_suppression_events;
   create trigger organization_suppression_capacity after insert on public.organization_suppression_events for each row when(false) execute function public.guard_organization_suppression_capacity();
   ${reject("perform public.read_organization_suppression_events();","42501")}rollback;`)
  results.push("disabled and narrowed hook rejection")
 })
 it("refuses installation over oversized history without altering the old exporter", () => {
  const target=new URL(url);target.pathname+="_upgrade"
  command("createdb",["--maintenance-db",url,target.pathname.slice(1)])
  sql(readFileSync(join(directory,"before-capacity.sql"),"utf8"),target.toString())
  sql(seed(1001),target.toString())
  const result=run("psql",["-X","-qAt","-v","ON_ERROR_STOP=1","-d",target.toString()],"\\set VERBOSITY verbose\n"+readFileSync(migration,"utf8"))
  expect(result.status).not.toBe(0);expect(result.stderr).toContain("54000")
  expect(sql("select count(*) from public.organization_suppression_events",target.toString())).toBe("1001")
  expect(sql("select to_regprocedure('public.assert_organization_suppression_capacity()') is null and to_regprocedure('public.read_organization_suppression_events_before_capacity()') is null",target.toString())).toBe("t")
  results.push("oversized upgrade refused without history loss")
 })
})
