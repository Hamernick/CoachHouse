import { createHash } from "node:crypto"
import { spawn, spawnSync } from "node:child_process"
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

const templateUrl=process.env.WORKSPACE_ASSET_RETIREMENT_TEST_DATABASE_URL
const migration="supabase/migrations/20261103220000_workspace_page_asset_retirement.sql"
const env={...process.env,PGOPTIONS:"-c statement_timeout=5000 -c coach_house.workspace_sharing_fixture=isolated-test-only -c timezone=UTC"}
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

const dependencies=["20261103040000_workspace_page_note_edit_scope.sql","20261103070000_unpublished_form_collaboration.sql","20261103090000_organization_suppression_capture.sql","20261103100000_organization_suppression_history_replay.sql","20261103110000_organization_form_invitation_suppression.sql","20261103120000_organization_form_reviewer_suppression.sql","20261103130000_organization_form_reviewer_history_replay.sql","20261103140000_organization_form_manager_invalidation.sql","20261103150000_organization_form_primary_manager_suppression.sql","20261103160000_organization_form_primary_authority_fence.sql","20261103170000_workspace_page_invitation_suppression.sql","20261103180000_workspace_page_note_scope_suppression.sql","20261103190000_organization_suppression_capacity.sql","20261103200000_workspace_page_logo_grants.sql"]
const results:string[]=[]
let url:string,directory:string
const sql=(text:string)=>command("psql",["-X","-qAt","-v","ON_ERROR_STOP=1","-d",url],text)
const cleanup="select public.workspace_page_image_orphans();"
const reject=(statement:string,code:string)=>`do $test$ begin begin ${statement} raise exception 'Unexpected success' using errcode='P9999';exception when others then if sqlstate<>'${code}' then raise;end if;end;end $test$;`
const path=(n:number,kind="image")=>`public.fixture_form_id(1)::text||'/'||public.fixture_form_id(10)::text||'/'||public.fixture_form_id(${n})::text||'.${kind==="image"?"webp":"txt"}'`
function copy(n:number,kind="image",age="25 hours"){
 const table=`public.workspace_page_${kind}_grants`,base=kind==="image"?60:61
 return `insert into ${table} select * from jsonb_populate_record(null::${table},(select to_jsonb(g) from ${table} g where id=public.fixture_form_id(${base}))||jsonb_build_object('id',public.fixture_form_id(${n}),'storage_path',${path(n,kind)}));insert into storage.objects(bucket_id,name,created_at,metadata) values('workspace-page-assets',${path(n,kind)},clock_timestamp()-interval '${age}','{"mimetype":"${kind==="image"?"image/webp":"text/plain"}","size":20}');`
}
const count=(n:number,kind="image")=>`(select count(*) from public.workspace_page_${kind}_grants where id=public.fixture_form_id(${n}))`
const preserve=`select jsonb_build_object('files',(select jsonb_agg(to_jsonb(f) order by id) from public.organization_document_files f),'external',(select jsonb_agg(to_jsonb(f) order by id) from public.organization_external_documents f),'users',(select jsonb_agg(to_jsonb(u) order by id) from auth.users u),'other',(select to_jsonb(p) from public.organization_workspace_pages p where id=public.fixture_form_id(11)));`
const makePrivate=(op:number)=>`select public.commit_workspace_page(public.fixture_form_id(1),public.fixture_form_id(1),public.fixture_form_id(10),public.fixture_form_id(${op}),repeat('a',64),(select revision from public.organization_workspace_pages where id=public.fixture_form_id(10)),'make_private','{}',null,null,null);`
function publishImage(n:number){return `select public.commit_workspace_page(public.fixture_form_id(1),public.fixture_form_id(1),public.fixture_form_id(10),public.fixture_form_id(${n+9000}),repeat('c',64),(select revision from public.organization_workspace_pages where id=public.fixture_form_id(10)),'publish',jsonb_build_object('title','New image','description','','particleIds',jsonb_build_array(public.fixture_form_id(20))),jsonb_build_object('version',1,'brand',jsonb_build_object('name','Community table','organizationSlug','community-table'),'title','New image','description','','items',jsonb_build_array(jsonb_build_object('id',public.fixture_form_id(20),'title','Image','content',jsonb_build_object('kind','image','assetId',public.fixture_form_id(${n}),'alt','Image')))),(select state->'particleGraph' from public.organization_workspace_boards where org_id=public.fixture_form_id(1)),(select updated_at from public.organizations where user_id=public.fixture_form_id(1)),'[]',null,null,jsonb_build_array(jsonb_build_object('id',public.fixture_form_id(${n}),'source',(select to_jsonb(f) from public.organization_document_files f where id=public.fixture_form_id(50)),'path',${path(n)},'sha256',repeat('b',64),'size',20,'width',10,'height',10)));`}
const shape=`select jsonb_build_object('images',(select count(*) from public.workspace_page_image_grants),'documents',(select count(*) from public.workspace_page_document_grants),'objects',(select count(*) from storage.objects),'events',(select count(*) from public.organization_suppression_events),'highWater',(select high_water from public.organization_suppression_capture_state));`

