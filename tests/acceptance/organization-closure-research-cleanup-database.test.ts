import { createHash } from "node:crypto"
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from "node:child_process"
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest"

const template = process.env.ORGANIZATION_RESEARCH_CLEANUP_TEST_DATABASE_URL
const migration = "supabase/migrations/20261103310000_organization_closure_research_draft_cleanup.sql"
const readOnlyMigration = "supabase/migrations/20261103230000_organization_closure_read_only.sql"
const env = { ...process.env, PGOPTIONS: "-c statement_timeout=5000 -c coach_house.workspace_sharing_fixture=isolated-test-only -c timezone=UTC" }
const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const quote = (s: string) => "'" + s.replaceAll("'", "''") + "'"
const hash = (s: string) => createHash("sha256").update(s).digest("hex")
let url: string, directory: string, operation = 9000
const children = new Set<ChildProcessWithoutNullStreams>()
const outcomes: string[] = []
function command(program: string, args: string[], input?: string) {
 const r = spawnSync(program, args, { env, input, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 })
 expect(r.status, r.stderr).toBe(0); return r.stdout.trim()
}
const sql = (text: string) => command("psql", ["-XqAt", "-v", "ON_ERROR_STOP=1", "-d", url], text)
function rejected(text: string, message: string) {
 const r = spawnSync("psql", ["-XqAt", "-v", "ON_ERROR_STOP=1", "-d", url], { env, input: text, encoding: "utf8" })
 expect(r.status).not.toBe(0); expect(r.stderr).toContain(message)
}
function session(target = url) {
 const child = spawn("psql", ["-XqAt", "-v", "ON_ERROR_STOP=1", "-d", target], { env }); children.add(child)
 let stdout = "", stderr = "", counter = 0
 let pending: { marker: string; resolve: (text: string) => void; reject: (error: Error) => void } | undefined
 child.stdout.on("data", chunk => { stdout += chunk.toString(); if (pending && stdout.includes(pending.marker)) {
  const value = stdout.slice(0, stdout.indexOf(pending.marker)).trim(); stdout = stdout.slice(stdout.indexOf(pending.marker) + pending.marker.length)
  const done = pending; pending = undefined; done.resolve(value)
 } })
 child.stderr.on("data", chunk => { stderr += chunk.toString() })
 child.on("close", code => { children.delete(child); pending?.reject(new Error(`Operator exited ${code}: ${stderr}`)); pending = undefined })
 child.on("error", error => pending?.reject(error))
 return { child, query(text: string): Promise<string> {
  if (pending) throw new Error("Sequential queries required")
  return new Promise((resolve, reject) => { const marker = `__DONE_${++counter}__`; pending = { marker, resolve, reject }; child.stdin.write(`${text}\n;\n\\echo ${marker}\n`) })
 } }
}
const close = "select public.fixture_closure('request',600,0)"
const expire = "update public.organization_closures set requested_at=now()-interval '721 hours',export_until=now()-interval '1 hour' where org_id=public.fixture_form_id(1)"
const purge = (op = operation, request = 600, revision = 1) => `select public.purge_expired_organization_research_drafts('${id(1)}','${id(request)}',${revision},'${id(op)}')`
const draftRead = (write = false) => `select public.access_workspace_research_draft('${id(3001)}','${id(1)}','${id(1)}',repeat('a',64),${write ? "'"+id(9901)+"'" : "null"},${write ? "1" : "null"},${write ? "'{}'::jsonb" : "null"},false)`
const count = () => sql("select count(*) from public.workspace_research_drafts d join public.workspace_ai_runs r on r.id=d.run_id where r.org_id=public.fixture_form_id(1)")
const preservation = `select jsonb_build_object(
 'runs',(select jsonb_agg(to_jsonb(r) order by id) from public.workspace_ai_runs r),
 'results',(select jsonb_agg(to_jsonb(r) order by run_id) from public.workspace_ai_result_receipts r),
 'effects',(select jsonb_agg(to_jsonb(r) order by run_id) from public.workspace_ai_document_applications r),
 'reservations',(select jsonb_agg(to_jsonb(r) order by run_id,lot_id) from public.ai_credit_reservations r),
 'entries',(select jsonb_agg(to_jsonb(r) order by id) from public.ai_credit_entries r),
 'lots',(select jsonb_agg(to_jsonb(r) order by id) from public.ai_credit_lots r),
 'users',(select jsonb_agg(to_jsonb(r) order by id) from auth.users r),
 'closures',(select jsonb_agg(to_jsonb(r) order by org_id) from public.organization_closures r),
 'otherDraft',(select to_jsonb(r) from public.workspace_research_drafts r where run_id=public.fixture_form_id(4001)))`

