-- Project overview content is canonical even when saved without project metadata.
begin;
create function public.guard_project_overview_closure() returns trigger
 language plpgsql security definer set search_path='' as $$
declare org uuid; actor_key text;
begin
 org:=case when tg_op='DELETE' then old.org_id else new.org_id end;
 if tg_op='UPDATE' then
   if new.org_id is distinct from old.org_id or new.id is distinct from old.id
     or new.project_id is distinct from old.project_id then
     raise exception 'Project overview identity cannot change' using errcode='42501'; end if;
   -- Each FK nullification is its own UPDATE. Neither trigger depth alone nor a
   -- missing actor permits content changes or broader attribution cleanup.
   foreach actor_key in array array['created_by','updated_by'] loop
     if pg_trigger_depth()>1 and to_jsonb(old)->>actor_key is not null and to_jsonb(new)->>actor_key is null
       and (to_jsonb(old)-array[actor_key,'updated_at'])=(to_jsonb(new)-array[actor_key,'updated_at'])
       and not exists(select 1 from public.profiles where id=(to_jsonb(old)->>actor_key)::uuid) then return new; end if;
   end loop;
 end if;
 if current_setting('transaction_isolation')<>'read committed' then
   raise exception 'Closure boundary requires read committed isolation' using errcode='40001'; end if;
 if tg_op='DELETE' and not exists(select 1 from public.organizations where user_id=org) then return old; end if;
 -- A project cascade must still join this fence: project writers are qualified
 -- separately. Only an already-admitted organization deletion may bypass it.
 perform public.guard_uploaded_document_organization(org);
 if tg_op='DELETE' then return old; end if;
 return new;
end; $$;
revoke all on function public.guard_project_overview_closure() from public,anon,authenticated,service_role;
create trigger project_overview_closure before insert or update or delete on public.organization_project_overview_documents
 for each row execute function public.guard_project_overview_closure();
comment on function public.guard_project_overview_closure() is
 'Serializes project overview CRUD and dependent atomic saves with closure. Preserves exact profile attribution cleanup, existing access policies and revisions; does not grant read, purge or lifecycle authority.';
commit;
