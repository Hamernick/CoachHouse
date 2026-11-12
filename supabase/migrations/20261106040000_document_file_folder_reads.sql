-- Canonical uploaded-file read boundary. No binding writer is exposed yet:
-- source writes, derived disclosures and Storage cutover must qualify first.
begin;
create table public.document_file_folder_authorities (
  file_id uuid primary key references public.organization_document_files(id) on delete cascade,
  project_id uuid not null,
  folder_id uuid not null,
  foreign key(project_id,folder_id) references public.project_asset_folders(project_id,id) on delete restrict
);
create index document_file_folder_authorities_folder_idx
  on public.document_file_folder_authorities(project_id,folder_id);
alter table public.document_file_folder_authorities enable row level security;
alter table public.document_file_folder_authorities force row level security;
-- Neither a browser nor an elevated application reader may assign or remove
-- authority. A later reviewed source command owns the transition atomically.
revoke all on public.document_file_folder_authorities from public,anon,authenticated,service_role;

create function public.guard_document_file_folder_authority() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from public.organization_document_files f
    join public.organization_projects p on p.org_id=f.org_id and p.id=new.project_id
    join public.project_asset_folders d on d.project_id=p.id and d.id=new.folder_id
    where f.id=new.file_id and f.document_kind is null
      and f.storage_path like f.org_id::text||'/library/%') then
    raise exception 'Document and folder must have the same source organization.' using errcode='23514';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_document_file_folder_authority() from public,anon,authenticated,service_role;
create trigger document_file_folder_authority_scope before insert or update on public.document_file_folder_authorities
for each row execute function public.guard_document_file_folder_authority();

-- Additive to existing organization, entitlement and closure checks. Aliases
-- never grant authority: one canonical file has one authority, regardless of
-- how many folders, board nodes or conversations reference it.
create function public.document_file_folder_actor_can(p_file uuid,p_actor uuid,p_capability text)
returns boolean language sql stable security definer set search_path='' as $$
  select p_actor is not null and p_capability in ('view','edit','manage') and
    not exists(select 1 from public.document_file_folder_authorities a
      where a.file_id=p_file and not public.project_folder_actor_can(a.project_id,a.folder_id,p_actor,p_capability));
$$;
revoke all on function public.document_file_folder_actor_can(uuid,uuid,text) from public,anon,authenticated,service_role;
create function public.can_read_document_file_folder(p_file uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select public.document_file_folder_actor_can(p_file,(select auth.uid()),'view');
$$;
revoke all on function public.can_read_document_file_folder(uuid) from public,anon;
grant execute on function public.can_read_document_file_folder(uuid) to authenticated;
create policy document_file_folder_read on public.organization_document_files as restrictive for select to authenticated
using (public.can_read_document_file_folder(id));
-- Existing room/update/version policies join the canonical file with invoker
-- RLS. They therefore inherit this restriction without a second grant store.

-- Explicit additive filter for elevated readers, after their established
-- parent/support scope check. It is never exposed as a browser action.
create function public.filter_document_file_audience(p_file_ids uuid[],p_actor_id uuid)
returns uuid[] language plpgsql stable security definer set search_path='' as $$
begin
  if p_actor_id is null or p_file_ids is null or cardinality(p_file_ids)>500 then
    raise exception 'Invalid document audience request.' using errcode='22023'; end if;
  return coalesce((select array_agg(f.id order by f.id) from public.organization_document_files f
    where f.id=any(p_file_ids) and public.document_file_folder_actor_can(f.id,p_actor_id,'view')),'{}'::uuid[]);
end;
$$;
revoke all on function public.filter_document_file_audience(uuid[],uuid) from public,anon,authenticated;
grant execute on function public.filter_document_file_audience(uuid[],uuid) to service_role;
comment on table public.document_file_folder_authorities is
  'Canonical read authority only. No application binding writer until source writes, derived disclosures and private Storage cutover qualify. Placement is not authority.';
commit;
