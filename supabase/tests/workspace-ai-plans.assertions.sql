reset role;
insert into public.organization_workspace_objectives(id,org_id,title,created_by) values
 ('61000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000001','Plan a community event','00000000-0000-0000-0000-000000000001');
-- Give this isolated test its own allowance after the existing ledger scenarios.
update public.ai_credit_policy set enabled=true,user_daily_credits=10000,user_hourly_runs=1000,daily_provider_microdollars=100000000;
insert into public.ai_credit_lots(org_id,operation_key,kind,credits) values('00000000-0000-0000-0000-000000000001','plan-fixture','purchased',1000);
create function public.fixture_ai_plan(n integer) returns uuid language plpgsql as $$
declare rid uuid := ('62000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid; sid uuid := ('63000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid;
  oid uuid := '61000000-0000-4000-8000-000000000001'; org uuid := '00000000-0000-0000-0000-000000000001'; target jsonb; proposal jsonb;
begin
  select jsonb_build_object('kind','plan','userId',org,'organizationId',org,'objectiveId',oid,'revision',updated_at,'title',title,'description',description) into target from public.organization_workspace_objectives where id=oid;
  perform public.reserve_workspace_ai_plan_run(rid,org,org,repeat('a',64),target,'Plan this event','{}',10,20000);
  perform public.assert_ai(not (public.reserve_workspace_ai_plan_run(rid,org,org,repeat('a',64),target,'Plan this event','{}',10,20000)->>'created')::boolean,'reservation replay');
  perform public.assert_ai(public.claim_workspace_ai_run(rid,org),'claim plan once');
  proposal := jsonb_build_object('summary','A private proposal','questions','[]'::jsonb,'assumptions','[]'::jsonb,'draft',jsonb_build_object('id',rid,'objectiveId',oid,'revision',0,'title','Community event',
    'steps',jsonb_build_array(jsonb_build_object('id',sid,'title','Confirm participants','status','todo','expectedUpdatedAt',null)),'edges','[]'::jsonb,'decisions','[]'::jsonb));
  perform public.settle_workspace_ai_run(rid,'succeeded',4000,2,proposal::text,'{}','fixture-plan');
  return rid;
end $$;
select public.fixture_ai_plan(1);
select public.fixture_ai_plan(2);
select public.fixture_ai_plan(3);
select public.fixture_ai_plan(4);
select public.assert_ai((select count(*)=0 from public.workspace_objective_plans),'generation creates no canonical plan');
select public.assert_ai((select task='plan' and charged_credits=2 from public.workspace_ai_runs where id='62000000-0000-4000-8000-000000000001'),'plan uses measured shared accounting');
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false);
do $$ begin
  begin perform public.apply_workspace_ai_plan('00000000-0000-0000-0000-000000000001','62000000-0000-4000-8000-000000000001'); raise exception 'board applied'; exception when insufficient_privilege then null; end;
  begin perform * from public.workspace_ai_plan_applications; raise exception 'private receipt leaked'; exception when insufficient_privilege then null; end;
  begin perform public.reserve_workspace_ai_plan_run(gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),repeat('a',64),'{}','fake','{}',1,1); raise exception 'session spent'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
do $$ begin
  begin perform public.apply_workspace_ai_plan('00000000-0000-0000-0000-000000000001','62000000-0000-4000-8000-000000000001'); raise exception 'another staff applied private proposal'; exception when raise_exception then if sqlerrm<>'AI plan unavailable' then raise; end if; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select public.apply_workspace_ai_plan('00000000-0000-0000-0000-000000000001','62000000-0000-4000-8000-000000000001');
select public.apply_workspace_ai_plan('00000000-0000-0000-0000-000000000001','62000000-0000-4000-8000-000000000001');
reset role;
select public.assert_ai((select count(*)=1 from public.workspace_objective_plans),'replayed apply creates once');
select public.assert_ai((select count(*)=1 from public.organization_workspace_objective_steps),'canonical steps created once');
set role authenticated;
select public.undo_workspace_ai_plan('00000000-0000-0000-0000-000000000001','62000000-0000-4000-8000-000000000001');
select public.undo_workspace_ai_plan('00000000-0000-0000-0000-000000000001','62000000-0000-4000-8000-000000000001');
select public.apply_workspace_ai_plan('00000000-0000-0000-0000-000000000001','62000000-0000-4000-8000-000000000001');
reset role;
select public.assert_ai((select count(*)=0 from public.workspace_objective_plans),'undone receipt prevents resurrection');
select public.assert_ai((select count(*)=0 from public.organization_workspace_objective_steps),'undo removes only untouched generated steps');
set role authenticated;
select public.apply_workspace_ai_plan('00000000-0000-0000-0000-000000000001','62000000-0000-4000-8000-000000000002');
reset role;
update public.organization_workspace_objective_steps set status='done' where id='63000000-0000-4000-8000-000000000002';
set role authenticated;
do $$ begin
  begin perform public.undo_workspace_ai_plan('00000000-0000-0000-0000-000000000001','62000000-0000-4000-8000-000000000002'); raise exception 'undo lost newer work'; exception when serialization_failure then null; end;
end $$;
reset role;
-- Stale objective cannot receive a plan generated against older context.
update public.organization_workspace_objectives set title='Changed by collaborator' where id='61000000-0000-4000-8000-000000000001';
set role authenticated;
do $$ begin
  begin perform public.apply_workspace_ai_plan('00000000-0000-0000-0000-000000000001','62000000-0000-4000-8000-000000000003'); raise exception 'stale proposal applied'; exception when serialization_failure then null; end;
end $$;
reset role;
select public.assert_ai((select count(*)=2 from public.workspace_ai_plan_applications),'failed application leaves no receipt');
select public.assert_ai((select count(*)=1 from public.workspace_objective_plans),'failed application leaves no plan');
select public.assert_ai((select sum(charged_credits)=8 from public.workspace_ai_runs where task='plan'),'apply/replay/undo do not change credits');
-- Actual graph validation is still the canonical writer: invalid cyclic proposal rolls back.
select public.fixture_ai_plan(5);
update public.workspace_ai_runs set proposal=jsonb_set(proposal::jsonb,'{draft,edges}',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'source','63000000-0000-4000-8000-000000000005','target','63000000-0000-4000-8000-000000000005','label','Loop')))::text where id='62000000-0000-4000-8000-000000000005';
set role authenticated;
do $$ begin
  begin perform public.apply_workspace_ai_plan('00000000-0000-0000-0000-000000000001','62000000-0000-4000-8000-000000000005'); raise exception 'invalid graph applied'; exception when check_violation then null; end;
end $$;
reset role;
select public.assert_ai((select count(*)=1 from public.organization_workspace_objective_steps),'failed graph leaves no steps');

select public.fixture_ai_plan(6);
