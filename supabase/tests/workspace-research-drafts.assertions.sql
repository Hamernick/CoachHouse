begin;
insert into public.workspace_ai_runs(id,org_id,actor_id,request_hash,task,target,prompt,tariff,max_credits,max_provider_microdollars,status,proposal,charged_credits,provider_microdollars,settled_at)
 values('82000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001',repeat('f',64),'plan','{"kind":"particle_research"}','fixture','{}',10,100,'succeeded','{}',0,0,now());
set local role service_role;
do $$
declare r uuid:='82000000-0000-4000-8000-000000000001'; o uuid:='00000000-0000-0000-0000-000000000001';
 e uuid:='82000000-0000-4000-8000-000000000002'; d jsonb:='{"title":"Private"}'; got jsonb;
begin
 begin perform public.access_workspace_research_draft(r,o,null,repeat('a',64),null,null,null,false); raise exception 'null actor allowed'; exception when insufficient_privilege then null; end;
 got:=public.access_workspace_research_draft(r,o,o,repeat('a',64),null,null,null,false);
 perform public.assert_ai(got='{"revision":0,"draft":null,"attempted":false}','empty checkpoint');
 got:=public.access_workspace_research_draft(r,o,o,repeat('a',64),e,0,d,false);
 perform public.assert_ai(got->>'revision'='1' and got->'draft'=d,'saved checkpoint');
 perform public.assert_ai(public.access_workspace_research_draft(r,o,o,repeat('a',64),e,0,d,false)=got,'exact retry');
 begin perform public.access_workspace_research_draft(r,o,o,repeat('a',64),e,0,'{}',false); raise exception 'changed retry allowed'; exception when serialization_failure then null; end;
 begin perform public.access_workspace_research_draft(r,o,o,repeat('a',64),gen_random_uuid(),0,d,false); raise exception 'stale save allowed'; exception when serialization_failure then null; end;
 begin perform public.access_workspace_research_draft(r,o,o,repeat('b',64),null,null,null,false); raise exception 'changed base allowed'; exception when serialization_failure then null; end;
 begin perform public.access_workspace_research_draft(r,o,'00000000-0000-0000-0000-000000000002',repeat('a',64),null,null,null,false); raise exception 'other member allowed'; exception when insufficient_privilege then null; end;
 begin perform public.access_workspace_research_draft(r,'00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000004',repeat('a',64),null,null,null,false); raise exception 'foreign organization allowed'; exception when insufficient_privilege then null; end;
 begin perform public.access_workspace_research_draft(r,o,'00000000-0000-0000-0000-000000000003',repeat('a',64),null,null,null,false); raise exception 'viewer allowed'; exception when insufficient_privilege then null; end;
 got:=public.access_workspace_research_draft(r,o,o,repeat('a',64),gen_random_uuid(),1,d,true);
 perform public.assert_ai(got->>'attempted'='true','application payload pinned');
 begin perform public.access_workspace_research_draft(r,o,o,repeat('a',64),gen_random_uuid(),2,'{}',true); raise exception 'changed application allowed'; exception when serialization_failure then null; end;
 begin perform public.access_workspace_research_draft(r,o,o,repeat('a',64),gen_random_uuid(),2,d,false); raise exception 'unfreeze allowed'; exception when serialization_failure then null; end;
 got:=public.access_workspace_research_draft(r,o,o,repeat('a',64),gen_random_uuid(),2,null,false);
 perform public.assert_ai(got='{"revision":3,"draft":null,"attempted":false}','discard tombstone');
 begin perform public.access_workspace_research_draft(r,o,o,repeat('a',64),e,0,d,false); raise exception 'late save resurrected discard'; exception when serialization_failure then null; end;
 begin perform public.access_workspace_research_draft(r,o,o,repeat('a',64),gen_random_uuid(),3,jsonb_build_object('text',repeat('x',65537)),false); raise exception 'oversize allowed'; exception when check_violation then null; end;
 begin perform * from public.workspace_research_drafts; raise exception 'direct service table access allowed'; exception when insufficient_privilege then null; end;
end $$;
set local role authenticated;
do $$ begin
 begin perform public.access_workspace_research_draft(gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),repeat('a',64),null,null,null,false); raise exception 'browser rpc allowed'; exception when insufficient_privilege then null; end;
 begin perform * from public.workspace_research_drafts; raise exception 'browser table allowed'; exception when insufficient_privilege then null; end;
end $$;
set local role anon;
do $$ begin
 begin perform public.access_workspace_research_draft(gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),repeat('a',64),null,null,null,false); raise exception 'anon rpc allowed'; exception when insufficient_privilege then null; end;
 begin perform * from public.workspace_research_drafts; raise exception 'anon table allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select public.assert_ai((select relrowsecurity from pg_class where oid='public.workspace_research_drafts'::regclass),'RLS enabled');
-- Membership is checked again for every operation, including a replay.
update public.workspace_ai_runs set actor_id='00000000-0000-0000-0000-000000000002' where id='82000000-0000-4000-8000-000000000001';
delete from public.organization_memberships where org_id='00000000-0000-0000-0000-000000000001' and member_id='00000000-0000-0000-0000-000000000002';
set local role service_role;
do $$ begin
 begin perform public.access_workspace_research_draft('82000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002',repeat('a',64),null,null,null,false); raise exception 'revoked member allowed'; exception when insufficient_privilege then null; end;
end $$;
rollback;
