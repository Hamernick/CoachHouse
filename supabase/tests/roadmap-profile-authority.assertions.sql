set request.jwt.claim.role='service_role';
begin;
create function pg_temp.check_roadmap(ok boolean,message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'Assertion failed: %',message;end if;end $$;
create function pg_temp.deny_roadmap(command text,expected text default '42501') returns void language plpgsql as $$
begin begin execute command;exception when others then if sqlstate=expected then return;end if;raise;end;raise exception 'Unexpected success: %',command;end $$;
select pg_temp.check_roadmap(not has_function_privilege('anon','commit_roadmap_profile(uuid,timestamptz,jsonb,boolean,boolean)','execute'),'no anonymous commit');
select pg_temp.check_roadmap(not has_function_privilege('authenticated','commit_roadmap_profile(uuid,timestamptz,jsonb,boolean,boolean)','execute'),'no client commit');
set local request.headers='{}';
select pg_temp.deny_roadmap('select fixture_roadmap_commit()');
select pg_temp.deny_roadmap('select fixture_roadmap_commit(false,false,false)');
set local request.headers='{"x-coach-house-actor-id":"90b6c688-889c-467f-9edd-166f28bf0819"}';
set local request.jwt.claim.role='authenticated';
select pg_temp.deny_roadmap('select fixture_roadmap_commit()');
set local request.jwt.claim.role='service_role';
create temporary table roadmap_before as select profile,updated_at from organizations where user_id='e972bc07-fbf5-4fc8-a416-7f00910a71e2';
select pg_temp.check_roadmap(not fixture_roadmap_commit(false,true),'stale profile rejected');
select pg_temp.check_roadmap(fixture_roadmap_commit(),'staff save');
select pg_temp.check_roadmap((select o.profile-'roadmap_authority_fixture'=b.profile from organizations o,roadmap_before b where o.user_id='e972bc07-fbf5-4fc8-a416-7f00910a71e2'),'unrelated profile preserved');
-- The next transaction must reject the old version, including a first-insert token.
select pg_temp.check_roadmap(not commit_roadmap_profile('e972bc07-fbf5-4fc8-a416-7f00910a71e2',null,'{}'),'missing revision rejected');
select pg_temp.deny_roadmap($q$select commit_roadmap_profile('e972bc07-fbf5-4fc8-a416-7f00910a71e2',null,'[]')$q$,'22023');
select pg_temp.deny_roadmap($q$select commit_roadmap_profile('e972bc07-fbf5-4fc8-a416-7f00910a71e2',null,'{}',null)$q$,'22023');
select pg_temp.deny_roadmap($q$select commit_roadmap_profile('e972bc07-fbf5-4fc8-a416-7f00910a71e2',null,'{}',false,null)$q$,'22023');
-- A trigger failure rolls back the entire profile and timestamp.
create function pg_temp.reject_roadmap() returns trigger language plpgsql as $$begin raise exception 'fixture failure' using errcode='P0001';end$$;
create trigger fixture_roadmap_failure after update on organizations for each row execute function pg_temp.reject_roadmap();
select pg_temp.deny_roadmap('select fixture_roadmap_commit()','P0001');
select pg_temp.check_roadmap((select profile->>'roadmap_authority_fixture'='1' from organizations where user_id='e972bc07-fbf5-4fc8-a416-7f00910a71e2'),'atomic failed profile');
drop trigger fixture_roadmap_failure on organizations;
update organization_memberships set role='owner' where org_id='e972bc07-fbf5-4fc8-a416-7f00910a71e2' and member_id='90b6c688-889c-467f-9edd-166f28bf0819';
select pg_temp.check_roadmap(fixture_roadmap_commit(),'owner membership preserved');
update organization_memberships set role='member' where org_id='e972bc07-fbf5-4fc8-a416-7f00910a71e2' and member_id='90b6c688-889c-467f-9edd-166f28bf0819';
select pg_temp.deny_roadmap('select fixture_roadmap_commit()');
set local request.headers='{"x-coach-house-actor-id":"e972bc07-fbf5-4fc8-a416-7f00910a71e2"}';
select pg_temp.check_roadmap(fixture_roadmap_commit(),'canonical owner retained');
-- Current paid storage is still required outside explicit support.
update subscriptions set status='canceled' where user_id='e972bc07-fbf5-4fc8-a416-7f00910a71e2';
select pg_temp.deny_roadmap('select fixture_roadmap_commit()');
select pg_temp.check_roadmap(fixture_roadmap_commit(false,false,false),'verified Drive-only Free allowance');
select pg_temp.deny_roadmap($q$select commit_roadmap_profile(user_id,updated_at,jsonb_set(profile,'{documents}','{"new":"body"}'),false,false) from organizations where user_id='e972bc07-fbf5-4fc8-a416-7f00910a71e2'$q$);

set local request.headers='{"x-coach-house-actor-id":"90b6c688-889c-467f-9edd-166f28bf0819"}';
select pg_temp.deny_roadmap('select fixture_roadmap_commit(true)');
insert into platform_staff_members(user_id,access_level) values('90b6c688-889c-467f-9edd-166f28bf0819','coach') on conflict(user_id) do update set access_level='coach';
insert into workspace_support_grants(user_id) values('90b6c688-889c-467f-9edd-166f28bf0819') on conflict(user_id) do update set revoked_at=null;
select pg_temp.check_roadmap(fixture_roadmap_commit(true),'verified support without subscription');
update workspace_support_grants set revoked_at=now() where user_id='90b6c688-889c-467f-9edd-166f28bf0819';
select pg_temp.deny_roadmap('select fixture_roadmap_commit(true)');
update workspace_support_grants set revoked_at=null where user_id='90b6c688-889c-467f-9edd-166f28bf0819';
update auth.users set banned_until=now()+interval '1 hour' where id='90b6c688-889c-467f-9edd-166f28bf0819';
select pg_temp.deny_roadmap('select fixture_roadmap_commit(true)');
update auth.users set banned_until=null where id='90b6c688-889c-467f-9edd-166f28bf0819';
-- Coach scope has its own current authority; read-only membership wins.
update subscriptions set status='active' where user_id='e972bc07-fbf5-4fc8-a416-7f00910a71e2';
select pg_temp.deny_roadmap('select fixture_roadmap_commit()');
delete from organization_memberships where org_id='e972bc07-fbf5-4fc8-a416-7f00910a71e2' and member_id='90b6c688-889c-467f-9edd-166f28bf0819';
update organization_coach_scope_settings set assigned_only_enabled=false,activated_at=null,activated_by=null where id=true;
select pg_temp.check_roadmap(fixture_roadmap_commit(),'unrestricted coach');
update organization_coach_scope_settings set assigned_only_enabled=true,activated_at=now(),activated_by='e972bc07-fbf5-4fc8-a416-7f00910a71e2' where id=true;
select pg_temp.deny_roadmap('select fixture_roadmap_commit()');
insert into organization_coach_assignments(organization_id,coach_user_id) values('e972bc07-fbf5-4fc8-a416-7f00910a71e2','90b6c688-889c-467f-9edd-166f28bf0819');
select pg_temp.check_roadmap(fixture_roadmap_commit(),'assigned coach');
-- Owner-only initial creation and first-insert replay cannot overwrite data.
insert into auth.users(id,email,raw_app_meta_data) values('89000000-0000-4000-8000-000000000081','roadmap-first@example.test','{"legal_consent_exempt":"service_provisioned"}');
set local request.headers='{"x-coach-house-actor-id":"90b6c688-889c-467f-9edd-166f28bf0819"}';
select pg_temp.deny_roadmap($q$select commit_roadmap_profile('89000000-0000-4000-8000-000000000081',null,'{}',false,false)$q$);
set local request.headers='{"x-coach-house-actor-id":"89000000-0000-4000-8000-000000000081"}';
select pg_temp.check_roadmap(commit_roadmap_profile('89000000-0000-4000-8000-000000000081',null,'{"first":"retained"}',false,false),'canonical owner initializes');
select pg_temp.check_roadmap(not commit_roadmap_profile('89000000-0000-4000-8000-000000000081',null,'{"first":"overwrite"}',false,false),'first-insert retry conflicts');
select pg_temp.check_roadmap((select profile->>'first'='retained' from organizations where user_id='89000000-0000-4000-8000-000000000081'),'first data preserved');
rollback;
begin isolation level repeatable read;
set local request.headers='{"x-coach-house-actor-id":"e972bc07-fbf5-4fc8-a416-7f00910a71e2"}';
do $$begin begin perform fixture_roadmap_commit();raise exception 'stronger isolation allowed';exception when serialization_failure then null;end;end$$;
rollback;
