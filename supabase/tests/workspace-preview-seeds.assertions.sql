create function pg_temp.assert_true(value boolean, message text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception '%',message; end if; end;
$$;

create temporary table preview_projects_before as select * from organization_projects;
create temporary table preview_tasks_before as select * from organization_tasks;
create temporary table preview_assignments_before as select * from organization_task_assignees;
create temporary table preview_notifications_before as select * from notifications;

set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
-- Old loaders retry inserts/upserts on every empty workspace visit. They receive
-- empty RETURNING results, without inserting, overwriting, or failing a page.
do $$
declare affected integer;
begin
  for attempt in 1..2 loop
    insert into public.organization_projects(org_id,name,created_by,created_source,starter_seed_key,starter_seed_version)
    values('00000000-0000-4000-8000-000000000001','Organizations preview','00000000-0000-4000-8000-000000000001','starter_seed','1',2)
    on conflict(org_id,starter_seed_key) do update set name=excluded.name;
    get diagnostics affected=row_count;
    perform pg_temp.assert_true(affected=0,'Preview project inserts must be suppressed');
    insert into public.organization_tasks(org_id,project_id,title,created_by,created_source,starter_seed_key,starter_seed_version)
    values('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000310','Try adding a real project','00000000-0000-4000-8000-000000000001','starter_seed','1:1-2',2)
    on conflict(org_id,starter_seed_key) do update set title=excluded.title;
    get diagnostics affected=row_count;
    perform pg_temp.assert_true(affected=0,'Preview task inserts must be suppressed');
  end loop;
  insert into public.organization_projects(org_id,name,created_by,created_source,starter_seed_key,starter_seed_version)
  values('00000000-0000-4000-8000-000000000001','Overwritten preview','00000000-0000-4000-8000-000000000001','starter_seed','guard-existing',2)
  on conflict(org_id,starter_seed_key) do update set name=excluded.name;
  get diagnostics affected=row_count;
  perform pg_temp.assert_true(affected=0,'Old project upserts must not overwrite retained edited work');
  insert into public.organization_tasks(org_id,project_id,title,created_by,created_source,starter_seed_key,starter_seed_version)
  values('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000310','Overwritten task','00000000-0000-4000-8000-000000000001','starter_seed','guard-existing-task',2)
  on conflict(org_id,starter_seed_key) do update set title=excluded.title;
  get diagnostics affected=row_count;
  perform pg_temp.assert_true(affected=0,'Old task upserts must not overwrite retained edited work');
end $$;
reset role;

select pg_temp.assert_true(not exists((select * from organization_projects except select * from preview_projects_before) union all (select * from preview_projects_before except select * from organization_projects)),'Preview attempts preserve every existing project');
select pg_temp.assert_true(not exists((select * from organization_tasks except select * from preview_tasks_before) union all (select * from preview_tasks_before except select * from organization_tasks)),'Preview attempts preserve every existing task');
select pg_temp.assert_true(not exists((select * from organization_task_assignees except select * from preview_assignments_before) union all (select * from preview_assignments_before except select * from organization_task_assignees)),'No preview assignments');
select pg_temp.assert_true(not exists((select * from notifications except select * from preview_notifications_before) union all (select * from preview_notifications_before except select * from notifications)),'No preview notifications');

set role authenticated;
insert into organization_projects(id,org_id,name,created_by)
values('00000000-0000-4000-8000-000000000320','00000000-0000-4000-8000-000000000001','Real project','00000000-0000-4000-8000-000000000001');
reset role;
set role service_role;
select pg_temp.assert_true((public.create_organization_task_transition('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000320','Real task',null,'task','todo','2026-10-20','2026-10-21','medium',null,null,null)->>'ok')::boolean,'Real task RPC creation succeeds');
select pg_temp.assert_true((public.update_organization_task_transition('00000000-0000-4000-8000-000000000001',id,org_id,project_id,project_id,'Saved real task',null,'task','todo',start_date,end_date,'medium',null,null,null)->>'ok')::boolean,'Real task RPC editing succeeds') from organization_tasks where project_id='00000000-0000-4000-8000-000000000320' and created_source='user';
update organization_tasks set title='Preserved edited task' where id='00000000-0000-4000-8000-000000000311';
reset role;
set role authenticated;
-- User 2 is not an editor of user 1's organization.
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false);
do $$
begin
  begin
    insert into organization_tasks(org_id,project_id,title,created_by)
    values('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000320','Unauthorized task','00000000-0000-4000-8000-000000000002');
    raise exception 'Unauthorized task insert unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
set role service_role;
insert into organization_tasks(id,org_id,project_id,title,created_by,created_source)
values('00000000-0000-4000-8000-000000000322','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000320','System task','00000000-0000-4000-8000-000000000001','system');
insert into organization_tasks(org_id,project_id,title,created_by,created_source,starter_seed_key,starter_seed_version)
values('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000320','Service preview','00000000-0000-4000-8000-000000000001','starter_seed','service-preview',2);
reset role;
select pg_temp.assert_true((select title='Saved real task' from organization_tasks where project_id='00000000-0000-4000-8000-000000000320' and created_source='user'),'Real task create/edit persists');
select pg_temp.assert_true((select title='Preserved edited task' from organization_tasks where id='00000000-0000-4000-8000-000000000311'),'Editing retained records remains allowed');
select pg_temp.assert_true((select count(*)=1 from organization_tasks where id='00000000-0000-4000-8000-000000000322'),'System task creation remains allowed');
select pg_temp.assert_true(not exists(select 1 from organization_tasks where starter_seed_key='service-preview'),'Service writes cannot recreate previews');
select pg_temp.assert_true((select bool_and(relrowsecurity) from pg_class where oid in ('organization_projects'::regclass,'organization_tasks'::regclass)),'RLS remains enabled');
select pg_temp.assert_true((select not prosecdef and proconfig=array['search_path=""'] from pg_proc where oid='public.suppress_workspace_preview_seed_insert()'::regprocedure),'Guard does not elevate privileges');
