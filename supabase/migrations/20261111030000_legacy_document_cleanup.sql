-- Durable outgoing-byte accounting. This does not activate legacy privacy.
begin;

create table public.legacy_document_cleanup (
  storage_path text primary key,
  org_id uuid not null references public.organizations(user_id) on delete cascade,
  file_id uuid not null references public.organization_document_files(id) on delete cascade,
  document_kind text not null,
  size_bytes bigint not null check(size_bytes between 0 and 52428800),
  claimed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  check(completed_at is null or (claimed_at is not null and size_bytes=0))
);
create index legacy_document_cleanup_pending on public.legacy_document_cleanup(org_id,document_kind,created_at)
  where completed_at is null;
alter table public.legacy_document_cleanup enable row level security;
alter table public.legacy_document_cleanup force row level security;
revoke all on public.legacy_document_cleanup from public,anon,authenticated,service_role;
grant select on public.legacy_document_cleanup to service_role;

-- BEFORE INSERT also runs on kind upserts, before quota is checked. The receipt
-- and profile/file changes commit or roll back together. Canonical IDs stay put.
create function public.track_legacy_document_cleanup() returns trigger
language plpgsql security definer set search_path='' as $$
declare previous public.organization_document_files%rowtype;
begin
  if tg_op='DELETE' then
    if exists(select 1 from public.legacy_document_cleanup q join storage.objects o
      on o.bucket_id='org-documents' and o.name=q.storage_path where q.file_id=old.id) then
      raise exception 'Legacy document cleanup remains pending.' using errcode='42501';end if;
    return old;
  end if;
  if new.document_kind is null then return new;end if;
  perform pg_advisory_xact_lock(hashtextextended(new.org_id::text,0));
  if tg_op='UPDATE' then previous:=old;
  else
    select * into previous from public.organization_document_files
      where org_id=new.org_id and document_kind=new.document_kind;
  end if;
  if new.deleted_at is null and exists(select 1 from public.legacy_document_cleanup where storage_path=new.storage_path) then
    raise exception 'Retired document path cannot be reused.' using errcode='42501';
  end if;
  if previous.id is not null and (previous.storage_path is distinct from new.storage_path
    or (previous.deleted_at is null and new.deleted_at is not null)) then
    insert into public.legacy_document_cleanup(storage_path,org_id,file_id,document_kind,size_bytes)
      values(previous.storage_path,previous.org_id,previous.id,previous.document_kind,previous.size_bytes)
      on conflict(storage_path) do nothing;
  end if;
  return new;
end $$;
revoke all on function public.track_legacy_document_cleanup() from public,anon,authenticated,service_role;
create trigger a_legacy_document_cleanup before insert or update or delete on public.organization_document_files
  for each row execute function public.track_legacy_document_cleanup();

-- Recover already-retired exact paths, without inventing historical replacements.
insert into public.legacy_document_cleanup(storage_path,org_id,file_id,document_kind,size_bytes)
select storage_path,org_id,id,document_kind,size_bytes from public.organization_document_files f
where document_kind is not null and deleted_at is not null
  and not exists(select 1 from public.organization_closures c where c.org_id=f.org_id and c.state='closing');

create or replace function public.document_retained_source_bytes(p_org uuid,p_replacing_file uuid default null,p_replacing_path text default null) returns bigint
language plpgsql stable security definer set search_path='' as $$
declare bytes bigint;
begin
 if exists(select 1 from public.document_version_operations where org_id=p_org and state='committed' and (source_storage_path is null or source_size_bytes is null)) then
  raise exception 'Legacy document storage accounting requires reconciliation' using errcode='PT409';end if;
 select coalesce(sum(size),0) into bytes from (
  select o.source_storage_path,max(o.source_size_bytes) size from public.document_version_operations o
  where o.org_id=p_org and o.state='committed' and o.source_storage_path is not null
   and o.source_storage_path is distinct from p_replacing_path
   and not exists(select 1 from public.organization_document_files f where f.org_id=p_org and f.id is distinct from p_replacing_file and f.storage_path=o.source_storage_path)
   and not exists(select 1 from public.document_file_versions v where v.org_id=p_org and v.storage_path=o.source_storage_path)
  group by o.source_storage_path
 ) retained;
 return bytes+coalesce((select sum(q.size_bytes) from public.legacy_document_cleanup q
  where q.org_id=p_org and q.completed_at is null and q.storage_path is distinct from p_replacing_path
    and not exists(select 1 from public.organization_document_files f where f.org_id=p_org
      and f.id is distinct from p_replacing_file and f.storage_path=q.storage_path)
    and not exists(select 1 from public.document_file_versions v where v.storage_path=q.storage_path)
    and not exists(select 1 from public.document_version_operations o where o.source_storage_path=q.storage_path and o.state='committed')),0);
end $$;
revoke all on function public.document_retained_source_bytes(uuid,uuid,text) from public,anon,authenticated,service_role;

