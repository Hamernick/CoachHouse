-- Separate folder metadata from shared project options before adding audiences.
-- Existing project access is preserved. This does not enable private folders.
begin;

create table public.project_asset_folder_libraries (
  project_id uuid primary key references public.organization_projects(id) on delete cascade,
  migrated_at timestamptz not null default now()
);
create table public.project_asset_folders (
  project_id uuid not null references public.project_asset_folder_libraries(project_id) on delete cascade,
  id uuid not null,
  name text not null check (name=btrim(name) and length(name) between 1 and 80),
  position integer not null check (position>=0),
  primary key(project_id,id)
);
create unique index project_asset_folders_name on public.project_asset_folders(project_id,lower(name));
create table public.project_asset_folder_placements (
  project_id uuid not null,
  file_key text not null check (file_key ~ '^(project|organization|core|policy|upload|drive|fiscal):[^:[:space:]]{1,160}$'),
  folder_id uuid not null,
  primary key(project_id,file_key),
  foreign key(project_id,folder_id) references public.project_asset_folders(project_id,id) on delete cascade
);
create index project_asset_folder_placements_folder on public.project_asset_folder_placements(project_id,folder_id);

alter table public.project_asset_folder_libraries enable row level security;
alter table public.project_asset_folder_libraries force row level security;
alter table public.project_asset_folders enable row level security;
alter table public.project_asset_folders force row level security;
alter table public.project_asset_folder_placements enable row level security;
alter table public.project_asset_folder_placements force row level security;
revoke all on public.project_asset_folder_libraries,public.project_asset_folders,public.project_asset_folder_placements from public,anon,authenticated;
grant select on public.project_asset_folder_libraries,public.project_asset_folders,public.project_asset_folder_placements to authenticated;
grant all on public.project_asset_folder_libraries,public.project_asset_folders,public.project_asset_folder_placements to service_role;
create policy project_folder_library_read on public.project_asset_folder_libraries for select to authenticated
using (exists(select 1 from public.organization_projects p where p.id=project_id));
create policy project_folder_read on public.project_asset_folders for select to authenticated
using (exists(select 1 from public.organization_projects p where p.id=project_id));
create policy project_folder_placement_read on public.project_asset_folder_placements for select to authenticated
using (exists(select 1 from public.organization_projects p where p.id=project_id));

-- Invoker rights: both parent access and child RLS apply, including fiscal scope.
create function public.read_project_asset_folders(p_project_id uuid) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare options jsonb;
begin
  select option_settings into options from public.organization_projects where id=p_project_id;
  if not found then raise exception 'Project unavailable.' using errcode='42501'; end if;
  if not exists(select 1 from public.project_asset_folder_libraries where project_id=p_project_id) then
    return coalesce(options->'assetFolders','{"folders":[],"placements":[]}'::jsonb);
  end if;
  return jsonb_build_object(
    'folders',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name) order by position,id)
      from public.project_asset_folders where project_id=p_project_id),'[]'::jsonb),
    'placements',coalesce((select jsonb_agg(jsonb_build_object('fileKey',file_key,'folderId',folder_id) order by file_key)
      from public.project_asset_folder_placements where project_id=p_project_id),'[]'::jsonb));
end;
$$;
revoke all on function public.read_project_asset_folders(uuid) from public,anon;
grant execute on function public.read_project_asset_folders(uuid) to authenticated,service_role;

