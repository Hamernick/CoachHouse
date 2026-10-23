-- Existing edited demo records must survive the guard migration itself.
insert into organization_projects(id,org_id,name,created_by,created_source,starter_seed_key,starter_seed_version)
values('00000000-0000-4000-8000-000000000310','00000000-0000-4000-8000-000000000001','Edited existing preview','00000000-0000-4000-8000-000000000001','starter_seed','guard-existing',2);
insert into organization_tasks(id,org_id,project_id,title,created_by,created_source,starter_seed_key,starter_seed_version)
values('00000000-0000-4000-8000-000000000311','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000310','Edited existing task','00000000-0000-4000-8000-000000000001','starter_seed','guard-existing-task',2);
