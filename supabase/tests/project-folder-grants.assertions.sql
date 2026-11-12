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
insert into profiles(id,role) select ('00000000-0000-4000-8000-000000000'||n)::uuid,case when n=704 then 'admin' else 'member' end from generate_series(701,706) n;
insert into organizations(user_id) values('00000000-0000-4000-8000-000000000701');
insert into organization_memberships(org_id,member_id,role) select '00000000-0000-4000-8000-000000000701',('00000000-0000-4000-8000-000000000'||n)::uuid,
 case when n=703 then 'board' when n=704 then 'admin' else 'staff' end from unnest(array[702,703,704,706]) n;
insert into organization_projects(id,org_id,name,created_by,updated_by,status,start_date,end_date,recurrence,recurrence_anchor_start,recurrence_anchor_end)
values('00000000-0000-4000-8000-000000000801','00000000-0000-4000-8000-000000000701','Folder grants qualification','00000000-0000-4000-8000-000000000701','00000000-0000-4000-8000-000000000701','active','2027-01-01','2027-01-31','monthly','2027-01-01','2027-01-31');
select mutate_project_asset_folder(id,org_id,'00000000-0000-4000-8000-000000000702',updated_at,'{"type":"create","name":"Private planning"}','00000000-0000-4000-8000-000000000811') from organization_projects where id='00000000-0000-4000-8000-000000000801';
select mutate_project_asset_folder(id,org_id,org_id,updated_at,'{"type":"create","name":"Shared"}','00000000-0000-4000-8000-000000000812') from organization_projects where id='00000000-0000-4000-8000-000000000801';
select pg_temp.grant_assert((select created_by='00000000-0000-4000-8000-000000000702' from project_asset_folders where id='00000000-0000-4000-8000-000000000811'),'New creator comes from verified actor');
select set_project_asset_folder_access('00000000-0000-4000-8000-000000000801','00000000-0000-4000-8000-000000000811','00000000-0000-4000-8000-000000000701',0,'restricted',
 '[{"memberId":"00000000-0000-4000-8000-000000000703","capability":"view"},{"memberId":"00000000-0000-4000-8000-000000000706","capability":"edit"}]');
