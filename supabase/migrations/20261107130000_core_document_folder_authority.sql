-- Canonical core-document audiences. No binding command or private activation:
-- partial-profile readers, publication and historical-copy cutover remain gates.
begin;
create table public.core_document_folder_authorities (
 org_id uuid not null references public.organizations(user_id) on delete cascade,
 section_id text not null check(section_id ~ '^[A-Za-z0-9_:-]{1,120}$'
  and section_id not in ('program','people','board_calendar','next_actions')),
 project_id uuid not null,
 folder_id uuid not null,
 primary key(org_id,section_id),
 foreign key(project_id,folder_id) references public.project_asset_folders(project_id,id) on delete restrict
);
create index core_document_folder_authorities_folder on public.core_document_folder_authorities(project_id,folder_id);
alter table public.core_document_folder_authorities enable row level security;
alter table public.core_document_folder_authorities force row level security;
revoke all on public.core_document_folder_authorities from public,anon,authenticated,service_role;

create function public.guard_core_document_folder_authority() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.organization_projects where id=new.project_id and org_id=new.org_id) then
  raise exception 'Document and folder must have the same source organization.' using errcode='23514';end if;
 return new;
end $$;
revoke all on function public.guard_core_document_folder_authority() from public,anon,authenticated,service_role;
create trigger core_document_folder_authority_scope before insert or update on public.core_document_folder_authorities
 for each row execute function public.guard_core_document_folder_authority();

create function public.core_document_folder_actor_can(p_org uuid,p_section text,p_actor uuid,p_capability text)
returns boolean language sql stable security definer set search_path='' as $$
 select p_actor is not null and p_section is not null and p_capability in ('view','edit','manage') and
  not exists(select 1 from public.core_document_folder_authorities a where a.org_id=p_org and a.section_id=p_section
   and not public.project_folder_actor_can(a.project_id,a.folder_id,p_actor,p_capability));
$$;
revoke all on function public.core_document_folder_actor_can(uuid,text,uuid,text) from public,anon,authenticated,service_role;

-- Preserve the existing reader's actor, parent, batch and saved-lineage checks.
-- All existing document/board/search/AI projections already use this reader.
-- Preserve the public function OID so existing dependent/prepared callers use
-- the new guard. Keep an unchanged private implementation for the wrapper.
do $$ begin
 execute replace(pg_get_functiondef('public.read_workspace_ai_document_copy_sources(uuid,uuid,text[])'::regprocedure),
  'FUNCTION public.read_workspace_ai_document_copy_sources(', 'FUNCTION public.read_workspace_ai_document_copy_sources_before_folder(');
end $$;
revoke all on function public.read_workspace_ai_document_copy_sources_before_folder(uuid,uuid,text[]) from public,anon,authenticated,service_role;
create or replace function public.read_workspace_ai_document_copy_sources(p_org_id uuid,p_actor_id uuid,p_section_ids text[])
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; blocked text[];
begin
 result:=public.read_workspace_ai_document_copy_sources_before_folder(p_org_id,p_actor_id,p_section_ids);
 select coalesce(array_agg(distinct id order by id),'{}'::text[]) into blocked from (
  select jsonb_array_elements_text(result->'blockedSectionIds') id
  union all select id from unnest(p_section_ids) id
   where not public.core_document_folder_actor_can(p_org_id,id,p_actor_id,'view')
 ) denied;
 return jsonb_set(result,'{blockedSectionIds}',to_jsonb(blocked));
end $$;
revoke all on function public.read_workspace_ai_document_copy_sources(uuid,uuid,text[]) from public,anon,authenticated;
grant execute on function public.read_workspace_ai_document_copy_sources(uuid,uuid,text[]) to service_role;

-- A full raw profile cannot represent a mixed audience. Fail explicitly rather
-- than pretending the organization does not exist; service readers must project.
create function public.guard_core_document_profile_read(p_org uuid) returns boolean
language plpgsql stable security definer set search_path='' as $$
begin
 if exists(select 1 from public.core_document_folder_authorities a where a.org_id=p_org
  and not public.core_document_folder_actor_can(p_org,a.section_id,auth.uid(),'view')) then
  raise exception 'Document audience projection required.' using errcode='42501';end if;
 return true;
end $$;
revoke all on function public.guard_core_document_profile_read(uuid) from public,anon;
grant execute on function public.guard_core_document_profile_read(uuid) to authenticated;
create policy core_document_profile_audience on public.organizations as restrictive for select to authenticated
 using(public.guard_core_document_profile_read(user_id));

create function public.assert_core_document_folder_access(p_org uuid,p_section text,p_actor uuid,p_capability text)
returns void language plpgsql security definer set search_path='' as $$
declare binding public.core_document_folder_authorities;
begin
 select * into binding from public.core_document_folder_authorities where org_id=p_org and section_id=p_section for share nowait;
 if not found then return;end if;
 if current_setting('transaction_isolation')<>'read committed' then
  raise exception 'Document permission changed; retry.' using errcode='40001';end if;
 if auth.role() is distinct from 'service_role' or p_actor is null
  or p_actor is distinct from public.organization_activity_actor_id() then
  raise exception 'Verified document actor required.' using errcode='42501';end if;
 -- These are the same authority locks held by native documents and changed by
 -- folder/workspace commands. Revocation either wins or waits for this write.
 perform 1 from public.organizations where user_id=p_org for share nowait;
 perform 1 from public.organization_projects where id=binding.project_id and org_id=p_org for share nowait;
 if not found then raise exception 'Document access denied.' using errcode='42501';end if;
 perform 1 from public.organization_memberships where org_id=p_org and member_id=p_actor for share nowait;
 perform 1 from public.project_asset_folders where project_id=binding.project_id and id=binding.folder_id for share nowait;
 perform 1 from public.project_asset_folder_grants where project_id=binding.project_id and folder_id=binding.folder_id and member_id=p_actor for share nowait;
 if not public.can_read_workspace_particle_origins(p_org,p_actor)
  or not public.core_document_folder_actor_can(p_org,p_section,p_actor,p_capability) then
  raise exception 'Document access denied.' using errcode='42501';end if;
