create function public.assert_plan(ok boolean,message text) returns void language plpgsql as $$ begin if ok is distinct from true then raise exception 'Assertion: %',message; end if; end $$;
insert into public.organization_workspace_objectives(id,org_id,title,created_by) values
 ('10000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000001','Launch volunteers','00000000-0000-0000-0000-000000000001'),
 ('10000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000001','Community event','00000000-0000-0000-0000-000000000001');
create table public.plan_fixture(value jsonb);
insert into public.plan_fixture values ('{"id":"20000000-0000-4000-8000-000000000001","objectiveId":"10000000-0000-4000-8000-000000000001","revision":0,"title":"Recruitment","steps":[{"id":"30000000-0000-4000-8000-000000000001","title":"Define roles","status":"todo","expectedUpdatedAt":null},{"id":"30000000-0000-4000-8000-000000000002","title":"Recruit","status":"todo","expectedUpdatedAt":null}],"edges":[{"id":"40000000-0000-4000-8000-000000000001","source":"30000000-0000-4000-8000-000000000001","target":"30000000-0000-4000-8000-000000000002","label":"Roles approved"}]}');
grant select,update on public.plan_fixture to authenticated;
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false);
do $$ begin
  begin perform public.save_workspace_objective_plan('00000000-0000-0000-0000-000000000001',(select value from public.plan_fixture)); raise exception 'board wrote plan'; exception when insufficient_privilege then null; end;
  perform public.assert_plan(public.read_workspace_objective_plans('00000000-0000-0000-0000-000000000001')='[]','board can read');
  begin perform public.read_workspace_objective_plans('00000000-0000-0000-0000-000000000004'); raise exception 'cross-org read'; exception when insufficient_privilege then null; end;
  begin perform count(*) from public.workspace_objective_plans; raise exception 'direct access'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
select public.save_workspace_objective_plan('00000000-0000-0000-0000-000000000001',(select value from public.plan_fixture));
select public.assert_plan(jsonb_array_length(public.read_workspace_objective_plans('00000000-0000-0000-0000-000000000001'))=1,'staff save and read');
do $$ begin
  begin perform public.save_workspace_objective_plan('00000000-0000-0000-0000-000000000001',(select value from public.plan_fixture)); raise exception 'stale save accepted'; exception when serialization_failure then null; end;
end $$;
reset role;
select public.assert_plan((select count(*)=2 from public.organization_workspace_objective_steps),'canonical steps created once');
update public.plan_fixture set value=jsonb_set(jsonb_set(value,'{revision}','1'),'{steps}',(
  select jsonb_agg(jsonb_build_object('id',id,'title',title,'status',status,'expectedUpdatedAt',updated_at) order by step_order)
  from public.organization_workspace_objective_steps
));
-- Another plan reuses the same canonical step, without duplicating its content/status.
set role authenticated;
select public.save_workspace_objective_plan('00000000-0000-0000-0000-000000000001',
  (select value || '{"id":"20000000-0000-4000-8000-000000000002","objectiveId":"10000000-0000-4000-8000-000000000002","revision":0,"title":"Event preparation","edges":[]}'::jsonb from public.plan_fixture));
reset role;
select public.assert_plan((select count(*)=2 from public.organization_workspace_objective_steps),'shared identity');
-- Simulate a canonical checklist edit after the plan editor opened.
update public.organization_workspace_objective_steps set status='done' where id='30000000-0000-4000-8000-000000000001';
set role authenticated;
do $$ begin
  begin perform public.save_workspace_objective_plan('00000000-0000-0000-0000-000000000001',(select value from public.plan_fixture)); raise exception 'stale step save accepted'; exception when serialization_failure then null; end;
end $$;
reset role;
select public.assert_plan((select revision=1 from public.workspace_objective_plans where id='20000000-0000-4000-8000-000000000001'),'revision rollback on stale step');
select public.assert_plan((select status='done' from public.organization_workspace_objective_steps where id='30000000-0000-4000-8000-000000000001'),'newer completion retained');
update public.plan_fixture set value=jsonb_set(value,'{steps}',(select jsonb_agg(jsonb_build_object('id',id,'title',title,'status',status,'expectedUpdatedAt',updated_at) order by step_order) from public.organization_workspace_objective_steps));
-- Cycles fail atomically, including changes to plan metadata and membership.
set role authenticated;
do $$ declare v jsonb; begin
  select value into v from public.plan_fixture;
  v := jsonb_set(v,'{edges}',(v->'edges') || '[{"id":"40000000-0000-4000-8000-000000000002","source":"30000000-0000-4000-8000-000000000002","target":"30000000-0000-4000-8000-000000000001","label":"Back"}]'::jsonb);
  begin perform public.save_workspace_objective_plan('00000000-0000-0000-0000-000000000001',v); raise exception 'cycle accepted'; exception when raise_exception then if sqlerrm <> 'A plan cannot loop back into itself' then raise; end if; end;
end $$;
select public.save_workspace_objective_plan('00000000-0000-0000-0000-000000000001',(select value || '{"title":"Recruit and train"}'::jsonb from public.plan_fixture));
reset role;
select public.assert_plan((select revision=2 and title='Recruit and train' from public.workspace_objective_plans where id='20000000-0000-4000-8000-000000000001'),'valid update after rollback');
select public.assert_plan((select count(*)=1 from public.workspace_objective_plan_edges),'invalid edge rolled back');
insert into public.organizations(user_id) values('00000000-0000-0000-0000-000000000004');
-- Cross-organization IDs cannot be adopted even through the SECURITY DEFINER function.
insert into public.organization_workspace_objectives(id,org_id,title,created_by) values('10000000-0000-4000-8000-000000000004','00000000-0000-0000-0000-000000000004','Other org','00000000-0000-0000-0000-000000000004');
insert into public.organization_workspace_objective_steps(id,org_id,objective_id,step_order,step_type,title) values('30000000-0000-4000-8000-000000000004','00000000-0000-0000-0000-000000000004','10000000-0000-4000-8000-000000000004',0,'custom','Private step');
set role authenticated;
do $$ declare v jsonb; begin
  select value || '{"revision":2}'::jsonb into v from public.plan_fixture;
  v := jsonb_set(v,'{steps,0,id}','"30000000-0000-4000-8000-000000000004"');
  begin perform public.save_workspace_objective_plan('00000000-0000-0000-0000-000000000001',v); raise exception 'cross-org step adopted'; exception when insufficient_privilege then null; end;
end $$;
reset role;
