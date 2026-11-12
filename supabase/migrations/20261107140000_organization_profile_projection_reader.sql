-- Mixed document audiences must not make the organization disappear. Only
-- trusted server projections may read this canonical input; it is not client data.
begin;
create function public.read_organization_profile_for_projection(p_org_id uuid,p_actor_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.role() is distinct from 'service_role' or p_actor_id is null
  or p_actor_id is distinct from public.organization_activity_actor_id()
  or not public.can_read_workspace_particle_origins(p_org_id,p_actor_id) then
  raise exception 'Organization projection access required.' using errcode='42501';
 end if;
 return (select jsonb_build_object(
  'user_id',user_id,'profile',profile,'updated_at',updated_at,
  'ein',ein,'public_slug',public_slug,'is_public',is_public,
  'location_lat',location_lat,'location_lng',location_lng
 ) from public.organizations where user_id=p_org_id);
end $$;
revoke all on function public.read_organization_profile_for_projection(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.read_organization_profile_for_projection(uuid,uuid) to service_role;
comment on function public.read_organization_profile_for_projection(uuid,uuid) is
 'Canonical server projection input only. Verified current actor, parent and closure scope; callers must filter document sources before returning client props. Does not grant publication, editing or private activation.';
commit;
