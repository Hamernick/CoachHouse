-- Fence canonical board/form effects and retain only authorized response export
-- navigation. Lifecycle RPC remains unavailable; this is not closure activation.
begin;
-- A fixed transaction snapshot can retain a pre-closure missing/active row
-- even after waiting on the org lock. Joined paths require READ COMMITTED
-- (the application/PostgREST default), and fail closed for stronger isolation.
create or replace function public.guard_organization_closure(p_org_id uuid,p_export_read boolean default false)
 returns boolean language plpgsql security definer set search_path='' as $$
declare closure public.organization_closures%rowtype;
begin
 if current_setting('transaction_isolation')<>'read committed' then
   raise exception 'Closure boundary requires read committed isolation' using errcode='40001'; end if;
 perform 1 from public.organizations where user_id=p_org_id for share;
 if not found then raise exception 'Organization unavailable' using errcode='42501'; end if;
 select * into closure from public.organization_closures where org_id=p_org_id;
 if not found or closure.state='active' then return false; end if;
 if p_export_read is distinct from true or clock_timestamp()>=closure.export_until then
   raise exception 'Organization unavailable' using errcode='42501'; end if;
 return true;
end; $$;
revoke all on function public.guard_organization_closure(uuid,boolean) from public,anon,authenticated,service_role;

create function public.lock_closing_organization_board() returns trigger
 language plpgsql security definer set search_path='' as $$
begin
 if new.state<>'closing' then return new; end if;
 if tg_op='UPDATE' then
   if old.state='closing' then return new; end if;
 end if;
 -- The lifecycle command owns organization UPDATE first. Direct board writes
 -- already own their row and can acquire org FK KEY SHARE in form/calendar
 -- triggers. Never wait in the opposite order: reject this closure attempt
 -- atomically, leaving its exact operation available for an explicit retry.
 begin
   perform 1 from public.organization_workspace_boards where org_id=new.org_id for update nowait;
 exception when lock_not_available then
   raise exception 'Workspace is changing; retry closure' using errcode='40001';
 end;
 return new;
end; $$;
revoke all on function public.lock_closing_organization_board() from public,anon,authenticated,service_role;
create trigger organization_closure_board before insert or update of state on public.organization_closures
 for each row execute function public.lock_closing_organization_board();

create function public.guard_workspace_board_closure() returns trigger
 language plpgsql security definer set search_path='' as $$
declare org uuid;
begin
 if current_setting('transaction_isolation')<>'read committed' then
   raise exception 'Closure boundary requires read committed isolation' using errcode='40001'; end if;
 if tg_op='INSERT' then
   -- No row exists to lock yet. Serialize first insertion/UPSERT with closure
   -- before any tuple or FK side effect, using the canonical organization lock.
   perform public.guard_organization_closure(new.org_id);
   return new;
 end if;
 org:=old.org_id;
 if tg_op='UPDATE' and new.org_id is distinct from org then
   raise exception 'Workspace organization cannot change' using errcode='42501'; end if;
 -- UPDATE/DELETE already hold the board tuple. The closing transition must
 -- acquire that same tuple BEFORE changing lifecycle state. Do not lock the
 -- organization here: the existing source/calendar triggers may need its FK.
 if exists(select 1 from public.organization_closures where org_id=org and state='closing') then
   -- A parent deletion owns its cascade; this does not authorize an independent
   -- board purge or add any organization-deletion entry point.
   if tg_op<>'DELETE' or exists(select 1 from public.organizations where user_id=org) then
     raise exception 'Organization unavailable' using errcode='42501'; end if;
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end; $$;
revoke all on function public.guard_workspace_board_closure() from public,anon,authenticated,service_role;
create trigger workspace_board_closure before insert or update or delete on public.organization_workspace_boards
 for each row execute function public.guard_workspace_board_closure();

alter function public.organization_form_source_command(uuid,jsonb) rename to organization_form_source_command_before_closure;
revoke all on function public.organization_form_source_command_before_closure(uuid,jsonb) from public,anon,authenticated,service_role;
create function public.organization_form_source_command(p_actor_id uuid,p_command jsonb) returns jsonb
 language plpgsql security definer set search_path='' as $$
declare org uuid;
begin
 select org_id into org from public.organization_form_versions where id=(p_command->>'versionId')::uuid;
 if not found then raise exception 'Form access required' using errcode='42501'; end if;
 perform public.guard_organization_closure(org);
 return public.organization_form_source_command_before_closure(p_actor_id,p_command);
