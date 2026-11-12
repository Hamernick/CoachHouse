-- Folder metadata authority. Restricted file placement remains unavailable
-- until canonical source/body/search/result audiences are connected.
begin;

alter table public.project_asset_folders
  add column audience text not null default 'inherited' check (audience in ('inherited','restricted')),
  add column created_by uuid references public.profiles(id) on delete set null,
  add column creator_membership_created_at timestamptz,
  add column access_revision bigint not null default 0 check (access_revision>=0);
-- Existing creator attribution is unknown; never invent it. The organization
-- owner always retains authority, including for migrated folders.
create table public.project_asset_folder_grants (
  project_id uuid not null,
  folder_id uuid not null,
  member_id uuid not null references public.profiles(id) on delete cascade,
  membership_created_at timestamptz,
  capability text not null check (capability in ('view','edit','manage')),
  primary key(project_id,folder_id,member_id),
  foreign key(project_id,folder_id) references public.project_asset_folders(project_id,id) on delete cascade
);
alter table public.project_asset_folder_grants enable row level security;
alter table public.project_asset_folder_grants force row level security;
revoke all on public.project_asset_folder_grants from public,anon,authenticated;
grant all on public.project_asset_folder_grants to service_role;

create function public.project_folder_actor_can(p_project uuid,p_folder uuid,p_actor uuid,p_capability text)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare f public.project_asset_folders%rowtype; organization_id uuid; permission text; membership_stamp timestamptz;
begin
  if p_actor is null or p_capability is null or p_capability not in ('view','edit','manage') then return false; end if;
  select * into f from public.project_asset_folders where project_id=p_project and id=p_folder;
  if not found then return false; end if;
  if f.audience='inherited' then return true; end if;
  select org_id into organization_id from public.organization_projects where id=p_project;
  if p_actor=organization_id then return true; end if;
  select created_at into membership_stamp from public.organization_memberships where org_id=organization_id and member_id=p_actor;
  if not found then return false; end if;
  if p_actor=f.created_by and membership_stamp=f.creator_membership_created_at then return true; end if;
  select capability into permission from public.project_asset_folder_grants
    where project_id=p_project and folder_id=p_folder and member_id=p_actor and membership_created_at=membership_stamp;
  return coalesce(case p_capability when 'view' then permission in ('view','edit','manage')
    when 'edit' then permission in ('edit','manage') else permission='manage' end,false);
end;
$$;
revoke all on function public.project_folder_actor_can(uuid,uuid,uuid,text) from public,anon,authenticated,service_role;

create function public.can_read_project_asset_folder(p_project uuid,p_folder uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select public.project_folder_actor_can(p_project,p_folder,auth.uid(),'view');
$$;
revoke all on function public.can_read_project_asset_folder(uuid,uuid) from public,anon;
grant execute on function public.can_read_project_asset_folder(uuid,uuid) to authenticated,service_role;
create policy project_folder_audience on public.project_asset_folders as restrictive for select to authenticated
using (public.can_read_project_asset_folder(project_id,id));
create policy project_folder_placement_audience on public.project_asset_folder_placements as restrictive for select to authenticated
using (public.can_read_project_asset_folder(project_id,folder_id));

-- Remove grants at membership deletion as well as checking membership on reads.
-- Rejoining (or reusing old membership timestamps) cannot revive old authority.
create function public.revoke_removed_member_folder_grants() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  update public.project_asset_folders f set access_revision=access_revision+1,
    creator_membership_created_at=case when f.created_by=old.member_id then null else f.creator_membership_created_at end
    from public.organization_projects p where p.id=f.project_id and p.org_id=old.org_id
      and (f.created_by=old.member_id or exists(select 1 from public.project_asset_folder_grants g
        where g.project_id=f.project_id and g.folder_id=f.id and g.member_id=old.member_id));
  delete from public.project_asset_folder_grants g using public.organization_projects p
    where p.id=g.project_id and p.org_id=old.org_id and g.member_id=old.member_id;
  return old;
end;
$$;
revoke all on function public.revoke_removed_member_folder_grants() from public,anon,authenticated,service_role;
create trigger removed_member_folder_grants after delete on public.organization_memberships
for each row execute function public.revoke_removed_member_folder_grants();

-- The existing server action already verifies parent project, paid access,
-- ordinary/fiscal scope and platform scope. Its elevated client must ALSO
-- filter private folders for the verified actor; service-role RLS is no filter.
create function public.read_project_asset_folders_for_actor(p_project_id uuid,p_actor_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare options jsonb;
begin
  if p_actor_id is null then raise exception 'Actor required.' using errcode='42501'; end if;
  select option_settings into options from public.organization_projects where id=p_project_id;
  if not found then raise exception 'Project unavailable.' using errcode='42501'; end if;
  if not exists(select 1 from public.project_asset_folder_libraries where project_id=p_project_id) then
    return coalesce(options->'assetFolders','{"folders":[],"placements":[]}'::jsonb);
  end if;
  return jsonb_build_object(
    'folders',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name) order by position,id)
      from public.project_asset_folders where project_id=p_project_id
      and public.project_folder_actor_can(project_id,id,p_actor_id,'view')),'[]'::jsonb),
    'placements',coalesce((select jsonb_agg(jsonb_build_object('fileKey',file_key,'folderId',folder_id) order by file_key)
      from public.project_asset_folder_placements where project_id=p_project_id
      and public.project_folder_actor_can(project_id,folder_id,p_actor_id,'view')),'[]'::jsonb));
