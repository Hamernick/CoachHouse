import { createHash } from "node:crypto"
import { spawn, spawnSync } from "node:child_process"
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

const templateUrl = process.env.WORKSPACE_PUBLICATION_REPLAY_TEST_DATABASE_URL
const collector = "docs/agent/organization-suppression-capture.py"
const migration = "supabase/migrations/20261103210000_workspace_publication_asset_suppression.sql"
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
        child.stdin.write(`${sql}\n;\n\\echo ${marker}\n`)
      })
    },
  }
}


type Event = { sequence:number;eventId:string;kind:string;organizationId:string;operationId:string;revision:number;occurredAt:string;pageAccess?:{domain:string;pageId:string;grantId:string;generationId:string;createdAt:string} }
type Manifest={format:string;sourceId:string;highWater:number;events:Event[]}
type Operator=ReturnType<typeof operatorSession>
const operators:Operator[]=[],targets:string[]=[]
let sourceUrl:string,directory:string,manifestText:string,manifest:Manifest,beforePath:string,prePath:string,currentPath:string
let operator:Operator,current:Operator,newer:Operator,pre:Operator
let assetImage:string,assetDocument:string,preserved:string
const json=(v:unknown)=>literal(JSON.stringify(v))+"::jsonb"
function sql(text:string){return command("psql",["-X","-qAt","-v","ON_ERROR_STOP=1","-d",sourceUrl],text)}
const replay=(text:string)=>`select public.replay_organization_suppression_history(${literal(text)},${literal(digest(text))});`
const readPage=(page=10)=>`select public.read_workspace_page_public('community-table',public.fixture_form_id(${page}));`
const image=(audience="public",actor=1)=>`select public.read_workspace_page_image(public.fixture_form_id(60),'${audience}',public.fixture_form_id(${actor}));`
const document=(audience="public",actor=1)=>`select public.read_workspace_page_document(public.fixture_form_id(61),'${audience}',public.fixture_form_id(${actor}));`
const generation=`select jsonb_build_object('public',public_grant_id,'publicTime',public_granted_at,'guest',guest_grant_id,'guestTime',guest_granted_at) from public.organization_workspace_pages where id=public.fixture_form_id(10)`
const preservation=`select jsonb_build_object('users',(select jsonb_agg(to_jsonb(u) order by id) from auth.users u),'profiles',(select jsonb_agg(to_jsonb(p) order by id) from public.profiles p),'files',(select jsonb_agg(to_jsonb(f) order by id) from public.organization_document_files f),'objects',(select jsonb_agg(to_jsonb(o) order by id) from storage.objects o),'responses',(select jsonb_agg(to_jsonb(r) order by id) from public.organization_form_responses r),'otherPage',(select to_jsonb(p) from public.organization_workspace_pages p where id=public.fixture_form_id(11)));`
async function denied(statement:string,codes=["22023","40001","42501"],target=operator){
 expect(await target.query(`do $test$ begin begin ${statement} raise exception 'Unexpected success' using errcode='P9999'; exception when others then if sqlstate not in (${codes.map(literal).join(',')}) then raise;end if;end;end $test$;`)).toBe("")
}
async function restore(path:string){
 const name=`workspace_sharing_fixture_pub_target_${process.pid}_${targets.length}`,url=new URL(sourceUrl);url.pathname=`/${name}`
 command("createdb",["--maintenance-db",sourceUrl,name]);targets.push(name)
 const target=operatorSession(url.toString());operators.push(target);await target.query("select 1;")
 sql(`alter database "${name}" allow_connections false;`)
 const refused=spawnSync("psql",["-X","-qAt","-d",url.toString(),"-c","select 1"],{env,encoding:"utf8"})
 expect(refused.status).not.toBe(0);expect(refused.stderr).toContain("not currently accepting connections")
 await target.query(readFileSync(path,"utf8"));return target
}
function dump(name:string){const path=join(directory,name+".sql");command("pg_dump",["--format=plain","--file",path,"--dbname",sourceUrl]);return path}
function collect(name:string){
 const sourceId=sql("select source_id from public.organization_restore_identity"),journal=join(directory,name+".sqlite"),path=join(directory,name+".json")
 const receipt=JSON.parse(command("python3",[collector,"--source",sourceUrl,"--journal",journal,"--expected-source-id",sourceId]))
 const exported=JSON.parse(command("python3",[collector,"--journal",journal,"--expected-source-id",sourceId,"--expected-sha256",receipt.sha256,"--export",path]))
 const text=readFileSync(path,"utf8");expect(exported).toMatchObject({sha256:digest(text),captureComplete:false,releaseQualified:false});return text
}
const dependencies=["20261103040000_workspace_page_note_edit_scope.sql","20261103070000_unpublished_form_collaboration.sql","20261103090000_organization_suppression_capture.sql","20261103100000_organization_suppression_history_replay.sql","20261103110000_organization_form_invitation_suppression.sql","20261103120000_organization_form_reviewer_suppression.sql","20261103130000_organization_form_reviewer_history_replay.sql","20261103140000_organization_form_manager_invalidation.sql","20261103150000_organization_form_primary_manager_suppression.sql","20261103160000_organization_form_primary_authority_fence.sql","20261103170000_workspace_page_invitation_suppression.sql","20261103180000_workspace_page_note_scope_suppression.sql","20261103190000_organization_suppression_capacity.sql","20261103200000_workspace_page_logo_grants.sql"]
const makePrivate=`select public.commit_workspace_page(public.fixture_form_id(1),public.fixture_form_id(1),public.fixture_form_id(10),public.fixture_form_id(8800),repeat('a',64),(select revision from public.organization_workspace_pages where id=public.fixture_form_id(10)),'make_private','{}',null,null,null);`
describe.skipIf(!templateUrl).sequential("publication and copied asset exact restore suppression",()=>{
 beforeAll(async()=>{
  const template=new URL(templateUrl!)
  if(!["localhost","127.0.0.1","[::1]"].includes(template.hostname)||!/^\/workspace_sharing_fixture_[a-z0-9_]+$/.test(template.pathname)||template.password)throw new Error("Explicit disposable local fixture required")
  directory=mkdtempSync(join(tmpdir(),"ch-publication-replay-"))
  const initial=join(directory,"template.sql");command("pg_dump",["--format=plain","--file",initial,"--dbname",templateUrl!])
  const name=`workspace_sharing_fixture_pub_${process.pid}_${Date.now()}`,url=new URL(template);url.pathname=`/${name}`;sourceUrl=url.toString()
  command("createdb",["--maintenance-db",templateUrl!,name]);command("psql",["-X","-q","-v","ON_ERROR_STOP=1","-d",sourceUrl],readFileSync(initial,"utf8"))
  sql("alter table public.organization_workspace_boards add column created_at timestamptz not null default now(),add column updated_at timestamptz not null default now();select public.fixture_closure_storage();")
  for(const file of dependencies)command("psql",["-X","-q","-v","ON_ERROR_STOP=1","-d",sourceUrl],readFileSync("supabase/migrations/"+file,"utf8"))
  prePath=dump("pre-installation")
  command("psql",["-X","-q","-v","ON_ERROR_STOP=1","-d",sourceUrl],readFileSync(migration,"utf8"))
  // Independent pages isolate withdrawal, replacement, link rotation and deletion.
  for(const n of [12,13,14,15])sql(`insert into public.organization_workspace_pages(id,org_id,link_id,title,particle_ids,visibility,published_snapshot,published_at,guest_snapshot) select public.fixture_form_id(${n}),org_id,public.fixture_form_id(${n}),title,particle_ids,visibility,published_snapshot,published_at,guest_snapshot from public.organization_workspace_pages where id=public.fixture_form_id(10);`)
  assetImage=sql("select to_jsonb(g) from public.workspace_page_image_grants g where id=public.fixture_form_id(60)")
  assetDocument=sql("select to_jsonb(g) from public.workspace_page_document_grants g where id=public.fixture_form_id(61)")
  // Enabled note scope on a selected guest note exercises closure ordering with
  // the already-qualified scope capture branch. Canonical note reads have separate proof.
  sql(`insert into public.organization_workspace_pages(id,org_id,link_id,title,particle_ids,guest_snapshot) values(public.fixture_form_id(16),public.fixture_form_id(1),public.fixture_form_id(16),'Scope page',array[public.fixture_form_id(716)],jsonb_build_object('items',jsonb_build_array(jsonb_build_object('id',public.fixture_form_id(716),'content',jsonb_build_object('kind','notes')))));insert into public.workspace_page_note_scopes(page_id,org_id,particle_id,source_created_at,enabled,granted_by) values(public.fixture_form_id(16),public.fixture_form_id(1),public.fixture_form_id(716),clock_timestamp(),true,public.fixture_form_id(1));`)
  beforePath=dump("before-withdrawals");preserved=sql(preservation)
  // A withdrawn publication and a distinct subsequent consent are separate generations.
  expect(JSON.parse(sql(makePrivate))).toMatchObject({replayed:false})
  expect(JSON.parse(sql(makePrivate))).toMatchObject({replayed:true})
  sql("update public.organization_workspace_pages set published_snapshot=jsonb_set(published_snapshot,'{title}','\"Replacement\"') where id=public.fixture_form_id(12);")
  sql("update public.organization_workspace_pages set link_id=public.fixture_form_id(9913) where id=public.fixture_form_id(13);")
  sql("update public.organization_workspace_pages set guest_snapshot=null where id=public.fixture_form_id(14);")
  sql("delete from public.organization_workspace_pages where id=public.fixture_form_id(15);")
  sql("delete from public.workspace_page_image_grants where id=public.fixture_form_id(60);delete from public.workspace_page_document_grants where id=public.fixture_form_id(61);")
  // New copied grant is a distinct reviewed-copy identity, never reuse of old ID.
  sql(`insert into public.workspace_page_image_grants select * from jsonb_populate_record(null::public.workspace_page_image_grants,${literal(assetImage)}::jsonb||jsonb_build_object('id',public.fixture_form_id(860),'page_id',public.fixture_form_id(12),'storage_path','later-independent-copy.webp'));update public.organization_workspace_pages set guest_snapshot=jsonb_set(guest_snapshot,'{title}','"Later independent guest"') where id=public.fixture_form_id(12);`)
  currentPath=dump("after-withdrawals");manifestText=collect("withdrawals");manifest=JSON.parse(manifestText)
  expect(manifest.events.every(e=>e.kind==="workspace_page_access_revoked")).toBe(true)
  expect(manifest.highWater).toBe(10)
  expect(manifestText).not.toMatch(/storage_path|answers|example.org|snapshot|Replacement|actor/)
  ;[operator,current,newer,pre]=await Promise.all([restore(beforePath),restore(currentPath),restore(currentPath),restore(prePath)])
  await pre.query(readFileSync(migration,"utf8"))
  // Deliberately inconsistent quarantined fixture exercises the newer-consent branch.
  await newer.query("set session_replication_role=replica;delete from public.organization_suppression_events;update public.organization_suppression_capture_state set high_water=0;set session_replication_role=origin;")
  console.info("Publication replay fixture:",directory)
 },30_000)
 afterAll(async()=>{
  await Promise.all(operators.map(target=>new Promise<void>(resolve=>{if(target.child.exitCode!==null){resolve();return}target.child.once("close",()=>resolve());target.child.stdin.end("\\q\n")})))
  if(sourceUrl)writeFileSync("/tmp/ch-c1-publication-proof.json",JSON.stringify({sourceUrl,targets,directory,manifestSha256:manifestText?digest(manifestText):null,migrationSha256:digest(readFileSync(migration,"utf8")),collectorSha256:digest(readFileSync(collector,"utf8")),logoMigrationSha256:digest(readFileSync("supabase/migrations/20261103200000_workspace_page_logo_grants.sql","utf8")),targetAdmission:sql(`select jsonb_agg(jsonb_build_object('database',datname,'allowConnections',datallowconn,'sessions',(select count(*) from pg_stat_activity a where a.datname=d.datname))) from pg_database d where datname in (${targets.map(literal).join(',')});`)}))
 })
 it("starts with actual public, guest, native intake and copied asset reads",async()=>{
  expect(JSON.parse(await operator.query(readPage()))).toBeTruthy()
  expect(JSON.parse(await operator.query(image()))).toBeTruthy()
  expect(JSON.parse(await operator.query(document()))).toBeTruthy()
  expect(JSON.parse(await operator.query("select public.fixture_form_command('version',null);"))).toBeTruthy()
  expect(JSON.parse(await operator.query("select public.workspace_page_guest_command(public.fixture_form_id(3),public.fixture_form_id(10),'{\"action\":\"read\"}',null);"))).toBeTruthy()
 })
 it("preserves draft/no-op generations and rejects identity mutation and asset mutation",async()=>{
  const before=sql(generation)
  sql("update public.organization_workspace_pages set title=title,revision=revision+1,published_snapshot=published_snapshot,guest_snapshot=guest_snapshot where id=public.fixture_form_id(10);")
  expect(sql(generation)).toBe(before)
  await denied("update public.organization_workspace_pages set public_grant_id=gen_random_uuid() where id=public.fixture_form_id(10);",["42501"])
  await denied("update public.workspace_page_image_grants set source_id=gen_random_uuid() where id=public.fixture_form_id(60);",["42501"])
 })
 it("fails atomically under capture contention and prevents concurrent grant reuse",async()=>{
  const blocker=operatorSession(sourceUrl);operators.push(blocker)
  await blocker.query("begin;select high_water from public.organization_suppression_capture_state for share;")
  const prior=sql("select public.read_organization_suppression_events()")
  try{
   const result=spawnSync("psql",["-X","-qAt","-v","ON_ERROR_STOP=1","-d",sourceUrl],{env,encoding:"utf8",input:"\\set VERBOSITY verbose\nupdate public.organization_workspace_pages set guest_snapshot=null where id=public.fixture_form_id(10);"})
   expect(result.status).not.toBe(0);expect(result.stderr).toContain("40001")
  }finally{await blocker.query("rollback;")}
  expect(sql("select public.read_organization_suppression_events()")).toBe(prior)
  expect(sql("select guest_snapshot is not null from public.organization_workspace_pages where id=public.fixture_form_id(10)")).toBe("t")
  await blocker.query("begin;update public.organization_workspace_pages set guest_snapshot=null where id=public.fixture_form_id(10);")
  try{
   const result=spawnSync("psql",["-X","-qAt","-v","ON_ERROR_STOP=1","-d",sourceUrl],{env,encoding:"utf8",input:"\\set VERBOSITY verbose\ninsert into public.workspace_page_image_grants select * from jsonb_populate_record(null::public.workspace_page_image_grants,"+literal(assetImage)+"::jsonb);"})
   expect(result.status).not.toBe(0);expect(result.stderr).toContain("40001")
  }finally{await blocker.query("rollback;")}
 })
 it("rejects missing hooks, malformed payloads and recreated installation lineage",async()=>{
  for(const [table,trigger] of [["organization_workspace_pages","workspace_publication_suppression_capture"],["workspace_page_image_grants","workspace_image_generation_guard"],["workspace_page_document_grants","workspace_document_suppression_capture"],["organization_suppression_events","organization_suppression_capacity"]]){
   await operator.query(`begin;alter table public.${table} disable trigger ${trigger};`)
   await denied("perform public.read_organization_suppression_events();",["42501"])
   await denied(replay(manifestText).replace(/^select /,"perform "),["42501"])
   await operator.query("rollback;")
  }
  for(const patch of [{actorId:id(1)},{domain:"unbounded"},{createdAt:"infinity"},{generationId:id(9910)}]){
   const changed=structuredClone(manifest);Object.assign(changed.events[0].pageAccess!,patch)
   await denied(replay(JSON.stringify(changed)).replace(/^select /,"perform "))
   const path=join(directory,"malformed.json");writeFileSync(path,JSON.stringify(changed))
   const result=spawnSync("python3",["-c","import importlib.util,json,sys;s=importlib.util.spec_from_file_location('capture',sys.argv[1]);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);d=json.load(open(sys.argv[2]));m.validate(d,d['sourceId'])",collector,path],{encoding:"utf8"})
   if(!("generationId" in patch))expect(result.status).not.toBe(0)
  }
  await denied(replay(manifestText).replace(/^select /,"perform "),["40001"],pre)
  for(const role of ["anon","authenticated","service_role"])
   expect(sql(`select has_function_privilege('${role}','public.apply_workspace_page_access_suppression(jsonb)','execute')`)).toBe("f")
 })
 it("suppresses exact old publication and copied grants without deleting source bytes or other authority",async()=>{
  const result=JSON.parse(await operator.query(replay(manifestText)))
  expect(result).toMatchObject({applied:10,exact:0,quarantined:true,releaseQualified:false,reconciliation:{status:"requires_current_authority_reconciliation"}})
  expect(result.reconciliation.domains).toHaveLength(6)
  expect(await operator.query(readPage())).toBe("")
  expect(await operator.query(image())).toBe("");expect(await operator.query(document("editor"))).toBe("")
  await denied("perform public.fixture_form_command('version',null);",["42501"])
  expect(JSON.parse(await operator.query("select public.workspace_page_guest_command(public.fixture_form_id(3),public.fixture_form_id(10),'{\"action\":\"read\"}',null);"))).toBeTruthy()
  expect(await operator.query(preservation)).toBe(preserved)
  expect(JSON.parse(await operator.query(replay(manifestText)))).toMatchObject({applied:0,exact:10})
  for(const [type,row] of [["image",assetImage],["document",assetDocument]])
   await denied(`insert into public.workspace_page_${type}_grants select * from jsonb_populate_record(null::public.workspace_page_${type}_grants,${literal(row)}::jsonb);`,["42501"])
 })
 it("preserves later independent publication and absent grant history",async()=>{
  const before=await newer.query("select to_jsonb(p) from public.organization_workspace_pages p where id=public.fixture_form_id(12)")
  expect(JSON.parse(await newer.query(replay(manifestText)))).toMatchObject({applied:10})
  expect(await newer.query("select to_jsonb(p) from public.organization_workspace_pages p where id=public.fixture_form_id(12)")).toBe(before)
  expect(await newer.query("select count(*) from public.workspace_page_image_grants where id=public.fixture_form_id(860)")).toBe("1")
  expect(JSON.parse(await newer.query(readPage(12)))).toBeTruthy()
  expect(JSON.parse(await current.query(replay(manifestText)))).toMatchObject({applied:0,exact:10})
 })
 it("replays actual request/cancel mixed history without restoring publication or grants",async()=>{
  sql("select public.fixture_closure('request',8890,0);select public.fixture_closure('cancel',8891,1);")
  const text=collect("closure"),mixed:Manifest=JSON.parse(text)
  expect(mixed.events.at(-1)?.kind).toBe("closure_cancel")
  expect(mixed.events.some(e=>e.kind==="workspace_page_invitation_revoked")).toBe(true)
  expect(mixed.events.some(e=>e.kind==="workspace_page_note_scope_revoked")).toBe(true)
  const before=await current.query(preservation)
  expect(JSON.parse(await current.query(replay(text)))).toMatchObject({exact:10,applied:mixed.highWater-10,releaseQualified:false})
  expect(await current.query(preservation)).toBe(before)
  expect(await current.query("select bool_and(visibility='private' and guest_snapshot is null) from public.organization_workspace_pages where org_id=public.fixture_form_id(1)")).toBe("t")
  expect(await current.query("select count(*) from public.workspace_page_image_grants where org_id=public.fixture_form_id(1)")).toBe("0")
  expect(await current.query("select count(*) from public.workspace_page_document_grants where org_id=public.fixture_form_id(1)")).toBe("0")
  expect(JSON.parse(await current.query(replay(text)))).toMatchObject({applied:0,exact:mixed.highWater})
 })
})
