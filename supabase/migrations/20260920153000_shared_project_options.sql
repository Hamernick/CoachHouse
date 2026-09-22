-- Shared Coach House tag/type catalog. Supersedes project-local option_settings.
create table public.project_option_catalog (
 id uuid primary key default gen_random_uuid(),
 kind text not null check (kind in ('tag','sprintType')),
 label text not null check (length(btrim(label)) between 1 and 80 and position(',' in label)=0),
 color text not null default '#64748b' check (color ~ '^#[0-9a-fA-F]{6}$'),
 aliases text[] not null default '{}',
 deleted_at timestamptz,
 updated_at timestamptz not null default clock_timestamp()
);
create unique index project_option_catalog_name on public.project_option_catalog(kind, lower(label));
alter table public.project_option_catalog enable row level security;
-- No direct client access; staff-authorized server actions use service_role.
revoke all on public.project_option_catalog from anon, authenticated;
grant all on public.project_option_catalog to service_role;

insert into public.project_option_catalog(kind,label)
select kind, min(label) from (
 select 'tag'::text kind, btrim(unnest(tags)) label from public.organization_projects
 union all select 'sprintType', btrim(type_label) from public.organization_projects where type_label is not null
) source where length(label) between 1 and 80 and position(',' in label)=0 group by kind,lower(label);

create or replace function public.load_shared_project_options() returns jsonb
language sql stable security definer set search_path = '' as $$
 select jsonb_build_object(
  'tags', coalesce(jsonb_agg(jsonb_build_object('id',id,'label',label,'color',color,'updatedAt',updated_at) order by lower(label)) filter(where kind='tag' and deleted_at is null),'[]'::jsonb),
  'sprintTypes', coalesce(jsonb_agg(jsonb_build_object('id',id,'label',label,'color',color,'updatedAt',updated_at) order by lower(label)) filter(where kind='sprintType' and deleted_at is null),'[]'::jsonb)
 ) from public.project_option_catalog;
$$;

-- Translate aliases and tombstones even when an old open form submits stale labels.
create or replace function public.canonical_project_option(p_kind text,p_label text) returns text
language plpgsql volatile security definer set search_path = '' as $$
declare v_option public.project_option_catalog%rowtype;
begin
 if p_label is null then return null; end if;
 select * into v_option from public.project_option_catalog
 where kind=p_kind and (lower(label)=lower(btrim(p_label)) or exists(select 1 from unnest(aliases) a where lower(a)=lower(btrim(p_label)))) limit 1;
 if not found then return p_label; end if;
 if v_option.deleted_at is not null then return null; end if;
 return v_option.label;
end;
$$;
create or replace function public.normalize_shared_project_options() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 perform pg_advisory_xact_lock_shared(hashtext('coach-house-project-options'));
 new.type_label := public.canonical_project_option('sprintType',new.type_label);
 new.tags := coalesce((select array_agg(label order by first_position) from (
  select label,min(position) first_position from (
   select public.canonical_project_option('tag',value) label,position from unnest(new.tags) with ordinality t(value,position)
  ) resolved where label is not null group by label
 ) unique_tags),'{}'::text[]);
 return new;
end;
$$;
create trigger normalize_shared_project_options before insert or update of tags,type_label on public.organization_projects
for each row execute function public.normalize_shared_project_options();

create or replace function public.manage_shared_project_option(
 p_actor_id uuid,p_action text,p_kind text,p_option jsonb,p_expected_updated_at timestamptz
) returns jsonb language plpgsql security definer set search_path = '' set row_security=off as $$
declare v_existing public.project_option_catalog%rowtype; v_saved public.project_option_catalog%rowtype;
 v_label text:=btrim(p_option->>'label'); v_color text:=coalesce(p_option->>'color','#64748b'); v_id uuid;
begin
 if not exists(select 1 from public.platform_staff_members where user_id=p_actor_id)
 and not exists(select 1 from public.profiles where id=p_actor_id and role='admin') then
  return jsonb_build_object('error','Only Coach House staff can manage shared options.');
 end if;
 if p_kind not in ('tag','sprintType') or p_action not in ('save','delete') or v_label is null
 or length(v_label) not between 1 and 80 or position(',' in v_label)>0 or v_color !~ '^#[0-9a-fA-F]{6}$' then
  return jsonb_build_object('error','Check the option name and color.');
 end if;
 perform pg_advisory_xact_lock(hashtext('coach-house-project-options'));
 v_id := (p_option->>'id')::uuid;
 select * into v_existing from public.project_option_catalog where id=v_id for update;
 if found then
  if v_existing.kind<>p_kind then return jsonb_build_object('error','Option type does not match.'); end if;
  if v_existing.updated_at is distinct from p_expected_updated_at then
   return jsonb_build_object('error','This option changed. Close and reopen the project to refresh.');
  end if;
 elsif p_action='delete' or p_expected_updated_at is not null then
  return jsonb_build_object('error','This option no longer exists.');
 end if;
 if exists(select 1 from public.project_option_catalog where kind=p_kind and id<>v_id
  and (lower(label)=lower(v_label) or exists(select 1 from unnest(aliases) a where lower(a)=lower(v_label)))) then
  return jsonb_build_object('error','That name is already used, including a previous name.');
 end if;
 if p_action='delete' then
  update public.project_option_catalog set deleted_at=clock_timestamp(),updated_at=clock_timestamp() where id=v_id returning * into v_saved;
 else
  insert into public.project_option_catalog(id,kind,label,color) values(v_id,p_kind,v_label,v_color)
  on conflict(id) do update set label=excluded.label,color=excluded.color,deleted_at=null,updated_at=clock_timestamp(),
   aliases=case when lower(project_option_catalog.label)<>lower(excluded.label)
    then array_append(project_option_catalog.aliases,project_option_catalog.label) else project_option_catalog.aliases end
  returning * into v_saved;
 end if;
 -- Update all matching labels in one transaction; color is read from the shared catalog.
 if v_existing.id is not null and (p_action='delete' or v_existing.label is distinct from v_label) then
  if p_kind='tag' then
   update public.organization_projects set tags=tags,updated_by=p_actor_id,updated_at=clock_timestamp()
   where exists(select 1 from unnest(tags) t where lower(t)=lower(v_existing.label));
  else
   update public.organization_projects set type_label=type_label,updated_by=p_actor_id,updated_at=clock_timestamp()
   where lower(type_label)=lower(v_existing.label);
  end if;
 end if;
 return jsonb_build_object('option',jsonb_build_object('id',v_saved.id,'label',v_saved.label,'color',v_saved.color,'updatedAt',v_saved.updated_at));
end;
$$;
revoke all on function public.load_shared_project_options() from public,anon,authenticated;
revoke all on function public.manage_shared_project_option(uuid,text,text,jsonb,timestamptz) from public,anon,authenticated;
revoke all on function public.canonical_project_option(text,text) from public,anon,authenticated;
revoke all on function public.normalize_shared_project_options() from public,anon,authenticated;
grant execute on function public.load_shared_project_options() to service_role;
grant execute on function public.manage_shared_project_option(uuid,text,text,jsonb,timestamptz) to service_role;
-- Rollback: drop normalize_shared_project_options trigger, functions, then catalog. Already-renamed labels remain.