end;
$$;
revoke all on function public.read_project_asset_folders_for_actor(uuid,uuid) from public,anon,authenticated;
grant execute on function public.read_project_asset_folders_for_actor(uuid,uuid) to service_role;

-- Until source ACL integration, a restricted folder can contain no file of any
-- adapter. This also fences elevated imports and old writer paths, not only UI.
create function public.guard_restricted_folder_contents() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  perform 1 from public.organization_projects where id=new.project_id for update;
  if tg_table_name='project_asset_folders' then
    if new.audience='restricted' and exists(select 1 from public.project_asset_folder_placements
      where project_id=new.project_id and folder_id=new.id) then
      raise exception 'Source permissions must be connected before restricting a folder with files.' using errcode='42501'; end if;
  else
    if exists(select 1 from public.project_asset_folders where project_id=new.project_id and id=new.folder_id and audience='restricted') then
      raise exception 'Source permissions are not enabled for restricted folders.' using errcode='42501'; end if;
  end if;
  return new;
end;
$$;
revoke all on function public.guard_restricted_folder_contents() from public,anon,authenticated,service_role;
create trigger restricted_folder_contents before insert or update of audience on public.project_asset_folders
for each row execute function public.guard_restricted_folder_contents();
create trigger restricted_folder_placement before insert or update on public.project_asset_folder_placements
for each row execute function public.guard_restricted_folder_contents();

-- No public action or privacy UI exposes this command yet. The trusted caller
-- supplies a server-authenticated actor; grants require current team identities.
create function public.set_project_asset_folder_access(
  p_project_id uuid,p_folder_id uuid,p_actor_id uuid,p_expected_revision bigint,p_audience text,p_grants jsonb
) returns bigint language plpgsql security definer set search_path='' as $$
declare p public.organization_projects%rowtype; f public.project_asset_folders%rowtype; member uuid; permission text; membership_stamp timestamptz;
begin
  select * into p from public.organization_projects where id=p_project_id for update;
  if not found or p_actor_id is null or exists(select 1 from public.fiscal_guest_submissions where project_id=p.id) then
    raise exception 'Project unavailable.' using errcode='42501'; end if;
  select * into f from public.project_asset_folders where project_id=p.id and id=p_folder_id for update;
  if not found then raise exception 'Folder unavailable.' using errcode='42501'; end if;
  if f.audience='inherited' then
    if p.org_id<>p_actor_id and not exists(select 1 from public.organization_memberships
      where org_id=p.org_id and member_id=p_actor_id and role in ('owner','admin','staff')) then
      raise exception 'Folder management access required.' using errcode='42501'; end if;
  elsif not public.project_folder_actor_can(p.id,f.id,p_actor_id,'manage') then
    raise exception 'Folder management access required.' using errcode='42501';
  end if;
  if p_expected_revision is null or p_expected_revision<>f.access_revision then
    raise exception 'Folder access changed. Refresh and try again.' using errcode='40001'; end if;
  if p_audience is null or p_audience not in ('inherited','restricted')
    or jsonb_typeof(p_grants) is distinct from 'array' then raise exception 'Invalid folder access.' using errcode='22023'; end if;
  if jsonb_array_length(p_grants)>100 or (p_audience='inherited' and p_grants<>'[]'::jsonb) then
    raise exception 'Invalid folder grants.' using errcode='22023'; end if;
  if exists(select 1 from jsonb_array_elements(p_grants) g where jsonb_typeof(g) is distinct from 'object'
    or g-array['memberId','capability']<>'{}'::jsonb or jsonb_typeof(g->'memberId') is distinct from 'string'
    or jsonb_typeof(g->'capability') is distinct from 'string') then raise exception 'Invalid folder grant.' using errcode='22023'; end if;
  delete from public.project_asset_folder_grants where project_id=p.id and folder_id=f.id;
  for member,permission in select (g->>'memberId')::uuid,g->>'capability' from jsonb_array_elements(p_grants) g loop
    if member<>p.org_id and not exists(select 1 from public.organization_memberships where org_id=p.org_id and member_id=member) then
      raise exception 'Choose a current team member.' using errcode='42501'; end if;
    select created_at into membership_stamp from public.organization_memberships where org_id=p.org_id and member_id=member for key share;
    if member<>p.org_id and not found then raise exception 'Team membership changed.' using errcode='42501'; end if;
    insert into public.project_asset_folder_grants(project_id,folder_id,member_id,capability,membership_created_at) values(p.id,f.id,member,permission,membership_stamp);
  end loop;
  update public.project_asset_folders set audience=p_audience,access_revision=access_revision+1 where project_id=p.id and id=f.id;
  if not public.project_folder_actor_can(p.id,f.id,p_actor_id,'manage') then
    raise exception 'Keep your folder management access.' using errcode='42501'; end if;
  update public.organization_projects set updated_by=p_actor_id where id=p.id;
  return f.access_revision+1;
