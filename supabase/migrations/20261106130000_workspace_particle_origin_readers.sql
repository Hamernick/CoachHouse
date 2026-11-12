-- The provenance filter now protects board readers too. Metadata access must
-- follow board read scope, not the narrower permission to spend AI credits.
-- This neither grants AI use/chat access nor exposes raw origins to clients.
begin;
create function public.can_read_workspace_particle_origins(p_org_id uuid,p_actor_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select p_actor_id is not null
  and exists(select 1 from public.organizations where user_id=p_org_id)
  and public.organization_closure_read_window(p_org_id)
  and (p_org_id=p_actor_id
    or exists(select 1 from public.organization_memberships where org_id=p_org_id and member_id=p_actor_id)
    or exists(select 1 from public.platform_staff_members where user_id=p_actor_id and access_level='developer'));
$$;
revoke all on function public.can_read_workspace_particle_origins(uuid,uuid) from public,anon,authenticated,service_role;
do $$ declare definition text; begin
 definition:=pg_get_functiondef('public.read_workspace_particle_ai_files(uuid,uuid,text[])'::regprocedure);
 if strpos(definition,'public.can_read_workspace_ai(p_org_id,p_actor_id)')=0 then
  raise exception 'Unexpected provenance reader authority';end if;
 execute replace(definition,'public.can_read_workspace_ai(p_org_id,p_actor_id)',
   'public.can_read_workspace_particle_origins(p_org_id,p_actor_id)');
end $$;
-- Preserve service-only dispatch, bound request/header actor and output limits.
revoke all on function public.read_workspace_particle_ai_files(uuid,uuid,text[]) from public,anon,authenticated;
grant execute on function public.read_workspace_particle_ai_files(uuid,uuid,text[]) to service_role;
commit;
