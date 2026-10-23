-- Additive, local development only. Reviewed revisions reuse the canonical plan writer.
alter table public.workspace_ai_plan_applications drop constraint workspace_ai_plan_applications_plan_id_key;
alter table public.workspace_ai_plan_applications add column before_draft jsonb;
alter table public.workspace_ai_plan_applications add column applied_revision integer;

create function public.read_workspace_ai_plan_baseline(p_org_id uuid,p_plan_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare item jsonb;
begin
  if auth.uid() is null or not public.can_use_workspace_ai(p_org_id,auth.uid()) then raise exception 'AI plan access denied' using errcode='42501'; end if;
  select value into item from jsonb_array_elements(public.read_workspace_objective_plans_v2(p_org_id)) where value->>'id'=p_plan_id::text;
  if item is null then raise exception 'Plan unavailable' using errcode='40001'; end if;
  return (item-'stepIds') || jsonb_build_object('steps',coalesce((select jsonb_agg(jsonb_build_object(
    'id',s.id,'title',s.title,'status',s.status,'expectedUpdatedAt',s.updated_at) order by m.position)
    from public.workspace_objective_plan_steps m join public.organization_workspace_objective_steps s on s.id=m.step_id
    where m.plan_id=p_plan_id and s.org_id=p_org_id),'[]'::jsonb));
end $$;
create or replace function public.read_workspace_ai_plan_application(p_org_id uuid,p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or not public.can_use_workspace_ai(p_org_id,auth.uid()) or not exists(
    select 1 from public.workspace_ai_runs where id=p_id and org_id=p_org_id and actor_id=auth.uid() and task='plan'
  ) then raise exception 'AI plan access denied' using errcode='42501'; end if;
  return (select to_jsonb(a)-'step_snapshots'-'before_draft'-'applied_revision' from public.workspace_ai_plan_applications a where run_id=p_id);
end $$;
alter function public.apply_workspace_ai_plan(uuid,uuid) rename to apply_workspace_ai_new_plan;
revoke all on function public.apply_workspace_ai_new_plan(uuid,uuid) from public,anon,authenticated;
create function public.apply_workspace_ai_plan(p_org_id uuid,p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare run public.workspace_ai_runs; draft jsonb; baseline jsonb; receipt jsonb; item jsonb; prior jsonb;
begin
  if auth.uid() is null or not public.can_use_workspace_ai(p_org_id,auth.uid()) then raise exception 'AI plan access denied' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('workspace-plans:'||p_org_id::text,0));
  select * into run from public.workspace_ai_runs where id=p_id and org_id=p_org_id and actor_id=auth.uid() and task='plan' for update;
  if not found then raise exception 'AI plan unavailable'; end if;
  if not (run.target ? 'plan') then return public.apply_workspace_ai_new_plan(p_org_id,p_id); end if;
  if run.status<>'succeeded' or run.settled_at is null then raise exception 'AI plan unavailable'; end if;
  receipt := public.read_workspace_ai_plan_application(p_org_id,p_id);
  if receipt is not null then return receipt; end if;
  perform 1 from public.organization_workspace_objectives where id=(run.target->>'objectiveId')::uuid and org_id=p_org_id
    and kind='custom' and status<>'archived' and updated_at=(run.target->>'revision')::timestamptz for update;
  if not found then raise exception 'Objective changed' using errcode='40001'; end if;
  perform 1 from public.workspace_objective_plans where id=(run.target->'plan'->>'id')::uuid and org_id=p_org_id for update;
  perform 1 from public.organization_workspace_objective_steps where id in(select step_id from public.workspace_objective_plan_steps where plan_id=(run.target->'plan'->>'id')::uuid) order by id for update;
  baseline := public.read_workspace_ai_plan_baseline(p_org_id,(run.target->'plan'->>'id')::uuid);
  if baseline is distinct from run.target->'planBaseline' then raise exception 'Plan or steps changed' using errcode='40001'; end if;
  draft := run.proposal::jsonb->'draft';
  if draft->>'id' is distinct from baseline->>'id' or draft->>'objectiveId' is distinct from run.target->>'objectiveId'
    or draft->>'revision' is distinct from baseline->>'revision' or baseline->>'revision' is distinct from run.target->'plan'->>'revision'
    or jsonb_typeof(draft->'steps') is distinct from 'array' or jsonb_array_length(draft->'steps') not between 1 and 20 then raise exception 'Invalid plan revision'; end if;
  for item in select value from jsonb_array_elements(draft->'steps') loop
    select value into prior from jsonb_array_elements(baseline->'steps') where value->>'id'=item->>'id';
    if prior is null then
      if item->>'status' is distinct from 'todo' or item->>'expectedUpdatedAt' is not null or exists(select 1 from public.organization_workspace_objective_steps where id=(item->>'id')::uuid) then raise exception 'Invalid new step'; end if;
    elsif item->>'status' is distinct from prior->>'status' or item->>'expectedUpdatedAt' is distinct from prior->>'expectedUpdatedAt' then raise exception 'AI cannot change progress'; end if;
  end loop;
  -- AI may retain a user's existing choice, never invent or silently switch it.
  for item in select value from jsonb_array_elements(draft->'decisions') loop
    if item->>'selectedEdgeId' is not null and (not exists(select 1 from jsonb_array_elements(baseline->'decisions') old where old=item) or not exists(select 1 from jsonb_array_elements(baseline->'edges') old join jsonb_array_elements(draft->'edges') proposed on old=proposed where old->>'id'=item->>'selectedEdgeId'))
      then raise exception 'AI cannot choose a decision outcome'; end if;
  end loop;
  perform public.save_workspace_objective_plan_v2(p_org_id,draft);
  insert into public.workspace_ai_plan_applications(run_id,plan_id,before_draft,applied_revision,step_snapshots)
    values(p_id,(draft->>'id')::uuid,baseline,(draft->>'revision')::integer+1,
      (select jsonb_object_agg(s.id::text,s.updated_at) from public.organization_workspace_objective_steps s where s.org_id=p_org_id and
        s.id::text in(select value->>'id' from jsonb_array_elements(baseline->'steps') union select value->>'id' from jsonb_array_elements(draft->'steps'))));
  return public.read_workspace_ai_plan_application(p_org_id,p_id);
end $$;
alter function public.undo_workspace_ai_plan(uuid,uuid) rename to undo_workspace_ai_new_plan;
revoke all on function public.undo_workspace_ai_new_plan(uuid,uuid) from public,anon,authenticated;
create function public.undo_workspace_ai_plan(p_org_id uuid,p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare app public.workspace_ai_plan_applications; restored jsonb; current_revision integer;
begin
  perform public.read_workspace_ai_plan_application(p_org_id,p_id);
  perform pg_advisory_xact_lock(hashtextextended('workspace-plans:'||p_org_id::text,0));
  perform 1 from public.workspace_ai_runs where id=p_id for update;
  select * into app from public.workspace_ai_plan_applications where run_id=p_id for update;
  if not found then raise exception 'Proposal not applied'; end if;
  if app.before_draft is null then return public.undo_workspace_ai_new_plan(p_org_id,p_id); end if;
  if app.undone_at is not null then return public.read_workspace_ai_plan_application(p_org_id,p_id); end if;
  select revision into current_revision from public.workspace_objective_plans where id=app.plan_id and org_id=p_org_id for update;
  if current_revision is distinct from app.applied_revision then raise exception 'Plan changed' using errcode='40001'; end if;
  perform 1 from public.organization_workspace_objective_steps where id::text in(select jsonb_object_keys(app.step_snapshots)) order by id for update;
  if exists(select 1 from jsonb_each_text(app.step_snapshots) snap where not exists(select 1 from public.organization_workspace_objective_steps s where s.id::text=snap.key and s.org_id=p_org_id and s.updated_at=snap.value::timestamptz)) then raise exception 'Steps changed' using errcode='40001'; end if;
  if exists(select 1 from jsonb_object_keys(app.step_snapshots) as added(id)
    where not exists(select 1 from jsonb_array_elements(app.before_draft->'steps') old where old->>'id'=added.id)
      and (exists(select 1 from public.workspace_objective_plan_steps where step_id::text=added.id and plan_id<>app.plan_id)
        or exists(select 1 from public.workspace_objective_plan_edges where target::text=added.id and plan_id<>app.plan_id)))
    then raise exception 'New steps are now shared' using errcode='40001'; end if;
  restored := app.before_draft || jsonb_build_object('revision',current_revision,'steps',coalesce((select jsonb_agg(value || jsonb_build_object('expectedUpdatedAt',app.step_snapshots->(value->>'id')) order by ordinal) from jsonb_array_elements(app.before_draft->'steps') with ordinality as items(value,ordinal)),'[]'::jsonb));
  perform public.save_workspace_objective_plan_v2(p_org_id,restored);
  -- Remove only untouched steps created by this revision; prior/shared work survives.
  delete from public.organization_workspace_objective_steps where org_id=p_org_id
    and id::text in(select jsonb_object_keys(app.step_snapshots))
    and not exists(select 1 from jsonb_array_elements(app.before_draft->'steps') old where old->>'id'=organization_workspace_objective_steps.id::text);
  update public.workspace_ai_plan_applications set undone_at=clock_timestamp() where run_id=p_id;
  return public.read_workspace_ai_plan_application(p_org_id,p_id);
end $$;
revoke all on function public.read_workspace_ai_plan_baseline(uuid,uuid),public.apply_workspace_ai_plan(uuid,uuid),public.undo_workspace_ai_plan(uuid,uuid) from public,anon;
grant execute on function public.read_workspace_ai_plan_baseline(uuid,uuid),public.apply_workspace_ai_plan(uuid,uuid),public.undo_workspace_ai_plan(uuid,uuid) to authenticated;