describe.skipIf(!template).sequential("private expired research recovery cleanup", () => {
 beforeAll(() => {
  const source = new URL(template!)
  if (!["localhost", "127.0.0.1", "[::1]"].includes(source.hostname) || !/^\/workspace_sharing_fixture_[a-z0-9_]+$/.test(source.pathname) || source.password) throw new Error("Explicit isolated local template required")
  directory = mkdtempSync(join(tmpdir(), "ch-research-cleanup-")); const dump = join(directory, "source.sql")
  command("pg_dump", ["--format=plain", "--file", dump, "--dbname", template!])
  const name = `workspace_sharing_fixture_research_cleanup_${process.pid}_${Date.now()}`
  command("createdb", ["--maintenance-db", template!, name]); source.pathname = "/" + name; url = source.toString()
  sql(readFileSync(dump, "utf8")); sql("select public.fixture_closure_storage()")
  sql(readFileSync(readOnlyMigration, "utf8")); sql(readFileSync(migration, "utf8"))
 }, 30_000)
 beforeEach(() => {
  operation++
  sql(`drop trigger if exists fixture_research_receipt_failure on public.organization_closure_research_cleanup_operations;drop function if exists public.fixture_research_receipt_failure();select public.fixture_closure_storage();
   insert into public.workspace_ai_runs(id,org_id,actor_id,request_hash,task,target,prompt,tariff,max_credits,max_provider_microdollars,status,proposal,charged_credits,provider_microdollars,settled_at)
   select public.fixture_form_id(n),public.fixture_form_id(case when n=4001 then 2 else 1 end),public.fixture_form_id(case when n=4001 then 2 else 1 end),repeat('a',64),'plan','{"kind":"particle_research"}','Synthetic research','{}',10,100,'succeeded','{}',0,0,now() from (select generate_series(3001,3052) n union all select 4001) seed;
   insert into public.workspace_research_drafts(run_id,base_hash,revision,draft,attempted,edit_id,edit_revision)
   select id,repeat('a',64),1,jsonb_build_object('title','Synthetic private recovery'),id<>public.fixture_form_id(3001),gen_random_uuid(),0 from public.workspace_ai_runs where id>=public.fixture_form_id(3001);
   select public.fixture_ai_claim();select public.fixture_ai_finish();select public.fixture_ai_reserve(1802);select public.fixture_ai_claim(1802);
   insert into public.workspace_ai_document_applications(run_id,section_id,saved_revision,content_hash) values(public.fixture_form_id(1801),'synthetic','v1',repeat('a',64));`)
 })
 afterEach(() => { for (const child of children) child.kill("SIGTERM") })
 afterAll(() => { if (directory) writeFileSync(join(directory, "proof.json"), JSON.stringify({ url, directory, migration, sha256: hash(readFileSync(migration,"utf8")), outcomes, releaseQualified: false }, null, 2)) })
 it("preserves the export window and cancellation/newer closure recovery", () => {
  rejected(purge(), "Closure identity changed"); sql(close)
  rejected(purge(), "Closure export window has not expired")
  expect(JSON.parse(sql("set role service_role;" + draftRead())).revision).toBe(1)
  sql("select public.fixture_closure('cancel',601,1)")
  rejected(purge(), "Closure identity changed")
  expect(JSON.parse(sql("set role service_role;" + draftRead())).revision).toBe(1)
  sql("select public.fixture_closure('request',602,2);" + expire)
  rejected(purge(), "Closure identity changed"); expect(count()).toBe("53")
  outcomes.push("predeadline, canceled and newer request denied; existing recovery readable before expiry and after cancellation")
 })
 it("deletes bounded child batches with exact retry and no parent/effect/accounting changes", () => {
  sql(close + ";" + expire); const before = sql(preservation)
  const first = sql(purge()); expect(JSON.parse(first)).toEqual({ scope: "workspace_research_drafts", deletedCount: 50, moreRemainingAtCommit: true })
  expect(count()).toBe("3"); expect(sql(purge())).toBe(first); expect(count()).toBe("3")
  rejected(purge(operation,600,2), "Closure identity changed")
  expect(JSON.parse(sql(purge(operation+10000)))).toMatchObject({ deletedCount: 3, moreRemainingAtCommit: false })
  expect(JSON.parse(sql(purge(operation+20000)))).toMatchObject({ deletedCount: 0, moreRemainingAtCommit: false })
  expect(sql(preservation)).toBe(before)
  rejected("set role service_role;" + draftRead(true), "Organization unavailable")
  outcomes.push("50/3/0 batches, immutable exact retry, same parents/results/effects/accounting/closure/other organization, no late resurrection")
 })
 it("rolls back child deletion if its receipt cannot commit", () => {
  sql(close + ";" + expire)
  sql("create function public.fixture_research_receipt_failure() returns trigger language plpgsql as $$begin raise exception 'injected receipt failure';end$$;create trigger fixture_research_receipt_failure before insert on public.organization_closure_research_cleanup_operations for each row execute function public.fixture_research_receipt_failure()")
  rejected(purge(), "injected receipt failure"); expect(count()).toBe("53")
  sql("drop trigger fixture_research_receipt_failure on public.organization_closure_research_cleanup_operations;drop function public.fixture_research_receipt_failure()")
  expect(JSON.parse(sql(purge())).deletedCount).toBe(50)
  outcomes.push("receipt failure rolls back entire deletion; original operation retries successfully")
 })
 it("rejects a busy child without partial deletion and leaves parent settlement locks independent", async () => {
  sql(close + ";" + expire)
  const held = session(); await held.query("begin;select 1 from public.workspace_research_drafts where run_id=public.fixture_form_id(3001) for update")
  rejected(purge(), "Research draft is changing"); expect(count()).toBe("53"); await held.query("rollback")
  await held.query("begin;select 1 from public.workspace_ai_runs where id=public.fixture_form_id(3001) for update")
  expect(JSON.parse(sql(purge())).deletedCount).toBe(50); await held.query("rollback")
  outcomes.push("busy child fails atomically; parent settlement lock does not block cleanup")
 })
 it("serializes cleanup with lifecycle changes and rechecks after the lock", async () => {
  sql(close)
  const held = session(); await held.query("begin;select public.fixture_closure('cancel',601,1)")
  const pending = session(); const result = pending.query(`set application_name='research-cleanup-waiter';do $$begin perform public.purge_expired_organization_research_drafts('${id(1)}','${id(600)}',1,'${id(operation)}');raise exception 'unexpected';exception when serialization_failure then raise notice 'denied';end$$`)
  await new Promise(resolve=>setTimeout(resolve,150))
  expect(sql("select wait_event_type from pg_stat_activity where application_name='research-cleanup-waiter' and datname=current_database()")).toBe("Lock")
  await held.query("commit"); await result; expect(count()).toBe("53")
  sql("select public.fixture_closure('request',602,2);" + expire)
  await held.query("begin;" + purge(operation,602,3))
  rejected("set lock_timeout='150ms';select public.fixture_closure('cancel',603,3)", "lock timeout")
  await held.query("rollback"); expect(count()).toBe("53")
  outcomes.push("cancel-first waiter rechecks fresh lifecycle; cleanup-first holds lifecycle row until commit/rollback")
 })
 it("keeps API roles and role-switched operators out, with immutable private receipts", () => {
  for (const role of ["anon","authenticated","service_role"]) {
   expect(sql(`select has_function_privilege('${role}','public.purge_expired_organization_research_drafts(uuid,uuid,integer,uuid)','execute'),has_table_privilege('${role}','public.organization_closure_research_cleanup_operations','select')`)).toBe("f|f")
   rejected(`set role ${role};` + purge(), "permission denied")
   expect(sql(`select has_function_privilege('${role}','public.organization_closure_command(uuid,uuid,text,uuid,integer)','execute')`)).toBe("f")
  }
  sql(close + ";" + expire + ";" + purge())
  for (const statement of ["update public.organization_closure_research_cleanup_operations set result='{}'","delete from public.organization_closure_research_cleanup_operations","truncate public.organization_closure_research_cleanup_operations"]) rejected(statement,"Research cleanup receipts are immutable")
  for (const isolation of ["repeatable read","serializable"]) rejected(`begin isolation level ${isolation};`+purge(),"Cleanup requires read committed")
  rejected("set session_replication_role=replica;"+purge(),"origin triggers")
  rejected("begin;grant execute on function public.purge_expired_organization_research_drafts(uuid,uuid,integer,uuid) to service_role;set role service_role;"+purge(),"Actual operator authority required")
  outcomes.push("API ACLs/lifecycle remain closed; actual-session operator, isolation/origin checks and immutable receipts")
 })
 it("keeps a restored preclosure draft inaccessible after pinned quarantine replay", async () => {
  const dump=join(directory,"preclosure-recovery.sql"); command("pg_dump",["--format=plain","--file",dump,"--dbname",url])
  sql(close+";"+expire)
  const manifest=sql(`select jsonb_build_object('format','coach-house-closure-suppression-v1','sourceId',(select source_id from public.organization_restore_identity),'closures',jsonb_build_array(jsonb_build_object('organizationId',org_id,'requestId',request_id,'revision',revision,'requestedAt',requested_at,'exportUntil',export_until))) from public.organization_closures where org_id=public.fixture_form_id(1)`)
  sql(purge()); const target=new URL(url);const name=`workspace_sharing_fixture_research_restore_${process.pid}_${Date.now()}`
  command("createdb",["--maintenance-db",url,name]);target.pathname="/"+name
  const operator=session(target.toString());await operator.query("select 1")
  sql(`alter database "${name}" allow_connections false`)
  const refused=spawnSync("psql",["-XqAt","-d",target.toString(),"-c","select 1"],{env,encoding:"utf8"});expect(refused.status).not.toBe(0);expect(refused.stderr).toContain("not currently accepting connections")
  await operator.query(readFileSync(dump,"utf8"))
  expect(JSON.parse(await operator.query(`select public.replay_organization_closure_suppression(${quote(manifest)},${quote(hash(manifest))})`))).toMatchObject({quarantined:true,applied:1,releaseQualified:false})
  expect(await operator.query("select count(*) from public.workspace_research_drafts where run_id=public.fixture_form_id(3001)")).toBe("1")
  await operator.query(`set role service_role;do $$begin perform public.access_workspace_research_draft('${id(3001)}','${id(1)}','${id(1)}',repeat('a',64),null,null,null,false);raise exception 'restored draft exposed';exception when insufficient_privilege then null;end$$;reset role`)
  expect(JSON.parse(await operator.query(purge(operation+30000)))).toMatchObject({deletedCount:50})
  expect(await operator.query("select datallowconn from pg_database where datname=current_database()")).toBe("f")
  outcomes.push("actual preclosure backup retains draft; pinned shutdown replay denies source RPC, private repurge works, new connections stay quarantined; no hosted durability claim")
 },30_000)
})
