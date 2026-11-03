-- Expired-closure cleanup of canonical private library objects only.
-- Ordinary document APIs retain their existing authority and trash semantics.
begin;
create table public.organization_closure_document_cleanups (
 file_id uuid primary key,
 org_id uuid not null,
 closure_request_id uuid not null,
 expected_closure_revision integer not null check(expected_closure_revision>0),
 operation_id uuid not null,
 operator_role text not null,
 paths text[] not null check(cardinality(paths) between 1 and 151),
 state text not null default 'reserved' check(state in('reserved','finishing','complete')),
 created_at timestamptz not null default clock_timestamp(),
 completed_at timestamptz,
 unique(org_id,closure_request_id,operation_id),
 check((state='complete')=(completed_at is not null))
);
alter table public.organization_closure_document_cleanups enable row level security;
revoke all on public.organization_closure_document_cleanups from public,anon,authenticated,service_role;

create function public.guard_closure_document_cleanup_receipt() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if tg_op<>'UPDATE' then raise exception 'Closure document cleanup receipts are retained' using errcode='42501';end if;
 if (to_jsonb(new)-array['state','completed_at']) is distinct from (to_jsonb(old)-array['state','completed_at'])
  or not (old.state='reserved' and new.state='finishing' and new.completed_at is null
   or old.state='finishing' and new.state='complete' and new.completed_at is not null) then
  raise exception 'Closure document cleanup identity is immutable' using errcode='42501';end if;
 return new;
end $$;
revoke all on function public.guard_closure_document_cleanup_receipt() from public,anon,authenticated,service_role;
create trigger closure_document_cleanup_immutable before update or delete on public.organization_closure_document_cleanups for each row execute function public.guard_closure_document_cleanup_receipt();
create trigger closure_document_cleanup_retained before truncate on public.organization_closure_document_cleanups for each statement execute function public.guard_closure_document_cleanup_receipt();

create function public.assert_expired_document_closure(p_org uuid,p_request uuid,p_revision integer) returns void
language plpgsql security invoker set search_path='' as $$
declare closure public.organization_closures;
begin
 if p_org is null or p_request is null or p_revision is null or p_revision<1 then raise exception 'Exact closure identity required' using errcode='22023';end if;
 if current_setting('transaction_isolation')<>'read committed' or current_setting('session_replication_role')<>'origin' then
  raise exception 'Document cleanup requires read committed isolation and origin triggers' using errcode='42501';end if;
 select * into closure from public.organization_closures where org_id=p_org;
 if not found or closure.state<>'closing' or closure.request_id is distinct from p_request or closure.revision is distinct from p_revision then
  raise exception 'Closure identity changed' using errcode='40001';end if;
 if closure.export_until is distinct from closure.requested_at+interval '720 hours' or clock_timestamp()<closure.export_until then
  raise exception 'Closure export window has not expired' using errcode='42501';end if;
end $$;
revoke all on function public.assert_expired_document_closure(uuid,uuid,integer) from public,anon,authenticated,service_role;

