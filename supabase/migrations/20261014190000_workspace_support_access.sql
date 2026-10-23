-- Explicit operator-managed support grants. No automatic role/email grants.
create table public.workspace_support_grants (
 user_id uuid primary key references public.platform_staff_members(user_id) on delete cascade,
 granted_by uuid references auth.users(id) on delete set null,
 granted_at timestamptz not null default now(),
 revoked_at timestamptz
);
alter table public.workspace_support_grants enable row level security;
revoke all on public.workspace_support_grants from public,anon,authenticated;
grant select,insert,update,delete on public.workspace_support_grants to service_role;

create table public.workspace_support_audit (
 id bigint generated always as identity primary key,
 actor_id uuid,
 subject_id uuid,
 org_id uuid,
 action text not null,
 created_at timestamptz not null default clock_timestamp()
);
alter table public.workspace_support_audit enable row level security;
revoke all on public.workspace_support_audit from public,anon,authenticated;
grant select,insert on public.workspace_support_audit to service_role;
grant usage on sequence public.workspace_support_audit_id_seq to service_role;

create table public.workspace_support_presence (
 org_id uuid not null references public.organizations(user_id) on delete cascade,
 session_id uuid not null,
 actor_id uuid not null references auth.users(id) on delete cascade,
 path text not null,
 position jsonb,
 editing boolean not null default false,
 seen_at timestamptz not null default now(),
 primary key(org_id,actor_id,session_id)
);
alter table public.workspace_support_presence enable row level security;
revoke all on public.workspace_support_presence from public,anon,authenticated;
grant select,insert,update,delete on public.workspace_support_presence to service_role;
create index workspace_support_presence_expiry on public.workspace_support_presence(seen_at);

create function public.has_workspace_support_access() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.workspace_support_grants g
 join public.platform_staff_members s on s.user_id=g.user_id
 join auth.users u on u.id=g.user_id
 where g.user_id=auth.uid() and g.revoked_at is null
 and s.access_level in ('developer','coach') and (u.banned_until is null or u.banned_until<now()));
$$;
revoke all on function public.has_workspace_support_access() from public,anon;
grant execute on function public.has_workspace_support_access() to authenticated;

