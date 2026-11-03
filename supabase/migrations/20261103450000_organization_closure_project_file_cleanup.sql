-- Exact ordinary project-file owner and copied file activity. Fiscal/signing,
-- shared paths and ambiguous legacy identities remain independent and reported.
begin;
alter table public.organization_closure_asset_cleanups drop constraint organization_closure_asset_cleanups_source_kind_check;
alter table public.organization_closure_asset_cleanups add constraint organization_closure_asset_cleanups_source_kind_check check(source_kind in('media','tracked_document','policy','project_asset'));

create function public.closure_project_asset_has_independent_reference(p_asset uuid) returns boolean
 language plpgsql security definer set search_path='' as $$
declare relation text;found_ref boolean;
begin
 foreach relation in array array['fiscal_sponsorship_documents','fiscal_sponsorship_applications','fiscal_sponsorship_signature_packets','fiscal_sponsorship_signatures','fiscal_sponsorship_signing_drafts','fiscal_guest_submissions'] loop
  execute format('select exists(select 1 from public.%I t where public.closure_asset_has_reference(to_jsonb(t),$1))',relation) into found_ref using p_asset::text;
  if found_ref then return true;end if;
 end loop;
 return false;
end $$;
revoke all on function public.closure_project_asset_has_independent_reference(uuid) from public,anon,authenticated,service_role;

-- ID references (including FK-only fiscal links) serialize before path admission.
-- Retained receipts keep this fence effective after canonical rows disappear.
do $migration$
declare definition text;needle text;replacement text;
begin
 definition:=pg_get_functiondef('public.guard_closure_asset_reference()'::regprocedure);
 needle:='asset_path text;bucket text;';replacement:='asset_path text;bucket text;asset_uuid uuid;';
 if strpos(definition,needle)=0 then raise exception 'Unexpected asset reference declarations';end if;definition:=replace(definition,needle,replacement);
 needle:='begin'||chr(10);
 replacement:=needle||$insert$ for asset_uuid in select distinct m[1]::uuid from regexp_matches(payload,'([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})','g')m loop
  if tg_op='UPDATE' and public.closure_asset_has_reference(to_jsonb(old),asset_uuid::text) then continue;end if;
  if exists(select 1 from public.organization_project_assets where id=asset_uuid) or exists(select 1 from public.organization_closure_asset_cleanups where source_kind='project_asset' and file_id=asset_uuid) or exists(select 1 from public.organization_closure_project_file_cleanups where asset_uuid=any(asset_ids)) then
   perform pg_advisory_xact_lock_shared(hashtextextended('project-asset-id/'||asset_uuid::text,450000));
   if exists(select 1 from public.organization_closure_asset_cleanups where source_kind='project_asset' and file_id=asset_uuid) or exists(select 1 from public.organization_closure_project_file_cleanups where asset_uuid=any(asset_ids)) then raise exception 'Project asset is reserved for retirement' using errcode='PT409';end if;
  end if;
 end loop;
 for asset_path in select distinct m[1] from regexp_matches(payload,'([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9]{13}-[a-zA-Z0-9._-]+)','g')m loop
  if tg_op='UPDATE' and public.closure_asset_has_reference(to_jsonb(old),asset_path) then continue;end if;
  perform pg_advisory_xact_lock_shared(hashtextextended('project-assets/'||asset_path,400000));
  if exists(select 1 from public.organization_closure_asset_cleanups where bucket_id='project-assets' and path=asset_path) then raise exception 'Project asset path is reserved for retirement' using errcode='PT409';end if;
 end loop;
$insert$;
 if (length(definition)-length(replace(definition,needle,'')))/length(needle)<>1 then raise exception 'Unexpected asset reference predecessor';end if;execute replace(definition,needle,replacement);

 definition:=pg_get_functiondef('public.assert_closure_asset_references(uuid,text,text,text,text,text,uuid)'::regprocedure);
 needle:=' for row in select user_id,profile';
 replacement:=$insert$ if p_kind='project_asset' then
  if not exists(select 1 from public.organization_project_assets a join public.organization_projects p on p.id=a.project_id
   where a.id=p_file and a.org_id=p_org and a.project_id::text=p_key and a.storage_path=p_path and a.external_url is null
    and p.org_id=p_org and (p.canonical_org_id is null or p.canonical_org_id=p_org)) then raise exception 'Exact project asset source changed' using errcode='PT409';end if;
  if public.closure_project_asset_has_independent_reference(p_file) then raise exception 'Financial or signing asset reference requires reconciliation' using errcode='PT409';end if;
 end if;
