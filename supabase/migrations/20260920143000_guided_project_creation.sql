-- Retain the complete guided setup, including actual person IDs, without changing access grants.
alter table public.organization_projects
  add column if not exists guided_setup jsonb,
  add column if not exists creation_request_id uuid;
create unique index if not exists organization_projects_creation_request_id_key
  on public.organization_projects (creation_request_id) where creation_request_id is not null;

create or replace function public.create_guided_organization_project(
  p_actor_id uuid, p_org_id uuid, p_request_id uuid, p_setup jsonb,
  p_member_labels text[], p_overview_html text, p_overview_text text
) returns jsonb language plpgsql security definer
set search_path = '' set row_security = off as $$
declare
  v_result jsonb;
  v_project_id uuid;
  v_existing public.organization_projects%rowtype;
  v_task jsonb;
  v_file jsonb;
  v_task_id uuid;
  v_position integer := 0;
begin
  if p_actor_id is null or p_org_id is null or p_request_id is null then
    raise exception 'Invalid creation request';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text, 0));
  select * into v_existing from public.organization_projects where creation_request_id = p_request_id;
  if found then
    if v_existing.org_id <> p_org_id or v_existing.created_by is distinct from p_actor_id then
      raise exception 'Creation request belongs to another actor or organization';
    end if;
    return jsonb_build_object('ok', true, 'projectId', v_existing.id);
  end if;
  if jsonb_typeof(p_setup->'tasks') <> 'array' or jsonb_typeof(p_setup->'files') <> 'array'
    or jsonb_array_length(p_setup->'tasks') > 50 or jsonb_array_length(p_setup->'files') > 30 then
    raise exception 'Invalid setup';
  end if;
  v_result := public.create_organization_project_transition(
    p_actor_id, p_org_id,
    jsonb_build_object('name', p_setup->>'name', 'description', p_overview_html,
      'status', 'planned', 'priority', 'medium', 'start_date', p_setup->>'startDate',
      'end_date', p_setup->>'endDate', 'member_labels', to_jsonb(p_member_labels),
      'tags', '[]'::jsonb, 'type_label', 'Project'),
    true, p_overview_html, p_overview_text
  );
  if not coalesce((v_result->>'ok')::boolean, false) then return v_result; end if;
  v_project_id := (v_result->>'projectId')::uuid;
  update public.organization_projects set guided_setup = p_setup, creation_request_id = p_request_id where id = v_project_id;
  for v_task in select value from jsonb_array_elements(p_setup->'tasks') loop
    if (v_task->>'startDate')::date < (p_setup->>'startDate')::date
      or (v_task->>'endDate')::date > (p_setup->>'endDate')::date
      or (v_task->>'endDate')::date < (v_task->>'startDate')::date then
      raise exception 'Task dates must fall within project dates';
    end if;
    insert into public.organization_tasks(org_id, project_id, title, task_type, status,
      start_date, end_date, priority, workstream_name, sort_order, created_source, created_by, updated_by)
    values(p_org_id, v_project_id, v_task->>'title', 'task', 'todo',
      (v_task->>'startDate')::date, (v_task->>'endDate')::date, 'medium', v_task->>'workstream',
      v_position, 'user', p_actor_id, p_actor_id) returning id into v_task_id;
    if nullif(v_task->>'assigneeId', '') is not null then
      insert into public.organization_task_assignees(org_id, task_id, user_id, created_by)
      values(p_org_id, v_task_id, (v_task->>'assigneeId')::uuid, p_actor_id);
    end if;
    v_position := v_position + 1;
  end loop;
  for v_file in select value from jsonb_array_elements(p_setup->'files') loop
    if v_file->>'id' !~ '^[a-zA-Z0-9_-]{10,200}$' then raise exception 'Invalid Drive file'; end if;
    insert into public.organization_project_assets(org_id, project_id, name, asset_type, external_url, created_by, updated_by)
    values(p_org_id, v_project_id, v_file->>'name', 'file',
      'https://drive.google.com/file/d/' || (v_file->>'id') || '/view', p_actor_id, p_actor_id);
  end loop;
  update public.organization_projects set task_count = v_position where id = v_project_id;
  return jsonb_build_object('ok', true, 'projectId', v_project_id);
end;
$$;
revoke all on function public.create_guided_organization_project(uuid, uuid, uuid, jsonb, text[], text, text) from public, anon, authenticated;
grant execute on function public.create_guided_organization_project(uuid, uuid, uuid, jsonb, text[], text, text) to service_role;
