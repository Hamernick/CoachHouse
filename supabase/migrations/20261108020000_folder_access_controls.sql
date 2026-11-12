-- Review existing folder authority; never activate restricted folders or move files.
begin;
create function public.project_folder_access_control(
 p_project_id uuid,p_folder_id uuid,p_actor_id uuid,
 p_expected_revision bigint default null,p_members jsonb default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.organization_projects%rowtype; f public.project_asset_folders%rowtype;
 manager boolean; roster jsonb; member uuid;
begin
 select * into p from public.organization_projects where id=p_project_id;
 if auth.role() is distinct from 'service_role' or p_actor_id is null
  or p_actor_id is distinct from public.organization_activity_actor_id()
  or p.id is null or not public.can_read_workspace_particle_origins(p.org_id,p_actor_id) then
  raise exception 'Folder access required.' using errcode='42501'; end if;
 if current_setting('transaction_isolation')<>'read committed' then
  raise exception 'Access changed. Reload and try again.' using errcode='40001'; end if;
 -- Same organization/project ordering as source revocation and file writes.
 if p_members is not null then
  perform public.guard_organization_closure(p.org_id);
  perform public.lock_workspace_source_projects(p.org_id);
  perform 1 from public.organization_projects where id=p.id and org_id=p.org_id for update nowait;
 else
  perform 1 from public.organizations where user_id=p.org_id for share nowait;
  perform 1 from public.organization_projects where id=p.id and org_id=p.org_id for share nowait;
 end if;
 if not found or exists(select 1 from public.fiscal_guest_submissions where project_id=p.id)
  or not public.can_read_workspace_particle_origins(p.org_id,p_actor_id)
  or not public.project_folder_actor_can(p.id,p_folder_id,p_actor_id,'view') then
  raise exception 'Folder access required.' using errcode='42501'; end if;
 select * into f from public.project_asset_folders where project_id=p.id and id=p_folder_id for share nowait;
 if not found then raise exception 'Folder unavailable.' using errcode='42501'; end if;
 manager:=f.audience='restricted' and public.project_folder_actor_can(p.id,f.id,p_actor_id,'manage');
 if p_members is not null then
  if not manager then raise exception 'Folder management access required.' using errcode='42501'; end if;
  if jsonb_typeof(p_members) is distinct from 'array' or jsonb_array_length(p_members)>100 then
   raise exception 'Invalid folder audience.' using errcode='22023'; end if;
  if exists(select 1 from jsonb_array_elements(p_members) g where jsonb_typeof(g) is distinct from 'object'
   or g-array['memberId','capability']<>'{}'::jsonb or jsonb_typeof(g->'memberId') is distinct from 'string'
   or g->>'capability' is null or g->>'capability' not in ('view','edit','manage'))
   or exists(select 1 from jsonb_array_elements(p_members) g group by g->>'memberId' having count(*)>1) then
   raise exception 'Invalid folder member.' using errcode='22023'; end if;
  for member in select (g->>'memberId')::uuid from jsonb_array_elements(p_members) g loop
   if member=p.org_id then raise exception 'The owner retains access.' using errcode='22023'; end if;
   if member=f.created_by and exists(select 1 from public.organization_memberships
     where org_id=p.org_id and member_id=member and created_at=f.creator_membership_created_at) then
    raise exception 'The creator retains access.' using errcode='22023'; end if;
  end loop;
  perform public.set_project_asset_folder_access(p.id,f.id,p_actor_id,p_expected_revision,'restricted',p_members);
  select * into f from public.project_asset_folders where project_id=p.id and id=p_folder_id;
 end if;
 -- Workspace-derived permissions remain separate from editable direct grants.
 -- Do not disclose private workspace names or pretend direct removal revokes them.
 with people as (select p.org_id id union select member_id from public.organization_memberships where org_id=p.org_id),
 rows as (
  select people.id,coalesce(nullif(to_jsonb(profile)->>'full_name',''),nullif(to_jsonb(profile)->>'email',''),'Team member') name,
   people.id=p.org_id owner,
   f.audience='restricted' and people.id=f.created_by and m.created_at=f.creator_membership_created_at creator,
   case when f.audience='inherited' then case when people.id=p.org_id or m.role in ('owner','admin','staff') then 'edit' else 'view' end
    else g.capability end capability,
   (select cap from unnest(array['manage','edit','view']) with ordinality c(cap,n)
    where exists(select 1 from public.project_folder_workspace_grants w where w.project_id=p.id and w.folder_id=f.id
      and array_position(array['view','edit','manage'],w.capability)>=array_position(array['view','edit','manage'],c.cap)
      and public.workspace_source_actor_can(w.org_id,w.canvas_id,people.id,c.cap)) order by n limit 1) inherited
  from people join public.profiles profile on profile.id=people.id
  left join public.organization_memberships m on m.org_id=p.org_id and m.member_id=people.id
  left join public.project_asset_folder_grants g on g.project_id=p.id and g.folder_id=f.id and g.member_id=people.id and g.membership_created_at=m.created_at
 )
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'owner',owner,'capability',capability,'inheritedCapability',inherited)
   ||case when creator and not owner then '{"retained":"Creator"}'::jsonb else '{}'::jsonb end order by not owner,id),'[]'::jsonb)
 into roster from rows where manager or f.audience='inherited' or owner or creator or capability is not null or inherited is not null;
 return jsonb_build_object('name',f.name,'deleted',false,'restricted',f.audience='restricted',
  'canManage',manager,'revision',f.access_revision,'members',roster);
exception when lock_not_available then raise exception 'Access is changing. Retry.' using errcode='40001';
end $$;
revoke all on function public.project_folder_access_control(uuid,uuid,uuid,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.project_folder_access_control(uuid,uuid,uuid,bigint,jsonb) to service_role;
commit;
