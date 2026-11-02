import { createHash } from "node:crypto"
import { spawn, spawnSync } from "node:child_process"
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { noteFixtureGraph } from "./fixtures/workspace-page-note-source"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

const templateUrl = process.env.WORKSPACE_PAGE_NOTE_SCOPE_REPLAY_TEST_DATABASE_URL
const collector = "docs/agent/organization-suppression-capture.py"
const migration = "supabase/migrations/20261103180000_workspace_page_note_scope_suppression.sql"
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
        child.stdin.write(`${sql}\n\\echo ${marker}\n`)
      })
    },
  }
}

type Event = {
 sequence:number;eventId:string;kind:string;organizationId:string;operationId:string;revision:number;occurredAt:string
 pageNoteScope:{pageId:string;particleId:string;canvasId:string|null;sourceCreatedAt:string;generationId:string;grantId:string;createdAt:string}
}
type Manifest = { format: string; sourceId: string; capturedSince: string; historyRequiresReconciliation: boolean; highWater: number; events: Event[] }
type Operator = ReturnType<typeof operatorSession>
const operators: Operator[] = []
const targets: string[] = []
let operator: Operator, current: Operator, preInstallation: Operator, newer: Operator
let sourceUrl: string, manifest: Manifest, manifestText: string, directory: string, journalPath: string, manifestPath: string
let beforePreserved: string
const replay = (text: string, hash = digest(text)) =>
  `select public.replay_organization_suppression_history(${literal(text)},${literal(hash)});`
const state = `select jsonb_build_object(
  'scopes',(select jsonb_agg(to_jsonb(s) order by page_id,particle_id) from public.workspace_page_note_scopes s),
  'boards',(select jsonb_agg(to_jsonb(b) order by org_id) from public.organization_workspace_boards b),
  'invitations',(select jsonb_agg(to_jsonb(g) order by id) from public.workspace_page_invitations g),
  'profiles',(select jsonb_agg(to_jsonb(p) order by id) from public.profiles p),
  'users',(select jsonb_agg(to_jsonb(p) order by id) from auth.users p),
  'pages',(select jsonb_agg(to_jsonb(p) order by id) from public.organization_workspace_pages p),
  'files',(select jsonb_agg(to_jsonb(p) order by id) from public.organization_document_files p),
  'objects',(select jsonb_agg(to_jsonb(p) order by id) from storage.objects p),
  'responses',(select jsonb_agg(to_jsonb(r) order by id) from public.organization_form_responses r),
  'capture',public.read_organization_suppression_events(),
  'contexts',(select count(*) from public.organization_suppression_replay_context),
  'quarantined',(select not datallowconn from pg_database where datname=current_database()));`
function sql(text: string) {
  return command("psql", ["-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-d", sourceUrl], text)
}
async function denied(statement: string, codes = ["22023", "40001", "42501"], target = operator) {
  expect(await target.query(`do $test$ begin
    begin ${statement} raise exception 'Unexpected successful operation' using errcode='P9999';
    exception when others then if sqlstate not in (${codes.map(literal).join(",")}) then raise; end if; end;
  end $test$;`)).toBe("")
}
async function restore(path: string) {
  const name = `workspace_sharing_fixture_note_scope_target_${process.pid}_${targets.length}`
  const url = new URL(sourceUrl); url.pathname = `/${name}`
  command("createdb", ["--maintenance-db", sourceUrl, name]); targets.push(name)
  const target = operatorSession(url.toString()); operators.push(target)
  await target.query("select 1;")
  sql(`alter database "${name}" allow_connections false;`)
  const refused = spawnSync("psql", ["-X", "-qAt", "-d", url.toString(), "-c", "select 1"], { env, encoding: "utf8" })
  expect(refused.status).not.toBe(0)
  expect(refused.stderr).toContain("not currently accepting connections")
  await target.query(readFileSync(path, "utf8"))
  return target
}
const graph = (() => {
  const original = noteFixtureGraph()
  return { ...original, particles: Array.from({ length: 8 }, (_, n) => ({ ...original.particles[0], id: id(7100+n), title: `Note ${n}`, createdAt: n===7 ? "2027-01-01T00:00:00.000Z" : original.particles[0].createdAt })) }
})()
const json = (value: unknown) => literal(JSON.stringify(value))+"::jsonb"
const scope = (page: number, enabled: boolean, operation: number) => `select public.fixture_note_scope(${page},${enabled},${operation});`
const noteRead = (page = 7000) => `select public.workspace_page_note_command(public.fixture_form_id(2),public.fixture_form_id(${page}),jsonb_build_object('action','read','particleId',public.fixture_form_id(${page+100})));`
const dependencies = ["20261103090000_organization_suppression_capture.sql", "20261103100000_organization_suppression_history_replay.sql",
  "20261103110000_organization_form_invitation_suppression.sql", "20261103120000_organization_form_reviewer_suppression.sql", "20261103130000_organization_form_reviewer_history_replay.sql", "20261103140000_organization_form_manager_invalidation.sql",
  "20261103150000_organization_form_primary_manager_suppression.sql", "20261103160000_organization_form_primary_authority_fence.sql", "20261103170000_workspace_page_invitation_suppression.sql"]