create function public.workspace_supports_org(p_org uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select p_org is not null and public.has_workspace_support_access()
 and p_org::text = (coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb->>'x-coach-house-organization-id');
$$;
revoke all on function public.workspace_supports_org(uuid) from public,anon;
grant execute on function public.workspace_supports_org(uuid) to authenticated,service_role;

create function public.workspace_support_can_write(p_org uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select public.workspace_supports_org(p_org) and exists(select 1 from public.workspace_support_presence
 where org_id=p_org and actor_id=auth.uid() and seen_at>now()-interval '15 seconds');
$$;
revoke all on function public.workspace_support_can_write(uuid) from public,anon;
grant execute on function public.workspace_support_can_write(uuid) to authenticated,service_role;

create function public.audit_workspace_support_grant() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 insert into public.workspace_support_audit(actor_id,subject_id,action)
 values(public.organization_activity_actor_id(),coalesce(new.user_id,old.user_id),'grant_'||lower(tg_op));
 return coalesce(new,old);
end $$;
revoke all on function public.audit_workspace_support_grant() from public,anon,authenticated;
create trigger workspace_support_grant_audit after insert or update or delete on public.workspace_support_grants
 for each row execute function public.audit_workspace_support_grant();

create function public.search_workspace_support_organizations(p_query text,p_org uuid default null)
returns table(org_id uuid,name text,image_url text,public_slug text)
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.has_workspace_support_access() then raise exception 'Workspace support access denied' using errcode='42501'; end if;
 if p_org is null and length(trim(p_query)) < 2 then return; end if;
 return query select o.user_id,coalesce(nullif(trim(o.profile->>'name'),''),'Unnamed organization'),
 coalesce(o.profile->>'logoUrl',o.profile->>'logo_url',o.profile->>'brandMarkUrl'),o.public_slug
 from public.organizations o
 where (p_org is not null and o.user_id=p_org) or
 (p_org is null and position(lower(left(trim(p_query),100)) in lower(coalesce(o.profile->>'name','')||' '||coalesce(o.public_slug,'')))>0)
 order by coalesce(o.profile->>'name',''),o.user_id limit 20;
end $$;
revoke all on function public.search_workspace_support_organizations(text,uuid) from public,anon;
grant execute on function public.search_workspace_support_organizations(text,uuid) to authenticated;

create function public.record_workspace_support_entry(p_org uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not public.has_workspace_support_access() or not exists(select 1 from public.organizations where user_id=p_org) then
 raise exception 'Workspace support access denied' using errcode='42501'; end if;
 insert into public.workspace_support_audit(actor_id,org_id,action) values(auth.uid(),p_org,'workspace_opened');
end $$;
revoke all on function public.record_workspace_support_entry(uuid) from public,anon;
grant execute on function public.record_workspace_support_entry(uuid) to authenticated;

-- Scope each policy to the selected organization; do not redefine platform admin.
create policy workspace_support_read on public.organizations for select to authenticated using(public.workspace_supports_org(user_id));
create policy workspace_support_update on public.organizations for update to authenticated
 using(public.workspace_support_can_write(user_id)) with check(public.workspace_support_can_write(user_id));
create policy workspace_support_read on public.organization_memberships for select to authenticated using(public.workspace_supports_org(org_id));
create policy workspace_support_read on public.subscriptions for select to authenticated using(public.workspace_supports_org(user_id));
create policy workspace_support_read on public.programs for select to authenticated using(public.workspace_supports_org(user_id));
create policy workspace_support_edit on public.programs for all to authenticated
 using(public.workspace_support_can_write(user_id)) with check(public.workspace_support_can_write(user_id));

-- Explicit content-table allowlist: no staff grants, owner accounts, fiscal signing,
-- personal integrations, payment operations or organization deletion permission.
do $$ declare table_name text; begin
 foreach table_name in array array[
 'organization_document_files','organization_external_documents','organization_projects',
 'organization_tasks','organization_task_assignees','organization_project_assets',
 'organization_project_overview_documents','organization_project_quick_links',
 'organization_people_tags','organization_people_segments','organization_workspace_boards',
 'organization_workspace_objectives','organization_workspace_objective_groups',
 'organization_workspace_objective_steps','organization_workspace_objective_assignees',
 'organization_workspace_objective_links','roadmap_calendar_internal_events'
 ] loop
 execute format('create policy workspace_support_read on public.%I for select to authenticated using(public.workspace_supports_org(org_id))',table_name);
 execute format('create policy workspace_support_edit on public.%I for all to authenticated using(public.workspace_support_can_write(org_id)) with check(public.workspace_support_can_write(org_id))',table_name);
 end loop;
end $$;
create policy workspace_support_read on public.organization_people_tag_members for select to authenticated using(exists(select 1 from public.organization_people_tags t where t.id=tag_id and public.workspace_supports_org(t.org_id)));
create policy workspace_support_edit on public.organization_people_tag_members for all to authenticated
 using(exists(select 1 from public.organization_people_tags t where t.id=tag_id and public.workspace_support_can_write(t.org_id)))
 with check(exists(select 1 from public.organization_people_tags t where t.id=tag_id and public.workspace_support_can_write(t.org_id)));
create policy workspace_support_read on public.organization_people_segment_members for select to authenticated using(exists(select 1 from public.organization_people_segments s where s.id=segment_id and public.workspace_supports_org(s.org_id)));
create policy workspace_support_edit on public.organization_people_segment_members for all to authenticated
 using(exists(select 1 from public.organization_people_segments s where s.id=segment_id and public.workspace_support_can_write(s.org_id)))
 with check(exists(select 1 from public.organization_people_segments s where s.id=segment_id and public.workspace_support_can_write(s.org_id)));

create function public.workspace_supports_storage(p_bucket text,p_name text) returns boolean
language sql stable security definer set search_path='' as $$
 select p_bucket in ('org-media','roadmap-media','program-media','org-documents','project-assets')
 and public.has_workspace_support_access()
 and exists(select 1 from public.workspace_support_presence where actor_id=auth.uid() and org_id::text=split_part(p_name,'/',1) and seen_at>now()-interval '15 seconds')
 and split_part(p_name,'/',1)=(coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb->>'x-coach-house-organization-id');
$$;
revoke all on function public.workspace_supports_storage(text,text) from public,anon;
grant execute on function public.workspace_supports_storage(text,text) to authenticated;
create policy workspace_support_assets on storage.objects for all to authenticated
 using(public.workspace_supports_storage(bucket_id,name)) with check(public.workspace_supports_storage(bucket_id,name));

-- Verified staff assistance can edit free-workspace documents without changing the
-- owner's plan or enabling paid editing for ordinary members.
create or replace function public.guard_free_workspace_documents()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if auth.role()='service_role' or public.has_workspace_paid_features(new.user_id) or public.workspace_supports_org(new.user_id) then return new; end if;
 if public.native_workspace_document_content(new.profile) is distinct from
 public.native_workspace_document_content(case when tg_op='INSERT' then '{}'::jsonb else old.profile end) then
 raise exception 'Upgrade to create or edit Coach House documents. Google Drive links remain available on Free.' using errcode='42501'; end if;
 return new;
end $$;
do $$ declare operation text; begin
 foreach operation in array array['insert','update','delete'] loop
 execute format('drop policy document_storage_paid_%s on storage.objects',operation);
 if operation='insert' then
 execute 'create policy document_storage_paid_insert on storage.objects as restrictive for insert to authenticated with check(case when bucket_id=''org-documents'' then public.has_workspace_paid_features(split_part(name,''/'',1)::uuid) or public.workspace_supports_storage(bucket_id,name) else true end)';
 elsif operation='update' then
 execute 'create policy document_storage_paid_update on storage.objects as restrictive for update to authenticated using(case when bucket_id=''org-documents'' then public.has_workspace_paid_features(split_part(name,''/'',1)::uuid) or public.workspace_supports_storage(bucket_id,name) else true end) with check(case when bucket_id=''org-documents'' then public.has_workspace_paid_features(split_part(name,''/'',1)::uuid) or public.workspace_supports_storage(bucket_id,name) else true end)';
 else
 execute 'create policy document_storage_paid_delete on storage.objects as restrictive for delete to authenticated using(case when bucket_id=''org-documents'' then public.has_workspace_paid_features(split_part(name,''/'',1)::uuid) or public.workspace_supports_storage(bucket_id,name) else true end)';
 end if;
 execute format('drop policy document_library_paid_%s on public.organization_document_files',operation);
 if operation='insert' then
 execute 'create policy document_library_paid_insert on public.organization_document_files as restrictive for insert to authenticated with check(public.has_workspace_paid_features(org_id) or public.workspace_supports_org(org_id))';
 elsif operation='update' then
 execute 'create policy document_library_paid_update on public.organization_document_files as restrictive for update to authenticated using(public.has_workspace_paid_features(org_id) or public.workspace_supports_org(org_id)) with check(public.has_workspace_paid_features(org_id) or public.workspace_supports_org(org_id))';
 else
 execute 'create policy document_library_paid_delete on public.organization_document_files as restrictive for delete to authenticated using(public.has_workspace_paid_features(org_id) or public.workspace_supports_org(org_id))';
 end if;
 end loop;
end $$;


create function public.sync_workspace_support_presence(p_org uuid,p_session uuid,p_path text,p_position jsonb default null,p_editing boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare supported boolean; result jsonb;
begin
 supported := public.workspace_supports_org(p_org);
 if not (supported or p_org=auth.uid() or exists(select 1 from public.organization_memberships where org_id=p_org and member_id=auth.uid())) then
 raise exception 'Workspace presence access denied' using errcode='42501'; end if;
 delete from public.workspace_support_presence where seen_at < now()-interval '30 seconds';
 if supported then
  if length(p_path)>200 or p_path not like '/%' or
   (p_position is not null and (jsonb_typeof(p_position->'x') is distinct from 'number' or jsonb_typeof(p_position->'y') is distinct from 'number'
   or (p_position->>'x')::numeric not between 0 and 1 or (p_position->>'y')::numeric not between 0 and 1)) then
   raise exception 'Invalid workspace presence'; end if;
  insert into public.workspace_support_presence(org_id,session_id,actor_id,path,position,editing,seen_at)
   values(p_org,p_session,auth.uid(),p_path,p_position,p_editing,now())
   on conflict(org_id,actor_id,session_id) do update set path=excluded.path,position=excluded.position,editing=excluded.editing,seen_at=now();
 end if;
 select coalesce(jsonb_agg(row_to_json(participant)),'[]'::jsonb) into result from (
  select p.session_id,p.actor_id,coalesce(nullif(pr.full_name,''),'Coach House staff') as name,
   'Coach House support' as role,p.path,p.position,p.editing
  from public.workspace_support_presence p
  join public.workspace_support_grants g on g.user_id=p.actor_id and g.revoked_at is null
  join public.platform_staff_members s on s.user_id=p.actor_id and s.access_level in ('developer','coach')
  join auth.users u on u.id=p.actor_id and (u.banned_until is null or u.banned_until<now())
  left join public.profiles pr on pr.id=p.actor_id
  where p.org_id=p_org and p.seen_at>now()-interval '15 seconds'
  order by p.seen_at desc limit 20
 ) participant;
 return result;
end $$;
revoke all on function public.sync_workspace_support_presence(uuid,uuid,text,jsonb,boolean) from public,anon;
grant execute on function public.sync_workspace_support_presence(uuid,uuid,text,jsonb,boolean) to authenticated;
create function public.leave_workspace_support_presence(p_org uuid,p_session uuid) returns void
language sql security definer set search_path='' as $$
 delete from public.workspace_support_presence where org_id=p_org and session_id=p_session and actor_id=auth.uid();
$$;
revoke all on function public.leave_workspace_support_presence(uuid,uuid) from public,anon;
grant execute on function public.leave_workspace_support_presence(uuid,uuid) to authenticated;

create function public.audit_workspace_support_write() returns trigger
language plpgsql security definer set search_path='' as $$
declare actor uuid; target uuid; row_data jsonb;
begin
 actor := public.organization_activity_actor_id();
 if actor is not null and exists(select 1 from public.workspace_support_grants where user_id=actor and revoked_at is null) then
 row_data := case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 target := coalesce(row_data->>'org_id',row_data->>'user_id')::uuid;
 insert into public.workspace_support_audit(actor_id,org_id,action) values(actor,target,tg_table_name||'.'||lower(tg_op));
 end if;
 return coalesce(new,old);
end $$;
revoke all on function public.audit_workspace_support_write() from public,anon,authenticated;
do $$ declare table_name text; begin
 foreach table_name in array array['organizations','programs','organization_document_files','organization_external_documents',
 'organization_projects','organization_tasks','organization_task_assignees','organization_project_assets',
 'organization_project_overview_documents','organization_project_quick_links','organization_people_tags','organization_people_segments',
 'organization_workspace_boards','organization_workspace_objectives','organization_workspace_objective_groups',
 'organization_workspace_objective_steps','organization_workspace_objective_assignees','organization_workspace_objective_links','roadmap_calendar_internal_events'] loop
 execute format('create trigger workspace_support_write_audit after insert or update or delete on public.%I for each row execute function public.audit_workspace_support_write()',table_name);
 end loop;
end $$;
