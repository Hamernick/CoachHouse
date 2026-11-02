-- Organization admission never revokes a shared identity's Google credential.
begin;
create function public.authorize_organization_drive_access(p_actor_id uuid,p_org_id uuid,p_write boolean default false)
 returns boolean language plpgsql security definer set search_path='' as $$
declare member_role text;
begin
 if p_actor_id is null or p_org_id is null or p_write is null then return false; end if;
 if p_actor_id is distinct from p_org_id then
  select role::text into member_role from public.organization_memberships
   where org_id=p_org_id and member_id=p_actor_id for share;
  if member_role is null or (p_write and member_role not in ('owner','admin','staff')) then return false; end if;
 end if;
 perform public.guard_organization_closure(p_org_id,not p_write);
 return true;
exception when insufficient_privilege or serialization_failure then return false;
end $$;
revoke all on function public.authorize_organization_drive_access(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.authorize_organization_drive_access(uuid,uuid,boolean) to service_role;
create policy organization_closure_read on public.organization_external_documents as restrictive
 for select to anon,authenticated using(public.organization_closure_read_window(org_id));
comment on function public.authorize_organization_drive_access(uuid,uuid,boolean) is
 'Current organization membership plus closure admission for Drive requests; existing authorized reads end at the fixed export deadline. Recheck before returning private bytes. No response authority, credential revocation, provider deletion or lifecycle transition grant.';
commit;
