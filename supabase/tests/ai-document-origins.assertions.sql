begin;
create function pg_temp.check_origin(ok boolean,message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'Origin assertion failed: %',message;end if;end $$;
create function pg_temp.deny_origin(command text,expected text default '42501') returns void language plpgsql as $$
begin begin execute command;exception when others then if sqlstate=expected then return;end if;raise;end;raise exception 'Unexpected success: %',command;end $$;
select pg_temp.check_origin((select count(*)=3 and bool_and(not observed_at_creation) and bool_and(source->>'complete'='false') from workspace_ai_document_origins where run_id::text like '89000000-%'),'historical backfill stays incomplete');
select pg_temp.check_origin((select relrowsecurity and relforcerowsecurity from pg_class where oid='workspace_ai_document_origins'::regclass),'forced RLS');
select pg_temp.check_origin(not has_table_privilege(role_name,'workspace_ai_document_origins','SELECT,INSERT,UPDATE,DELETE,TRUNCATE'),'no direct grants: '||role_name) from unnest(array['anon','authenticated','service_role']) role_name;
select pg_temp.check_origin(not has_function_privilege('service_role','capture_workspace_ai_document_origin(workspace_ai_runs,boolean)','execute'),'private capture');

create function pg_temp.origin_run(n integer,target jsonb,actor uuid default '90b6c688-889c-467f-9edd-166f28bf0819',task_name text default 'document') returns void language sql as $$
 insert into workspace_ai_runs(id,org_id,actor_id,request_hash,task,target,prompt,tariff,max_credits,max_provider_microdollars,status,settled_at,charged_credits,provider_microdollars,proposal)
 values(('89100000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'e972bc07-fbf5-4fc8-a416-7f00910a71e2',actor,lpad(n::text,64,'0'),task_name,target,'PRIVATE PROMPT','{}',1,1000,'succeeded',now(),0,0,'PRIVATE PROPOSAL');
$$;
select pg_temp.origin_run(1,'{"sectionId":"vision","revision":"r1","content":"PRIVATE BODY","title":"PRIVATE TITLE","revisionSourceRunId":"89000000-0000-4000-8000-000000000001"}');
select pg_temp.origin_run(2,'{"sectionId":"vision","revision":"r1","revisionSourceRunId":"89100000-0000-4000-8000-000000000001"}');
select pg_temp.check_origin((select observed_at_creation and source->>'revisionSourceState'='observed' and source->>'revisionSourceRunId'='89100000-0000-4000-8000-000000000001' from workspace_ai_document_origins where run_id='89100000-0000-4000-8000-000000000002'),'revision chain recorded at creation');
select pg_temp.origin_run(3,'{"sectionId":"selection:89100000-0000-4000-8000-000000000003","revision":"r1","selection":{"html":"PRIVATE SELECTION"}}');
select pg_temp.check_origin((select source->>'kind'='selection' and source->>'complete'='false' from workspace_ai_document_origins where run_id='89100000-0000-4000-8000-000000000003'),'selection remains incomplete');
select pg_temp.origin_run(4,'{"sectionId":"vision","revisionSourceRunId":"89000000-0000-4000-8000-000000000002"}');
select pg_temp.origin_run(5,'{"sectionId":"mission","revisionSourceRunId":"89000000-0000-4000-8000-000000000001"}');
select pg_temp.origin_run(6,'{"sectionId":"vision","revisionSourceRunId":"89100000-0000-4000-8000-000000000006"}');
select pg_temp.origin_run(7,'{"sectionId":"vision","revisionSourceRunId":"bad"}');
select pg_temp.origin_run(8,'{"sectionId":"vision","revisionSourceRunId":"89100000-0000-4000-8000-000000000099"}');
select pg_temp.check_origin((select count(*)=5 and bool_and(source->>'revisionSourceState'='unresolved') from workspace_ai_document_origins where run_id between '89100000-0000-4000-8000-000000000004' and '89100000-0000-4000-8000-000000000008'),'foreign actor, section, self, malformed and absent parents unresolved');
select pg_temp.origin_run(9,'{}');
select pg_temp.origin_run(10,'{"sectionId":"vision","organizationId":"00000000-0000-4000-8000-000000000000"}');
select pg_temp.origin_run(11,'{"sectionId":"vision","revision":{"content":"PRIVATE"}}');
select pg_temp.check_origin((select count(*)=3 and bool_and(source is null) from workspace_ai_document_origins where run_id between '89100000-0000-4000-8000-000000000009' and '89100000-0000-4000-8000-000000000011'),'unknown source never becomes empty provenance');
select pg_temp.check_origin(not exists(select 1 from workspace_ai_document_origins where source::text like '%PRIVATE%'),'no prompt, title, body or selection stored');
-- Service reader exposes bounded identities, never content or authority grants.
select pg_temp.check_origin(has_function_privilege('service_role','read_workspace_ai_document_sources(uuid,uuid,uuid)','execute') and
 not has_function_privilege('authenticated','read_workspace_ai_document_sources(uuid,uuid,uuid)','execute') and
 not has_function_privilege('anon','read_workspace_ai_document_sources(uuid,uuid,uuid)','execute'),'reader ACL');
set local request.jwt.claim.role='service_role';
set local request.headers='{"x-coach-house-actor-id":"90b6c688-889c-467f-9edd-166f28bf0819"}';
create function pg_temp.read_origins(n integer) returns jsonb language sql as $$
 select public.read_workspace_ai_document_sources('e972bc07-fbf5-4fc8-a416-7f00910a71e2','90b6c688-889c-467f-9edd-166f28bf0819',('89100000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid);
$$;
select pg_temp.check_origin(jsonb_array_length(pg_temp.read_origins(2)->'sources')=3 and pg_temp.read_origins(2)->>'complete'='false','transitive backfilled sources');
select pg_temp.check_origin(pg_temp.read_origins(3)->'sources'->0->>'kind'='selection','selection identity only');
select pg_temp.check_origin(pg_temp.read_origins(2)::text not like '%PRIVATE%' and pg_temp.read_origins(2)::text not like '%revision%','bounded identities only');
select pg_temp.deny_origin('select pg_temp.read_origins('||n||')') from generate_series(4,11) n;
select pg_temp.deny_origin('select pg_temp.read_origins(99)');
select pg_temp.deny_origin($q$select read_workspace_ai_document_sources('e972bc07-fbf5-4fc8-a416-7f00910a71e2','e972bc07-fbf5-4fc8-a416-7f00910a71e2','89100000-0000-4000-8000-000000000002')$q$);
select pg_temp.deny_origin($q$select read_workspace_ai_document_sources('00000000-0000-4000-8000-000000000000','90b6c688-889c-467f-9edd-166f28bf0819','89100000-0000-4000-8000-000000000002')$q$);
set local request.headers='{"x-coach-house-actor-id":"e972bc07-fbf5-4fc8-a416-7f00910a71e2"}';
select pg_temp.check_origin(jsonb_array_length(read_workspace_ai_document_sources('e972bc07-fbf5-4fc8-a416-7f00910a71e2','e972bc07-fbf5-4fc8-a416-7f00910a71e2','89000000-0000-4000-8000-000000000002')->'sources')=1,'owner retains access to own run');
select pg_temp.deny_origin($q$select read_workspace_ai_document_sources('e972bc07-fbf5-4fc8-a416-7f00910a71e2','e972bc07-fbf5-4fc8-a416-7f00910a71e2','89100000-0000-4000-8000-000000000002')$q$);
set local request.headers='{"x-coach-house-actor-id":"90b6c688-889c-467f-9edd-166f28bf0819"}';
set local request.jwt.claim.role='authenticated';
select pg_temp.deny_origin('select pg_temp.read_origins(2)');
set local request.jwt.claim.role='service_role';
set local request.headers='{}';
select pg_temp.deny_origin('select pg_temp.read_origins(2)');
set local request.headers='{"x-coach-house-actor-id":"90b6c688-889c-467f-9edd-166f28bf0819"}';
-- Current membership denial must not become an empty allowed source list.
savepoint source_membership;
delete from organization_memberships where org_id='e972bc07-fbf5-4fc8-a416-7f00910a71e2' and member_id='90b6c688-889c-467f-9edd-166f28bf0819';
select pg_temp.deny_origin('select pg_temp.read_origins(2)');
rollback to source_membership;
-- Bound work even for an unusually long revision history.
select pg_temp.origin_run(100,'{"sectionId":"vision"}');
do $$begin for n in 101..164 loop perform pg_temp.origin_run(n,jsonb_build_object('sectionId','vision','revisionSourceRunId','89100000-0000-4000-8000-'||lpad((n-1)::text,12,'0')));end loop;end$$;
select pg_temp.check_origin(jsonb_array_length(pg_temp.read_origins(163)->'sources')=64,'bounded chain allowed');
select pg_temp.deny_origin('select pg_temp.read_origins(164)');
create temporary table origins_before as select * from workspace_ai_document_origins;
update workspace_ai_runs set target='{}' where id in ('89100000-0000-4000-8000-000000000001','89100000-0000-4000-8000-000000000002');
delete from workspace_ai_runs where id='89100000-0000-4000-8000-000000000003';
select pg_temp.check_origin(not exists((select * from workspace_ai_document_origins except select * from origins_before) union all (select * from origins_before except select * from workspace_ai_document_origins)),'target stripping and deletion retain exact observations');
select pg_temp.check_origin(jsonb_array_length(pg_temp.read_origins(2)->'sources')=3,'target stripping cannot erase reader dependencies');
delete from workspace_ai_runs where id='89100000-0000-4000-8000-000000000001';
select pg_temp.check_origin(jsonb_array_length(pg_temp.read_origins(2)->'sources')=3,'deleted ancestor still resolved from retained identities');
-- Synthetic historical cycles can exist after backfill; fail rather than loop.
insert into workspace_ai_document_origins(run_id,org_id,actor_id,source,observed_at_creation)
 select ('89100000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'e972bc07-fbf5-4fc8-a416-7f00910a71e2','90b6c688-889c-467f-9edd-166f28bf0819',
 jsonb_build_object('sectionId','vision','kind','editor','revisionSourceState','observed','revisionSourceRunId','89100000-0000-4000-8000-'||lpad((case n when 200 then 201 else 200 end)::text,12,'0'),'complete',false),false
 from generate_series(200,201) n;
select pg_temp.deny_origin('select pg_temp.read_origins(200)');
select pg_temp.deny_origin($q$update workspace_ai_document_origins set source='{}'$q$,'P0001');
select pg_temp.deny_origin('delete from workspace_ai_document_origins','P0001');
select pg_temp.deny_origin('truncate workspace_ai_document_origins','P0001');
-- A capture failure must roll back the run, never leave an untracked request.
create function pg_temp.reject_origin() returns trigger language plpgsql as $$begin raise exception 'Synthetic origin failure';end$$;
create trigger fixture_reject_origin before insert on workspace_ai_document_origins for each row execute function pg_temp.reject_origin();
select pg_temp.deny_origin($q$select pg_temp.origin_run(12,'{"sectionId":"vision"}')$q$,'P0001');
select pg_temp.check_origin(not exists(select 1 from workspace_ai_runs where id='89100000-0000-4000-8000-000000000012'),'capture and run insertion atomic');
drop trigger fixture_reject_origin on workspace_ai_document_origins;
rollback;
