create role anon;
create role authenticated;
create schema auth;
create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create table public.organizations(user_id uuid primary key, profile jsonb);
create table public.organization_projects(id uuid primary key, org_id uuid references public.organizations(user_id) on delete cascade);
create table public.organization_document_files(id uuid primary key, org_id uuid references public.organizations(user_id) on delete cascade, name text, document_kind text, deleted_at timestamptz, updated_at timestamptz);
create table public.organization_external_documents(id uuid primary key, org_id uuid references public.organizations(user_id) on delete cascade, name text, status text, modified_at timestamptz, updated_at timestamptz);
create table public.organization_project_assets(id uuid primary key, org_id uuid references public.organizations(user_id) on delete cascade, project_id uuid references public.organization_projects(id) on delete cascade, name text);
create table public.organization_project_activity_events (
 id uuid primary key default gen_random_uuid(), org_id uuid references public.organizations(user_id) on delete cascade, project_id uuid references public.organization_projects(id) on delete cascade,
 entity_type text, entity_id uuid, event_type text, title text, from_status text, to_status text, actor_id uuid, metadata jsonb, occurred_at timestamptz default now(),
 constraint organization_project_activity_events_entity_type_check check(entity_type in ('project','task','program','fiscal_application')),
 constraint organization_project_activity_events_event_type_check check(event_type in ('created','status_changed','scheduled','published','completed','updated'))
);
alter table public.organization_project_activity_events enable row level security;
create table public.organization_memberships (org_id uuid, member_id uuid);
create function public.is_admin() returns boolean language sql as $$ select false $$;
grant select on public.organization_memberships to authenticated;
create policy "organization_project_activity_events_select"
  on public.organization_project_activity_events
  for select to authenticated
  using (
    (select public.is_admin())
    or org_id = (select auth.uid())
    or exists (
      select 1
      from public.organization_memberships as membership
      where membership.org_id = organization_project_activity_events.org_id
        and membership.member_id = (select auth.uid())
    )
  );


grant usage on schema public, auth to authenticated;
grant select on public.organization_project_activity_events to authenticated;
