-- Add canonical folder authority to native Storage mutations. Existing Storage
-- RLS, closure, stage reservation and retained-source guards remain additive.
-- Private placement and destructive cleanup are still disabled.
begin;
create function public.guard_document_file_folder_storage() returns trigger
language plpgsql security definer set search_path='' as $$
declare paths text[]:='{}'; file uuid; actor uuid; stage public.document_version_operations%rowtype;
begin
  if tg_op in ('DELETE','UPDATE') and old.bucket_id='org-documents' then paths:=array_append(paths,old.name); end if;
  if tg_op in ('INSERT','UPDATE') and new.bucket_id='org-documents' then paths:=array_append(paths,new.name); end if;
  if cardinality(paths)=0 then
    if tg_op='DELETE' then return old; end if; return new;
  end if;
  -- Match canonical bytes, immutable history, retained originals and even an
  -- uncreated stage. An inherited alias cannot widen any of these audiences.
  for file in
    select a.file_id from public.document_file_folder_authorities a
    where exists(select 1 from public.organization_document_files f where f.id=a.file_id and
      (f.storage_path=any(paths) or exists(select 1 from unnest(paths) p where
        p like f.org_id::text||'/library/versions/'||f.id::text||'/%')))
      or exists(select 1 from public.document_file_versions v where v.file_id=a.file_id and v.storage_path=any(paths))
      or exists(select 1 from public.document_version_operations o where o.file_id=a.file_id and o.source_storage_path=any(paths))
    order by a.file_id
  loop
    actor:=public.organization_activity_actor_id();
    perform public.assert_document_file_folder_edit(file,actor);
    if tg_op='DELETE' then
      raise exception 'Private file cleanup is not enabled.' using errcode='42501';
    end if;
    if tg_op='UPDATE' and (old.bucket_id is distinct from new.bucket_id or old.name is distinct from new.name) then
      raise exception 'Document source authority cannot change.' using errcode='42501';
    end if;
    if exists(select 1 from public.organization_document_files where id=file and storage_path=new.name)
      or exists(select 1 from public.document_file_versions where file_id=file and storage_path=new.name)
      or exists(select 1 from public.document_version_operations where file_id=file and source_storage_path=new.name) then
      raise exception 'Saved document bytes are immutable; use Save.' using errcode='42501';
    end if;
    -- Only the already-authorized Save's own exact stage can receive bytes.
    select o.* into stage from public.document_version_operations o
    where o.file_id=file and new.name in(
      o.org_id::text||'/library/versions/'||file::text||'/'||o.request_id::text||'.md',
      o.org_id::text||'/library/versions/'||file::text||'/'||o.request_id::text||'-previous.md')
    for share nowait;
    if not found or stage.state<>'staged' or stage.actor_id is distinct from actor
      or not public.document_version_actor_can_edit(file,actor) then
      raise exception 'Document stage is no longer available.' using errcode='42501';
    end if;
  end loop;
  if tg_op='DELETE' then return old; end if; return new;
exception when lock_not_available then
  raise exception 'Document permission is changing; retry.' using errcode='40001';
end;
$$;
revoke all on function public.guard_document_file_folder_storage() from public,anon,authenticated,service_role;
create trigger document_folder_storage_write before insert or update or delete on storage.objects
for each row execute function public.guard_document_file_folder_storage();
comment on function public.guard_document_file_folder_storage() is
 'Additive canonical native-file folder authority for Storage mutation, including service callers. Only exact own staged Save bytes may be written; canonical/history originals cannot be overwritten or renamed. Bound deletes fail closed pending cleanup qualification. No private placement activation.';
commit;