-- Count an upsert's outgoing path even though its incoming INSERT UUID differs
-- from the retained canonical UUID. Preserve native history/source accounting.
create or replace function public.enforce_organization_document_storage_quota()
returns trigger language plpgsql security definer set search_path='' as $$
declare current_bytes bigint; history_bytes bigint; replacing_file uuid;
begin
  if tg_op='UPDATE' and new.org_id=old.org_id and new.size_bytes=old.size_bytes
    and new.storage_path=old.storage_path then return new;end if;
  perform pg_advisory_xact_lock(hashtextextended(new.org_id::text,0));
  replacing_file:=new.id;
  if tg_op='INSERT' and new.document_kind is not null then
    select coalesce((select id from public.organization_document_files
      where org_id=new.org_id and document_kind=new.document_kind),new.id) into replacing_file;
  end if;
  select coalesce(sum(f.size_bytes),0) into current_bytes from public.organization_document_files f
    where f.org_id=new.org_id and f.id<>replacing_file;
  select coalesce(sum(v.size_bytes),0) into history_bytes from public.document_file_versions v
    where v.org_id=new.org_id
      and not exists(select 1 from public.organization_document_files f where f.storage_path=v.storage_path and f.id<>replacing_file);
  if current_bytes+history_bytes+new.size_bytes+public.document_retained_source_bytes(new.org_id,replacing_file,new.storage_path)>5368709120 then
    raise exception 'Organization document storage quota exceeded.' using errcode='23514';end if;
  return new;
end $$;

-- Acquire organization first, using NOWAIT to avoid the opposite profile/CAS
-- lock order. Every phase rechecks the existing verified-actor/paid/folder owner.
create function public.assert_legacy_document_cleanup(p_org uuid,p_actor uuid,p_support boolean,p_file uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  perform 1 from public.organizations where user_id=p_org for share nowait;
  if not found then raise exception 'Organization unavailable.' using errcode='42501';end if;
  perform public.assert_document_cleanup_authority(p_org,p_actor,p_support);
  perform pg_advisory_xact_lock(hashtextextended(p_org::text,0));
  if not exists(select 1 from public.organization_document_files where id=p_file and org_id=p_org and document_kind is not null) then
    raise exception 'Document unavailable.' using errcode='42501';end if;
  perform public.assert_document_file_folder_edit(p_file,p_actor);
exception when lock_not_available then
  raise exception 'Document changed; retry cleanup.' using errcode='40001';
end $$;

create function public.legacy_document_cleanup_has_reference(p_org uuid,p_path text) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.organizations where user_id=p_org and public.closure_asset_has_reference(profile,p_path))
    or exists(select 1 from public.organization_document_files where storage_path=p_path and deleted_at is null)
    or exists(select 1 from public.document_file_versions where storage_path=p_path)
    or exists(select 1 from public.document_version_operations where source_storage_path=p_path and state='committed');
$$;

