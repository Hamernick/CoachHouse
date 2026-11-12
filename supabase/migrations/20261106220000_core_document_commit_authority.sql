-- Preserve the canonical profile/session CAS while admitting the current editor
-- inside the same transaction. Support is verified server context, not user input.
begin;
alter function public.commit_core_document_session(uuid,text,timestamptz,uuid,integer,jsonb,jsonb)
 rename to commit_core_document_session_before_authority;
revoke all on function public.commit_core_document_session_before_authority(uuid,text,timestamptz,uuid,integer,jsonb,jsonb)
 from public,anon,authenticated,service_role;
create function public.commit_core_document_session(
 p_org uuid,p_section text,p_expected_updated_at timestamptz,p_expected_generation uuid,
 p_expected_version integer,p_state jsonb,p_profile jsonb default null,p_support boolean default false
) returns boolean language plpgsql security definer set search_path='' as $$
declare actor uuid:=public.organization_activity_actor_id(); member_role text; level text; permitted boolean:=false;
begin
 if auth.role() is distinct from 'service_role' or actor is null then
  raise exception 'Verified document actor required.' using errcode='42501';end if;
 if current_setting('transaction_isolation')<>'read committed' then
  raise exception 'Document permission changed; retry.' using errcode='40001';end if;
 perform 1 from public.organizations where user_id=p_org for update nowait;
 if not found then raise exception 'Document editor access required.' using errcode='42501';end if;
 perform public.guard_organization_closure(p_org);
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
  if not public.has_workspace_paid_features(p_org) then
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
 return public.commit_core_document_session_before_authority(p_org,p_section,p_expected_updated_at,
  p_expected_generation,p_expected_version,p_state,p_profile);
exception when lock_not_available then
 raise exception 'Document permission or content is changing; retry.' using errcode='40001';
end $$;
revoke all on function public.commit_core_document_session(uuid,text,timestamptz,uuid,integer,jsonb,jsonb,boolean)
 from public,anon,authenticated,service_role;
grant execute on function public.commit_core_document_session(uuid,text,timestamptz,uuid,integer,jsonb,jsonb,boolean) to service_role;
comment on function public.commit_core_document_session(uuid,text,timestamptz,uuid,integer,jsonb,jsonb,boolean) is
 'Current verified editor, paid storage or explicit support, and closure admission before unchanged atomic profile/session CAS. Profile provenance and disclosure remain separate boundaries.';
commit;
