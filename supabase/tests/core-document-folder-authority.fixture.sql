-- Controlled folder table prerequisites for the actual folder permission
-- functions. Canonical core commits, lineage readers and history are real.
alter role service_role bypassrls;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('fixture.actor',true),'')::uuid$$;
grant usage on schema auth to authenticated;
alter table public.organization_memberships add column created_at timestamptz not null default now();
create table public.organization_projects(id uuid primary key,org_id uuid references public.organizations(user_id));
create table public.project_asset_folders(project_id uuid references public.organization_projects(id),id uuid,
 audience text,created_by uuid,creator_membership_created_at timestamptz,primary key(project_id,id));
create table public.project_asset_folder_grants(project_id uuid,folder_id uuid,member_id uuid,capability text,membership_created_at timestamptz);
create table public.workspace_source_audiences(org_id uuid,canvas_id text);
create table public.workspace_source_audience_members(org_id uuid,canvas_id text,member_id uuid,membership_created_at timestamptz,capability text);
create table public.project_folder_workspace_grants(project_id uuid,folder_id uuid,org_id uuid,canvas_id text,capability text);
create table public.organization_workspace_boards(org_id uuid,state jsonb);
-- Permissive base access isolates the new restrictive raw-profile gate; actual
-- parent raw-profile policies were qualified separately. No production claim.
alter table public.organizations enable row level security;
create policy fixture_profile_read on public.organizations for select to authenticated using(true);
create policy fixture_profile_write on public.organizations for update to authenticated using(true) with check(true);
