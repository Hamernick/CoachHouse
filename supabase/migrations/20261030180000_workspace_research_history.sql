-- Discovery returns metadata only. Opening a run still uses the existing
-- authorized reader, which rechecks source access and proposal applicability.
create function public.list_workspace_research_runs(
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
        and target->>'objectiveId'=p_objective_id::text
        and target ? 'canvasId'
        and (target->>'canvasId') is not distinct from p_canvas_id
        and (target->'plan'->>'id') is not distinct from p_plan_id::text
      order by created_at desc,id desc limit 12
    ) r
  );
end $$;
revoke all on function public.list_workspace_research_runs(uuid,uuid,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.list_workspace_research_runs(uuid,uuid,uuid,text,uuid) to service_role;
