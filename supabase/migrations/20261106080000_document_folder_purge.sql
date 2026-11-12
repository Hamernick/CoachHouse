-- Canonical private-file purge through existing reserve / Storage / finish owners.
-- Private placement and closure-operator cleanup of bound files remain gated.
begin;
alter table public.document_file_purges
  add column folder_project_id uuid,
  add column folder_id uuid,
  add constraint document_purge_folder_pair check((folder_project_id is null)=(folder_id is null));
-- Durable tombstones outlive source/binding rows. No FK: completed cleanup must
-- not prevent later folder/project retirement. Only the existing RPCs write it.
revoke insert,update on public.document_file_purges from service_role;
create function public.guard_document_purge_receipt() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if tg_op<>'UPDATE' or
    (to_jsonb(new)-array['state','completed_at']) is distinct from (to_jsonb(old)-array['state','completed_at']) or
    not (old.state='reserved' and new.state='finishing' and new.completed_at is null or
         old.state='finishing' and new.state='complete' and new.completed_at is not null) then
    raise exception 'Document purge receipt is immutable.' using errcode='42501'; end if;
  return new;
end $$;
revoke all on function public.guard_document_purge_receipt() from public,anon,authenticated,service_role;
create trigger document_purge_receipt_immutable before update or delete on public.document_file_purges
for each row execute function public.guard_document_purge_receipt();
create trigger document_purge_receipt_retained before truncate on public.document_file_purges
for each statement execute function public.guard_document_purge_receipt();

create function public.assert_document_folder_purge(p_file uuid) returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid:=public.organization_activity_actor_id(); receipt public.document_file_purges%rowtype;
  binding public.document_file_folder_authorities%rowtype; organization_id uuid;
begin
  select * into binding from public.document_file_folder_authorities where file_id=p_file;
  select * into receipt from public.document_file_purges where file_id=p_file;
  if binding.file_id is null and receipt.folder_id is null then return; end if;
  if auth.role() is distinct from 'service_role' or actor is null then
    raise exception 'Verified document cleanup actor required.' using errcode='42501'; end if;
  if current_setting('transaction_isolation')<>'read committed' then
    raise exception 'Document permission changed; retry.' using errcode='40001'; end if;
  if binding.file_id is not null then
    select org_id into organization_id from public.organization_projects where id=binding.project_id;
  else organization_id:=receipt.org_id; end if;
  if not pg_try_advisory_xact_lock(hashtextextended(organization_id::text,141600)) then
    raise exception 'Document operation is busy; retry.' using errcode='40001'; end if;
  if binding.file_id is not null then
    perform public.assert_document_file_folder_edit(p_file,actor);
    if receipt.file_id is not null and (receipt.folder_project_id is distinct from binding.project_id
      or receipt.folder_id is distinct from binding.folder_id or receipt.org_id is distinct from organization_id) then
      raise exception 'Document purge authority changed.' using errcode='42501'; end if;
  elsif receipt.state='reserved' then
    raise exception 'Document purge authority unavailable.' using errcode='42501';
  elsif actor<>receipt.org_id then
    -- Replays must not expose frozen private paths after source/binding deletion.
    perform 1 from public.organization_projects where id=receipt.folder_project_id and org_id=receipt.org_id for share nowait;
    if not found then raise exception 'Document purge authority unavailable.' using errcode='42501'; end if;
    perform 1 from public.organization_memberships where org_id=receipt.org_id and member_id=actor for share nowait;
    perform 1 from public.project_asset_folders where project_id=receipt.folder_project_id and id=receipt.folder_id for share nowait;
    perform 1 from public.project_asset_folder_grants where project_id=receipt.folder_project_id and folder_id=receipt.folder_id and member_id=actor for share nowait;
    if not public.project_folder_actor_can(receipt.folder_project_id,receipt.folder_id,actor,'edit') then
      raise exception 'Document editing access required.' using errcode='42501'; end if;
  end if;
  perform public.assert_document_cleanup_authority(organization_id,actor,false);
exception when lock_not_available then
  raise exception 'Document permission is changing; retry.' using errcode='40001';
end $$;
revoke all on function public.assert_document_folder_purge(uuid) from public,anon,authenticated,service_role;

