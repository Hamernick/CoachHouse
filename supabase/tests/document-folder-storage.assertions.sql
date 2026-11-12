create function pg_temp.grant_assert(value boolean,message text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception '%',message; end if; end;
$$;
create function pg_temp.grant_error(command text,expected text) returns void language plpgsql as $$
begin
  begin execute command;
  exception when others then
    if sqlstate=expected then return; end if;
    raise exception 'Expected %, got %: %',expected,sqlstate,sqlerrm;
  end;
  raise exception 'Expected failure %, command succeeded',expected;
end;
$$;
-- Storage metadata admission proof. Actual provider bytes are tested separately.
-- The broader harness intentionally excludes cleanup migrations; provide their
-- provenance column without pretending to qualify those cleanup owners.
alter table document_version_operations add column source_storage_path text;
grant usage on schema storage to authenticated,service_role;
grant select,insert,update,delete on storage.objects to authenticated,service_role;
create policy fixture_storage_mutation on storage.objects for all to authenticated using(true) with check(true);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000701',false);
update document_version_operations set source_storage_path='00000000-0000-4000-8000-000000000701/library/original.md' where file_id='00000000-0000-4000-8000-000000000901';
insert into organization_memberships(org_id,member_id,role) values('00000000-0000-4000-8000-000000000701','00000000-0000-4000-8000-000000000704','admin');
insert into project_asset_folder_grants(project_id,folder_id,member_id,membership_created_at,capability)
select '00000000-0000-4000-8000-000000000801','00000000-0000-4000-8000-000000000811',member_id,created_at,'edit'
from organization_memberships where member_id='00000000-0000-4000-8000-000000000704';
set role service_role;
select set_config('request.headers','{"x-coach-house-actor-id":"00000000-0000-4000-8000-000000000704"}',false);
update document_collaboration_rooms set base_updated_at=(select updated_at from organization_document_files where id=file_id);
select reserve_uploaded_document_version(file_id,'00000000-0000-4000-8000-000000000704','00000000-0000-4000-8000-000000000941',generation,base_revision,base_updated_at,last_sequence,repeat('b',64),repeat('c',64),3)
from document_collaboration_rooms where file_id='00000000-0000-4000-8000-000000000901';
reset role;
\ir supabase/migrations/20261106060000_document_file_folder_storage.sql
create function pg_temp.storage_write(actor uuid, suffix text) returns void language plpgsql as $$
begin
 perform set_config('request.headers',jsonb_build_object('x-coach-house-actor-id',actor)::text,true);
 insert into storage.objects(bucket_id,name,metadata) values('org-documents',
 '00000000-0000-4000-8000-000000000701/library/versions/00000000-0000-4000-8000-000000000901/'||suffix,'{"size":3}');
end;
$$;
set role service_role;
select pg_temp.storage_write('00000000-0000-4000-8000-000000000704','00000000-0000-4000-8000-000000000941.md');
select pg_temp.grant_error($cmd$select pg_temp.storage_write('00000000-0000-4000-8000-000000000701','00000000-0000-4000-8000-000000000941-previous.md')$cmd$,'42501');
select pg_temp.grant_error($cmd$select pg_temp.storage_write('00000000-0000-4000-8000-000000000704','00000000-0000-4000-8000-000000000949.md')$cmd$,'42501');
select pg_temp.grant_error($cmd$select pg_temp.storage_write(null,'00000000-0000-4000-8000-000000000941-previous.md')$cmd$,'42501');
select pg_temp.grant_error($cmd$update storage.objects set metadata='{"size":99}' where name like '%933.md'$cmd$,'42501');
select pg_temp.grant_error($cmd$update storage.objects set metadata='{"size":99}' where name like '%931-previous.md'$cmd$,'42501');
select pg_temp.grant_error($cmd$insert into storage.objects(bucket_id,name) values('org-documents','00000000-0000-4000-8000-000000000701/library/original.md')$cmd$,'42501');
select pg_temp.grant_error($cmd$update storage.objects set name='00000000-0000-4000-8000-000000000701/library/escaped.md' where name like '%941.md'$cmd$,'42501');
select pg_temp.grant_error($cmd$update storage.objects set bucket_id='other' where name like '%941.md'$cmd$,'42501');
select pg_temp.grant_error($cmd$delete from storage.objects where name like '%941.md'$cmd$,'42501');
reset role;
update project_asset_folder_grants set capability='view' where member_id='00000000-0000-4000-8000-000000000704';
set role service_role;
select pg_temp.grant_error($cmd$select pg_temp.storage_write('00000000-0000-4000-8000-000000000704','00000000-0000-4000-8000-000000000941-previous.md')$cmd$,'42501');
reset role;
delete from project_asset_folder_grants where member_id='00000000-0000-4000-8000-000000000704';
set role service_role;
select pg_temp.grant_error($cmd$select pg_temp.storage_write('00000000-0000-4000-8000-000000000704','00000000-0000-4000-8000-000000000941-previous.md')$cmd$,'42501');
select set_config('request.headers','{"x-coach-house-actor-id":"00000000-0000-4000-8000-000000000701"}',false);
select reserve_uploaded_document_version(file_id,'00000000-0000-4000-8000-000000000701','00000000-0000-4000-8000-000000000942',generation,base_revision,base_updated_at,last_sequence,repeat('b',64),repeat('d',64),3)
from document_collaboration_rooms where file_id='00000000-0000-4000-8000-000000000901';
select pg_temp.storage_write('00000000-0000-4000-8000-000000000701','00000000-0000-4000-8000-000000000942.md');
select abandon_uploaded_document_version('00000000-0000-4000-8000-000000000901','00000000-0000-4000-8000-000000000701','00000000-0000-4000-8000-000000000942');
select pg_temp.grant_error($cmd$select pg_temp.storage_write('00000000-0000-4000-8000-000000000701','00000000-0000-4000-8000-000000000942-previous.md')$cmd$,'42501');
-- Unbound sources and unrelated buckets keep their existing behavior.
select set_config('request.headers','{}',false);
insert into storage.objects(bucket_id,name) values('other','unrelated'),('org-documents','00000000-0000-4000-8000-000000000701/library/unbound.md');
update storage.objects set metadata='{}' where name='unrelated';
delete from storage.objects where name='unrelated' or name like '%/unbound.md';
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000704',false);
select pg_temp.grant_error($cmd$select pg_temp.storage_write('00000000-0000-4000-8000-000000000701','00000000-0000-4000-8000-000000000941-previous.md')$cmd$,'42501');
reset role;
