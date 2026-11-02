-- Organization-owned references only. Shared connections and provider files remain separate.
begin;
create function public.guard_external_document_closure() returns trigger
 language plpgsql security definer set search_path='' as $$
declare row_data jsonb; old_data jsonb; key text;
begin
 if tg_op='UPDATE' then
   row_data:=to_jsonb(new); old_data:=to_jsonb(old);
   foreach key in array array['org_id','id','provider','provider_file_id'] loop
     if row_data->key is distinct from old_data->key then
       raise exception 'External document identity cannot change' using errcode='42501'; end if;
   end loop;
   -- Exact FK attribution cleanup must not block a separate account deletion.
   if pg_trigger_depth()>1 and old.attached_by is not null and new.attached_by is null
     and (old_data-array['attached_by','updated_at'])=(row_data-array['attached_by','updated_at'])
     and not exists(select 1 from public.profiles where id=old.attached_by) then return new; end if;
   -- A connection deletion's actual FK nullification owns its unavailable marker.
   -- No BEFORE DELETE update is needed while the connected parent still exists.
   if pg_trigger_depth()>1 and old.connection_id is not null and new.connection_id is null
     and (old_data-array['connection_id','updated_at'])=(row_data-array['connection_id','updated_at'])
     and not exists(select 1 from public.google_drive_connections where id=old.connection_id) then
     new.status:='needs_reconnect'; new.last_verified_at:=now(); return new;
   end if;
   -- The existing connection status trigger contracts access after revocation.
   -- Require a non-connected parent and only the fields that trigger owns.
   if pg_trigger_depth()>1 and old.connection_id is not null
     and new.status='needs_reconnect'
     and (old_data-array['status','last_verified_at','updated_at'])=(row_data-array['status','last_verified_at','updated_at'])
     and exists(select 1 from public.google_drive_connections where id=old.connection_id and status<>'connected') then return new; end if;
 end if;
 if current_setting('transaction_isolation')<>'read committed' then
   raise exception 'Closure boundary requires read committed isolation' using errcode='40001'; end if;
 if tg_op='DELETE' then
   if not exists(select 1 from public.organizations where user_id=old.org_id) then return old; end if;
   perform public.guard_uploaded_document_organization(old.org_id);
   return old;
 end if;
 perform public.guard_uploaded_document_organization(new.org_id);
 return new;
end; $$;
revoke all on function public.guard_external_document_closure() from public,anon,authenticated,service_role;
create trigger external_document_closure before insert or update or delete on public.organization_external_documents
 for each row execute function public.guard_external_document_closure();
-- The FK cleanup above retains the existing needs_reconnect result atomically,
-- without an unverifiable exception for writes before a connected parent's deletion.
drop trigger google_drive_connection_delete_documents on public.google_drive_connections;
comment on function public.guard_external_document_closure() is
 'Fences organization external-reference writes with closure. Exact nested attribution/connection FK cleanup and shared-connection revocation remain; reconnect never restores references automatically. No provider file, private-read, purge or lifecycle authority is granted.';
commit;
