-- Authenticated category creation/archive: stable authority and client revision.
begin;
create or replace function public.write_workspace_objective_group(
 p_org_id uuid,p_group_id uuid,p_expected_updated_at timestamptz,p_title text,p_archived boolean
) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); saved public.organization_workspace_objective_groups%rowtype;
begin
 if auth.role() is distinct from 'authenticated' or actor is null then
  raise exception 'Signed-in editor required.' using errcode='42501'; end if;
 if current_setting('transaction_isolation')<>'read committed' then
  raise exception 'Category changed; reload and retry.' using errcode='40001'; end if;
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
 -- Creation and archive have separate, exact parameter shapes.
 if p_group_id is null then
  if p_expected_updated_at is not null or p_archived is not null
    or p_title is null or length(trim(p_title))=0 then
   raise exception 'Invalid category creation.' using errcode='22023'; end if;
  -- Hold the FK principal through insertion (including concurrent account cleanup).
  perform 1 from public.profiles where id=actor for key share nowait;
  if not found then raise exception 'Editor access required.' using errcode='42501'; end if;
  insert into public.organization_workspace_objective_groups(org_id,title,kind,source_type,created_by)
   values(p_org_id,trim(p_title),'custom','none',actor) returning * into saved;
 else
  if p_expected_updated_at is null or p_archived is null or p_title is not null then
   raise exception 'Category revision required.' using errcode='22023'; end if;
  select * into saved from public.organization_workspace_objective_groups
   where org_id=p_org_id and id=p_group_id for update nowait;
  if not found then raise exception 'Category unavailable.' using errcode='42501'; end if;
  if saved.updated_at is distinct from p_expected_updated_at then
   raise exception 'Category changed; reload and retry.' using errcode='40001'; end if;
  update public.organization_workspace_objective_groups
   set archived_at=case when p_archived then now() else null end
   where org_id=p_org_id and id=p_group_id returning * into saved;
 end if;
 return to_jsonb(saved);
exception when lock_not_available then
 raise exception 'Category or access is changing; reload and retry.' using errcode='40001';
end;
$$;
revoke all on function public.write_workspace_objective_group(uuid,uuid,timestamptz,text,boolean) from public,anon,authenticated,service_role;
grant execute on function public.write_workspace_objective_group(uuid,uuid,timestamptz,text,boolean) to authenticated;
commit;
