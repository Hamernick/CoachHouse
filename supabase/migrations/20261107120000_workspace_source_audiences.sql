-- Explicit source audiences attached to existing canvas identities. This does
-- not make a canvas private or activate restricted file placement. Existing
-- source, project, organization and provider checks remain mandatory.
begin;

create table public.workspace_source_audiences (
  org_id uuid not null references public.organizations(user_id) on delete cascade,
  canvas_id text not null check (canvas_id='default' or canvas_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
  revision bigint not null default 0 check (revision>=0),
  primary key(org_id,canvas_id)
);
create table public.workspace_source_audience_members (
  org_id uuid not null,
  canvas_id text not null,
  member_id uuid not null references public.profiles(id) on delete cascade,
  membership_created_at timestamptz not null,
  capability text not null check (capability in ('view','edit','manage')),
  primary key(org_id,canvas_id,member_id),
  foreign key(org_id,canvas_id) references public.workspace_source_audiences on delete cascade
);
create table public.project_folder_workspace_grants (
  project_id uuid not null,
  folder_id uuid not null,
  org_id uuid not null,
  canvas_id text not null,
  capability text not null check (capability in ('view','edit','manage')),
  primary key(project_id,folder_id,canvas_id),
  foreign key(project_id,folder_id) references public.project_asset_folders(project_id,id) on delete cascade,
  foreign key(org_id,canvas_id) references public.workspace_source_audiences on delete cascade
);
create index project_folder_workspace_grants_scope on public.project_folder_workspace_grants(org_id,canvas_id,project_id);
alter table public.workspace_source_audiences enable row level security;
alter table public.workspace_source_audiences force row level security;
alter table public.workspace_source_audience_members enable row level security;
alter table public.workspace_source_audience_members force row level security;
alter table public.project_folder_workspace_grants enable row level security;
alter table public.project_folder_workspace_grants force row level security;
revoke all on public.workspace_source_audiences,public.workspace_source_audience_members,public.project_folder_workspace_grants
  from public,anon,authenticated,service_role;

create function public.workspace_source_scope_exists(p_org uuid,p_canvas text) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare state jsonb; catalog jsonb;
begin
  select b.state into state from public.organization_workspace_boards b where org_id=p_org;
  if not found or jsonb_typeof(state) is distinct from 'object' then return false; end if;
  catalog:=state->'workspaceCatalog';
  if catalog is null then return p_canvas='default'; end if;
  if jsonb_typeof(catalog) is distinct from 'object' or catalog->'version' is distinct from '1'::jsonb
    or jsonb_typeof(catalog->'entries') is distinct from 'array' then return false; end if;
  if p_canvas='default' then return coalesce(catalog->'defaultDeleted','false'::jsonb)='false'::jsonb; end if;
  return (select count(*)=1 from jsonb_array_elements(catalog->'entries') e where e->>'id'=p_canvas);
end $$;

create function public.workspace_source_actor_can(p_org uuid,p_canvas text,p_actor uuid,p_capability text) returns boolean
language sql stable security definer set search_path='' as $$
  select p_actor is not null and p_capability in ('view','edit','manage')
    and public.workspace_source_scope_exists(p_org,p_canvas)
    and exists(select 1 from public.workspace_source_audiences where org_id=p_org and canvas_id=p_canvas)
    and (p_actor=p_org or exists(select 1 from public.workspace_source_audience_members a
      join public.organization_memberships m on m.org_id=a.org_id and m.member_id=a.member_id and m.created_at=a.membership_created_at
      where a.org_id=p_org and a.canvas_id=p_canvas and a.member_id=p_actor
        and case p_capability when 'view' then true when 'edit' then a.capability in ('edit','manage') else a.capability='manage' end));
$$;

-- Project row locks are already held by document save, purge, board-source and
-- folder mutation fences. Taking the same locks makes scope revocation obey
-- that existing write/revoke ordering, without another authorization cache.
create function public.lock_workspace_source_projects(p_org uuid,p_canvas text default null) returns void
language plpgsql security definer set search_path='' as $$
begin
  if current_setting('transaction_isolation')<>'read committed' then
    raise exception 'Source access changed. Retry.' using errcode='40001'; end if;
  perform 1 from public.organizations where user_id=p_org for update nowait;
  perform 1 from public.organization_projects p where p.org_id=p_org and exists(
    select 1 from public.project_folder_workspace_grants g where g.project_id=p.id and g.org_id=p_org
      and (p_canvas is null or g.canvas_id=p_canvas)) order by p.id for update nowait;
exception when lock_not_available then
  raise exception 'Source access is changing. Retry.' using errcode='40001';
end $$;

create function public.set_workspace_source_audience(p_org_id uuid,p_canvas_id text,p_actor_id uuid,p_expected_revision bigint,p_members jsonb)
returns bigint language plpgsql security definer set search_path='' as $$
declare prior bigint; member uuid; permission text; stamp timestamptz;
begin
  if auth.role() is distinct from 'service_role' or p_actor_id is null
    or p_actor_id is distinct from public.organization_activity_actor_id()
    or not public.can_read_workspace_particle_origins(p_org_id,p_actor_id) then
    raise exception 'Source access management required.' using errcode='42501'; end if;
  perform public.lock_workspace_source_projects(p_org_id,p_canvas_id);
  -- Serialize with catalog removal; do not create an audience for an imagined,
  -- deleted, foreign or merely client-seeded workspace.
  perform 1 from public.organization_workspace_boards where org_id=p_org_id for share nowait;
  if not public.can_read_workspace_particle_origins(p_org_id,p_actor_id) then
    raise exception 'Source access management required.' using errcode='42501'; end if;
  if not public.workspace_source_scope_exists(p_org_id,p_canvas_id) then
    raise exception 'Workspace unavailable.' using errcode='42501'; end if;
  if p_actor_id<>p_org_id and not public.workspace_source_actor_can(p_org_id,p_canvas_id,p_actor_id,'manage') then
    raise exception 'Source access management required.' using errcode='42501'; end if;
  if p_expected_revision is null or jsonb_typeof(p_members) is distinct from 'array' or jsonb_array_length(p_members)>500 then
    raise exception 'Invalid workspace audience.' using errcode='22023'; end if;
  if exists(select 1 from jsonb_array_elements(p_members) g where jsonb_typeof(g) is distinct from 'object'
    or g-array['memberId','capability']<>'{}'::jsonb or jsonb_typeof(g->'memberId') is distinct from 'string'
    or g->>'capability' is null or g->>'capability' not in ('view','edit','manage')) then
    raise exception 'Invalid workspace member.' using errcode='22023'; end if;
  insert into public.workspace_source_audiences(org_id,canvas_id) values(p_org_id,p_canvas_id) on conflict do nothing;
  select revision into prior from public.workspace_source_audiences where org_id=p_org_id and canvas_id=p_canvas_id for update;
  if prior<>p_expected_revision then raise exception 'Workspace audience changed. Refresh and try again.' using errcode='40001'; end if;
  delete from public.workspace_source_audience_members where org_id=p_org_id and canvas_id=p_canvas_id;
  for member,permission in select (g->>'memberId')::uuid,g->>'capability' from jsonb_array_elements(p_members) g loop
    if member=p_org_id then raise exception 'The owner already retains access.' using errcode='22023'; end if;
    select created_at into stamp from public.organization_memberships where org_id=p_org_id and member_id=member for share nowait;
    if not found then raise exception 'Choose a current team member.' using errcode='42501'; end if;
    insert into public.workspace_source_audience_members values(p_org_id,p_canvas_id,member,stamp,permission);
  end loop;
  if not public.workspace_source_actor_can(p_org_id,p_canvas_id,p_actor_id,'manage') then
    raise exception 'Keep your management access.' using errcode='42501'; end if;
  update public.workspace_source_audiences set revision=revision+1 where org_id=p_org_id and canvas_id=p_canvas_id;
  return prior+1;
exception when lock_not_available then
  raise exception 'Source access is changing. Retry.' using errcode='40001';
end $$;

-- Existing individual/creator/owner authority is preserved. Each workspace
-- grant is capped by BOTH its folder capability and the member's capability.
alter function public.project_folder_actor_can(uuid,uuid,uuid,text) rename to project_folder_actor_can_before_workspaces;
create function public.project_folder_actor_can(p_project uuid,p_folder uuid,p_actor uuid,p_capability text) returns boolean
language sql stable security definer set search_path='' as $$
  select public.project_folder_actor_can_before_workspaces(p_project,p_folder,p_actor,p_capability)
    or (p_actor is not null and p_capability in ('view','edit','manage') and exists(
      select 1 from public.project_folder_workspace_grants g
      join public.organization_projects p on p.id=g.project_id and p.org_id=g.org_id
      join public.project_asset_folders f on f.project_id=g.project_id and f.id=g.folder_id and f.audience='restricted'
      where g.project_id=p_project and g.folder_id=p_folder
        and case p_capability when 'view' then true when 'edit' then g.capability in ('edit','manage') else g.capability='manage' end
        and public.workspace_source_actor_can(g.org_id,g.canvas_id,p_actor,p_capability)));
$$;

create function public.set_project_folder_workspace_grants(p_project_id uuid,p_folder_id uuid,p_actor_id uuid,p_expected_revision bigint,p_grants jsonb)
returns bigint language plpgsql security definer set search_path='' as $$
declare org uuid; prior bigint; g jsonb;
begin
  select org_id into org from public.organization_projects where id=p_project_id;
  if auth.role() is distinct from 'service_role' or p_actor_id is null or org is null
    or p_actor_id is distinct from public.organization_activity_actor_id()
    or not public.can_read_workspace_particle_origins(org,p_actor_id) then
    raise exception 'Folder management access required.' using errcode='42501'; end if;
  perform public.lock_workspace_source_projects(org);
  perform 1 from public.organization_projects where id=p_project_id and org_id=org for update nowait;
  if not found or exists(select 1 from public.fiscal_guest_submissions where project_id=p_project_id) then
    raise exception 'Project unavailable.' using errcode='42501'; end if;
  if not public.can_read_workspace_particle_origins(org,p_actor_id) then
    raise exception 'Folder management access required.' using errcode='42501'; end if;
  if not public.project_folder_actor_can(p_project_id,p_folder_id,p_actor_id,'manage') then
    raise exception 'Folder management access required.' using errcode='42501'; end if;
  select access_revision into prior from public.project_asset_folders where project_id=p_project_id and id=p_folder_id and audience='restricted' for update;
  if not found then raise exception 'Restricted folder required.' using errcode='42501'; end if;
  if p_expected_revision is null or prior<>p_expected_revision then raise exception 'Folder access changed. Refresh and try again.' using errcode='40001'; end if;
  if jsonb_typeof(p_grants) is distinct from 'array' or jsonb_array_length(p_grants)>50 then
    raise exception 'Invalid workspace grants.' using errcode='22023'; end if;
  delete from public.project_folder_workspace_grants where project_id=p_project_id and folder_id=p_folder_id;
  for g in select value from jsonb_array_elements(p_grants) loop
    if jsonb_typeof(g) is distinct from 'object' or g-array['canvasId','capability','revision']<>'{}'::jsonb
      or jsonb_typeof(g->'canvasId') is distinct from 'string' or g->>'capability' is null
      or g->>'capability' not in ('view','edit','manage') or jsonb_typeof(g->'revision') is distinct from 'number' then
      raise exception 'Invalid workspace grant.' using errcode='22023'; end if;
    if not public.workspace_source_actor_can(org,g->>'canvasId',p_actor_id,'manage') then
      raise exception 'Workspace source management access required.' using errcode='42501'; end if;
    if not exists(select 1 from public.workspace_source_audiences where org_id=org and canvas_id=g->>'canvasId' and to_jsonb(revision)=g->'revision') then
      raise exception 'Workspace audience changed. Refresh and try again.' using errcode='40001'; end if;
    insert into public.project_folder_workspace_grants values(p_project_id,p_folder_id,org,g->>'canvasId',g->>'capability');
  end loop;
  if not public.project_folder_actor_can(p_project_id,p_folder_id,p_actor_id,'manage') then
    raise exception 'Keep your folder management access.' using errcode='42501'; end if;
  update public.project_asset_folders set access_revision=access_revision+1 where project_id=p_project_id and id=p_folder_id;
  update public.organization_projects set updated_by=p_actor_id where id=p_project_id;
  return prior+1;
exception when lock_not_available then
  raise exception 'Source access is changing. Retry.' using errcode='40001';
end $$;

create function public.prune_workspace_source_audiences() returns trigger
language plpgsql security definer set search_path='' as $$
declare org uuid;
begin
  if tg_table_name='organization_memberships' then
    org:=old.org_id;
    if not exists(select 1 from public.workspace_source_audience_members where org_id=org and member_id=old.member_id) then return old; end if;
    perform public.lock_workspace_source_projects(org);
    update public.workspace_source_audiences a set revision=revision+1 where a.org_id=org and exists(
      select 1 from public.workspace_source_audience_members m where m.org_id=a.org_id and m.canvas_id=a.canvas_id and m.member_id=old.member_id);
    delete from public.workspace_source_audience_members where org_id=org and member_id=old.member_id;
    return old;
  end if;
  org:=old.org_id;
  if not exists(select 1 from public.workspace_source_audiences where org_id=org) then return old; end if;
  if tg_op='UPDATE' and new.state->'workspaceCatalog' is not distinct from old.state->'workspaceCatalog' then return new; end if;
  -- Named-canvas edits also change catalog JSON. Only actual scope removal
  -- needs project locks; ordinary edits and renames keep their existing path.
  if tg_op='UPDATE' and not exists(select 1 from public.workspace_source_audiences a
    where a.org_id=org and not public.workspace_source_scope_exists(org,a.canvas_id)) then return new; end if;
  perform public.lock_workspace_source_projects(org);
  delete from public.workspace_source_audiences a where a.org_id=org and not public.workspace_source_scope_exists(org,a.canvas_id);
  return old;
end $$;
create trigger removed_member_source_audiences after delete on public.organization_memberships
for each row execute function public.prune_workspace_source_audiences();
create trigger removed_workspace_source_audiences after update or delete on public.organization_workspace_boards
for each row execute function public.prune_workspace_source_audiences();

create function public.clear_inherited_workspace_folder_grants() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.audience='inherited' then delete from public.project_folder_workspace_grants where project_id=new.project_id and folder_id=new.id; end if;
  return new;
end $$;
create trigger inherited_workspace_folder_grants after update of audience on public.project_asset_folders
for each row execute function public.clear_inherited_workspace_folder_grants();

-- Recurring projects retain the same explicit source audience, not a broader
-- copy inferred from the new project's name or people assignments.
do $$ declare body text; needle text;
begin
  body:=pg_get_functiondef('public.generate_next_monthly_project()'::regprocedure);
  needle:='select v_next_id,folder_id,member_id,capability,membership_created_at from public.project_asset_folder_grants where project_id=v_project.id;';
  if strpos(body,needle)=0 then raise exception 'Recurrence folder grants changed; inspect before applying.'; end if;
  execute replace(body,needle,needle||'
    insert into public.project_folder_workspace_grants(project_id,folder_id,org_id,canvas_id,capability)
      select v_next_id,folder_id,org_id,canvas_id,capability from public.project_folder_workspace_grants where project_id=v_project.id;');
end $$;

revoke all on function public.workspace_source_scope_exists(uuid,text),public.workspace_source_actor_can(uuid,text,uuid,text),
  public.lock_workspace_source_projects(uuid,text),public.project_folder_actor_can_before_workspaces(uuid,uuid,uuid,text),
  public.project_folder_actor_can(uuid,uuid,uuid,text),public.prune_workspace_source_audiences(),public.clear_inherited_workspace_folder_grants(),
  public.set_workspace_source_audience(uuid,text,uuid,bigint,jsonb),public.set_project_folder_workspace_grants(uuid,uuid,uuid,bigint,jsonb)
  from public,anon,authenticated,service_role;
grant execute on function public.set_workspace_source_audience(uuid,text,uuid,bigint,jsonb),
  public.set_project_folder_workspace_grants(uuid,uuid,uuid,bigint,jsonb) to service_role;
commit;