describe.skipIf(!templateUrl).sequential("bounded superseded reviewed-copy retirement",()=>{
 beforeAll(()=>{
  const template=new URL(templateUrl!)
  if(!["localhost","127.0.0.1","[::1]"].includes(template.hostname)||!/^\/workspace_sharing_fixture_[a-z0-9_]+$/.test(template.pathname)||template.password)throw new Error("Explicit disposable local fixture required")
  directory=mkdtempSync(join(tmpdir(),"ch-asset-retirement-"))
  const dump=join(directory,"template.sql");command("pg_dump",["--format=plain","--file",dump,"--dbname",templateUrl!])
  const name=`workspace_sharing_fixture_retirement_${process.pid}_${Date.now()}`,target=new URL(template);target.pathname=`/${name}`;url=target.toString()
  command("createdb",["--maintenance-db",templateUrl!,name]);command("psql",["-X","-q","-v","ON_ERROR_STOP=1","-d",url],readFileSync(dump,"utf8"))
  sql("alter table public.organization_workspace_boards add column created_at timestamptz not null default now(),add column updated_at timestamptz not null default now();select public.fixture_closure_storage();")
  // These are synthetic local library source rows and Storage metadata, not
  // provider bytes. Match the original reviewed grant source identities.
  sql(`insert into public.organization_document_files select * from jsonb_populate_record(null::public.organization_document_files,(select to_jsonb(f) from public.organization_document_files f where id=public.fixture_form_id(1001))||jsonb_build_object('id',public.fixture_form_id(50),'name','Image.png','mime_type','image/png','size_bytes',123,'storage_path',public.fixture_form_id(1)::text||'/library/image.png'));insert into public.organization_document_files select * from jsonb_populate_record(null::public.organization_document_files,(select to_jsonb(f) from public.organization_document_files f where id=public.fixture_form_id(1001))||jsonb_build_object('id',public.fixture_form_id(51),'name','Guide.txt','mime_type','text/plain','size_bytes',123,'storage_path',public.fixture_form_id(1)::text||'/library/guide.txt'));`)
  // The inherited response fixture uses abbreviated image/document items. Give
  // this cleanup fixture the actual required reviewed snapshot fields first.
  for(const column of ["published_snapshot","guest_snapshot"])sql(`update public.organization_workspace_pages set ${column}=jsonb_set(jsonb_set(jsonb_set(jsonb_set(${column},'{items,1,title}','"Reviewed image"'),'{items,1,content,alt}','"Image"'),'{items,2,title}','"Reviewed document"'),'{items,2,content,name}','"Guide.txt"') where id=public.fixture_form_id(10);`)
  sql([...dependencies,"20261103210000_workspace_publication_asset_suppression.sql"].map(file=>readFileSync("supabase/migrations/"+file,"utf8")).concat(readFileSync(migration,"utf8")).join("\n"))
 })
 afterAll(()=>{if(url)writeFileSync("/tmp/ch-c4-asset-retirement-proof.json",JSON.stringify({database:url,directory,migration,sha256:createHash("sha256").update(readFileSync(migration)).digest("hex"),results,localOnly:true,physicalStorageDeletionProven:false,testSha256:createHash("sha256").update(readFileSync("tests/acceptance/workspace-page-asset-retirement-database.test.ts")).digest("hex"),dependencyHashes:Object.fromEntries([...dependencies,"20261103210000_workspace_publication_asset_suppression.sql"].map(file=>[file,createHash("sha256").update(readFileSync("supabase/migrations/"+file)).digest("hex")])),releaseQualified:false},null,2)+"\n")})
 it("retires exact superseded image/document grants while preserving all channels, logo, source files and bytes",()=>{
  const baseline=sql(preserve)
  const output=sql(`begin;${copy(860)}${copy(861)}${copy(862,"document")}${copy(863,"image","23 hours")}
   update public.organization_workspace_pages set published_snapshot=jsonb_set(published_snapshot,'{brand,logo}',jsonb_build_object('assetId',public.fixture_form_id(860),'width',10,'height',10)) where id=public.fixture_form_id(10);
   update storage.objects set created_at=clock_timestamp()-interval '25 hours' where bucket_id='workspace-page-assets';
   update storage.objects set created_at=clock_timestamp()-interval '23 hours' where name=${path(863)};
   set local role service_role;${cleanup}reset role;
   select jsonb_build_object('currentImage',${count(60)},'currentDocument',${count(61,"document")},'logo',${count(860)},'oldImage',${count(861)},'oldDocument',${count(862,"document")},'young',${count(863)},'bytes',(select count(*) from storage.objects where name in (${path(861)},${path(862,"document")})), 'events',(select count(*) from public.organization_suppression_events where kind='workspace_page_access_revoked' and page_access->>'domain' in ('image','document')));
   ${preserve}rollback;`).split("\n")
  const orphans=JSON.parse(output[0]);expect(orphans).toContain(sql(`select ${path(861)}`));expect(orphans).toContain(sql(`select ${path(862,"document")}`))
  expect(JSON.parse(output[1])).toEqual({currentImage:1,currentDocument:1,logo:1,oldImage:0,oldDocument:0,young:1,bytes:2,events:2})
  expect(output[2]).toBe(baseline);results.push("union/logo/exact retirement/source and Storage metadata preservation")
 })
 it("keeps retained editor publication private and a distinct guest-held copy",()=>{
  const output=sql(`begin;${copy(864,"document")}
   update public.organization_workspace_pages set guest_snapshot=jsonb_set(guest_snapshot,'{items}',jsonb_build_array(jsonb_build_object('id',public.fixture_form_id(21),'title','Guest document','content',jsonb_build_object('kind','document','assetId',public.fixture_form_id(864),'name','Guide.txt')))) where id=public.fixture_form_id(10);
   ${makePrivate(9864)}update storage.objects set created_at=clock_timestamp()-interval '25 hours' where bucket_id='workspace-page-assets';${cleanup}
   select public.read_workspace_page_image(public.fixture_form_id(60),'editor',public.fixture_form_id(1));
   select jsonb_build_object('image',${count(60)},'document',${count(61,"document")},'guest',${count(864,"document")});rollback;`).split("\n")
  expect(JSON.parse(output.at(-1)!)).toEqual({image:1,document:1,guest:1});expect(JSON.parse(output.at(-2)!)).not.toBeNull();results.push("private editor and independent guest preservation")
 })
 it("fails closed for malformed and unknown authority snapshots",()=>{
  for(const snapshot of ["null","{}",'{"version":2,"brand":{},"items":[]}', '{"version":1,"brand":{},"items":null}', '{"version":1,"brand":{},"items":[{"content":{"kind":"future_asset"}}]}', '{"version":1,"brand":{"logo":null},"items":[{"content":{"kind":"text"}}]}']){
   const output=sql(`begin;${copy(865)}update public.organization_workspace_pages set guest_snapshot='${snapshot}'::jsonb where id=public.fixture_form_id(10);${cleanup}select ${count(865)};rollback;`).split("\n")
   expect(output.at(-1)).toBe("1")
  }
  for(const mutation of ["published_snapshot-'title'","published_snapshot#-'{brand,name}'","jsonb_set(published_snapshot,'{brand,logo}',jsonb_build_object('assetId',public.fixture_form_id(60)))","jsonb_set(published_snapshot,'{items}',jsonb_build_array(jsonb_build_object('id',public.fixture_form_id(20),'title','Missing alt','content',jsonb_build_object('kind','image','assetId',public.fixture_form_id(60)))))"]){
   expect(sql(`select public.workspace_page_snapshot_excludes_asset(${mutation},public.fixture_form_id(9999)) from public.organization_workspace_pages where id=public.fixture_form_id(10);`)).toBe("f")
  }
  for(const content of [{kind:"text"},{kind:"notes",markdown:"Saved"},{kind:"event",startsAt:null},{kind:"color",hex:"#123456"},{kind:"form",definition:{}},{kind:"drive_link",href:"https://docs.google.com/document/d/synthetic/edit"},{kind:"image",assetId:"10000000-0000-4000-8000-000000000060",alt:"Image"},{kind:"document",assetId:"10000000-0000-4000-8000-000000000061",name:"Guide.txt"}]){
   expect(sql(`select public.workspace_page_snapshot_excludes_asset(jsonb_set(published_snapshot,'{items}',jsonb_build_array(jsonb_build_object('id',public.fixture_form_id(20),'title','Valid kind','content','${JSON.stringify(content)}'::jsonb))),public.fixture_form_id(9999)) from public.organization_workspace_pages where id=public.fixture_form_id(10);`)).toBe("t")
  }
  results.push("malformed and unknown snapshot retention")
 })
 it("bounds retirement to 2, paths to 100 and makes retries idempotent",()=>{
  const copies=Array.from({length:13},(_,i)=>copy(10000+i)).join("\n")
  // Simulate only Storage metadata removal in the isolated fixture. This is
  // not evidence that provider bytes were deleted by the deployed worker.
  const remove=`delete from storage.objects o where bucket_id='workspace-page-assets' and not exists(select 1 from public.workspace_page_image_grants g where g.storage_path=o.name) and not exists(select 1 from public.workspace_page_document_grants g where g.storage_path=o.name);`
  const remaining="select count(*) from public.workspace_page_image_grants where id>=public.fixture_form_id(10000);"
  const passes=Array.from({length:7},()=>cleanup+remaining+remove).join("\n")
  const output=sql(`begin;${copies}${passes}${cleanup}${cleanup}select count(*) from public.organization_suppression_events where kind='workspace_page_access_revoked' and page_access->>'domain'='image';rollback;`).split("\n")
  for(let pass=0;pass<7;pass++){
   expect(JSON.parse(output[pass*2])).toHaveLength(Math.min(2,13-pass*2))
   expect(output[pass*2+1]).toBe(String(Math.max(0,11-pass*2)))
  }
  expect(JSON.parse(output[14])).toEqual([]);expect(JSON.parse(output[15])).toEqual([]);expect(output[16]).toBe("13")
  expect(JSON.parse(sql(`begin;insert into storage.objects(bucket_id,name,created_at) select 'workspace-page-assets','orphan/'||n,clock_timestamp()-interval '25 hours' from generate_series(1,105) n;${cleanup}rollback;`))).toHaveLength(100);results.push("13 obsolete copies in bounded 2-copy/100-path passes, retry identity and stable empty follow-up")
 })
 it("serializes canonical publication and cleanup in both lock orders",async()=>{
  sql(copy(866))
  const owner=operatorSession(url)
  try{
   await owner.query(`begin;${makePrivate(9866)}`)
   expect(JSON.parse(sql(cleanup))).not.toContain(sql(`select ${path(866)}`));expect(sql(`select ${count(866)}`)).toBe("1")
   await owner.query("rollback;")
   await owner.query(`begin;${cleanup}`)
   sql(`begin;set local lock_timeout='100ms';${reject(makePrivate(9867).replace(/^select/,"perform"),"55P03")}rollback;`)
   await owner.query("commit;")
   expect(sql(`select ${count(866)}`)).toBe("0")
   sql(`begin;${makePrivate(9867)}rollback;`)
  }finally{owner.child.stdin.end()}
  results.push("canonical publication versus cleanup lock orders")
 })
 it("rolls back every retirement on capture contention",async()=>{
  sql(copy(867));const baseline=sql(shape),owner=operatorSession(url)
  try{
   await owner.query("begin;select 1 from public.organization_suppression_capture_state where singleton for update;")
   sql(reject("perform public.workspace_page_image_orphans();","40001"));expect(sql(shape)).toBe(baseline)
   await owner.query("rollback;")
  }finally{owner.child.stdin.end()}
  results.push("capture contention atomic rollback")
 })
 it("admits a bounded batch near capacity within the unchanged 5s statement timeout",()=>{
  const baseline=sql(shape)
  // Near-capacity serialization must fit the same 5s statement timeout.
  const near=sql(`begin;${copy(26868)}select set_config('coach_house.retirement_start',(select (high_water+1)::text from public.organization_suppression_capture_state),true);
   update public.organization_suppression_capture_state set high_water=998;
   insert into public.organization_suppression_events(sequence,kind,organization_id,operation_id,revision,occurred_at)
    select n,'closure_cancel',public.fixture_form_id(1),public.fixture_form_id(100000+n),n,clock_timestamp()
    from generate_series(current_setting('coach_house.retirement_start')::integer,998) n;
   ${cleanup}select jsonb_build_object('remaining',${count(867)}+${count(26868)},'highWater',(select high_water from public.organization_suppression_capture_state));rollback;`).split("\n")
  expect(JSON.parse(near.at(-1)!)).toEqual({remaining:0,highWater:1000});expect(sql(shape)).toBe(baseline)
  results.push("near-capacity 5s statement bound")
 })
 it("rolls back every retirement when retained history reaches capacity",()=>{
  const baseline=sql(shape)
  // Synthetic answer-free filler isolates admission; it is not a restore history.
  const output=sql(`begin;
   select set_config('coach_house.retirement_start',(select (high_water+1)::text from public.organization_suppression_capture_state),true);
   update public.organization_suppression_capture_state set high_water=1000;
   insert into public.organization_suppression_events(sequence,kind,organization_id,operation_id,revision,occurred_at)
    select n,'closure_cancel',public.fixture_form_id(1),public.fixture_form_id(100000+n),n,clock_timestamp()
    from generate_series(current_setting('coach_house.retirement_start')::integer,1000) n;
   update public.organization_suppression_capture_state set high_water=1000;
   ${reject("perform public.workspace_page_image_orphans();","54000")}
   select jsonb_build_object('grant',${count(867)},'events',(select count(*) from public.organization_suppression_events),'highWater',(select high_water from public.organization_suppression_capture_state));rollback;`).split("\n")
  expect(JSON.parse(output.at(-1)!)).toEqual({grant:1,events:1000,highWater:1000});expect(sql(shape)).toBe(baseline);results.push("capacity atomic rollback")
 })
 it("preserves a newly committed canonical copy when publication races cleanup",async()=>{
  sql(`${copy(868)}insert into storage.objects(bucket_id,name,metadata) values('workspace-page-assets',${path(869)},'{"mimetype":"image/webp","size":20}');`)
  const owner=operatorSession(url)
  try{
   await owner.query(`begin;update public.organization_workspace_boards set state=jsonb_set(state,'{particleGraph}',jsonb_build_object('workspaceId',org_id,'particles',jsonb_build_array(jsonb_build_object('id',public.fixture_form_id(20),'type','activity','title','Image','data',jsonb_build_object('widget',jsonb_build_object('kind','image','fileId',public.fixture_form_id(50))))))) where org_id=public.fixture_form_id(1);${publishImage(869)}`)
   expect(JSON.parse(sql(cleanup))).not.toContain(sql(`select ${path(868)}`));expect(sql(`select ${count(868)}`)).toBe("1")
   await owner.query("commit;")
   sql(`update storage.objects set created_at=clock_timestamp()-interval '25 hours' where name=${path(869)};${cleanup}`)
   expect(sql(`select ${count(868)}`)).toBe("0");expect(sql(`select ${count(869)}`)).toBe("1")
   expect(JSON.parse(sql("select public.read_workspace_page_image(public.fixture_form_id(869),'public',null);"))).not.toBeNull()
   expect(JSON.parse(sql(publishImage(869)))).toMatchObject({replayed:true})
  }finally{owner.child.stdin.end()}
  results.push("fresh canonical publication, race, current copy and exact retry")
 })
 it("denies disabled/conditional capture hooks and keeps helpers private",()=>{
  for(const [table,trigger] of [["workspace_page_image_grants","workspace_image_generation_guard"],["workspace_page_document_grants","workspace_document_generation_guard"],["workspace_page_image_grants","workspace_image_suppression_capture"],["workspace_page_document_grants","workspace_document_suppression_capture"],["organization_suppression_events","organization_suppression_capacity"]]){
   sql(`begin;alter table public.${table} disable trigger ${trigger};${reject("perform public.workspace_page_image_orphans();","42501")}rollback;`)
  }
  sql(`begin isolation level repeatable read;${reject("perform public.workspace_page_image_orphans();","25001")}rollback;`)
  sql(`begin;drop trigger workspace_image_suppression_capture on public.workspace_page_image_grants;create trigger workspace_image_suppression_capture after delete on public.workspace_page_image_grants for each row when(false) execute function public.capture_workspace_asset_suppression();${reject("perform public.workspace_page_image_orphans();","42501")}rollback;`)
  for(const role of ["anon","authenticated","service_role"])expect(sql(`select has_function_privilege('${role}','public.workspace_page_snapshot_excludes_asset(jsonb,uuid)','execute')`)).toBe("f")
  for(const role of ["anon","authenticated"])expect(sql(`select has_function_privilege('${role}','public.workspace_page_image_orphans()','execute')`)).toBe("f")
  results.push("exact hook shape and private ACL")
 })
})
