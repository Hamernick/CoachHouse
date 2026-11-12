-- Trusted catalog compiler only. Full canonical CAS; no filtered board saves.
begin;
create function public.commit_workspace_catalog(p_org_id uuid,p_actor_id uuid,p_expected_state jsonb,p_state jsonb)
returns boolean language plpgsql security definer set search_path='' as $$
declare current_state jsonb; empty_canvas jsonb:='{"nodes":[],"connections":[],"visibility":{"allCardsHiddenExplicitly":true,"organizationHiddenExplicitly":true}}';
begin
 if auth.role() is distinct from 'service_role' or p_actor_id is null
  or p_actor_id is distinct from public.organization_activity_actor_id() then
  raise exception 'Verified catalog actor required.' using errcode='42501';end if;
 if current_setting('transaction_isolation')<>'read committed' then
  raise exception 'Workspace permission changed; retry.' using errcode='40001';end if;
 -- Keep revocation/closure serialized through the write, including metadata-only
 -- changes that intentionally do not touch any private Particle/source.
 perform 1 from public.organizations where user_id=p_org_id for share nowait;
 perform 1 from public.organization_memberships where org_id=p_org_id and member_id=p_actor_id for share nowait;
 perform 1 from public.platform_staff_members where user_id=p_actor_id for share nowait;
 perform public.guard_organization_closure(p_org_id);
 if not public.can_read_workspace_particle_origins(p_org_id,p_actor_id) or not (
   p_org_id=p_actor_id
   or exists(select 1 from public.organization_memberships where org_id=p_org_id and member_id=p_actor_id and role in ('owner','admin','staff'))
   or exists(select 1 from public.platform_staff_members where user_id=p_actor_id and access_level='developer')
 ) then raise exception 'Workspace editor access required.' using errcode='42501';end if;
 if jsonb_typeof(p_expected_state) is distinct from 'object' or jsonb_typeof(p_state) is distinct from 'object'
  or jsonb_typeof(p_state->'workspaceCatalog') is distinct from 'object'
  or jsonb_typeof(p_state#>'{workspaceCatalog,entries}') is distinct from 'array' then
  raise exception 'Invalid catalog state.' using errcode='22023';end if;
 select state into current_state from public.organization_workspace_boards where org_id=p_org_id for update nowait;
 if not found or current_state is distinct from p_expected_state then return false;end if;
 -- This endpoint cannot edit a surviving canvas body or introduce content.
 -- Root deletion is the existing exact empty shell plus a durable tombstone.
 if (p_state-'workspaceCatalog') is distinct from (current_state-'workspaceCatalog') and (
  p_state#>'{workspaceCatalog,defaultDeleted}'='true'::jsonb and p_state-'workspaceCatalog'=empty_canvas
 ) is not true then raise exception 'Catalog cannot edit canvas content.' using errcode='22023';end if;
 if exists (
  select 1 from jsonb_array_elements(p_state#>'{workspaceCatalog,entries}') next_entry
  left join jsonb_array_elements(public.workspace_particle_array(current_state#>'{workspaceCatalog,entries}')) old_entry on old_entry->>'id'=next_entry->>'id'
  where next_entry->>'id' is null or
   case when old_entry is null then next_entry->'state' is distinct from empty_canvas
    else next_entry->'state' is distinct from old_entry->'state' end
 ) then raise exception 'Catalog cannot edit canvas content.' using errcode='22023';end if;
 -- Existing canonical triggers check removed root/named content against both
 -- current and retained source dependencies, and retain their own feature gates.
 update public.organization_workspace_boards set state=p_state,updated_by=p_actor_id where org_id=p_org_id;
 return true;
exception when lock_not_available then
 raise exception 'Workspace permission or content is changing; retry.' using errcode='40001';
end;
$$;
revoke all on function public.commit_workspace_catalog(uuid,uuid,jsonb,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.commit_workspace_catalog(uuid,uuid,jsonb,jsonb) to service_role;
comment on function public.commit_workspace_catalog(uuid,uuid,jsonb,jsonb) is
 'Service-only canonical catalog CAS with fresh editor/closure authority and existing atomic source deletion fences. Returns no board content; private activation remains gated.';
commit;
