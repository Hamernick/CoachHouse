-- This uses the real existing project RLS/recurrence migrations in the harness.
create function pg_temp.folder_assert(value boolean,message text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception '%',message; end if; end;
$$;
insert into profiles(id,role) values('00000000-0000-4000-8000-000000000601','member'),('00000000-0000-4000-8000-000000000602','member');
insert into organizations(user_id) values('00000000-0000-4000-8000-000000000601'),('00000000-0000-4000-8000-000000000602');
insert into organization_projects(id,org_id,name,created_by,updated_by,status,start_date,end_date,option_settings,recurrence,recurrence_anchor_start,recurrence_anchor_end)
values('00000000-0000-4000-8000-000000000501','00000000-0000-4000-8000-000000000601','Folder storage qualification',
 '00000000-0000-4000-8000-000000000601','00000000-0000-4000-8000-000000000601','active','2027-01-01','2027-01-31',
 '{"tags":[],"sprintTypes":[],"untouched":{"setting":true},"assetFolders":{"folders":[{"id":"00000000-0000-4000-8000-000000000511","name":"Board"}],"placements":[{"fileKey":"organization:existing-file","folderId":"00000000-0000-4000-8000-000000000511"}]}}',
 'monthly','2027-01-01','2027-01-31'),
 ('00000000-0000-4000-8000-000000000502','00000000-0000-4000-8000-000000000602','Other organization',
 '00000000-0000-4000-8000-000000000602','00000000-0000-4000-8000-000000000602','active','2027-01-01','2027-01-31',null,'none',null,null);

select pg_temp.folder_assert(not exists(select 1 from project_asset_folder_libraries),'No eager data migration');
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000601',false);
select pg_temp.folder_assert(read_project_asset_folders('00000000-0000-4000-8000-000000000501')#>>'{folders,0,name}'='Board','Owner can read unchanged legacy folder');
do $$ begin
  begin
    perform read_project_asset_folders('00000000-0000-4000-8000-000000000502');
    raise exception 'Foreign project read succeeded';
  exception when insufficient_privilege then null; end;
end $$;
select pg_temp.folder_assert(not has_function_privilege('authenticated','public.mutate_project_asset_folder(uuid,uuid,uuid,timestamptz,jsonb,uuid)','execute'),'Client cannot call trusted writer');
select pg_temp.folder_assert(not has_function_privilege('anon','public.read_project_asset_folders(uuid)','execute'),'Anonymous read denied');
reset role;

-- First edit preserves IDs/placements and unrelated options in the same commit.
select mutate_project_asset_folder(id,org_id,updated_by,updated_at,
 '{"type":"rename","folderId":"00000000-0000-4000-8000-000000000511","name":"Board papers"}',null)
 from organization_projects where id='00000000-0000-4000-8000-000000000501';
select pg_temp.folder_assert((select not option_settings ? 'assetFolders' and option_settings->'untouched'='{"setting":true}'::jsonb
 from organization_projects where id='00000000-0000-4000-8000-000000000501'),'Only legacy folder field removed');
select pg_temp.folder_assert((select count(*)=1 from project_asset_folder_placements where file_key='organization:existing-file'),'Original source reference preserved');
select pg_temp.folder_assert(read_project_asset_folders('00000000-0000-4000-8000-000000000501')#>>'{folders,0,id}'='00000000-0000-4000-8000-000000000511','Original identity preserved');

set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000602',false);
select pg_temp.folder_assert((select count(*)=0 from project_asset_folders),'Foreign folder names withheld by RLS');
select pg_temp.folder_assert((select count(*)=0 from project_asset_folder_placements),'Foreign placements withheld by RLS');
select pg_temp.folder_assert((select count(*)=0 from project_asset_folder_libraries),'Foreign migration metadata withheld');
reset role;
insert into organization_memberships(org_id,member_id,role) values('00000000-0000-4000-8000-000000000601','00000000-0000-4000-8000-000000000602','board');
set role authenticated;
select pg_temp.folder_assert(read_project_asset_folders('00000000-0000-4000-8000-000000000501')#>>'{folders,0,name}'='Board papers','Existing member reads preserved');
do $$ begin
  begin
    update project_asset_folders set name='Escalated';
    raise exception 'Client wrote directly';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
delete from organization_memberships where org_id='00000000-0000-4000-8000-000000000601' and member_id='00000000-0000-4000-8000-000000000602';
set role authenticated;
select pg_temp.folder_assert((select count(*)=0 from project_asset_folders),'Membership revocation removes folder reads');
reset role;

do $$ declare stamp timestamptz; begin
  select updated_at into stamp from organization_projects where id='00000000-0000-4000-8000-000000000501';
  begin
    perform mutate_project_asset_folder('00000000-0000-4000-8000-000000000501','00000000-0000-4000-8000-000000000601',
      '00000000-0000-4000-8000-000000000601',stamp-interval '1 second','{"type":"remove","folderId":"00000000-0000-4000-8000-000000000511"}',null);
    raise exception 'Stale write succeeded';
  exception when serialization_failure then null; end;
  begin
    update organization_projects set option_settings=option_settings||'{"assetFolders":{"folders":[],"placements":[]}}'
      where id='00000000-0000-4000-8000-000000000501';
    raise exception 'Old options reintroduced folders';
  exception when serialization_failure then null; end;
  begin
    perform mutate_project_asset_folder('00000000-0000-4000-8000-000000000501','00000000-0000-4000-8000-000000000601',
      '00000000-0000-4000-8000-000000000601',stamp,'{"type":"create","name":"board papers"}','00000000-0000-4000-8000-000000000512');
    raise exception 'Duplicate folder succeeded';
  exception when unique_violation then null; end;
  begin
    insert into project_asset_folder_libraries(project_id) values('00000000-0000-4000-8000-000000000502');
    insert into project_asset_folder_placements values('00000000-0000-4000-8000-000000000502','organization:foreign','00000000-0000-4000-8000-000000000511');
    raise exception 'Cross-project placement succeeded';
  exception when foreign_key_violation then null; end;
end $$;

select mutate_project_asset_folder(id,org_id,updated_by,updated_at,'{"type":"create","name":"Finance"}','00000000-0000-4000-8000-000000000512')
 from organization_projects where id='00000000-0000-4000-8000-000000000501';
select mutate_project_asset_folder(id,org_id,updated_by,updated_at,'{"type":"move","fileKey":"organization:existing-file","folderId":"00000000-0000-4000-8000-000000000512"}',null)
 from organization_projects where id='00000000-0000-4000-8000-000000000501';
select pg_temp.folder_assert((select folder_id='00000000-0000-4000-8000-000000000512' from project_asset_folder_placements where project_id='00000000-0000-4000-8000-000000000501'),'Move changes only placement');

update organization_projects set status='completed' where id='00000000-0000-4000-8000-000000000501';
select pg_temp.folder_assert((select count(*)=2 from project_asset_folders where project_id=(select id from organization_projects where name='Folder storage qualification' and recurrence_occurrence=1)),'Recurring copy retains normalized folders');
select pg_temp.folder_assert((select count(*)=1 from project_asset_folder_placements where project_id=(select id from organization_projects where name='Folder storage qualification' and recurrence_occurrence=1)),'Recurring copy retains reference placement without copying source');

select mutate_project_asset_folder(id,org_id,updated_by,updated_at,'{"type":"remove","folderId":"00000000-0000-4000-8000-000000000512"}',null)
 from organization_projects where id='00000000-0000-4000-8000-000000000501';
select pg_temp.folder_assert((select count(*)=0 from project_asset_folder_placements where project_id='00000000-0000-4000-8000-000000000501'),'Removing a folder returns files to root');

-- Malformed legacy metadata must roll back the entire transition, never reset it.
update organization_projects set option_settings='{"tags":[],"sprintTypes":[],"assetFolders":{"folders":[],"placements":[{"fileKey":"organization:orphan","folderId":"00000000-0000-4000-8000-000000000599"}]}}'
 where id='00000000-0000-4000-8000-000000000502';
do $$ declare p public.organization_projects%rowtype; begin
  select * into p from organization_projects where id='00000000-0000-4000-8000-000000000502';
  begin
    perform mutate_project_asset_folder(p.id,p.org_id,p.updated_by,p.updated_at,'{"type":"create","name":"Ignored"}','00000000-0000-4000-8000-000000000513');
    raise exception 'Malformed legacy state overwritten';
  exception when foreign_key_violation then null; end;
  perform pg_temp.folder_assert(not exists(select 1 from project_asset_folder_libraries where project_id=p.id),'Failed migration leaves no partial rows');
  perform pg_temp.folder_assert((select option_settings=p.option_settings from organization_projects where id=p.id),'Failed migration preserves legacy state');
end $$;
delete from organization_projects where name='Folder storage qualification';
select pg_temp.folder_assert((select count(*)=0 from project_asset_folder_libraries),'Project deletion cascades folder metadata');
