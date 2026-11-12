-- Runs only in the disposable full-schema clone created by the paired runner.
do $$begin if current_database() not like 'ch_stage_cleanup_%' then raise exception 'Owned stage cleanup fixture required'; end if; end$$;
create function pg_temp.check_stage(ok boolean,message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'Assertion failed: %',message;end if;end $$;
create function pg_temp.deny_stage(command text,expected text default '42501') returns void language plpgsql as $$
begin begin execute command;exception when others then if sqlstate=expected then return;end if;raise exception 'Expected %, got %: %',expected,sqlstate,sqlerrm;end;raise exception 'Unexpected success: %',command;end $$;
set request.jwt.claim.role='service_role';
set storage.allow_delete_query='true';
\set org 'e972bc07-fbf5-4fc8-a416-7f00910a71e2'
\set actor '90b6c688-889c-467f-9edd-166f28bf0819'
\set project '71000000-0000-4000-8000-000000000001'
\set folder '71000000-0000-4000-8000-000000000002'
\set file '71000000-0000-4000-8000-000000000003'
select set_config('request.headers',jsonb_build_object('x-coach-house-actor-id',:'org')::text,false);
insert into organization_memberships(org_id,member_id,role,member_email) select :'org',:'actor','staff',email from auth.users where id=:'actor';
insert into organization_projects(id,org_id,name,created_by,updated_by) values(:'project',:'org','Stage cleanup fixture',:'org',:'org');
insert into project_asset_folder_libraries(project_id) values(:'project');
insert into project_asset_folders(project_id,id,name,position,audience,created_by) values(:'project',:'folder','Restricted',0,'restricted',:'org');
insert into project_asset_folder_grants(project_id,folder_id,member_id,membership_created_at,capability) select :'project',:'folder',member_id,created_at,'edit' from organization_memberships where org_id=:'org' and member_id=:'actor';
insert into organization_document_files(id,org_id,name,mime_type,size_bytes,storage_path,created_by) values(:'file',:'org','cleanup.md','text/markdown',3,:'org'||'/library/'||:'file'||'-original.md',:'org');
insert into storage.objects(bucket_id,name,metadata) values('org-documents',:'org'||'/library/'||:'file'||'-original.md','{"size":3}');
insert into document_file_folder_authorities(file_id,project_id,folder_id) values(:'file',:'project',:'folder');
select set_config('request.headers',jsonb_build_object('x-coach-house-actor-id',:'actor')::text,false);
insert into document_version_operations(file_id,request_id,org_id,actor_id,fingerprint,staged_bytes)
select :'file',('71000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,:'org',:'actor','fixture',6 from generate_series(10,15)n;
insert into storage.objects(bucket_id,name,metadata) select 'org-documents',:'org'||'/library/versions/'||:'file'||'/'||request_id::text||suffix,'{"size":3}' from document_version_operations cross join unnest(array['.md','-previous.md'])suffix where file_id=:'file';
-- Missing actor, forged payload, and even owner cannot cancel someone else's active save.
select set_config('request.headers','{}',false);
select pg_temp.deny_stage(format('select abandon_uploaded_document_version(%L,%L,%L)',:'file',:'actor','71000000-0000-4000-8000-000000000010'));
select set_config('request.headers',jsonb_build_object('x-coach-house-actor-id',:'org')::text,false);
select pg_temp.deny_stage(format('select abandon_uploaded_document_version(%L,%L,%L)',:'file',:'actor','71000000-0000-4000-8000-000000000010'));
select pg_temp.deny_stage(format('delete from storage.objects where name=%L',:'org'||'/library/versions/'||:'file'||'/71000000-0000-4000-8000-000000000010.md'));
delete from project_asset_folder_grants where project_id=:'project' and member_id=:'actor';
select set_config('request.headers',jsonb_build_object('x-coach-house-actor-id',:'actor')::text,false);
select pg_temp.check_stage(abandon_uploaded_document_version(:'file',:'actor','71000000-0000-4000-8000-000000000010'),'revoked saver can abandon own stage');
select pg_temp.check_stage(abandon_uploaded_document_version(:'file',:'actor','71000000-0000-4000-8000-000000000010'),'abandon retry');
select pg_temp.check_stage(not finish_abandoned_document_version(:'file',:'actor','71000000-0000-4000-8000-000000000010'),'existing bytes retain capacity');
select pg_temp.deny_stage(format('update document_version_operations set state=''cleaned'',staged_bytes=0 where file_id=%L and request_id=%L',:'file','71000000-0000-4000-8000-000000000010'),'PT409');
select pg_temp.deny_stage(format('update document_version_operations set state=''abandoned'',fingerprint=''changed'' where file_id=%L and request_id=%L',:'file','71000000-0000-4000-8000-000000000011'));
select pg_temp.deny_stage(format('update organization_document_files set name=''denied.md'' where id=%L',:'file'));
delete from storage.objects where name=:'org'||'/library/versions/'||:'file'||'/71000000-0000-4000-8000-000000000010.md';
select pg_temp.check_stage(not finish_abandoned_document_version(:'file',:'actor','71000000-0000-4000-8000-000000000010'),'partial cleanup retains capacity');
select pg_temp.check_stage((select staged_bytes=6 from document_version_operations where file_id=:'file' and request_id='71000000-0000-4000-8000-000000000010'),'quota unchanged');
delete from storage.objects where name=:'org'||'/library/versions/'||:'file'||'/71000000-0000-4000-8000-000000000010-previous.md';
select pg_temp.check_stage(finish_abandoned_document_version(:'file',:'actor','71000000-0000-4000-8000-000000000010'),'fully absent operation finishes');
select pg_temp.check_stage(finish_abandoned_document_version(:'file',:'actor','71000000-0000-4000-8000-000000000010'),'finish replay');
select pg_temp.check_stage((select state='cleaned' and staged_bytes=0 from document_version_operations where file_id=:'file' and request_id='71000000-0000-4000-8000-000000000010'),'quota released only at completion');
select pg_temp.deny_stage(format('insert into storage.objects(bucket_id,name) values(''org-documents'',%L)',:'org'||'/library/versions/'||:'file'||'/71000000-0000-4000-8000-000000000010.md'));
-- Full membership removal still permits exact self cancellation, not reading/editing.
delete from organization_memberships where org_id=:'org' and member_id=:'actor';
select pg_temp.check_stage(abandon_uploaded_document_version(:'file',:'actor','71000000-0000-4000-8000-000000000011'),'removed saver cancellation');
select pg_temp.check_stage(not document_file_folder_actor_can(:'file',:'actor','view'),'cancellation restores no read');
-- Owner can clean abandoned work with original operation actor in payload.
select set_config('request.headers',jsonb_build_object('x-coach-house-actor-id',:'org')::text,false);
select pg_temp.check_stage(jsonb_array_length(read_abandoned_document_stages(:'org',:'org'))=1,'owner sees abandoned only');
delete from storage.objects where bucket_id='org-documents' and name in(:'org'||'/library/versions/'||:'file'||'/71000000-0000-4000-8000-000000000011.md',:'org'||'/library/versions/'||:'file'||'/71000000-0000-4000-8000-000000000011-previous.md');
select pg_temp.check_stage(finish_abandoned_document_version(:'file',:'actor','71000000-0000-4000-8000-000000000011'),'owner delegates cleanup without impersonating actor');
select pg_temp.deny_stage(format('update document_version_operations set state=''staged'',staged_bytes=6 where file_id=%L and request_id=%L',:'file','71000000-0000-4000-8000-000000000011'));
select pg_temp.deny_stage(format('delete from storage.objects where name=%L',:'org'||'/library/'||:'file'||'-original.md'));
select pg_temp.deny_stage(format('delete from organization_document_files where id=%L',:'file'));
-- A parent editor without folder access sees no other actor's private stages.
insert into organization_memberships(org_id,member_id,role,member_email) select :'org',:'actor','staff',email from auth.users where id=:'actor';
insert into document_version_operations(file_id,request_id,org_id,actor_id,fingerprint,staged_bytes) values(:'file','71000000-0000-4000-8000-000000000020',:'org',:'org','owner-stage',3);
insert into storage.objects(bucket_id,name,metadata) values('org-documents',:'org'||'/library/versions/'||:'file'||'/71000000-0000-4000-8000-000000000020.md','{"size":3}');
select abandon_uploaded_document_version(:'file',:'org','71000000-0000-4000-8000-000000000020');
select set_config('request.headers',jsonb_build_object('x-coach-house-actor-id',:'actor')::text,false);
select pg_temp.check_stage(jsonb_array_length(read_abandoned_document_stages(:'org',:'actor'))=0,'private stages filtered before bound batch');
select pg_temp.deny_stage(format('select finish_abandoned_document_version(%L,%L,%L)',:'file',:'org','71000000-0000-4000-8000-000000000020'));
select pg_temp.deny_stage(format('delete from storage.objects where name=%L',:'org'||'/library/versions/'||:'file'||'/71000000-0000-4000-8000-000000000020.md'));
-- Reject an empty-stage finish without a verified header too.
select set_config('request.headers','{}',false);
select pg_temp.deny_stage(format('select finish_abandoned_document_version(%L,%L,%L)',:'file',:'actor','71000000-0000-4000-8000-000000000010'));
select pg_temp.check_stage(not has_function_privilege('authenticated','public.abandon_uploaded_document_version(uuid,uuid,uuid)','execute') and not has_function_privilege('authenticated','public.finish_abandoned_document_version(uuid,uuid,uuid)','execute') and not has_function_privilege('service_role','public.document_folder_stage_cleanup_paths(uuid,uuid,boolean)','execute'),'no client/internal privilege expansion');
-- Existing references are preserved even if they point at an abandoned path.
select set_config('request.headers',jsonb_build_object('x-coach-house-actor-id',:'org')::text,false);
insert into organization_document_files(id,org_id,name,mime_type,size_bytes,storage_path,created_by) values('71000000-0000-4000-8000-000000000004',:'org','alias.md','text/markdown',3,:'org'||'/library/versions/'||:'file'||'/71000000-0000-4000-8000-000000000020.md',:'org');
select pg_temp.deny_stage(format('delete from storage.objects where name=%L',:'org'||'/library/versions/'||:'file'||'/71000000-0000-4000-8000-000000000020.md'));
select pg_temp.check_stage((select count(*)=1 from storage.objects where name=:'org'||'/library/'||:'file'||'-original.md'),'canonical bytes retained');