-- Canonical O3 reservation and finishing cores, private after caller admission.
create function public.freeze_document_file_purge(p_org uuid,p_file uuid,p_actor uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare f public.organization_document_files%rowtype;r public.document_file_purges%rowtype;paths text[];
begin
 select * into r from public.document_file_purges where file_id=p_file for update;
 if found then
  if r.org_id<>p_org then raise exception 'Document unavailable' using errcode='42501';end if;
  return jsonb_build_object('fileId',r.file_id,'paths',r.paths,'complete',r.state='complete');
 end if;
 select * into f from public.organization_document_files where id=p_file and org_id=p_org and document_kind is null for update;
 if not found then raise exception 'Document unavailable' using errcode='42501';end if;
 if exists(select 1 from public.document_version_operations where file_id=p_file and state='committed' and (source_storage_path is null or source_size_bytes is null)) then
  raise exception 'Legacy document source provenance requires reconciliation' using errcode='PT409';end if;
 if exists(select 1 from public.document_file_versions v join public.document_file_versions source on source.id=v.restored_from where source.file_id=p_file and v.file_id<>p_file) then
  raise exception 'Document version references require reconciliation' using errcode='PT409';end if;
 select array_agg(distinct path order by path) into paths from (
  select f.storage_path path
  union select storage_path from public.document_file_versions where file_id=p_file and org_id=p_org
  union select source_storage_path from public.document_version_operations where file_id=p_file and org_id=p_org and state<>'cleaned' and source_storage_path is not null
  union select p_org::text||'/library/versions/'||p_file::text||'/'||request_id::text||'.md' from public.document_version_operations where file_id=p_file and org_id=p_org and state<>'cleaned'
  union select p_org::text||'/library/versions/'||p_file::text||'/'||request_id::text||'-previous.md' from public.document_version_operations where file_id=p_file and org_id=p_org and state<>'cleaned'
 ) owned;
 if cardinality(paths)>151 or exists(select 1 from unnest(paths)p where p not like p_org::text||'/library/%' or p ~ '(^|/)\.\.(/|$)')
  or exists(select 1 from public.organization_document_files where id<>p_file and storage_path=any(paths))
  or exists(select 1 from public.document_file_versions where file_id<>p_file and storage_path=any(paths)) then
  raise exception 'Document object ownership requires reconciliation' using errcode='PT409';end if;
 -- Fence every uncommitted request before Storage begins; committed history is
 -- retained until the complete frozen object set is confirmed absent.
 update public.document_version_operations set state='abandoned' where file_id=p_file and state='staged';
 insert into public.document_file_purges(file_id,org_id,actor_id,paths) values(p_file,p_org,p_actor,paths) returning * into r;
 return jsonb_build_object('fileId',r.file_id,'paths',r.paths,'complete',false);
end $$;

create function public.complete_document_file_purge(p_org uuid,p_file uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare r public.document_file_purges%rowtype;
begin
 select * into r from public.document_file_purges where file_id=p_file and org_id=p_org for update;
 if not found then raise exception 'Document purge reservation required' using errcode='42501';end if;
 if r.state='complete' then return true;end if;
 if exists(select 1 from storage.objects where bucket_id='org-documents' and name=any(r.paths)) then
  raise exception 'Document objects remain; retry deletion' using errcode='PT409';end if;
 update public.document_file_purges set state='finishing' where file_id=p_file;
 update public.document_file_versions set restored_from=null where file_id=p_file and restored_from is not null;
 delete from public.document_file_versions where file_id=p_file;
 delete from public.organization_document_files where id=p_file and org_id=p_org;
 update public.document_file_purges set state='complete',completed_at=clock_timestamp() where file_id=p_file;
 return true;
end $$;

revoke all on function public.freeze_document_file_purge(uuid,uuid,uuid),public.complete_document_file_purge(uuid,uuid) from public,anon,authenticated,service_role;
create or replace function public.reserve_document_file_purge(p_org uuid,p_file uuid,p_actor uuid,p_support boolean default false,p_expired_only boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare removed_at timestamptz;
begin
 perform public.assert_document_cleanup_authority(p_org,p_actor,p_support);
 if not exists(select 1 from public.document_file_purges where file_id=p_file) then
  select deleted_at into removed_at from public.organization_document_files where id=p_file and org_id=p_org and document_kind is null for update;
  if not found then raise exception 'Document unavailable' using errcode='42501';end if;
  if removed_at is null then raise exception 'Move the file to Recently Deleted first.' using errcode='PT409';end if;
  if p_expired_only and removed_at>=clock_timestamp()-interval '30 days' then raise exception 'Document retention window remains active' using errcode='PT409';end if;
 end if;
 return public.freeze_document_file_purge(p_org,p_file,p_actor);
end $$;
create or replace function public.finish_document_file_purge(p_org uuid,p_file uuid,p_actor uuid,p_support boolean default false) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 perform public.assert_document_cleanup_authority(p_org,p_actor,p_support);
 return public.complete_document_file_purge(p_org,p_file);
end $$;

create function public.assert_closure_document_paths(p_org uuid,p_file uuid,p_paths text[]) returns void
language plpgsql security invoker set search_path='' as $$
declare path text; uuid_pattern text:='[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
begin
 if not exists(select 1 from storage.buckets where id='org-documents' and public=false) then raise exception 'Private document bucket requires reconciliation' using errcode='42501';end if;
 if p_paths is null or cardinality(p_paths) not between 1 and 151 then raise exception 'Document paths unavailable' using errcode='42501';end if;
 foreach path in array p_paths loop
  if path is null or not(path ~ ('^'||p_org::text||'/library/'||uuid_pattern||'-[a-zA-Z0-9._-]+$')
   or path ~ ('^'||p_org::text||'/library/versions/'||p_file::text||'/'||uuid_pattern||'(-previous)?\.md$')) then
   raise exception 'Legacy or core document path requires reconciliation' using errcode='PT409';end if;
 end loop;
 if exists(select 1 from public.organization_document_files where id<>p_file and storage_path=any(p_paths))
  or exists(select 1 from public.document_file_versions where file_id<>p_file and storage_path=any(p_paths))
  or exists(select 1 from public.document_version_operations where file_id<>p_file and source_storage_path=any(p_paths))
  or exists(select 1 from public.document_file_versions v join public.document_file_versions source on source.id=v.restored_from where source.file_id=p_file and v.file_id<>p_file)

 then raise exception 'Independent document references require reconciliation' using errcode='PT409';end if;
 -- Reviewed page copies belong to workspace-page-assets and have no source FK;
 -- original-file retirement neither deletes their grants nor their bytes.
 -- Core history is independently retained. Bare paths and full Storage URLs
 -- (including encoded separators) in its structured payloads must be reconciled, not erased as a library side effect.
 if exists(select 1 from public.organization_core_document_versions v cross join unnest(p_paths) p where (strpos(v.content::text,p)>0 or strpos(lower(v.content::text),replace(lower(p),'/','%2f'))>0))
  or exists(select 1 from public.organization_core_document_sessions v cross join unnest(p_paths) p where (strpos(to_jsonb(v)::text,p)>0 or strpos(lower(to_jsonb(v)::text),replace(lower(p),'/','%2f'))>0))
  or exists(select 1 from public.organizations o cross join unnest(p_paths) p where (strpos(o.profile::text,p)>0 or strpos(lower(o.profile::text),replace(lower(p),'/','%2f'))>0))
 then raise exception 'Core document references require reconciliation' using errcode='PT409';end if;
end $$;
revoke all on function public.assert_closure_document_paths(uuid,uuid,text[]) from public,anon,authenticated,service_role;

create function public.reserve_expired_closure_document_purge(p_org_id uuid,p_file_id uuid,p_closure_request_id uuid,p_expected_closure_revision integer,p_operation_id uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare receipt public.organization_closure_document_cleanups; reservation jsonb;paths text[];canonical_paths text[];
begin
 if session_user is distinct from current_user or not exists(select 1 from pg_catalog.pg_roles where rolname=current_user and rolsuper) then raise exception 'Actual operator authority required' using errcode='42501';end if;
 if p_file_id is null or p_operation_id is null then raise exception 'Exact file and operation required' using errcode='22023';end if;
 perform 1 from public.organizations where user_id=p_org_id for update;
 if not found then raise exception 'Organization unavailable' using errcode='42501';end if;
 perform public.assert_expired_document_closure(p_org_id,p_closure_request_id,p_expected_closure_revision);
 perform pg_advisory_xact_lock(hashtextextended(p_org_id::text,141600));
 select * into receipt from public.organization_closure_document_cleanups where file_id=p_file_id for update;
 if found then
  if receipt.org_id is distinct from p_org_id or receipt.closure_request_id is distinct from p_closure_request_id or receipt.expected_closure_revision is distinct from p_expected_closure_revision or receipt.operation_id is distinct from p_operation_id then raise exception 'Document cleanup identity changed' using errcode='40001';end if;
  return jsonb_build_object('fileId',receipt.file_id,'paths',receipt.paths,'complete',receipt.state='complete');
 end if;
 -- An existing complete ordinary purge has no remaining source to authorize.
 if not exists(select 1 from public.organization_document_files where id=p_file_id and org_id=p_org_id and document_kind is null) then raise exception 'Library document unavailable' using errcode='42501';end if;
 -- Existing ordinary reservations are service-writable; independently derive
 -- authority from canonical file/version/provenance rows before promoting paths.
 perform 1 from public.organization_document_files where id=p_file_id and org_id=p_org_id for update;
 if exists(select 1 from public.document_version_operations where file_id=p_file_id and state='committed' and (source_storage_path is null or source_size_bytes is null)) then
  raise exception 'Legacy document source provenance requires reconciliation' using errcode='PT409';end if;
 select array_agg(distinct path order by path) into canonical_paths from (
  select storage_path path from public.organization_document_files where id=p_file_id and org_id=p_org_id
  union select storage_path from public.document_file_versions where file_id=p_file_id and org_id=p_org_id
  union select source_storage_path from public.document_version_operations where file_id=p_file_id and org_id=p_org_id and state<>'cleaned' and source_storage_path is not null
  union select p_org_id::text||'/library/versions/'||p_file_id::text||'/'||request_id::text||'.md' from public.document_version_operations where file_id=p_file_id and org_id=p_org_id and state<>'cleaned'
  union select p_org_id::text||'/library/versions/'||p_file_id::text||'/'||request_id::text||'-previous.md' from public.document_version_operations where file_id=p_file_id and org_id=p_org_id and state<>'cleaned'
 ) canonical;
 perform public.assert_closure_document_paths(p_org_id,p_file_id,canonical_paths);
 reservation:=public.freeze_document_file_purge(p_org_id,p_file_id,'00000000-0000-0000-0000-000000000000'::uuid);
 select array_agg(value order by value) into paths from jsonb_array_elements_text(reservation->'paths');
 if paths is distinct from canonical_paths then raise exception 'Frozen document paths differ from canonical provenance' using errcode='42501';end if;
 insert into public.organization_closure_document_cleanups(file_id,org_id,closure_request_id,expected_closure_revision,operation_id,operator_role,paths)
 values(p_file_id,p_org_id,p_closure_request_id,p_expected_closure_revision,p_operation_id,session_user,paths);
 return jsonb_build_object('fileId',p_file_id,'paths',paths,'complete',false);
end $$;
revoke all on function public.reserve_expired_closure_document_purge(uuid,uuid,uuid,integer,uuid) from public,anon,authenticated,service_role;

create function public.finish_expired_closure_document_purge(p_org_id uuid,p_file_id uuid,p_closure_request_id uuid,p_expected_closure_revision integer,p_operation_id uuid) returns boolean
language plpgsql security invoker set search_path='' as $$
declare receipt public.organization_closure_document_cleanups;
begin
 if session_user is distinct from current_user or not exists(select 1 from pg_catalog.pg_roles where rolname=current_user and rolsuper) then raise exception 'Actual operator authority required' using errcode='42501';end if;
 perform 1 from public.organizations where user_id=p_org_id for update;
 if not found then raise exception 'Organization unavailable' using errcode='42501';end if;
 perform public.assert_expired_document_closure(p_org_id,p_closure_request_id,p_expected_closure_revision);
 perform pg_advisory_xact_lock(hashtextextended(p_org_id::text,141600));
 select * into receipt from public.organization_closure_document_cleanups where file_id=p_file_id for update;
 if not found or receipt.org_id is distinct from p_org_id or receipt.closure_request_id is distinct from p_closure_request_id or receipt.expected_closure_revision is distinct from p_expected_closure_revision or receipt.operation_id is distinct from p_operation_id then raise exception 'Document cleanup identity changed' using errcode='40001';end if;
 if receipt.state='complete' then return true;end if;
 if not exists(select 1 from public.document_file_purges where file_id=p_file_id and org_id=p_org_id and paths=receipt.paths and state='reserved') then raise exception 'Frozen document reservation changed' using errcode='42501';end if;
 perform public.assert_closure_document_paths(p_org_id,p_file_id,receipt.paths);
 if exists(select 1 from storage.objects where bucket_id='org-documents' and name=any(receipt.paths)) then raise exception 'Document objects remain; retry deletion' using errcode='PT409';end if;
 update public.organization_closure_document_cleanups set state='finishing' where file_id=p_file_id;
 perform public.complete_document_file_purge(p_org_id,p_file_id);
 update public.organization_closure_document_cleanups set state='complete',completed_at=clock_timestamp() where file_id=p_file_id;
 return true;
end $$;
revoke all on function public.finish_expired_closure_document_purge(uuid,uuid,uuid,integer,uuid) from public,anon,authenticated,service_role;

-- Storage service receives no reserve/finish permission. The private durable
-- operator reservation authorizes only these exact DELETEs while closure holds.
create function public.closure_document_storage_delete_admitted(p_bucket text,p_path text) returns boolean
language plpgsql security definer set search_path='' as $$
declare receipt public.organization_closure_document_cleanups;
begin
 if p_bucket<>'org-documents' or auth.role() is distinct from 'service_role'
  or current_setting('transaction_isolation')<>'read committed' or current_setting('session_replication_role')<>'origin' then return false;end if;
 select c.* into receipt from public.organization_closure_document_cleanups c join public.document_file_purges p on p.file_id=c.file_id and p.org_id=c.org_id and p.paths=c.paths and p.state='reserved'
 where c.state='reserved' and p_path=any(c.paths);
 if not found then return false;end if;
 perform 1 from public.organizations where user_id=receipt.org_id for share nowait;
 if not found or not pg_try_advisory_xact_lock(hashtextextended(receipt.org_id::text,141600)) then return false;end if;
 perform public.assert_expired_document_closure(receipt.org_id,receipt.closure_request_id,receipt.expected_closure_revision);
 perform public.assert_closure_document_paths(receipt.org_id,receipt.file_id,receipt.paths);
 return true;
exception when lock_not_available then return false;
end $$;
revoke all on function public.closure_document_storage_delete_admitted(text,text) from public,anon,authenticated,service_role;

create function public.closure_document_finalization_allowed(p_org uuid,p_file uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare receipt public.organization_closure_document_cleanups;
begin
 if not exists(select 1 from pg_catalog.pg_roles where rolname=session_user and rolsuper)
  or current_setting('transaction_isolation')<>'read committed' or current_setting('session_replication_role')<>'origin' then return false;end if;
 select c.* into receipt from public.organization_closure_document_cleanups c join public.document_file_purges p on p.file_id=c.file_id and p.org_id=c.org_id and p.paths=c.paths and p.state='finishing'
 where c.file_id=p_file and c.org_id=p_org and c.state='finishing';
 if not found then return false;end if;
 perform public.assert_expired_document_closure(p_org,receipt.closure_request_id,receipt.expected_closure_revision);
 return true;
end $$;
revoke all on function public.closure_document_finalization_allowed(uuid,uuid) from public,anon,authenticated,service_role;

-- Guarded edits retain all existing ordinary admission, identity and activity
-- logic. No lifecycle-wide bypass, session flag or new app grant is introduced.
do $$
declare definition text; needle text; replacement text;
begin
 definition:=pg_get_functiondef('public.guard_organization_storage_mutation()'::regprocedure);
 needle:='begin'||chr(10);
 replacement:=needle||' if tg_op=''DELETE'' and public.closure_document_storage_delete_admitted(old.bucket_id,old.name) then return old;end if;'||chr(10);
 if strpos(definition,needle)=0 then raise exception 'Unexpected Storage mutation owner';end if;
 execute replace(definition,needle,replacement);
 definition:=pg_get_functiondef('public.guard_uploaded_document_closure()'::regprocedure);
 needle:=' perform public.guard_uploaded_document_organization(org);';
 replacement:=' if tg_table_name in (''organization_document_files'',''document_collaboration_rooms'',''document_file_versions'',''document_version_operations'')
  and public.closure_document_finalization_allowed(org,case when tg_table_name=''organization_document_files'' then (row_data->>''id'')::uuid else (row_data->>''file_id'')::uuid end) then
  if tg_op=''DELETE'' then return old;end if;
  if tg_table_name=''document_file_versions'' and tg_op=''UPDATE'' and (row_data->>''restored_from'') is null and (row_data-''restored_from'')=(old_data-''restored_from'') then return new;end if;
 end if;'||chr(10)||needle;
 if strpos(definition,needle)=0 then raise exception 'Unexpected document closure owner';end if;
 execute replace(definition,needle,replacement);
 definition:=pg_get_functiondef('public.record_organization_file_activity()'::regprocedure);
 needle:='  -- Compliance uploads are already captured by their profile document mutation.';
 replacement:='  if tg_table_name=''organization_document_files'' and tg_op=''DELETE'' and public.closure_document_finalization_allowed((previous->>''org_id'')::uuid,(previous->>''id'')::uuid) then return old;end if;'||chr(10)||needle;
 if strpos(definition,needle)=0 then raise exception 'Unexpected document activity owner';end if;
 execute replace(definition,needle,replacement);
end $$;
comment on table public.organization_closure_document_cleanups is
 'Private exact-request operator source-stage receipt. Retains frozen private library paths and actual database operator. No organization-complete, hosted durability or application cleanup grant.';
comment on function public.reserve_expired_closure_document_purge(uuid,uuid,uuid,integer,uuid) is
 'Actual operator only after exact fixed closure deadline. Active and trashed canonical library files qualify; unknown legacy/core/shared source provenance requires reconciliation. Newly created shared purge records use nil actor UUID solely as a non-user operator marker; authority comes from this private receipt, never that marker.';
commit;
