-- Revision-checked legacy objective writes, including atomic initial/edited assignments.
begin;
create or replace function public.write_workspace_objective(
 p_mode text,p_org_id uuid,p_objective_id uuid,p_expected_updated_at timestamptz,
 p_title text,p_description text,p_priority text,p_due_at timestamptz,p_group_id uuid,
 p_status text,p_user_ids uuid[]
) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); saved public.organization_workspace_objectives%rowtype;
 target_group public.organization_workspace_objective_groups%rowtype;
begin
 if auth.role() is distinct from 'authenticated' or actor is null then
  raise exception 'Signed-in editor required.' using errcode='42501'; end if;
 if current_setting('transaction_isolation')<>'read committed' then
  raise exception 'Objective changed; reload and retry.' using errcode='40001'; end if;
 -- Keep admission stable through the transaction, including account revocation.
 perform 1 from public.organizations where user_id=p_org_id for share nowait;
 if not found then raise exception 'Workspace unavailable.' using errcode='42501'; end if;
 perform 1 from auth.users where id=actor and (banned_until is null or banned_until<=now()) for share nowait;
 if not found then raise exception 'Editor access required.' using errcode='42501'; end if;
 perform 1 from public.organization_memberships where org_id=p_org_id and member_id=actor for share nowait;
 perform 1 from public.platform_staff_members where user_id=actor for share nowait;
 perform 1 from public.workspace_support_grants where user_id=actor for share nowait;
 perform 1 from public.workspace_support_presence where org_id=p_org_id and actor_id=actor for share nowait;
 perform public.guard_organization_closure(p_org_id);
 if actor<>p_org_id and not exists(select 1 from public.organization_memberships
  where org_id=p_org_id and member_id=actor and role in ('owner','admin','staff'))
  and not coalesce(public.is_admin(),false) and not coalesce(public.workspace_support_can_write(p_org_id),false) then
  raise exception 'Editor access required.' using errcode='42501'; end if;
 if p_mode is null or p_mode not in ('create','details','status') then
  raise exception 'Invalid objective operation.' using errcode='22023'; end if;
 if p_mode='create' then
  if p_objective_id is not null or p_expected_updated_at is not null then
   raise exception 'Invalid objective creation.' using errcode='22023'; end if;
 else
  if p_objective_id is null or p_expected_updated_at is null then
   raise exception 'Objective revision required.' using errcode='22023'; end if;
  select * into saved from public.organization_workspace_objectives
   where org_id=p_org_id and id=p_objective_id for update nowait;
  if not found then raise exception 'Objective unavailable.' using errcode='42501'; end if;
  if saved.updated_at is distinct from p_expected_updated_at then
   raise exception 'Objective changed; reload and retry.' using errcode='40001'; end if;
 end if;
 if p_mode='status' then
  if p_status is null or p_status not in ('todo','in_progress','blocked','done','archived')
   or p_title is not null or p_description is not null or p_priority is not null
   or p_due_at is not null or p_group_id is not null or p_user_ids is not null then
   raise exception 'Invalid objective status change.' using errcode='22023'; end if;
  update public.organization_workspace_objectives
   set status=p_status,completed_at=case when p_status='done' then coalesce(completed_at,now()) else null end,updated_by=actor
   where org_id=p_org_id and id=p_objective_id returning * into saved;
 else
  if p_title is null or length(trim(p_title))=0 or p_priority is null
   or p_priority not in ('low','normal','high','critical') or p_status is not null then
   raise exception 'Invalid objective details.' using errcode='22023'; end if;
  if p_group_id is not null then
   select * into target_group from public.organization_workspace_objective_groups
    where org_id=p_org_id and id=p_group_id for share nowait;
   if not found then raise exception 'Category unavailable.' using errcode='42501'; end if;
   if target_group.archived_at is not null and (p_mode='create' or saved.group_id is distinct from p_group_id) then
    raise exception 'Category archived; reload and retry.' using errcode='40001'; end if;
  end if;
  perform 1 from public.profiles where id=actor for key share nowait;
  if not found then raise exception 'Editor access required.' using errcode='42501'; end if;
  if p_mode='create' then
   insert into public.organization_workspace_objectives(org_id,group_id,title,description,priority,due_at,status,kind,source_type,created_by,updated_by)
    values(p_org_id,p_group_id,trim(p_title),nullif(trim(p_description),''),p_priority,p_due_at,'todo','custom','custom',actor,actor)
    returning * into saved;
  else
   update public.organization_workspace_objectives
    set group_id=p_group_id,title=trim(p_title),description=nullif(trim(p_description),''),priority=p_priority,due_at=p_due_at,updated_by=actor
    where org_id=p_org_id and id=p_objective_id returning * into saved;
  end if;
  if p_user_ids is not null then
   -- Reuse current-team validation and replacement inside this same transaction.
   -- A denied member or failed insertion rolls back details/creation as well.
   perform public.replace_workspace_objective_assignees(p_org_id,saved.id,saved.updated_at,p_user_ids);
   select * into saved from public.organization_workspace_objectives where org_id=p_org_id and id=saved.id;
  end if;
 end if;
 return to_jsonb(saved);
exception when lock_not_available then
 raise exception 'Objective or access is changing; reload and retry.' using errcode='40001';
end;
$$;
revoke all on function public.write_workspace_objective(text,uuid,uuid,timestamptz,text,text,text,timestamptz,uuid,text,uuid[]) from public,anon,authenticated,service_role;
grant execute on function public.write_workspace_objective(text,uuid,uuid,timestamptz,text,text,text,timestamptz,uuid,text,uuid[]) to authenticated;
commit;
