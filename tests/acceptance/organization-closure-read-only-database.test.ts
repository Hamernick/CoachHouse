import { createHash } from "node:crypto"
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from "node:child_process"
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest"

const template = process.env.ORGANIZATION_CLOSURE_READ_ONLY_TEST_DATABASE_URL
const migration = "supabase/migrations/20261103230000_organization_closure_read_only.sql"
const env = { ...process.env, PGOPTIONS: "-c statement_timeout=10000 -c coach_house.workspace_sharing_fixture=isolated-test-only" }
let url: string, directory: string
const clients = new Set<ChildProcessWithoutNullStreams>()
const results: string[] = []
function command(program: string, args: string[], input?: string) {
 const result = spawnSync(program,args,{env,input,encoding:"utf8",maxBuffer:32*1024*1024})
 expect(result.status,result.stderr).toBe(0);return result.stdout.trim()
}
function sql(statement: string) { return command("psql",["-XqAt","-v","ON_ERROR_STOP=1","-d",url],statement) }
function session() {
 const child=spawn("psql",["-XqAt","-v","ON_ERROR_STOP=1","-d",url],{env});clients.add(child)
 let stdout="",stderr=""
 const done=new Promise<{code:number|null;stdout:string;stderr:string}>((resolve,reject)=>{
  child.stdout.on("data",chunk=>stdout+=chunk.toString());child.stderr.on("data",chunk=>stderr+=chunk.toString())
  child.on("error",reject);child.on("close",code=>{clients.delete(child);resolve({code,stdout:stdout.trim(),stderr})})
 })
 return {child,done}
}
async function hold(statement:string, readOnly=false) {
 const s=session()
 await new Promise<void>((resolve,reject)=>{
  let seen="";s.child.stdout.on("data",chunk=>{seen+=chunk.toString();if(seen.includes("__READY__"))resolve()})
  s.done.then(result=>reject(new Error(result.stderr||"Premature completion")),reject)
  s.child.stdin.write(`begin ${readOnly?"read only":""}; ${statement}; select '__READY__';\n`)
 })
 return async()=>{s.child.stdin.end("rollback;\n");const r=await s.done;expect(r.code,r.stderr).toBe(0)}
}
async function blocked(statement:string) {
 const s=session();s.child.stdin.end(`set application_name='closure-readonly-waiter'; begin; ${statement}; rollback;\n`)
 await new Promise(resolve=>setTimeout(resolve,100))
 expect(sql("select wait_event_type||':'||wait_event from pg_stat_activity where application_name='closure-readonly-waiter' and datname=current_database()")).toBe("Lock:advisory")
 return s.done
}
const actor=(n=1)=>`set local role authenticated; set local request.jwt.claim.sub='10000000-0000-4000-8000-${String(n).padStart(12,"0")}';`
const ro=(statement:string,n=1)=>`begin read only;${actor(n)}${statement};commit;`
const counts="select public.fixture_private_read_counts()"
const close="select public.fixture_closure('request',600,0)"
const expiry="update public.organization_closures set requested_at=now()-interval '721 hours',export_until=now()-interval '1 hour' where org_id=public.fixture_form_id(1)"

