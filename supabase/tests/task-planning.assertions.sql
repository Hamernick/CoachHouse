create or replace function pg_temp.assert_true(value boolean, message text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception '%', message; end if; end;
$$;
-- The recurrence fixture predates the tracker import. Mirror its additive date,
-- provenance and Waiting columns without executing the production import.
alter table organization_tasks alter column start_date drop not null, alter column end_date drop not null;
alter table organization_tasks add column tracker_metadata jsonb;
alter table organization_tasks drop constraint organization_tasks_status_check;
alter table organization_tasks add constraint organization_tasks_status_check check(status in ('todo','in-progress','waiting','done'));
insert into organization_projects(id,org_id,name,status,start_date,end_date,created_by)
values('00000000-0000-4000-8000-000000000210','00000000-0000-4000-8000-000000000001','Planning tests','active',null,null,'00000000-0000-4000-8000-000000000001');
insert into organization_tasks(id,org_id,project_id,title,status,start_date,end_date,sort_order,created_source,created_by,tracker_metadata)
select ('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000210',
 'Planning '||n,'waiting',null,'2026-11-30',case when n<222 then 0 else n-220 end,
 case when n=224 then 'system' else 'user' end,'00000000-0000-4000-8000-000000000001','{"sourceId":"preserved","collaboratorUserIds":[]}'::jsonb
from generate_series(220,224) n;
insert into organization_task_assignees(org_id,task_id,user_id,created_by)
select '00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000220',id,'00000000-0000-4000-8000-000000000001'
from profiles where id in ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002');
create temporary table planning_notifications_before as select count(*) as count from notifications;
create temporary table planning_assignments_before as select * from organization_task_assignees;
create temporary table planning_projects_before as select id,status,recurrence_occurrence from organization_projects;

select pg_temp.assert_true(not has_function_privilege('authenticated','public.schedule_organization_task_transition(uuid,uuid,uuid,uuid,date,date,date)','execute'),'Authenticated cannot bypass server scheduling authorization');
select pg_temp.assert_true(not has_function_privilege('anon','public.move_organization_task_transition(uuid,uuid,uuid,uuid,uuid,text,integer,integer,timestamptz,timestamptz)','execute'),'Anonymous cannot bypass ordering authorization');
select pg_temp.assert_true(has_function_privilege('service_role','public.schedule_organization_task_transition(uuid,uuid,uuid,uuid,date,date,date)','execute'),'Service role can execute verified scheduling');
select pg_temp.assert_true((public.schedule_organization_task_transition('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000220','00000000-0000-4000-8000-000000000210','00000000-0000-4000-8000-000000000001','2026-11-02',null,'2026-11-30')->>'ok')::boolean,'Schedule due-only task');
select pg_temp.assert_true((select start_date='2026-11-02' and end_date='2026-11-30' and status='waiting' and title='Planning 220' and tracker_metadata->>'sourceId'='preserved' from organization_tasks where id='00000000-0000-4000-8000-000000000220'),'Schedule preserves deadline/status/title/provenance');
select pg_temp.assert_true(public.schedule_organization_task_transition('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000220','00000000-0000-4000-8000-000000000210','00000000-0000-4000-8000-000000000001','2026-11-03',null,'2026-11-30')->>'code'='stale','Stale schedule rejected');
select pg_temp.assert_true(public.schedule_organization_task_transition('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000220','00000000-0000-4000-8000-000000000210','00000000-0000-4000-8000-000000000001','2026-12-01','2026-11-02','2026-11-30')->>'code'='invalid_dates','Cannot silently extend deadline');
select pg_temp.assert_true(public.schedule_organization_task_transition('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000224','00000000-0000-4000-8000-000000000210','00000000-0000-4000-8000-000000000001','2026-11-02',null,'2026-11-30')->>'code'='invalid_task','System/shared fiscal task scheduling denied');
select pg_temp.assert_true(public.schedule_organization_task_transition('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000220','00000000-0000-4000-8000-000000000210','00000000-0000-4000-8000-000000000002','2026-11-02',null,'2026-11-30')->>'code'='invalid_task','Wrong organization rejected');
select pg_temp.assert_true((public.schedule_organization_task_transition('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000220','00000000-0000-4000-8000-000000000210','00000000-0000-4000-8000-000000000001',null,'2026-11-02','2026-11-30')->>'ok')::boolean,'Clear start keeps due date');

create temporary table planning_order_snapshot as select id,sort_order,updated_at from organization_tasks where project_id='00000000-0000-4000-8000-000000000210';
select pg_temp.assert_true((public.move_organization_task_transition('00000000-0000-4000-8000-000000000001',a.id,'00000000-0000-4000-8000-000000000210','00000000-0000-4000-8000-000000000001',b.id,'after',a.sort_order,b.sort_order,a.updated_at,b.updated_at)->>'ok')::boolean,'Move visible task across hidden records with duplicate ranks')
from planning_order_snapshot a,planning_order_snapshot b where a.id='00000000-0000-4000-8000-000000000220' and b.id='00000000-0000-4000-8000-000000000223';
select pg_temp.assert_true((select array_agg(right(id::text,3) order by sort_order,id)=array['221','222','223','220'] from organization_tasks where project_id='00000000-0000-4000-8000-000000000210' and created_source<>'system'),'Hidden records retain relative order');
select pg_temp.assert_true(public.move_organization_task_transition('00000000-0000-4000-8000-000000000001',a.id,'00000000-0000-4000-8000-000000000210','00000000-0000-4000-8000-000000000001',b.id,'before',a.sort_order,b.sort_order,a.updated_at,b.updated_at)->>'code'='stale','Stale task and neighbor ordering rejected')
from planning_order_snapshot a,planning_order_snapshot b where a.id='00000000-0000-4000-8000-000000000220' and b.id='00000000-0000-4000-8000-000000000223';
select pg_temp.assert_true(public.move_organization_task_transition('00000000-0000-4000-8000-000000000001',a.id,'00000000-0000-4000-8000-000000000210','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000020','before',a.sort_order,0,a.updated_at,a.updated_at)->>'code'='invalid_task','Cross-project neighbor denied')
from organization_tasks a where a.id='00000000-0000-4000-8000-000000000220';
select pg_temp.assert_true((select sort_order=4 and start_date is null from organization_tasks where id='00000000-0000-4000-8000-000000000224'),'Shared system task untouched');
select pg_temp.assert_true((select count(*)=(select count from planning_notifications_before) from notifications),'Schedule/order emits no assignment notices');
select pg_temp.assert_true(not exists((select * from organization_task_assignees except select * from planning_assignments_before) union all (select * from planning_assignments_before except select * from organization_task_assignees)),'All assignment rows retained byte-for-byte');
select pg_temp.assert_true(not exists((select id,status,recurrence_occurrence from organization_projects except select * from planning_projects_before) union all (select * from planning_projects_before except select id,status,recurrence_occurrence from organization_projects)),'Project recurrence and history unchanged');
