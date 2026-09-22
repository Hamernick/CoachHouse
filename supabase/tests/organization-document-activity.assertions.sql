insert into organizations values ('10000000-0000-4000-8000-000000000001', '{}'), ('20000000-0000-4000-8000-000000000002', '{}');
update organizations set profile = '{"roadmap":{"sections":[{"id":"mission","title":"Mission","content":"private content","lastUpdated":"first"},{"id":"vision","content":"","status":"not_started"}]}}' where user_id = '10000000-0000-4000-8000-000000000001';
do $$ begin
 if (select count(*) from organization_project_activity_events) <> 1 then raise exception 'document save/default filter failed'; end if;
 if exists(select 1 from organization_project_activity_events where metadata::text like '%private content%') then raise exception 'document body leaked'; end if;
end $$;
update organizations set profile = jsonb_set(profile, '{roadmap,sections,0,lastUpdated}', '"second"') where user_id = '10000000-0000-4000-8000-000000000001';
do $$ begin if (select count(*) from organization_project_activity_events) <> 1 then raise exception 'timestamp-only update emitted event'; end if; end $$;
update organizations set profile = jsonb_set(profile, '{roadmap,sections,0,content}', '"edited content"') where user_id = '10000000-0000-4000-8000-000000000001';
update organizations set profile = profile || '{"documents":{"bylaws":{"name":"Bylaws.pdf","path":"private/path"}},"policies":[{"id":"policy-one","title":"Safeguarding","summary":"private policy"}]}' where user_id = '10000000-0000-4000-8000-000000000001';
insert into organization_document_files values ('30000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'Bylaws.pdf', 'bylaws', null, now());
do $$ begin
 if (select count(*) from organization_project_activity_events) <> 4 then raise exception 'upload/policy capture or compliance dedup failed'; end if;
 if exists(select 1 from organization_project_activity_events where metadata::text like '%private%') then raise exception 'private content or path leaked'; end if;
end $$;
insert into organization_document_files values ('40000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001', 'Library.pdf', null, null, now());
update organization_document_files set updated_at = now() where id = '40000000-0000-4000-8000-000000000004';
update organization_document_files set deleted_at = now() where id = '40000000-0000-4000-8000-000000000004';
update organization_document_files set deleted_at = null where id = '40000000-0000-4000-8000-000000000004';
do $$ begin
 if (select count(*) from organization_project_activity_events) <> 7 then raise exception 'library lifecycle failed'; end if;
 if not exists(select 1 from organization_project_activity_events where event_type='restored') then raise exception 'restore not captured'; end if;
end $$;
insert into organization_external_documents values ('50000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000002', 'Drive document', 'active', now(), now());
set role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false);
do $$ begin
 if (select count(*) from public.organization_project_activity_events) <> 7 then raise exception 'tenant isolation failed'; end if;
 begin insert into public.organization_project_activity_events (title) values ('forged'); raise exception 'event forgery allowed'; exception when insufficient_privilege then null; end;
 begin perform public.record_organization_document_activity(); raise exception 'direct trigger call allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
insert into organization_projects values ('60000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000001');
insert into organization_project_assets values ('70000000-0000-4000-8000-000000000007','10000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000006','Project file');
delete from organization_projects where id='60000000-0000-4000-8000-000000000006';
-- Project/task deletion triggers predate document activity and still emit deleted.
insert into organization_project_activity_events(org_id, entity_type, entity_id, event_type, title)
values ('10000000-0000-4000-8000-000000000001', 'project', '60000000-0000-4000-8000-000000000006', 'deleted', 'Deleted project'),
       ('10000000-0000-4000-8000-000000000001', 'task', '60000000-0000-4000-8000-000000000006', 'deleted', 'Deleted task');
delete from organizations;
do $$ begin if exists(select 1 from organization_project_activity_events) then raise exception 'organization cascade failed'; end if; end $$;
