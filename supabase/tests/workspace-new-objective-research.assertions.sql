begin;
update public.ai_credit_policy set daily_provider_microdollars=10000000;
insert into public.ai_credit_wallets(org_id,enabled) values('00000000-0000-0000-0000-000000000004',true);
insert into public.ai_credit_lots(org_id,operation_key,kind,credits) values('00000000-0000-0000-0000-000000000004','new-objective-fixture','adjustment',100);
-- No board row yet: the default canvas is empty and has revision zero.
do $$ declare
  org uuid := '00000000-0000-0000-0000-000000000004';
  id uuid := '82000000-0000-4000-8000-000000000001';
  scope jsonb := '{"mode":"new_objective","kind":"particle_research","userId":"00000000-0000-0000-0000-000000000004","organizationId":"00000000-0000-0000-0000-000000000004","revision":0,"canvasId":null}';
  result jsonb;
begin
  result:=public.reserve_workspace_ai_research_run(id,org,org,repeat('a',64),scope,'Open a garden','{}',10,50000);
  perform public.assert_ai((result->>'created')::boolean and result->'run'->>'task'='plan','new objective uses plan ledger');
  perform public.assert_ai(not exists(select 1 from public.organization_workspace_boards where org_id=org),'reservation never creates a board or objective');
  result:=public.reserve_workspace_ai_research_run(id,org,org,repeat('a',64),scope,'Open a garden','{}',10,50000);
  perform public.assert_ai(not (result->>'created')::boolean,'new objective replay reserves once');
  perform public.assert_ai(jsonb_array_length(public.list_workspace_research_runs(org,org,null,null,null))=1,'new objective history without objective ID');
  perform public.assert_ai(public.list_workspace_research_runs(org,org,gen_random_uuid(),null,null)='[]','new objective cannot enter saved objective history');
  perform public.assert_ai(public.list_workspace_research_runs(org,org,null,'another-canvas',null)='[]','new objective canvas isolation');
  perform public.assert_ai(public.list_workspace_research_runs(org,org,null,null,gen_random_uuid())='[]','no plan on unsaved objective history');
  begin perform public.reserve_workspace_ai_research_run(gen_random_uuid(),org,org,repeat('b',64),scope||'{"revision":1}','New plan','{}',10,50000); raise exception 'Stale board admitted'; exception when serialization_failure then null; end;
  begin perform public.reserve_workspace_ai_research_run(gen_random_uuid(),org,org,repeat('b',64),scope||'{"objectiveId":"82000000-0000-4000-8000-000000000002"}','New plan','{}',10,50000); raise exception 'Placeholder admitted'; exception when raise_exception then if sqlerrm<>'Invalid new objective target' then raise; end if; end;
  begin perform public.reserve_workspace_ai_research_run(gen_random_uuid(),org,org,repeat('b',64),scope-'canvasId','New plan','{}',10,50000); raise exception 'Unscoped canvas admitted'; exception when raise_exception then if sqlerrm<>'Invalid new objective target' then raise; end if; end;
  begin perform public.reserve_workspace_ai_research_run(gen_random_uuid(),org,org,repeat('b',64),scope||'{"canvasId":"82000000-0000-4000-8000-000000000003"}','New plan','{}',10,50000); raise exception 'Missing canvas admitted'; exception when raise_exception then if sqlerrm<>'Workspace not found' then raise; end if; end;
  perform public.claim_workspace_ai_run(id,org);
  perform public.record_workspace_ai_result(id,'canceled',0,0,null,'{}',null);
  perform public.settle_recorded_workspace_ai_run(id);
  insert into public.organization_workspace_boards(org_id,state) values(org,'{"workspaceCatalog":{"defaultDeleted":true,"entries":[{"id":"82000000-0000-4000-8000-000000000003","state":{"particleGraph":{"revision":2,"particles":[]}}}]}}');
  begin perform public.reserve_workspace_ai_research_run(gen_random_uuid(),org,org,repeat('b',64),scope,'New plan','{}',10,50000); raise exception 'Deleted canvas admitted'; exception when raise_exception then if sqlerrm<>'Workspace not found' then raise; end if; end;
  scope:=scope||'{"canvasId":"82000000-0000-4000-8000-000000000003","revision":2}';
  result:=public.reserve_workspace_ai_research_run('82000000-0000-4000-8000-000000000004',org,org,repeat('c',64),scope,'Named workspace plan','{}',10,50000);
  perform public.assert_ai((result->>'created')::boolean,'named canvas current revision admitted');
  perform public.assert_ai(jsonb_array_length(public.list_workspace_research_runs(org,org,null,'82000000-0000-4000-8000-000000000003',null))=1,'named canvas discovery');
  perform public.assert_ai((select state->'workspaceCatalog'->'entries'->0->'state'->'particleGraph'->'particles'='[]' from public.organization_workspace_boards where org_id=org),'named admission writes no particles');
end $$;
set local role authenticated;
do $$ begin
  begin perform public.reserve_workspace_ai_research_run(gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),repeat('a',64),'{"mode":"new_objective"}','research','{}',1,1); raise exception 'Direct reservation'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