$insert$||needle;
 if strpos(definition,needle)=0 then raise exception 'Unexpected asset ownership predecessor';end if;definition:=replace(definition,needle,replacement);
 needle:=$old$  execute format('select exists(select 1 from public.%I t where public.closure_asset_has_reference(to_jsonb(t),$1))',relation) into found_ref using p_path;$old$;
 replacement:=$new$  if relation='organization_project_assets' and p_kind='project_asset' then
   select exists(select 1 from public.organization_project_assets t where public.closure_asset_has_reference(to_jsonb(t),p_path) and (t.id<>p_file or t.org_id<>p_org)) into found_ref;
  else
$new$||needle||chr(10)||'  end if;';
 if strpos(definition,needle)=0 then raise exception 'Unexpected project alias predecessor';end if;definition:=replace(definition,needle,replacement);
 needle:='(p_file is null or f.id<>p_file or f.org_id<>p_org)';replacement:='(p_kind=''project_asset'' or p_file is null or f.id<>p_file or f.org_id<>p_org)';
 if strpos(definition,needle)=0 then raise exception 'Unexpected file alias predecessor';end if;execute replace(definition,needle,replacement);

 definition:=pg_get_functiondef('public.reserve_expired_closure_asset_purge(uuid,uuid,uuid,integer,uuid,text)'::regprocedure);
 needle:=$old$ else raise exception 'Legacy or unproven asset ownership requires reconciliation'$old$;
 replacement:=$insert$ elsif object.bucket_id='project-assets' and object.name ~ ('^'||p_org::text||'/'||uuid_pattern||'/[0-9]{13}-[a-zA-Z0-9._-]+$') then
  kind:='project_asset';key:=split_part(object.name,'/',2);
  select id into strict file from public.organization_project_assets where org_id=p_org and project_id::text=key and storage_path=object.name and external_url is null for update nowait;
  perform pg_advisory_xact_lock(hashtextextended('project-asset-id/'||file::text,450000));
$insert$||needle;
 if strpos(definition,needle)=0 then raise exception 'Unexpected project path predecessor';end if;execute replace(definition,needle,replacement);
end $migration$;

create table public.organization_closure_project_file_cleanups(
 org_id uuid not null,closure_request_id uuid not null,operation_id uuid not null,closure_revision integer not null check(closure_revision>0),
 transaction_id bigint not null,operator_role text not null,asset_ids uuid[] not null,activity_ids uuid[] not null,
 state text not null check(state in('running','complete')),result jsonb,created_at timestamptz not null default clock_timestamp(),completed_at timestamptz,
 primary key(org_id,closure_request_id,operation_id),check((state='complete')=(result is not null and completed_at is not null))
);
alter table public.organization_closure_project_file_cleanups enable row level security;
revoke all on public.organization_closure_project_file_cleanups from public,anon,authenticated,service_role;
create function public.guard_closure_project_file_receipt() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op<>'UPDATE' then raise exception 'Project file cleanup receipts are retained' using errcode='42501';end if;
 if (to_jsonb(new)-array['state','result','completed_at']) is distinct from (to_jsonb(old)-array['state','result','completed_at']) or old.state<>'running' or new.state<>'complete' or new.result is null or new.completed_at is null then raise exception 'Project file receipt is immutable' using errcode='42501';end if;
 return new;
end $$;
revoke all on function public.guard_closure_project_file_receipt() from public,anon,authenticated,service_role;
create trigger closure_project_file_immutable before update or delete on public.organization_closure_project_file_cleanups for each row execute function public.guard_closure_project_file_receipt();
create trigger closure_project_file_retained before truncate on public.organization_closure_project_file_cleanups for each statement execute function public.guard_closure_project_file_receipt();
create function public.closure_project_file_retirement_allowed(p_org uuid,p_table text,p_id uuid) returns boolean
 language plpgsql security definer set search_path='' as $$
