set request.jwt.claim.role='service_role';
begin;
create function pg_temp.check_document(ok boolean,message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'Assertion failed: %',message;end if;end $$;
create function pg_temp.deny_document(command text,expected text default '42501') returns void language plpgsql as $$
begin begin execute command;exception when others then if sqlstate=expected then return;end if;raise;end;raise exception 'Unexpected success: %',command;end $$;
select pg_temp.check_document(not has_function_privilege('authenticated','commit_workspace_ai_document(uuid,uuid,uuid,timestamptz,text,jsonb,jsonb,text,text)','execute'),'no browser commit');
select pg_temp.check_document(not has_function_privilege('service_role','commit_workspace_ai_document_before_authority(uuid,uuid,uuid,timestamptz,text,jsonb,jsonb,text,text)','execute'),'no inner bypass');
create temporary table document_before as select profile,updated_at from organizations where user_id='e972bc07-fbf5-4fc8-a416-7f00910a71e2';
set local request.headers='{}';
select pg_temp.deny_document('select fixture_document_commit()');
set local request.headers='{"x-coach-house-actor-id":"90b6c688-889c-467f-9edd-166f28bf0819"}';
select pg_temp.deny_document($q$select commit_workspace_ai_document(gen_random_uuid(),'e972bc07-fbf5-4fc8-a416-7f00910a71e2','e972bc07-fbf5-4fc8-a416-7f00910a71e2',now(),null,'{}','{}',repeat('a',64))$q$);
set local request.jwt.claim.role='authenticated';
select pg_temp.deny_document('select fixture_document_commit()');
set local request.jwt.claim.role='service_role';
select pg_temp.deny_document('select fixture_document_commit(1,true)','40001');
select pg_temp.check_document((select o.profile=b.profile and o.updated_at=b.updated_at from organizations o cross join document_before b where user_id='e972bc07-fbf5-4fc8-a416-7f00910a71e2'),'failed save changes nothing');
select pg_temp.check_document(not exists(select 1 from workspace_ai_document_applications where run_id::text like '89000000-%'),'no failed receipt');
create function pg_temp.fail_document_receipt() returns trigger language plpgsql as $$
begin raise exception 'Synthetic receipt failure';end$$;
create trigger fixture_document_receipt_failure before insert on workspace_ai_document_applications
 for each row execute function pg_temp.fail_document_receipt();
select pg_temp.deny_document('select fixture_document_commit()','P0001');
select pg_temp.check_document((select o.profile=b.profile and o.updated_at=b.updated_at from organizations o cross join document_before b where user_id='e972bc07-fbf5-4fc8-a416-7f00910a71e2'),'receipt failure rolls back profile');
drop trigger fixture_document_receipt_failure on workspace_ai_document_applications;
select pg_temp.check_document(not (fixture_document_commit()->>'replayed')::boolean,'current staff saves');
select pg_temp.check_document((fixture_document_commit(1,true)->>'replayed')::boolean,'lost acknowledgement recovers original receipt');
select pg_temp.check_document((select o.profile-'authority_fixture'=b.profile from organizations o cross join document_before b where user_id='e972bc07-fbf5-4fc8-a416-7f00910a71e2'),'unrelated profile content preserved');
set local request.headers='{"x-coach-house-actor-id":"e972bc07-fbf5-4fc8-a416-7f00910a71e2"}';
update organization_memberships set role='board' where org_id='e972bc07-fbf5-4fc8-a416-7f00910a71e2' and member_id='90b6c688-889c-467f-9edd-166f28bf0819';
set local request.headers='{"x-coach-house-actor-id":"90b6c688-889c-467f-9edd-166f28bf0819"}';
select pg_temp.deny_document('select fixture_document_commit()');
select pg_temp.deny_document('select fixture_document_commit(3)');
set local request.headers='{"x-coach-house-actor-id":"e972bc07-fbf5-4fc8-a416-7f00910a71e2"}';
select pg_temp.check_document(not (fixture_document_commit(2)->>'replayed')::boolean,'owner retains save access');
rollback;
begin isolation level repeatable read;
set local request.headers='{"x-coach-house-actor-id":"90b6c688-889c-467f-9edd-166f28bf0819"}';
do $$begin begin perform fixture_document_commit();raise exception 'stronger isolation allowed';exception when serialization_failure then null;end;end$$;
rollback;
