create function pg_temp.check_purge(ok boolean,message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'Assertion failed: %',message;end if;end $$;
create function pg_temp.deny_purge(command text,expected text default '42501') returns void language plpgsql as $$
begin begin execute command;exception when others then if sqlstate=expected then return;end if;raise exception 'Expected %, got %: %',expected,sqlstate,sqlerrm;end;raise exception 'Unexpected success: %',command;end $$;
do $$begin if current_database() not like 'ch_folder_disclosures_%' then raise exception 'Owned disclosure fixture required';end if;end$$;
\set org 'e972bc07-fbf5-4fc8-a416-7f00910a71e2'
\set actor '90b6c688-889c-467f-9edd-166f28bf0819'
\set project '71000000-0000-4000-8000-000000000001'
\set folder '71000000-0000-4000-8000-000000000002'
\set file '74000000-0000-4000-8000-000000000001'
set request.jwt.claim.role='service_role';
select set_config('request.headers',jsonb_build_object('x-coach-house-actor-id',:'org')::text,false);
insert into organization_document_files(id,org_id,name,mime_type,size_bytes,storage_path,created_by) values(:'file',:'org','Private disclosed title.md','text/markdown',3,:'org'||'/library/'||:'file'||'-original.md',:'org');
insert into document_file_folder_authorities(file_id,project_id,folder_id) values(:'file',:'project',:'folder');
select pg_temp.check_purge(exists(select 1 from organization_project_activity_events where entity_id=:'file'),'file activity exists');
select pg_temp.check_purge(document_file_disclosure_actor_can(:'file',:'org') and not document_file_disclosure_actor_can(:'file',:'actor'),'owner retained; ungranted actor denied');
-- The full-schema fixture omits the hosted authenticated SELECT grant.
-- Restore that grant only inside this disposable clone; policies stay intact.
grant select on public.organization_project_activity_events,public.organization_memberships to authenticated;
-- Actual RLS, not just the elevated filter.
select set_config('request.jwt.claim.sub',:'actor',false);
set request.jwt.claim.role='authenticated';set role authenticated;
select count(*)=0 as denied from organization_project_activity_events where entity_id=:'file' \gset
reset role;select pg_temp.check_purge(:'denied'::boolean,'native activity RLS denies');
set request.jwt.claim.role='service_role';
insert into project_asset_folder_grants(project_id,folder_id,member_id,membership_created_at,capability) select :'project',:'folder',member_id,created_at,'view' from organization_memberships where org_id=:'org' and member_id=:'actor';
set request.jwt.claim.role='authenticated';set role authenticated;
select count(*)>0 as allowed from organization_project_activity_events where entity_id=:'file' \gset
reset role;select pg_temp.check_purge(:'allowed'::boolean,'explicit View reveals activity');
set request.jwt.claim.role='service_role';
select set_config('request.headers',jsonb_build_object('x-coach-house-actor-id',:'actor')::text,false);
select pg_temp.check_purge(cardinality(filter_document_activity_audience(array(select id from organization_project_activity_events where entity_id=:'file'),:'actor'))>0,'elevated View allowed');
select pg_temp.deny_purge(format('select filter_document_activity_audience(array[]::uuid[],%L)',:'org'));
select set_config('request.headers','{}',false);
select pg_temp.deny_purge(format('select filter_document_activity_audience(array[]::uuid[],%L)',:'actor'));
select set_config('request.headers',jsonb_build_object('x-coach-house-actor-id',:'org')::text,false);
update organization_document_files set deleted_at=now() where id=:'file';
select reserve_document_file_purge(:'org',:'file',:'org');
select finish_document_file_purge(:'org',:'file',:'org');
select pg_temp.check_purge(not exists(select 1 from document_file_folder_authorities where file_id=:'file') and document_file_disclosure_actor_can(:'file',:'actor'),'completed purge retains View scope');
delete from project_asset_folder_grants where project_id=:'project';
select pg_temp.check_purge(not document_file_disclosure_actor_can(:'file',:'actor'),'revoked View cannot read retained activity');
select set_config('request.headers',jsonb_build_object('x-coach-house-actor-id',:'actor')::text,false);
select pg_temp.check_purge(cardinality(filter_document_activity_audience(array(select id from organization_project_activity_events where entity_id=:'file'),:'actor'))=0,'elevated filter rejects retained private titles');
select set_config('request.headers',jsonb_build_object('x-coach-house-actor-id',:'org')::text,false);
select pg_temp.check_purge(cardinality(filter_document_activity_audience(array(select id from organization_project_activity_events where entity_id=:'file'),:'org'))>0,'owner retains audit after purge');
delete from organization_memberships where org_id=:'org' and member_id=:'actor';
insert into organization_memberships(org_id,member_id,role,member_email) select :'org',:'actor','staff',email from auth.users where id=:'actor';
select pg_temp.check_purge(not document_file_disclosure_actor_can(:'file',:'actor'),'rejoin restores no historical access');
delete from organization_projects where id=:'project';
select pg_temp.check_purge(document_file_disclosure_actor_can(:'file',:'org') and not document_file_disclosure_actor_can(:'file',:'actor'),'owner retains history after folder retirement');
select pg_temp.check_purge(not has_function_privilege('authenticated','public.filter_document_activity_audience(uuid[],uuid)','execute') and not has_function_privilege('service_role','public.document_file_disclosure_actor_can(uuid,uuid)','execute'),'internal ACL retained');
