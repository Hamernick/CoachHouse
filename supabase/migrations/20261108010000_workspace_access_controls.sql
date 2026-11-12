-- Review existing access without activating canvas privacy. The write path only
-- manages already-private audiences; deleted scopes permit reductions only.
begin;
create function public.workspace_access_control(
 p_org_id uuid,p_canvas_id text,p_actor_id uuid,
 p_expected_revision bigint default null,p_members jsonb default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare audience public.workspace_source_audiences%rowtype; live boolean; manager boolean;
 member uuid; permission text; stamp timestamptz; prior_permission text; roster jsonb; title text;
begin
 if auth.role() is distinct from 'service_role' or p_actor_id is null
  or p_actor_id is distinct from public.organization_activity_actor_id()
  or not public.can_read_workspace_particle_origins(p_org_id,p_actor_id) then
  raise exception 'Workspace access required.' using errcode='42501'; end if;
 if p_canvas_id is null or not (p_canvas_id='default' or p_canvas_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') then
  raise exception 'Invalid workspace.' using errcode='22023'; end if;
 if current_setting('transaction_isolation')<>'read committed' then
  raise exception 'Access changed. Reload and try again.' using errcode='40001'; end if;
 if p_members is not null then
  perform public.guard_organization_closure(p_org_id);
  perform public.lock_workspace_source_projects(p_org_id,p_canvas_id);
 else
  perform 1 from public.organizations where user_id=p_org_id for share nowait;
 end if;
 perform 1 from public.organization_workspace_boards where org_id=p_org_id for share nowait;
 if not public.workspace_canvas_actor_can(p_org_id,p_canvas_id,p_actor_id,'view') then
  raise exception 'Workspace access required.' using errcode='42501'; end if;
 select * into audience from public.workspace_source_audiences where org_id=p_org_id and canvas_id=p_canvas_id;
 live:=public.workspace_source_scope_exists(p_org_id,p_canvas_id);
 if not live and not coalesce(audience.canvas_private,false) then
  raise exception 'Workspace unavailable.' using errcode='42501'; end if;
 manager:=coalesce(audience.canvas_private,false) and public.workspace_canvas_actor_can(p_org_id,p_canvas_id,p_actor_id,'manage');
 if p_members is not null then
  if not manager then raise exception 'Workspace management access required.' using errcode='42501'; end if;
  if p_expected_revision is null or p_expected_revision<>audience.revision then
   raise exception 'Access changed. Reload and try again.' using errcode='40001'; end if;
  if jsonb_typeof(p_members) is distinct from 'array' or jsonb_array_length(p_members)>500 then
   raise exception 'Invalid workspace audience.' using errcode='22023'; end if;
  if exists(select 1 from jsonb_array_elements(p_members) g where jsonb_typeof(g) is distinct from 'object'
   or g-array['memberId','capability']<>'{}'::jsonb or jsonb_typeof(g->'memberId') is distinct from 'string'
   or g->>'capability' is null or g->>'capability' not in ('view','edit','manage'))
   or exists(select 1 from jsonb_array_elements(p_members) g group by g->>'memberId' having count(*)>1) then
   raise exception 'Invalid workspace member.' using errcode='22023'; end if;
  -- Validate before replacing; retained deleted scopes cannot gain new access.
  for member,permission in select (g->>'memberId')::uuid,g->>'capability' from jsonb_array_elements(p_members) g loop
   if member=p_org_id then raise exception 'The owner already retains access.' using errcode='22023'; end if;
   select created_at into stamp from public.organization_memberships where org_id=p_org_id and member_id=member for share nowait;
   if not found then raise exception 'Choose a current team member.' using errcode='42501'; end if;
   if not live then
    select capability into prior_permission from public.workspace_source_audience_members
     where org_id=p_org_id and canvas_id=p_canvas_id and member_id=member and membership_created_at=stamp;
    if prior_permission is null or array_position(array['view','edit','manage'],permission)>array_position(array['view','edit','manage'],prior_permission) then
     raise exception 'Deleted workspace access can only be reduced.' using errcode='42501'; end if;
   end if;
  end loop;
  if p_actor_id<>p_org_id and not exists(select 1 from jsonb_array_elements(p_members) g
   where g->>'memberId'=p_actor_id::text and g->>'capability'='manage') then
   raise exception 'Keep your management access.' using errcode='42501'; end if;
  delete from public.workspace_source_audience_members where org_id=p_org_id and canvas_id=p_canvas_id;
  insert into public.workspace_source_audience_members(org_id,canvas_id,member_id,membership_created_at,capability)
   select p_org_id,p_canvas_id,m.member_id,m.created_at,g->>'capability' from jsonb_array_elements(p_members) g
   join public.organization_memberships m on m.org_id=p_org_id and m.member_id=(g->>'memberId')::uuid;
  update public.workspace_source_audiences set revision=revision+1 where org_id=p_org_id and canvas_id=p_canvas_id returning * into audience;
 end if;
 select case when p_canvas_id='default' then coalesce(state#>>'{workspaceCatalog,defaultName}','Main workspace')
  else (select e->>'name' from jsonb_array_elements(state#>'{workspaceCatalog,entries}') e where e->>'id'=p_canvas_id) end
 into title from public.organization_workspace_boards where org_id=p_org_id;
 select coalesce(jsonb_agg(jsonb_build_object('id',people.id,'name',coalesce(nullif(to_jsonb(p)->>'full_name',''),nullif(to_jsonb(p)->>'email',''),'Team member'),
  'owner',people.id=p_org_id,'capability',case when people.id=p_org_id then 'manage' when audience.canvas_private then a.capability
   when m.role in ('owner','admin','staff') then 'edit' else 'view' end) order by people.id<>p_org_id,people.id),'[]'::jsonb)
 into roster from (select p_org_id id union select member_id from public.organization_memberships where org_id=p_org_id) people
 join public.profiles p on p.id=people.id
 left join public.organization_memberships m on m.org_id=p_org_id and m.member_id=people.id
 left join public.workspace_source_audience_members a on a.org_id=p_org_id and a.canvas_id=p_canvas_id and a.member_id=people.id and a.membership_created_at=m.created_at
 where not coalesce(audience.canvas_private,false) or people.id=p_org_id or a.member_id is not null or (manager and live);
 return jsonb_build_object('name',case when live then title else 'Deleted workspace' end,'deleted',not live,
  'restricted',coalesce(audience.canvas_private,false),'canManage',manager,'revision',coalesce(audience.revision,0),'members',roster);
exception when lock_not_available then
 raise exception 'Access is changing. Retry.' using errcode='40001';
end $$;
revoke all on function public.workspace_access_control(uuid,text,uuid,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.workspace_access_control(uuid,text,uuid,bigint,jsonb) to service_role;
commit;
