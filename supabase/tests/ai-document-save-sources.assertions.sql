-- Existing synthetic actors and real canonical writes in the disposable fixture.
begin;
set local request.jwt.claim.role='service_role';
set local request.headers='{"x-coach-house-actor-id":"90b6c688-889c-467f-9edd-166f28bf0819"}';
create function pg_temp.check_save_source(ok boolean,message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'Assertion failed: %',message;end if;end $$;
create function pg_temp.deny_save_source(command text) returns void language plpgsql as $$
begin begin execute command;exception when insufficient_privilege then return;end;raise exception 'Unexpected success: %',command;end $$;
create temporary table source_save_before as select profile,updated_at from organizations
 where user_id='e972bc07-fbf5-4fc8-a416-7f00910a71e2';
-- Mutable target repairs must not turn unresolved/cross-section/selection roots
-- into ordinary editor proposals. New runs capture origins through the real trigger.
insert into workspace_ai_runs(id,org_id,actor_id,request_hash,task,target,prompt,tariff,max_credits,max_provider_microdollars,status,settled_at,charged_credits,provider_microdollars,proposal)
 select ('89000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,org_id,actor_id,lpad(n::text,64,'0'),task,
 case n when 10 then '{"sectionId":"mission"}'::jsonb
 when 11 then '{"sectionId":"vision","selection":{}}'::jsonb
 when 12 then '{}'::jsonb
 when 13 then '{"sectionId":"vision","revisionSourceRunId":"89000000-0000-4000-8000-000000009999"}'::jsonb
 else '{"sectionId":"vision","revisionSourceRunId":"89000000-0000-4000-8000-000000000001"}'::jsonb end,
 prompt,tariff,max_credits,max_provider_microdollars,status,settled_at,charged_credits,provider_microdollars,proposal
 from workspace_ai_runs cross join generate_series(10,14) n where id='89000000-0000-4000-8000-000000000001';
update workspace_ai_runs set target='{"sectionId":"vision","revision":null}' where id::text in
 ('89000000-0000-4000-8000-000000000010','89000000-0000-4000-8000-000000000011','89000000-0000-4000-8000-000000000012','89000000-0000-4000-8000-000000000013');
select pg_temp.deny_save_source('select fixture_document_commit('||n||')') from generate_series(10,13) n;
update workspace_ai_runs set target=target||'{"selection":{}}' where id='89000000-0000-4000-8000-000000000001';
select pg_temp.deny_save_source('select fixture_document_commit()');
update workspace_ai_runs set target=target-'selection' where id='89000000-0000-4000-8000-000000000001';
select pg_temp.check_save_source((select o.profile=b.profile and o.updated_at=b.updated_at from organizations o cross join source_save_before b
 where user_id='e972bc07-fbf5-4fc8-a416-7f00910a71e2'),'denied sources leave profile unchanged');
select pg_temp.check_save_source(not exists(select 1 from workspace_ai_document_applications where run_id::text like '89000000-%'),'denied sources create no receipt');
-- Retained ancestor identity still permits the reviewed descendant after deletion.
delete from workspace_ai_runs where id='89000000-0000-4000-8000-000000000001';
select pg_temp.check_save_source(not (fixture_document_commit(14)->>'replayed')::boolean,'retained editor chain can save');
select pg_temp.check_save_source((fixture_document_commit(14,true)->>'replayed')::boolean,'source-checked replay preserves idempotency');
update workspace_ai_runs set target=target||'{"selection":{}}' where id='89000000-0000-4000-8000-000000000014';
select pg_temp.deny_save_source('select fixture_document_commit(14)');
select pg_temp.check_save_source((select count(*)=1 from workspace_ai_document_applications where run_id='89000000-0000-4000-8000-000000000014'),'denied replay preserves original receipt');
select pg_temp.check_save_source(not has_function_privilege('service_role','commit_workspace_ai_document_before_authority(uuid,uuid,uuid,timestamptz,text,jsonb,jsonb,text,text)','execute'),'no inner bypass');
rollback;
