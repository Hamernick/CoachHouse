-- Canonical uploaded-document effects; Storage/provider shutdown is separate.
begin;
create function public.guard_uploaded_document_organization(p_org uuid) returns void
 language plpgsql security definer set search_path='' as $$
begin
 if current_setting('transaction_isolation')<>'read committed' then
   raise exception 'Closure boundary requires read committed isolation' using errcode='40001'; end if;
 begin
   perform 1 from public.organizations where user_id=p_org for share nowait;
   if not found then raise exception 'Organization unavailable' using errcode='42501'; end if;
 exception when lock_not_available then
   raise exception 'Organization is changing; retry document edit' using errcode='40001';
 end;
 perform public.guard_organization_closure(p_org);
end; $$;
revoke all on function public.guard_uploaded_document_organization(uuid) from public,anon,authenticated,service_role;

create function public.guard_uploaded_document_closure() returns trigger
 language plpgsql security definer set search_path='' as $$
declare row_data jsonb; old_data jsonb; org uuid; key text;
begin
 row_data:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 if tg_op='UPDATE' then
   old_data:=to_jsonb(old);
   foreach key in array array['org_id','id','file_id','room_id','request_id','sequence','batch_id'] loop
     if row_data->key is distinct from old_data->key then
       raise exception 'Document identity cannot change' using errcode='42501'; end if;
   end loop;
   -- Narrow, irreversible staging cancellation remains available under closure.
   -- Existing service-only RPCs/ACLs own authorization and Storage cleanup.
   if tg_table_name='document_version_operations' then
     if old.state in ('staged','abandoned') and new.state='abandoned'
       and (old_data-'state')=(row_data-'state') then return new; end if;
     if old.state='abandoned' and new.state='cleaned' and new.staged_bytes=0
       and (old_data-array['state','staged_bytes'])=(row_data-array['state','staged_bytes']) then return new; end if;
   end if;
 end if;
 if current_setting('transaction_isolation')<>'read committed' then
   raise exception 'Closure boundary requires read committed isolation' using errcode='40001'; end if;
 if tg_table_name='document_collaboration_updates' then
   select org_id into org from public.document_collaboration_rooms where id=(row_data->>'room_id')::uuid;
   if org is null then
     -- Only a nested, already-admitted parent cascade may remove orphaned tails.
     if tg_op='DELETE' and pg_trigger_depth()>1 then return old; end if;
     raise exception 'Document unavailable' using errcode='42501'; end if;
 else
   org:=(row_data->>'org_id')::uuid;
 end if;
 if tg_op='DELETE' and not exists(select 1 from public.organizations where user_id=org) then return old; end if;
 perform public.guard_uploaded_document_organization(org);
 if tg_op='DELETE' then return old; end if;
 return new;
end; $$;
revoke all on function public.guard_uploaded_document_closure() from public,anon,authenticated,service_role;
create trigger document_closure before insert or update or delete on public.organization_document_files
 for each row execute function public.guard_uploaded_document_closure();
create trigger document_closure before insert or update or delete on public.document_collaboration_rooms
 for each row execute function public.guard_uploaded_document_closure();
create trigger document_closure before insert or update or delete on public.document_collaboration_updates
 for each row execute function public.guard_uploaded_document_closure();
create trigger document_closure before insert or update or delete on public.document_file_versions
 for each row execute function public.guard_uploaded_document_closure();
create trigger document_closure before insert or update or delete on public.document_version_operations
 for each row execute function public.guard_uploaded_document_closure();

-- Even an exact reservation replay can authorize a new Storage request without
-- writing a row. Fence that admission before calling the existing implementation.
alter function public.reserve_uploaded_document_version(uuid,uuid,uuid,uuid,text,timestamptz,bigint,text,text,bigint,uuid)
 rename to reserve_uploaded_document_version_pre_closure;
revoke all on function public.reserve_uploaded_document_version_pre_closure(uuid,uuid,uuid,uuid,text,timestamptz,bigint,text,text,bigint,uuid)
 from public,anon,authenticated,service_role;
create function public.reserve_uploaded_document_version(
 p_file_id uuid,p_actor_id uuid,p_request_id uuid,p_generation uuid,
 p_expected_revision text,p_expected_updated_at timestamptz,p_sequence bigint,
 p_previous_hash text,p_new_hash text,p_new_size bigint,p_restore_version_id uuid default null
) returns boolean language plpgsql security definer set search_path='' as $$
declare org uuid;
begin
 select org_id into org from public.organization_document_files where id=p_file_id;
 perform public.guard_uploaded_document_organization(org);
 return public.reserve_uploaded_document_version_pre_closure(p_file_id,p_actor_id,p_request_id,p_generation,
   p_expected_revision,p_expected_updated_at,p_sequence,p_previous_hash,p_new_hash,p_new_size,p_restore_version_id);
end; $$;
revoke all on function public.reserve_uploaded_document_version(uuid,uuid,uuid,uuid,text,timestamptz,bigint,text,text,bigint,uuid)
 from public,anon,authenticated;
grant execute on function public.reserve_uploaded_document_version(uuid,uuid,uuid,uuid,text,timestamptz,bigint,text,text,bigint,uuid) to service_role;
comment on function public.guard_uploaded_document_closure() is
 'Serializes uploaded file, collaboration, history and save-operation writes with closure. Exact staged-save cancellation remains; existing RLS/restrictive history FKs remain. No private-read, Storage, provider, purge or lifecycle authority is granted.';
commit;
