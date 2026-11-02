begin;
-- Real table/ACL/function proof, isolated from the rest of the ledger suite.
insert into public.workspace_ai_runs(id,org_id,actor_id,request_hash,task,target,prompt,tariff,max_credits,max_provider_microdollars,created_at)
select ('81000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
  '00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001',repeat('a',64),'plan',
  jsonb_build_object('kind','particle_research','organizationId','00000000-0000-0000-0000-000000000001',
    'userId','00000000-0000-0000-0000-000000000001','objectiveId','81000000-0000-4000-8000-000000000100','canvasId',null),
  'private request','{}',1,1,'2026-10-30T10:00:00Z'::timestamptz + i*interval '1 second'
from generate_series(1,20) i;

do $$ declare history jsonb; scope uuid:='00000000-0000-0000-0000-000000000001'; objective uuid:='81000000-0000-4000-8000-000000000100'; begin
  history:=public.list_workspace_research_runs(scope,scope,objective,null,null);
  perform public.assert_ai(jsonb_array_length(history)=12 and history->0->>'id'='81000000-0000-4000-8000-000000000020','bounded newest history');
  perform public.assert_ai(not exists(select 1 from jsonb_array_elements(history) r,jsonb_object_keys(r) k where k not in ('id','status','created_at')),'no prompt proposal target usage or provider data');
  perform public.assert_ai(public.list_workspace_research_runs(scope,scope,gen_random_uuid(),null,null)='[]','other objective excluded');
  perform public.assert_ai(public.list_workspace_research_runs(scope,scope,objective,'other-canvas',null)='[]','other canvas excluded');
  perform public.assert_ai(public.list_workspace_research_runs(scope,scope,objective,null,gen_random_uuid())='[]','other plan excluded');
  perform public.assert_ai(public.list_workspace_research_runs(scope,'00000000-0000-0000-0000-000000000002',objective,null,null)='[]','another member cannot discover owner runs');
  begin perform public.list_workspace_research_runs(scope,'00000000-0000-0000-0000-000000000004',objective,null,null); raise exception 'cross-org history'; exception when insufficient_privilege then null; end;
  begin perform public.list_workspace_research_runs(scope,'00000000-0000-0000-0000-000000000003',objective,null,null); raise exception 'viewer history'; exception when insufficient_privilege then null; end;
end $$;

-- Distinct missing canvas/legacy identity and plan scopes must not fall through.
update public.workspace_ai_runs set target=target-'canvasId' where id='81000000-0000-4000-8000-000000000020';
update public.workspace_ai_runs set target=target||'{"plan":{"id":"81000000-0000-4000-8000-000000000101","revision":0}}' where id='81000000-0000-4000-8000-000000000019';
update public.workspace_ai_runs set target=target-'userId' where id='81000000-0000-4000-8000-000000000018';
update public.workspace_ai_runs set target=target||'{"kind":"other"}' where id='81000000-0000-4000-8000-000000000017';
do $$ declare history jsonb; scope uuid:='00000000-0000-0000-0000-000000000001'; objective uuid:='81000000-0000-4000-8000-000000000100'; begin
  history:=public.list_workspace_research_runs(scope,scope,objective,null,null);
  perform public.assert_ai(history->0->>'id'='81000000-0000-4000-8000-000000000016','legacy and different kinds excluded');
  history:=public.list_workspace_research_runs(scope,scope,objective,null,'81000000-0000-4000-8000-000000000101');
  perform public.assert_ai(jsonb_array_length(history)=1 and history->0->>'id'='81000000-0000-4000-8000-000000000019','exact selected plan');
end $$;
set local role authenticated;
do $$ begin
  begin perform public.list_workspace_research_runs(gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),null,null); raise exception 'actor impersonation'; exception when insufficient_privilege then null; end;
end $$;
set local role anon;
do $$ begin
  begin perform public.list_workspace_research_runs(gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),null,null); raise exception 'anonymous history'; exception when insufficient_privilege then null; end;
end $$;
reset role;
delete from public.organization_memberships where org_id='00000000-0000-0000-0000-000000000001' and member_id='00000000-0000-0000-0000-000000000002';
set local role service_role;
do $$ begin
  begin perform public.list_workspace_research_runs('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002',gen_random_uuid(),null,null); raise exception 'revoked member history'; exception when insufficient_privilege then null; end;
end $$;
rollback;
