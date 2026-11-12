do $$begin if current_database() not like 'ch_legacy_stage_%' then raise exception 'Owned stage fixture required';end if;end $$;
create function pg_temp.check_stage(ok boolean,message text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'Assertion failed: %',message;end if;end $$;
create function pg_temp.deny_stage(command text,expected text default '42501') returns void language plpgsql as $$begin begin execute command;exception when others then if sqlstate=expected then return;end if;raise exception 'Expected %, got %: %',expected,sqlstate,sqlerrm;end;raise exception 'Unexpected success: %',command;end $$;
set request.jwt.claim.role='service_role';
set storage.allow_delete_query='true';
\set org 'e972bc07-fbf5-4fc8-a416-7f00910a71e2'
\set actor '90b6c688-889c-467f-9edd-166f28bf0819'
\set project '79000000-0000-4000-8000-000000000001'
\set folder '79000000-0000-4000-8000-000000000002'
select set_config('request.headers',jsonb_build_object('x-coach-house-actor-id',:'org')::text,false);
insert into organization_memberships(org_id,member_id,role,member_email) select :'org',:'actor','staff',email from auth.users where id=:'actor' on conflict(org_id,member_id) do update set role='staff';
insert into organization_projects(id,org_id,name,created_by,updated_by) values(:'project',:'org','Legacy stage fixture',:'org',:'org');
insert into project_asset_folder_libraries(project_id) values(:'project');
insert into project_asset_folders(project_id,id,name,position,audience,created_by) values(:'project',:'folder','Restricted',0,'restricted',:'org');
insert into project_asset_folder_grants(project_id,folder_id,member_id,membership_created_at,capability) select :'project',:'folder',member_id,created_at,'edit' from organization_memberships where org_id=:'org' and member_id=:'actor';
\set p1 'e972bc07-fbf5-4fc8-a416-7f00910a71e2/w9/79000000-0000-4000-8000-000000000011-first.pdf'
\set p2 'e972bc07-fbf5-4fc8-a416-7f00910a71e2/w9/79000000-0000-4000-8000-000000000012-second.pdf'
\set p3 'e972bc07-fbf5-4fc8-a416-7f00910a71e2/w9/79000000-0000-4000-8000-000000000013-failed.pdf'
select pg_temp.check_stage(reserve_legacy_document_upload(:'org','w9',:'p1',10,:'org')->>'state'='staged','reserve');
select pg_temp.check_stage(reserve_legacy_document_upload(:'org','w9',:'p1',10,:'org')->>'state'='staged','reserve replay');
select pg_temp.deny_stage(format('select reserve_legacy_document_upload(%L,''w9'',%L,11,%L)',:'org',:'p1',:'org'));
insert into storage.objects(bucket_id,name,metadata) values('org-documents',:'p1','{"size":10}');
update organizations set profile=jsonb_set(profile,'{documents}',coalesce(profile->'documents','{}')||jsonb_build_object('w9',jsonb_build_object('path',:'p1','name','first.pdf','size',10))) where user_id=:'org';
select pg_temp.check_stage((select state='committed' and file_id is not null from legacy_document_upload_stages where storage_path=:'p1'),'atomic commit');
select id as file from organization_document_files where org_id=:'org' and document_kind='w9' \gset
-- Fixture injection only: binding creation remains disabled for legacy in product.
-- All permission functions, triggers and downstream behavior remain real.
alter table document_file_folder_authorities disable trigger document_file_folder_authority_scope;
insert into document_file_folder_authorities(file_id,project_id,folder_id) values(:'file',:'project',:'folder');
alter table document_file_folder_authorities enable trigger document_file_folder_authority_scope;
select pg_temp.check_stage(abandon_legacy_document_upload(:'org',:'p1',:'org')='committed','lost commit response never abandons');
select pg_temp.deny_stage(format('delete from storage.objects where name=%L',:'p1'));
select set_config('request.headers',jsonb_build_object('x-coach-house-actor-id',:'actor')::text,false);
select reserve_legacy_document_upload(:'org','w9',:'p2',20,:'actor');
insert into storage.objects(bucket_id,name,metadata) values('org-documents',:'p2','{"size":20}');
update organizations set profile=jsonb_set(profile,'{documents,w9}',jsonb_build_object('path',:'p2','name','second.pdf','size',20)) where user_id=:'org';
select pg_temp.check_stage((select id=:'file' and storage_path=:'p2' from organization_document_files where org_id=:'org' and document_kind='w9'),'bound legacy replacement retains identity');
select pg_temp.check_stage((select state='committed' and file_id=:'file' from legacy_document_upload_stages where storage_path=:'p2'),'replacement transfer');
select pg_temp.check_stage((select size_bytes=10 from legacy_document_cleanup where storage_path=:'p1'),'outgoing bytes retained');
select reserve_legacy_document_cleanup(:'org','w9',:'actor');
delete from storage.objects where name=:'p1';
select pg_temp.check_stage(finish_legacy_document_cleanup(:'org',:'p1',:'actor'),'bound outgoing cleanup');
select reserve_legacy_document_upload(:'org','w9',:'p3',30,:'actor');
select pg_temp.deny_stage(format('insert into storage.objects(bucket_id,name,metadata) values(''org-documents'',%L,''{"size":31}'')',:'p3'),'23514');
insert into storage.objects(bucket_id,name,metadata) values('org-documents',:'p3','{"size":30}');
select pg_temp.check_stage(abandon_legacy_document_upload(:'org',:'p3',:'actor')='abandoned','failed CAS abandoned');
select reserve_legacy_document_stage_cleanup(:'org',:'actor',false,:'p3');
select pg_temp.check_stage(not finish_legacy_document_stage_cleanup(:'org',:'p3',:'actor'),'physical bytes retain charge');
update project_asset_folder_grants set capability='view' where project_id=:'project';
select pg_temp.deny_stage(format('delete from storage.objects where name=%L',:'p3'));
select pg_temp.deny_stage(format('select finish_legacy_document_stage_cleanup(%L,%L,%L)',:'org',:'p3',:'actor'));
update project_asset_folder_grants set capability='edit' where project_id=:'project';
delete from storage.objects where name=:'p3';
select pg_temp.check_stage(finish_legacy_document_stage_cleanup(:'org',:'p3',:'actor'),'cleanup finishes');
select pg_temp.check_stage(finish_legacy_document_stage_cleanup(:'org',:'p3',:'actor'),'cleanup replay');
select pg_temp.check_stage((select state='cleaned' and size_bytes=0 from legacy_document_upload_stages where storage_path=:'p3'),'only absent bytes uncharged');
select pg_temp.deny_stage(format('insert into storage.objects(bucket_id,name,metadata) values(''org-documents'',%L,''{"size":30}'')',:'p3'));
select pg_temp.deny_stage(format('update organizations set profile=jsonb_set(profile,''{documents,w9}'',jsonb_build_object(''path'',%L,''size'',30)) where user_id=%L',:'p3',:'org'));
select pg_temp.check_stage(not has_table_privilege('service_role','public.legacy_document_upload_stages','update') and not has_table_privilege('authenticated','public.legacy_document_upload_stages','select'),'ledger ACL');
select pg_temp.check_stage(not has_function_privilege('authenticated','public.reserve_legacy_document_upload(uuid,text,text,bigint,uuid,boolean)','execute'),'RPC ACL');
-- A durable expired intent with no object can be reclaimed, and a delayed
-- provider insert is fenced even if it arrives after absence was finalized.
select set_config('request.headers',jsonb_build_object('x-coach-house-actor-id',:'org')::text,false);
\set stale 'e972bc07-fbf5-4fc8-a416-7f00910a71e2/w9/79000000-0000-4000-8000-000000000014-expired.pdf'
select reserve_legacy_document_upload(:'org','w9',:'stale',8,:'org');
update legacy_document_upload_stages set expires_at=clock_timestamp()-interval '1 minute' where storage_path=:'stale';
select pg_temp.deny_stage(format('insert into storage.objects(bucket_id,name,metadata) values(''org-documents'',%L,''{"size":8}'')',:'stale'));
select pg_temp.check_stage(jsonb_array_length(reserve_legacy_document_stage_cleanup(:'org',:'org',false,:'stale'))=1,'expired intent reclaimed');
select pg_temp.check_stage(finish_legacy_document_stage_cleanup(:'org',:'stale',:'org'),'never uploaded intent finishes');
select pg_temp.deny_stage(format('insert into storage.objects(bucket_id,name,metadata) values(''org-documents'',%L,''{"size":8}'')',:'stale'));
-- Same total quota owner counts reservations and transfers to canonical rows.
-- Fill only synthetic pending reservations inside a rollback transaction.
begin;
do $$
declare org uuid:='e972bc07-fbf5-4fc8-a416-7f00910a71e2'; base bigint; remaining bigint; size bigint; n integer:=200; path text;
begin
 select coalesce(sum(size_bytes),0) into base from organization_document_files where org_id=org;
 base:=base+coalesce((select sum(v.size_bytes) from document_file_versions v where v.org_id=org and not exists(select 1 from organization_document_files f where f.storage_path=v.storage_path)),0)+document_retained_source_bytes(org);
 remaining:=5368709120-base;
 while remaining>0 loop
  size:=least(52428800,remaining);
  path:=org::text||'/w9/79000000-0000-4000-8000-'||lpad(n::text,12,'0')||'-capacity.pdf';
  perform reserve_legacy_document_upload(org,'w9',path,size,org);
  remaining:=remaining-size;n:=n+1;
 end loop;
 perform pg_temp.deny_stage(format('select reserve_legacy_document_upload(%L,''w9'',%L,1,%L)',org,org::text||'/w9/79000000-0000-4000-8000-000000000400-over.pdf',org),'23514');
 perform pg_temp.check_stage(not exists(select 1 from legacy_document_upload_stages where storage_path=org::text||'/w9/79000000-0000-4000-8000-000000000400-over.pdf'),'quota rejection creates no intent');
end $$;
rollback;
-- Real rollback must retain the intent and leave prior canonical state intact.
\set rollback_path 'e972bc07-fbf5-4fc8-a416-7f00910a71e2/w9/79000000-0000-4000-8000-000000000015-rollback.pdf'
select reserve_legacy_document_upload(:'org','w9',:'rollback_path',9,:'org');
insert into storage.objects(bucket_id,name,metadata) values('org-documents',:'rollback_path','{"size":9}');
begin;
update organizations set profile=jsonb_set(profile,'{documents,w9}',jsonb_build_object('path',:'rollback_path','name','rollback.pdf','size',9)) where user_id=:'org';
rollback;
select pg_temp.check_stage((select state='staged' from legacy_document_upload_stages where storage_path=:'rollback_path'),'canonical rollback retains intent');
select pg_temp.check_stage((select storage_path=:'p2' from organization_document_files where id=:'file'),'canonical rollback preserves prior object');
select abandon_legacy_document_upload(:'org',:'rollback_path',:'org');
select reserve_legacy_document_stage_cleanup(:'org',:'org',false,:'rollback_path');
delete from storage.objects where name=:'rollback_path';
select pg_temp.check_stage(finish_legacy_document_stage_cleanup(:'org',:'rollback_path',:'org'),'rollback bytes cleaned');
-- Numeric historical policy identifiers remain compatible.
begin;
update organizations set profile=jsonb_set(profile,'{policies}',coalesce(profile->'policies','[]')||jsonb_build_array(jsonb_build_object('id','1731000000000','title','Historical policy'))) where user_id=:'org';
select pg_temp.check_stage(reserve_legacy_document_upload(:'org','policy:1731000000000',:'org'||'/policies/1731000000000/79000000-0000-4000-8000-000000000016-policy.pdf',4,:'org')->>'state'='staged','historical policy ID');
rollback;
-- A folder-bound canonical identity survives removal and subsequent re-upload.
update organizations set profile=jsonb_set(profile,'{documents}',(profile->'documents')-'w9') where user_id=:'org';
select pg_temp.check_stage((select deleted_at is not null and id=:'file' from organization_document_files where org_id=:'org' and document_kind='w9'),'bound removal retains identity');
select reserve_legacy_document_cleanup(:'org','w9',:'org');
delete from storage.objects where name=:'p2';
select pg_temp.check_stage(finish_legacy_document_cleanup(:'org',:'p2',:'org'),'bound removal cleanup');
\set reupload 'e972bc07-fbf5-4fc8-a416-7f00910a71e2/w9/79000000-0000-4000-8000-000000000017-reupload.pdf'
select reserve_legacy_document_upload(:'org','w9',:'reupload',5,:'org');
insert into storage.objects(bucket_id,name,metadata) values('org-documents',:'reupload','{"size":5}');
update organizations set profile=jsonb_set(profile,'{documents,w9}',jsonb_build_object('path',:'reupload','name','reupload.pdf','size',5)) where user_id=:'org';
select pg_temp.check_stage((select id=:'file' and deleted_at is null from organization_document_files where org_id=:'org' and document_kind='w9'),'bound reupload retains identity and authority');
select pg_temp.check_stage((select count(*)=1 from document_file_folder_authorities where file_id=:'file'),'folder binding retained');
-- Unknown historical bytes never enter the new cleanup queue by inference.
insert into storage.objects(bucket_id,name,metadata) values('org-documents',:'org'||'/w9/unknown-history.pdf','{"size":5}');
select pg_temp.check_stage(not exists(select 1 from legacy_document_upload_stages where storage_path=:'org'||'/w9/unknown-history.pdf'),'historical object not adopted');
select reserve_legacy_document_stage_cleanup(:'org',:'org');
select pg_temp.check_stage(exists(select 1 from storage.objects where name=:'org'||'/w9/unknown-history.pdf'),'historical object preserved');
select pg_temp.check_stage((select bool_and(confdeltype='c') from pg_constraint where conrelid='legacy_document_upload_stages'::regclass and contype='f'),'stage FK cascade preserves existing parent retirement contract');
-- Stage entrypoints preserve tenant, verified actor, paid and support boundaries.
begin;
select pg_temp.deny_stage(format('select reserve_legacy_document_upload(%L,''w9'',%L,1,%L)',:'actor',:'org'||'/w9/79000000-0000-4000-8000-000000000020-foreign.pdf',:'org'));
select set_config('request.headers','{}',false);
select pg_temp.deny_stage(format('select reserve_legacy_document_upload(%L,''w9'',%L,1,%L)',:'org',:'org'||'/w9/79000000-0000-4000-8000-000000000021-unverified.pdf',:'org'));
select set_config('request.headers',jsonb_build_object('x-coach-house-actor-id',:'org')::text,false);
update subscriptions set status='canceled' where user_id=:'org';
select pg_temp.deny_stage(format('select reserve_legacy_document_upload(%L,''w9'',%L,1,%L)',:'org',:'org'||'/w9/79000000-0000-4000-8000-000000000022-free.pdf',:'org'));
rollback;
begin;
insert into platform_staff_members(user_id,access_level) values(:'actor','coach') on conflict(user_id) do update set access_level='coach';
insert into workspace_support_grants(user_id) values(:'actor') on conflict(user_id) do update set revoked_at=null;
select set_config('request.headers',jsonb_build_object('x-coach-house-actor-id',:'actor')::text,false);
\set support_path 'e972bc07-fbf5-4fc8-a416-7f00910a71e2/w9/79000000-0000-4000-8000-000000000023-support.pdf'
select reserve_legacy_document_upload(:'org','w9',:'support_path',2,:'actor',true);
insert into storage.objects(bucket_id,name,metadata) values('org-documents',:'support_path','{"size":2}');
select abandon_legacy_document_upload(:'org',:'support_path',:'actor',true);
select reserve_legacy_document_stage_cleanup(:'org',:'actor',true,:'support_path');
update workspace_support_grants set revoked_at=now() where user_id=:'actor';
select pg_temp.deny_stage(format('delete from storage.objects where name=%L',:'support_path'));
update workspace_support_grants set revoked_at=null where user_id=:'actor';
delete from storage.objects where name=:'support_path';
select pg_temp.check_stage(finish_legacy_document_stage_cleanup(:'org',:'support_path',:'actor',true),'support context preserved and revocation respected');
rollback;
-- An existing qualified closure receipt remains authoritative even when its
-- exact object has a stage tombstone. This seeds only a legacy-format receipt
-- association; it does not widen today's UUID-upload closure admission.
begin;
select set_config('request.headers',jsonb_build_object('x-coach-house-actor-id',:'org')::text,false);
\set closure_path 'e972bc07-fbf5-4fc8-a416-7f00910a71e2/stateRegistration/1793683000000-closure.pdf'
\set closure_object '79000000-0000-4000-8000-000000000500'
\set closure_request '79000000-0000-4000-8000-000000000501'
\set closure_operation '79000000-0000-4000-8000-000000000502'
update organizations set profile=jsonb_set(profile,'{documents,stateRegistration}',jsonb_build_object('path',:'closure_path','name','closure.pdf','size',3)) where user_id=:'org';
insert into storage.objects(id,bucket_id,name,metadata) values(:'closure_object','org-documents',:'closure_path','{"size":3}');
insert into legacy_document_upload_stages(storage_path,org_id,document_kind,file_id,actor_id,size_bytes,state)
 select :'closure_path',:'org','stateRegistration',id,:'org',3,'committed' from organization_document_files where org_id=:'org' and document_kind='stateRegistration';
insert into organization_closures(org_id,state,revision,request_id,requested_at,export_until) values(:'org','closing',1,:'closure_request',statement_timestamp()-interval '31 days',statement_timestamp()-interval '31 days'+interval '720 hours');
insert into organization_closure_operations(org_id,operation_id,action,expected_revision,completed_at) select org_id,request_id,'request',0,requested_at from organization_closures where org_id=:'org';
select reserve_expired_closure_asset_purge(:'org',:'closure_object',:'closure_request',1,:'closure_operation','http://127.0.0.1:55321');
select pg_temp.check_stage(closure_asset_storage_delete_admitted(:'closure_object','org-documents',:'closure_path'),'real exact closure receipt admits deletion');
delete from storage.objects where id=:'closure_object';
select pg_temp.check_stage(finish_expired_closure_asset_purge(:'org',:'closure_object',:'closure_request',1,:'closure_operation','http://127.0.0.1:55321'),'existing closure finalization retained');
select pg_temp.check_stage(not exists(select 1 from legacy_document_upload_stages where storage_path=:'closure_path'),'exact canonical deletion cascades stage tombstone');
rollback;
-- Actual provider preflight shape: temporary version=1 has contentLength but no
-- measured size. It never suffices for canonical commit or exceeds reservation.
begin;
select set_config('request.headers',jsonb_build_object('x-coach-house-actor-id',:'org')::text,false);
\set preflight 'e972bc07-fbf5-4fc8-a416-7f00910a71e2/w9/79000000-0000-4000-8000-000000000024-preflight.pdf'
select reserve_legacy_document_upload(:'org','w9',:'preflight',10,:'org');
select pg_temp.deny_stage(format('insert into storage.objects(bucket_id,name,version,metadata) values(''org-documents'',%L,''1'',''{"contentLength":11}'')',:'preflight'),'23514');
select pg_temp.deny_stage(format('insert into storage.objects(bucket_id,name,version,metadata) values(''org-documents'',%L,''final-version'',''{"contentLength":10}'')',:'preflight'),'23514');
insert into storage.objects(bucket_id,name,version,metadata) values('org-documents',:'preflight','1','{"contentLength":10,"mimetype":"application/pdf"}');
select pg_temp.deny_stage(format('update organizations set profile=jsonb_set(profile,''{documents,w9}'',jsonb_build_object(''path'',%L,''size'',10)) where user_id=%L',:'preflight',:'org'),'23514');
rollback;
-- Routine unrelated profile and current metadata updates may upsert with a new
-- INSERT UUID; retained canonical identity and current folder authority prevail.
begin;
select set_config('request.headers',jsonb_build_object('x-coach-house-actor-id',:'actor')::text,false);
update organizations set profile=jsonb_set(profile,'{documents,w9,name}','"Authorized rename"') where user_id=:'org';
select pg_temp.check_stage((select id=:'file' and name='Authorized rename' from organization_document_files where org_id=:'org' and document_kind='w9'),'committed upsert uses retained identity');
rollback;
-- The real HTTP app commits through authenticated profile CAS, not service-role
-- SQL. Keep parent RLS and verify actual affected rows/canonical readback.
begin;
select set_config('request.headers',jsonb_build_object('x-coach-house-actor-id',:'org')::text,false);
\set session_path 'e972bc07-fbf5-4fc8-a416-7f00910a71e2/w9/79000000-0000-4000-8000-000000000025-session.pdf'
select reserve_legacy_document_upload(:'org','w9',:'session_path',7,:'org');
insert into storage.objects(bucket_id,name,metadata) values('org-documents',:'session_path','{"size":7}');
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub',:'actor',true);
select set_config('request.headers',jsonb_build_object('x-coach-house-actor-id',:'org')::text,true);
select pg_temp.deny_stage(format('update organizations set profile=jsonb_set(profile,''{documents,w9}'',jsonb_build_object(''path'',%L,''name'',''forged.pdf'',''size'',7)) where user_id=%L',:'session_path',:'org'));
select set_config('request.jwt.claim.sub',:'org',true);
select set_config('request.headers','{}',true);
update organizations set profile=jsonb_set(profile,'{documents,w9}',jsonb_build_object('path',:'session_path','name','session.pdf','size',7)) where user_id=:'org';
reset role;
select pg_temp.check_stage((select state='committed' and file_id=:'file' from legacy_document_upload_stages where storage_path=:'session_path'),'authenticated profile CAS commits stage');
select pg_temp.check_stage((select storage_path=:'session_path' and size_bytes=7 from organization_document_files where id=:'file'),'authenticated CAS affected canonical row');
select pg_temp.check_stage(not has_function_privilege('authenticated','public.assert_legacy_upload_commit_authority(uuid,uuid,boolean)','execute'),'commit helper remains private');
rollback;
