-- Page management follows private-canvas authority without requiring the source
-- canvas to survive. Reviewed public/guest snapshots retain their own grants.
begin;
create function public.workspace_page_canvas_manager(p_org uuid,p_canvas uuid,p_actor uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select public.workspace_canvas_actor_can(p_org,coalesce(p_canvas::text,'default'),p_actor,'manage')
 and (p_actor=p_org or exists(select 1 from public.organization_memberships
  where org_id=p_org and member_id=p_actor and role in ('owner','admin','staff')));
$$;
revoke all on function public.workspace_page_canvas_manager(uuid,uuid,uuid) from public,anon,authenticated,service_role;
-- RLS wrapper never accepts an actor supplied by an authenticated caller.
create function public.can_manage_workspace_page_canvas(p_org uuid,p_canvas uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select public.workspace_page_canvas_manager(p_org,p_canvas,auth.uid());
$$;
revoke all on function public.can_manage_workspace_page_canvas(uuid,uuid) from public,anon;
grant execute on function public.can_manage_workspace_page_canvas(uuid,uuid) to authenticated;
create policy workspace_pages_canvas_management on public.organization_workspace_pages
 as restrictive for select to authenticated
 using(public.can_manage_workspace_page_canvas(org_id,canvas_id));

-- One fresh bounded check for an assembled directory, not one board read/page.
create function public.filter_workspace_page_management_canvases(p_org_id uuid,p_actor_id uuid,p_canvas_ids text[])
returns text[] language plpgsql stable security definer set search_path='' as $$
declare result text[];
begin
 if auth.role() is distinct from 'service_role' or p_actor_id is null
  or p_actor_id is distinct from public.organization_activity_actor_id() then
  raise exception 'Verified page actor required.' using errcode='42501';end if;
 if not public.can_read_workspace_particle_origins(p_org_id,p_actor_id) then
  raise exception 'Page management unavailable.' using errcode='42501';end if;
 if p_canvas_ids is null or cardinality(p_canvas_ids)>50 or array_position(p_canvas_ids,null) is not null then
  raise exception 'Invalid page canvases.' using errcode='22023';end if;
 select coalesce(array_agg(distinct canvas),'{}'::text[]) into result from unnest(p_canvas_ids) canvas
 where public.workspace_page_canvas_manager(p_org_id,nullif(canvas,'default')::uuid,p_actor_id);
 return result;
end $$;
revoke all on function public.filter_workspace_page_management_canvases(uuid,uuid,text[]) from public,anon,authenticated;
grant execute on function public.filter_workspace_page_management_canvases(uuid,uuid,text[]) to service_role;

-- Guard exact existing boundaries, retaining canonical CAS, replay, closure,
-- source checks, lock order and grants. Abort if upstream definitions drift.
do $$
declare target regprocedure; previous text; replacement text; definition text;
begin
 for target,previous,replacement in select * from (values
 ('public.prune_workspace_source_audiences()'::regprocedure,
  'delete from public.workspace_source_audiences a where a.org_id=org and not public.workspace_source_scope_exists(org,a.canvas_id);',
  '-- Keep private audience tombstones for retained pages/history. Folder grants
  -- still retire on deletion and cannot revive if a canvas ID is restored.
  delete from public.project_folder_workspace_grants g where g.org_id=org and not public.workspace_source_scope_exists(org,g.canvas_id);
  delete from public.workspace_source_audiences a where a.org_id=org and not a.canvas_private and not public.workspace_source_scope_exists(org,a.canvas_id);'),
 ('public.commit_workspace_page(uuid,uuid,uuid,uuid,text,integer,text,jsonb,jsonb,jsonb,timestamptz,jsonb,jsonb,uuid,jsonb,jsonb,jsonb)'::regprocedure,
  'perform public.guard_organization_closure(p_org_id);',
  'perform public.guard_organization_closure(p_org_id);
 if not public.workspace_page_canvas_manager(p_org_id,p_canvas_id,p_actor_id) then
  raise exception ''Page management unavailable.'' using errcode=''42501'';end if;'),
 ('public.workspace_page_guest_command_before_closure(uuid,uuid,jsonb,text)'::regprocedure,
  'if is_org_editor then permission:=''manage'';',
  'is_org_editor:=is_org_editor and public.workspace_page_canvas_manager(page.org_id,page.canvas_id,p_actor_id);
  if is_org_editor then permission:=''manage'';'),
 ('public.read_workspace_page_image_before_closure(uuid,text,uuid)'::regprocedure,
  'elsif p_audience=''editor'' and p_actor_id is not null then',
  'elsif p_audience=''editor'' and p_actor_id is not null then
    if not public.workspace_page_canvas_manager(page.org_id,page.canvas_id,p_actor_id) then return null;end if;'),
 ('public.read_workspace_page_document_before_closure(uuid,text,uuid)'::regprocedure,
  'elsif p_audience=''editor'' and p_actor_id is not null then',
  'elsif p_audience=''editor'' and p_actor_id is not null then
    if not public.workspace_page_canvas_manager(page.org_id,page.canvas_id,p_actor_id) then return null;end if;')
 ) as boundaries(target,previous,replacement) loop
  definition:=pg_get_functiondef(target);
  if (length(definition)-length(replace(definition,previous,'')))/length(previous)<>1 then
   raise exception 'Expected one page canvas boundary: %',target;end if;
  execute replace(definition,previous,replacement);
 end loop;
end $$;
commit;
