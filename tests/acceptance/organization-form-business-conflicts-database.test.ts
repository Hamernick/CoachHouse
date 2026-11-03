import { spawnSync } from "node:child_process"
import { mkdtempSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { beforeAll, describe, expect, it } from "vitest"

const template = process.env.FORM_BUSINESS_CONFLICT_TEST_DATABASE_URL
const env = { ...process.env, PGOPTIONS: "-c statement_timeout=10000 -c coach_house.workspace_sharing_fixture=isolated-test-only" }
let url: string
function command(program: string, args: string[], input?: string) {
 const result=spawnSync(program,args,{env,input,encoding:"utf8",maxBuffer:32*1024*1024})
 expect(result.status,result.stderr).toBe(0);return result.stdout.trim()
}
const sql=(text:string)=>command("psql",["-XqAt","-v","ON_ERROR_STOP=1","-d",url],text)
const setup="set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001';select public.fixture_closure_private_reads();"

describe.skipIf(!template).sequential("form business revision conflicts through PostgREST",()=>{
 beforeAll(()=>{
  const source=new URL(template!)
  if(!["localhost","127.0.0.1","[::1]"].includes(source.hostname)||!/^\/workspace_sharing_fixture_[a-z0-9_]+$/.test(source.pathname)||source.password)throw new Error("Explicit disposable local fixture required")
  const directory=mkdtempSync(join(tmpdir(),"ch-form-business-conflicts-")),dump=join(directory,"source.sql")
  command("pg_dump",["--format=plain","--file",dump,"--dbname",template!])
  const name=`workspace_sharing_fixture_formconflict_${process.pid}_${Date.now()}`
  command("createdb",["--maintenance-db",template!,name]);source.pathname="/"+name;url=source.toString();sql(readFileSync(dump,"utf8"))
  const acl="select proname||':'||proowner::text||':'||proacl::text from pg_proc where oid in ('public.organization_form_source_command_before_closure(uuid,jsonb)'::regprocedure,'public.organization_form_intake_before_closure(uuid,jsonb)'::regprocedure) order by proname"
  const before=sql(acl)
  sql(readFileSync("supabase/migrations/20261103240000_organization_form_business_conflicts.sql","utf8"))
  expect(sql(acl)).toBe(before)
 },30_000)
 it("returns PT409 for a stale source without changing the board or creating a receipt",()=>{
  sql(`begin;${setup}do $$ declare content jsonb; before_state jsonb; receipts bigint; begin
   select state into before_state from public.organization_workspace_boards where org_id=public.fixture_form_id(1);
   select count(*) into receipts from public.organization_form_source_operations;
   select s.content into content from public.workspace_form_sources(before_state) s where s.id=public.fixture_form_id(20);
   begin
    perform public.organization_form_source_command(public.fixture_form_id(1),jsonb_build_object('action','save_form_source','versionId',public.fixture_form_id(80),'operationId',public.fixture_form_id(710),'expectedRevision',repeat('a',64),'content',jsonb_build_object('title','Rejected stale source','description','','definition',content#>'{widget,definition}')));
    raise exception 'Unexpected success';
   exception when sqlstate 'PT409' then null; end;
   if before_state is distinct from(select state from public.organization_workspace_boards where org_id=public.fixture_form_id(1))
    or receipts<>(select count(*) from public.organization_form_source_operations) then raise exception 'Stale source mutated canonical state'; end if;
  end $$;rollback;`)
 })
 it("returns PT409 for a stale correction and preserves accepted answers, revision and receipts",()=>{
  sql(`begin;${setup}select public.fixture_form_command('submit');select public.fixture_form_command('correct',1);
   do $$ declare before_row jsonb; receipts bigint; begin
    select to_jsonb(r) into before_row from public.organization_form_responses r where id=public.fixture_form_id(91);
    if before_row->>'revision'<>'2' then raise exception 'Expected accepted correction';end if;
    select count(*) into receipts from public.organization_form_corrections;
    begin perform public.fixture_form_command('correct',1,jsonb_build_object('operationId',public.fixture_form_id(93)));
     raise exception 'Unexpected success';exception when sqlstate 'PT409' then null;end;
    if before_row is distinct from(select to_jsonb(r) from public.organization_form_responses r where id=public.fixture_form_id(91))
     or receipts<>(select count(*) from public.organization_form_corrections) then raise exception 'Stale correction mutated canonical state';end if;
   end $$;rollback;`)
 })
 it("keeps private implementations inaccessible to all API roles",()=>{
  for(const role of ["anon","authenticated","service_role"])
   for(const fn of ["organization_form_source_command_before_closure(uuid,jsonb)","organization_form_intake_before_closure(uuid,jsonb)"])
    expect(sql(`select has_function_privilege('${role}','public.${fn}','execute')`)).toBe("f")
 })
})
