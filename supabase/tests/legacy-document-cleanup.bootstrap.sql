-- Data dependencies for the real quota/cleanup authority functions below.
alter table public.profiles add column role text;
alter table auth.users add column banned_until timestamptz;
create table public.platform_staff_members(user_id uuid,access_level text,can_access_unassigned_organizations boolean);
create table public.workspace_support_grants(user_id uuid,revoked_at timestamptz);
create table public.organization_coach_scope_settings(id boolean,assigned_only_enabled boolean);
create table public.organization_coach_assignments(organization_id uuid,coach_user_id uuid);
alter table public.document_file_versions add column org_id uuid,add column size_bytes bigint;
alter table public.document_version_operations add column org_id uuid,add column source_size_bytes bigint;

-- Folder transitions remain disabled for legacy files. A controlled revocation
-- dependency verifies the cleanup owner invokes this additional boundary.
create function public.document_file_folder_actor_can(uuid,uuid,text) returns boolean
language sql stable as $$select coalesce(current_setting('fixture.folder_denied',true),'')<>'true'$$;
create function public.assert_document_file_folder_edit(uuid,uuid) returns void language plpgsql as $$
begin
  if not public.document_file_folder_actor_can($1,$2,'edit') then
    raise exception 'Folder edit denied.' using errcode='42501';end if;
end $$;
create function public.guard_uploaded_document_organization(p_org uuid) returns void language plpgsql as $$
begin
  if exists(select 1 from public.organization_closures where org_id=p_org and state='closing') then
    raise exception 'Organization closing.' using errcode='42501';end if;
end $$;