-- Only authenticated server actions may call this service-only writer, after
-- existing project/fiscal/staff scope and source ownership checks. Command-based
-- writes preserve rows not targeted by the command; no client state replacement.
create function public.mutate_project_asset_folder(
  p_project_id uuid,p_org_id uuid,p_actor_id uuid,p_expected_updated_at timestamptz,
  p_change jsonb,p_new_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.organization_projects%rowtype; legacy jsonb; kind text; destination uuid; label text; v_file_key text;
begin
  select * into p from public.organization_projects where id=p_project_id and org_id=p_org_id for update;
  if not found or p_actor_id is null then raise exception 'Project unavailable.' using errcode='42501'; end if;
  if p_expected_updated_at is null or p.updated_at<>p_expected_updated_at then
    raise exception 'The project changed. Refresh and try again.' using errcode='40001'; end if;
  if jsonb_typeof(p_change) is distinct from 'object' then raise exception 'Invalid folder command.' using errcode='22023'; end if;
  kind:=p_change->>'type';
  if kind is null or kind not in ('create','rename','remove','move') then raise exception 'Invalid folder command.' using errcode='22023'; end if;
  if kind in ('create','rename') then
    label:=p_change->>'name';
    if jsonb_typeof(p_change->'name') is distinct from 'string' or label<>btrim(label) or length(label) not between 1 and 80 then
      raise exception 'Invalid folder name.' using errcode='22023'; end if;
  end if;
  if kind<>'create' then
    destination:=(p_change->>'folderId')::uuid;
    if destination is null and (kind<>'move' or not p_change ? 'folderId') then
      raise exception 'Choose a folder.' using errcode='22023'; end if;
  end if;
  if kind='move' then
    v_file_key:=p_change->>'fileKey';
    if v_file_key is null or v_file_key !~ '^(project|organization|core|policy|upload|drive|fiscal):[^:[:space:]]{1,160}$' then
      raise exception 'Invalid file reference.' using errcode='22023'; end if;
  end if;
  if not exists(select 1 from public.project_asset_folder_libraries where project_id=p.id) then
    legacy:=coalesce(p.option_settings->'assetFolders','{"folders":[],"placements":[]}'::jsonb);
    if jsonb_typeof(legacy) is distinct from 'object' or jsonb_typeof(legacy->'folders') is distinct from 'array'
      or jsonb_typeof(legacy->'placements') is distinct from 'array' or legacy-array['folders','placements']<>'{}'::jsonb then
      raise exception 'Saved folders could not be read.' using errcode='22023'; end if;
    if jsonb_array_length(legacy->'folders')>100 or jsonb_array_length(legacy->'placements')>5000 then
      raise exception 'Saved folders exceed the supported limit.' using errcode='22023'; end if;
    if exists(select 1 from jsonb_array_elements(legacy->'folders') f
      where jsonb_typeof(f) is distinct from 'object' or f-array['id','name']<>'{}'::jsonb
        or jsonb_typeof(f->'id') is distinct from 'string' or jsonb_typeof(f->'name') is distinct from 'string')
      or exists(select 1 from jsonb_array_elements(legacy->'placements') f
      where jsonb_typeof(f) is distinct from 'object' or f-array['fileKey','folderId']<>'{}'::jsonb
        or jsonb_typeof(f->'fileKey') is distinct from 'string' or jsonb_typeof(f->'folderId') is distinct from 'string') then
      raise exception 'Saved folders could not be read.' using errcode='22023'; end if;
    insert into public.project_asset_folder_libraries(project_id) values(p.id);
    insert into public.project_asset_folders(project_id,id,name,position)
      select p.id,(f->>'id')::uuid,f->>'name',(ord-1)::integer from jsonb_array_elements(legacy->'folders') with ordinality a(f,ord);
    insert into public.project_asset_folder_placements(project_id,file_key,folder_id)
      select p.id,f->>'fileKey',(f->>'folderId')::uuid from jsonb_array_elements(legacy->'placements') f;
  end if;
  if destination is not null and not exists(select 1 from public.project_asset_folders where project_id=p.id and id=destination) then
    raise exception 'That folder no longer exists.' using errcode='40001'; end if;
  case kind
    when 'create' then
      if (select count(*) from public.project_asset_folders where project_id=p.id)>=100 then raise exception 'Folder limit reached.' using errcode='54000'; end if;
      insert into public.project_asset_folders(project_id,id,name,position)
        select p.id,p_new_id,label,coalesce(max(position)+1,0) from public.project_asset_folders where project_id=p.id;
    when 'rename' then
      update public.project_asset_folders set name=label where project_id=p.id and id=destination;
    when 'remove' then
      delete from public.project_asset_folders where project_id=p.id and id=destination;
    when 'move' then
      delete from public.project_asset_folder_placements x where x.project_id=p.id and x.file_key=v_file_key;
      if destination is not null then
        if (select count(*) from public.project_asset_folder_placements where project_id=p.id)>=5000 then raise exception 'Folder file limit reached.' using errcode='54000'; end if;
        insert into public.project_asset_folder_placements(project_id,file_key,folder_id) values(p.id,v_file_key,destination);
      end if;
  end case;
  -- Remove only the old folder field. Current tags, fiscal options and all other
  -- project settings survive. This update also retains existing closure guards.
  update public.organization_projects set option_settings=option_settings-'assetFolders',updated_by=p_actor_id where id=p.id;
  return public.read_project_asset_folders(p.id);
end;
$$;
revoke all on function public.mutate_project_asset_folder(uuid,uuid,uuid,timestamptz,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.mutate_project_asset_folder(uuid,uuid,uuid,timestamptz,jsonb,uuid) to service_role;

-- Old sessions cannot reintroduce a second folder authority through project edits.
create function public.guard_project_folder_legacy_write() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.option_settings ? 'assetFolders' and exists(select 1 from public.project_asset_folder_libraries where project_id=new.id) then
    raise exception 'Folders changed. Refresh the project before saving.' using errcode='40001'; end if;
  return new;
end;
$$;
revoke all on function public.guard_project_folder_legacy_write() from public,anon,authenticated,service_role;
create trigger project_folder_legacy_write before insert or update of option_settings on public.organization_projects
for each row execute function public.guard_project_folder_legacy_write();

-- Monthly recurrence previously copied folder options. Preserve that behavior
-- for normalized libraries without copying file bytes or granting new access.
do $$
declare body text; needle text := 'returning id into v_next_id;';
begin
  body:=pg_get_functiondef('public.generate_next_monthly_project()'::regprocedure);
  if position(needle in body)=0 then raise exception 'Monthly project writer changed; inspect folder copy integration.'; end if;
  execute replace(body,needle,needle || $patch$
  if exists(select 1 from public.project_asset_folder_libraries where project_id=v_project.id) then
    insert into public.project_asset_folder_libraries(project_id) values(v_next_id);
    insert into public.project_asset_folders(project_id,id,name,position)
      select v_next_id,id,name,position from public.project_asset_folders where project_id=v_project.id;
    insert into public.project_asset_folder_placements(project_id,file_key,folder_id)
      select v_next_id,file_key,folder_id from public.project_asset_folder_placements where project_id=v_project.id;
  end if;
  $patch$);
end;
$$;
commit;