exception when lock_not_available then
 raise exception 'Document permission is changing; retry.' using errcode='40001';
end $$;
revoke all on function public.assert_core_document_folder_access(uuid,text,uuid,text) from public,anon,authenticated,service_role;

-- Include legacy profile aliases even if a roadmap section masks their values.
-- These can become visible again after deletion/source changes, so edits still
-- require the canonical document's authority. Preserve every unrelated field.
create function public.core_document_profile_audience_entries(p_profile jsonb)
returns table(section_id text,document_value jsonb) language sql immutable set search_path='' as $$
 select substring(document_key from 9),jsonb_build_object('section',document_value)
 from public.core_document_history_entries(coalesce(p_profile,'{}'))
 union all
 select aliases.section_id,jsonb_build_object('alias',key,'value',value)
 from jsonb_each(case when jsonb_typeof(p_profile)='object' then p_profile else '{}'::jsonb end) entry
 join (values ('originStory','origin_story'),('origin_story','origin_story'),
  ('need','need'),('needStatement','need'),('need_statement','need'),('mission','mission_vision_values'),
  ('vision','vision'),('values','values'),('theoryOfChange','theory_of_change'),('theory_of_change','theory_of_change'))
  aliases(profile_key,section_id) on btrim(entry.key)=aliases.profile_key;
$$;
revoke all on function public.core_document_profile_audience_entries(jsonb) from public,anon,authenticated,service_role;

-- Preserve the public function OID so existing dependent/prepared callers use
-- the new guard. Keep an unchanged private implementation for the wrapper.
do $$ begin
 execute replace(pg_get_functiondef('public.guard_document_commit_copy_sources(uuid,jsonb,jsonb,text)'::regprocedure),
  'FUNCTION public.guard_document_commit_copy_sources(', 'FUNCTION public.guard_document_commit_copy_sources_before_folder(');
end $$;
revoke all on function public.guard_document_commit_copy_sources_before_folder(uuid,jsonb,jsonb,text) from public,anon,authenticated,service_role;
create or replace function public.guard_document_commit_copy_sources(p_org uuid,p_before jsonb,p_after jsonb,p_section text default null)
returns void language plpgsql security definer set search_path='' as $$
declare section text;
begin
 for section in
  select distinct change.section_id from (
   (select * from public.core_document_profile_audience_entries(p_before)
    except all select * from public.core_document_profile_audience_entries(coalesce(p_after,p_before)))
   union all
   (select * from public.core_document_profile_audience_entries(coalesce(p_after,p_before))
    except all select * from public.core_document_profile_audience_entries(p_before))
   union all select p_section,null::jsonb where p_section is not null
  ) change join public.core_document_folder_authorities a on a.org_id=p_org and a.section_id=change.section_id
  order by change.section_id
 loop
  perform public.assert_core_document_folder_access(p_org,section,public.organization_activity_actor_id(),'edit');
 end loop;
 perform public.guard_document_commit_copy_sources_before_folder(p_org,p_before,p_after,p_section);
end $$;
revoke all on function public.guard_document_commit_copy_sources(uuid,jsonb,jsonb,text) from public,anon,authenticated,service_role;

-- Session/history/presence writes may not include a profile update. Existing
-- closure/parent/editor admission still applies; this only narrows authority.
create function public.guard_core_document_folder_write() returns trigger
language plpgsql security definer set search_path='' as $$
declare item jsonb; actor uuid:=public.organization_activity_actor_id(); capability text;
begin
 item:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 if tg_op='UPDATE' and (old.org_id is distinct from new.org_id or old.section_id is distinct from new.section_id)
  and exists(select 1 from public.core_document_folder_authorities
   where (org_id=old.org_id and section_id=old.section_id) or (org_id=new.org_id and section_id=new.section_id)) then
  raise exception 'Document source authority cannot change.' using errcode='42501';end if;
 if exists(select 1 from public.core_document_folder_authorities where org_id=(item->>'org_id')::uuid and section_id=item->>'section_id') then
  capability:=case when tg_table_name='organization_core_document_presence'
    and (tg_op='DELETE' or item->>'mode'='viewing') then 'view' else 'edit' end;
  perform public.assert_core_document_folder_access((item->>'org_id')::uuid,item->>'section_id',actor,capability);
  if tg_table_name='organization_core_document_presence' and tg_op<>'DELETE' and
   ((item->>'actor_id')::uuid is distinct from actor or (tg_op='UPDATE' and to_jsonb(old)->>'actor_id' is distinct from to_jsonb(new)->>'actor_id')) then
   raise exception 'Verified presence actor required.' using errcode='42501';end if;
 end if;
 if tg_op='DELETE' then return old;end if;return new;
end $$;
revoke all on function public.guard_core_document_folder_write() from public,anon,authenticated,service_role;
create trigger core_document_folder_write before insert or update or delete on public.organization_core_document_sessions
 for each row execute function public.guard_core_document_folder_write();
create trigger core_document_folder_write before insert or update or delete on public.organization_core_document_versions
 for each row execute function public.guard_core_document_folder_write();
create trigger core_document_folder_write before insert or update or delete on public.organization_core_document_presence
 for each row execute function public.guard_core_document_folder_write();
comment on table public.core_document_folder_authorities is
 'One canonical folder audience per organization section; aliases do not grant access. No application binding writer. Partial-profile/public readers, derived copies and cache cutover must qualify before activation.';
commit;
