import { createHash } from "node:crypto"
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from "node:child_process"
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

const template = process.env.ORGANIZATION_PROJECT_CLEANUP_TEST_DATABASE_URL
const migration = "supabase/migrations/20261103370000_organization_closure_project_content_cleanup.sql"
const collector = "docs/agent/organization-suppression-capture.py"
const env = { ...process.env, PGOPTIONS: "-c statement_timeout=10000 -c timezone=UTC" }
const id = (n: number) => `37000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const literal = (value: string) => "'" + value.replaceAll("'", "''") + "'"
const hash = (value: string) => createHash("sha256").update(value).digest("hex")
const sentinel = "PRIVATE_PROJECT_PURGE_370000"
let source: string, maintenance: string, directory: string, backup: string, manifest = ""
const results: string[] = [], targetNames: string[] = []
const children = new Set<ChildProcessWithoutNullStreams>()
function command(program: string, args: string[], input?: string) {
 const r = spawnSync(program, args, { input, env, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })
 expect(r.status, r.stderr).toBe(0); return r.stdout.trim()
}
const sql = (query: string, url = source) => command("psql", ["-XqAt", "-v", "ON_ERROR_STOP=1", "-d", url], query)
const deny = (statement: string, code = "42501") => `do $test$ begin begin ${statement};raise exception 'Unexpected success' using errcode='P9999';exception when others then if sqlstate<>'${code}' then raise;end if;end;end $test$;`
const purge = (operation = 900) => `public.purge_expired_organization_project_content('${id(1)}','${id(800)}',1,'${id(operation)}')`
const close = `insert into public.organization_closures(org_id,state,revision,request_id,requested_at,export_until) values('${id(1)}','closing',1,'${id(800)}',statement_timestamp()-interval '31 days',statement_timestamp()-interval '31 days'+interval '720 hours');insert into public.organization_closure_operations(org_id,operation_id,action,expected_revision,completed_at) select org_id,request_id,'request',0,requested_at from public.organization_closures where org_id='${id(1)}';`
function session(url = source) {
 const child = spawn("psql", ["-XqAt", "-v", "ON_ERROR_STOP=1", "-d", url], { env }); children.add(child)
 let out = "", error = "", n = 0
 let pending: { marker: string; resolve: (value: string) => void; reject: (error: Error) => void } | undefined
 child.stdout.on("data", chunk => { out += chunk.toString(); if (pending && out.includes(pending.marker)) {
  const value = out.slice(0, out.indexOf(pending.marker)).trim(); out = out.slice(out.indexOf(pending.marker) + pending.marker.length)
  const done = pending; pending = undefined; done.resolve(value)
 } })
 child.stderr.on("data", chunk => { error += chunk.toString() })
 child.on("close", code => { children.delete(child); pending?.reject(new Error(`Operator exited ${code}: ${error}`)); pending = undefined })
 return { child, query(text: string): Promise<string> {
  if (pending) throw new Error("Sequential operator commands required")
  return new Promise((resolve, reject) => { const marker = `__DONE_${++n}__`; pending = { marker, resolve, reject }; child.stdin.write(`${text}\n;\n\\echo ${marker}\n`) })
 } }
}
function createDatabase(suffix: string, from?: string) {
 const name = `workspace_sharing_fixture_content_${process.pid}_${suffix}_${Date.now()}`
 const url = new URL(maintenance); url.pathname = "/" + name
 sql(`create database ${name}${from ? ` template ${from}` : ""};`, maintenance)
 return { name, url: url.toString() }
}
const payloadTables = ["organization_projects", "organization_tasks", "organization_project_notes", "organization_project_quick_links", "organization_project_overview_documents", "organization_project_activity_events", "task_tracker_import_batches", "notifications"]
const contentCount = `select (${payloadTables.map(table => `(select count(*) from public.${table} t where org_id='${id(1)}' and ${table === "organization_project_activity_events" ? "entity_type in('project','task','program') and " : table === "notifications" ? "type in('task_assigned','task_assignment_confirmed') and " : ""}strpos(to_jsonb(t)::text,'${sentinel}')>0)`).join("+")}+(select count(*) from public.programs t where user_id='${id(1)}' and strpos(to_jsonb(t)::text,'${sentinel}')>0)+(select count(*) from public.task_tracker_import_records t where batch_id='${id(50)}' and strpos(to_jsonb(t)::text,'${sentinel}')>0))::integer;`
const independentTables = ["organization_project_assets", "organization_finance_records", "fiscal_sponsorship_applications", "fiscal_sponsorship_documents", "fiscal_sponsorship_signature_packets", "fiscal_sponsorship_signatures", "public_map_claim_requests", "organization_document_files", "workspace_ai_runs", "organization_workspace_starter_state"]
const retained = `select jsonb_build_object(${independentTables.map(table => `'${table}',(select md5(string_agg(to_jsonb(t)::text,',' order by to_jsonb(t)::text)) from public.${table} t)`).join(",")},'users',(select md5(string_agg(to_jsonb(t)::text,',' order by id)) from auth.users t),'otherContent',jsonb_build_object(${payloadTables.map(table => `'${table}',(select md5(string_agg(to_jsonb(t)::text,',' order by to_jsonb(t)::text)) from public.${table} t where org_id is distinct from '${id(1)}')`).join(",")}), 'otherPrograms',(select md5(string_agg(to_jsonb(t)::text,',' order by id)) from public.programs t where user_id<>'${id(1)}'),'projectIdentity',(select jsonb_agg(to_jsonb(p)-array['name','description','client_name','type_label','duration_label','tags','member_labels','tracker_metadata','option_settings','guided_setup','updated_at'] order by id) from public.organization_projects p where org_id='${id(1)}'),'taskIdentity',(select jsonb_agg(to_jsonb(t)-array['title','description','tag_label','workstream_name','tracker_metadata','updated_at'] order by id) from public.organization_tasks t where org_id='${id(1)}'),'programIdentity',(select jsonb_agg(jsonb_build_array(id,user_id,image_url,goal_cents,raised_cents,start_date,end_date,is_public,created_at) order by id) from public.programs where user_id='${id(1)}'),'batchIdentity',(select jsonb_agg(to_jsonb(t)-array['manifest','result'] order by id) from public.task_tracker_import_batches t where org_id='${id(1)}'),'recordIdentity',(select jsonb_agg(to_jsonb(t)-array['source_payload','reason'] order by source_id) from public.task_tracker_import_records t where batch_id='${id(50)}'),'unrelatedActivity',(select jsonb_agg(to_jsonb(t) order by id) from public.organization_project_activity_events t where org_id='${id(1)}' and entity_type not in('project','task','program')),'notificationIdentity',(select jsonb_agg(case when type in('task_assigned','task_assignment_confirmed') then to_jsonb(t)-array['title','description','updated_at'] else to_jsonb(t) end order by id) from public.notifications t where org_id='${id(1)}'));`
function seed() {
 const record = { entityType: "Tasks", sourceId: "TASK-001", sourceRow: 1, source: { description: sentinel }, disposition: "created", destinationId: id(20), nativeType: "task", reason: sentinel }
 const noteRecord = { entityType: "Work Inbox", sourceId: "row-3", sourceRow: 3, source: { description: sentinel }, disposition: "reference", destinationId: id(30), nativeType: "note", reason: sentinel }
 const importManifest = { batchId: id(50), namespace: "coach-house-tracker-20260928", sourceHash: "a".repeat(64), orgId: id(1), actorId: id(1), links: [], projects: [{ id: id(10), content: sentinel }], tasks: [{ id: id(20), content: sentinel }], notes: [{ id: id(30), content: sentinel }], records: [record], auxiliaryRecords: [noteRecord] }
 sql(`begin;insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data,aud,role) select x.id,x.email,u.raw_user_meta_data,u.raw_app_meta_data,u.aud,u.role from (values('${id(1)}'::uuid,'c3-project@example.test'),('${id(2)}'::uuid,'c3-personal@example.test')) x(id,email) cross join lateral(select * from auth.users order by id limit 1)u;
 insert into public.organizations(user_id,profile,public_slug) values('${id(1)}','{"name":"C3 projects"}','c3-projects');
 set local request.jwt.claim.sub='${id(1)}';
 insert into public.organization_projects(id,org_id,name,description,start_date,end_date,client_name,type_label,duration_label,tags,member_labels,created_by,guided_setup,option_settings,tracker_metadata) values('${id(10)}','${id(1)}','${sentinel}','${sentinel}','2026-01-01','2026-12-01','${sentinel}','${sentinel}','${sentinel}',array['${sentinel}'],array['${sentinel}'],'${id(1)}','{"fiscalSponsorshipEnabled":true,"tasks":["${sentinel}"]}','{"tags":["${sentinel}"],"sprintTypes":["${sentinel}"],"fiscalSponsorshipEnabled":true}','{"source":"${sentinel}"}');
 insert into public.organization_tasks(id,org_id,project_id,title,description,tag_label,workstream_name,created_by,tracker_metadata) values('${id(20)}','${id(1)}','${id(10)}','${sentinel}','${sentinel}','${sentinel}','${sentinel}','${id(1)}','{"source":"${sentinel}"}');
 insert into public.organization_task_assignees(org_id,task_id,user_id,created_by) values('${id(1)}','${id(20)}','${id(2)}','${id(1)}');
 insert into public.organization_project_notes(id,org_id,project_id,title,content,created_by) values('${id(30)}','${id(1)}','${id(10)}','${sentinel}','${sentinel}','${id(1)}');
 insert into public.organization_project_quick_links(id,org_id,project_id,name,url,created_by) values('${id(31)}','${id(1)}','${id(10)}','${sentinel}','https://example.test/${sentinel}','${id(1)}');
 insert into public.organization_project_overview_documents(id,org_id,project_id,document_html,document_text,created_by) values('${id(32)}','${id(1)}','${id(10)}','${sentinel}','${sentinel}','${id(1)}');
 -- Model the supported historical Auth-only program shape; its old activity trigger assumes an organization.
 alter table public.programs disable trigger record_organization_program_activity;
 insert into public.programs(id,user_id,title,subtitle,slug,location,image_url,duration_label,features,status_label,goal_cents,raised_cents,address_street,address_city,address_state,address_postal,address_country,cta_label,cta_url,description,location_url,team_ids,wizard_snapshot) values('${id(40)}','${id(1)}','${sentinel}','${sentinel}','c3-project-program','${sentinel}','https://example.test/retained-image.png','${sentinel}',array['${sentinel}'],'${sentinel}',10000,5000,'${sentinel}','${sentinel}','${sentinel}','${sentinel}','${sentinel}','${sentinel}','https://example.test/${sentinel}','${sentinel}','https://example.test/${sentinel}',array['${sentinel}'],'{"content":"${sentinel}"}'),('${id(41)}','${id(2)}','Preserved personal program',null,null,null,null,null,null,null,100,0,null,null,null,null,null,null,null,null,null,'{}','{}');
 alter table public.programs enable trigger record_organization_program_activity;
 insert into public.organization_project_activity_events(org_id,entity_type,entity_id,event_type,title,from_status,to_status,metadata) values('${id(1)}','program','${id(40)}','status_changed','${sentinel}','${sentinel}','${sentinel}','{"content":"${sentinel}"}');
 insert into public.organization_finance_records(org_id,program_id,effective_at,record_type,direction,source_kind,source_label,amount_cents) values('${id(1)}','${id(40)}',now(),'donation','in','donations','Preserved explicit evidence',5000);
 insert into public.organization_project_assets(id,org_id,project_id,name,asset_type,storage_path,created_by) values('${id(60)}','${id(1)}','${id(10)}','Preserved mixed asset','file','${id(1)}/${id(60)}/retained.pdf','${id(1)}');
 insert into public.fiscal_sponsorship_applications(id,org_id,project_id,project_name,source_snapshot) values('${id(61)}','${id(1)}','${id(10)}','Preserved fiscal evidence','{"evidence":"preserve"}');
 insert into public.fiscal_sponsorship_documents(id,application_id,org_id,project_id,asset_id,kind,title) values('${id(62)}','${id(61)}','${id(1)}','${id(10)}','${id(60)}','application','Preserved signed source');
 insert into public.fiscal_sponsorship_signature_packets(id,application_id,document_id,org_id,project_id,provider_payload) values('${id(63)}','${id(61)}','${id(62)}','${id(1)}','${id(10)}','{"evidence":"preserve"}');
 insert into public.fiscal_sponsorship_signatures(packet_id,application_id,org_id,project_id,signer_id,signer_role,signer_name,signer_title,signature_method,signature_value,consent_version,consent_text,consent_sha256,signed_document_sha256,signature_sha256,signed_at) values('${id(63)}','${id(61)}','${id(1)}','${id(10)}','${id(1)}','applicant','Preserved signer','Director','typed','Preserved signature','v1','Preserved consent',repeat('a',64),repeat('b',64),repeat('c',64),now());
 insert into public.public_map_claim_requests(target_kind,listing_name,claimant_name,claimant_email,submission_key,risk_key,email_target_key,task_id) values('new','Preserved listing','Preserved claimant','claim@example.test','${id(64)}',repeat('d',64),repeat('e',64),'${id(20)}');
 insert into public.organization_project_activity_events(org_id,project_id,entity_type,entity_id,event_type,title,metadata) values('${id(1)}','${id(10)}','file','${id(60)}','created','Preserved file evidence','{"evidence":"preserve"}');
 insert into public.notifications(user_id,org_id,type,title,description,metadata) values('${id(2)}','${id(1)}','fiscal_signature_completed','Preserved fiscal notice','Preserved independent user notification','{"evidence":true}');
 insert into public.task_tracker_import_batches(id,namespace,source_hash,manifest_hash,org_id,actor_id,status,manifest,result) values('${id(50)}','coach-house-tracker-20260928',repeat('a',64),repeat('b',64),'${id(1)}','${id(1)}','complete',${literal(JSON.stringify(importManifest))},'{"copy":"${sentinel}"}');
 insert into public.task_tracker_import_records(namespace,entity_type,source_id,batch_id,source_row,source_payload,disposition,reason,destination_id,destination_version) values('coach-house-tracker-20260928','Tasks','TASK-001','${id(50)}',1,'{"description":"${sentinel}"}','created','${sentinel}','${id(20)}',now()),('coach-house-tracker-20260928','Work Inbox','row-3','${id(50)}',3,'{"description":"${sentinel}"}','reference','${sentinel}','${id(30)}',now());
 commit;`)
}

describe.skipIf(!template).sequential("expired closure owned project/task/program content retirement", () => {
 beforeAll(() => {
  const original = new URL(template!)
  if (original.hostname !== "127.0.0.1" || !/^\/workspace_sharing_fixture_[a-z0-9_]+$/.test(original.pathname) || original.password) throw new Error("Explicit isolated full-schema template required")
  const admin = new URL(original); admin.pathname = "/postgres"; maintenance = admin.toString()
  directory = mkdtempSync(join(tmpdir(), "ch-project-cleanup-"))
  source = createDatabase("source", original.pathname.slice(1)).url
  sql(readFileSync(migration, "utf8")); seed()
  expect(Number(sql(contentCount))).toBeGreaterThanOrEqual(12)
  backup = join(directory, "preclosure.sql"); command("pg_dump", ["--format=plain", "--file", backup, "--dbname", source])
 }, 30000)
 afterAll(async () => {
  for (const child of children) { child.stdin.end(); await new Promise<void>(resolve => child.once("close", () => resolve())) }
  if (directory) {
   const proof = { source, directory, results, migrationSha256: hash(readFileSync(migration, "utf8")), testSha256: hash(readFileSync("tests/acceptance/organization-closure-project-content-cleanup-database.test.ts", "utf8")), collectorSha256: hash(readFileSync(collector, "utf8")), manifestSha256: manifest ? hash(manifest) : null, quarantines: targetNames.map(name => JSON.parse(sql(`select jsonb_build_object('database',datname,'allowConnections',datallowconn,'sessions',(select count(*) from pg_stat_activity where datname=d.datname)) from pg_database d where datname='${name}'`, maintenance))), outcome: results.length === 8 ? "passed" : "partial", releaseQualified: false, captureComplete: false }
   writeFileSync(join(directory, "proof.json"), JSON.stringify(proof, null, 2)); writeFileSync("/tmp/ch-c3-project-content-cleanup-proof.json", JSON.stringify(proof, null, 2))
  }
 })
 it("requires actual operator, exact current expired request and normal isolation", () => {
  const before = sql(contentCount)
  sql(`begin;${deny(`perform ${purge()}`)}${close}${deny(`perform public.purge_expired_organization_project_content('${id(1)}','${id(801)}',1,'${id(900)}')`)}${deny(`perform public.purge_expired_organization_project_content('${id(1)}','${id(800)}',2,'${id(900)}')`)}update public.organization_closures set requested_at=statement_timestamp(),export_until=statement_timestamp()+interval '720 hours' where org_id='${id(1)}';${deny(`perform ${purge()}`)}rollback;`)
  for (const role of ["anon", "authenticated", "service_role"]) sql(`begin;set local role ${role};${deny(`perform ${purge()}`)}rollback;`)
  sql(`begin isolation level repeatable read;${deny(`perform ${purge()}`)}rollback;begin;set local session_replication_role=replica;${deny(`perform ${purge()}`)}rollback;`)
  expect(sql(contentCount)).toBe(before); sql(`begin;delete from public.programs where id='${id(41)}';rollback;begin;${close}commit;`)
  results.push("real operator, exact expired current identity, isolation and origin")
 })
 it("scrubs every owned payload and copy while preserving financial, identity, physical and personal records", () => {
  const before = sql(retained), capture = sql("select public.read_organization_suppression_events();")
  const result = JSON.parse(sql(`begin;select ${purge()};rollback;`))
  expect(result).toMatchObject({ projectsScrubbed: 1, tasksScrubbed: 1, programsScrubbed: 1, notesDeleted: 1, linksDeleted: 1, overviewsDeleted: 1, assigneesDeleted: 1, trackerBatchesScrubbed: 1, trackerRecordsScrubbed: 2, notificationPayloadsScrubbed: 1 })
  expect(sql(retained)).toBe(before); expect(sql("select public.read_organization_suppression_events();")).toBe(capture)
  results.push("complete project/task/program/note/overview/import/activity/notification payload scope")
 })
 it("fails atomically for held personal imports, arbitrary source identities and unproven notification ownership", () => {
  const before = sql(contentCount)
  for (const mutation of ["update public.task_tracker_import_records set disposition='held'", "update public.task_tracker_import_records set source_id='personal private name'", `update public.notifications set metadata='{"taskId":"${id(999)}"}' where org_id='${id(1)}'`]) {
   const table = mutation.includes("notifications") ? "notifications" : "task_tracker_import_records"
   sql(`begin;${table === "notifications" ? "" : `alter table public.${table} disable trigger project_task_closure;`}${mutation};${table === "notifications" ? "" : `alter table public.${table} enable trigger project_task_closure;`}${deny(`perform ${purge()}`)}rollback;`)
  }
  expect(sql(contentCount)).toBe(before); results.push("held personal imports, arbitrary identities and unproven notifications remain blocked")
 })
 it("rejects legacy cross-owner project children without harming other organizations", () => {
  const other = sql(`select user_id from public.organizations where user_id<>'${id(1)}' order by user_id limit 1;`)
  sql(`begin;alter table public.organization_project_notes disable trigger project_task_closure;update public.organization_project_notes set org_id='${other}' where id='${id(30)}';alter table public.organization_project_notes enable trigger project_task_closure;${deny(`perform ${purge()}`)}rollback;`)
  results.push("cross-owner project projection fails closed")
 })
 it("rolls back a late failure without partial content retirement or a reusable marker", () => {
  const before = sql(contentCount)
  sql(`begin;create function public.fixture_project_fail() returns trigger language plpgsql as $$begin raise exception 'fixture stop' using errcode='P0001';end$$;create trigger fixture_project_fail before update on public.notifications for each row execute function public.fixture_project_fail();${deny(`perform ${purge()}`, "P0001")}rollback;`)
  expect(sql(contentCount)).toBe(before); expect(sql("select count(*) from public.organization_closure_project_cleanups;")).toBe("0")
  results.push("late-copy failure atomically restores all content and marker")
 })
 it("serializes lifecycle and refuses busy source children before mutation", async () => {
  const held = session(); await held.query(`begin;select 1 from public.organization_tasks where org_id='${id(1)}' for update;`)
  sql(`begin;${deny(`perform ${purge()}`, "55P03")}rollback;`); await held.query("rollback;"); held.child.stdin.end()
  const owner = session(); await owner.query(`begin;select ${purge()};`)
  const waiting = session(); const pid = await waiting.query("select pg_backend_pid();")
  const pending = waiting.query(`begin;select 1 from public.organizations where user_id='${id(1)}' for update;rollback;`)
  try { await expect.poll(() => sql(`select count(*) from pg_stat_activity where pid=${pid} and wait_event_type='Lock';`), { timeout: 2000, interval: 50 }).toBe("1") }
  finally { await owner.query("rollback;"); owner.child.stdin.end(); await pending; waiting.child.stdin.end() }
  results.push("actual lifecycle serialization and child NOWAIT preservation")
 })
 it("commits exact lost-reply retry, retains enablement and denies ordinary edits after cleanup", () => {
  const before = sql(retained), first = sql(`select ${purge()};`)
  expect(sql(contentCount)).toBe("0"); expect(sql(retained)).toBe(before); expect(sql(`select ${purge()};`)).toBe(first)
  expect(sql(`select option_settings->>'fiscalSponsorshipEnabled'||':'||(guided_setup->>'fiscalSponsorshipEnabled') from public.organization_projects where id='${id(10)}';`)).toBe("true:true")
  expect(sql(`select public.closure_project_retirement_allowed('${id(1)}');`)).toBe("f")
  sql(`begin;${deny(`update public.organization_tasks set title='reopen' where id='${id(20)}'`)}${deny(`update public.programs set title='reopen' where id='${id(40)}'`)}${deny(`update public.task_tracker_import_records set source_payload='{"reopen":true}' where batch_id='${id(50)}'`)}${deny(`delete from public.organization_closure_project_cleanups`)}${deny(`truncate public.organization_closure_project_cleanups`)}rollback;`)
  sql(`select ${purge(901)};`); expect(sql(contentCount)).toBe("0"); expect(sql(retained)).toBe(before)
  results.push("all sentinels absent, exact retry, retained fiscal enablement and ordinary write denial")
 })
 it("replays pinned preclosure backup offline and safely repurges without losing independent records", async () => {
  const sourceId = sql("select source_id from public.organization_restore_identity;")
  const journal = join(directory, "suppression.sqlite"), exported = join(directory, "suppression.json")
  const captured = JSON.parse(command("python3", [collector, "--source", source, "--journal", journal, "--expected-source-id", sourceId]))
  command("python3", [collector, "--journal", journal, "--expected-source-id", sourceId, "--expected-sha256", captured.sha256, "--export", exported]); manifest = readFileSync(exported, "utf8")
  const target = createDatabase("restore"); targetNames.push(target.name); const operator = session(target.url); await operator.query("select current_user;")
  sql(`alter database ${target.name} allow_connections false;`, maintenance)
  const blocked = spawnSync("psql", ["-XqAt", "-d", target.url, "-c", "select 1"], { env, encoding: "utf8" }); expect(blocked.status).not.toBe(0)
  await operator.query(readFileSync(backup, "utf8").replaceAll("CREATE SCHEMA ", "CREATE SCHEMA IF NOT EXISTS "))
  expect(Number(await operator.query(contentCount))).toBeGreaterThan(0)
  await operator.query(`select public.replay_organization_suppression_history(${literal(manifest)},${literal(hash(manifest))});`)
  const before = await operator.query(retained); await operator.query(`select ${purge()};`)
  expect(await operator.query(contentCount)).toBe("0"); expect(await operator.query(retained)).toBe(before)
  await operator.query(`select ${purge()};`); expect(await operator.query("select datallowconn from pg_database where datname=current_database();")).toBe("f")
  operator.child.stdin.end(); await new Promise<void>(resolve => operator.child.once("close", () => resolve()))
  results.push("actual preclosure backup, pinned replay, same scoped repurge and retained quarantine")
 }, 30000)
})
