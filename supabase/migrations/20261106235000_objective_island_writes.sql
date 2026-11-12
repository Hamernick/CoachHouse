-- Preserve custom/source ownership while holding current editor authority through commit.
begin;
create or replace function public.write_workspace_objective_island(
 p_org_id uuid,p_objective_id uuid,p_step_id uuid,p_expected_updated_at timestamptz,
 p_title text,p_description text,p_status text
) returns boolean language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); parent public.organization_workspace_objectives%rowtype;
 step public.organization_workspace_objective_steps%rowtype;
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
 if p_objective_id is null or p_expected_updated_at is null then
  raise exception 'Objective revision required.' using errcode='22023'; end if;
 select * into parent from public.organization_workspace_objectives
  where org_id=p_org_id and id=p_objective_id for update nowait;
 if not found or parent.kind<>'custom' then
  raise exception 'Update this objective from its source.' using errcode='42501'; end if;
 if p_step_id is null then
  if parent.updated_at is distinct from p_expected_updated_at then
   raise exception 'Objective changed; reload and retry.' using errcode='40001'; end if;
  if p_title is null or length(trim(p_title)) not between 1 and 240
   or p_description is null or length(p_description)>10000
   or p_status is null or p_status not in ('todo','in_progress','blocked','done','archived') then
   raise exception 'Invalid objective details.' using errcode='22023'; end if;
  update public.organization_workspace_objectives
   set title=trim(p_title),description=nullif(trim(p_description),''),status=p_status,
    completed_at=case when p_status='done' then coalesce(completed_at,now()) else null end,updated_by=actor
   where org_id=p_org_id and id=p_objective_id;
 else
  if p_title is not null or p_description is not null or p_status is null or p_status not in ('todo','done') then
   raise exception 'Invalid step change.' using errcode='22023'; end if;
  select * into step from public.organization_workspace_objective_steps
   where org_id=p_org_id and objective_id=p_objective_id and id=p_step_id for update nowait;
  if not found or step.step_type<>'custom' then
   raise exception 'Update this step from its source.' using errcode='42501'; end if;
  if step.updated_at is distinct from p_expected_updated_at then
   raise exception 'Step changed; reload and retry.' using errcode='40001'; end if;
  update public.organization_workspace_objective_steps
   set status=p_status,completed_at=case when p_status='done' then coalesce(completed_at,now()) else null end
   where org_id=p_org_id and objective_id=p_objective_id and id=p_step_id;
 end if;
 return true;
exception when lock_not_available then
 raise exception 'Objective or access is changing; reload and retry.' using errcode='40001';
end;
$$;
revoke all on function public.write_workspace_objective_island(uuid,uuid,uuid,timestamptz,text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.write_workspace_objective_island(uuid,uuid,uuid,timestamptz,text,text,text) to authenticated;
commit;
