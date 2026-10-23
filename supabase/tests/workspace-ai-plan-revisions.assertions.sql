reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
create function public.fixture_ai_plan_revision(n integer) returns uuid language plpgsql as $$
declare rid uuid; baseline jsonb; draft jsonb; org uuid := '00000000-0000-0000-0000-000000000001';
begin
  rid := public.fixture_ai_plan(n);
  baseline := public.read_workspace_ai_plan_baseline(org,'62000000-0000-4000-8000-000000000002');
  draft := jsonb_set(baseline,'{title}','"Revised event"');
  draft := jsonb_set(draft,'{steps,0,title}','"Invite participants"');
  draft := jsonb_set(draft,'{steps}',(draft->'steps') || jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'title','Prepare materials','status','todo','expectedUpdatedAt',null)));
  update public.workspace_ai_runs set target=target || jsonb_build_object('plan',jsonb_build_object('id',baseline->>'id','revision',baseline->'revision'),'planBaseline',baseline),
    proposal=jsonb_set(proposal::jsonb,'{draft}',draft)::text where id=rid;
  return rid;
end $$;
select public.fixture_ai_plan_revision(20);
set role authenticated;
select public.apply_workspace_ai_plan('00000000-0000-0000-0000-000000000001','62000000-0000-4000-8000-000000000020');
select public.apply_workspace_ai_plan('00000000-0000-0000-0000-000000000001','62000000-0000-4000-8000-000000000020');
reset role;
select public.assert_ai((select revision=2 from public.workspace_objective_plans where id='62000000-0000-4000-8000-000000000002'),'revision applies once to same plan');
select public.assert_ai((select status='done' and title='Invite participants' from public.organization_workspace_objective_steps where id='63000000-0000-4000-8000-000000000002'),'revision preserves canonical completed step');
select public.assert_ai((select count(*)=2 from public.workspace_objective_plan_steps where plan_id='62000000-0000-4000-8000-000000000002'),'revision adds one step');
set role authenticated;
select public.undo_workspace_ai_plan('00000000-0000-0000-0000-000000000001','62000000-0000-4000-8000-000000000020');
select public.undo_workspace_ai_plan('00000000-0000-0000-0000-000000000001','62000000-0000-4000-8000-000000000020');
reset role;
select public.assert_ai((select revision=3 and title='Community event' from public.workspace_objective_plans where id='62000000-0000-4000-8000-000000000002'),'undo restores previous plan without decrementing revision');
select public.assert_ai((select status='done' and title='Confirm participants' from public.organization_workspace_objective_steps where id='63000000-0000-4000-8000-000000000002'),'undo restores title and retains completion');
select public.assert_ai((select count(*)=1 from public.workspace_objective_plan_steps where plan_id='62000000-0000-4000-8000-000000000002'),'undo restores membership');
select public.assert_ai((select count(*)=1 from public.organization_workspace_objective_steps),'undo removes only untouched newly added steps');
select public.fixture_ai_plan_revision(21);
update public.organization_workspace_objective_steps set title='Collaborator title' where id='63000000-0000-4000-8000-000000000002';
set role authenticated;
do $$ begin
  begin perform public.apply_workspace_ai_plan('00000000-0000-0000-0000-000000000001','62000000-0000-4000-8000-000000000021'); raise exception 'stale step applied'; exception when serialization_failure then null; end;
end $$;
reset role;
select public.fixture_ai_plan_revision(22);
update public.workspace_ai_runs set proposal=jsonb_set(proposal::jsonb,'{draft,steps,0,status}','"todo"')::text where id='62000000-0000-4000-8000-000000000022';
set role authenticated;
do $$ begin
  begin perform public.apply_workspace_ai_plan('00000000-0000-0000-0000-000000000001','62000000-0000-4000-8000-000000000022'); raise exception 'AI changed completion'; exception when raise_exception then if sqlerrm<>'AI cannot change progress' then raise; end if; end;
end $$;
reset role;
select public.assert_ai((select revision=3 from public.workspace_objective_plans where id='62000000-0000-4000-8000-000000000002'),'failed revision rolls back plan');
select public.assert_ai(not exists(select 1 from public.workspace_ai_plan_applications where run_id in('62000000-0000-4000-8000-000000000021','62000000-0000-4000-8000-000000000022')),'failed revision creates no receipt');
select public.fixture_ai_plan_revision(23);
update public.workspace_ai_runs set proposal=jsonb_set(proposal::jsonb,'{draft,edges}',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'source','63000000-0000-4000-8000-000000000002','target','63000000-0000-4000-8000-000000000002','label','Loop')))::text where id='62000000-0000-4000-8000-000000000023';
set role authenticated;
do $$ begin
  begin perform public.apply_workspace_ai_plan('00000000-0000-0000-0000-000000000001','62000000-0000-4000-8000-000000000023'); raise exception 'cyclic revision applied'; exception when check_violation then null; end;
end $$;
reset role;
select public.assert_ai((select title='Collaborator title' from public.organization_workspace_objective_steps where id='63000000-0000-4000-8000-000000000002'),'invalid graph rolls back step rename');
select public.fixture_ai_plan_revision(24);
set role authenticated;
select public.apply_workspace_ai_plan('00000000-0000-0000-0000-000000000001','62000000-0000-4000-8000-000000000024');
reset role;
update public.organization_workspace_objective_steps set title='Newer collaborator title' where id='63000000-0000-4000-8000-000000000002';
set role authenticated;
do $$ begin
  begin perform public.undo_workspace_ai_plan('00000000-0000-0000-0000-000000000001','62000000-0000-4000-8000-000000000024'); raise exception 'undo lost newer work'; exception when serialization_failure then null; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false);
do $$ begin
  begin perform public.read_workspace_ai_plan_baseline('00000000-0000-0000-0000-000000000001','62000000-0000-4000-8000-000000000002'); raise exception 'read-only actor accessed AI baseline'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select public.assert_ai((select sum(charged_credits)=10 from public.workspace_ai_runs where id in('62000000-0000-4000-8000-000000000020','62000000-0000-4000-8000-000000000021','62000000-0000-4000-8000-000000000022','62000000-0000-4000-8000-000000000023','62000000-0000-4000-8000-000000000024')),'revision apply and undo never charge again');

select public.fixture_ai_plan_revision(25);
select public.fixture_ai_plan_revision(26);
