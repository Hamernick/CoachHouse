-- Generated organization dates are placeholders until explicitly scheduled.
alter table public.organization_projects
  add column if not exists schedule_confirmed boolean not null default false;

update public.organization_projects
set schedule_confirmed = true
where created_source = 'user' and starter_seed_key is null;

create or replace function public.confirm_changed_project_schedule()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.start_date is distinct from old.start_date
     or new.end_date is distinct from old.end_date then
    new.schedule_confirmed := true;
  end if;
  return new;
end;
$$;
create trigger confirm_changed_project_schedule
before update of start_date, end_date on public.organization_projects
for each row execute function public.confirm_changed_project_schedule();

set check_function_bodies = off;
set search_path = public;

create or replace function public.update_organization_project_schedule_transition(
  p_project_id uuid,
  p_actor_id uuid,
  p_expected_org_id uuid,
  p_expected_updated_at timestamptz,
  p_start_date date,
  p_end_date date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_project public.organization_projects%rowtype;
  v_updated_at timestamptz := now();
begin
  if p_actor_id is null or p_expected_org_id is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_actor');
  end if;
  if p_start_date is null or p_end_date is null or p_end_date < p_start_date then
    return jsonb_build_object('ok', false, 'code', 'invalid_schedule');
  end if;

  select * into v_project
  from public.organization_projects
  where id = p_project_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v_project.org_id <> p_expected_org_id then
    return jsonb_build_object('ok', false, 'code', 'scope_changed');
  end if;
  if p_expected_updated_at is null
    or v_project.updated_at is distinct from p_expected_updated_at then
    return jsonb_build_object('ok', false, 'code', 'stale');
  end if;

  update public.organization_projects
  set
    schedule_confirmed = true,
    start_date = p_start_date,
    end_date = p_end_date,
    updated_at = v_updated_at,
    updated_by = p_actor_id
  where id = v_project.id;

  return jsonb_build_object(
    'ok', true,
    'projectId', v_project.id,
    'updatedAt', v_updated_at
  );
end;
$$;

revoke all on function public.update_organization_project_schedule_transition(uuid, uuid, uuid, timestamptz, date, date)
  from public, anon, authenticated;

grant execute on function public.update_organization_project_schedule_transition(uuid, uuid, uuid, timestamptz, date, date)
  to service_role;