select pg_temp.grant_assert(project_folder_actor_can('00000000-0000-4000-8000-000000000801','00000000-0000-4000-8000-000000000811','00000000-0000-4000-8000-000000000701','manage'),'Owner retains implicit management');
select pg_temp.grant_assert(project_folder_actor_can('00000000-0000-4000-8000-000000000801','00000000-0000-4000-8000-000000000811','00000000-0000-4000-8000-000000000702','manage'),'Current creator retains access');
select pg_temp.grant_assert(not project_folder_actor_can('00000000-0000-4000-8000-000000000801','00000000-0000-4000-8000-000000000811','00000000-0000-4000-8000-000000000701',null),'Invalid capability denied');
select pg_temp.grant_assert(project_folder_actor_can('00000000-0000-4000-8000-000000000801','00000000-0000-4000-8000-000000000811','00000000-0000-4000-8000-000000000706','edit') and not project_folder_actor_can('00000000-0000-4000-8000-000000000801','00000000-0000-4000-8000-000000000811','00000000-0000-4000-8000-000000000706','manage'),'Edit does not imply manage');
select pg_temp.grant_assert(jsonb_array_length(read_project_asset_folders_for_actor('00000000-0000-4000-8000-000000000801','00000000-0000-4000-8000-000000000704')->'folders')=1,'Elevated server read cannot implicitly expose private folders to staff');
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000704',false);
select pg_temp.grant_assert((select count(*)=1 from project_asset_folders where project_id='00000000-0000-4000-8000-000000000801'),'Organization/platform admin gets no implicit private access');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000703',false);
select pg_temp.grant_assert(jsonb_array_length(read_project_asset_folders('00000000-0000-4000-8000-000000000801')->'folders')=2,'Explicit viewer sees private folder');
select pg_temp.grant_assert(not has_function_privilege('authenticated','public.set_project_asset_folder_access(uuid,uuid,uuid,bigint,text,jsonb)','execute'),'Client cannot spoof grant actor');
select pg_temp.grant_assert(not has_function_privilege('authenticated','public.read_project_asset_folders_for_actor(uuid,uuid)','execute'),'Client cannot spoof filtered reader actor');
select pg_temp.grant_assert(not has_function_privilege('service_role','public.mutate_project_asset_folder_unscoped(uuid,uuid,uuid,timestamptz,jsonb,uuid)','execute'),'Old writer is not a callable bypass');
select pg_temp.grant_assert(not has_table_privilege('authenticated','public.project_asset_folder_grants','select,insert,update,delete'),'Grant rows are not client-readable or writable');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000705',false);
select pg_temp.grant_assert((select count(*)=0 from project_asset_folders where project_id='00000000-0000-4000-8000-000000000801'),'Foreign actor still fails parent RLS');
reset role;
-- Failed grant replacements must retain the old audience, grants and revision.
select pg_temp.grant_error($cmd$select set_project_asset_folder_access('00000000-0000-4000-8000-000000000801','00000000-0000-4000-8000-000000000811','00000000-0000-4000-8000-000000000703',1,'inherited','[]')$cmd$,'42501');
select pg_temp.grant_error($cmd$select set_project_asset_folder_access('00000000-0000-4000-8000-000000000801','00000000-0000-4000-8000-000000000811','00000000-0000-4000-8000-000000000704',1,'inherited','[]')$cmd$,'42501');
select pg_temp.grant_error($cmd$select set_project_asset_folder_access('00000000-0000-4000-8000-000000000801','00000000-0000-4000-8000-000000000811','00000000-0000-4000-8000-000000000701',0,'inherited','[]')$cmd$,'40001');
select pg_temp.grant_error($cmd$select set_project_asset_folder_access('00000000-0000-4000-8000-000000000801','00000000-0000-4000-8000-000000000811','00000000-0000-4000-8000-000000000701',1,'restricted','[{"memberId":"00000000-0000-4000-8000-000000000705","capability":"view"}]')$cmd$,'42501');
select pg_temp.grant_error($cmd$select set_project_asset_folder_access('00000000-0000-4000-8000-000000000801','00000000-0000-4000-8000-000000000811','00000000-0000-4000-8000-000000000701',1,'restricted','[{"memberId":"00000000-0000-4000-8000-000000000703","capability":"view"},{"memberId":"00000000-0000-4000-8000-000000000703","capability":"manage"}]')$cmd$,'23505');
select pg_temp.grant_assert((select access_revision=1 and audience='restricted' from project_asset_folders where id='00000000-0000-4000-8000-000000000811') and (select count(*)=2 from project_asset_folder_grants),'Rejected commands roll back grants and revision');
delete from organization_memberships where member_id in ('00000000-0000-4000-8000-000000000702','00000000-0000-4000-8000-000000000703');
select pg_temp.grant_assert(not project_folder_actor_can('00000000-0000-4000-8000-000000000801','00000000-0000-4000-8000-000000000811','00000000-0000-4000-8000-000000000702','view') and not project_folder_actor_can('00000000-0000-4000-8000-000000000801','00000000-0000-4000-8000-000000000811','00000000-0000-4000-8000-000000000703','view'),'Removed creator and grantee immediately lose access');
select pg_temp.grant_assert(project_folder_actor_can('00000000-0000-4000-8000-000000000801','00000000-0000-4000-8000-000000000811','00000000-0000-4000-8000-000000000701','view'),'Owner access survives member removal');
-- Rejoining the organization does not silently restore old private grants.
insert into organization_memberships(org_id,member_id,role) values('00000000-0000-4000-8000-000000000701','00000000-0000-4000-8000-000000000702','staff'),('00000000-0000-4000-8000-000000000701','00000000-0000-4000-8000-000000000703','board');
select pg_temp.grant_assert((select count(*)=0 from project_asset_folder_grants where member_id='00000000-0000-4000-8000-000000000703'),'Old private grants removed with membership');
select pg_temp.grant_assert(not project_folder_actor_can('00000000-0000-4000-8000-000000000801','00000000-0000-4000-8000-000000000811','00000000-0000-4000-8000-000000000702','view') and not project_folder_actor_can('00000000-0000-4000-8000-000000000801','00000000-0000-4000-8000-000000000811','00000000-0000-4000-8000-000000000703','view'),'Rejoining does not revive creator or prior grants');
select set_project_asset_folder_access('00000000-0000-4000-8000-000000000801','00000000-0000-4000-8000-000000000811','00000000-0000-4000-8000-000000000701',(select access_revision from project_asset_folders where id='00000000-0000-4000-8000-000000000811'),'restricted','[{"memberId":"00000000-0000-4000-8000-000000000706","capability":"manage"}]');
select mutate_project_asset_folder(id,org_id,'00000000-0000-4000-8000-000000000706',updated_at,'{"type":"rename","folderId":"00000000-0000-4000-8000-000000000811","name":"Managed"}',null) from organization_projects where id='00000000-0000-4000-8000-000000000801';
select pg_temp.grant_assert((select name='Managed' from project_asset_folders where id='00000000-0000-4000-8000-000000000811'),'Explicit manager can rename');
select mutate_project_asset_folder(id,org_id,org_id,updated_at,'{"type":"move","fileKey":"organization:fixture-file","folderId":"00000000-0000-4000-8000-000000000812"}',null) from organization_projects where id='00000000-0000-4000-8000-000000000801';
select pg_temp.grant_error($cmd$select set_project_asset_folder_access('00000000-0000-4000-8000-000000000801','00000000-0000-4000-8000-000000000812','00000000-0000-4000-8000-000000000701',0,'restricted','[]')$cmd$,'42501');
select pg_temp.grant_error($cmd$select mutate_project_asset_folder(id,org_id,org_id,updated_at,'{"type":"move","fileKey":"organization:fixture-file","folderId":"00000000-0000-4000-8000-000000000811"}',null) from organization_projects where id='00000000-0000-4000-8000-000000000801'$cmd$,'42501');
select pg_temp.grant_assert((select folder_id='00000000-0000-4000-8000-000000000812' from project_asset_folder_placements where file_key='organization:fixture-file'),'Blocked move preserves old placement');
do $$ declare adapter text; begin
 foreach adapter in array array['project','organization','core','policy','upload','drive','fiscal'] loop
  perform pg_temp.grant_error(format('insert into project_asset_folder_placements(project_id,file_key,folder_id) values(%L,%L,%L)','00000000-0000-4000-8000-000000000801',adapter||':blocked','00000000-0000-4000-8000-000000000811'),'42501');
 end loop;
