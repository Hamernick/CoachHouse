-- Local-only. Reuse the credit ledger and canonical plan writer; no activation.
alter table public.workspace_ai_runs drop constraint workspace_ai_runs_task_check;
alter table public.workspace_ai_runs add constraint workspace_ai_runs_task_check check(task in ('document','plan'));
create function public.reserve_workspace_ai_plan_run(p_id uuid,p_org_id uuid,p_actor_id uuid,p_hash text,p_target jsonb,p_prompt text,p_tariff jsonb,p_max_credits integer,p_max_cost integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  if not public.can_use_workspace_ai(p_org_id,p_actor_id) then raise exception 'AI access denied' using errcode='42501'; end if;
  if p_target->>'kind' is distinct from 'plan' or p_target->>'organizationId' is distinct from p_org_id::text or p_target->>'userId' is distinct from p_actor_id::text
    or not exists(select 1 from public.organization_workspace_objectives where id=(p_target->>'objectiveId')::uuid and org_id=p_org_id and kind='custom' and status<>'archived' and updated_at=(p_target->>'revision')::timestamptz)
    then raise exception 'Objective changed. Refresh before asking for a plan.' using errcode='40001'; end if;
  result := public.reserve_workspace_ai_run(p_id,p_org_id,p_actor_id,p_hash,p_target,p_prompt,p_tariff,p_max_credits,p_max_cost);
  if (result->>'created')::boolean then
    update public.workspace_ai_runs set task='plan' where id=p_id;
  elsif result->'run'->>'task' is distinct from 'plan' then raise exception 'AI request identity conflict'; end if;
  return jsonb_build_object('created',result->'created','run',(select to_jsonb(r) from public.workspace_ai_runs r where id=p_id));
end $$;
revoke all on function public.reserve_workspace_ai_plan_run(uuid,uuid,uuid,text,jsonb,text,jsonb,integer,integer) from public,anon,authenticated;
grant execute on function public.reserve_workspace_ai_plan_run(uuid,uuid,uuid,text,jsonb,text,jsonb,integer,integer) to service_role;

create table public.workspace_ai_plan_applications (
  run_id uuid primary key references public.workspace_ai_runs(id) on delete restrict,
  plan_id uuid not null unique,
  step_snapshots jsonb not null,
  saved_at timestamptz not null default clock_timestamp(),
  undone_at timestamptz
);
alter table public.workspace_ai_plan_applications enable row level security;
alter table public.workspace_ai_plan_applications force row level security;
revoke all on public.workspace_ai_plan_applications from public,anon,authenticated;

create function public.read_workspace_ai_plan_application(p_org_id uuid,p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or not public.can_use_workspace_ai(p_org_id,auth.uid()) or not exists(
    select 1 from public.workspace_ai_runs where id=p_id and org_id=p_org_id and actor_id=auth.uid() and task='plan'
  ) then raise exception 'AI plan access denied' using errcode='42501'; end if;
  return (select to_jsonb(a)-'step_snapshots' from public.workspace_ai_plan_applications a where run_id=p_id);
end $$;

create function public.apply_workspace_ai_plan(p_org_id uuid,p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare run public.workspace_ai_runs; draft jsonb; receipt jsonb; parent public.organization_workspace_objectives;
begin
  if auth.uid() is null or not public.can_use_workspace_ai(p_org_id,auth.uid()) then raise exception 'AI plan access denied' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('workspace-plans:'||p_org_id::text,0));
  select * into run from public.workspace_ai_runs where id=p_id and org_id=p_org_id and actor_id=auth.uid() and task='plan' for update;
  if not found or run.status<>'succeeded' or run.settled_at is null then raise exception 'AI plan unavailable'; end if;
  receipt := public.read_workspace_ai_plan_application(p_org_id,p_id);
  if receipt is not null then return receipt; end if;
  select * into parent from public.organization_workspace_objectives where id=(run.target->>'objectiveId')::uuid and org_id=p_org_id for update;
  if not found or parent.kind<>'custom' or parent.status='archived' or parent.updated_at is distinct from (run.target->>'revision')::timestamptz
    then raise exception 'Objective changed. Review a new proposal before applying.' using errcode='40001'; end if;
  draft := run.proposal::jsonb->'draft';
  if draft->>'id' is distinct from p_id::text or draft->>'objectiveId' is distinct from parent.id::text or draft->>'revision' is distinct from '0'
    or jsonb_typeof(draft->'steps') is distinct from 'array' or jsonb_array_length(draft->'steps') not between 1 and 20
    or exists(select 1 from jsonb_array_elements(draft->'steps') s where s->>'expectedUpdatedAt' is not null or s->>'status' is distinct from 'todo'
      or exists(select 1 from public.organization_workspace_objective_steps where id=(s->>'id')::uuid))
    or exists(select 1 from jsonb_array_elements(draft->'decisions') d where d->>'selectedEdgeId' is not null)
    then raise exception 'Invalid AI plan application'; end if;
  perform public.save_workspace_objective_plan_v2(p_org_id,draft);
  insert into public.workspace_ai_plan_applications(run_id,plan_id,step_snapshots)
    values(p_id,p_id,(select jsonb_object_agg(s.id::text,s.updated_at) from public.organization_workspace_objective_steps s
      join public.workspace_objective_plan_steps m on m.step_id=s.id where m.plan_id=p_id));
  return public.read_workspace_ai_plan_application(p_org_id,p_id);
end $$;

create function public.undo_workspace_ai_plan(p_org_id uuid,p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare app public.workspace_ai_plan_applications; plan public.workspace_objective_plans;
begin
  perform public.read_workspace_ai_plan_application(p_org_id,p_id); -- Actor and task authorization.
  perform pg_advisory_xact_lock(hashtextextended('workspace-plans:'||p_org_id::text,0));
  perform 1 from public.workspace_ai_runs where id=p_id for update;
  select * into app from public.workspace_ai_plan_applications where run_id=p_id for update;
  if not found then raise exception 'This proposal has not been applied'; end if;
  if app.undone_at is not null then return public.read_workspace_ai_plan_application(p_org_id,p_id); end if;
  select * into plan from public.workspace_objective_plans where id=app.plan_id and org_id=p_org_id for update;
  if not found or plan.revision<>1 then raise exception 'Plan changed. Edit it manually to preserve newer work.' using errcode='40001'; end if;
  perform 1 from public.organization_workspace_objective_steps where id::text in(select jsonb_object_keys(app.step_snapshots)) order by id for update;
  if exists(select 1 from jsonb_each_text(app.step_snapshots) snap where not exists(
      select 1 from public.organization_workspace_objective_steps s where s.id::text=snap.key and s.org_id=p_org_id and s.updated_at=snap.value::timestamptz))
    or exists(select 1 from public.workspace_objective_plan_steps where step_id::text in(select jsonb_object_keys(app.step_snapshots)) and plan_id<>app.plan_id)
    or exists(select 1 from public.workspace_objective_plan_edges where target::text in(select jsonb_object_keys(app.step_snapshots)) and plan_id<>app.plan_id)
    then raise exception 'Plan steps changed or are shared. Edit manually to preserve newer work.' using errcode='40001'; end if;
  delete from public.workspace_objective_plans where id=app.plan_id;
  delete from public.organization_workspace_objective_steps where org_id=p_org_id and id::text in(select jsonb_object_keys(app.step_snapshots));
  update public.workspace_ai_plan_applications set undone_at=clock_timestamp() where run_id=p_id;
  return public.read_workspace_ai_plan_application(p_org_id,p_id);
end $$;
revoke all on function public.read_workspace_ai_plan_application(uuid,uuid),public.apply_workspace_ai_plan(uuid,uuid),public.undo_workspace_ai_plan(uuid,uuid) from public,anon;
grant execute on function public.read_workspace_ai_plan_application(uuid,uuid),public.apply_workspace_ai_plan(uuid,uuid),public.undo_workspace_ai_plan(uuid,uuid) to authenticated;