begin
 if coalesce(nullif(current_setting('role',true),'none'),session_user)<>session_user or not exists(select 1 from pg_roles where rolname=session_user and rolsuper)
  or current_setting('transaction_isolation')<>'read committed' or current_setting('session_replication_role')<>'origin' then return false;end if;
 return exists(select 1 from public.organization_closure_project_file_cleanups r where r.org_id=p_org and r.operator_role=session_user and r.transaction_id=txid_current() and r.state='running'
  and public.organization_closure_cleanup_due(r.org_id,r.closure_request_id,r.closure_revision)
  and case p_table when 'organization_project_assets' then p_id=any(r.asset_ids) when 'organization_project_activity_events' then p_id=any(r.activity_ids) else false end);
end $$;
create function public.closure_project_asset_finalization_allowed(p_old jsonb) returns boolean
 language plpgsql security definer set search_path='' as $$
declare r public.organization_closure_asset_cleanups;
begin
 r:=public.closure_asset_finalization_receipt((p_old->>'org_id')::uuid);
 return r.object_id is not null and r.source_kind='project_asset' and r.file_id=(p_old->>'id')::uuid and r.source_key=p_old->>'project_id' and r.path=p_old->>'storage_path' and p_old->>'external_url' is null;
end $$;
revoke all on function public.closure_project_file_retirement_allowed(uuid,text,uuid),public.closure_project_asset_finalization_allowed(jsonb) from public,anon,authenticated,service_role;

-- Only established document-key/source shapes provide activity ownership.
create function public.closure_file_activity_owned(p_row jsonb) returns boolean
 language plpgsql security definer set search_path='' as $$
