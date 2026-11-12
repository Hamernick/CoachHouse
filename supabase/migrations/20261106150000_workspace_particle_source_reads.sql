-- Raw table reads cannot project JSON safely. Reject the whole read when known
-- native-source content is unavailable, rather than returning an absent board.
-- Server-side partial readers and unknown historical sources remain cutover gates.
begin;
create function public.can_read_workspace_particle_board(p_org uuid,p_state jsonb)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid();
begin
 -- Never accept a caller-supplied actor or the service actor header here.
 -- Parent RLS still applies. A direct helper call cannot probe another org.
 if actor is null or not public.can_read_workspace_particle_origins(p_org,actor) then return false;end if;
 if exists (
  select 1 from public.workspace_particle_board_files(p_org,p_state) dependency
  left join public.organization_document_files file on file.id=dependency.file_id and file.org_id=p_org
  where file.id is null or not public.document_file_folder_actor_can(dependency.file_id,actor,'view')
 ) then
  raise exception 'Board source access required.' using errcode='42501';
 end if;
 return true;
end;
$$;
revoke all on function public.can_read_workspace_particle_board(uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.can_read_workspace_particle_board(uuid,jsonb) to authenticated;
-- AND with every existing permissive policy, including future policies.
-- Service-backed server CAS remains canonical and subject to the write fence.
create policy workspace_particle_source_read on public.organization_workspace_boards
 as restrictive for select to authenticated
 using (public.can_read_workspace_particle_board(org_id,state));
comment on function public.can_read_workspace_particle_board(uuid,jsonb) is
 'Authenticated raw-board native-source disclosure fence. Raises on restricted content to prevent absent-board fallback. Does not qualify profile JSON, historical unknown copies or private activation.';
-- Trusted server reader only: returns canonical JSON for existing application
-- audience projection. Never expose this result directly to the browser.
create function public.read_workspace_particle_board_for_projection(p_org_id uuid,p_actor_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.role() is distinct from 'service_role' or p_actor_id is null
  or p_actor_id is distinct from public.organization_activity_actor_id()
  or not public.can_read_workspace_particle_origins(p_org_id,p_actor_id) then
  raise exception 'Board projection access required.' using errcode='42501';
 end if;
 return (select jsonb_build_object('state',state) from public.organization_workspace_boards where org_id=p_org_id);
end;
$$;
revoke all on function public.read_workspace_particle_board_for_projection(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.read_workspace_particle_board_for_projection(uuid,uuid) to service_role;
commit;
