begin;
set local request.jwt.claim.role='service_role';
set local request.headers='{"x-coach-house-actor-id":"90b6c688-889c-467f-9edd-166f28bf0819"}';
create function pg_temp.check_copy(ok boolean,message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'Assertion failed: %',message;end if;end $$;
create function pg_temp.deny_copy(command text,expected text default '42501') returns void language plpgsql as $$
begin begin execute command;exception when others then if sqlstate=expected then return;end if;raise;end;raise exception 'Unexpected success: %',command;end $$;
create function pg_temp.copy_sources() returns jsonb language sql as $$
 select public.read_workspace_ai_document_copy_sources('e972bc07-fbf5-4fc8-a416-7f00910a71e2',public.organization_activity_actor_id(),array['vision','mission','unobserved']);$$;
select pg_temp.check_copy(pg_temp.copy_sources()='{"blockedSectionIds":[],"complete":false}','unobserved content is not certified complete');
select fixture_document_commit();
set local request.headers='{"x-coach-house-actor-id":"e972bc07-fbf5-4fc8-a416-7f00910a71e2"}';
select pg_temp.check_copy(pg_temp.copy_sources()='{"blockedSectionIds":[],"complete":false}','owner reads teammate saved copy');
delete from organization_memberships where org_id='e972bc07-fbf5-4fc8-a416-7f00910a71e2' and member_id='90b6c688-889c-467f-9edd-166f28bf0819';
select pg_temp.check_copy(pg_temp.copy_sources()='{"blockedSectionIds":[],"complete":false}','owner retains access when author leaves');
set local request.headers='{"x-coach-house-actor-id":"90b6c688-889c-467f-9edd-166f28bf0819"}';
select pg_temp.deny_copy('select pg_temp.copy_sources()');
insert into organization_memberships(org_id,member_id,role,member_email)
 select 'e972bc07-fbf5-4fc8-a416-7f00910a71e2',id,'staff',email from auth.users where id='90b6c688-889c-467f-9edd-166f28bf0819';
set local request.headers='{"x-coach-house-actor-id":"e972bc07-fbf5-4fc8-a416-7f00910a71e2"}';
select fixture_document_commit(2);
set local request.headers='{"x-coach-house-actor-id":"90b6c688-889c-467f-9edd-166f28bf0819"}';
select pg_temp.check_copy(pg_temp.copy_sources()='{"blockedSectionIds":[],"complete":false}','teammate reads owner saved copy');
-- Read-only organization members can read saved copies, but still cannot use AI.
update organization_memberships set role='board' where org_id='e972bc07-fbf5-4fc8-a416-7f00910a71e2' and member_id='90b6c688-889c-467f-9edd-166f28bf0819';
select pg_temp.check_copy(pg_temp.copy_sources()='{"blockedSectionIds":[],"complete":false}','board member reads saved copy');
select pg_temp.check_copy(not public.can_use_workspace_ai('e972bc07-fbf5-4fc8-a416-7f00910a71e2',public.organization_activity_actor_id()),'copy check grants no AI spending');
update organization_memberships set role='staff' where org_id='e972bc07-fbf5-4fc8-a416-7f00910a71e2' and member_id='90b6c688-889c-467f-9edd-166f28bf0819';
-- A canonical saved descendant survives deleted ancestor and stripped root target.
insert into workspace_ai_runs(id,org_id,actor_id,request_hash,task,target,prompt,tariff,max_credits,max_provider_microdollars,status,settled_at,charged_credits,provider_microdollars,proposal)
 select '89000000-0000-4000-8000-000000000024',org_id,actor_id,repeat('4',64),task,
 '{"sectionId":"vision","revisionSourceRunId":"89000000-0000-4000-8000-000000000003"}',prompt,tariff,max_credits,max_provider_microdollars,status,settled_at,charged_credits,provider_microdollars,proposal
 from workspace_ai_runs where id='89000000-0000-4000-8000-000000000003';
select fixture_document_commit(24);
delete from workspace_ai_runs where id='89000000-0000-4000-8000-000000000003';
update workspace_ai_runs set target='{}' where id='89000000-0000-4000-8000-000000000024';
select pg_temp.check_copy(pg_temp.copy_sources()='{"blockedSectionIds":[],"complete":false}','retained identities survive target retirement and ancestor deletion');
-- Historical receipts may predate source admission. Observe actual malformed,
-- selection and wrong-section origins; never repair them via mutable targets.
insert into workspace_ai_runs(id,org_id,actor_id,request_hash,task,target,prompt,tariff,max_credits,max_provider_microdollars,status,settled_at,charged_credits,provider_microdollars,proposal)
 select ('89000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,org_id,actor_id,lpad(n::text,64,'0'),task,
 case n when 20 then '{"sectionId":"vision","selection":{}}'::jsonb
 when 21 then '{"sectionId":"vision","revisionSourceRunId":"89000000-0000-4000-8000-000000009999"}'::jsonb
 when 22 then '{"sectionId":"mission"}'::jsonb else '{}'::jsonb end,
 prompt,tariff,max_credits,max_provider_microdollars,status,settled_at,charged_credits,provider_microdollars,proposal
 from workspace_ai_runs cross join generate_series(20,23) n where id='89000000-0000-4000-8000-000000000001';
-- Independently test all bad roots through rollback-only subtransactions.
do $$declare n integer;begin for n in 20..23 loop begin
 insert into workspace_ai_document_applications(run_id,section_id,saved_revision,content_hash)
 values(('89000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'vision','old-revision',repeat('a',64));
 update workspace_ai_runs set target='{"sectionId":"vision"}' where id=('89000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid;
 perform pg_temp.check_copy(pg_temp.copy_sources()='{"blockedSectionIds":["vision"],"complete":false}','old receipt remains enforced after target repair');
 raise exception 'fixture rollback' using errcode='P0002';
 exception when no_data_found then null;end;end loop;end$$;
select pg_temp.deny_copy($q$select read_workspace_ai_document_copy_sources('e972bc07-fbf5-4fc8-a416-7f00910a71e2','e972bc07-fbf5-4fc8-a416-7f00910a71e2',array['vision'])$q$);
select pg_temp.deny_copy($q$select read_workspace_ai_document_copy_sources('e972bc07-fbf5-4fc8-a416-7f00910a71e2',organization_activity_actor_id(),array['bad/id'])$q$,'22023');
select pg_temp.deny_copy($q$select read_workspace_ai_document_copy_sources('e972bc07-fbf5-4fc8-a416-7f00910a71e2',organization_activity_actor_id(),array_fill('vision'::text,array[501]))$q$,'22023');
set local request.headers='{}';
select pg_temp.deny_copy('select pg_temp.copy_sources()');
set local request.headers='{"x-coach-house-actor-id":"90b6c688-889c-467f-9edd-166f28bf0819"}';
set local request.jwt.claim.role='authenticated';
select pg_temp.deny_copy('select pg_temp.copy_sources()');
select pg_temp.check_copy(not has_function_privilege('authenticated','read_workspace_ai_document_copy_sources(uuid,uuid,text[])','execute') and not has_function_privilege('anon','read_workspace_ai_document_copy_sources(uuid,uuid,text[])','execute'),'no client source reader');
rollback;