end;
$$;
revoke all on function public.set_project_asset_folder_access(uuid,uuid,uuid,bigint,text,jsonb) from public,anon,authenticated;
grant execute on function public.set_project_asset_folder_access(uuid,uuid,uuid,bigint,text,jsonb) to service_role;

alter function public.mutate_project_asset_folder(uuid,uuid,uuid,timestamptz,jsonb,uuid) rename to mutate_project_asset_folder_unscoped;
revoke all on function public.mutate_project_asset_folder_unscoped(uuid,uuid,uuid,timestamptz,jsonb,uuid) from public,anon,authenticated,service_role;
create function public.mutate_project_asset_folder(
  p_project_id uuid,p_org_id uuid,p_actor_id uuid,p_expected_updated_at timestamptz,p_change jsonb,p_new_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare destination uuid; source_folder uuid;
begin
  perform 1 from public.organization_projects where id=p_project_id and org_id=p_org_id for update;
  if not found or p_actor_id is null then raise exception 'Project unavailable.' using errcode='42501'; end if;
  if exists(select 1 from public.project_asset_folder_libraries where project_id=p_project_id) then
  if p_change->>'type' in ('rename','remove') then
    destination:=(p_change->>'folderId')::uuid;
    if not public.project_folder_actor_can(p_project_id,destination,p_actor_id,'manage') then
      raise exception 'Folder management access required.' using errcode='42501'; end if;
  elsif p_change->>'type'='move' then
    destination:=(p_change->>'folderId')::uuid;
    select folder_id into source_folder from public.project_asset_folder_placements
      where project_id=p_project_id and file_key=p_change->>'fileKey';
    if (destination is not null and not public.project_folder_actor_can(p_project_id,destination,p_actor_id,'edit'))
      or (source_folder is not null and not public.project_folder_actor_can(p_project_id,source_folder,p_actor_id,'edit')) then
      raise exception 'Folder edit access required.' using errcode='42501'; end if;
  end if;
  end if;
  perform public.mutate_project_asset_folder_unscoped(p_project_id,p_org_id,p_actor_id,p_expected_updated_at,p_change,p_new_id);
  if p_change->>'type'='create' then
    update public.project_asset_folders set created_by=p_actor_id,creator_membership_created_at=(select created_at from public.organization_memberships where org_id=p_org_id and member_id=p_actor_id for key share) where project_id=p_project_id and id=p_new_id;
  end if;
  return public.read_project_asset_folders_for_actor(p_project_id,p_actor_id);
end;
$$;
revoke all on function public.mutate_project_asset_folder(uuid,uuid,uuid,timestamptz,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.mutate_project_asset_folder(uuid,uuid,uuid,timestamptz,jsonb,uuid) to service_role;

-- Recurrence must not turn a private folder name into an inherited one.
do $$ declare body text; needle text;
begin
  body:=pg_get_functiondef('public.generate_next_monthly_project()'::regprocedure);
  needle:='insert into public.project_asset_folders(project_id,id,name,position)
      select v_next_id,id,name,position from public.project_asset_folders where project_id=v_project.id;';
  if position(needle in body)=0 then raise exception 'Recurrence folder copy changed; inspect before applying.'; end if;
  execute replace(body,needle,'insert into public.project_asset_folders(project_id,id,name,position,audience,created_by,creator_membership_created_at)
      select v_next_id,id,name,position,audience,created_by,creator_membership_created_at from public.project_asset_folders where project_id=v_project.id;
    insert into public.project_asset_folder_grants(project_id,folder_id,member_id,capability,membership_created_at)
      select v_next_id,folder_id,member_id,capability,membership_created_at from public.project_asset_folder_grants where project_id=v_project.id;');
end;
$$;
commit;
