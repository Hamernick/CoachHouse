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
-- Same canonical file and live folder authority as the read qualification.
-- User headers cannot replace an authenticated JWT subject.
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000704',false);
select set_config('request.headers','{"x-coach-house-actor-id":"00000000-0000-4000-8000-000000000701"}',false);
select pg_temp.grant_assert(not can_edit_uploaded_document('00000000-0000-4000-8000-000000000901'),'Admin without private grant cannot edit');
select pg_temp.grant_assert(can_edit_uploaded_document('00000000-0000-4000-8000-000000000902'),'Inherited edit authority preserved');
reset role;
insert into project_asset_folder_grants(project_id,folder_id,member_id,membership_created_at,capability)
select '00000000-0000-4000-8000-000000000801','00000000-0000-4000-8000-000000000811',member_id,created_at,'view'
from organization_memberships where member_id='00000000-0000-4000-8000-000000000704';
set role authenticated;
select pg_temp.grant_assert(not can_edit_uploaded_document('00000000-0000-4000-8000-000000000901'),'View is not Edit despite parent admin');
select pg_temp.grant_error($cmd$update organization_document_files set deleted_at=now() where id='00000000-0000-4000-8000-000000000901'$cmd$,'42501');
select pg_temp.grant_error($cmd$select append_document_room_update(id,generation,gen_random_uuid(),'Ag==') from document_collaboration_rooms where file_id='00000000-0000-4000-8000-000000000901'$cmd$,'42501');
reset role;
set role service_role;
select set_config('request.headers','{"x-coach-house-actor-id":"00000000-0000-4000-8000-000000000704"}',false);
select pg_temp.grant_error($cmd$update organization_document_files set name='Unauthorized.md' where id='00000000-0000-4000-8000-000000000901'$cmd$,'42501');
select pg_temp.grant_error($cmd$select initialize_document_room(id,'00000000-0000-4000-8000-000000000704','r1',updated_at,'AQ==') from organization_document_files where id='00000000-0000-4000-8000-000000000901'$cmd$,'42501');
select pg_temp.grant_error($cmd$select document_version_actor_can_edit('00000000-0000-4000-8000-000000000901','00000000-0000-4000-8000-000000000701')$cmd$,'42501');
select pg_temp.grant_error($cmd$select compact_document_room(id,generation,last_sequence,'Ag==') from document_collaboration_rooms where file_id='00000000-0000-4000-8000-000000000901'$cmd$,'42501');
select pg_temp.grant_assert(not has_function_privilege('service_role','public.initialize_document_room_before_folder(uuid,uuid,text,timestamptz,text)','execute'),'No old initialization bypass');
select pg_temp.grant_assert(not has_function_privilege('service_role','public.document_version_actor_can_edit_before_folder(uuid,uuid)','execute'),'No old version authority bypass');
reset role;
update project_asset_folder_grants set capability='edit' where member_id='00000000-0000-4000-8000-000000000704';
set role authenticated;
select pg_temp.grant_assert(can_edit_uploaded_document('00000000-0000-4000-8000-000000000901'),'Explicit editor can edit');
select append_document_room_update(id,generation,'00000000-0000-4000-8000-000000000921','Ag==') from document_collaboration_rooms where file_id='00000000-0000-4000-8000-000000000901';
update organization_document_files set deleted_at=now() where id='00000000-0000-4000-8000-000000000901';
update organization_document_files set deleted_at=null where id='00000000-0000-4000-8000-000000000901';
reset role;
-- Trash/restore advances file timestamps. Rebase this fixture before Save.
set role service_role;
update document_collaboration_rooms set base_updated_at=(select updated_at from organization_document_files where id=file_id);
select compact_document_room(id,generation,last_sequence,'Ag==') from document_collaboration_rooms where file_id='00000000-0000-4000-8000-000000000901';
select pg_temp.grant_assert((select checkpoint_sequence=1 from document_collaboration_rooms where file_id='00000000-0000-4000-8000-000000000901'),'Authorized compaction retained working update');
-- Existing reserve/commit owner, actual staged metadata and actual history.
select reserve_uploaded_document_version(file_id,'00000000-0000-4000-8000-000000000704','00000000-0000-4000-8000-000000000931',generation,base_revision,base_updated_at,last_sequence,repeat('a',64),repeat('b',64),2)
from document_collaboration_rooms where file_id='00000000-0000-4000-8000-000000000901';
reset role;
insert into storage.objects(bucket_id,name,metadata) values
('org-documents','00000000-0000-4000-8000-000000000701/library/versions/00000000-0000-4000-8000-000000000901/00000000-0000-4000-8000-000000000931.md','{"size":2}'),
('org-documents','00000000-0000-4000-8000-000000000701/library/versions/00000000-0000-4000-8000-000000000901/00000000-0000-4000-8000-000000000931-previous.md','{"size":10}');
set role service_role;
select commit_uploaded_document_version(file_id,'00000000-0000-4000-8000-000000000704','00000000-0000-4000-8000-000000000931',generation,base_revision,base_updated_at,last_sequence,repeat('a',64),repeat('b',64),2)
from document_collaboration_rooms where file_id='00000000-0000-4000-8000-000000000901';
select pg_temp.grant_assert((select size_bytes=2 and storage_path like '%931.md' from organization_document_files where id='00000000-0000-4000-8000-000000000901'),'Save updated canonical source');
select reserve_uploaded_document_version(file_id,'00000000-0000-4000-8000-000000000704','00000000-0000-4000-8000-000000000932',generation,base_revision,base_updated_at,last_sequence,repeat('b',64),repeat('c',64),3)
from document_collaboration_rooms where file_id='00000000-0000-4000-8000-000000000901';
reset role;
delete from project_asset_folder_grants where member_id='00000000-0000-4000-8000-000000000704';
set role service_role;
select pg_temp.grant_error($cmd$select commit_uploaded_document_version(file_id,'00000000-0000-4000-8000-000000000704','00000000-0000-4000-8000-000000000932',generation,base_revision,base_updated_at,last_sequence,repeat('b',64),repeat('c',64),3) from document_collaboration_rooms where file_id='00000000-0000-4000-8000-000000000901'$cmd$,'42501');
select pg_temp.grant_error($cmd$select reserve_uploaded_document_version(file_id,'00000000-0000-4000-8000-000000000704','00000000-0000-4000-8000-000000000932',generation,base_revision,base_updated_at,last_sequence,repeat('b',64),repeat('c',64),3) from document_collaboration_rooms where file_id='00000000-0000-4000-8000-000000000901'$cmd$,'42501');
select pg_temp.grant_assert((select size_bytes=2 from organization_document_files where id='00000000-0000-4000-8000-000000000901'),'Revoked stage did not change saved source');
select set_config('request.headers','{}',false);
select pg_temp.grant_error($cmd$update organization_document_files set name='No actor.md' where id='00000000-0000-4000-8000-000000000901'$cmd$,'42501');
select set_config('request.headers','{"x-coach-house-actor-id":"00000000-0000-4000-8000-000000000701"}',false);
select pg_temp.grant_assert(document_version_actor_can_edit('00000000-0000-4000-8000-000000000901','00000000-0000-4000-8000-000000000701'),'Owner retains edit access');
-- Owner can restore the actual saved version through the existing Save owner.
select reserve_uploaded_document_version(r.file_id,'00000000-0000-4000-8000-000000000701','00000000-0000-4000-8000-000000000933',r.generation,r.base_revision,r.base_updated_at,r.last_sequence,repeat('b',64),v.content_hash,v.size_bytes,v.id)
from document_collaboration_rooms r join document_file_versions v on v.file_id=r.file_id and v.request_id='00000000-0000-4000-8000-000000000931';
reset role;
insert into storage.objects(bucket_id,name,metadata) values('org-documents','00000000-0000-4000-8000-000000000701/library/versions/00000000-0000-4000-8000-000000000901/00000000-0000-4000-8000-000000000933.md','{"size":2}');
set role service_role;
select commit_uploaded_document_version(r.file_id,'00000000-0000-4000-8000-000000000701','00000000-0000-4000-8000-000000000933',r.generation,r.base_revision,r.base_updated_at,r.last_sequence,repeat('b',64),v.content_hash,v.size_bytes,v.id,'AQ==')
from document_collaboration_rooms r join document_file_versions v on v.file_id=r.file_id and v.request_id='00000000-0000-4000-8000-000000000931';
select pg_temp.grant_assert((select restored_from is not null from document_file_versions where request_id='00000000-0000-4000-8000-000000000933'),'Restoration retained provenance');
select pg_temp.grant_assert((select last_sequence=0 from document_collaboration_rooms where file_id='00000000-0000-4000-8000-000000000901'),'Restoration opened a new generation');
select pg_temp.grant_error($cmd$update document_collaboration_rooms set file_id='00000000-0000-4000-8000-000000000902' where file_id='00000000-0000-4000-8000-000000000901'$cmd$,'42501');
select pg_temp.grant_error($cmd$delete from organization_document_files where id='00000000-0000-4000-8000-000000000901'$cmd$,'42501');
reset role;
