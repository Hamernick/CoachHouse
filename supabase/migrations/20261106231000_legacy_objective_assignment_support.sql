-- Preserve existing developer and explicit support access under locked admission.
begin;
create or replace function public.replace_workspace_objective_assignees(
 p_org_id uuid,p_objective_id uuid,p_expected_updated_at timestamptz,p_user_ids uuid[]
) returns uuid[] language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); revision timestamptz; assigned uuid[]; member uuid;
begin
 if auth.role() is distinct from 'authenticated' or actor is null then
  raise exception 'Signed-in editor required.' using errcode='42501'; end if;
 if current_setting('transaction_isolation')<>'read committed' then
  raise exception 'Assignments changed; retry.' using errcode='40001'; end if;
 if p_user_ids is null or array_position(p_user_ids,null) is not null then
  raise exception 'Invalid assignment selection.' using errcode='22023'; end if;
 select coalesce(array_agg(distinct id order by id),'{}'::uuid[]) into assigned from unnest(p_user_ids) id;
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
 select updated_at into revision from public.organization_workspace_objectives
  where org_id=p_org_id and id=p_objective_id for update nowait;
 if not found then raise exception 'Objective unavailable.' using errcode='42501'; end if;
 if revision is distinct from p_expected_updated_at then
  raise exception 'Assignments changed; retry.' using errcode='40001'; end if;
 foreach member in array assigned loop
  if member<>p_org_id then
   perform 1 from public.organization_memberships where org_id=p_org_id and member_id=member for share nowait;
   if not found then raise exception 'Choose current team members.' using errcode='42501'; end if;
  end if;
 end loop;
 -- The parent revision serializes concurrent replacements without touching
 -- title, status, description, links, or any canvas snapshot.
 update public.organization_workspace_objectives set updated_by=actor where id=p_objective_id and org_id=p_org_id;
 delete from public.organization_workspace_objective_assignees where org_id=p_org_id and objective_id=p_objective_id;
 insert into public.organization_workspace_objective_assignees(org_id,objective_id,user_id,role,created_by)
  select p_org_id,p_objective_id,id,'assignee',actor from unnest(assigned) id;
 return assigned;
exception when lock_not_available then
 raise exception 'Assignments or access are changing; retry.' using errcode='40001';
end;
$$;
revoke all on function public.replace_workspace_objective_assignees(uuid,uuid,timestamptz,uuid[]) from public,anon,authenticated,service_role;
grant execute on function public.replace_workspace_objective_assignees(uuid,uuid,timestamptz,uuid[]) to authenticated;
commit;
