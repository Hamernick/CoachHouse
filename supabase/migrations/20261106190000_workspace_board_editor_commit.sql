-- Canonical server compiler only; no audience-filtered snapshots are persisted.
begin;
create function public.commit_workspace_board(p_org_id uuid,p_actor_id uuid,p_expected_revision timestamptz,p_expected_state jsonb,p_state jsonb)
returns boolean language plpgsql security definer set search_path='' as $$
declare current_board public.organization_workspace_boards%rowtype; audit_actor uuid;
begin
 if auth.role() is distinct from 'service_role' or p_actor_id is null
  or p_actor_id is distinct from public.organization_activity_actor_id() then
  raise exception 'Verified workspace actor required.' using errcode='42501';end if;
 if current_setting('transaction_isolation')<>'read committed' then
  raise exception 'Workspace permission changed; retry.' using errcode='40001';end if;
 -- Serialize admission with parent revocation and closure, even when only
 -- layout metadata changes and the native-source trigger has nothing to check.
 perform 1 from public.organizations where user_id=p_org_id for share nowait;
 perform 1 from public.organization_memberships where org_id=p_org_id and member_id=p_actor_id for share nowait;
 perform 1 from public.platform_staff_members where user_id=p_actor_id for share nowait;
 perform public.guard_organization_closure(p_org_id);
 if not public.can_read_workspace_particle_origins(p_org_id,p_actor_id) or not (
  p_org_id=p_actor_id
  or exists(select 1 from public.organization_memberships where org_id=p_org_id and member_id=p_actor_id and role in ('owner','admin','staff'))
  or exists(select 1 from public.platform_staff_members where user_id=p_actor_id and access_level='developer')
 ) then raise exception 'Workspace editor access required.' using errcode='42501';end if;
 if jsonb_typeof(p_state) is distinct from 'object'
  or (p_expected_revision is null) is distinct from (p_expected_state is null)
  or (p_expected_state is not null and jsonb_typeof(p_expected_state) is distinct from 'object') then
  raise exception 'Invalid workspace snapshot.' using errcode='22023';end if;
 select * into current_board from public.organization_workspace_boards where org_id=p_org_id for update nowait;
 if found then
  if current_board.updated_at is distinct from p_expected_revision or current_board.state is distinct from p_expected_state then return false;end if;
 elsif p_expected_revision is not null then return false;
 end if;
 -- Preserve existing first-save compatibility for Auth users whose profile is
 -- not materialized yet. Authority always uses p_actor_id, never this FK value.
 select id into audit_actor from public.profiles where id=p_actor_id for key share;
 if current_board.org_id is null then
  insert into public.organization_workspace_boards(org_id,state,updated_by) values(p_org_id,p_state,audit_actor)
   on conflict(org_id) do nothing;
  return found;
 end if;
 -- Existing source, form, calendar, provenance and closure guards remain active.
 update public.organization_workspace_boards set state=p_state,updated_by=audit_actor where org_id=p_org_id;
 return true;
exception when lock_not_available then
 raise exception 'Workspace permission or content is changing; retry.' using errcode='40001';
end;
$$;
revoke all on function public.commit_workspace_board(uuid,uuid,timestamptz,jsonb,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.commit_workspace_board(uuid,uuid,timestamptz,jsonb,jsonb) to service_role;
comment on function public.commit_workspace_board(uuid,uuid,timestamptz,jsonb,jsonb) is
 'Verified server actor, locked current editor/closure admission and full canonical CAS. Existing source/form/calendar guards apply. Returns no board content; private activation remains gated.';
commit;
