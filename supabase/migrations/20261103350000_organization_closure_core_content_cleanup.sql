-- Private full known core-planning payload retirement. Physical document bindings
-- and independent identities/records remain with their source-owned cleanup.
begin;
create function public.closure_core_section_ids() returns text[]
 language sql immutable set search_path='' as $$select array[
 'origin_story','need','mission_vision_values','vision','values','theory_of_change',
 'program','evaluation','people','budget','fundraising','fundraising_strategy',
 'fundraising_presentation','fundraising_crm_plan','communications','board_strategy',
 'board_calendar','board_handbook','next_actions']::text[]$$;
revoke all on function public.closure_core_section_ids() from public,anon,authenticated,service_role;

create function public.project_retired_core_profile(p_profile jsonb) returns jsonb
 language plpgsql immutable set search_path='' as $$
declare result jsonb;sections jsonb;remaining jsonb;
begin
 if p_profile is null or jsonb_typeof(p_profile)<>'object' then
  raise exception 'Core profile ownership requires reconciliation' using errcode='42501';end if;
 result:=p_profile-array['description','need','needStatement','need_statement','originStory','theoryOfChange',
  'origin_story','theory_of_change','mission','vision','values','boilerplate'];
 if result ? 'roadmap' then
  if jsonb_typeof(result->'roadmap')<>'object' then raise exception 'Core roadmap ownership requires reconciliation' using errcode='42501';end if;
  if result->'roadmap' ? 'sections' then
   sections:=result#>'{roadmap,sections}';
   if jsonb_typeof(sections)='array' then
    if exists(select 1 from jsonb_array_elements(sections) v where jsonb_typeof(v)<>'object' or jsonb_typeof(v->'id') is distinct from 'string') then
     raise exception 'Core section ownership requires reconciliation' using errcode='42501';end if;
    select coalesce(jsonb_agg(v order by n),'[]'::jsonb) into remaining
     from jsonb_array_elements(sections) with ordinality a(v,n) where not (v->>'id'=any(public.closure_core_section_ids()));
   elsif jsonb_typeof(sections)='object' then
    if exists(select 1 from jsonb_each(sections) where jsonb_typeof(value)<>'object') then
     raise exception 'Core section ownership requires reconciliation' using errcode='42501';end if;
    select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) into remaining from jsonb_each(sections)
     where not (key=any(public.closure_core_section_ids()));
   else raise exception 'Core section ownership requires reconciliation' using errcode='42501';end if;
   result:=jsonb_set(result,'{roadmap,sections}',remaining);
  end if;
 end if;
 return result;
end $$;
revoke all on function public.project_retired_core_profile(jsonb) from public,anon,authenticated,service_role;

create table public.organization_closure_core_cleanups (
 org_id uuid not null,closure_request_id uuid not null,operation_id uuid not null,
 closure_revision integer not null check(closure_revision>0),transaction_id bigint not null,
 operator_role text not null,version_ids uuid[] not null,session_keys text[] not null,presence_keys jsonb not null,
 state text not null check(state in('running','complete')),result jsonb,
 created_at timestamptz not null default clock_timestamp(),completed_at timestamptz,
 primary key(org_id,closure_request_id,operation_id),
 check((state='complete')=(result is not null and completed_at is not null))
);
alter table public.organization_closure_core_cleanups enable row level security;
revoke all on public.organization_closure_core_cleanups from public,anon,authenticated,service_role;
create function public.guard_closure_core_cleanup_receipt() returns trigger
 language plpgsql security invoker set search_path='' as $$
begin
 if tg_op<>'UPDATE' then raise exception 'Core cleanup receipts are retained' using errcode='42501';end if;
 if (to_jsonb(new)-array['state','result','completed_at']) is distinct from (to_jsonb(old)-array['state','result','completed_at'])
  or old.state<>'running' or new.state<>'complete' or new.result is null or new.completed_at is null then
  raise exception 'Core cleanup receipt is immutable' using errcode='42501';end if;
 return new;
end $$;
revoke all on function public.guard_closure_core_cleanup_receipt() from public,anon,authenticated,service_role;
create trigger closure_core_cleanup_immutable before update or delete on public.organization_closure_core_cleanups for each row execute function public.guard_closure_core_cleanup_receipt();
create trigger closure_core_cleanup_retained before truncate on public.organization_closure_core_cleanups for each statement execute function public.guard_closure_core_cleanup_receipt();

create function public.closure_core_retirement_allowed(p_org uuid,p_table text,p_row jsonb default null) returns boolean
 language plpgsql security definer set search_path='' as $$
