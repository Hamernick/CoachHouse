-- Small, content-free invalidation receipts. Never publish the workspace board.
create table if not exists public.organization_workspace_calendar_revisions (
  org_id uuid primary key references public.organizations(user_id) on delete cascade,
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);

alter table public.organization_workspace_calendar_revisions enable row level security;
alter table public.organization_workspace_calendar_revisions force row level security;
revoke all on public.organization_workspace_calendar_revisions from public, anon, authenticated;
grant select on public.organization_workspace_calendar_revisions to authenticated, service_role;

drop policy if exists organization_workspace_calendar_revisions_select on public.organization_workspace_calendar_revisions;
create policy organization_workspace_calendar_revisions_select
  on public.organization_workspace_calendar_revisions for select to authenticated
  using (
    public.is_admin() or org_id = (select auth.uid()) or exists (
      select 1 from public.organization_memberships om
      where om.org_id = organization_workspace_calendar_revisions.org_id
        and om.member_id = (select auth.uid())
    )
  );

-- Sort by stable identity; layout/order/timestamps never change the projection.
-- Absent legacy graphs and optional Event fields remain backward compatible.
create or replace function public.workspace_particle_calendar_projection(p_state jsonb)
returns jsonb language sql immutable set search_path = '' as $$
  select coalesce(jsonb_agg(event order by event->>'id', event::text), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'id', particle->'id', 'title', particle->'title',
      'description', coalesce(particle->>'description', ''),
      'startsAt', particle#>'{data,widget,startsAt}',
      'location', coalesce(particle#>>'{data,widget,location}', ''),
      'attendees', coalesce(nullif(particle#>'{data,widget,attendees}', 'null'::jsonb), '[]'::jsonb)
    ) as event
    from jsonb_array_elements(case
      when jsonb_typeof(p_state#>'{particleGraph,particles}') = 'array'
        then p_state#>'{particleGraph,particles}' else '[]'::jsonb end) as particles(particle)
    where particle->>'type' = 'activity'
      and particle#>>'{data,widget,kind}' = 'event'
      and jsonb_typeof(particle#>'{data,widget,startsAt}') = 'string'
      and particle#>>'{data,widget,startsAt}' <> ''
      and coalesce(particle#>>'{data,source,kind}', '') <> 'calendar_event'
  ) as scheduled;
$$;
revoke all on function public.workspace_particle_calendar_projection(jsonb) from public, anon, authenticated, service_role;

create or replace function public.record_workspace_particle_calendar_revision()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  before_events jsonb := '[]'::jsonb;
  after_events jsonb := '[]'::jsonb;
  affected_orgs uuid[] := '{}'::uuid[];
  target_org uuid;
  -- SECURITY DEFINER changes current_user. The actual SET ROLE/session identity,
  -- unlike auth.role()/JWT claims, cannot be forged by an authenticated caller.
  invoker_role text := coalesce(nullif(current_setting('role', true), 'none'), session_user);
begin
  if tg_op <> 'INSERT' then
    before_events := public.workspace_particle_calendar_projection(old.state);
  end if;
  if tg_op <> 'DELETE' then
    after_events := public.workspace_particle_calendar_projection(new.state);
  end if;

  if tg_op = 'UPDATE' and old.org_id = new.org_id then
    if before_events is distinct from after_events then affected_orgs := array[new.org_id]; end if;
  else
    if tg_op <> 'INSERT' and before_events <> '[]'::jsonb then
      affected_orgs := array_append(affected_orgs, old.org_id);
    end if;
    if tg_op <> 'DELETE' and after_events <> '[]'::jsonb then
      affected_orgs := array_append(affected_orgs, new.org_id);
    end if;
  end if;

  foreach target_org in array affected_orgs loop
    -- Organization deletion cascades through both tables. Never recreate an
    -- invalidation row referencing the organization that just disappeared.
    if not exists (select 1 from public.organizations where user_id = target_org) then continue; end if;
    if invoker_role not in ('service_role', 'postgres') and not coalesce(
      (select auth.uid()) is not null and (
        public.is_admin() or target_org = (select auth.uid()) or exists (
          select 1 from public.organization_memberships om
          join public.organization_access_settings s on s.org_id = om.org_id
          where om.org_id = target_org and om.member_id = (select auth.uid())
            and (om.role = 'admin' or (om.role = 'staff' and s.staff_can_manage_calendar))
        )
      ), false
    ) then
      raise exception using errcode = '42501', message = 'You do not have permission to manage this calendar.';
    end if;
    insert into public.organization_workspace_calendar_revisions(org_id, revision, updated_at)
      values (target_org, 1, clock_timestamp())
      on conflict (org_id) do update
        set revision = public.organization_workspace_calendar_revisions.revision + 1,
            updated_at = excluded.updated_at;
  end loop;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function public.record_workspace_particle_calendar_revision() from public, anon, authenticated, service_role;

drop trigger if exists workspace_particle_calendar_revision on public.organization_workspace_boards;
create trigger workspace_particle_calendar_revision
  after insert or update or delete on public.organization_workspace_boards
  for each row execute function public.record_workspace_particle_calendar_revision();

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables where pubname = 'supabase_realtime'
        and schemaname = 'public' and tablename = 'organization_workspace_calendar_revisions'
    ) then
    alter publication supabase_realtime add table public.organization_workspace_calendar_revisions;
  end if;
end $$;
