-- Canonical roadmap compilation remains server-owned; preserve full-profile CAS.
-- This protects ordinary saves/deletion/cover images, not profile disclosure.
begin;
create function public.commit_roadmap_profile(p_org uuid,p_expected_updated_at timestamptz,
 p_profile jsonb,p_support boolean default false,p_require_storage boolean default true)
returns boolean language plpgsql security definer set search_path='' as $$
declare actor uuid:=public.organization_activity_actor_id(); member_role text; level text; permitted boolean:=false; existing public.organizations;
begin
 if jsonb_typeof(p_profile) is distinct from 'object' or p_require_storage is null or p_support is null then
  raise exception 'Invalid document profile.' using errcode='22023';end if;
 if auth.role() is distinct from 'service_role' or actor is null then
  raise exception 'Verified document actor required.' using errcode='42501';end if;
 if current_setting('transaction_isolation')<>'read committed' then
  raise exception 'Document permission changed; retry.' using errcode='40001';end if;
 select * into existing from public.organizations where user_id=p_org for update nowait;
 if not found and (actor is distinct from p_org or p_expected_updated_at is not null) then
  raise exception 'Document editor access required.' using errcode='42501';end if;
 -- FK parent locks fence new subscriptions and platform grants as well as
 -- account deletion/bans. NOWAIT makes crossed lock orders safely retryable.
 perform 1 from auth.users where id in(actor,p_org) order by id for update nowait;
 if not exists(select 1 from auth.users where id=actor and (banned_until is null or banned_until<now())) then
  raise exception 'Document editor access required.' using errcode='42501';end if;
 perform 1 from public.profiles where id=actor for update nowait;
 select role into member_role from public.organization_memberships where org_id=p_org and member_id=actor for share nowait;
 select access_level into level from public.platform_staff_members where user_id=actor for share nowait;
 if level is null and exists(select 1 from public.profiles where id=actor and role='admin') then level:='developer';end if;
 if p_support is true then
  perform 1 from public.workspace_support_grants where user_id=actor for share nowait;
  if not exists(select 1 from public.workspace_support_grants g join public.platform_staff_members s on s.user_id=g.user_id
    where g.user_id=actor and g.revoked_at is null and s.access_level in('developer','coach')) then
   raise exception 'Document support access changed.' using errcode='42501';end if;
  permitted:=true;
 else
  perform 1 from public.subscriptions where user_id=p_org for share nowait;
  if p_require_storage and not public.has_workspace_paid_features(p_org) then
   raise exception 'Document storage access required.' using errcode='42501';end if;
  if actor=p_org or member_role in('owner','admin','staff') then permitted:=true;
  elsif member_role is null and level='developer' then permitted:=true;
  elsif member_role is null and level='coach' then
   perform 1 from public.organization_coach_scope_settings where id=true for share nowait;
   if not found then
    -- Missing singleton means unrestricted scope; fence its first insertion.
    lock table public.organization_coach_scope_settings in share mode nowait;
   end if;
   perform 1 from public.organization_coach_assignments where organization_id=p_org for share nowait;
   permitted:=not coalesce((select assigned_only_enabled from public.organization_coach_scope_settings where id=true),false)
    or exists(select 1 from public.organization_coach_assignments where organization_id=p_org and coach_user_id=actor)
    or (exists(select 1 from public.platform_staff_members where user_id=actor and can_access_unassigned_organizations)
      and not exists(select 1 from public.organization_coach_assignments where organization_id=p_org));
  end if;
 end if;
 if not permitted then raise exception 'Document editor access required.' using errcode='42501';end if;
 -- A missing row can only be initialized by its canonical owner. Recheck after
 -- locking the FK parent, which also fences competing first inserts.
 if existing.user_id is null then
  select * into existing from public.organizations where user_id=p_org for update nowait;
 end if;
 -- The Free allowance cannot be used to change hosted bodies or uploads,
 -- even though this service writer bypasses the ordinary table billing trigger.
 if not p_require_storage and public.native_workspace_document_content(p_profile) is distinct from
   public.native_workspace_document_content(coalesce(existing.profile,'{}'::jsonb)) then
  raise exception 'Document storage access required.' using errcode='42501';end if;
 if existing.user_id is null then
  insert into public.organizations(user_id,profile) values(p_org,p_profile);
  perform public.guard_organization_closure(p_org);
  return true;
 end if;
 perform public.guard_organization_closure(p_org);
 if p_expected_updated_at is null or existing.updated_at is distinct from p_expected_updated_at then return false;end if;
 update public.organizations set profile=p_profile where user_id=p_org and updated_at=p_expected_updated_at;
 return found;
exception when lock_not_available then
 raise exception 'Document permission or content is changing; retry.' using errcode='40001';
end $$;
revoke all on function public.commit_roadmap_profile(uuid,timestamptz,jsonb,boolean,boolean)
 from public,anon,authenticated,service_role;
grant execute on function public.commit_roadmap_profile(uuid,timestamptz,jsonb,boolean,boolean) to service_role;
comment on function public.commit_roadmap_profile(uuid,timestamptz,jsonb,boolean,boolean) is
 'Verified server actor, locked editor/support/storage/closure authority and full-profile CAS. Only the server-validated Drive-only change may omit paid storage. No private-folder or publication qualification.';
commit;
