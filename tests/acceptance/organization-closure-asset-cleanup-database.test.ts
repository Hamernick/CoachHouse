import { createHash } from "node:crypto"
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from "node:child_process"
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

const template = process.env.ORGANIZATION_ASSET_CLEANUP_TEST_DATABASE_URL
const migration = "supabase/migrations/20261103400000_organization_closure_asset_cleanup.sql"
const collector = "docs/agent/organization-suppression-capture.py"
const env = { ...process.env, PGOPTIONS: "-c statement_timeout=10000 -c timezone=UTC" }
const id = (n: number) => `40000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const literal = (value: string) => "'" + value.replaceAll("'", "''") + "'"
const hash = (value: string) => createHash("sha256").update(value).digest("hex")
const sentinel = "PRIVATE_ASSET_PURGE_400000"
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
const paths = {
 100: `${id(1)}/logo/1793683000000.png`,
 101: `${id(1)}/cover/1793683000001.png`,
 102: `${id(1)}/roadmap-inline/1793683000002.png`,
 103: `${id(1)}/library/core/mission_vision_values/${id(903)}-core.md`,
 104: `${id(1)}/bylaws/1793683000004-document.pdf`,
 105: `${id(1)}/policies/${id(70)}/1793683000005-policy.pdf`,
 106: `${id(1)}/legacy/unknown.png`,
 107: `${id(1)}/header/1793683000007.png`,
 108: `${id(1)}/logo-mark/1793683000008.png`,
 109: `${id(1)}/policies/${id(71)}/1793683000009-preserved.pdf`,
} as const
const buckets = { 100: "org-media", 101: "program-media", 102: "roadmap-media", 103: "org-documents", 104: "org-documents", 105: "org-documents", 106: "org-media", 107: "org-media", 108: "org-media", 109: "org-documents" } as const
const url = (n: keyof typeof paths) => `${origin}/storage/v1/object/public/${buckets[n]}/${paths[n]}`
// Disposable SQL metadata fixture only. Actual Storage HTTP/backend proof is separate.
const removeMetadata = (n: number) => `set local storage.allow_delete_query='true';set local request.jwt.claim.role='service_role';delete from storage.objects where id='${id(n)}';`
const snapshot = `select jsonb_build_object('otherOrg',(select to_jsonb(o) from public.organizations o where user_id='${id(2)}'),'auth',(select md5(string_agg(to_jsonb(t)::text,',' order by id)) from auth.users t),'fiscal',(select md5(string_agg(to_jsonb(t)::text,',' order by id)) from public.fiscal_sponsorship_applications t),'copiedGrants',(select md5(string_agg(to_jsonb(t)::text,',' order by id)) from public.workspace_page_image_grants t),'copiedBytes',(select md5(string_agg(to_jsonb(t)::text,',' order by id)) from storage.objects t where bucket_id='workspace-page-assets'),'unselectedPolicyFile',(select to_jsonb(f) from public.organization_document_files f where org_id='${id(1)}' and document_kind='policy:${id(71)}'),'external',(select profile->>'externalUrl' from public.organizations where user_id='${id(1)}'),'otherObjects',(select md5(string_agg(to_jsonb(t)::text,',' order by id)) from storage.objects t where name like '${id(2)}/%'));`
function seed() {
 const profile = { name: "C3 assets", logoUrl: url(100), externalUrl: "https://external.example.test/keep.png", documents: { bylaws: { path: paths[104], name: sentinel, size: 10 } }, policies: [{ id: id(70), title: sentinel, summary: sentinel, status: "complete", document: { path: paths[105], name: sentinel, size: 10 } }, { id: id(71), title: "Preserved unselected policy", document: { path: paths[109], name: "Preserve.pdf", size: 10 } }] }
 sql(`begin;set local request.jwt.claim.role='service_role';insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data,aud,role) select x.id,x.email,u.raw_user_meta_data,u.raw_app_meta_data,u.aud,u.role from (values('${id(1)}'::uuid,'c3-assets@example.test'),('${id(2)}'::uuid,'c3-assets-other@example.test')) x(id,email) cross join lateral(select * from auth.users order by id limit 1)u;
 insert into public.organizations(user_id,profile,public_slug) values('${id(1)}',${literal(JSON.stringify(profile))},'c3-assets'),('${id(2)}','{"name":"Preserved other org"}','c3-assets-other');
 set local request.jwt.claim.sub='${id(1)}';
 insert into public.programs(id,user_id,title,image_url) values('${id(40)}','${id(1)}','Preserved program identity','${url(101)}');
 insert into public.organization_document_files(id,org_id,storage_path,name,mime_type,size_bytes,created_by,document_kind) values('${id(60)}','${id(1)}','${paths[103]}','Core','text/markdown',10,'${id(1)}',null),('${id(61)}','${id(1)}','${paths[104]}','${sentinel}','application/pdf',10,'${id(1)}','bylaws');
 insert into public.organization_projects(id,org_id,name,start_date,end_date,created_by) values('${id(200)}','${id(1)}','Preserved fiscal parent','2026-01-01','2026-12-01','${id(1)}');
 insert into public.fiscal_sponsorship_applications(id,org_id,project_id,source_snapshot) values('${id(201)}','${id(1)}','${id(200)}','{"image":"${url(107)}"}');
 insert into storage.objects(id,bucket_id,name,owner,owner_id,metadata) values ${Object.keys(paths).map(key => { const n = Number(key) as keyof typeof paths; return `('${id(n)}','${buckets[n]}','${paths[n]}','${id(1)}','${id(1)}','{"size":10,"mimetype":"image/png"}')` }).join(",")},('${id(300)}','org-media','${id(2)}/logo/1793683000000.png','${id(2)}','${id(2)}','{"size":10}');commit;`)
}

describe.skipIf(!template).sequential("expired closure modern physical asset reservation and finalization", () => {
 beforeAll(() => {
  const original = new URL(template!)
  if (original.hostname !== "127.0.0.1" || !/^\/workspace_sharing_fixture_[a-z0-9_]+$/.test(original.pathname) || original.password) throw new Error("Explicit isolated full-schema template required")
  const admin = new URL(original); admin.pathname = "/postgres"; maintenance = admin.toString()
  directory = mkdtempSync(join(tmpdir(), "ch-asset-cleanup-")); source = createDatabase("asset", original.pathname.slice(1)).url
  sql(readFileSync(migration, "utf8")); seed()
  expect(sql("select has_function_privilege('authenticated','public.organization_closure_command(uuid,uuid,text,uuid,integer)','EXECUTE');")).toBe("f")
  backup = join(directory, "preclosure.sql"); command("pg_dump", ["--format=plain", "--file", backup, "--dbname", source])
 }, 30000)
 afterAll(async () => {
  for (const child of children) { child.stdin.end(); await new Promise<void>(resolve => child.once("close", () => resolve())) }
  if (directory) {
   const proof = { source, directory, results, migrationSha256: hash(readFileSync(migration, "utf8")), testSha256: hash(readFileSync("tests/acceptance/organization-closure-asset-cleanup-database.test.ts", "utf8")), collectorSha256: hash(readFileSync(collector, "utf8")), manifestSha256: manifest ? hash(manifest) : null, quarantines: targetNames.map(name => JSON.parse(sql(`select jsonb_build_object('database',datname,'allowConnections',datallowconn,'sessions',(select count(*) from pg_stat_activity where datname=d.datname)) from pg_database d where datname='${name}'`, maintenance))), outcome: results.length === 8 ? "passed" : "partial", storageApiOrBackendProof: false, releaseQualified: false }
   writeFileSync(join(directory, "proof.json"), JSON.stringify(proof, null, 2)); writeFileSync("/tmp/ch-c3-asset-cleanup-database-proof.json", JSON.stringify(proof, null, 2))
  }
 })
 it("requires exact current expired closure and real operator; keeps lifecycle and asset APIs private", () => {
  sql(`begin;${deny(`perform ${reserve()}`,"40001")}${close}${deny(`perform public.reserve_expired_closure_asset_purge('${id(1)}','${id(100)}','${id(801)}',1,'${id(1100)}','${origin}')`,"40001")}update public.organization_closures set requested_at=statement_timestamp(),export_until=statement_timestamp()+interval '720 hours' where org_id='${id(1)}';${deny(`perform ${reserve()}`)}rollback;`)
  for (const role of ["anon", "authenticated", "service_role"]) sql(`begin;set local role ${role};${deny(`perform ${reserve()}`)}rollback;`)
  sql(`begin isolation level repeatable read;${deny(`perform ${reserve()}`)}rollback;begin;set local session_replication_role=replica;${deny(`perform ${reserve()}`)}rollback;`)
  sql(`begin;${close}commit;`); results.push("actual operator/current expired closure/isolation; original lifecycle ACL retained")
 })
 it("blocks unknown paths, actual fiscal references and external-domain bindings", () => {
  sql(`begin;${deny(`perform ${reserve(106)}`,"PT409")}${deny(`perform ${reserve(107)}`,"PT409")}rollback;`)
  sql(`begin;alter table public.organizations disable trigger organization_row_closure;update public.organizations set profile=profile||jsonb_build_object('brandMarkUrl','https://external.example.test/storage/v1/object/public/org-media/${paths[108]}') where user_id='${id(1)}';alter table public.organizations enable trigger organization_row_closure;${deny(`perform ${reserve(108)}`,"PT409")}rollback;`)
  results.push("legacy, explicit fiscal source and foreign-domain bindings fail closed")
 })
 it("pins every modern owner and removes exact bindings only after metadata absence", () => {
  const before = sql(snapshot)
  for (const n of [100,101,102,104,105]) {
   const output = sql(`begin;select ${reserve(n)};${deny(`perform ${finish(n)}`,"PT409")}${removeMetadata(n)}select ${finish(n)};rollback;`).split("\n")
   expect(JSON.parse(output[0])).toMatchObject({ objectId: id(n), complete: false }); expect(output.at(-1)).toBe("t")
  }
  expect(sql(snapshot)).toBe(before); results.push("all modern media/tracked/policy owners and absence-before-binding finalization")
 })
 it("serializes a foreign writer before reserve and rejects late aliases after reservation", async () => {
  const writer = session(); await writer.query(`begin;update public.organizations set profile=profile||jsonb_build_object('logoUrl','${url(100)}') where user_id='${id(2)}';`)
  const operator = session(); const pid = await operator.query("select pg_backend_pid();")
  const pending = operator.query(`begin;${deny(`perform ${reserve()}`,"PT409")}rollback;`)
  try { await expect.poll(() => sql(`select count(*) from pg_stat_activity where pid=${pid} and wait_event_type='Lock';`), { timeout: 2000, interval: 50 }).toBe("1") }
  finally { await writer.query("commit;"); writer.child.stdin.end(); await pending; operator.child.stdin.end() }
  sql(`update public.organizations set profile=profile-'logoUrl' where user_id='${id(2)}';select ${reserve()};`)
  sql(`begin;${deny(`update public.organizations set profile=profile||jsonb_build_object('logoUrl','${url(100)}') where user_id='${id(2)}'`,"PT409")}${deny(`update public.organizations set profile=profile||jsonb_build_object('logoUrl',replace('${url(100)}','/','%2F')) where user_id='${id(2)}'`,"PT409")}rollback;`)
  results.push("actual two-session alias-before-reserve serialization and late raw/encoded alias denial")
 })
 it("extends only known core library paths through320 and fences late core/version aliases", async () => {
  const core = `public.reserve_expired_closure_document_purge('${id(1)}','${id(60)}','${id(800)}',1,'${id(1160)}')`
  const writer = session(); await writer.query(`begin;update public.organizations set profile=profile||jsonb_build_object('imageUrl','${origin}/storage/v1/object/sign/org-documents/${paths[103]}?token=synthetic') where user_id='${id(2)}';`)
  const operator = session(); const pid = await operator.query("select pg_backend_pid();"); const pending = operator.query(`begin;${deny(`perform ${core}`,"PT409")}rollback;`)
  try { await expect.poll(() => sql(`select count(*) from pg_stat_activity where pid=${pid} and wait_event_type='Lock';`), { timeout: 2000, interval: 50 }).toBe("1") }
  finally { await writer.query("commit;"); writer.child.stdin.end(); await pending; operator.child.stdin.end() }
  sql(`update public.organizations set profile=profile-'imageUrl' where user_id='${id(2)}';select ${core};`)
  sql(`begin;${deny(`update public.organizations set profile=profile||jsonb_build_object('imageUrl','${paths[103]}') where user_id='${id(2)}'`,"PT409")}${removeMetadata(103)}select public.finish_expired_closure_document_purge('${id(1)}','${id(60)}','${id(800)}',1,'${id(1160)}');commit;`)
  expect(sql(`select count(*) from public.organization_document_files where id='${id(60)}';`)).toBe("0")
  results.push("320 core library owner reuse plus actual late-alias serialization")
 })
 it("retains pending reservations on late failure and disallows upload/replacement/receipt mutation", () => {
  sql(`begin;${deny(`update storage.objects set metadata='{}' where id='${id(100)}'`,"PT409")}${deny(`perform ${finish()}`,"PT409")}${deny(`delete from public.organization_closure_asset_cleanups`)}${deny(`truncate public.organization_closure_asset_cleanups`)}rollback;`)
  sql(`begin;${removeMetadata(100)}create function public.fixture_asset_fail() returns trigger language plpgsql as $$begin raise exception 'fixture stop' using errcode='P0001';end$$;create trigger fixture_asset_fail before update on public.organizations for each row execute function public.fixture_asset_fail();${deny(`perform ${finish()}`,"P0001")}rollback;`)
  expect(sql(`select state from public.organization_closure_asset_cleanups where object_id='${id(100)}';`)).toBe("reserved")
  expect(sql(`select count(*) from storage.objects where id='${id(100)}';`)).toBe("1")
  results.push("pending failure durability, immutable receipt and no upload/update expansion")
 })
 it("finishes exact sources and lost-reply retries while preserving shared identities and independent content", () => {
  const before = sql(snapshot)
  for (const n of [100,101,102,104,105]) sql(`begin;select ${reserve(n)};${removeMetadata(n)}select ${finish(n)};commit;`)
  expect(sql(snapshot)).toBe(before)
  expect(sql(`select profile ? 'logoUrl',profile->'documents',jsonb_array_length(profile->'policies') from public.organizations where user_id='${id(1)}';`)).toBe("f|{}|1")
  expect(sql(`select image_url is null from public.programs where id='${id(40)}';`)).toBe("t")
  expect(sql(`select count(*) from public.organization_document_files where id='${id(61)}';`)).toBe("0")
  expect(JSON.parse(sql(`select ${reserve()};`)).complete).toBe(true); expect(sql(`select ${finish()};`)).toBe("t")
  sql(`begin;${deny(`update public.organizations set profile=profile||'{"name":"reopen"}' where user_id='${id(1)}'`)}rollback;`)
  results.push("exact current binding removal, preserved financial/external/copies/other org, idempotent completed retry")
 })
 it("replays a pinned preclosure backup offline and repeats the scoped metadata retirement", async () => {
  const sourceId = sql("select source_id from public.organization_restore_identity;"), journal = join(directory, "suppression.sqlite"), exported = join(directory, "suppression.json")
  const captured = JSON.parse(command("python3", [collector, "--source", source, "--journal", journal, "--expected-source-id", sourceId]))
  command("python3", [collector, "--journal", journal, "--expected-source-id", sourceId, "--expected-sha256", captured.sha256, "--export", exported]); manifest = readFileSync(exported, "utf8")
  const target = createDatabase("asset_restore"); targetNames.push(target.name); const operator = session(target.url); await operator.query("select current_user;"); sql(`alter database ${target.name} allow_connections false;`,maintenance)
  await operator.query(readFileSync(backup,"utf8").replaceAll("CREATE SCHEMA ","CREATE SCHEMA IF NOT EXISTS ")); await operator.query(`select public.replay_organization_suppression_history(${literal(manifest)},${literal(hash(manifest))});`)
  const before = await operator.query(snapshot); await operator.query(`begin;select ${reserve()};${removeMetadata(100)}select ${finish()};commit;`)
  expect(await operator.query(snapshot)).toBe(before); expect(await operator.query(`select count(*) from storage.objects where id='${id(100)}';`)).toBe("0")
  expect(await operator.query("select datallowconn from pg_database where datname=current_database();")).toBe("f"); operator.child.stdin.end(); await new Promise<void>(resolve => operator.child.once("close",()=>resolve()))
  results.push("preclosure backup, independent pinned replay, scoped repurge and offline target; physical Storage proof separate")
 },30000)
})
