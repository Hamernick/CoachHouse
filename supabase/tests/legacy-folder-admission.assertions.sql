do $$begin if current_database() not like 'ch_legacy_admission_%' then raise exception 'Owned admission fixture required';end if;end $$;
create function pg_temp.check_admission(ok boolean,message text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'Assertion failed: %',message;end if;end $$;
create function pg_temp.deny_admission(command text,expected text default '42501') returns void language plpgsql as $$begin begin execute command;exception when others then if sqlstate=expected then return;end if;raise exception 'Expected %, got %: %',expected,sqlstate,sqlerrm;end;raise exception 'Unexpected success: %',command;end $$;
set request.jwt.claim.role='service_role';
set storage.allow_delete_query='true';
\set org 'e972bc07-fbf5-4fc8-a416-7f00910a71e2'
\set actor '90b6c688-889c-467f-9edd-166f28bf0819'
\set project '7a000000-0000-4000-8000-000000000001'
\set folder '7a000000-0000-4000-8000-000000000002'
\set p1 'e972bc07-fbf5-4fc8-a416-7f00910a71e2/w9/7a000000-0000-4000-8000-000000000011-current.pdf'
\set p2 'e972bc07-fbf5-4fc8-a416-7f00910a71e2/w9/7a000000-0000-4000-8000-000000000012-staged.pdf'
\set old_path 'e972bc07-fbf5-4fc8-a416-7f00910a71e2/w9/1731000000000-retained.pdf'
select pg_temp.check_admission((select count(*)=0 from organization_private_storage_cutovers),'migration leaves activation off');
select pg_temp.check_admission((select count(*)=0 from document_file_folder_authorities),'migration creates no bindings');
select set_config('request.headers',jsonb_build_object('x-coach-house-actor-id',:'org')::text,false);
insert into organization_memberships(org_id,member_id,role,member_email) select :'org',:'actor','staff',email from auth.users where id=:'actor' on conflict(org_id,member_id) do update set role='staff';
insert into organization_projects(id,org_id,name,created_by,updated_by) values(:'project',:'org','Legacy admission fixture',:'org',:'org');
insert into project_asset_folder_libraries(project_id) values(:'project');
insert into project_asset_folders(project_id,id,name,position,audience,created_by) values(:'project',:'folder','Restricted',0,'restricted',:'org');
insert into project_asset_folder_grants(project_id,folder_id,member_id,membership_created_at,capability) select :'project',:'folder',member_id,created_at,'edit' from organization_memberships where org_id=:'org' and member_id=:'actor';
select reserve_legacy_document_upload(:'org','w9',:'p1',10,:'org');
insert into storage.objects(bucket_id,name,metadata) values('org-documents',:'p1','{"size":10}');
update organizations set profile=jsonb_set(profile,'{documents}',coalesce(profile->'documents','{}')||jsonb_build_object('w9',jsonb_build_object('path',:'p1','name','current.pdf','size',10))) where user_id=:'org';
select id as file from organization_document_files where org_id=:'org' and document_kind='w9' \gset
select format('insert into document_file_folder_authorities(file_id,project_id,folder_id) values(%L,%L,%L)',:'file',:'project',:'folder') as bind \gset
select pg_temp.deny_admission(:'bind');
-- ACLs remain closed even when a synthetic operator prerequisite exists.
insert into organization_private_storage_cutovers(org_id) values(:'org');
select pg_temp.check_admission(not has_table_privilege('authenticated','document_file_folder_authorities','insert') and not has_table_privilege('service_role','document_file_folder_authorities','insert'),'binding table ACL unchanged');
select pg_temp.check_admission(not has_function_privilege('authenticated','guard_document_file_folder_authority()','execute') and not has_function_privilege('service_role','guard_document_file_folder_authority()','execute'),'trigger ACL unchanged');
set role authenticated;
select pg_temp.deny_admission(:'bind');
reset role;
set role service_role;
select pg_temp.deny_admission(:'bind');
reset role;
-- Current and staged sources share exactly one retained canonical identity.
select reserve_legacy_document_upload(:'org','w9',:'p2',6,:'org');
insert into storage.objects(bucket_id,name,metadata) values('org-documents',:'old_path','{"size":4}');
insert into legacy_document_cleanup(storage_path,org_id,file_id,document_kind,size_bytes) values(:'old_path',:'org',:'file','w9',4);
:bind;
select pg_temp.check_admission((select file_id=:'file' from document_file_folder_authorities where file_id=:'file'),'current/staged/retained admission');
select pg_temp.deny_admission(format('delete from organization_private_storage_cutovers where org_id=%L',:'org'));
select pg_temp.deny_admission(format('update organization_private_storage_cutovers set org_id=%L where org_id=%L',:'actor',:'org'));
select pg_temp.check_admission(document_file_folder_actor_can(:'file',:'actor','edit'),'existing editor retained');
update project_asset_folder_grants set capability='view' where project_id=:'project';
select pg_temp.check_admission(not document_file_folder_actor_can(:'file',:'actor','edit'),'revoked edit denied');
select set_config('request.headers',jsonb_build_object('x-coach-house-actor-id',:'actor')::text,false);
select pg_temp.deny_admission(format('insert into storage.objects(bucket_id,name,metadata) values(''org-documents'',%L,''{"size":6}'')',:'p2'));
select pg_temp.deny_admission(format('update organizations set profile=jsonb_set(profile,''{documents,w9,name}'',''"revoked.pdf"'') where user_id=%L',:'org'));
select set_config('request.headers',jsonb_build_object('x-coach-house-actor-id',:'org')::text,false);
update project_asset_folder_grants set capability='edit' where project_id=:'project';
delete from document_file_folder_authorities where file_id=:'file';
-- Canonical native files still follow their unchanged admission branch.
insert into organization_document_files(org_id,storage_path,name,mime_type,size_bytes,created_by)
values(:'org',:'org'||'/library/admission-native.md','Native fixture','text/markdown',0,:'org') returning id as native_file \gset
-- Actual immutable-version and retained-original tables join the same identity.
begin;
insert into document_file_versions(file_id,org_id,actor_id,storage_path,name,mime_type,size_bytes,content_hash,revision,source_updated_at,generation,sequence)
values(:'file',:'org',:'org',:'org'||'/library/versions/'||:'file'||'/7a000000-0000-4000-8000-000000000021-previous.md','History','text/markdown',2,repeat('a',64),'admission-history',now(),'7a000000-0000-4000-8000-000000000022',0);
insert into document_version_operations(file_id,request_id,org_id,actor_id,fingerprint,staged_bytes,state,source_storage_path,source_size_bytes)
values(:'file','7a000000-0000-4000-8000-000000000023',:'org',:'org','admission-retained',2,'committed',:'old_path',4);
:bind;
select pg_temp.check_admission((select count(*)=1 from document_file_folder_authorities),'version and retained-original sources admitted');
rollback;
begin;
-- Historical-corruption seed only; restore the provenance fence before admission.
alter table document_version_operations disable trigger document_purge_fence;
insert into document_version_operations(file_id,request_id,org_id,actor_id,fingerprint,staged_bytes,state)
values(:'file','7a000000-0000-4000-8000-000000000024',:'org',:'org','admission-incomplete',2,'committed');
alter table document_version_operations enable trigger document_purge_fence;
\echo rejection at source fixture
select pg_temp.deny_admission(:'bind','23514');
rollback;
begin;
alter table document_version_operations disable trigger document_purge_fence;
insert into document_version_operations(file_id,request_id,org_id,actor_id,fingerprint,staged_bytes,state,source_storage_path,source_size_bytes)
values(:'native_file','7a000000-0000-4000-8000-000000000025',:'org',:'org','admission-alias',2,'committed',:'p1',10);
alter table document_version_operations enable trigger document_purge_fence;
\echo rejection at source fixture
select pg_temp.deny_admission(:'bind','23514');
select pg_temp.check_admission((select count(*)=1 from document_version_operations where request_id='7a000000-0000-4000-8000-000000000025'),'conflicting copy unchanged');
rollback;
begin;
-- Simulate a historical profile/tracking mismatch without weakening admission.
alter table organizations disable trigger track_organization_core_document_files;
update organizations set profile=jsonb_set(profile,'{documents}',(profile->'documents')-'w9') where user_id=:'org';
alter table organizations enable trigger track_organization_core_document_files;
select pg_temp.deny_admission(:'bind','23514');
rollback;
begin;
insert into organization_closures(org_id,state,revision,request_id,requested_at,export_until)
values(:'org','closing',1,'7a000000-0000-4000-8000-000000000030',now(),now()+interval '720 hours');
select pg_temp.deny_admission(:'bind');
rollback;
begin isolation level repeatable read;
select pg_temp.deny_admission(format('delete from organization_private_storage_cutovers where org_id=%L',:'org'),'40001');
select pg_temp.deny_admission(:'bind','40001');
rollback;
begin;
alter table organizations disable trigger track_organization_core_document_files;
update organizations set profile=jsonb_set(profile,'{documents}','[]') where user_id=:'org';
alter table organizations enable trigger track_organization_core_document_files;
select pg_temp.deny_admission(:'bind','23514');
rollback;
begin;
alter table organizations disable trigger track_organization_policy_document_files;
update organizations set profile=jsonb_set(profile,'{policies}','{}') where user_id=:'org';
alter table organizations enable trigger track_organization_policy_document_files;
select pg_temp.deny_admission(:'bind','23514');
rollback;
begin;
select set_config('request.headers',jsonb_build_object('x-coach-house-actor-id',:'actor')::text,true);
insert into organization_projects(id,org_id,name,created_by,updated_by) values('7a000000-0000-4000-8000-000000000031',:'actor','Foreign fixture',:'actor',:'actor');
insert into project_asset_folder_libraries(project_id) values('7a000000-0000-4000-8000-000000000031');
insert into project_asset_folders(project_id,id,name,position,audience,created_by) values('7a000000-0000-4000-8000-000000000031','7a000000-0000-4000-8000-000000000032','Foreign',0,'restricted',:'actor');
select pg_temp.deny_admission(format('insert into document_file_folder_authorities(file_id,project_id,folder_id) values(%L,''7a000000-0000-4000-8000-000000000031'',''7a000000-0000-4000-8000-000000000032'')',:'file'),'23514');
rollback;
begin;
update organizations set profile=jsonb_set(profile,'{documents,historicalAlias}',jsonb_build_object('path',:'p1','name','Copy')) where user_id=:'org';
\echo rejection at source fixture
select pg_temp.deny_admission(:'bind','23514');
select pg_temp.check_admission((select profile#>>'{documents,historicalAlias,path}'=:'p1' from organizations where user_id=:'org'),'unknown profile copy preserved');
rollback;
-- Deliberately malformed historical ledger rows are held, never repaired/deleted.
begin;
update legacy_document_upload_stages set file_id=null where storage_path=:'p2';
\echo rejection at source fixture
select pg_temp.deny_admission(:'bind','23514');
select pg_temp.check_admission((select file_id is null from legacy_document_upload_stages where storage_path=:'p2'),'unresolved stage unchanged');
rollback;
begin;
update legacy_document_upload_stages set document_kind='bylaws' where storage_path=:'p2';
\echo rejection at source fixture
select pg_temp.deny_admission(:'bind','23514');
rollback;
begin;
update legacy_document_upload_stages set state='cleaned',size_bytes=0,file_id=null where storage_path=:'p2';
:bind;
select pg_temp.check_admission((select count(*)=1 from document_file_folder_authorities),'absent cleaned preidentity tombstone preserved');
rollback;
begin;
update legacy_document_cleanup set storage_path=:'actor'||'/w9/foreign.pdf' where storage_path=:'old_path';
\echo rejection at source fixture
select pg_temp.deny_admission(:'bind','23514');
rollback;
begin;
update legacy_document_cleanup set storage_path=:'org'||'/w9/../wrong.pdf' where storage_path=:'old_path';
\echo rejection at source fixture
select pg_temp.deny_admission(:'bind','23514');
rollback;
begin;
update legacy_document_cleanup set completed_at=now(),claimed_at=now(),size_bytes=0 where storage_path=:'old_path';
\echo rejection at source fixture
select pg_temp.deny_admission(:'bind','23514');
rollback;
begin;
update legacy_document_upload_stages set state='cleaned',size_bytes=0 where storage_path=:'p1';
\echo rejection at source fixture
select pg_temp.deny_admission(:'bind','23514');
rollback;
-- The retired UUID remains bindable; metadata retirement does not erase bytes.
begin;
update organizations set profile=jsonb_set(profile,'{documents}',(profile->'documents')-'w9') where user_id=:'org';
:bind;
select pg_temp.check_admission((select f.deleted_at is not null and a.file_id=f.id from organization_document_files f join document_file_folder_authorities a on a.file_id=f.id where f.id=:'file'),'retired canonical identity admission');
rollback;
-- Historical numeric policy identity uses its existing canonical row.
begin;
update organizations set profile=jsonb_set(profile,'{policies}',coalesce(profile->'policies','[]')||jsonb_build_array(jsonb_build_object('id','1731000000000','title','Admission policy'))) where user_id=:'org';
select reserve_legacy_document_upload(:'org','policy:1731000000000',:'org'||'/policies/1731000000000/7a000000-0000-4000-8000-000000000014-policy.pdf',3,:'org');
insert into storage.objects(bucket_id,name,metadata) values('org-documents',:'org'||'/policies/1731000000000/7a000000-0000-4000-8000-000000000014-policy.pdf','{"size":3}');
update organizations set profile=jsonb_set(profile,'{policies}',jsonb_build_array(jsonb_build_object('id','1731000000000','title','Admission policy','document',jsonb_build_object('path',:'org'||'/policies/1731000000000/7a000000-0000-4000-8000-000000000014-policy.pdf','name','policy.pdf','size',3)))) where user_id=:'org';
insert into document_file_folder_authorities(file_id,project_id,folder_id) select id,:'project',:'folder' from organization_document_files where org_id=:'org' and document_kind='policy:1731000000000';
select pg_temp.check_admission((select count(*)=1 from document_file_folder_authorities),'numeric policy admission');
delete from document_file_folder_authorities;
savepoint policy_current;
update organizations set profile=jsonb_set(profile,'{policies}','[]') where user_id=:'org';
insert into document_file_folder_authorities(file_id,project_id,folder_id) select id,:'project',:'folder' from organization_document_files where org_id=:'org' and document_kind='policy:1731000000000';
select pg_temp.check_admission((select f.deleted_at is not null from document_file_folder_authorities a join organization_document_files f on f.id=a.file_id),'retired numeric policy identity admission');
rollback to policy_current;
alter table organizations disable trigger track_organization_policy_document_files;
update organizations set profile=jsonb_set(profile,'{policies}',(profile->'policies')||jsonb_build_array(jsonb_build_object('id','1731000000000','title','Conflicting no-attachment policy'))) where user_id=:'org';
alter table organizations enable trigger track_organization_policy_document_files;
select pg_temp.deny_admission(format('insert into document_file_folder_authorities(file_id,project_id,folder_id) select id,%L,%L from organization_document_files where org_id=%L and document_kind=''policy:1731000000000''',:'project',:'folder',:'org'),'23514');
rollback;
delete from organization_private_storage_cutovers where org_id=:'org';
insert into document_file_folder_authorities(file_id,project_id,folder_id) values(:'native_file',:'project',:'folder');
select pg_temp.check_admission((select count(*)=1 from document_file_folder_authorities),'native admission does not acquire legacy cutover dependency');
delete from document_file_folder_authorities where file_id=:'native_file';
select pg_temp.check_admission((select count(*)=0 from document_file_folder_authorities),'fixture leaves no bindings');
select pg_temp.check_admission((select count(*)=0 from organization_private_storage_cutovers),'fixture leaves activation off');
