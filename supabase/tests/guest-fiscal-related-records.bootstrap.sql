-- Minimal ancillary-table shapes, with deliberately permissive host access.
-- The real restrictive migration must intersect these legacy policies.
create schema storage;
grant usage on schema storage to authenticated,service_role;
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
alter table storage.objects enable row level security;
grant select,insert,update,delete on storage.objects to authenticated;
create policy test_storage_access on storage.objects for all to authenticated using(true) with check(true);
alter table public.fiscal_sponsorship_documents add column storage_bucket text,add column storage_path text;
do $$ declare relation text; begin
 foreach relation in array array['organization_tasks','organization_project_notes','organization_project_quick_links',
 'organization_project_assets','organization_project_overview_documents','organization_project_activity_events',
 'platform_admin_project_workstream_states','fiscal_sponsorship_signing_drafts','fiscal_sponsorship_signatures'] loop
  execute format('create table public.%I (id uuid primary key default gen_random_uuid(),project_id uuid, storage_path text)',relation);
  execute format('alter table public.%I enable row level security',relation);
  execute format('grant select,insert,update,delete on public.%I to authenticated',relation);
  execute format('create policy test_host_access on public.%I for all to authenticated using(true) with check(true)',relation);
 end loop;
end $$;
