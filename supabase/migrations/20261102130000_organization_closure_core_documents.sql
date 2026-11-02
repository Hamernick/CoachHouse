-- Core document recovery state joins the existing canonical profile fence.
begin;
create function public.guard_core_document_closure() returns trigger
 language plpgsql security definer set search_path='' as $$
declare row_data jsonb; old_data jsonb; org uuid; key text;
begin
 -- Leaving/expiring ephemeral presence clears participation, not document history.
 -- The existing service-only ACL and authenticated server owner remain unchanged.
 if tg_op='DELETE' and tg_table_name='organization_core_document_presence' then return old; end if;
 row_data:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 org:=(row_data->>'org_id')::uuid;
 if tg_op='UPDATE' then
   old_data:=to_jsonb(old);
   foreach key in array array['org_id','id','section_id','session_id'] loop
     if row_data->key is distinct from old_data->key then
       raise exception 'Core document identity cannot change' using errcode='42501'; end if;
   end loop;
   if tg_table_name='organization_core_document_presence' and row_data->'actor_id' is distinct from old_data->'actor_id' then
     raise exception 'Core document identity cannot change' using errcode='42501'; end if;
   -- History remains intact when a separate login is actually deleted.
   if tg_table_name='organization_core_document_versions' and pg_trigger_depth()>1
     and old_data->>'actor_id' is not null and row_data->>'actor_id' is null
     and (old_data-'actor_id')=(row_data-'actor_id')
     and not exists(select 1 from auth.users where id=(old_data->>'actor_id')::uuid) then return new; end if;
 end if;
 if current_setting('transaction_isolation')<>'read committed' then
   raise exception 'Closure boundary requires read committed isolation' using errcode='40001'; end if;
 if tg_op='DELETE' and not exists(select 1 from public.organizations where user_id=org) then return old; end if;
 -- Direct session/history writers may already hold tuples. The real commit RPC
 -- owns organization UPDATE first; NOWAIT avoids reversing that lock order.
 perform public.guard_uploaded_document_organization(org);
 if tg_op='DELETE' then return old; end if;
 return new;
end; $$;
revoke all on function public.guard_core_document_closure() from public,anon,authenticated,service_role;
create trigger core_document_closure before insert or update or delete on public.organization_core_document_versions
 for each row execute function public.guard_core_document_closure();
create trigger core_document_closure before insert or update or delete on public.organization_core_document_sessions
 for each row execute function public.guard_core_document_closure();
create trigger core_document_closure before insert or update or delete on public.organization_core_document_presence
 for each row execute function public.guard_core_document_closure();
comment on function public.guard_core_document_closure() is
 'Fences core history, collaboration sessions and presence admission with closure, including profile/history/session commit effects. Exact account attribution cleanup and presence departure remain. No private-read, provider, purge or lifecycle authority is granted.';
commit;
