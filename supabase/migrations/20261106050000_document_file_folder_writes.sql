-- Add folder authority to the existing native-file edit/save owners. This does
-- not enable private placement, purge or direct Storage mutation.
begin;

-- Acquire the actual authority rows, then check a fresh READ COMMITTED snapshot.
-- NOWAIT avoids reversing the existing document/project/closure lock orders.
-- A revocation already underway wins; otherwise it waits for the admitted write.
create function public.assert_document_file_folder_edit(p_file uuid,p_actor uuid) returns void
language plpgsql security definer set search_path='' as $$
declare binding public.document_file_folder_authorities%rowtype; organization_id uuid;
begin
  select * into binding from public.document_file_folder_authorities where file_id=p_file for share nowait;
  if not found then return; end if;
  if current_setting('transaction_isolation')<>'read committed' then
    raise exception 'Document permission changed; retry.' using errcode='40001'; end if;
  if p_actor is null or p_actor is distinct from public.organization_activity_actor_id() then
    raise exception 'Verified document actor required.' using errcode='42501'; end if;
  select org_id into organization_id from public.organization_projects where id=binding.project_id for share nowait;
  perform 1 from public.organization_memberships where org_id=organization_id and member_id=p_actor for share nowait;
  perform 1 from public.project_asset_folders where project_id=binding.project_id and id=binding.folder_id for share nowait;
  perform 1 from public.project_asset_folder_grants where project_id=binding.project_id and folder_id=binding.folder_id
    and member_id=p_actor for share nowait;
  if not public.document_file_folder_actor_can(p_file,p_actor,'edit') then
    raise exception 'Document editing access required.' using errcode='42501'; end if;
exception when lock_not_available then
  raise exception 'Document permission is changing; retry.' using errcode='40001';
end;
$$;
revoke all on function public.assert_document_file_folder_edit(uuid,uuid) from public,anon,authenticated,service_role;

-- Keep every existing organization, entitlement and closure rule in place.
alter function public.can_edit_uploaded_document(uuid) rename to can_edit_uploaded_document_before_folder;
revoke all on function public.can_edit_uploaded_document_before_folder(uuid) from public,anon,authenticated,service_role;
create function public.can_edit_uploaded_document(p_file_id uuid) returns boolean
language plpgsql security definer set search_path='' as $$
begin
  return public.document_file_folder_actor_can(p_file_id,(select auth.uid()),'edit')
    and public.can_edit_uploaded_document_before_folder(p_file_id);
end;
$$;
revoke all on function public.can_edit_uploaded_document(uuid) from public,anon,authenticated,service_role;
grant execute on function public.can_edit_uploaded_document(uuid) to authenticated;

alter function public.document_version_actor_can_edit(uuid,uuid) rename to document_version_actor_can_edit_before_folder;
revoke all on function public.document_version_actor_can_edit_before_folder(uuid,uuid) from public,anon,authenticated,service_role;
create function public.document_version_actor_can_edit(p_file_id uuid,p_actor_id uuid) returns boolean
language plpgsql security definer set search_path='' as $$
begin
  perform public.assert_document_file_folder_edit(p_file_id,p_actor_id);
  return public.document_version_actor_can_edit_before_folder(p_file_id,p_actor_id);
end;
$$;
revoke all on function public.document_version_actor_can_edit(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.document_version_actor_can_edit(uuid,uuid) to service_role;

-- Initialization may return an existing room without writing a row.
alter function public.initialize_document_room(uuid,uuid,text,timestamptz,text) rename to initialize_document_room_before_folder;
revoke all on function public.initialize_document_room_before_folder(uuid,uuid,text,timestamptz,text) from public,anon,authenticated,service_role;
create function public.initialize_document_room(p_file_id uuid,p_actor_id uuid,p_base_revision text,p_expected_updated_at timestamptz,p_checkpoint_base64 text)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  perform public.assert_document_file_folder_edit(p_file_id,p_actor_id);
  return public.initialize_document_room_before_folder(p_file_id,p_actor_id,p_base_revision,p_expected_updated_at,p_checkpoint_base64);
end;
$$;
revoke all on function public.initialize_document_room(uuid,uuid,text,timestamptz,text) from public,anon,authenticated;
grant execute on function public.initialize_document_room(uuid,uuid,text,timestamptz,text) to service_role;

-- Covers elevated initialization/compaction as well as direct metadata writes,
-- working updates, version restoration and canonical save finalization. Parent
-- owners/RLS still authorize the operation; this trigger only narrows authority.
create function public.guard_document_file_folder_write() returns trigger
language plpgsql security definer set search_path='' as $$
declare item jsonb; file uuid; old_file uuid; identity_key text;
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
create trigger document_folder_write before insert or update or delete on public.organization_document_files
for each row execute function public.guard_document_file_folder_write();
create trigger document_folder_write before insert or update or delete on public.document_collaboration_rooms
for each row execute function public.guard_document_file_folder_write();
create trigger document_folder_write before insert or update or delete on public.document_collaboration_updates
for each row execute function public.guard_document_file_folder_write();
create trigger document_folder_write before insert or update or delete on public.document_file_versions
for each row execute function public.guard_document_file_folder_write();
create trigger document_folder_write before insert or update or delete on public.document_version_operations
for each row execute function public.guard_document_file_folder_write();

comment on function public.assert_document_file_folder_edit(uuid,uuid) is
  'Additive verified-actor native write boundary. Serializes with folder grants and membership revocation. Does not enable private placement, Storage mutation or purge.';
commit;
