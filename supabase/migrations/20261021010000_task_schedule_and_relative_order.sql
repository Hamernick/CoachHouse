-- Directory task planning. Service-only entry points: server actions verify the
-- authenticated actor's edit access to the expected organization/project first.
-- Neither operation replaces assignments or writes task status/recurrence data.
set check_function_bodies = off;

create function public.schedule_organization_task_transition(
  p_actor_id uuid, p_task_id uuid, p_project_id uuid, p_expected_org_id uuid,
  p_start_date date, p_expected_start_date date, p_expected_end_date date
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_task public.organization_tasks%rowtype;
begin
  if p_actor_id is null then return jsonb_build_object('ok',false,'code','invalid_actor'); end if;
  -- A schedule change locks only its task, matching full-editor task locking.
  select * into v_task from public.organization_tasks
    where id=p_task_id and project_id=p_project_id and org_id=p_expected_org_id for update;
  if not found or v_task.created_source='system' then
    return jsonb_build_object('ok',false,'code','invalid_task');
  end if;
  if v_task.start_date is distinct from p_expected_start_date
    or v_task.end_date is distinct from p_expected_end_date then
    return jsonb_build_object('ok',false,'code','stale');
  end if;
  if p_start_date is not null and v_task.end_date is not null and p_start_date>v_task.end_date then
    return jsonb_build_object('ok',false,'code','invalid_dates');
  end if;
  update public.organization_tasks set start_date=p_start_date, updated_by=p_actor_id
    where id=v_task.id and start_date is distinct from p_start_date;
  return jsonb_build_object('ok',true,'startDate',p_start_date,'endDate',v_task.end_date);
end $$;

create function public.move_organization_task_transition(
  p_actor_id uuid, p_task_id uuid, p_project_id uuid, p_expected_org_id uuid,
  p_neighbor_task_id uuid, p_placement text,
  p_expected_sort_order integer, p_expected_neighbor_sort_order integer,
  p_expected_updated_at timestamptz, p_expected_neighbor_updated_at timestamptz
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_task public.organization_tasks%rowtype;
  v_neighbor public.organization_tasks%rowtype;
  v_ids uuid[];
  v_order uuid[];
  v_position integer;
begin
  if p_actor_id is null then return jsonb_build_object('ok',false,'code','invalid_actor'); end if;
  if p_task_id is null or p_neighbor_task_id is null or p_task_id=p_neighbor_task_id
    or p_placement is null or p_placement not in ('before','after') then
    return jsonb_build_object('ok',false,'code','invalid_task');
  end if;
  -- Serialize with full-project reordering/insertion. Older full editors lock
  -- a task before its project: NOWAIT below avoids an inverted-lock deadlock.
  perform 1 from public.organization_projects
    where id=p_project_id and org_id=p_expected_org_id for update;
  if not found then return jsonb_build_object('ok',false,'code','stale'); end if;
  perform id from public.organization_tasks where project_id=p_project_id and org_id=p_expected_org_id
    and created_source<>'system' order by id for update nowait;
  select * into v_task from public.organization_tasks where id=p_task_id
    and project_id=p_project_id and org_id=p_expected_org_id and created_source<>'system';
  if not found then return jsonb_build_object('ok',false,'code','invalid_task'); end if;
  select * into v_neighbor from public.organization_tasks where id=p_neighbor_task_id
    and project_id=p_project_id and org_id=p_expected_org_id and created_source<>'system';
  if not found then return jsonb_build_object('ok',false,'code','invalid_task'); end if;
  if v_task.sort_order is distinct from p_expected_sort_order
    or v_neighbor.sort_order is distinct from p_expected_neighbor_sort_order
    or v_task.updated_at is distinct from p_expected_updated_at
    or v_neighbor.updated_at is distinct from p_expected_neighbor_updated_at then
    return jsonb_build_object('ok',false,'code','stale');
  end if;
  -- Remove only the moving task; all other records retain their relative order,
  -- including tasks hidden by personal scope, relation or status filters.
  select array_agg(id order by sort_order,id) into v_ids from public.organization_tasks
    where project_id=p_project_id and org_id=p_expected_org_id and created_source<>'system' and id<>p_task_id;
  v_position := array_position(v_ids,p_neighbor_task_id);
  if p_placement='after' then v_position:=v_position+1; end if;
  v_order := coalesce(v_ids[1:v_position-1],'{}'::uuid[]) || array[p_task_id]
    || coalesce(v_ids[v_position:cardinality(v_ids)],'{}'::uuid[]);
  update public.organization_tasks t set sort_order=(o.position-1)::integer, updated_by=p_actor_id
    from unnest(v_order) with ordinality o(id,position)
    where t.id=o.id and t.sort_order is distinct from (o.position-1)::integer;
  -- Never return the full project set to a filtered personal queue.
  return jsonb_build_object('ok',true,'projectId',p_project_id);
exception when lock_not_available then
  return jsonb_build_object('ok',false,'code','stale');
end $$;

revoke all on function public.schedule_organization_task_transition(uuid,uuid,uuid,uuid,date,date,date)
  from public,anon,authenticated;
revoke all on function public.move_organization_task_transition(uuid,uuid,uuid,uuid,uuid,text,integer,integer,timestamptz,timestamptz)
  from public,anon,authenticated;
grant execute on function public.schedule_organization_task_transition(uuid,uuid,uuid,uuid,date,date,date) to service_role;
grant execute on function public.move_organization_task_transition(uuid,uuid,uuid,uuid,uuid,text,integer,integer,timestamptz,timestamptz) to service_role;
