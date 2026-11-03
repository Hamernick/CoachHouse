import { createHash } from "node:crypto"
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from "node:child_process"
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

const template = process.env.ORGANIZATION_PROJECT_FILE_CLEANUP_TEST_DATABASE_URL
const migration = "supabase/migrations/20261103450000_organization_closure_project_file_cleanup.sql"
const collector = "docs/agent/organization-suppression-capture.py"
const env = { ...process.env, PGOPTIONS: "-c statement_timeout=10000 -c timezone=UTC" }
const id = (n: number) => `45000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const literal = (value: string) => "'" + value.replaceAll("'", "''") + "'"
const hash = (value: string) => createHash("sha256").update(value).digest("hex")
const sentinel = "PRIVATE_PROJECT_FILE_PURGE_450000"
let source: string, maintenance: string, directory: string, backup: string, manifest = ""
const results: string[] = [], targetNames: string[] = []
const children = new Set<ChildProcessWithoutNullStreams>()
function command(program: string, args: string[], input?: string) {
 const r = spawnSync(program, args, { input, env, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })
 expect(r.status, r.stderr).toBe(0); return r.stdout.trim()
}
const sql = (query: string, url = source) => command("psql", ["-XqAt", "-v", "ON_ERROR_STOP=1", "-d", url], query)
const deny = (statement: string, code = "42501") => `do $test$ begin begin ${statement};raise exception 'Unexpected success' using errcode='P9999';exception when others then if sqlstate<>'${code}' then raise;end if;end;end $test$;`
const origin = "http://127.0.0.1:55321"
const reserve = (n = 100) => `public.reserve_expired_closure_asset_purge('${id(1)}','${id(n)}','${id(800)}',1,'${id(n + 1000)}','${origin}')`
const finish = (n = 100) => `public.finish_expired_closure_asset_purge('${id(1)}','${id(n)}','${id(800)}',1,'${id(n + 1000)}','${origin}')`
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
const path = (n: number) => `${id(1)}/${id(200)}/1793683000${String(n).padStart(3,"0")}-financial-plan.pdf`
const metadata = (op=900) => `public.purge_expired_organization_project_file_metadata('${id(1)}','${id(800)}',1,'${id(op)}')`
const removeMetadata = (n:number) => `set local storage.allow_delete_query='true';set local request.jwt.claim.role='service_role';delete from storage.objects where id='${id(n)}';`
const snapshot = `select jsonb_build_object('other',(select to_jsonb(o) from public.organizations o where user_id='${id(2)}'),'auth',(select md5(string_agg(to_jsonb(t)::text,',' order by id)) from auth.users t),'fiscal',(select md5(string_agg(to_jsonb(t)::text,',' order by id)) from public.fiscal_sponsorship_applications t),'fiscalDocs',(select md5(string_agg(to_jsonb(t)::text,',' order by id)) from public.fiscal_sponsorship_documents t),'protectedAsset',(select to_jsonb(a) from public.organization_project_assets a where id='${id(502)}'),'protectedExternal',(select to_jsonb(a) from public.organization_project_assets a where id='${id(505)}'));`
const fiscalLink = (n:number) => `insert into public.fiscal_sponsorship_documents(id,application_id,org_id,project_id,asset_id,kind,title,version) values('${id(700+n)}','${id(201)}','${id(2)}','${id(202)}','${id(500+n)}','application','Preserved financial evidence',${n+1})`
function seed() {
 sql(`begin;set local request.jwt.claim.role='service_role';insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data,aud,role) select x.id,x.email,u.raw_user_meta_data,u.raw_app_meta_data,u.aud,u.role from (values('${id(1)}'::uuid,'c3-project-files@example.test'),('${id(2)}'::uuid,'c3-project-files-other@example.test')) x(id,email) cross join lateral(select * from auth.users order by id limit 1)u;
 insert into public.organizations(user_id,profile,public_slug) values('${id(1)}','{"name":"Project files"}','c3-project-files'),('${id(2)}','{"name":"Preserved"}','c3-project-files-other');
 set local request.jwt.claim.sub='${id(1)}';
 insert into public.organization_projects(id,org_id,name,start_date,end_date,created_by) values('${id(200)}','${id(1)}','Project','2026-01-01','2026-12-01','${id(1)}'),('${id(202)}','${id(2)}','Independent financial parent','2026-01-01','2026-12-01','${id(2)}');
 insert into public.fiscal_sponsorship_applications(id,org_id,project_id,source_snapshot) values('${id(201)}','${id(2)}','${id(202)}','{}');
 insert into public.organization_project_assets(id,org_id,project_id,name,description,asset_type,storage_path,created_by) values ${[0,1,2,3].map(n=>`('${id(500+n)}','${id(1)}','${id(200)}','${sentinel}','${sentinel}','pdf','${path(100+n)}','${id(1)}')`).join(',')};
 insert into public.organization_project_assets(id,org_id,project_id,name,description,asset_type,external_url,created_by) values ${[4,5].map(n=>`('${id(500+n)}','${id(1)}','${id(200)}','${sentinel}','${sentinel}','file','https://external.example.test/${n}','${id(1)}')`).join(',')};
 ${fiscalLink(2)};${fiscalLink(5)};
 insert into storage.objects(id,bucket_id,name,owner,owner_id,metadata) values ${[100,101,102,103].map(n=>`('${id(n)}','project-assets','${path(n)}','${id(1)}','${id(1)}','{"size":10}')`).join(',')},('${id(104)}','project-assets','${id(1)}/${id(200)}/fiscal-uploads/${id(1)}/evidence.pdf','${id(1)}','${id(1)}','{"size":10}');
 insert into public.organization_project_activity_events(id,org_id,entity_type,entity_id,event_type,title,actor_id,metadata) values
 ('${id(600)}','${id(1)}','file','${id(999)}','updated','${sentinel}','${id(1)}','{"source":"organization_document_files","secret":"${sentinel}"}'),
 ('${id(601)}','${id(1)}','document','${id(1)}','updated','${sentinel}','${id(1)}','{"documentKey":"policy:${id(70)}","secret":"${sentinel}"}'),
 ('${id(602)}','${id(1)}','document','${id(1)}','updated','${sentinel}','${id(1)}','{"documentKey":"roadmap:budget","secret":"${sentinel}"}'),
 ('${id(603)}','${id(1)}','document','${id(1)}','updated','${sentinel}','${id(1)}','{"documentKey":"upload:bylaws","secret":"${sentinel}"}'),
 ('${id(604)}','${id(1)}','document','${id(1)}','updated','${sentinel}','${id(1)}','{"documentKey":"unknown:raw","secret":"${sentinel}"}');commit;`)
}
describe.skipIf(!template).sequential("closure ordinary project files and exact activity copies", () => {
 beforeAll(() => {
  const original = new URL(template!)
  if (original.hostname !== "127.0.0.1" || !/^\/workspace_sharing_fixture_[a-z0-9_]+$/.test(original.pathname) || original.password) throw new Error("Explicit isolated full-schema template required")
  const admin=new URL(original);admin.pathname="/postgres";maintenance=admin.toString()
  directory=mkdtempSync(join(tmpdir(),"ch-project-file-cleanup-"));source=createDatabase("project_file",original.pathname.slice(1)).url
  sql(readFileSync(migration,"utf8"));seed()
  expect(sql("select has_function_privilege('authenticated','public.organization_closure_command(uuid,uuid,text,uuid,integer)','EXECUTE');")).toBe("f")
  backup=join(directory,"preclosure.sql");command("pg_dump",["--format=plain","--file",backup,"--dbname",source])
 },30000)
 afterAll(async()=>{
  for(const child of children){child.stdin.end();await new Promise<void>(resolve=>child.once("close",()=>resolve()))}
  if(directory){const proof={source,directory,results,migrationSha256:hash(readFileSync(migration,"utf8")),testSha256:hash(readFileSync("tests/acceptance/organization-closure-project-file-cleanup-database.test.ts","utf8")),manifestSha256:manifest?hash(manifest):null,outcome:results.length===7?"passed":"partial",storageApiOrBackendProof:false,releaseQualified:false,quarantines:targetNames.map(name=>JSON.parse(sql(`select jsonb_build_object('database',datname,'allowConnections',datallowconn,'sessions',(select count(*) from pg_stat_activity where datname=d.datname)) from pg_database d where datname='${name}'`,maintenance)))};writeFileSync("/tmp/ch-c3-project-file-database-proof.json",JSON.stringify(proof,null,2))}
 })
 it("requires actual operator and exact cleanup eligibility without API grants",()=>{
  sql(`begin;${deny(`perform ${metadata()}`)}${deny(`perform ${reserve()}`,"40001")}${close}${deny(`perform public.purge_expired_organization_project_file_metadata('${id(1)}','${id(801)}',1,'${id(900)}')`)}rollback;`)
  for(const role of ["anon","authenticated","service_role"])sql(`begin;set local role ${role};${deny(`perform ${metadata()}`)}${deny(`perform ${reserve()}`)}rollback;`)
  sql(`begin isolation level repeatable read;${deny(`perform ${metadata()}`)}rollback;begin;set local session_replication_role=replica;${deny(`perform ${metadata()}`)}rollback;begin;${close}commit;`)
  // Separate transaction: captured early confirmation admits both owners without
  // moving the original deadline. All fixture effects are rolled back.
  sql(`begin;insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data,aud,role) select '${id(3)}','c3-early-project-files@example.test',raw_user_meta_data,raw_app_meta_data,aud,role from auth.users order by id limit 1;insert into public.organizations(user_id,profile,public_slug) values('${id(3)}','{}','c3-early-project-files');insert into public.organization_closures(org_id,state,revision,request_id,requested_at,export_until) values('${id(3)}','closing',1,'${id(803)}',statement_timestamp(),statement_timestamp()+interval '720 hours');insert into public.organization_closure_operations(org_id,operation_id,action,expected_revision,completed_at) select org_id,request_id,'request',0,requested_at from public.organization_closures where org_id='${id(3)}';${deny(`perform public.purge_expired_organization_project_file_metadata('${id(3)}','${id(803)}',1,'${id(903)}')`)}select public.confirm_organization_early_deletion('${id(3)}','${id(3)}','${id(803)}',1,'${id(904)}','organization-early-deletion-v1',true);select public.purge_expired_organization_project_file_metadata('${id(3)}','${id(803)}',1,'${id(903)}');select public.assert_expired_document_closure('${id(3)}','${id(803)}',1);rollback;`)
  results.push("exact cleanup eligibility, captured early-confirmation admission, actual operator/isolation/origin, unchanged API denial")
 })
 it("blocks actual fiscal FK, legacy fiscal paths, shared paths and canonical identity mismatch",()=>{
  sql(`begin;${deny(`perform ${reserve(102)}`,"PT409")}${deny(`perform ${reserve(104)}`,"PT409")}rollback;`)
  sql(`begin;update public.organizations set profile=profile||jsonb_build_object('reference','${path(100)}') where user_id='${id(2)}';${deny(`perform ${reserve()}`,"PT409")}rollback;`)
  const before=sql(snapshot);sql(`begin;select ${reserve()};${deny(`perform ${finish()}`,"PT409")}${removeMetadata(100)}select ${finish()};rollback;`);expect(sql(snapshot)).toBe(before)
  results.push("real financial FK and fiscal upload path protected; ordinary financial-plan filename eligible; shared path blocked")
 })
 it("serializes a live fiscal ID writer before reservation, rejects late FK and encoded JSON references",async()=>{
  const fkWriter=session();await fkWriter.query(`begin;${fiscalLink(0)};`)
  sql(`begin;${deny(`perform ${reserve()}`,"55P03")}rollback;`);await fkWriter.query("rollback;");fkWriter.child.stdin.end()
  const writer=session();await writer.query(`begin;update public.fiscal_sponsorship_applications set source_snapshot=jsonb_build_object('asset','${id(500)}') where id='${id(201)}';`)
  const operator=session();const pid=await operator.query("select pg_backend_pid();");const pending=operator.query(`begin;${deny(`perform ${reserve()}`,"PT409")}rollback;`)
  try{await expect.poll(()=>sql(`select count(*) from pg_stat_activity where pid=${pid} and wait_event_type='Lock'`),{timeout:2000,interval:50}).toBe("1")}
  finally{await writer.query("commit;");writer.child.stdin.end()}
  await pending;operator.child.stdin.end();sql(`update public.fiscal_sponsorship_applications set source_snapshot='{}' where id='${id(201)}';`)
  const pathWriter=session();await pathWriter.query(`begin;update public.organizations set profile=profile||jsonb_build_object('asset','${path(100)}') where user_id='${id(2)}';`)
  const pathOperator=session();const pathPid=await pathOperator.query("select pg_backend_pid();");const pathPending=pathOperator.query(`begin;${deny(`perform ${reserve()}`,"PT409")}rollback;`)
  try{await expect.poll(()=>sql(`select count(*) from pg_stat_activity where pid=${pathPid} and wait_event_type='Lock'`),{timeout:2000,interval:50}).toBe("1")}
  finally{await pathWriter.query("commit;");pathWriter.child.stdin.end();await pathPending;pathOperator.child.stdin.end()}
  sql(`update public.organizations set profile=profile-'asset' where user_id='${id(2)}';`)
  results.push("actual two-session fiscal FK/JSON asset ID and same-path alias serialization")
 })
 it("fences late path/ID aliases and preserves exact physical source until absence",()=>{
  sql(`select ${reserve(101)};begin;${deny(`insert into public.fiscal_sponsorship_documents(id,application_id,org_id,project_id,asset_id,kind,title,version) values('${id(701)}','${id(201)}','${id(2)}','${id(202)}','${id(501)}','application','Late',20)`,"PT409")}${deny(`update public.fiscal_sponsorship_applications set source_snapshot=jsonb_build_object('asset','${id(501)}') where id='${id(201)}'`,"PT409")}${deny(`update public.organizations set profile=profile||jsonb_build_object('file',replace('${path(101)}','/','%2F')) where user_id='${id(2)}'`,"PT409")}${deny(`perform ${finish(101)}`,"PT409")}${deny(`delete from public.organization_closure_asset_cleanups`)}rollback;`)
  results.push("late FK/JSON/path aliases denied, physical source retained before absence, immutable receipt")
 })
 it("retires physical source and external bindings plus exact historical copies, with durable retries",()=>{
  const before=sql(snapshot)
  for(const n of [100,101,103])sql(`begin;select ${reserve(n)};${removeMetadata(n)}select ${finish(n)};commit;`)
  const result=JSON.parse(sql(`select ${metadata()}`));expect(result.deletedExternalBindings).toBe(1);expect(result.retiredActivityPayloads).toBeGreaterThanOrEqual(8)
  expect(sql(snapshot)).toBe(before);expect(JSON.parse(sql(`select ${metadata()}`))).toEqual(result)
  expect(sql(`select count(*) from public.organization_project_activity_events where id in('${id(600)}','${id(601)}','${id(602)}','${id(603)}') and to_jsonb(organization_project_activity_events)::text like '%${sentinel}%';`)).toBe("0")
  expect(sql(`select title from public.organization_project_activity_events where id='${id(604)}'`)).toBe(sentinel)
  sql(`begin;${deny(`truncate public.organization_closure_project_file_cleanups`)}${deny(`update public.organization_project_assets set name='write' where id='${id(502)}'`)}${deny(`update public.fiscal_sponsorship_applications set source_snapshot=jsonb_build_object('asset','${id(504)}') where id='${id(201)}'`,"PT409")}rollback;`)
  expect(JSON.parse(sql(`select ${reserve()}`)).complete).toBe(true);results.push("source/HTTP-independent external binding retirement, exact activity scrub, retained financial/unknown records and lost reply retry")
 })
 it("keeps metadata batch atomic on a downstream failure",()=>{
  sql(`begin;create function public.fixture_project_file_fail() returns trigger language plpgsql as $$begin raise exception 'stop' using errcode='P0001';end$$;create trigger fixture_project_file_fail before insert on public.organization_closure_project_file_cleanups for each row execute function public.fixture_project_file_fail();${deny(`perform ${metadata(901)}`,"P0001")}rollback;`)
  expect(sql(`select count(*) from public.organization_closure_project_file_cleanups where operation_id='${id(901)}'`)).toBe("0");results.push("failed transaction leaves no false receipt or partial deletion")
 })
 it("replays a pinned preclosure backup offline and repurges the same sources",async()=>{
  const sourceId=sql("select source_id from public.organization_restore_identity"),journal=join(directory,"suppression.sqlite"),exported=join(directory,"suppression.json")
  const captured=JSON.parse(command("python3",[collector,"--source",source,"--journal",journal,"--expected-source-id",sourceId]));command("python3",[collector,"--journal",journal,"--expected-source-id",sourceId,"--expected-sha256",captured.sha256,"--export",exported]);manifest=readFileSync(exported,"utf8")
  const target=createDatabase("project_file_restore");targetNames.push(target.name);const operator=session(target.url);await operator.query("select current_user;");sql(`alter database ${target.name} allow_connections false`,maintenance)
  await operator.query(readFileSync(backup,"utf8").replaceAll("CREATE SCHEMA ","CREATE SCHEMA IF NOT EXISTS "));await operator.query(`select public.replay_organization_suppression_history(${literal(manifest)},${literal(hash(manifest))});`)
  const before=await operator.query(snapshot);await operator.query(`begin;select ${reserve()};${removeMetadata(100)}select ${finish()};select ${metadata()};commit;`);expect(await operator.query(snapshot)).toBe(before);expect(await operator.query(`select count(*) from public.organization_project_assets where id in('${id(500)}','${id(504)}')`)).toBe("0")
  operator.child.stdin.end();await new Promise<void>(resolve=>operator.child.once("close",()=>resolve()));results.push("preclosure backup, pinned replay, scoped repurge with target offline; no hosted/physical byte claim")
 },30000)
})