declare key text:=p_row#>>'{metadata,documentKey}';org uuid:=(p_row->>'org_id')::uuid;entity uuid:=(p_row->>'entity_id')::uuid;source text:=p_row#>>'{metadata,source}';
begin
 if p_row->>'entity_type'='document' then
  if left(key,7)='policy:' and exists(select 1 from public.organizations o cross join lateral jsonb_array_elements(case when jsonb_typeof(o.profile->'policies')='array' then o.profile->'policies' else '[]'::jsonb end)v where o.user_id=org and v->>'id'=substring(key from 8)) then return false;end if;
  if left(key,7)='upload:' and exists(select 1 from public.organizations o where o.user_id=org and o.profile#>array['documents',substring(key from 8)] is not null) then return false;end if;
  return entity=org and (key~'^policy:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   or key=any(array['upload:verificationLetter','upload:articlesOfIncorporation','upload:bylaws','upload:stateRegistration','upload:goodStandingCertificate','upload:w9','upload:taxExemptCertificate','upload:ueiConfirmation','upload:samActiveStatus','upload:grantsGovRegistration','upload:gataPreQualification','upload:einConfirmationLetter','upload:irs990s','upload:auditedFinancials'])
   or substring(key from 9)=any(public.closure_core_section_ids()) and left(key,8)='roadmap:');
 end if;
 if p_row->>'entity_type'<>'file' then return false;end if;
 if source='organization_document_files' then return not exists(select 1 from public.organization_document_files where id=entity) and not public.closure_project_asset_has_independent_reference(entity);end if;
 if source='organization_project_assets' then
  return not exists(select 1 from public.organization_project_assets where id=entity) and not public.closure_project_asset_has_independent_reference(entity);
 end if;
 return false;
end $$;
create function public.project_retired_file_activity(p_row jsonb) returns jsonb language sql immutable set search_path='' as $$
 select p_row||jsonb_build_object('title','Retired content','metadata',case when p_row->>'entity_type'='document' then jsonb_build_object('documentKey',p_row#>>'{metadata,documentKey}') else jsonb_build_object('source',p_row#>>'{metadata,source}') end,
  'from_status',case when p_row->>'from_status'=any(array['available','trashed','inaccessible','needs_reconnect','draft','complete','in_progress','not_started']) then p_row->>'from_status' else null end,
  'to_status',case when p_row->>'to_status'=any(array['available','trashed','inaccessible','needs_reconnect','draft','complete','in_progress','not_started']) then p_row->>'to_status' else null end)
$$;
create function public.closure_file_activity_projection_allowed(p_old jsonb,p_new jsonb) returns boolean language sql security definer set search_path='' as $$
 select public.closure_project_file_retirement_allowed((p_old->>'org_id')::uuid,'organization_project_activity_events',(p_old->>'id')::uuid)
  and public.closure_file_activity_owned(p_old) and p_new=public.project_retired_file_activity(p_old)
$$;
revoke all on function public.closure_file_activity_owned(jsonb),public.project_retired_file_activity(jsonb),public.closure_file_activity_projection_allowed(jsonb,jsonb) from public,anon,authenticated,service_role;

do $migration$
declare definition text;needle text;replacement text;
begin
 definition:=pg_get_functiondef('public.guard_project_task_closure()'::regprocedure);needle:='begin'||chr(10);
 replacement:=needle||$insert$ if tg_table_name='organization_project_assets' and tg_op='DELETE' then
  if public.closure_project_asset_finalization_allowed(to_jsonb(old)) or public.closure_project_file_retirement_allowed((to_jsonb(old)->>'org_id')::uuid,tg_table_name,(to_jsonb(old)->>'id')::uuid) then return old;end if;
 end if;
$insert$;
 if (length(definition)-length(replace(definition,needle,'')))/length(needle)<>1 then raise exception 'Unexpected project source guard';end if;execute replace(definition,needle,replacement);
 definition:=pg_get_functiondef('public.record_organization_file_activity()'::regprocedure);
 needle:='  -- Compliance uploads are already captured by their profile document mutation.';
 replacement:=$insert$  if tg_table_name='organization_project_assets' and tg_op='DELETE' then
   if public.closure_project_asset_finalization_allowed(previous) or public.closure_project_file_retirement_allowed((previous->>'org_id')::uuid,tg_table_name,(previous->>'id')::uuid) then return old;end if;
  end if;
$insert$||needle;
 if strpos(definition,needle)=0 then raise exception 'Unexpected project activity capture';end if;execute replace(definition,needle,replacement);
 definition:=pg_get_functiondef('public.guard_organization_activity_closure()'::regprocedure);needle:='begin'||chr(10);
 replacement:=needle||' if tg_op=''UPDATE'' and public.closure_file_activity_projection_allowed(to_jsonb(old),to_jsonb(new)) then return new;end if;'||chr(10);
 if (length(definition)-length(replace(definition,needle,'')))/length(needle)<>1 then raise exception 'Unexpected file activity guard';end if;execute replace(definition,needle,replacement);
 definition:=pg_get_functiondef('public.finish_expired_closure_asset_purge(uuid,uuid,uuid,integer,uuid,text)'::regprocedure);
 needle:=' if r.file_id is not null then perform 1 from public.organization_document_files where id=r.file_id for update nowait;end if;';
 replacement:=' if r.source_kind=''project_asset'' then perform 1 from public.organization_project_assets where id=r.file_id for update nowait;elsif r.file_id is not null then perform 1 from public.organization_document_files where id=r.file_id for update nowait;end if;';
 if strpos(definition,needle)=0 then raise exception 'Unexpected asset source lock';end if;definition:=replace(definition,needle,replacement);
 needle:=' if r.file_id is not null then delete from public.organization_document_files';
 replacement:=' if r.source_kind=''project_asset'' then delete from public.organization_project_assets where id=r.file_id and org_id=p_org and project_id::text=r.source_key and storage_path=r.path and external_url is null;elsif r.file_id is not null then delete from public.organization_document_files';
 if strpos(definition,needle)=0 then raise exception 'Unexpected asset source finish';end if;execute replace(definition,needle,replacement);
end $migration$;

create function public.purge_expired_organization_project_file_metadata(p_org_id uuid,p_closure_request_id uuid,p_expected_closure_revision integer,p_operation_id uuid) returns jsonb
 language plpgsql security invoker set search_path='' as $$
declare prior public.organization_closure_project_file_cleanups;assets uuid[];activities uuid[];asset uuid;cleanup_result jsonb;asset_count integer;activity_count integer;
begin
 if session_user<>current_user or not exists(select 1 from pg_roles where rolname=current_user and rolsuper)
  or current_setting('transaction_isolation')<>'read committed' or current_setting('session_replication_role')<>'origin' then raise exception 'Actual project file cleanup operator required' using errcode='42501';end if;
 if p_org_id is null or p_closure_request_id is null or p_operation_id is null or p_expected_closure_revision is null or p_expected_closure_revision<1 then raise exception 'Exact project file cleanup identity required' using errcode='22023';end if;
 perform 1 from public.organizations where user_id=p_org_id for update;
 if not found then raise exception 'Organization unavailable' using errcode='42501';end if;
 if not public.organization_closure_cleanup_due(p_org_id,p_closure_request_id,p_expected_closure_revision) then raise exception 'Current cleanup eligibility required' using errcode='42501';end if;
 select * into prior from public.organization_closure_project_file_cleanups where org_id=p_org_id and closure_request_id=p_closure_request_id and operation_id=p_operation_id;
 if found then if prior.closure_revision<>p_expected_closure_revision or prior.state<>'complete' then raise exception 'Project file retry changed' using errcode='23505';end if;return prior.result;end if;
 select coalesce(array_agg(id order by id),'{}'::uuid[]) into assets from(select a.id from public.organization_project_assets a join public.organization_projects p on p.id=a.project_id
  where a.org_id=p_org_id and a.external_url is not null and a.storage_path is null and p.org_id=p_org_id and (p.canonical_org_id is null or p.canonical_org_id=p_org_id)
   and not public.closure_project_asset_has_independent_reference(a.id) order by a.id limit 50 for update of a nowait)q;
 foreach asset in array assets loop
  perform pg_advisory_xact_lock(hashtextextended('project-asset-id/'||asset::text,450000));
  if public.closure_project_asset_has_independent_reference(asset) then raise exception 'Project asset acquired independent reference' using errcode='PT409';end if;
 end loop;
 select coalesce(array_agg(id order by id),'{}'::uuid[]) into activities from(select e.id from public.organization_project_activity_events e
  where org_id=p_org_id and (public.closure_file_activity_owned(to_jsonb(e)) or (entity_type='file' and metadata->>'source'='organization_project_assets' and entity_id=any(assets)))
   and to_jsonb(e) is distinct from public.project_retired_file_activity(to_jsonb(e)) order by id limit 50 for update nowait)q;
 insert into public.organization_closure_project_file_cleanups(org_id,closure_request_id,operation_id,closure_revision,transaction_id,operator_role,asset_ids,activity_ids,state)
 values(p_org_id,p_closure_request_id,p_operation_id,p_expected_closure_revision,txid_current(),session_user,assets,activities,'running');

 delete from public.organization_project_assets where org_id=p_org_id and id=any(assets);
 get diagnostics asset_count=row_count;
 update public.organization_project_activity_events e set title='Retired content',metadata=public.project_retired_file_activity(to_jsonb(e))->'metadata',
  from_status=public.project_retired_file_activity(to_jsonb(e))->>'from_status',to_status=public.project_retired_file_activity(to_jsonb(e))->>'to_status' where org_id=p_org_id and id=any(activities);
 get diagnostics activity_count=row_count;
 cleanup_result:=jsonb_build_object('scope','project_file_metadata','deletedExternalBindings',asset_count,'retiredActivityPayloads',activity_count,
  'remainingAssets',(select count(*) from public.organization_project_assets where org_id=p_org_id),
  'remainingFileActivityPayloads',(select count(*) from public.organization_project_activity_events e where org_id=p_org_id
   and (entity_type='document' or entity_type='file' and metadata->>'source' in('organization_document_files','organization_project_assets')) and to_jsonb(e) is distinct from public.project_retired_file_activity(to_jsonb(e))));
 update public.organization_closure_project_file_cleanups set state='complete',result=cleanup_result,completed_at=clock_timestamp() where org_id=p_org_id and closure_request_id=p_closure_request_id and operation_id=p_operation_id;
 return cleanup_result;
end $$;
revoke all on function public.purge_expired_organization_project_file_metadata(uuid,uuid,integer,uuid) from public,anon,authenticated,service_role;
commit;