describe.skipIf(!template).sequential("closure read-only admission",()=>{
 beforeAll(()=>{
  const source=new URL(template!)
  if(!["localhost","127.0.0.1","[::1]"].includes(source.hostname)||!/^\/workspace_sharing_fixture_[a-z0-9_]+$/.test(source.pathname)||source.password) throw new Error("Explicit disposable local fixture required")
  directory=mkdtempSync(join(tmpdir(),"ch-closure-read-only-"));const dump=join(directory,"source.sql")
  command("pg_dump",["--format=plain","--file",dump,"--dbname",template!])
  const name=`workspace_sharing_fixture_readonly_${process.pid}_${Date.now()}`
  command("createdb",["--maintenance-db",template!,name]);source.pathname="/"+name;url=source.toString()
  sql(readFileSync(dump,"utf8"))
  const aclQuery="select proname||':'||proacl::text from pg_proc where pronamespace='public'::regnamespace and proname in ('guard_organization_closure','organization_closure_read_window','can_read_calendar_during_closure','guard_uploaded_document_organization') order by proname"
  const beforeAcl=sql(aclQuery);sql(readFileSync(migration,"utf8"));expect(sql(aclQuery)).toBe(beforeAcl)
  results.push("existing function ACLs unchanged")
 },30_000)
 beforeEach(()=>sql("begin;set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001';select public.fixture_closure_private_reads();commit"))
 afterEach(()=>{for(const child of clients)child.kill("SIGTERM")})
 afterAll(()=>{if(directory)writeFileSync(join(directory,"proof.json"),JSON.stringify({url,directory,migration,sha256:createHash("sha256").update(readFileSync(migration)).digest("hex"),results},null,2))})
 it("reads organizations, 14 canonical stores, calendars, and document permission in READ ONLY",()=>{
  expect(sql(ro("select count(*) from public.organizations where user_id=public.fixture_form_id(1)"))).toBe("1")
  expect(Object.values(JSON.parse(sql(ro(counts)))).every(n=>Number(n)>0)).toBe(true)
  expect(sql(ro("select count(*) from public.roadmap_calendar_internal_events where org_id=public.fixture_form_id(1)"))).toBe("1")
  expect(sql(ro("select count(*) from public.roadmap_calendar_internal_events where org_id=public.fixture_form_id(1)",3))).toBe("1")
  expect(sql(ro("select public.can_edit_uploaded_document(id) from public.organization_document_files where org_id=public.fixture_form_id(1)"))).toBe("t")
  expect(sql(ro("select count(*) from public.organization_document_files where org_id=public.fixture_form_id(1)",99))).toBe("0")
  results.push("actual authenticated read-only RLS and nested permission helpers")
 })
 it("holds closure until an admitted read-only transaction finishes",async()=>{
  const release=await hold(actor()+counts,true)
  const pending=blocked(close);await new Promise(resolve=>setTimeout(resolve,200));await release()
  const result=await pending;expect(result.code,result.stderr).toBe(0);expect(result.stdout).toContain('"state": "closing"')
  results.push("read-first closure advisory wait and completion")
 })
 it("fails busy reads closed and leaves other organizations accessible",async()=>{
  const release=await hold(close)
  expect(Object.values(JSON.parse(sql(ro(counts)))).every(n=>n===0)).toBe(true)
  expect(sql(ro("select count(*) from public.organizations where user_id=public.fixture_form_id(2)",2))).toBe("1")
  await release();results.push("closure-first nonblocking denial and other-organization isolation")
 })
 it.each(["delete from public.organizations where user_id=public.fixture_form_id(1)","delete from public.organization_memberships where org_id=public.fixture_form_id(1)"])("serializes read-only admission against %s",async statement=>{
  const release=await hold(actor()+counts,true)
  const pending=blocked(statement);await new Promise(resolve=>setTimeout(resolve,200));await release()
  const result=await pending
  if(statement.startsWith("delete from public.organizations")) {
   expect(result.code).not.toBe(0);expect(result.stderr).toContain("foreign key constraint")
  } else expect(result.code,result.stderr).toBe(0)
  results.push("exclusive boundary: "+statement)
 })
 it("preserves the fixed export deadline and denies snapshot isolation",()=>{
  sql(close);expect(Object.values(JSON.parse(sql(ro(counts)))).every(n=>Number(n)>0)).toBe(true)
  sql(expiry);expect(Object.values(JSON.parse(sql(ro(counts)))).every(n=>n===0)).toBe(true)
  for(const isolation of ["repeatable read","serializable"])
   expect(sql(`begin isolation level ${isolation} read only;${actor()}select public.organization_closure_read_window(public.fixture_form_id(1));commit;`)).toBe("f")
  results.push("fixed deadline and non-read-committed denial")
 })
 it("checks fresh lifecycle state after an already-started read statement",async()=>{
  sql("create or replace function public.fixture_delayed_org() returns uuid language plpgsql as $$ begin perform pg_sleep(0.4); return public.fixture_form_id(1); end $$")
  const reader=session()
  reader.child.stdin.end("set application_name='closure-readonly-snapshot';"+ro("select public.organization_closure_read_window(public.fixture_delayed_org())")+"\n")
  await new Promise(resolve=>setTimeout(resolve,100))
  expect(sql("select wait_event from pg_stat_activity where application_name='closure-readonly-snapshot' and datname=current_database()")).toBe("PgSleep")
  sql(close+";"+expiry)
  const result=await reader.done;expect(result.code,result.stderr).toBe(0);expect(result.stdout).toBe("f")
  results.push("volatile post-admission lifecycle snapshot rejects concurrently committed expiry")
 })
 it("keeps lifecycle and lock helpers private and reuses one advisory entry per org",()=>{
  for(const role of ["anon","authenticated","service_role"])
   for(const fn of ["organization_closure_command(uuid,uuid,text,uuid,integer)","lock_organization_read_only(uuid)","guard_organization_read_only_boundary()"])
    expect(sql(`select has_function_privilege('${role}','public.${fn}','execute')`)).toBe("f")
  expect(sql(ro(`select public.organization_closure_read_window(public.fixture_form_id(1)) from generate_series(1,20);select count(*) from pg_locks where pid=pg_backend_pid() and locktype='advisory'`)).split("\n").at(-1)).toBe("1")
  results.push("private helpers, unexposed lifecycle, one transaction lock per organization")
 })
})
