import { createHash } from "node:crypto"
import { spawn, spawnSync } from "node:child_process"
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

const templateUrl = process.env.ORGANIZATION_RESPONSE_CLEANUP_TEST_DATABASE_URL
const migration = "supabase/migrations/20261103300000_organization_closure_response_cleanup.sql"
const collector = "docs/agent/organization-suppression-capture.py"
const env = { ...process.env, PGOPTIONS: "-c statement_timeout=5000 -c coach_house.workspace_sharing_fixture=isolated-test-only -c timezone=UTC" }
const literal = (v: string) => `'${v.replaceAll("'", "''")}'`
const digest = (v: string) => createHash("sha256").update(v).digest("hex")
function run(program:string,args:string[],input?:string) { return spawnSync(program,args,{env,input,encoding:"utf8",maxBuffer:32*1024*1024}) }
function command(program:string,args:string[],input?:string) { const r=run(program,args,input);expect(r.status,r.stderr).toBe(0);return r.stdout.trim() }
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
        child.stdin.write(`${sql}\n;\n\\echo ${marker}\n`)
      })
    },
  }
}

const dependencies=["20261103040000_workspace_page_note_edit_scope.sql","20261103070000_unpublished_form_collaboration.sql","20261103090000_organization_suppression_capture.sql","20261103100000_organization_suppression_history_replay.sql","20261103110000_organization_form_invitation_suppression.sql","20261103120000_organization_form_reviewer_suppression.sql","20261103130000_organization_form_reviewer_history_replay.sql","20261103140000_organization_form_manager_invalidation.sql","20261103150000_organization_form_primary_manager_suppression.sql","20261103160000_organization_form_primary_authority_fence.sql","20261103170000_workspace_page_invitation_suppression.sql","20261103180000_workspace_page_note_scope_suppression.sql","20261103190000_organization_suppression_capacity.sql","20261103200000_workspace_page_logo_grants.sql"]