async function collect(suffix: string) {
  const journal=join(directory,`${suffix}.sqlite`), path=join(directory,`${suffix}.json`)
  const sourceId=sql("select source_id from public.organization_restore_identity")
  const result=JSON.parse(command("python3",[collector,"--source",sourceUrl,"--journal",journal,"--expected-source-id",sourceId]))
  const exported=JSON.parse(command("python3",[collector,"--journal",journal,"--expected-source-id",sourceId,"--expected-sha256",result.sha256,"--export",path]))
  const text=readFileSync(path,"utf8")
  expect(exported).toMatchObject({sha256:digest(text),captureComplete:false,releaseQualified:false})
  return {journal,path,text,manifest:JSON.parse(text) as Manifest}
}
const preserved = (value: Record<string, unknown>) => JSON.stringify([value.profiles,value.users,value.pages,value.boards,value.invitations,value.files,value.objects,value.responses])

describe.skipIf(!templateUrl).sequential("workspace page note scope revocation recovery", () => {
  beforeAll(async () => {
    const template = new URL(templateUrl!)
    if (!["localhost", "127.0.0.1", "[::1]"].includes(template.hostname)
      || !/^\/workspace_sharing_fixture_[a-z0-9_]+$/.test(template.pathname) || template.password)
      throw new Error("Only an explicitly provisioned disposable local fixture is allowed")
    directory = mkdtempSync(join(tmpdir(), "ch-note-scope-replay-"))
    const initialDump = join(directory, "template.sql")
    command("pg_dump", ["--format=plain", "--file", initialDump, "--dbname", templateUrl!])
    const name = `workspace_sharing_fixture_note_scope_${process.pid}_${Date.now()}`
    const source = new URL(template); source.pathname = `/${name}`; sourceUrl = source.toString()
    command("createdb", ["--maintenance-db", templateUrl!, name])
    command("psql", ["-X", "-q", "-v", "ON_ERROR_STOP=1", "-d", sourceUrl], readFileSync(initialDump, "utf8"))
    // Match the production board timestamps, as in workspace-page-note-access-fixture.sql.
    sql("alter table public.organization_workspace_boards add column created_at timestamptz not null default timezone('utc',now()),add column updated_at timestamptz not null default timezone('utc',now());")
    sql("select public.fixture_closure_storage(); delete from public.workspace_page_invitations; delete from public.organization_memberships where org_id=public.fixture_form_id(1) and member_id=public.fixture_form_id(2);")
    for (const file of ["20261103040000_workspace_page_note_edit_scope.sql","20261103070000_unpublished_form_collaboration.sql",...dependencies])
      command("psql", ["-X", "-q", "-v", "ON_ERROR_STOP=1", "-d", sourceUrl], readFileSync("supabase/migrations/"+file,"utf8"))
    sql(`update public.organization_workspace_boards set state=${json({particleGraph:graph,unrelatedField:"keep"})},updated_by=public.fixture_form_id(1) where org_id=public.fixture_form_id(1);
      create function public.fixture_note_scope(page integer,enabled boolean,op integer) returns jsonb language sql as $$
      select public.workspace_page_note_command(public.fixture_form_id(1),public.fixture_form_id(page),jsonb_build_object('action','set_scope','particleId',public.fixture_form_id(page+100),'operationId',public.fixture_form_id(op),'expectedPageRevision',(select revision from public.organization_workspace_pages where id=public.fixture_form_id(page)),'expectedNoteRevision',1,'enabled',enabled),repeat('b',64)); $$;`)
    for(let n=0;n<8;n++) {
      const snapshot={version:1,brand:{name:"Organization",organizationSlug:"organization"},title:`Note page ${n}`,description:"Reviewed",items:[{id:id(7100+n),title:`Note ${n}`,content:{kind:"notes",markdown:"Shared source"}}]}
      sql(`insert into public.organization_workspace_pages(id,org_id,link_id,title,description,particle_ids,guest_snapshot,published_snapshot,published_at,visibility) values('${id(7000+n)}','${id(1)}','${id(7000+n)}','Note page ${n}','Reviewed',array['${id(7100+n)}'::uuid],${json(snapshot)},${json(snapshot)},clock_timestamp(),'public');`)
      if(n===0) sql(`select public.workspace_page_guest_command('${id(1)}','${id(7000)}',${json({action:"invite",invitationId:id(7200),operationId:id(7201),email:"person2@example.org",permission:"edit"})},repeat('a',64));select public.workspace_page_guest_command('${id(2)}','${id(7000)}',${json({action:"accept",invitationId:id(7200)})},null);`)
      if(n!==6) sql(scope(7000+n,true,7300+n))
    }
    sql("update public.workspace_page_note_scopes set granted_by=public.fixture_form_id(13) where page_id=public.fixture_form_id(7007)")
    const preInstallationPath=join(directory,"before-installation.sql")
    command("pg_dump",["--format=plain","--file",preInstallationPath,"--dbname",sourceUrl])
    command("psql",["-X","-q","-v","ON_ERROR_STOP=1","-d",sourceUrl],readFileSync(migration,"utf8"))
    const beforePath=join(directory,"before-revocations.sql")
    command("pg_dump",["--format=plain","--file",beforePath,"--dbname",sourceUrl])
    sql("begin;"+scope(7000,false,7400)+"rollback;")
    expect(sql("select public.read_organization_suppression_events()->>'highWater'")).toBe("0")
    expect(JSON.parse(sql(scope(7000,false,7400)))).toMatchObject({replayed:false})
    expect(JSON.parse(sql(scope(7000,false,7400)))).toMatchObject({replayed:true})
    sql(scope(7000,true,7401))
    sql(`update public.organization_workspace_boards set state=jsonb_set(state,'{particleGraph,particles}',${json(graph.particles.filter((_,n)=>n!==2))}) where org_id='${id(1)}';update public.organization_workspace_boards set state=jsonb_set(state,'{particleGraph}',${json(graph)}) where org_id='${id(1)}';`)
    sql(`update public.organization_workspace_pages set particle_ids=array['${id(7101)}'::uuid] where id='${id(7003)}';update public.organization_workspace_pages set particle_ids=array['${id(7103)}'::uuid] where id='${id(7003)}';delete from public.workspace_page_note_scopes where page_id='${id(7004)}';delete from public.organization_workspace_pages where id='${id(7005)}';`)
    sql(scope(7006,true,7406)+scope(7006,false,7407))
    const currentPath=join(directory,"after-revocations.sql")
    command("pg_dump",["--format=plain","--file",currentPath,"--dbname",sourceUrl])
    const collected=await collect("suppression")
    journalPath=collected.journal;manifestPath=collected.path;manifestText=collected.text;manifest=collected.manifest
    expect(manifest.highWater).toBe(6)
    expect(manifest.events.map(e=>e.kind)).toEqual(Array(6).fill("workspace_page_note_scope_revoked"))
    expect(manifestText).not.toMatch(/example.org|grantedBy|actor|Shared source|Private|answers/)
    operator=await restore(beforePath);current=await restore(currentPath);preInstallation=await restore(preInstallationPath)
    await preInstallation.query(readFileSync(migration,"utf8"))
    newer=await restore(currentPath)
    // Deliberately inconsistent backup fixture: current grants with capture prefix absent.
    // Only the quarantined operator constructs it, to exercise the apply branch.
    await newer.query("set session_replication_role=replica;delete from public.organization_suppression_events;update public.organization_suppression_capture_state set high_water=0;set session_replication_role=origin;")
    beforePreserved=preserved(JSON.parse(await operator.query(state)))
    writeFileSync(join(directory,"fixtures.json"),JSON.stringify({sourceUrl,targets,journalPath,manifestPath,beforePath,currentPath,preInstallationPath}))
    console.info("Note scope replay fixtures:",join(directory,"fixtures.json"))
  },30_000)
  afterAll(async()=>{
    await Promise.all(operators.map(target=>new Promise<void>(resolve=>{
      if(target.child.exitCode!==null){resolve();return}
      target.child.once("close",()=>resolve());target.child.stdin.end("\\q\n")
    })))
  })

  it("starts with canonical guest note read/write and page access",async()=>{
    const read=JSON.parse(await operator.query(noteRead()))
    expect(read.note.content).toBe("Shared source")
    const next=structuredClone(read.graph);next.revision++;next.particles[0].revision=next.revision
    next.particles[0].data.widget.source.content="Changed source"
    await operator.query("begin;")
    const result=JSON.parse(await operator.query(`select public.workspace_page_note_command('${id(2)}','${id(7000)}',${json({action:"write",particleId:id(7100),operationId:id(7500),expectedNoteRevision:1,content:"Changed source",html:"<p>Shared source</p>"})},repeat('c',64),${json(read.graph)},${json(next)});`))
    expect(result.note.content).toBe("Changed source")
    await operator.query("rollback;")
    expect(preserved(JSON.parse(await operator.query(state)))).toBe(beforePreserved)
  })

  it("preserves generations for no-op updates and rolls back canonical disable on capture contention",async()=>{
    const before=sql("select to_jsonb(s) from public.workspace_page_note_scopes s where page_id=public.fixture_form_id(7001)")
    const identityBefore=sql("select grant_id from public.workspace_page_note_scopes where page_id=public.fixture_form_id(7001)")
    sql(scope(7001,true,7490))
    expect(sql("select grant_id from public.workspace_page_note_scopes where page_id=public.fixture_form_id(7001)")).toBe(identityBefore)
    // A genuine canonical no-op advances only its receipt/page revision.
    const retiredBefore=sql("select to_jsonb(s)-'updated_at' from public.workspace_page_note_scopes s where page_id=public.fixture_form_id(7006)")
    sql(scope(7006,false,7491))
    expect(sql("select to_jsonb(s)-'updated_at' from public.workspace_page_note_scopes s where page_id=public.fixture_form_id(7006)")).toBe(retiredBefore)
    sql(scope(7006,true,7406))
    expect(sql("select enabled from public.workspace_page_note_scopes where page_id=public.fixture_form_id(7006)")).toBe("f")
    const afterNoop=sql("select to_jsonb(s) from public.workspace_page_note_scopes s where page_id=public.fixture_form_id(7001)")
    expect(JSON.parse(afterNoop).grant_id).toBe(JSON.parse(before).grant_id)
    const blocker=operatorSession(sourceUrl);operators.push(blocker)
    const prior=sql("select jsonb_build_object('capture',public.read_organization_suppression_events(),'receipts',(select jsonb_agg(to_jsonb(r) order by page_id,operation_id) from public.workspace_page_note_receipts r))")
    await blocker.query("begin;select high_water from public.organization_suppression_capture_state for share;")
    try{
      const result=spawnSync("psql",["-X","-qAt","-v","ON_ERROR_STOP=1","-d",sourceUrl],{env,encoding:"utf8",input:"\\set VERBOSITY verbose\n"+scope(7001,false,7501)})
      expect(result.status).not.toBe(0);expect(result.stderr).toContain("40001");expect(result.stderr).toContain("Suppression capture busy")
    }finally{await blocker.query("rollback;")}
    expect(sql("select to_jsonb(s) from public.workspace_page_note_scopes s where page_id=public.fixture_form_id(7001)")).toBe(afterNoop)
    expect(sql("select jsonb_build_object('capture',public.read_organization_suppression_events(),'receipts',(select jsonb_agg(to_jsonb(r) order by page_id,operation_id) from public.workspace_page_note_receipts r))")).toBe(prior)
  })

  it("retires actual source/grantor replacements but preserves consent across Auth SET NULL",async()=>{
    const before=JSON.parse(sql("select jsonb_build_object('row',(select to_jsonb(s) from public.workspace_page_note_scopes s where page_id=public.fixture_form_id(7001)),'capture',public.read_organization_suppression_events())"))
    const changed=JSON.parse(sql("begin;update public.workspace_page_note_scopes set granted_by=public.fixture_form_id(2) where page_id=public.fixture_form_id(7001);update public.workspace_page_note_scopes set source_created_at=source_created_at+interval '1 second' where page_id=public.fixture_form_id(7001);select jsonb_build_object('row',(select to_jsonb(s) from public.workspace_page_note_scopes s where page_id=public.fixture_form_id(7001)),'capture',public.read_organization_suppression_events());rollback;"))
    expect(changed.row.grant_id).not.toBe(before.row.grant_id)
    expect(changed.capture.highWater).toBe(before.capture.highWater+2)
    expect(changed.capture.events.at(-2).pageNoteScope.grantId).toBe(before.row.grant_id)
    expect(changed.capture.events.at(-1).pageNoteScope.grantId).not.toBe(changed.row.grant_id)
    const original=JSON.parse(sql("select to_jsonb(s) from public.workspace_page_note_scopes s where page_id=public.fixture_form_id(7007)"))
    const detached=JSON.parse(sql("begin;delete from auth.users where id=public.fixture_form_id(13);select jsonb_build_object('row',(select to_jsonb(s) from public.workspace_page_note_scopes s where page_id=public.fixture_form_id(7007)),'capture',public.read_organization_suppression_events());rollback;"))
    expect(detached.row).toEqual({...original,granted_by:null})
    expect(detached.capture.highWater).toBe(before.capture.highWater)
  })

  it("keeps capture helpers and scope stores private and refuses missing or narrowed hooks",async()=>{
    for(const role of ["anon","authenticated","service_role"]){
      expect(sql(`select has_function_privilege('${role}','public.record_workspace_page_note_scope_suppression(public.workspace_page_note_scopes,timestamptz)','execute')`)).toBe("f")
      expect(sql(`select has_table_privilege('${role}','public.workspace_page_note_scopes','INSERT,UPDATE,DELETE')`)).toBe("f")
    }
    expect(sql("select relrowsecurity from pg_class where oid='public.workspace_page_note_scopes'::regclass")).toBe("t")
    for(const trigger of ["workspace_page_note_scope_suppression_capture","workspace_page_note_scope_suppression_guard"]){
      await operator.query(`begin;alter table public.workspace_page_note_scopes disable trigger ${trigger};`)
      await denied("perform public.read_organization_suppression_events();",["42501"])
      await denied(`perform public.replay_organization_suppression_history(${literal(manifestText)},${literal(digest(manifestText))});`,["42501"])
      await operator.query("rollback;")
    }
    for(const [table,trigger] of [["organization_workspace_boards","workspace_page_note_source_removal"],["organization_workspace_pages","workspace_page_note_selection_removal"]]){
      await operator.query(`begin;alter table public.${table} disable trigger ${trigger};`)
      await denied("perform public.read_organization_suppression_events();",["42501"])
      await operator.query("rollback;")
    }
    await operator.query("begin;drop trigger workspace_page_note_scope_suppression_capture on public.workspace_page_note_scopes;create trigger workspace_page_note_scope_suppression_capture after update or delete on public.workspace_page_note_scopes for each row when(false) execute function public.capture_workspace_page_note_scope_suppression();")
    await denied("perform public.read_organization_suppression_events();",["42501"]);await operator.query("rollback;")
  })

  it("rejects malformed actor-bearing journal payloads and mismatched replay identity atomically",async()=>{
    for(const [index,patch] of [{actorId:id(2)},{grantId:id(999)},{generationId:"broken"},{createdAt:"infinity"}].entries()){
      const damaged=join(directory,`invalid-${index}.sqlite`)
      command("python3",["-c","import os,shutil,sqlite3,json,hashlib,sys;shutil.copyfile(sys.argv[1],sys.argv[2]);os.chmod(sys.argv[2],0o600);c=sqlite3.connect(sys.argv[2]);e=json.loads(c.execute('select payload from suppression_events where sequence=1').fetchone()[0]);e['pageNoteScope'].update(json.loads(sys.argv[3]));p=json.dumps(e,ensure_ascii=True,sort_keys=True,separators=(',',':'));c.execute('update suppression_events set payload=?,sha256=? where sequence=1',(p,hashlib.sha256(p.encode()).hexdigest()));c.commit()",journalPath,damaged,JSON.stringify(patch)])
      const result=spawnSync("python3",[collector,"--journal",damaged,"--expected-source-id",manifest.sourceId,"--expected-sha256",digest(manifestText),"--export",join(directory,`invalid-${index}.json`)],{env,encoding:"utf8"})
      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain(["Invalid page note scope suppression event","Page note scope suppression identity mismatch","Invalid opaque identifier","Invalid UTC timestamp"][index])
    }
    const before=await operator.query(state)
    for(const change of [
      (m:Manifest)=>{m.events[0].pageNoteScope.particleId=id(7101)},
      (m:Manifest)=>{m.events[0].pageNoteScope.generationId=id(999)},
      (m:Manifest)=>{m.events[0].revision=2},
      (m:Manifest)=>{m.events[0].organizationId=id(2)},
      (m:Manifest)=>{m.sourceId=id(999)},
    ]){
      const wrong=structuredClone(manifest);change(wrong);const text=JSON.stringify(wrong)
      await denied(`perform public.replay_organization_suppression_history(${literal(text)},${literal(digest(text))});`)
      expect(await operator.query(state)).toBe(before)
    }
  })

  it("rejects a backup that lacks the original scope-generation installation",async()=>{
    const before=await preInstallation.query(state)
    await denied(`perform public.replay_organization_suppression_history(${literal(manifestText)},${literal(digest(manifestText))});`,["40001"],preInstallation)
    expect(await preInstallation.query(state)).toBe(before)
  })

  it("retires exact restored note generations without withdrawing page access or modifying source data",async()=>{
    expect(JSON.parse(await operator.query(replay(manifestText)))).toMatchObject({applied:6,exact:0,highWater:6,quarantined:true,releaseQualified:false})
    await denied(noteRead().replace(/^select /,"perform "),["42501"])
    await denied(`perform public.workspace_page_note_command('${id(2)}','${id(7000)}',${json({action:"write",particleId:id(7100),operationId:id(7502),expectedNoteRevision:1,content:"Denied"})},repeat('c',64));`,["42501"])
    expect(JSON.parse(await operator.query(`select public.workspace_page_guest_command('${id(2)}','${id(7000)}','{"action":"read"}',null);`))).toMatchObject({permission:"edit"})
    const after=JSON.parse(await operator.query(state))
    expect(after.capture).toEqual(manifest);expect(after.contexts).toBe(0)
    expect(preserved(after)).toBe(beforePreserved)
    for(const page of [7000,7002,7003,7004,7005])expect(after.scopes.find((s:{page_id:string})=>s.page_id===id(page)).enabled).toBe(false)
    expect(after.scopes.find((s:{page_id:string})=>s.page_id===id(7001)).enabled).toBe(true)
    expect(after.scopes.some((s:{page_id:string})=>s.page_id===id(7006))).toBe(false)
  })

  it("preserves later explicit consent and absent source history while exact retries stay inert",async()=>{
    const newerBefore=JSON.parse(await newer.query(state))
    const prefix=JSON.stringify({...manifest,highWater:1,events:manifest.events.slice(0,1)})
    expect(JSON.parse(await newer.query(replay(prefix)))).toMatchObject({applied:1,exact:0})
    expect(JSON.parse(await newer.query(state)).scopes).toEqual(newerBefore.scopes)
    expect(JSON.parse(await newer.query(noteRead())).note.content).toBe("Shared source")
    const before=await current.query(state)
    expect(JSON.parse(await current.query(replay(manifestText)))).toMatchObject({applied:0,exact:6})
    expect(await current.query(state)).toBe(before)
    expect(JSON.parse(await current.query(noteRead())).note.content).toBe("Shared source")
    expect(await current.query(`select count(*) from public.organization_workspace_pages where id='${id(7005)}';`)).toBe("0")
    const old=manifest.events[0].pageNoteScope.grantId
    expect(await current.query(`select grant_id<>'${old}'::uuid from public.workspace_page_note_scopes where page_id='${id(7000)}';`)).toBe("t")
    const saved=await operator.query(state)
    expect(JSON.parse(await operator.query(replay(manifestText)))).toMatchObject({applied:0,exact:6})
    const shorter=JSON.stringify({...manifest,highWater:5,events:manifest.events.slice(0,5)})
    await denied(`perform public.replay_organization_suppression_history(${literal(shorter)},${literal(digest(shorter))});`)
    for(const patch of ["grant_id=gen_random_uuid()","granted_at=granted_at+interval '1 second'","org_id=public.fixture_form_id(2)","canvas_id=gen_random_uuid()"]){
      await denied(`update public.workspace_page_note_scopes set ${patch} where page_id=public.fixture_form_id(7000);`,["42501"])
    }
    expect(await operator.query(state)).toBe(saved)
  })

  it("refuses retired generation reuse and serializes concurrent live deletion against reuse",async()=>{
    const event=manifest.events.find(e=>e.pageNoteScope.pageId===id(7006))!
    const insert=(s:Event["pageNoteScope"])=>`insert into public.workspace_page_note_scopes(page_id,org_id,particle_id,canvas_id,source_created_at,enabled,granted_by,grant_id,granted_at) values('${s.pageId}','${id(1)}','${s.particleId}',${s.canvasId?literal(s.canvasId):"null"},'${s.sourceCreatedAt}',true,'${id(1)}','${s.grantId}','${s.createdAt}');`
    await denied(insert(event.pageNoteScope),["42501","40001"])
    const live=JSON.parse(sql(`select to_jsonb(s) from public.workspace_page_note_scopes s where page_id='${id(7001)}'`))
    const statement=insert({pageId:live.page_id,particleId:live.particle_id,canvasId:live.canvas_id,sourceCreatedAt:live.source_created_at,generationId:event.pageNoteScope.generationId,grantId:live.grant_id,createdAt:live.granted_at})
    const blocker=operatorSession(sourceUrl);operators.push(blocker)
    await blocker.query(`begin;delete from public.workspace_page_note_scopes where page_id='${id(7001)}';`)
    const attempt=()=>spawnSync("psql",["-X","-qAt","-v","ON_ERROR_STOP=1","-d",sourceUrl],{env,encoding:"utf8",input:"\\set VERBOSITY verbose\n"+statement})
    try{
      const contended=attempt();expect(contended.status).not.toBe(0);expect(contended.stderr).toContain("40001")
      await blocker.query("commit;")
    }finally{if(blocker.child.exitCode===null)await blocker.query("rollback;")}
    const retired=attempt();expect(retired.status).not.toBe(0);expect(retired.stderr).toContain("42501")
  })

  it("captures closure-driven note retirement and preserves withdrawal after cancellation and replay",async()=>{
    sql("select public.fixture_closure('request',7600,0);select public.fixture_closure('cancel',7601,1);")
    const mixed=await collect("closure-suppression")
    expect(mixed.manifest.events.slice(6).some(e=>e.kind==="workspace_page_note_scope_revoked")).toBe(true)
    expect(mixed.manifest.events.at(-1)?.kind).toBe("closure_cancel")
    const before=JSON.parse(await current.query(state))
    expect(JSON.parse(await current.query(replay(mixed.text)))).toMatchObject({applied:mixed.manifest.highWater-6,exact:6,releaseQualified:false})
    const after=JSON.parse(await current.query(state))
    expect(after.capture).toEqual(mixed.manifest);expect(after.contexts).toBe(0)
    expect(after.scopes.every((s:{enabled:boolean})=>!s.enabled)).toBe(true)
    expect(JSON.stringify([after.profiles,after.users,after.boards,after.files,after.objects,after.responses])).toBe(JSON.stringify([before.profiles,before.users,before.boards,before.files,before.objects,before.responses]))
    await denied(noteRead().replace(/^select /,"perform "),["42501"],current)
    expect(JSON.parse(await current.query(replay(mixed.text)))).toMatchObject({applied:0,exact:mixed.manifest.highWater})
  })
})
