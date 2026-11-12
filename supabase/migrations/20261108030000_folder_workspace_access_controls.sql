-- Review and patch existing restricted-folder workspace grants. No activation.
begin;
create function public.project_folder_access_review(
 p_project_id uuid,p_folder_id uuid,p_actor_id uuid,
 p_expected_revision bigint default null,p_members jsonb default null,p_workspace_changes jsonb default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid; base jsonb; item jsonb; workspaces jsonb;
 writing boolean:=p_members is not null or p_workspace_changes is not null;
begin
 select org_id into org from public.organization_projects where id=p_project_id;
 if auth.role() is distinct from 'service_role' or p_actor_id is null or org is null
  or p_actor_id is distinct from public.organization_activity_actor_id()
  or not public.can_read_workspace_particle_origins(org,p_actor_id) then
  raise exception 'Folder access required.' using errcode='42501'; end if;
 if writing then
  perform public.guard_organization_closure(org);
  perform public.lock_workspace_source_projects(org);
  perform 1 from public.organization_projects where id=p_project_id and org_id=org for update nowait;
 end if;
 -- Existing command supplies parent, fiscal, creator and direct-member checks.
 base:=public.project_folder_access_control(p_project_id,p_folder_id,p_actor_id);
 if writing then
  if not (base->>'canManage')::boolean then
   raise exception 'Folder management access required.' using errcode='42501'; end if;
  if p_expected_revision is null or to_jsonb(p_expected_revision)<>base->'revision' then
   raise exception 'Folder access changed. Reload before saving.' using errcode='40001'; end if;
 end if;
 if p_workspace_changes is not null then
  if jsonb_typeof(p_workspace_changes) is distinct from 'array' or jsonb_array_length(p_workspace_changes)>50 then
   raise exception 'Invalid workspace changes.' using errcode='22023'; end if;
  if exists(select 1 from jsonb_array_elements(p_workspace_changes) g where jsonb_typeof(g) is distinct from 'object'
    or g-array['canvasId','capability','revision']<>'{}'::jsonb
    or jsonb_typeof(g->'canvasId') is distinct from 'string'
    or not (g->>'canvasId'='default' or g->>'canvasId' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
    or not (g ? 'capability') or (g->'capability'<>'null'::jsonb and g->>'capability' not in ('view','edit','manage'))
    or jsonb_typeof(g->'revision') is distinct from 'number')
   or exists(select 1 from jsonb_array_elements(p_workspace_changes) g group by g->>'canvasId' having count(*)>1) then
   raise exception 'Invalid workspace change.' using errcode='22023'; end if;
  -- Validate the entire patch before changing either direct or workspace access.
  -- The organization lock serializes audience, catalog and membership changes.
  for item in select value from jsonb_array_elements(p_workspace_changes) loop
   if not public.workspace_source_actor_can(org,item->>'canvasId',p_actor_id,'manage')
    or not public.workspace_canvas_actor_can(org,item->>'canvasId',p_actor_id,'view') then
    raise exception 'Workspace source management access required.' using errcode='42501'; end if;
   if not exists(select 1 from public.workspace_source_audiences a
     where a.org_id=org and a.canvas_id=item->>'canvasId' and to_jsonb(a.revision)=item->'revision') then
    raise exception 'Workspace access changed. Reload before saving.' using errcode='40001'; end if;
  end loop;
 end if;
 if p_members is not null then
  base:=public.project_folder_access_control(p_project_id,p_folder_id,p_actor_id,p_expected_revision,p_members);
 end if;
 if p_workspace_changes is not null and jsonb_array_length(p_workspace_changes)>0 then
  for item in select value from jsonb_array_elements(p_workspace_changes) loop
   if item->'capability'='null'::jsonb then
    delete from public.project_folder_workspace_grants where project_id=p_project_id and folder_id=p_folder_id and canvas_id=item->>'canvasId';
   else
    insert into public.project_folder_workspace_grants(project_id,folder_id,org_id,canvas_id,capability)
     values(p_project_id,p_folder_id,org,item->>'canvasId',item->>'capability')
     on conflict(project_id,folder_id,canvas_id) do update set capability=excluded.capability;
   end if;
  end loop;
  if (select count(*) from public.project_folder_workspace_grants where project_id=p_project_id and folder_id=p_folder_id)>50 then
   raise exception 'Too many workspace grants.' using errcode='22023'; end if;
  if not public.project_folder_actor_can(p_project_id,p_folder_id,p_actor_id,'manage') then
   raise exception 'Keep your folder management access.' using errcode='42501'; end if;
  -- One folder revision per combined save, including workspace-only commands.
  if p_members is null then
   update public.project_asset_folders set access_revision=access_revision+1 where project_id=p_project_id and id=p_folder_id;
   update public.organization_projects set updated_by=p_actor_id where id=p_project_id;
  end if;
  base:=public.project_folder_access_control(p_project_id,p_folder_id,p_actor_id);
 end if;
 -- Names are returned only for currently visible, live workspace scopes.
 -- Hidden and unmanageable grants are preserved by patch semantics.
 select coalesce(jsonb_agg(jsonb_build_object('id',a.canvas_id,
   'name',case when a.canvas_id='default' then coalesce(b.state#>>'{workspaceCatalog,defaultName}','Main workspace')
    else (select e->>'name' from jsonb_array_elements(b.state#>'{workspaceCatalog,entries}') e where e->>'id'=a.canvas_id) end,
   'revision',a.revision,'capability',g.capability,
   'canManage',(base->>'canManage')::boolean and public.workspace_source_actor_can(org,a.canvas_id,p_actor_id,'manage'))
   order by a.canvas_id),'[]'::jsonb) into workspaces
 from public.workspace_source_audiences a
 join public.organization_workspace_boards b on b.org_id=a.org_id
 left join public.project_folder_workspace_grants g on g.org_id=a.org_id and g.canvas_id=a.canvas_id and g.project_id=p_project_id and g.folder_id=p_folder_id
 where a.org_id=org and (base->>'restricted')::boolean
  and public.workspace_source_actor_can(org,a.canvas_id,p_actor_id,'view')
  and public.workspace_canvas_actor_can(org,a.canvas_id,p_actor_id,'view')
  and (g.canvas_id is not null or ((base->>'canManage')::boolean and public.workspace_source_actor_can(org,a.canvas_id,p_actor_id,'manage')));
 return base||jsonb_build_object('workspaces',workspaces);
exception when lock_not_available then raise exception 'Access is changing. Retry.' using errcode='40001';
end $$;
revoke all on function public.project_folder_access_review(uuid,uuid,uuid,bigint,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.project_folder_access_review(uuid,uuid,uuid,bigint,jsonb,jsonb) to service_role;
commit;
