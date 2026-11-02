-- Admit unsaved objectives into the existing research ledger. No board writes or AI activation.
create or replace function public.reserve_workspace_ai_research_run(p_id uuid,p_org_id uuid,p_actor_id uuid,p_hash text,p_target jsonb,p_prompt text,p_tariff jsonb,p_max_credits integer,p_max_cost integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; board jsonb; canvas jsonb; objective jsonb;
begin
  if not public.can_use_workspace_ai(p_org_id,p_actor_id) then raise exception 'AI access denied' using errcode='42501'; end if;
  if p_target->>'kind' is distinct from 'particle_research' or p_target->>'organizationId' is distinct from p_org_id::text or p_target->>'userId' is distinct from p_actor_id::text then raise exception 'Invalid research scope'; end if;
  select state into board from public.organization_workspace_boards where org_id=p_org_id;
  canvas:=board;
  if p_target->>'canvasId' is not null then
    select e->'state' into canvas from jsonb_array_elements(coalesce(board->'workspaceCatalog'->'entries','[]')) e where e->>'id'=p_target->>'canvasId';
  elsif coalesce((board->'workspaceCatalog'->>'defaultDeleted')::boolean,false) then
    raise exception 'Workspace not found';
  end if;
  if p_target->>'mode' = 'new_objective' then
    if not (p_target ? 'canvasId') or p_target ? 'objectiveId' or p_target ? 'plan'
      or jsonb_typeof(p_target->'revision') is distinct from 'number'
      or (p_target->>'revision') !~ '^[0-9]+$' then
      raise exception 'Invalid new objective target';
    end if;
    if p_target->>'canvasId' is not null and canvas is null then raise exception 'Workspace not found'; end if;
    if coalesce(canvas->'particleGraph'->>'revision','0') is distinct from p_target->>'revision' then
      raise exception 'Workspace changed' using errcode='40001';
    end if;
  else
    if p_target ? 'mode' then raise exception 'Invalid research target'; end if;
  select p into objective from jsonb_array_elements(coalesce(canvas->'particleGraph'->'particles','[]')) p where p->>'id'=p_target->>'objectiveId' and p->>'type'='objective';
  if objective is null or objective->>'revision' is distinct from p_target->>'revision' then raise exception 'Objective changed' using errcode='40001'; end if;
  end if;
  result:=public.reserve_workspace_ai_run(p_id,p_org_id,p_actor_id,p_hash,p_target,p_prompt,p_tariff,p_max_credits,p_max_cost);
  if (result->>'created')::boolean then update public.workspace_ai_runs set task='plan' where id=p_id;
  elsif result->'run'->>'task' is distinct from 'plan' then raise exception 'AI request identity conflict'; end if;
  return jsonb_build_object('created',result->'created','run',(select to_jsonb(r) from public.workspace_ai_runs r where id=p_id));
end $$;
revoke all on function public.reserve_workspace_ai_research_run(uuid,uuid,uuid,text,jsonb,text,jsonb,integer,integer) from public,anon,authenticated;
grant execute on function public.reserve_workspace_ai_research_run(uuid,uuid,uuid,text,jsonb,text,jsonb,integer,integer) to service_role;

-- Discovery returns metadata only. Opening a run still uses the existing
-- authorized reader, which rechecks source access and proposal applicability.
create or replace function public.list_workspace_research_runs(
  p_org_id uuid, p_actor_id uuid, p_objective_id uuid, p_canvas_id text, p_plan_id uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not public.can_use_workspace_ai(p_org_id,p_actor_id) then
    raise exception 'AI access denied' using errcode='42501';
  end if;
  return (
    select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc,r.id desc),'[]'::jsonb)
    from (
      select id,status,created_at from public.workspace_ai_runs
      where org_id=p_org_id and actor_id=p_actor_id and task='plan'
        and target->>'kind'='particle_research'
        and target->>'organizationId'=p_org_id::text
        and target->>'userId'=p_actor_id::text
        and (
          (p_objective_id is not null and not (target ? 'mode') and target->>'objectiveId'=p_objective_id::text)
          or (p_objective_id is null and p_plan_id is null and target->>'mode'='new_objective'
            and not (target ? 'objectiveId') and not (target ? 'plan'))
        )
        and target ? 'canvasId'
        and (target->>'canvasId') is not distinct from p_canvas_id
        and (target->'plan'->>'id') is not distinct from p_plan_id::text
      order by created_at desc,id desc limit 12
    ) r
  );
end $$;
revoke all on function public.list_workspace_research_runs(uuid,uuid,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.list_workspace_research_runs(uuid,uuid,uuid,text,uuid) to service_role;