end; $$;
revoke all on function public.organization_form_source_command(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.organization_form_source_command(uuid,jsonb) to service_role;

alter function public.organization_form_review_access(uuid,jsonb) rename to organization_form_review_access_before_closure;
revoke all on function public.organization_form_review_access_before_closure(uuid,jsonb) from public,anon,authenticated,service_role;
create function public.organization_form_review_access(p_actor_id uuid,p_command jsonb) returns jsonb
 language plpgsql security definer set search_path='' as $$
declare org uuid; closing boolean; result jsonb;
begin
 if p_command ? 'versionId' and (p_command ? 'organizationId' or p_command ? 'formId') then
   raise exception 'Choose one form target' using errcode='22023'; end if;
 if p_command ? 'versionId' then
   select org_id into org from public.organization_form_versions where id=(p_command->>'versionId')::uuid;
 else
   select org_id into org from public.organization_forms where org_id=(p_command->>'organizationId')::uuid and id=(p_command->>'formId')::uuid;
 end if;
 if org is null then raise exception 'Form access required' using errcode='42501'; end if;
 closing:=public.guard_organization_closure(org,p_command->>'action'='source_access');
 result:=public.organization_form_review_access_before_closure(p_actor_id,p_command);
 if closing then result:=result||jsonb_build_object('canEdit',false,'canManageAccess',false); end if;
 return result;
end; $$;
revoke all on function public.organization_form_review_access(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.organization_form_review_access(uuid,jsonb) to service_role;

alter function public.organization_form_viewer_access(uuid,jsonb) rename to organization_form_viewer_access_before_closure;
revoke all on function public.organization_form_viewer_access_before_closure(uuid,jsonb) from public,anon,authenticated,service_role;
create function public.organization_form_viewer_access(p_actor_id uuid,p_command jsonb) returns jsonb
 language plpgsql security definer set search_path='' as $$
declare org uuid;
begin
 select org_id into org from public.organization_form_versions where id=(p_command->>'versionId')::uuid;
 if not found then raise exception 'Form access required' using errcode='42501'; end if;
 perform public.guard_organization_closure(org);
 return public.organization_form_viewer_access_before_closure(p_actor_id,p_command);
end; $$;
revoke all on function public.organization_form_viewer_access(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.organization_form_viewer_access(uuid,jsonb) to service_role;

alter function public.organization_form_recovery(uuid,jsonb) rename to organization_form_recovery_before_closure;
revoke all on function public.organization_form_recovery_before_closure(uuid,jsonb) from public,anon,authenticated,service_role;
create function public.organization_form_recovery(p_actor_id uuid,p_command jsonb) returns jsonb
 language plpgsql security definer set search_path='' as $$
declare org uuid;
begin
 if p_command->>'pageId' is not null then
   if p_command->>'organizationId' is not null then raise exception 'Ambiguous recovery target' using errcode='22023'; end if;
   select org_id into org from public.organization_workspace_pages where id=(p_command->>'pageId')::uuid;
 else org:=(p_command->>'organizationId')::uuid;
 end if;
 if org is null or p_actor_id is distinct from org then
   -- Preserve the existing non-owner empty-list/denial contract.
   return public.organization_form_recovery_before_closure(p_actor_id,p_command);
 end if;
 perform 1 from public.organizations where user_id=org for update;
 perform public.guard_organization_closure(org);
 return public.organization_form_recovery_before_closure(p_actor_id,p_command);
end; $$;
revoke all on function public.organization_form_recovery(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.organization_form_recovery(uuid,jsonb) to service_role;

alter function public.list_accessible_organization_forms(uuid,uuid,uuid) rename to list_accessible_organization_forms_before_closure;
revoke all on function public.list_accessible_organization_forms_before_closure(uuid,uuid,uuid) from public,anon,authenticated,service_role;
create function public.list_accessible_organization_forms(p_actor_id uuid,p_version_id uuid,p_after uuid default null) returns jsonb
 language plpgsql security definer set search_path='' as $$
declare org uuid;
begin
 select org_id into org from public.organization_form_versions where id=p_version_id;
 if not found then raise exception 'Form access required' using errcode='42501'; end if;
 perform public.guard_organization_closure(org,true);
 return public.list_accessible_organization_forms_before_closure(p_actor_id,p_version_id,p_after);
end; $$;
revoke all on function public.list_accessible_organization_forms(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.list_accessible_organization_forms(uuid,uuid,uuid) to service_role;

alter function public.list_organization_form_response_versions(uuid,uuid,uuid) rename to list_organization_form_response_versions_before_closure;
revoke all on function public.list_organization_form_response_versions_before_closure(uuid,uuid,uuid) from public,anon,authenticated,service_role;
create function public.list_organization_form_response_versions(p_actor_id uuid,p_version_id uuid,p_before uuid default null) returns jsonb
 language plpgsql security definer set search_path='' as $$
declare org uuid;
begin
 select org_id into org from public.organization_form_versions where id=p_version_id;
 if not found then raise exception 'Form access required' using errcode='42501'; end if;
 perform public.guard_organization_closure(org,true);
 return public.list_organization_form_response_versions_before_closure(p_actor_id,p_version_id,p_before);
end; $$;
revoke all on function public.list_organization_form_response_versions(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.list_organization_form_response_versions(uuid,uuid,uuid) to service_role;

alter function public.list_organization_form_versions(uuid,uuid,uuid) rename to list_organization_form_versions_before_closure;
revoke all on function public.list_organization_form_versions_before_closure(uuid,uuid,uuid) from public,anon,authenticated,service_role;
create function public.list_organization_form_versions(p_actor_id uuid,p_page_id uuid,p_before uuid default null) returns jsonb
 language plpgsql security definer set search_path='' as $$
declare org uuid;
begin
 select org_id into org from public.organization_workspace_pages where id=p_page_id;
 if not found then raise exception 'Form access required' using errcode='42501'; end if;
 perform 1 from public.organizations where user_id=org for update;
 perform public.guard_organization_closure(org,true);
 return public.list_organization_form_versions_before_closure(p_actor_id,p_page_id,p_before);
end; $$;
revoke all on function public.list_organization_form_versions(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.list_organization_form_versions(uuid,uuid,uuid) to service_role;
commit;
