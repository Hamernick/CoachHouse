-- Runs only in the disposable full-schema clone created by the paired runner.
do $$begin if current_database() not like 'ch_folder_purge_%' then raise exception 'Owned stage cleanup fixture required'; end if; end$$;
create function pg_temp.check_purge(ok boolean,message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'Assertion failed: %',message;end if;end $$;
create function pg_temp.deny_purge(command text,expected text default '42501') returns void language plpgsql as $$
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
insert into organization_projects(id,org_id,name,created_by,updated_by) values(:'project',:'org','Private purge fixture',:'org',:'org');
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
-- Saving/trash and permanent deletion share the current folder Edit boundary.
select set_config('request.headers',jsonb_build_object('x-coach-house-actor-id',:'org')::text,false);
select pg_temp.deny_purge(format('select reserve_document_file_purge(%L,%L,%L)',:'org',:'file',:'org'),'PT409');
update organization_document_files set deleted_at=now() where id=:'file';
select pg_temp.deny_purge(format('select reserve_document_file_purge(%L,%L,%L,false,true)',:'org',:'file',:'org'),'PT409');
select pg_temp.deny_purge(format('delete from storage.objects where name=%L',:'org'||'/library/'||:'file'||'-original.md'));
select pg_temp.deny_purge(format('delete from organization_document_files where id=%L',:'file'));
-- Parent editor and View are insufficient for trash/restore or reserve.
update project_asset_folder_grants set capability='view' where project_id=:'project';
select set_config('request.headers',jsonb_build_object('x-coach-house-actor-id',:'actor')::text,false);
select pg_temp.deny_purge(format('update organization_document_files set deleted_at=null where id=%L',:'file'));
select pg_temp.deny_purge(format('select reserve_document_file_purge(%L,%L,%L)',:'org',:'file',:'actor'));
update project_asset_folder_grants set capability='edit' where project_id=:'project';
-- Exact frozen set includes pending stages from other savers without cancelling them.
select pg_temp.check_purge(not (reserve_document_file_purge(:'org',:'file',:'actor')->>'complete')::boolean,'editor reserves');
select pg_temp.check_purge((select cardinality(paths)=13 and folder_id=:'folder' and folder_project_id=:'project' from document_file_purges where file_id=:'file'),'exact original plus six paired stages');
select pg_temp.check_purge((select bool_and(state='staged' and staged_bytes=6) from document_version_operations where file_id=:'file'),'reservation retains stage state and quota');
select pg_temp.check_purge(not (reserve_document_file_purge(:'org',:'file',:'actor')->>'complete')::boolean,'reservation retry');
select pg_temp.deny_purge(format('select finish_document_file_purge(%L,%L,%L)',:'org',:'file',:'actor'),'PT409');
select pg_temp.deny_purge(format('update organization_document_files set deleted_at=null where id=%L',:'file'),'PT409');
select pg_temp.deny_purge(format('update document_file_purges set paths=array[''forged''] where file_id=%L',:'file'));
select pg_temp.deny_purge(format('delete from document_file_purges where file_id=%L',:'file'));
select pg_temp.deny_purge('truncate document_file_purges');
select pg_temp.check_purge(not has_table_privilege('service_role','public.document_file_purges','insert') and not has_table_privilege('service_role','public.document_file_purges','update'),'no receipt forging');
select pg_temp.check_purge(not has_function_privilege('service_role','public.assert_document_folder_purge(uuid)','execute') and not has_function_privilege('authenticated','public.reserve_document_file_purge(uuid,uuid,uuid,boolean,boolean)','execute'),'private helpers and RPC ACL');
-- Old reservation never preserves revoked authority. Fresh headers, not payload.
delete from project_asset_folder_grants where project_id=:'project';
select pg_temp.deny_purge(format('select reserve_document_file_purge(%L,%L,%L)',:'org',:'file',:'actor'));
select pg_temp.deny_purge(format('select finish_document_file_purge(%L,%L,%L)',:'org',:'file',:'actor'));
select pg_temp.deny_purge(format('delete from storage.objects where name=%L',:'org'||'/library/'||:'file'||'-original.md'));
select pg_temp.deny_purge(format('select reserve_document_file_purge(%L,%L,%L)',:'org',:'file',:'org'));
select set_config('request.headers','{}',false);
select pg_temp.deny_purge(format('delete from storage.objects where name=%L',:'org'||'/library/'||:'file'||'-original.md'));
-- Owner always retains access and can resume exactly the frozen deletion.
select set_config('request.headers',jsonb_build_object('x-coach-house-actor-id',:'org')::text,false);
select pg_temp.check_purge(not (reserve_document_file_purge(:'org',:'file',:'org')->>'complete')::boolean,'owner resumes');
delete from storage.objects where name=:'org'||'/library/'||:'file'||'-original.md';
select pg_temp.deny_purge(format('select finish_document_file_purge(%L,%L,%L)',:'org',:'file',:'org'),'PT409');
select pg_temp.check_purge(exists(select 1 from organization_document_files where id=:'file') and (select sum(staged_bytes)=36 from document_version_operations where file_id=:'file'),'partial removal retains source and quota');
select pg_temp.deny_purge(format('insert into storage.objects(bucket_id,name) values(''org-documents'',%L)',:'org'||'/library/'||:'file'||'-original.md'));
delete from storage.objects where bucket_id='org-documents' and name in(select unnest(paths) from document_file_purges where file_id=:'file');
-- Even when bytes are absent, revoked caller cannot finalize.
select set_config('request.headers',jsonb_build_object('x-coach-house-actor-id',:'actor')::text,false);
select pg_temp.deny_purge(format('select finish_document_file_purge(%L,%L,%L)',:'org',:'file',:'actor'));
select set_config('request.headers',jsonb_build_object('x-coach-house-actor-id',:'org')::text,false);
select pg_temp.check_purge(finish_document_file_purge(:'org',:'file',:'org'),'owner finishes');
select pg_temp.check_purge(not exists(select 1 from organization_document_files where id=:'file') and not exists(select 1 from document_version_operations where file_id=:'file') and not exists(select 1 from document_file_folder_authorities where file_id=:'file'),'source, stages, authority retire only after absence');
select pg_temp.check_purge(finish_document_file_purge(:'org',:'file',:'org') and (reserve_document_file_purge(:'org',:'file',:'org')->>'complete')::boolean,'completed retry');
select set_config('request.headers',jsonb_build_object('x-coach-house-actor-id',:'actor')::text,false);
select pg_temp.deny_purge(format('select reserve_document_file_purge(%L,%L,%L)',:'org',:'file',:'actor'));
select pg_temp.deny_purge(format('select finish_document_file_purge(%L,%L,%L)',:'org',:'file',:'actor'));
select pg_temp.check_purge((select state='complete' and cardinality(paths)=13 from document_file_purges where file_id=:'file'),'tombstone and path suppression retained');