begin
 if coalesce(nullif(current_setting('role',true),'none'),session_user)<>session_user
  or not exists(select 1 from pg_catalog.pg_roles where rolname=session_user and rolsuper)
  or current_setting('transaction_isolation')<>'read committed' or current_setting('session_replication_role')<>'origin' then return false;end if;
 return exists(select 1 from public.organization_closure_core_cleanups r
  join public.organization_closures c on c.org_id=r.org_id and c.request_id=r.closure_request_id and c.revision=r.closure_revision
  where r.org_id=p_org and r.transaction_id=txid_current() and r.state='running' and r.operator_role=session_user
   and c.state='closing' and c.export_until=c.requested_at+interval '720 hours' and clock_timestamp()>=c.export_until
   and case p_table
    when 'organizations' then true
    when 'organization_core_document_versions' then (p_row->>'id')::uuid=any(r.version_ids)
    when 'organization_core_document_sessions' then p_row->>'section_id'=any(r.session_keys)
    when 'organization_core_document_presence' then r.presence_keys @> jsonb_build_array(jsonb_build_array(p_row->>'section_id',p_row->>'session_id'))
    else false end);
end $$;
revoke all on function public.closure_core_retirement_allowed(uuid,text,jsonb) from public,anon,authenticated,service_role;
create function public.closure_core_profile_retirement_allowed(p_old jsonb,p_new jsonb) returns boolean
 language plpgsql security definer set search_path='' as $$
begin
 if not public.closure_core_retirement_allowed((p_old->>'user_id')::uuid,'organizations') then return false;end if;
 return (p_old-array['profile','updated_at'])=(p_new-array['profile','updated_at'])
  and p_new->'profile'=public.project_retired_core_profile(p_old->'profile');
end $$;
revoke all on function public.closure_core_profile_retirement_allowed(jsonb,jsonb) from public,anon,authenticated,service_role;

-- Preserve predecessor behavior and fail migration if a source owner changed.
-- Only this exact profile projection bypasses ordinary closure/paid admission or
-- content-copying history/activity effects. Existing audit records are retained.
do $migration$
declare definition text;needle text;replacement text;target text;
begin
 foreach target in array array['guard_organization_row_closure','guard_free_workspace_documents','capture_core_document_versions','record_organization_document_activity'] loop
  definition:=pg_get_functiondef(('public.'||target||'()')::regprocedure);
  needle:='begin'||chr(10);
  replacement:=needle||' if tg_op=''UPDATE'' and public.closure_core_profile_retirement_allowed(to_jsonb(old),to_jsonb(new)) then return new;end if;'||chr(10);
  if (length(definition)-length(replace(definition,needle,'')))/length(needle)<>1 then raise exception 'Unexpected core cleanup predecessor: %',target;end if;
  execute replace(definition,needle,replacement);
 end loop;
 definition:=pg_get_functiondef('public.guard_core_document_closure()'::regprocedure);
 needle:='begin'||chr(10);
 replacement:=needle||' if tg_op=''DELETE'' and public.closure_core_retirement_allowed(old.org_id,tg_table_name,to_jsonb(old)) then return old;end if;'||chr(10);
 if (length(definition)-length(replace(definition,needle,'')))/length(needle)<>1 then raise exception 'Unexpected core child cleanup predecessor';end if;
 execute replace(definition,needle,replacement);
end $migration$;

create function public.purge_expired_organization_core_content(p_org_id uuid,p_closure_request_id uuid,p_expected_closure_revision integer,p_operation_id uuid) returns jsonb
 language plpgsql security invoker set search_path='' as $$
declare closure public.organization_closures;prior public.organization_closure_core_cleanups;
 old_profile jsonb;next_profile jsonb;selected_versions uuid[];selected_sessions text[];selected_presence jsonb;
 version_count integer;session_count integer;presence_count integer;cleanup_result jsonb;
