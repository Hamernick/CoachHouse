-- Fence canonical project/task/program writes, including atomic moves/recurrence.
begin;
create function public.guard_project_task_closure() returns trigger
 language plpgsql security definer set search_path='' as $$
declare old_org uuid; new_org uuid; org uuid; key text; scope_key text;
begin
 if tg_table_name='task_tracker_import_records' then
   if tg_op='UPDATE' and (to_jsonb(new)-array['source_row','source_payload','disposition','reason','destination_id','destination_version'])
     is distinct from (to_jsonb(old)-array['source_row','source_payload','disposition','reason','destination_id','destination_version']) then
     raise exception 'Tracker import identity cannot change' using errcode='42501'; end if;
   select org_id into org from public.task_tracker_import_batches
     where id=case when tg_op='DELETE' then old.batch_id else new.batch_id end;
   if org is null then raise exception 'Tracker import owner unavailable' using errcode='42501'; end if;
   perform public.guard_uploaded_document_organization(org);
   if tg_op='DELETE' then return old; end if;
   return new;
 end if;
 scope_key:=case when tg_table_name='programs' then 'user_id' else 'org_id' end;
 if tg_op<>'INSERT' then old_org:=(to_jsonb(old)->>scope_key)::uuid; end if;
 if tg_op<>'DELETE' then new_org:=(to_jsonb(new)->>scope_key)::uuid; end if;
 if coalesce(new_org,old_org) is null then raise exception 'Organization unavailable' using errcode='42501'; end if;
 if tg_op='UPDATE' then
   if to_jsonb(new)->'id' is distinct from to_jsonb(old)->'id' then
     raise exception 'Project/task record identity cannot change' using errcode='42501'; end if;
   if tg_table_name='task_tracker_import_batches' and new_org is distinct from old_org then
     raise exception 'Tracker import owner cannot change' using errcode='42501'; end if;
   -- Account cleanup is an exact FK effect, never a content/status edit.
   foreach key in array array['created_by','updated_by'] loop
     if pg_trigger_depth()>1 and to_jsonb(old)->>key is not null and to_jsonb(new)->>key is null
       and (to_jsonb(old)-array[key,'updated_at'])=(to_jsonb(new)-array[key,'updated_at'])
       and not exists(select 1 from public.profiles where id=(to_jsonb(old)->>key)::uuid) then return new; end if;
   end loop;
 end if;
 if tg_op='DELETE' and tg_table_name='organization_task_assignees' then
   if pg_trigger_depth()>1 and not exists(select 1 from public.profiles where id=old.user_id) then return old; end if;
 end if;
 if current_setting('transaction_isolation')<>'read committed' then
   raise exception 'Closure boundary requires read committed isolation' using errcode='40001'; end if;
 if tg_op='DELETE' and not exists(select 1 from public.organizations where user_id=old_org)
   and (tg_table_name<>'programs' or not exists(select 1 from auth.users where id=old_org)) then return old; end if;
 -- Existing authorized task/project transfers remain supported. Lock both owners
 -- in deterministic order so neither source nor destination closure can be escaped.
 for org in select distinct owner_id from unnest(array[old_org,new_org]) owner_id where owner_id is not null order by owner_id loop
   if tg_table_name='programs' and not exists(select 1 from public.organizations where user_id=org) then
     -- Historical programs may belong to an Auth user without an organization.
     -- Serialize that narrow path against organization creation (its Auth FK
     -- takes KEY SHARE), then recheck before deciding no closure owner exists.
     begin perform 1 from auth.users where id=org for update nowait;
     exception when lock_not_available then
       raise exception 'Program owner is changing; retry program edit' using errcode='40001'; end;
     if not found then raise exception 'Program owner unavailable' using errcode='42501'; end if;
     if exists(select 1 from public.organizations where user_id=org) then perform public.guard_uploaded_document_organization(org); end if;
   else perform public.guard_uploaded_document_organization(org); end if;
 end loop;
 if tg_op='DELETE' then return old; end if;
 return new;
end; $$;
revoke all on function public.guard_project_task_closure() from public,anon,authenticated,service_role;
do $$ declare relation text; begin
 foreach relation in array array['programs','organization_projects','organization_tasks','organization_task_assignees',
   'organization_project_notes','organization_project_quick_links','organization_project_assets','organization_workspace_starter_state',
   'task_tracker_import_batches','task_tracker_import_records'] loop
   execute format('create trigger project_task_closure before insert or update or delete on public.%I for each row execute function public.guard_project_task_closure()',relation);
 end loop;
end $$;
comment on function public.guard_project_task_closure() is
 'Serializes canonical project/task/program/import writes with both owning organizations during authorized moves. Preserves exact account cleanup, revisions, recurrence and existing RLS; no read/provider/purge/lifecycle grant.';
commit;
