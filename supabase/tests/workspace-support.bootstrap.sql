alter table auth.users add column banned_until timestamptz;
alter table auth.users add column email text;
alter table auth.users add column raw_user_meta_data jsonb;
alter table public.organizations add column public_slug text;
create table public.profiles(id uuid primary key,full_name text);
create table public.platform_staff_members(user_id uuid primary key references auth.users(id),access_level text);
create table public.subscriptions(id uuid primary key,user_id uuid);
create table public.programs(id uuid primary key,user_id uuid);
create schema storage;
create table storage.objects(id uuid primary key,bucket_id text,name text);
create table public.organization_people_tag_members(tag_id uuid);
create table public.organization_people_segment_members(segment_id uuid);
do $$ declare table_name text; begin
 foreach table_name in array array['organization_tasks','organization_task_assignees',
 'organization_project_overview_documents','organization_project_quick_links','organization_people_tags','organization_people_segments',
 'organization_workspace_boards','organization_workspace_objectives','organization_workspace_objective_groups',
 'organization_workspace_objective_steps','organization_workspace_objective_assignees','organization_workspace_objective_links','roadmap_calendar_internal_events'] loop
 execute format('create table public.%I(id uuid primary key,org_id uuid)',table_name);
 end loop;
end $$;
create function public.has_workspace_paid_features(uuid) returns boolean language sql as $$ select false $$;
create function public.native_workspace_document_content(jsonb) returns jsonb language sql as $$ select $1 $$;
create policy document_storage_paid_insert on storage.objects as restrictive for insert to authenticated with check(false);
create policy document_storage_paid_update on storage.objects as restrictive for update to authenticated using(false) with check(false);
create policy document_storage_paid_delete on storage.objects as restrictive for delete to authenticated using(false);
create policy document_library_paid_insert on public.organization_document_files as restrictive for insert to authenticated with check(false);
create policy document_library_paid_update on public.organization_document_files as restrictive for update to authenticated using(false) with check(false);
create policy document_library_paid_delete on public.organization_document_files as restrictive for delete to authenticated using(false);
alter table public.organizations enable row level security;
alter table public.programs enable row level security;
alter table public.organization_document_files enable row level security;
alter table storage.objects enable row level security;
grant usage on schema storage to authenticated;
grant select,insert,update,delete on storage.objects,public.organizations,public.programs,public.organization_document_files to authenticated;
