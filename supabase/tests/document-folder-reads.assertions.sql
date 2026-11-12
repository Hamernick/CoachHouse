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
-- Actual library/room/version policies, with the actual folder grant authority.
insert into public.organization_document_files(id,org_id,storage_path,name,mime_type,size_bytes,created_by) values
('00000000-0000-4000-8000-000000000901','00000000-0000-4000-8000-000000000701','00000000-0000-4000-8000-000000000701/library/private.md','Private evidence.md','text/markdown',10,'00000000-0000-4000-8000-000000000701'),
('00000000-0000-4000-8000-000000000902','00000000-0000-4000-8000-000000000701','00000000-0000-4000-8000-000000000701/library/shared.md','Shared.md','text/markdown',20,'00000000-0000-4000-8000-000000000701');
insert into public.document_file_folder_authorities values('00000000-0000-4000-8000-000000000901','00000000-0000-4000-8000-000000000801','00000000-0000-4000-8000-000000000811');
insert into public.document_collaboration_rooms(id,org_id,file_id,base_revision,base_updated_at,checkpoint,created_by)
select '00000000-0000-4000-8000-000000000911',org_id,id,'r1',updated_at,decode('01','hex'),created_by from public.organization_document_files where id='00000000-0000-4000-8000-000000000901';
insert into public.document_file_versions(file_id,org_id,actor_id,storage_path,name,mime_type,size_bytes,content_hash,revision,source_updated_at,generation,sequence)
select id,org_id,created_by,org_id||'/library/versions/private.md',name,mime_type,size_bytes,repeat('a',64),'r1',updated_at,gen_random_uuid(),0 from public.organization_document_files where id='00000000-0000-4000-8000-000000000901';
select pg_temp.grant_assert(not has_table_privilege('service_role','public.document_file_folder_authorities','insert,update,delete'),'Unqualified application cannot enable source restrictions');
select pg_temp.grant_assert(not has_function_privilege('authenticated','public.filter_document_file_audience(uuid[],uuid)','execute'),'Browser cannot spoof source reader actor');
select pg_temp.grant_error($cmd$insert into public.document_file_folder_authorities values('00000000-0000-4000-8000-000000000902','00000000-0000-4000-8000-000000000502','00000000-0000-4000-8000-000000000511')$cmd$,'23514');
select pg_temp.grant_error($cmd$delete from public.project_asset_folders where project_id='00000000-0000-4000-8000-000000000801' and id='00000000-0000-4000-8000-000000000811'$cmd$,'23503');
-- A shared alias cannot change the canonical read authority.
insert into public.project_asset_folder_placements(project_id,file_key,folder_id)
values('00000000-0000-4000-8000-000000000802','organization:00000000-0000-4000-8000-000000000901','00000000-0000-4000-8000-000000000821');
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000704',false);
select pg_temp.grant_assert((select count(*)=0 from public.organization_document_files where id='00000000-0000-4000-8000-000000000901'),'Staff and platform admin cannot read restricted file, including through shared alias');
select pg_temp.grant_assert((select count(*)=0 from public.document_collaboration_rooms),'Private room hidden');
select pg_temp.grant_assert((select count(*)=0 from public.document_file_versions),'Private history hidden');
select pg_temp.grant_assert((select count(*)=1 from public.organization_document_files where id='00000000-0000-4000-8000-000000000902'),'Inherited file behavior unchanged');
select pg_temp.grant_assert((select count(*)=0 from public.organization_document_files where name ilike '%evidence%'),'Search cannot disclose private filename');
select pg_temp.grant_assert((select sum(size_bytes)=20 from public.organization_document_files),'Counts and sizes omit inaccessible files');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000701',false);
select pg_temp.grant_assert((select count(*)=2 from public.organization_document_files),'Owner retains files');
select pg_temp.grant_assert((select count(*)=1 from public.document_collaboration_rooms),'Owner retains room');
select pg_temp.grant_assert((select count(*)=1 from public.document_file_versions),'Owner retains history');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000705',false);
select pg_temp.grant_assert((select count(*)=0 from public.organization_document_files),'Foreign actor still denied by parent RLS');
reset role;
-- Grant and revoke while a reader holds the same file reference.
insert into public.project_asset_folder_grants(project_id,folder_id,member_id,membership_created_at,capability)
select '00000000-0000-4000-8000-000000000801','00000000-0000-4000-8000-000000000811',member_id,created_at,'view' from public.organization_memberships where org_id='00000000-0000-4000-8000-000000000701' and member_id='00000000-0000-4000-8000-000000000703';
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000703',false);
select pg_temp.grant_assert((select count(*)=2 from public.organization_document_files),'Explicit viewer sees file');
select pg_temp.grant_assert((select count(*)=1 from public.document_collaboration_rooms),'Explicit viewer sees room');
select pg_temp.grant_assert((select count(*)=1 from public.document_file_versions),'Explicit viewer sees history');
reset role;
delete from public.project_asset_folder_grants where member_id='00000000-0000-4000-8000-000000000703';
set role authenticated;
select pg_temp.grant_assert((select count(*)=1 from public.organization_document_files),'Revoked source hidden on next read');
select pg_temp.grant_assert((select count(*)=0 from public.document_file_versions),'Revoked history hidden on next read');
reset role;
set role service_role;
select pg_temp.grant_assert(filter_document_file_audience(array['00000000-0000-4000-8000-000000000901','00000000-0000-4000-8000-000000000902']::uuid[],'00000000-0000-4000-8000-000000000704')=array['00000000-0000-4000-8000-000000000902']::uuid[],'Elevated read filters actual actor');
select pg_temp.grant_assert(cardinality(filter_document_file_audience(array['00000000-0000-4000-8000-000000000901']::uuid[],'00000000-0000-4000-8000-000000000701'))=1,'Elevated owner retains source');
select pg_temp.grant_error($cmd$select filter_document_file_audience(array[]::uuid[],null)$cmd$,'22023');
reset role;