type Operator = ReturnType<typeof operatorSession>
const operators:Operator[]=[], targets:string[]=[], results:string[]=[]
let sourceUrl:string, directory:string, beforePath:string, preserved:string, manifestText:string
let restoreTarget:{name:string;url:string},cancelTarget:{name:string;url:string},restoreOperator:Operator
const sql=(text:string,url=sourceUrl)=>command("psql",["-X","-qAt","-v","ON_ERROR_STOP=1","-d",url],text)
const purge=(operation=9500,request=9400,revision=1)=>`public.purge_expired_organization_form_responses(public.fixture_form_id(1),public.fixture_form_id(${request}),${revision},public.fixture_form_id(${operation}))`
const reject=(statement:string,code="42501",message?:string)=>`do $test$ begin begin ${statement} raise exception 'Unexpected success' using errcode='P9999'; exception when others then if sqlstate<>'${code}' ${message?`or sqlerrm<>${literal(message)}`:""} then raise; end if; end; end $test$;`
const counts=`select jsonb_build_object('responses',(select count(*) from public.organization_form_responses),'corrections',(select count(*) from public.organization_form_corrections),'receipts',(select count(*) from public.organization_closure_response_cleanup_operations),'events',(select high_water from public.organization_suppression_capture_state));`
const preservedRows=`select jsonb_build_object('users',(select jsonb_agg(to_jsonb(u) order by id) from auth.users u),'profiles',(select jsonb_agg(to_jsonb(p) order by id) from public.profiles p),'versions',(select jsonb_agg(to_jsonb(v) order by id) from public.organization_form_versions v),'files',(select jsonb_agg(to_jsonb(f) order by id) from public.organization_document_files f),'objects',(select jsonb_agg(to_jsonb(o) order by id) from storage.objects o),'otherResponses',(select jsonb_agg(to_jsonb(r) order by r.id) from public.organization_form_responses r join public.organization_form_versions v on v.id=r.version_id where v.org_id=public.fixture_form_id(2)));`
function clone(path:string,suffix:string) {
 const name=`workspace_sharing_fixture_response_${process.pid}_${suffix}_${Date.now()}`
 const u=new URL(sourceUrl||templateUrl!);u.pathname=`/${name}`
 command("createdb",["--maintenance-db",templateUrl!,name]);sql(readFileSync(path,"utf8"),u.toString());return {name,url:u.toString()}
}
function collect() {
 const source=sql("select source_id from public.organization_restore_identity"),journal=join(directory,"suppression.sqlite"),path=join(directory,"suppression.json")
 const receipt=JSON.parse(command("python3",[collector,"--source",sourceUrl,"--journal",journal,"--expected-source-id",source]))
 command("python3",[collector,"--journal",journal,"--expected-source-id",source,"--expected-sha256",receipt.sha256,"--export",path])
 return readFileSync(path,"utf8")
}
describe.skipIf(!templateUrl).sequential("private expired-closure native response cleanup",()=>{
 beforeAll(()=>{
  const template=new URL(templateUrl!)
  if(!["127.0.0.1","localhost","[::1]"].includes(template.hostname)||!/^\/workspace_sharing_fixture_[a-z0-9_]+$/.test(template.pathname)||template.password)throw new Error("Explicit disposable local fixture required")
  directory=mkdtempSync(join(tmpdir(),"ch-response-cleanup-"));const initial=join(directory,"template.sql")
  command("pg_dump",["--format=plain","--file",initial,"--dbname",templateUrl!]);sourceUrl=clone(initial,"source").url
  sql("alter table public.organization_workspace_boards add column created_at timestamptz not null default now(),add column updated_at timestamptz not null default now();select public.fixture_closure_storage();")
  for(const file of [...dependencies,"20261103210000_workspace_publication_asset_suppression.sql"])sql(readFileSync("supabase/migrations/"+file,"utf8"))
  sql(readFileSync(migration,"utf8"))
  sql(readFileSync("supabase/migrations/20261103310000_organization_closure_research_draft_cleanup.sql","utf8"))
  sql(`select public.fixture_form_command('correct',1,jsonb_build_object('hash',repeat('c',64),'answers',jsonb_build_array(jsonb_build_object('questionId',public.fixture_form_id(90),'value','Cleanup private sentinel'))));
   insert into public.organization_form_responses(version_id,id,original_hash,answers)
    select public.fixture_form_id(80),public.fixture_form_id(n),repeat('b',64),'[]'::jsonb from generate_series(200,258)n;
   insert into public.organization_forms(org_id,id,intake_manager) values(public.fixture_form_id(2),public.fixture_form_id(21),public.fixture_form_id(2));
   insert into public.organization_form_versions(id,org_id,form_id,page_id,version)
    select public.fixture_form_id(81),public.fixture_form_id(2),public.fixture_form_id(21),public.fixture_form_id(11),version from public.organization_form_versions where id=public.fixture_form_id(80);
   insert into public.organization_form_responses(version_id,id,original_hash,answers)
    values(public.fixture_form_id(81),public.fixture_form_id(999),repeat('d',64),'[]');`)
  sql("update public.organization_form_responses set submitted_at=statement_timestamp()-interval '32 days',updated_at=statement_timestamp()-interval '32 days' where version_id=public.fixture_form_id(80);")
  beforePath=join(directory,"before-closure.sql");command("pg_dump",["--format=plain","--file",beforePath,"--dbname",sourceUrl])
  restoreTarget=clone(beforePath,"restore");cancelTarget=clone(beforePath,"cancel")
  // Fixture-only backdated request: unchanged 720-hour interval and matching
  // captured operation, rather than production clock override or early deletion.
  sql(`insert into public.organization_closures(org_id,state,revision,request_id,requested_at,export_until)
   values(public.fixture_form_id(1),'closing',1,public.fixture_form_id(9400),statement_timestamp()-interval '31 days',statement_timestamp()-interval '31 days'+interval '720 hours');`)
  sql(`insert into public.organization_closure_operations(org_id,operation_id,action,expected_revision,completed_at)
   select org_id,request_id,'request',0,requested_at from public.organization_closures where org_id=public.fixture_form_id(1);`)
  preserved=sql(preservedRows)
 },30_000)
 afterAll(async()=>{
  for(const op of operators) { if(op.child.exitCode===null){await op.query("rollback;");op.child.stdin.end();await new Promise<void>(resolve=>op.child.once("close",()=>resolve()))} }
  if(directory) {
   const admission=targets.map(database=>JSON.parse(sql(`select jsonb_build_object('database',datname,'allowConnections',datallowconn,'sessions',(select count(*) from pg_stat_activity where datname=d.datname)) from pg_database d where datname=${literal(database)};`)))
   const proof={sourceUrl,directory,migrationSha256:digest(readFileSync(migration,"utf8")),testSha256:digest(readFileSync("tests/acceptance/organization-closure-response-cleanup-database.test.ts","utf8")),collectorSha256:digest(readFileSync(collector,"utf8")),manifestSha256:manifestText?digest(manifestText):null,results,targetAdmission:admission,captureComplete:false,releaseQualified:false,scope:"native_responses",researchCleanupMigrationSha256:digest(readFileSync("supabase/migrations/20261103310000_organization_closure_research_draft_cleanup.sql","utf8")),outcome:results.length===8?"passed":"partial"}
   writeFileSync(join(directory,"proof.json"),JSON.stringify(proof,null,2));writeFileSync("/tmp/ch-c3-response-cleanup-proof.json",JSON.stringify(proof,null,2))
  }
 })
 it("denies active, canceled, predeadline, wrong identity and API callers without changing responses",()=>{
  const before=sql(counts)
  sql(`begin;${reject(`perform ${purge(9500,9401)};`)}${reject(`perform ${purge(9500,9400,2)};`)}${reject(`perform public.purge_expired_organization_form_responses(null,null,null,null);`,"22023")}rollback;`)
  sql(`begin;update public.organization_closures set requested_at=statement_timestamp(),export_until=statement_timestamp()+interval '720 hours';${reject(`perform ${purge()};`)}rollback;`)
  sql(`begin;update public.organization_closures set state='active',request_id=null,requested_at=null,export_until=null;${reject(`perform ${purge()};`)}rollback;`)
  for(const role of ["anon","authenticated","service_role"])sql(`begin;set local role ${role};${reject(`perform ${purge()};`)}rollback;`)
  sql(`begin isolation level repeatable read;${reject(`perform ${purge()};`)}rollback;`)
  sql(`begin;set local session_replication_role=replica;${reject(`perform ${purge()};`)}rollback;`)
  expect(sql(counts)).toBe(before);results.push("current expired closure and private operator admission")
 })
 it("rolls back every response, correction and receipt on missing capture or capacity failure",()=>{
  const before=sql(counts)
  for(const [table,trigger] of [["organization_form_response_deletions","organization_response_suppression_capture"],["organization_suppression_events","organization_suppression_capacity"]])
   sql(`begin;alter table public.${table} disable trigger ${trigger};${reject(`perform ${purge()};`)}rollback;`)
  sql(`begin;update public.organization_suppression_capture_state set source_id=gen_random_uuid();${reject(`perform ${purge()};`)}rollback;`)
  // Synthetic capacity-only events never enter the replay proof.
  sql(`begin;update public.organization_suppression_capture_state set high_water=999;
   insert into public.organization_suppression_events(sequence,kind,organization_id,operation_id,revision,occurred_at)
   select n,'closure_cancel',public.fixture_form_id(1),public.fixture_form_id(100000+n),n,clock_timestamp() from generate_series((select coalesce(max(sequence),0)::integer+1 from public.organization_suppression_events),999)n;
   ${reject(`perform ${purge()};`,"54000")}rollback;`)
  expect(sql(counts)).toBe(before);results.push("hook lineage capacity atomic rollback")
 })
 it("serializes actual competing sessions at the organization boundary",async()=>{
  const holder=operatorSession(sourceUrl);operators.push(holder)
  await holder.query("begin;select 1 from public.organizations where user_id=public.fixture_form_id(1) for update;")
  const waiting=run("psql",["-X","-qAt","-v","ON_ERROR_STOP=1","-d",sourceUrl],`set lock_timeout='150ms';select ${purge()};`)
  expect(waiting.status).not.toBe(0);expect(waiting.stderr).toContain("lock timeout")
  await holder.query("rollback;")
  await holder.query(`begin;select ${purge(9508)};`)
  const cancel=run("psql",["-X","-qAt","-v","ON_ERROR_STOP=1","-d",sourceUrl],"set lock_timeout='150ms';select public.fixture_closure('cancel',9490,1);")
  expect(cancel.status).not.toBe(0);expect(cancel.stderr).toContain("lock timeout")
  await holder.query("rollback;")
  sql(reject("perform public.fixture_closure('cancel',9490,1);"))
  results.push("two-session writer and expired-cancel serialization")
 })
 it("uses current deletion time when a transaction began before the deadline",()=>{
  const before=sql(counts)
  const result=sql(`begin;
   update public.organization_closures set requested_at=statement_timestamp()+interval '100 milliseconds'-interval '720 hours',export_until=statement_timestamp()+interval '100 milliseconds' where org_id=public.fixture_form_id(1);
   select pg_sleep(0.2);select ${purge(9509)};
   select bool_and(d.deleted_at>=c.export_until and d.deleted_at>transaction_timestamp()) from public.organization_form_response_deletions d join public.organization_form_versions v on v.id=d.version_id join public.organization_closures c on c.org_id=v.org_id;
   rollback;`)
  expect(result.split("\n").at(-1)).toBe("t");expect(sql(counts)).toBe(before)
  results.push("clock_timestamp deadline and capture after transaction start")
 })
 it("purges bounded exact batches and keeps immutable retry results and unrelated records",()=>{
  const first=JSON.parse(sql(`select ${purge()};`))
  expect(first).toMatchObject({scope:"native_responses",deletedCount:50,moreRemainingAtCommit:true,captureComplete:false,releaseQualified:false})
  expect(first).not.toHaveProperty("organizationComplete");expect(JSON.stringify(first)).not.toContain("Cleanup private sentinel")
  expect(JSON.parse(sql(`select ${purge()};`))).toEqual(first)
  for(const mutation of ["update public.organization_closure_response_cleanup_operations set result='{}'", "delete from public.organization_closure_response_cleanup_operations", "truncate public.organization_closure_response_cleanup_operations"])
   sql(`begin;${reject(mutation+";")}rollback;`)
  expect(JSON.parse(sql(counts))).toMatchObject({responses:11,corrections:0,receipts:1})
  expect(JSON.parse(sql(`select ${purge(9501)};`))).toMatchObject({deletedCount:10,moreRemainingAtCommit:false})
  const empty=JSON.parse(sql(`select ${purge(9502)};`));expect(empty).toMatchObject({deletedCount:0,moreRemainingAtCommit:false})
  expect(JSON.parse(sql(`select ${purge(9502)};`))).toEqual(empty)
  expect(sql(preservedRows)).toBe(preserved)
  expect(sql("select count(*) from public.organization_form_response_deletions")).toBe("60")
  expect(sql("select count(*) from public.organization_suppression_events where kind='response_deleted'")).toBe("60")
  results.push("60 responses in 50/10/0 batches, exact retry, preservation")
 })
 it("rejects predeadline deletion atomically and accepts the exact captured deadline",async()=>{
  manifestText=collect();expect(manifestText).not.toContain("Cleanup private sentinel")
  const target=restoreTarget;targets.push(target.name)
  // New independently present response must not be deleted by an old response ID.
  sql(`insert into public.organization_form_responses(version_id,id,original_hash,answers) values(public.fixture_form_id(80),public.fixture_form_id(777),repeat('e',64),'[]');`,target.url)
  const op=operatorSession(target.url);restoreOperator=op;operators.push(op);await op.query("select 1;")
  sql(`alter database "${target.name}" allow_connections false;`)
  const refused=run("psql",["-X","-qAt","-d",target.url,"-c","select 1"]);expect(refused.status).not.toBe(0);expect(refused.stderr).toContain("not currently accepting connections")
  const predeadline=JSON.parse(manifestText)
  const closeEvent=predeadline.events.find((e:{kind:string})=>e.kind==="closure_request")
  const deletedEvent=predeadline.events.find((e:{kind:string})=>e.kind==="response_deleted")
  deletedEvent.occurredAt=new Date(new Date(closeEvent.request.requestedAt).valueOf()+3600000).toISOString()
  const early=JSON.stringify(predeadline)
  const beforeRejected=await op.query("select count(*) from public.organization_form_responses;")
  await op.query(`begin;${reject(`perform public.replay_organization_suppression_history(${literal(early)},${literal(digest(early))});`,"40001","Deletion captured during unsupported closing state")}rollback;`)
  expect(await op.query("select count(*) from public.organization_form_responses;")).toBe(beforeRejected)
  deletedEvent.occurredAt=closeEvent.request.exportUntil
  const atDeadline=JSON.stringify(predeadline)
  await op.query(`begin;select public.replay_organization_suppression_history(${literal(atDeadline)},${literal(digest(atDeadline))});`)
  expect(await op.query("select count(*) from public.organization_form_responses;")).toBe("2")
  await op.query("rollback;")
  results.push("replay predeadline atomic refusal and exact deadline admission")
 })
 it("replays captured cleanup against an older backup while preserving an independent later response",async()=>{
  const op=restoreOperator
  const replay=`select public.replay_organization_suppression_history(${literal(manifestText)},${literal(digest(manifestText))});`
  const receipt=JSON.parse(await op.query(replay));expect(receipt).toMatchObject({quarantined:true,releaseQualified:false})
  expect(await op.query("select count(*) from public.organization_form_responses;")).toBe("2")
  expect(await op.query("select count(*) from public.organization_form_responses where id=public.fixture_form_id(777);")).toBe("1")
  expect(await op.query("select count(*) from public.organization_form_corrections;")).toBe("0")
  await op.query(replay);expect(await op.query("select count(*) from public.organization_form_responses;")).toBe("2")
  results.push("pinned collector and quarantined older-backup exact replay")
 })
 it("denies an old cleanup request after an actual concurrent cancellation wins",async()=>{
  const target=cancelTarget
  sql("select public.fixture_closure('request',9410,0);",target.url)
  const owner=operatorSession(target.url);operators.push(owner)
  await owner.query("begin;select public.fixture_closure('cancel',9411,1);")
  const waiting=run("psql",["-X","-qAt","-v","ON_ERROR_STOP=1","-d",target.url],`set lock_timeout='150ms';select ${purge(9520,9410)};`)
  expect(waiting.status).not.toBe(0);expect(waiting.stderr).toContain("lock timeout")
  await owner.query("commit;")
  sql(reject(`perform ${purge(9520,9410)};`),target.url)
  expect(sql("select count(*) from public.organization_form_responses;",target.url)).toBe("61")
  expect(sql("select count(*) from public.organization_closure_response_cleanup_operations;",target.url)).toBe("0")
  sql("select public.fixture_closure('request',9412,2);",target.url)
  sql(reject(`perform ${purge(9521,9410)};`),target.url)
  expect(sql("select revision from public.organization_closures where org_id=public.fixture_form_id(1);",target.url)).toBe("3")
  expect(sql("select count(*) from public.organization_form_responses;",target.url)).toBe("61")
  results.push("actual cancellation wins and newer request rejects old cleanup identity")
 })
})