end $$;
update organization_projects set status='completed' where id='00000000-0000-4000-8000-000000000801';
select pg_temp.grant_assert((select audience='restricted' and created_by='00000000-0000-4000-8000-000000000702' from project_asset_folders where id='00000000-0000-4000-8000-000000000811' and project_id=(select id from organization_projects where name='Folder grants qualification' and recurrence_occurrence=1)),'Recurrence preserves audience and creator');
select pg_temp.grant_assert((select count(*)=1 from project_asset_folder_grants where project_id=(select id from organization_projects where name='Folder grants qualification' and recurrence_occurrence=1)),'Recurrence preserves explicit grants');
-- A legacy project is still migrated atomically by its first rename.
insert into organization_projects(id,org_id,name,created_by,updated_by,option_settings) values('00000000-0000-4000-8000-000000000802','00000000-0000-4000-8000-000000000701','Legacy folder grants','00000000-0000-4000-8000-000000000701','00000000-0000-4000-8000-000000000701','{"tags":[],"sprintTypes":[],"assetFolders":{"folders":[{"id":"00000000-0000-4000-8000-000000000821","name":"Legacy"}],"placements":[]}}');
select mutate_project_asset_folder(id,org_id,org_id,updated_at,'{"type":"rename","folderId":"00000000-0000-4000-8000-000000000821","name":"Renamed legacy"}',null) from organization_projects where id='00000000-0000-4000-8000-000000000802';
select pg_temp.grant_assert((select created_by is null and audience='inherited' and name='Renamed legacy' from project_asset_folders where id='00000000-0000-4000-8000-000000000821'),'Legacy identity preserved without fabricated creator');
