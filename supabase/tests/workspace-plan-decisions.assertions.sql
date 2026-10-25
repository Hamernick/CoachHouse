-- Exercise real RPCs against the disposable database; no shared environment.
-- Mirror Supabase default read grants; table RLS still scopes the actor.
grant select on public.organization_workspace_objective_steps to authenticated;
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
do $$ declare
  org uuid := '00000000-0000-0000-0000-000000000001';
  pid uuid := '20000000-0000-4000-8000-000000000003';
  root uuid := '30000000-0000-4000-8000-000000000010';
  a uuid := '30000000-0000-4000-8000-000000000011';
  b uuid := '30000000-0000-4000-8000-000000000012';
  ea uuid := '40000000-0000-4000-8000-000000000010';
  eb uuid := '40000000-0000-4000-8000-000000000011';
  draft jsonb; invalid jsonb; saved jsonb;
begin
  draft := jsonb_build_object('id',pid,'objectiveId','10000000-0000-4000-8000-000000000001','title','Venue decision','revision',0,
    'steps',jsonb_build_array(jsonb_build_object('id',root,'title','Venue available?','status','todo','expectedUpdatedAt',null),
      jsonb_build_object('id',a,'title','Host in person','status','todo','expectedUpdatedAt',null),
      jsonb_build_object('id',b,'title','Host online','status','todo','expectedUpdatedAt',null)),
    'edges',jsonb_build_array(jsonb_build_object('id',ea,'source',root,'target',a,'label','Yes'),jsonb_build_object('id',eb,'source',root,'target',b,'label','No')),
    'decisions',jsonb_build_array(jsonb_build_object('stepId',root,'selectedEdgeId',null)));
  perform public.save_workspace_objective_plan_v2(org,draft);
  select item into saved from jsonb_array_elements(public.read_workspace_objective_plans_v2(org)) item where item->>'id'=pid::text;
  perform public.assert_plan(saved->'decisions'=draft->'decisions','unresolved decision survives read');
  draft := jsonb_set(jsonb_set(draft,'{revision}','1'),'{steps}',(select jsonb_agg(jsonb_build_object('id',id,'title',title,'status',status,'expectedUpdatedAt',updated_at) order by step_order) from public.organization_workspace_objective_steps where id in(root,a,b)));
  draft := jsonb_set(draft,'{decisions,0,selectedEdgeId}',to_jsonb(ea));
  perform public.save_workspace_objective_plan_v2(org,draft);
  begin perform public.save_workspace_objective_plan_v2(org,draft); raise exception 'stale choice accepted'; exception when serialization_failure then null; end;
  draft := jsonb_set(draft,'{revision}','2');
  invalid := jsonb_set(draft,'{decisions,0,selectedEdgeId}','"40000000-0000-4000-8000-000000000001"');
  begin perform public.save_workspace_objective_plan_v2(org,invalid); raise exception 'foreign choice accepted'; exception when raise_exception then if sqlerrm <> 'Invalid decision choice' then raise; end if; end;
  invalid := jsonb_set(draft,'{edges,1,label}','" yes "');
  begin perform public.save_workspace_objective_plan_v2(org,invalid); raise exception 'duplicate label accepted'; exception when raise_exception then if sqlerrm <> 'Decisions need at least two uniquely named outcomes' then raise; end if; end;
  -- Old clients cannot silently erase choices or leave dangling outcomes.
  perform public.save_workspace_objective_plan(org,draft-'decisions');
  select item into saved from jsonb_array_elements(public.read_workspace_objective_plans_v2(org)) item where item->>'id'=pid::text;
  perform public.assert_plan(saved->'decisions'=draft->'decisions' and saved->>'revision'='3','old client preserves choices and failed writes roll back');
  invalid := jsonb_set(draft-'decisions','{revision}','3') || jsonb_build_object('edges',jsonb_build_array(draft->'edges'->1));
  begin perform public.save_workspace_objective_plan(org,invalid); raise exception 'old client removed outcome'; exception when raise_exception then if sqlerrm <> 'Decisions need at least two uniquely named outcomes' then raise; end if; end;
  begin perform public.save_workspace_objective_plan_base(org,draft); raise exception 'private base exposed'; exception when insufficient_privilege then null; end;
  perform public.save_workspace_objective_plan_v2(org,jsonb_set(jsonb_set(draft,'{revision}','3'),'{decisions,0,selectedEdgeId}','null'));
  select item into saved from jsonb_array_elements(public.read_workspace_objective_plans_v2(org)) item where item->>'id'=pid::text;
  perform public.assert_plan(saved->'decisions'->0->'selectedEdgeId'='null','choice can return to unknown');
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false);
do $$ begin
  begin perform public.save_workspace_objective_plan_v2('00000000-0000-0000-0000-000000000001',(select value from public.plan_fixture)); raise exception 'board choice write'; exception when insufficient_privilege then null; end;
  begin perform public.read_workspace_objective_plans_v2('00000000-0000-0000-0000-000000000004'); raise exception 'crossorg decision read'; exception when insufficient_privilege then null; end;
end $$;
reset role;
