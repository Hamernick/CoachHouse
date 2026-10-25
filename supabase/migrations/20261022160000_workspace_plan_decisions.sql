-- Local-only: explicit per-plan decisions reuse canonical steps and plan revisions.
alter table public.workspace_objective_plans add column decisions jsonb not null default '[]'
  check (jsonb_typeof(decisions)='array' and jsonb_array_length(decisions)<=80);
-- Keep the original mutation body private; all clients pass through validation.
alter function public.save_workspace_objective_plan(uuid,jsonb) rename to save_workspace_objective_plan_base;
revoke all on function public.save_workspace_objective_plan_base(uuid,jsonb) from public,anon,authenticated;
create function public.save_workspace_objective_plan(p_org_id uuid,p_draft jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare v_decisions jsonb; v_decision jsonb; v_step uuid; v_choice uuid; v_count integer;
begin
  -- Base function independently verifies the actor, scope and CAS under the org lock.
  perform public.save_workspace_objective_plan_base(p_org_id,p_draft);
  select case when p_draft ? 'decisions' then p_draft->'decisions' else decisions end
    into v_decisions from public.workspace_objective_plans where id=(p_draft->>'id')::uuid and org_id=p_org_id;
  if jsonb_typeof(v_decisions) is distinct from 'array' or jsonb_array_length(v_decisions)>80 then
    raise exception 'Invalid decisions'; end if;
  if (select count(*) <> count(distinct value->>'stepId') from jsonb_array_elements(v_decisions)) then
    raise exception 'Duplicate decision'; end if;
  for v_decision in select value from jsonb_array_elements(v_decisions) loop
    v_step := (v_decision->>'stepId')::uuid; v_choice := (v_decision->>'selectedEdgeId')::uuid;
    if v_step is null or not exists(select 1 from public.workspace_objective_plan_steps
      where plan_id=(p_draft->>'id')::uuid and step_id=v_step) then raise exception 'Decision must belong to this plan'; end if;
    select count(*) into v_count from public.workspace_objective_plan_edges where plan_id=(p_draft->>'id')::uuid and source=v_step;
    if v_count < 2 or exists(select 1 from public.workspace_objective_plan_edges where plan_id=(p_draft->>'id')::uuid and source=v_step and length(trim(label))=0)
      or v_count <> (select count(distinct lower(trim(label))) from public.workspace_objective_plan_edges where plan_id=(p_draft->>'id')::uuid and source=v_step)
      then raise exception 'Decisions need at least two uniquely named outcomes'; end if;
    if v_choice is not null and not exists(select 1 from public.workspace_objective_plan_edges
      where id=v_choice and plan_id=(p_draft->>'id')::uuid and source=v_step) then raise exception 'Invalid decision choice'; end if;
  end loop;
  update public.workspace_objective_plans set decisions=v_decisions where id=(p_draft->>'id')::uuid and org_id=p_org_id;
end $$;
create function public.save_workspace_objective_plan_v2(p_org_id uuid,p_draft jsonb) returns void
language sql security invoker set search_path='' as $$ select public.save_workspace_objective_plan(p_org_id,p_draft) $$;
create function public.read_workspace_objective_plans_v2(p_org_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_plans jsonb;
begin
  -- Authenticate before accessing private metadata, including for empty collections.
  v_plans := public.read_workspace_objective_plans(p_org_id);
  return coalesce((select jsonb_agg(item || jsonb_build_object('decisions',p.decisions) order by ordinal)
    from jsonb_array_elements(v_plans) with ordinality as entries(item,ordinal)
    join public.workspace_objective_plans p on p.id=(item->>'id')::uuid and p.org_id=p_org_id),'[]'::jsonb);
end $$;
revoke all on function public.save_workspace_objective_plan(uuid,jsonb),public.save_workspace_objective_plan_v2(uuid,jsonb),public.read_workspace_objective_plans_v2(uuid) from public,anon;
grant execute on function public.save_workspace_objective_plan(uuid,jsonb),public.save_workspace_objective_plan_v2(uuid,jsonb),public.read_workspace_objective_plans_v2(uuid) to authenticated;
