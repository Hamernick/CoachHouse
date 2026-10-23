-- Isolated prerequisites for the public intake RPC; existing fiscal RLS fixture
-- supplies auth.uid() and database roles. No external database is contacted.
create table public.profiles (id uuid primary key);
create table public.organizations (
  user_id uuid primary key references public.profiles(id),
  profile jsonb not null default '{}',
  is_public boolean not null default false
);
create table public.organization_projects (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(user_id),
  project_kind text not null check(project_kind in ('standard', 'organization_admin')),
  name text not null,
  created_source text not null check(created_source in ('system','user','starter_seed')),
  starter_seed_key text,
  created_by uuid not null references public.profiles(id),
  updated_by uuid references public.profiles(id),
  option_settings jsonb,
  unique(org_id, starter_seed_key)
);
alter table public.organizations enable row level security;
alter table public.organization_projects enable row level security;
grant select on public.organizations, public.organization_projects to authenticated;
create policy owner_read on public.organizations for select to authenticated using(user_id = auth.uid());

insert into public.profiles values ('10000000-0000-0000-0000-000000000001'), ('10000000-0000-0000-0000-000000000002');
insert into public.organizations values ('10000000-0000-0000-0000-000000000002', '{"name":"Preserved","mission":"Keep this"}', true);

-- Exercise the actual paid Workspace migration before the intake exception.
create table public.subscriptions(user_id uuid, status text, stripe_subscription_id text, metadata jsonb);
create table public.organization_workspace_starter_state(org_id uuid);
create table public.organization_tasks(org_id uuid);
create table public.organization_task_assignees(org_id uuid);
create table public.organization_project_notes(org_id uuid);
create table public.organization_project_quick_links(org_id uuid);
create table public.organization_project_assets(id uuid default gen_random_uuid(), org_id uuid, project_id uuid, name text);
create schema storage;
create table storage.objects(id uuid default gen_random_uuid(), bucket_id text, name text);
alter table public.organization_project_assets enable row level security;
alter table storage.objects enable row level security;
grant usage on schema storage to authenticated;
grant select, insert, update, delete on storage.objects, public.organization_projects, public.organization_project_assets to authenticated;
