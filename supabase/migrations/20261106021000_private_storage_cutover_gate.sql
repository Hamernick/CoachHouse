-- Staging and hosted apps share a database. Install the new read boundary
-- without cutting off deployments that still use session Storage readers.
-- Enable an organization only after ALL its app consumers use the authorized
-- server readers and its legacy URL/cache cutover has been qualified.
begin;

create table public.organization_private_storage_cutovers (
  org_id uuid primary key references public.organizations(user_id) on delete cascade,
  enabled_at timestamptz not null default now()
);
alter table public.organization_private_storage_cutovers enable row level security;
alter table public.organization_private_storage_cutovers force row level security;
revoke all on public.organization_private_storage_cutovers from public, anon, authenticated;
grant select, insert, delete on public.organization_private_storage_cutovers to service_role;

create function public.private_storage_app_reads_enabled(p_name text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.organization_private_storage_cutovers
    where org_id::text = split_part(p_name, '/', 1)
  );
$$;
revoke all on function public.private_storage_app_reads_enabled(text) from public;
grant execute on function public.private_storage_app_reads_enabled(text) to anon, authenticated, service_role;

alter policy private_files_app_read_boundary on storage.objects using (
  bucket_id not in ('org-documents', 'project-assets')
  or not public.private_storage_app_reads_enabled(name)
  or storage.allow_any_operation(array[
    'object.upload', 'object.upload_update', 'object.delete', 'object.delete_many'
  ])
);

-- Intentionally no enabled organizations. This is a deployment/cutover switch,
-- never an end-user privacy control or a substitute for source authorization.
commit;