create function public.reserve_legacy_document_cleanup(p_org uuid,p_kind text,p_actor uuid,p_support boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare item public.legacy_document_cleanup%rowtype; result jsonb:='[]';
begin
  -- Authorize even an empty queue; do not expose tenant/path metadata on denial.
  perform 1 from public.organizations where user_id=p_org for share nowait;
  perform public.assert_document_cleanup_authority(p_org,p_actor,p_support);
  perform pg_advisory_xact_lock(hashtextextended(p_org::text,0));
  for item in select * from public.legacy_document_cleanup q where q.org_id=p_org
    and (p_kind is null or q.document_kind=p_kind) and q.completed_at is null
    and public.document_file_folder_actor_can(q.file_id,p_actor,'edit')
    and not public.legacy_document_cleanup_has_reference(q.org_id,q.storage_path)
    order by coalesce(q.claimed_at,q.created_at),q.storage_path limit 4 for update
  loop
    perform public.assert_document_file_folder_edit(item.file_id,p_actor);
    update public.legacy_document_cleanup set claimed_at=clock_timestamp() where storage_path=item.storage_path;
    result:=result||jsonb_build_array(jsonb_build_object('path',item.storage_path,'fileId',item.file_id,'kind',item.document_kind));
  end loop;
  return result;
exception when lock_not_available then
  raise exception 'Document changed; retry cleanup.' using errcode='40001';
end $$;

create function public.finish_legacy_document_cleanup(p_org uuid,p_path text,p_actor uuid,p_support boolean default false)
returns boolean language plpgsql security definer set search_path='' as $$
declare item public.legacy_document_cleanup%rowtype;
begin
  select * into item from public.legacy_document_cleanup where org_id=p_org and storage_path=p_path;
  if not found then return false;end if;
  perform public.assert_legacy_document_cleanup(p_org,p_actor,p_support,item.file_id);
  select * into item from public.legacy_document_cleanup where storage_path=p_path for update;
  if item.completed_at is not null then return true;end if;
  if item.claimed_at is null or public.legacy_document_cleanup_has_reference(p_org,p_path)
    or exists(select 1 from storage.objects where bucket_id='org-documents' and name=p_path) then return false;end if;
  update public.organization_document_files set size_bytes=0
    where id=item.file_id and storage_path=p_path and deleted_at is not null and size_bytes<>0;
  update public.legacy_document_cleanup set size_bytes=0,completed_at=clock_timestamp() where storage_path=p_path;
  return true;
end $$;
revoke all on function public.assert_legacy_document_cleanup(uuid,uuid,boolean,uuid),
  public.legacy_document_cleanup_has_reference(uuid,text),
  public.reserve_legacy_document_cleanup(uuid,text,uuid,boolean),
  public.finish_legacy_document_cleanup(uuid,text,uuid,boolean) from public,anon,authenticated,service_role;
grant execute on function public.reserve_legacy_document_cleanup(uuid,text,uuid,boolean),
  public.finish_legacy_document_cleanup(uuid,text,uuid,boolean) to service_role;

-- A successful reservation permanently fences reattachment/recreation. Profile
-- writers take the parent lock; a concurrent claim either waits or loses NOWAIT.
create function public.guard_legacy_cleanup_references() returns trigger
language plpgsql security definer set search_path='' as $$
declare item record; path text;
begin
  if tg_table_name='organizations' then
    if tg_op='DELETE' then
      if exists(select 1 from public.legacy_document_cleanup q join storage.objects o
        on o.bucket_id='org-documents' and o.name=q.storage_path where q.org_id=old.user_id) then
        raise exception 'Legacy document cleanup remains pending.' using errcode='42501';end if;
      return old;
    end if;
    for item in select storage_path from public.legacy_document_cleanup where org_id=new.user_id and claimed_at is not null loop
      if public.closure_asset_has_reference(new.profile,item.storage_path) then
        raise exception 'Document cleanup is reserved.' using errcode='42501';end if;
    end loop;
  else
    path:=case when tg_table_name='document_file_versions' then to_jsonb(new)->>'storage_path' else to_jsonb(new)->>'source_storage_path' end;
    if exists(select 1 from public.legacy_document_cleanup where storage_path=path) then
      raise exception 'Retired legacy document cannot become native history.' using errcode='42501';end if;
  end if;
  return new;
end $$;
revoke all on function public.guard_legacy_cleanup_references() from public,anon,authenticated,service_role;
create trigger legacy_cleanup_references before update of profile or delete on public.organizations
  for each row execute function public.guard_legacy_cleanup_references();
create trigger legacy_cleanup_references before insert or update on public.document_file_versions
  for each row execute function public.guard_legacy_cleanup_references();
create trigger legacy_cleanup_references before insert or update on public.document_version_operations
  for each row execute function public.guard_legacy_cleanup_references();

-- Storage can never recreate a queued path. Deletion is still subject to its
-- existing RLS. The API uses the authenticated client, not service-role removal.
create function public.guard_legacy_cleanup_storage() returns trigger
language plpgsql security definer set search_path='' as $$
declare item public.legacy_document_cleanup%rowtype; path text; bucket text; organization_id uuid;
begin
  if tg_op='DELETE' then path:=old.name;bucket:=old.bucket_id;else path:=new.name;bucket:=new.bucket_id;end if;
  if tg_op='UPDATE' and old.bucket_id='org-documents' and exists(
    select 1 from public.legacy_document_cleanup where storage_path=old.name) then
    raise exception 'Retired document object cannot be moved.' using errcode='42501';end if;
  if bucket='org-documents' and (split_part(path,'/',2)='policies' or exists(select 1 from public.organization_document_files where storage_path=path and document_kind is not null) or exists(select 1 from public.legacy_document_cleanup where storage_path=path)) and split_part(path,'/',1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    organization_id:=split_part(path,'/',1)::uuid;
    -- Serialize before inspecting the queue: an upload begun before retirement
    -- must not recreate its object after cleanup's absence check.
    perform 1 from public.organizations where user_id=organization_id for share nowait;
    if not pg_try_advisory_xact_lock(hashtextextended(organization_id::text,0)) then
      raise exception 'Document changed; retry cleanup.' using errcode='40001';end if;
    select * into item from public.legacy_document_cleanup where storage_path=path;
    if found then
      if tg_op<>'DELETE' then raise exception 'Retired document object cannot be reused.' using errcode='42501';end if;
      perform 1 from public.organizations where user_id=item.org_id for share nowait;
      if item.claimed_at is null or public.legacy_document_cleanup_has_reference(item.org_id,path) then
        raise exception 'Document cleanup is not reserved.' using errcode='42501';end if;
      if auth.role()='service_role' then
        perform public.assert_document_cleanup_authority(item.org_id,public.organization_activity_actor_id(),
          not public.has_workspace_paid_features(item.org_id));
      end if;
      perform public.assert_document_file_folder_edit(item.file_id,public.organization_activity_actor_id());
    end if;
  end if;
  if tg_op='DELETE' then return old;end if;return new;
exception when lock_not_available then
  raise exception 'Document changed; retry cleanup.' using errcode='40001';
end $$;
revoke all on function public.guard_legacy_cleanup_storage() from public,anon,authenticated,service_role;
create trigger legacy_cleanup_storage before insert or update or delete on storage.objects
  for each row execute function public.guard_legacy_cleanup_storage();

commit;
-- Recovery: deploy the previous app only after all pending receipts are drained.
-- Do not drop this ledger or revert quota accounting while outgoing bytes remain.
