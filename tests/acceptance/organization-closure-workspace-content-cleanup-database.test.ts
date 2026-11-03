import { createHash } from "node:crypto"
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from "node:child_process"
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

const template = process.env.ORGANIZATION_WORKSPACE_CLEANUP_TEST_DATABASE_URL
const migration = "supabase/migrations/20261103340000_organization_closure_workspace_content_cleanup.sql"
const collector = "docs/agent/organization-suppression-capture.py"
const env = { ...process.env, PGOPTIONS: "-c statement_timeout=10000 -c timezone=UTC" }
const id = (n: number) => `34000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const literal = (value: string) => "'" + value.replaceAll("'", "''") + "'"
const hash = (value: string) => createHash("sha256").update(value).digest("hex")
const sentinel = "PRIVATE_WORKSPACE_PURGE_340000"
let source: string, maintenance: string, directory: string, backup: string, manifest = ""
const results: string[] = [], targetNames: string[] = []
const children = new Set<ChildProcessWithoutNullStreams>()
function command(program: string, args: string[], input?: string) {
 const r = spawnSync(program, args, { input, env, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })
 expect(r.status, r.stderr).toBe(0); return r.stdout.trim()
}
const sql = (query: string, url = source) => command("psql", ["-XqAt", "-v", "ON_ERROR_STOP=1", "-d", url], query)
const deny = (statement: string, code = "42501") => `do $test$ begin begin ${statement};raise exception 'Unexpected success' using errcode='P9999';exception when others then if sqlstate<>'${code}' then raise;end if;end;end $test$;`
const purge = (operation = 900) => `public.purge_expired_organization_workspace_content('${id(1)}','${id(800)}',1,'${id(operation)}')`
const responses = `select public.purge_expired_organization_form_responses('${id(1)}','${id(800)}',1,'${id(850)}');`
const close = `insert into public.organization_closures(org_id,state,revision,request_id,requested_at,export_until) values('${id(1)}','closing',1,'${id(800)}',statement_timestamp()-interval '31 days',statement_timestamp()-interval '31 days'+interval '720 hours');insert into public.organization_closure_operations(org_id,operation_id,action,expected_revision,completed_at) select org_id,request_id,'request',0,requested_at from public.organization_closures where org_id='${id(1)}';`
const contentTables = ["organization_workspace_boards", "organization_workspace_pages", "organization_form_versions", "organization_data_tables", "organization_data_rows", "organization_data_views", "organization_data_view_receipts"]
const contentCount = `select (${contentTables.map(table => `(select count(*) from public.${table} t where org_id='${id(1)}' and strpos(to_jsonb(t)::text,'${sentinel}')>0)`).join("+")})::integer;`
const otherContent = contentTables.map(table => `'${table}',(select md5(string_agg(to_jsonb(t)::text,',' order by to_jsonb(t)::text)) from public.${table} t where org_id<>'${id(1)}')`).join(",")
const preserved = `select jsonb_build_object('otherContent',jsonb_build_object(${otherContent}),'users',(select md5(string_agg(to_jsonb(t)::text,',' order by id)) from auth.users t),'profiles',(select md5(string_agg(to_jsonb(t)::text,',' order by id)) from public.profiles t),'files',(select md5(string_agg(to_jsonb(t)::text,',' order by id)) from public.organization_document_files t),'projects',(select md5(string_agg(to_jsonb(t)::text,',' order by id)) from public.organization_projects t),'ai',(select md5(string_agg(to_jsonb(t)::text,',' order by id)) from public.workspace_ai_runs t),'otherOrg',(select md5(string_agg(to_jsonb(t)::text,',' order by org_id)) from public.organization_workspace_boards t where org_id<>'${id(1)}'),'forms',(select jsonb_agg(to_jsonb(t) order by id) from public.organization_forms t where org_id='${id(1)}'),'versions',(select jsonb_agg(to_jsonb(t)-'version' order by id) from public.organization_form_versions t where org_id='${id(1)}'),'pages',(select jsonb_agg(to_jsonb(t)-array['title','description','published_snapshot','published_at','guest_snapshot'] order by id) from public.organization_workspace_pages t where org_id='${id(1)}'),'receipts',(select jsonb_agg(to_jsonb(t)-array['command','result'] order by request_id) from public.organization_data_view_receipts t where org_id='${id(1)}'),'formOperations',(select jsonb_agg(to_jsonb(t) order by operation_id) from public.organization_form_source_operations t where org_id='${id(1)}'),'guestReceipts',(select jsonb_agg(to_jsonb(t) order by operation_id) from public.workspace_page_guest_receipts t where page_id='${id(20)}'),'noteReceipts',(select jsonb_agg(to_jsonb(t) order by operation_id) from public.workspace_page_note_receipts t where org_id='${id(1)}'),'tombstones',(select jsonb_agg(to_jsonb(t) order by response_id) from public.organization_form_response_deletions t where version_id in('${id(100)}','${id(101)}')));`
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
function seed() {
 const form = (n: number) => ({ id: id(n), type: "activity", title: sentinel + n, data: { widget: { kind: "form", definition: { questions: [{ id: id(90), type: "short_text", label: sentinel }] } } } })
 const event = { id: id(12), type: "activity", title: sentinel + "event", data: { widget: { kind: "event", startsAt: "2026-12-01T00:00:00Z", location: sentinel } } }
 const board = { particleGraph: { workspaceId: id(1), particles: [form(10), event] }, workspaceCatalog: { version: 1, defaultName: sentinel, entries: [{ id: id(30), name: sentinel, state: { particleGraph: { workspaceId: id(1), particles: [form(11)] } } }] } }
 const snapshot = { version: 1, brand: { name: sentinel, organizationSlug: "c3-workspace" }, title: sentinel, description: sentinel, items: [{ id: id(10), title: sentinel, content: { kind: "text" } }] }
 sql(`begin;insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data,aud,role) select '${id(1)}','c3-workspace@example.test',raw_user_meta_data,raw_app_meta_data,aud,role from auth.users order by id limit 1;
 insert into public.organizations(user_id,profile,public_slug) values('${id(1)}','{"name":"C3 workspace"}','c3-workspace');
 set local request.jwt.claim.sub='${id(1)}';
 insert into public.organization_workspace_boards(org_id,state,updated_by) values('${id(1)}',${literal(JSON.stringify(board))},'${id(1)}');
 insert into public.organization_workspace_pages(id,org_id,title,description,particle_ids,visibility,published_snapshot,published_at,canvas_id) values
 ('${id(20)}','${id(1)}','${sentinel}','${sentinel}',array['${id(10)}'::uuid],'public',${literal(JSON.stringify(snapshot))},clock_timestamp(),null),
 ('${id(21)}','${id(1)}','${sentinel}','${sentinel}',array['${id(11)}'::uuid],'private',${literal(JSON.stringify(snapshot))},clock_timestamp(),'${id(30)}');
 insert into public.organization_form_versions(id,org_id,form_id,page_id,version) values('${id(100)}','${id(1)}','${id(10)}','${id(20)}','{"definition":{"questions":[{"label":"${sentinel}"}]}}'),('${id(101)}','${id(1)}','${id(11)}','${id(21)}','{"named":"${sentinel}"}');
 insert into public.organization_form_responses(version_id,id,original_hash,answers,submitted_at) values('${id(100)}','${id(200)}',repeat('a',64),'[{"value":"${sentinel}"}]',now()-interval '32 days');
 insert into public.organization_data_tables(id,org_id,name,columns,provenance) values('${id(300)}','${id(1)}','${sentinel}','[{"key":"name","label":"${sentinel}","type":"text","writable":true,"options":[]}]','{"filename":"${sentinel}"}');
 insert into public.organization_data_rows(id,org_id,table_id,"values") values('${id(301)}','${id(1)}','${id(300)}','{"name":"${sentinel}"}');
 insert into public.organization_data_views(id,org_id,name,source,table_id,config,response_version_id) values('${id(302)}','${id(1)}','${sentinel}','table','${id(300)}','{"filter":"${sentinel}"}',null),('${id(303)}','${id(1)}','${sentinel}','responses',null,'{"filter":"${sentinel}"}','${id(100)}');
 insert into public.organization_data_view_receipts(org_id,request_id,actor_id,command,result) values('${id(1)}','${id(304)}','${id(1)}','{"import":"${sentinel}"}','{"cell":"${sentinel}"}');
 insert into public.organization_form_source_operations(org_id,form_id,operation_id,actor_id,operation_hash,revision) values('${id(1)}','${id(10)}','${id(400)}','${id(1)}',repeat('a',64),'retained-revision');
 insert into public.workspace_page_guest_receipts(page_id,actor_id,operation_id,command_hash,action,result_revision,changed_fields) values('${id(20)}','${id(1)}','${id(401)}',repeat('a',64),'edit',1,array['title']);
 insert into public.workspace_page_note_receipts(page_id,org_id,operation_id,actor_id,command_hash,action,particle_id,result_page_revision,result_note_revision) values('${id(20)}','${id(1)}','${id(402)}','${id(1)}',repeat('a',64),'write','${id(13)}',1,1);commit;`)
}

describe.skipIf(!template).sequential("expired closure coherent workspace content retirement", () => {
 beforeAll(() => {
  const original = new URL(template!)
  if (original.hostname !== "127.0.0.1" || !/^\/workspace_sharing_fixture_[a-z0-9_]+$/.test(original.pathname) || original.password) throw new Error("Explicit isolated full-schema template required")
  const admin = new URL(original); admin.pathname = "/postgres"; maintenance = admin.toString()
  directory = mkdtempSync(join(tmpdir(), "ch-workspace-cleanup-"))
  source = createDatabase("source", original.pathname.slice(1)).url
  sql(readFileSync(migration, "utf8")); seed()
  expect(Number(sql(contentCount))).toBeGreaterThanOrEqual(10)
  expect(sql("select udt_name from information_schema.columns where table_schema='public' and table_name='organization_workspace_pages' and column_name='particle_ids';")).toBe("_uuid")
  backup = join(directory, "preclosure.sql"); command("pg_dump", ["--format=plain", "--file", backup, "--dbname", source])
 }, 30000)
 afterAll(async () => {
  for (const child of children) { child.stdin.end(); await new Promise<void>(resolve => child.once("close", () => resolve())) }
  if (directory) {
   const proof = { source, directory, results, migrationSha256: hash(readFileSync(migration, "utf8")), testSha256: hash(readFileSync("tests/acceptance/organization-closure-workspace-content-cleanup-database.test.ts", "utf8")), collectorSha256: hash(readFileSync(collector, "utf8")), manifestSha256: manifest ? hash(manifest) : null, quarantines: targetNames.map(name => JSON.parse(sql(`select jsonb_build_object('database',datname,'allowConnections',datallowconn,'sessions',(select count(*) from pg_stat_activity where datname=d.datname)) from pg_database d where datname='${name}'`, maintenance))), outcome: results.length === 7 ? "passed" : "partial", releaseQualified: false, captureComplete: false }
   writeFileSync(join(directory, "proof.json"), JSON.stringify(proof, null, 2)); writeFileSync("/tmp/ch-c3-workspace-content-cleanup-proof.json", JSON.stringify(proof, null, 2))
  }
 })
 it("requires exact expired closure, prior response cleanup, real operator and normal isolation", () => {
  const before = sql(contentCount)
  sql(`begin;${deny(`perform ${purge()}`)}${close}${deny(`perform ${purge()}`)}${responses}
   ${deny(`perform public.purge_expired_organization_workspace_content('${id(1)}','${id(801)}',1,'${id(900)}')`)}
   ${deny(`perform public.purge_expired_organization_workspace_content('${id(1)}','${id(800)}',2,'${id(900)}')`)}
   update public.organization_closures set requested_at=statement_timestamp(),export_until=statement_timestamp()+interval '720 hours' where org_id='${id(1)}';${deny(`perform ${purge()}`)}rollback;`)
  for (const role of ["anon", "authenticated", "service_role"]) sql(`begin;set local role ${role};${deny(`perform ${purge()}`)}rollback;`)
  sql(`begin isolation level repeatable read;${deny(`perform ${purge()}`)}rollback;`)
  expect(sql(contentCount)).toBe(before); results.push("private operator, exact expired identity and native-response prerequisite")
 })
 it("erases all scoped sentinel payloads while retaining identities, tombstones and independent owners", () => {
  sql(`begin;${close}${responses}commit;`)
  const before = sql(preserved), capture = sql("select public.read_organization_suppression_events();")
  const result = JSON.parse(sql(`begin;select ${purge()};rollback;`))
  expect(result).toMatchObject({ boardsDeleted: 1, pagesScrubbed: 2, formVersionsScrubbed: 2, tablesDeleted: 1, rowsDeleted: 1, viewsDeleted: 2, receiptPayloadsScrubbed: 1 })
  expect(sql(preserved)).toBe(before); expect(sql("select public.read_organization_suppression_events();")).toBe(capture)
  results.push("complete root/named/page/form/table/receipt payload scope and protected identities")
 })
 it("rolls back the whole retirement when a late receipt mutation fails", () => {
  const before = sql(contentCount)
  sql(`begin;create function public.fixture_workspace_fail() returns trigger language plpgsql as $$begin raise exception 'fixture stop' using errcode='P0001';end$$;create trigger fixture_workspace_fail before update on public.organization_data_view_receipts for each row execute function public.fixture_workspace_fail();${deny(`perform ${purge()}`, "P0001")}rollback;`)
  expect(sql(contentCount)).toBe(before)
  expect(sql("select count(*) from public.organization_closure_workspace_cleanups;")).toBe("0")
  results.push("late failure atomic rollback without live marker or partial payload removal")
 })
 it("rejects cross-owner table projections and preserves unrelated content", () => {
  const other = sql(`select user_id from public.organizations where user_id<>'${id(1)}' order by user_id limit 1;`)
  // Real FK allows org_id/table_id disagreement; ordinary trigger prevents creation.
  // Model a preexisting legacy inconsistency with only this owned disposable trigger disabled.
  sql(`begin;alter table public.organization_data_rows disable trigger data_view_closure;insert into public.organization_data_rows(id,org_id,table_id,"values") values('${id(305)}','${other}','${id(300)}','{"preserve":"independent"}');alter table public.organization_data_rows enable trigger data_view_closure;${deny(`perform ${purge()}`)}rollback;`)
  results.push("legacy cross-owner projection fails closed")
 })
 it("serializes with organization lifecycle and refuses busy child content without partial work", async () => {
  const held = session(); await held.query(`begin;select 1 from public.organization_workspace_boards where org_id='${id(1)}' for update;`)
  sql(`begin;${deny(`perform ${purge()}`, "55P03")}rollback;`)
  await held.query("rollback;"); held.child.stdin.end()
  const owner = session(); await owner.query(`begin;select ${purge()};`)
  const waiting = session(); const waitingPid = await waiting.query("select pg_backend_pid();")
  const pending = waiting.query(`begin;select 1 from public.organizations where user_id='${id(1)}' for update;rollback;`)
  try {
   await expect.poll(() => sql(`select count(*) from pg_stat_activity where pid=${waitingPid} and wait_event_type='Lock';`), { timeout: 2000, interval: 50 }).toBe("1")
  } finally {
   await owner.query("rollback;"); owner.child.stdin.end(); await pending; waiting.child.stdin.end()
  }
  results.push("organization serialization and child NOWAIT preservation")
 })
 it("commits exact lost-reply retry and leaves ordinary APIs and marker reuse denied", () => {
  const before = sql(preserved), first = sql(`select ${purge()};`)
  expect(sql(contentCount)).toBe("0"); expect(sql(preserved)).toBe(before)
  expect(sql(`select ${purge()};`)).toBe(first)
  expect(sql(`select public.closure_workspace_retirement_allowed('${id(1)}');`)).toBe("f")
  sql(`begin;${deny(`insert into public.organization_workspace_boards(org_id,state) values('${id(1)}','{}')`)}${deny(`update public.organization_data_view_receipts set result='{"restore":"private"}' where org_id='${id(1)}'`)}${deny(`delete from public.organization_closure_workspace_cleanups`)}${deny(`truncate public.organization_closure_workspace_cleanups`)}rollback;`)
  sql(`begin;set local role service_role;${deny(`perform public.organization_form_source_command('${id(1)}','{"organizationId":"${id(1)}","formId":"${id(10)}","action":"read_form_source"}')`)}rollback;`)
  results.push("complete payload purge, exact retry and ordinary API/marker/receipt denial")
 })
 it("replays pinned preclosure backup offline then repurges the same content without losing suppression identities", async () => {
  const sourceId = sql("select source_id from public.organization_restore_identity;")
  const journal = join(directory, "suppression.sqlite"), exported = join(directory, "suppression.json")
  const captured = JSON.parse(command("python3", [collector, "--source", source, "--journal", journal, "--expected-source-id", sourceId]))
  command("python3", [collector, "--journal", journal, "--expected-source-id", sourceId, "--expected-sha256", captured.sha256, "--export", exported]); manifest = readFileSync(exported, "utf8")
  const target = createDatabase("restore"); targetNames.push(target.name)
  const operator = session(target.url); await operator.query("select current_user;")
  sql(`alter database ${target.name} allow_connections false;`, maintenance)
  const blocked = spawnSync("psql", ["-XqAt", "-d", target.url, "-c", "select 1"], { env, encoding: "utf8" }); expect(blocked.status).not.toBe(0); expect(blocked.stderr).toContain("not currently accepting connections")
  await operator.query(readFileSync(backup, "utf8").replaceAll("CREATE SCHEMA ", "CREATE SCHEMA IF NOT EXISTS "))
  expect(Number(await operator.query(contentCount))).toBeGreaterThan(0)
  await operator.query(`select public.replay_organization_suppression_history(${literal(manifest)},${literal(hash(manifest))});`)
  expect(await operator.query(`select count(*) from public.organization_form_responses where version_id='${id(100)}';`)).toBe("0")
  const identity = await operator.query(preserved)
  await operator.query(`select ${purge()};`)
  expect(await operator.query(contentCount)).toBe("0"); expect(await operator.query(preserved)).toBe(identity)
  await operator.query(`select ${purge()};`)
  expect(await operator.query("select datallowconn from pg_database where datname=current_database();")).toBe("f")
  operator.child.stdin.end(); await new Promise<void>(resolve => operator.child.once("close", () => resolve()))
  results.push("preclosure backup, pinned independent replay, scoped repurge and retained quarantine")
 }, 30000)
})
