\set ON_ERROR_STOP on
\ir organization-closure-drive-fixture.sql
\ir ../migrations/20261102235000_organization_closure_private_reads.sql
\ir ../migrations/20261102235500_organization_closure_objective_writes.sql
create function public.fixture_closure_objectives() returns void language plpgsql as $$
begin
 truncate public.organization_workspace_objective_groups,public.organization_workspace_objectives cascade;
 perform public.fixture_closure_integrated();
 insert into public.organization_workspace_objective_groups(id,org_id,title,created_by)
 select public.fixture_form_id(2600+n),public.fixture_form_id(n),'Group',public.fixture_form_id(13) from generate_series(1,2) n;
 insert into public.organization_workspace_objectives(id,org_id,group_id,title,created_by,updated_by)
 select public.fixture_form_id(2610+n),public.fixture_form_id(n),public.fixture_form_id(2600+n),'Objective',public.fixture_form_id(13),public.fixture_form_id(13) from generate_series(1,2) n;
 insert into public.organization_workspace_objective_steps(id,org_id,objective_id,step_order,step_type,title)
 select public.fixture_form_id(2620+n),public.fixture_form_id(n),public.fixture_form_id(2610+n),0,'custom','Step' from generate_series(1,2) n;
 insert into public.organization_workspace_objective_assignees(org_id,objective_id,user_id,created_by)
 select public.fixture_form_id(n),public.fixture_form_id(2610+n),public.fixture_form_id(13),public.fixture_form_id(13) from generate_series(1,2) n;
 insert into public.organization_workspace_objective_links(id,org_id,objective_id,card_id,created_by)
 select public.fixture_form_id(2630+n),public.fixture_form_id(n),public.fixture_form_id(2610+n),'vault',public.fixture_form_id(13) from generate_series(1,2) n;
 insert into public.organization_workspace_objective_activity(id,org_id,objective_id,actor_id,event_type)
 select public.fixture_form_id(2640+n),public.fixture_form_id(n),public.fixture_form_id(2610+n),public.fixture_form_id(13),'created' from generate_series(1,2) n;
end $$;
create function public.fixture_objective_plan() returns jsonb language sql as $$
 select jsonb_build_object('id',public.fixture_form_id(2651),'objectiveId',public.fixture_form_id(2611),'revision',0,'title','Plan',
 'steps',jsonb_build_array(jsonb_build_object('id',public.fixture_form_id(2621),'title','Step','status','todo','expectedUpdatedAt',updated_at)),
 'edges','[]'::jsonb,'decisions','[]'::jsonb) from public.organization_workspace_objective_steps where id=public.fixture_form_id(2621); $$;
-- Supabase's ordinary legacy-table grants are explicit in this isolated fixture;
-- existing production RLS policies still decide every authenticated operation.
grant select,insert,update,delete on public.organization_workspace_objective_groups,public.organization_workspace_objectives,
 public.organization_workspace_objective_steps,public.organization_workspace_objective_assignees,
 public.organization_workspace_objective_links,public.organization_workspace_objective_activity to authenticated,service_role;
