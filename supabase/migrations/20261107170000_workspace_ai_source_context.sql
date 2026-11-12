-- AI context intersects actor access with the selected workspace's explicit
-- restricted-folder grants. No new grants, bindings, or private activation.
begin;
create function public.workspace_ai_folder_available(p_org uuid,p_canvas text,p_project uuid,p_folder uuid,p_actor uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.project_asset_folders f
  join public.organization_projects p on p.id=f.project_id and p.org_id=p_org
  where f.project_id=p_project and f.id=p_folder
   and public.project_folder_actor_can(p_project,p_folder,p_actor,'view')
   and (f.audience='inherited' or (
    public.workspace_source_actor_can(p_org,p_canvas,p_actor,'view')
    and exists(select 1 from public.project_folder_workspace_grants g
     where g.project_id=p_project and g.folder_id=p_folder and g.org_id=p_org and g.canvas_id=p_canvas))));
$$;
revoke all on function public.workspace_ai_folder_available(uuid,text,uuid,uuid,uuid) from public,anon,authenticated,service_role;

create function public.filter_workspace_ai_sources(p_org_id uuid,p_canvas_id text,p_actor_id uuid,p_file_ids uuid[],p_section_ids text[])
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare copies jsonb; files uuid[]; sections text[];
begin
 if auth.role() is distinct from 'service_role' or p_actor_id is null
  or p_actor_id is distinct from public.organization_activity_actor_id()
  or not public.can_read_workspace_particle_origins(p_org_id,p_actor_id)
  or p_canvas_id is null or not (public.workspace_source_scope_exists(p_org_id,p_canvas_id)
   -- The app's initial default canvas exists before its first persisted board.
   -- This admits inherited sources only; restricted folders still need a grant.
   or (p_canvas_id='default' and not exists(select 1 from public.organization_workspace_boards where org_id=p_org_id))) then
  raise exception 'Workspace context unavailable.' using errcode='42501';end if;
 if p_file_ids is null or p_section_ids is null or cardinality(p_file_ids)>500
  or cardinality(p_section_ids)>500 or array_position(p_file_ids,null) is not null then
  raise exception 'Invalid context source request.' using errcode='22023';end if;
 copies:=public.read_workspace_ai_document_copy_sources(p_org_id,p_actor_id,p_section_ids);
 select coalesce(array_agg(distinct f.id order by f.id),'{}'::uuid[]) into files
  from public.organization_document_files f
  where f.org_id=p_org_id and f.id=any(public.filter_document_file_audience(p_file_ids,p_actor_id))
   and f.deleted_at is null and f.document_kind is null
   and not exists(select 1 from public.document_file_folder_authorities a where a.file_id=f.id
    and not public.workspace_ai_folder_available(p_org_id,p_canvas_id,a.project_id,a.folder_id,p_actor_id));
 select coalesce(array_agg(distinct id order by id),'{}'::text[]) into sections
  from unnest(p_section_ids) id
  where not (copies->'blockedSectionIds') ? id
   and not exists(select 1 from public.core_document_folder_authorities a where a.org_id=p_org_id and a.section_id=id
    and not public.workspace_ai_folder_available(p_org_id,p_canvas_id,a.project_id,a.folder_id,p_actor_id));
 return jsonb_build_object('fileIds',files,'sectionIds',sections);
end $$;
revoke all on function public.filter_workspace_ai_sources(uuid,text,uuid,uuid[],text[]) from public,anon,authenticated,service_role;
grant execute on function public.filter_workspace_ai_sources(uuid,text,uuid,uuid[],text[]) to service_role;
comment on function public.filter_workspace_ai_sources(uuid,text,uuid,uuid[],text[]) is
 'Actor-bound AI context filter, not an access grant. Restricted sources require the current canvas grant even for the owner. Unbound/inherited organization sources preserve existing eligibility. Source callers still validate existence, revisions, entitlement and retained dependencies.';
commit;