begin
 if session_user<>current_user or not exists(select 1 from pg_catalog.pg_roles where rolname=current_user and rolsuper)
  or current_setting('transaction_isolation')<>'read committed' or current_setting('session_replication_role')<>'origin' then
  raise exception 'Actual core cleanup operator required' using errcode='42501';end if;
 if p_org_id is null or p_closure_request_id is null or p_operation_id is null or p_expected_closure_revision is null or p_expected_closure_revision<1 then
  raise exception 'Exact core cleanup identity required' using errcode='22023';end if;
 select profile into old_profile from public.organizations where user_id=p_org_id for update;
 if not found then raise exception 'Organization unavailable' using errcode='42501';end if;
 select * into closure from public.organization_closures where org_id=p_org_id;
 if not found or closure.state<>'closing' or closure.request_id is distinct from p_closure_request_id
  or closure.revision is distinct from p_expected_closure_revision or closure.export_until is null or closure.requested_at is null
  or closure.export_until<>closure.requested_at+interval '720 hours' or clock_timestamp()<closure.export_until then
  raise exception 'Expired current closure required' using errcode='42501';end if;
 select * into prior from public.organization_closure_core_cleanups where org_id=p_org_id and closure_request_id=p_closure_request_id and operation_id=p_operation_id;
 if found then
  if prior.closure_revision<>p_expected_closure_revision or prior.state<>'complete' then raise exception 'Core cleanup retry changed' using errcode='23505';end if;
  return prior.result;
 end if;
 next_profile:=public.project_retired_core_profile(old_profile);
 select coalesce(array_agg(id order by id),'{}'::uuid[]) into selected_versions from (
  select id from public.organization_core_document_versions where org_id=p_org_id and section_id=any(public.closure_core_section_ids()) order by id limit 50 for update nowait) q;
 select coalesce(array_agg(section_id order by section_id),'{}'::text[]) into selected_sessions from (
  select section_id from public.organization_core_document_sessions where org_id=p_org_id and section_id=any(public.closure_core_section_ids()) order by section_id limit 50 for update nowait) q;
 select coalesce(jsonb_agg(jsonb_build_array(section_id,session_id) order by section_id,session_id),'[]'::jsonb) into selected_presence from (
  select section_id,session_id from public.organization_core_document_presence where org_id=p_org_id and section_id=any(public.closure_core_section_ids()) order by section_id,session_id limit 50 for update nowait) q;
 insert into public.organization_closure_core_cleanups(org_id,closure_request_id,operation_id,closure_revision,transaction_id,operator_role,version_ids,session_keys,presence_keys,state)
 values(p_org_id,p_closure_request_id,p_operation_id,p_expected_closure_revision,txid_current(),session_user,selected_versions,selected_sessions,selected_presence,'running');
 if old_profile is distinct from next_profile then update public.organizations set profile=next_profile where user_id=p_org_id;end if;
 delete from public.organization_core_document_versions where org_id=p_org_id and id=any(selected_versions);
 get diagnostics version_count=row_count;
 delete from public.organization_core_document_sessions where org_id=p_org_id and section_id=any(selected_sessions);
 get diagnostics session_count=row_count;
 delete from public.organization_core_document_presence where org_id=p_org_id and selected_presence @> jsonb_build_array(jsonb_build_array(section_id,session_id));
 get diagnostics presence_count=row_count;
 cleanup_result:=jsonb_build_object('scope','known_core_content','profileChanged',old_profile is distinct from next_profile,
  'deletedVersions',version_count,'deletedSessions',session_count,'deletedPresence',presence_count,
  'moreRemainingAtCommit',exists(select 1 from public.organization_core_document_versions where org_id=p_org_id and section_id=any(public.closure_core_section_ids()))
    or exists(select 1 from public.organization_core_document_sessions where org_id=p_org_id and section_id=any(public.closure_core_section_ids()))
    or exists(select 1 from public.organization_core_document_presence where org_id=p_org_id and section_id=any(public.closure_core_section_ids())),
  'unknownCoreSectionsRequireReconciliation',exists(select 1 from public.organization_core_document_versions where org_id=p_org_id and not(section_id=any(public.closure_core_section_ids())))
    or exists(select 1 from public.organization_core_document_sessions where org_id=p_org_id and not(section_id=any(public.closure_core_section_ids())))
    or exists(select 1 from public.organization_core_document_presence where org_id=p_org_id and not(section_id=any(public.closure_core_section_ids())))
    or coalesce(next_profile#>'{roadmap,sections}','[]'::jsonb) not in ('[]'::jsonb,'{}'::jsonb),
  'physicalDocumentBindingsRetained',(next_profile ? 'documents') or (next_profile ? 'policies'));
 update public.organization_closure_core_cleanups set state='complete',result=cleanup_result,completed_at=clock_timestamp()
  where org_id=p_org_id and closure_request_id=p_closure_request_id and operation_id=p_operation_id;
 return cleanup_result;
end $$;
revoke all on function public.purge_expired_organization_core_content(uuid,uuid,integer,uuid) from public,anon,authenticated,service_role;
comment on function public.purge_expired_organization_core_content(uuid,uuid,integer,uuid) is
 'Private expired-closure retirement of known core planning content and bounded history/session/presence copies. Retains physical document bindings, unknown content, shared identities and independent records. No whole-organization completion or hosted recovery qualification.';
commit;
