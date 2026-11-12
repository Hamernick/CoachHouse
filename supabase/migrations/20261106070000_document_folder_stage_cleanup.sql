-- Exact abandoned Save cleanup. Does not enable private-file purge or placement.
begin;

-- Operation ownership authorizes cancellation, never renewed document access.
-- A current folder editor with the existing parent cleanup authority can finish
-- already-abandoned work, but cannot cancel another actor's live reservation.
create function public.document_folder_stage_cleanup_paths(p_file uuid,p_request uuid,p_cancel boolean)
returns text[] language plpgsql security definer set search_path='' as $$
declare op public.document_version_operations%rowtype; actor uuid; paths text[];
begin
  actor:=public.organization_activity_actor_id();
  if auth.role() is distinct from 'service_role' or actor is null then
    raise exception 'Verified document cleanup actor required.' using errcode='42501'; end if;
  if current_setting('transaction_isolation')<>'read committed' then
    raise exception 'Document permission changed; retry.' using errcode='40001'; end if;
  select * into op from public.document_version_operations where file_id=p_file and request_id=p_request;
  if not found then raise exception 'Document stage unavailable.' using errcode='42501'; end if;
  if not pg_try_advisory_xact_lock(hashtextextended(op.org_id::text,141600)) then
    raise exception 'Document operation is busy; retry unchanged.' using errcode='40001'; end if;
  select * into op from public.document_version_operations where file_id=p_file and request_id=p_request for share nowait;
  if not found or (p_cancel and op.state not in ('staged','abandoned'))
    or (not p_cancel and op.state not in ('abandoned','cleaned')) then
    raise exception 'Document stage is not eligible for cleanup.' using errcode='42501'; end if;
  if actor is distinct from op.actor_id then
    if p_cancel then raise exception 'Only the saving actor can cancel this stage.' using errcode='42501'; end if;
    perform public.assert_document_file_folder_edit(p_file,actor);
    perform public.assert_document_cleanup_authority(op.org_id,actor,false);
  end if;
  if exists(select 1 from public.document_file_purges where file_id=p_file) then
    raise exception 'Document permanent deletion is reserved.' using errcode='PT409'; end if;
  paths:=array[op.org_id::text||'/library/versions/'||p_file::text||'/'||p_request::text||'.md',
    op.org_id::text||'/library/versions/'||p_file::text||'/'||p_request::text||'-previous.md'];
  -- All canonical native references, not just this file's, must remain intact.
  if exists(select 1 from public.organization_document_files where storage_path=any(paths))
    or exists(select 1 from public.document_file_versions where storage_path=any(paths))
    or exists(select 1 from public.document_version_operations where source_storage_path=any(paths)) then
    raise exception 'Saved document bytes cannot be removed as a stage.' using errcode='42501'; end if;
  return paths;
exception when lock_not_available then
  raise exception 'Document operation is changing; retry.' using errcode='40001';
end;
$$;
revoke all on function public.document_folder_stage_cleanup_paths(uuid,uuid,boolean) from public,anon,authenticated,service_role;

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

-- Preserve existing unbound callers. The bound RPC parameters identify the
-- original operation; only the verified header identifies the current caller.
alter function public.abandon_uploaded_document_version(uuid,uuid,uuid) rename to abandon_uploaded_document_version_before_folder_cleanup;
revoke all on function public.abandon_uploaded_document_version_before_folder_cleanup(uuid,uuid,uuid) from public,anon,authenticated,service_role;
create function public.abandon_uploaded_document_version(p_file_id uuid,p_actor_id uuid,p_request_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare op public.document_version_operations%rowtype;
begin
  if exists(select 1 from public.document_file_folder_authorities where file_id=p_file_id) then
    select * into op from public.document_version_operations where file_id=p_file_id and request_id=p_request_id;
    if not found or op.actor_id is distinct from p_actor_id or op.state in ('committed','cleaned') then return false; end if;
    perform public.document_folder_stage_cleanup_paths(p_file_id,p_request_id,true);
  end if;
  return public.abandon_uploaded_document_version_before_folder_cleanup(p_file_id,p_actor_id,p_request_id);
end;
$$;
revoke all on function public.abandon_uploaded_document_version(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.abandon_uploaded_document_version(uuid,uuid,uuid) to service_role;

alter function public.finish_abandoned_document_version(uuid,uuid,uuid) rename to finish_abandoned_document_version_before_folder_cleanup;
revoke all on function public.finish_abandoned_document_version_before_folder_cleanup(uuid,uuid,uuid) from public,anon,authenticated,service_role;
create function public.finish_abandoned_document_version(p_file_id uuid,p_actor_id uuid,p_request_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare op public.document_version_operations%rowtype;
begin
  if exists(select 1 from public.document_file_folder_authorities where file_id=p_file_id) then
    select * into op from public.document_version_operations where file_id=p_file_id and request_id=p_request_id;
    if not found or op.actor_id is distinct from p_actor_id or op.state not in ('abandoned','cleaned') then return false; end if;
    perform public.document_folder_stage_cleanup_paths(p_file_id,p_request_id,false);
  end if;
  return public.finish_abandoned_document_version_before_folder_cleanup(p_file_id,p_actor_id,p_request_id);
end;
$$;
revoke all on function public.finish_abandoned_document_version(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.finish_abandoned_document_version(uuid,uuid,uuid) to service_role;

create or replace function public.read_abandoned_document_stages(p_org uuid,p_actor uuid,p_support boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  perform public.assert_document_cleanup_authority(p_org,p_actor,p_support);
  return coalesce((select jsonb_agg(jsonb_build_object('fileId',file_id,'requestId',request_id,'actorId',actor_id,'paths',jsonb_build_array(
    org_id::text||'/library/versions/'||file_id::text||'/'||request_id::text||'.md',
    org_id::text||'/library/versions/'||file_id::text||'/'||request_id::text||'-previous.md')))
  from (select * from public.document_version_operations o where org_id=p_org and state='abandoned'
    and not exists(select 1 from public.document_file_purges p where p.file_id=o.file_id)
    and (not exists(select 1 from public.document_file_folder_authorities a where a.file_id=o.file_id)
      or o.actor_id=p_actor or public.document_file_folder_actor_can(o.file_id,p_actor,'edit'))
    order by created_at,file_id,request_id limit 4 for update) stages),'[]'::jsonb);
end;
$$;
revoke all on function public.read_abandoned_document_stages(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.read_abandoned_document_stages(uuid,uuid,boolean) to service_role;
comment on function public.document_folder_stage_cleanup_paths(uuid,uuid,boolean) is
 'Exact native Save cancellation and abandoned-stage cleanup. Original actor can cancel after revocation; current authorized editors can finish abandoned stages. Verified service actor, operation state, immutable identity, references and serialization required. Does not restore document access or enable private-file purge.';
comment on function public.guard_document_file_folder_storage() is
 'Canonical folder authority for native Storage writes. Only exact own staged Save uploads and exact abandoned-stage cleanup; saved/history/original objects and private-file purge stay protected.';
commit;