alter function public.freeze_document_file_purge(uuid,uuid,uuid) rename to freeze_document_file_purge_before_folder;
revoke all on function public.freeze_document_file_purge_before_folder(uuid,uuid,uuid) from public,anon,authenticated,service_role;
create function public.freeze_document_file_purge(p_org uuid,p_file uuid,p_actor uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare f public.organization_document_files%rowtype; r public.document_file_purges%rowtype;
 b public.document_file_folder_authorities%rowtype; paths text[];
begin
 perform public.assert_document_folder_purge(p_file);
 select * into r from public.document_file_purges where file_id=p_file for update;
 if found then
   if r.org_id<>p_org then raise exception 'Document unavailable.' using errcode='42501'; end if;
   return jsonb_build_object('fileId',r.file_id,'paths',r.paths,'complete',r.state='complete');
 end if;
 select * into b from public.document_file_folder_authorities where file_id=p_file;
 if not found then return public.freeze_document_file_purge_before_folder(p_org,p_file,p_actor); end if;
 if p_actor is distinct from public.organization_activity_actor_id() then
   raise exception 'Verified document cleanup actor required.' using errcode='42501'; end if;
 select * into f from public.organization_document_files where id=p_file and org_id=p_org and document_kind is null for update;
 if not found or f.deleted_at is null then raise exception 'Move the file to Recently Deleted first.' using errcode='PT409'; end if;
 if exists(select 1 from public.document_version_operations where file_id=p_file and state='committed' and (source_storage_path is null or source_size_bytes is null)) then
   raise exception 'Legacy document source provenance requires reconciliation.' using errcode='PT409'; end if;
 select array_agg(distinct path order by path) into paths from (
   select f.storage_path path
   union select storage_path from public.document_file_versions where file_id=p_file and org_id=p_org
   union select source_storage_path from public.document_version_operations where file_id=p_file and org_id=p_org and state<>'cleaned' and source_storage_path is not null
   union select p_org::text||'/library/versions/'||p_file::text||'/'||request_id::text||'.md' from public.document_version_operations where file_id=p_file and org_id=p_org and state<>'cleaned'
   union select p_org::text||'/library/versions/'||p_file::text||'/'||request_id::text||'-previous.md' from public.document_version_operations where file_id=p_file and org_id=p_org and state<>'cleaned'
 ) owned;
 perform public.assert_closure_document_paths(p_org,p_file,paths);
 -- Reservation itself fences pending uploads/commits. Keep operation states and
 -- quota intact; no broad exception allowing cancellation of another user's Save.
 insert into public.document_file_purges(file_id,org_id,actor_id,paths,folder_project_id,folder_id)
 values(p_file,p_org,p_actor,paths,b.project_id,b.folder_id) returning * into r;
 return jsonb_build_object('fileId',r.file_id,'paths',r.paths,'complete',false);
end $$;
revoke all on function public.freeze_document_file_purge(uuid,uuid,uuid) from public,anon,authenticated,service_role;

alter function public.complete_document_file_purge(uuid,uuid) rename to complete_document_file_purge_before_folder;
revoke all on function public.complete_document_file_purge_before_folder(uuid,uuid) from public,anon,authenticated,service_role;
create function public.complete_document_file_purge(p_org uuid,p_file uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare r public.document_file_purges%rowtype;
begin
 perform public.assert_document_folder_purge(p_file);
 select * into r from public.document_file_purges where file_id=p_file and org_id=p_org;
 if r.folder_id is not null and r.state<>'complete' then
   perform public.assert_closure_document_paths(p_org,p_file,r.paths);
 end if;
 return public.complete_document_file_purge_before_folder(p_org,p_file);
end $$;
revoke all on function public.complete_document_file_purge(uuid,uuid) from public,anon,authenticated,service_role;

create or replace function public.guard_document_file_folder_write() returns trigger
language plpgsql security definer set search_path='' as $$
declare item jsonb; file uuid; old_file uuid; identity_key text; cleanup_paths text[];
begin
  item:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
  if tg_table_name='organization_document_files' then file:=(item->>'id')::uuid;
  elsif tg_table_name='document_collaboration_updates' then
    select file_id into file from public.document_collaboration_rooms where id=(item->>'room_id')::uuid;
  else file:=(item->>'file_id')::uuid; end if;
  if tg_op='UPDATE' then
    if tg_table_name='organization_document_files' then old_file:=old.id;
    elsif tg_table_name='document_collaboration_updates' then
      select file_id into old_file from public.document_collaboration_rooms where id=old.room_id;
    else old_file:=old.file_id; end if;
    if exists(select 1 from public.document_file_folder_authorities where file_id in(file,old_file)) then
      foreach identity_key in array array['id','org_id','file_id','room_id','request_id','sequence','batch_id'] loop
        if to_jsonb(old)->identity_key is distinct from to_jsonb(new)->identity_key then
          raise exception 'Document source authority cannot change.' using errcode='42501'; end if;
      end loop;
    end if;
  end if;
  if exists(select 1 from public.document_file_purges where file_id=file and folder_id is not null and state='finishing') then
    perform public.assert_document_folder_purge(file);
    if exists(select 1 from public.document_file_purges r join storage.objects s on s.bucket_id='org-documents' and s.name=any(r.paths) where r.file_id=file) then
      raise exception 'Document objects remain; retry deletion.' using errcode='PT409'; end if;
    if tg_op='DELETE' or (tg_table_name='document_file_versions' and tg_op='UPDATE'
      and (to_jsonb(new)->>'restored_from') is null and (to_jsonb(old)-'restored_from')=(to_jsonb(new)-'restored_from')) then
      if tg_op='DELETE' then return old; end if; return new;
    end if;
    raise exception 'Document permanent deletion is reserved.' using errcode='PT409';
  end if;
  if not exists(select 1 from public.document_file_folder_authorities where file_id=file) then
    if tg_op='DELETE' then return old; end if; return new;
  end if;
  if tg_table_name='document_version_operations' and tg_op='UPDATE' then
    if old.state in ('staged','abandoned') and new.state='abandoned'
      and (to_jsonb(old)-'state')=(to_jsonb(new)-'state') then
      perform public.document_folder_stage_cleanup_paths(file,old.request_id,true);
      return new;
    end if;
    if old.state='abandoned' and new.state='cleaned' and new.staged_bytes=0
      and (to_jsonb(old)-array['state','staged_bytes'])=(to_jsonb(new)-array['state','staged_bytes']) then
      cleanup_paths:=public.document_folder_stage_cleanup_paths(file,old.request_id,false);
      if exists(select 1 from storage.objects where bucket_id='org-documents' and name=any(cleanup_paths)) then
        raise exception 'Staged document bytes remain.' using errcode='PT409'; end if;
      return new;
    end if;
    if old.state in ('abandoned','cleaned') or new.state in ('abandoned','cleaned') then
      raise exception 'Document cleanup transition is immutable.' using errcode='42501'; end if;
  end if;
  perform public.assert_document_file_folder_edit(file,public.organization_activity_actor_id());
  if tg_op='DELETE' and tg_table_name<>'document_collaboration_updates' then
    raise exception 'Private file cleanup is not enabled.' using errcode='42501'; end if;
  if tg_table_name='organization_document_files' and tg_op='UPDATE' then
    if new.id is distinct from old.id or new.org_id is distinct from old.org_id
      or new.document_kind is not null or new.storage_path not like new.org_id::text||'/library/%' then
      raise exception 'Document source authority cannot change.' using errcode='42501'; end if;
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function public.guard_document_file_folder_write() from public,anon,authenticated,service_role;


create or replace function public.guard_document_file_folder_storage() returns trigger
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
    if tg_op='DELETE' and exists(select 1 from public.document_file_purges r
      where r.file_id=file and r.folder_id is not null and r.state='reserved' and old.name=any(r.paths)) then
      perform public.assert_document_folder_purge(file);
      perform public.assert_closure_document_paths((select org_id from public.document_file_purges where file_id=file),file,
        (select r.paths from public.document_file_purges r where r.file_id=file));
      continue;
    end if;
    if tg_op='DELETE' then
      select o.* into stage from public.document_version_operations o
      where o.file_id=file and old.name in(
        o.org_id::text||'/library/versions/'||file::text||'/'||o.request_id::text||'.md',
        o.org_id::text||'/library/versions/'||file::text||'/'||o.request_id::text||'-previous.md');
      if not found or stage.state<>'abandoned' then
        raise exception 'Only abandoned stage cleanup is enabled.' using errcode='42501'; end if;
      perform public.document_folder_stage_cleanup_paths(file,stage.request_id,false);
      continue;
    end if;
    perform public.assert_document_file_folder_edit(file,actor);
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


revoke all on function public.reserve_document_file_purge(uuid,uuid,uuid,boolean,boolean),
 public.finish_document_file_purge(uuid,uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.reserve_document_file_purge(uuid,uuid,uuid,boolean,boolean),
 public.finish_document_file_purge(uuid,uuid,uuid,boolean) to service_role;
commit;
