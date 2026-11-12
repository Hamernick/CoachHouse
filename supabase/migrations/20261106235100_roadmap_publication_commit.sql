-- Atomic admission for the existing roadmap visibility action. This does not
-- qualify shared-profile source lineage or enable any publication/privacy UI.
begin;
create function public.commit_roadmap_publication(p_org uuid,p_expected_updated_at timestamptz,
 p_public boolean,p_support boolean default false)
returns boolean language plpgsql security definer set search_path='' as $$
declare actor uuid:=public.organization_activity_actor_id(); existing public.organizations;
 member_role text; subscription_status text;
begin
 if p_public is null or p_support is null or p_expected_updated_at is null then
  raise exception 'Invalid roadmap publication.' using errcode='22023';end if;
 if auth.role() is distinct from 'service_role' or actor is null then
  raise exception 'Verified roadmap actor required.' using errcode='42501';end if;
 if current_setting('transaction_isolation')<>'read committed' then
  raise exception 'Roadmap permission changed; retry.' using errcode='40001';end if;
 select * into existing from public.organizations where user_id=p_org for update nowait;
 if not found then raise exception 'Roadmap unavailable.' using errcode='42501';end if;
 perform 1 from auth.users where id in(actor,p_org) order by id for update nowait;
 if not exists(select 1 from auth.users where id=actor and (banned_until is null or banned_until<now())) then
  raise exception 'Roadmap editor access required.' using errcode='42501';end if;
 select role into member_role from public.organization_memberships where org_id=p_org and member_id=actor for share nowait;
 if p_support then
  perform 1 from public.platform_staff_members where user_id=actor for share nowait;
  perform 1 from public.workspace_support_grants where user_id=actor for share nowait;
  if not exists(select 1 from public.workspace_support_grants g join public.platform_staff_members s on s.user_id=g.user_id
   where g.user_id=actor and g.revoked_at is null and s.access_level in('developer','coach')) then
   raise exception 'Roadmap support access changed.' using errcode='42501';end if;
 elsif actor is distinct from p_org and (member_role is null or member_role not in('owner','admin','staff')) then
  raise exception 'Roadmap editor access required.' using errcode='42501';
 end if;
 -- The existing action requires paid storage AND a current active/trialing
 -- subscription for either visibility change. Verified support bypasses only
 -- storage, matching the existing reader, never the subscription status.
 perform 1 from public.subscriptions where user_id=p_org for share nowait;
 select status into subscription_status from public.subscriptions where user_id=p_org order by created_at desc limit 1;
 if (not p_support and not public.has_workspace_paid_features(p_org)) or subscription_status is null
  or subscription_status not in('active','trialing') then
  raise exception 'Roadmap subscription access changed.' using errcode='42501';end if;
 perform public.guard_organization_closure(p_org);
 if existing.updated_at is distinct from p_expected_updated_at then return false;end if;
 update public.organizations set is_public_roadmap=p_public where user_id=p_org and updated_at=p_expected_updated_at;
 return found;
exception when lock_not_available then
 raise exception 'Roadmap permission or content is changing; retry.' using errcode='40001';
end $$;
revoke all on function public.commit_roadmap_publication(uuid,timestamptz,boolean,boolean)
 from public,anon,authenticated,service_role;
grant execute on function public.commit_roadmap_publication(uuid,timestamptz,boolean,boolean) to service_role;
comment on function public.commit_roadmap_publication(uuid,timestamptz,boolean,boolean) is
 'Verified service actor, locked editor/support/subscription/closure admission and organization revision CAS. Changes visibility only; source lineage and public disclosure remain separately gated.';
commit;
