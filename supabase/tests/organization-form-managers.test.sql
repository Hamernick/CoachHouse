\set ON_ERROR_STOP on
begin;
do $$ begin
 if current_setting('coach_house.workspace_sharing_fixture',true) is distinct from 'isolated-test-only' then raise exception 'Fixture required'; end if;
end $$;
update public.organization_workspace_boards set state='{}',updated_by=public.fixture_form_id(1);
truncate public.organization_forms cascade;
delete from public.organization_workspace_pages;
select public.fixture_form_publish(0);
select public.fixture_form_command('submit');
create function pg_temp.access(action text, actor integer, member integer, role text default 'view', op integer default 300) returns jsonb language sql as $$
 select public.organization_form_review_access(public.fixture_form_id(actor),jsonb_build_object(
 'action',action,'versionId',public.fixture_form_id(80),'email','person'||member||'@example.org',
 'memberId',public.fixture_form_id(member),'role',role,'operationId',public.fixture_form_id(op),
 'expectedRevision',(select access_revision from public.organization_forms where id=public.fixture_form_id(20))));
$$;
select pg_temp.access('grant_reviewer',1,4,'manage');
do $$ declare result jsonb; begin
 result:=public.fixture_form_command('responses',4);
 if result#>>'{permissions,canCorrect}'<>'true' or result#>>'{permissions,canManageAccess}'<>'true' then raise exception 'Manage capabilities missing'; end if;
 if pg_temp.access('review_access',4,3)->>'canGrantManage'<>'false' or pg_temp.access('review_access',1,3)->>'canGrantManage'<>'true' then raise exception 'Implicit delegation'; end if;
 if pg_temp.access('review_access',4,3)->'reviewers'<>'[]'::jsonb then raise exception 'Unrelated roster exposed'; end if;
 begin perform pg_temp.access('grant_reviewer',4,3,'manage',301); raise exception 'Manage escalation'; exception when insufficient_privilege then null; end;
 begin perform pg_temp.access('grant_reviewer',4,4,'edit',301); raise exception 'Self replacement'; exception when invalid_parameter_value then null; end;
 begin perform public.fixture_form_publish(1,'publish',81,4); raise exception 'Manage publication'; exception when insufficient_privilege then null; end;
 begin update public.organization_workspace_boards set state='{}',updated_by=public.fixture_form_id(4); raise exception 'Manage removal'; exception when insufficient_privilege then null; end;
end $$;
update public.organization_workspace_boards set state=jsonb_set(state,'{particleGraph,particles,0,title}','"Manage draft"'),updated_by=public.fixture_form_id(4);
select public.fixture_form_command('correct',4);
select pg_temp.access('grant_reviewer',4,3,'edit',301);
do $$ begin
 if pg_temp.access('review_access',4,3)#>>'{reviewers,0,role}'<>'edit' then raise exception 'Own roster missing'; end if;
 if public.fixture_form_command('responses',3)#>>'{permissions,canCorrect}'<>'true' then raise exception 'Delegated edit missing'; end if;
 begin perform pg_temp.access('grant_reviewer',3,4,'view',302); raise exception 'Further delegation'; exception when insufficient_privilege then null; end;
end $$;
-- Canonical manager adopts the child; the delegate cannot alter it afterward.
select pg_temp.access('grant_reviewer',1,3,'edit',302);
do $$ begin
 if pg_temp.access('review_access',4,3)->'reviewers'<>'[]'::jsonb then raise exception 'Adopted roster exposed'; end if;
 begin perform pg_temp.access('grant_reviewer',4,3,'view',303); raise exception 'Replaced independent access'; exception when insufficient_privilege then null; end;
 begin perform pg_temp.access('revoke_reviewer',4,3,'view',303); raise exception 'Revoked independent access'; exception when insufficient_privilege then null; end;
end $$;
select pg_temp.access('revoke_reviewer',1,4,'view',303);
select public.fixture_form_command('responses',3);
-- Restore Manage, replace the adopted grant with a new delegated one, then downgrade.
select pg_temp.access('grant_reviewer',1,4,'manage',304);
select pg_temp.access('revoke_reviewer',1,3,'view',305);
select pg_temp.access('grant_reviewer',4,3,'view',306);
select pg_temp.access('grant_reviewer',4,3,'edit',307);
select pg_temp.access('grant_reviewer',1,4,'edit',308);
do $$ begin
 begin perform public.fixture_form_command('responses',3); raise exception 'Child survived downgrade'; exception when insufficient_privilege then null; end;
 if public.fixture_form_command('responses',4)#>>'{permissions,canManageAccess}'<>'false' then raise exception 'Downgrade kept delegation'; end if;
end $$;
-- A lost reply cannot restore access after revocation; lost authority denies even retry.
select pg_temp.access('grant_reviewer',1,4,'manage',309);
create temporary table retry as select jsonb_build_object('action','grant_reviewer','versionId',public.fixture_form_id(80),'email','person3@example.org',
 'memberId',public.fixture_form_id(3),'role','edit','operationId',public.fixture_form_id(310),
 'expectedRevision',(select access_revision from public.organization_forms where id=public.fixture_form_id(20))) command;
select public.organization_form_review_access(public.fixture_form_id(4),command) from retry;
select pg_temp.access('revoke_reviewer',4,3,'view',311);
select public.organization_form_review_access(public.fixture_form_id(4),command) from retry;
do $$ begin
 if exists(select 1 from public.organization_form_reviewers where member_id=public.fixture_form_id(3)) then raise exception 'Retry resurrected child'; end if;
end $$;
select pg_temp.access('grant_reviewer',4,3,'view',312);
select pg_temp.access('revoke_reviewer',1,4,'view',313);
do $$ begin
 begin perform public.organization_form_review_access(public.fixture_form_id(4),(select command from retry)); raise exception 'Revoked delegate retry'; exception when insufficient_privilege then null; end;
 begin perform public.fixture_form_command('responses',3); raise exception 'Child survived revoke'; exception when insufficient_privilege then null; end;
end $$;
-- Membership demotion/deletion ends grants and their children permanently.
select pg_temp.access('grant_reviewer',1,4,'manage',314);
select pg_temp.access('grant_reviewer',4,3,'edit',315);
update public.organization_memberships set role='member' where org_id=public.fixture_form_id(1) and member_id=public.fixture_form_id(4);
update public.organization_memberships set role='staff' where org_id=public.fixture_form_id(1) and member_id=public.fixture_form_id(4);
do $$ begin
 if exists(select 1 from public.organization_form_reviewers) then raise exception 'Demotion retained grants'; end if;
 begin perform public.fixture_form_command('responses',3); raise exception 'Role restoration restored child'; exception when insufficient_privilege then null; end;
end $$;
select pg_temp.access('grant_reviewer',1,4,'manage',316);
select pg_temp.access('grant_reviewer',4,3,'view',317);
delete from public.organization_memberships where org_id=public.fixture_form_id(1) and member_id=public.fixture_form_id(4);
insert into public.organization_memberships values(public.fixture_form_id(1),public.fixture_form_id(4),'staff');
do $$ begin
 if exists(select 1 from public.organization_form_reviewers) then raise exception 'Rejoin restored delegation'; end if;
 if has_function_privilege('service_role','public.can_manage_organization_form(uuid,uuid,uuid)','execute')
   or has_function_privilege('authenticated','public.revoke_form_access_on_membership_loss()','execute') then raise exception 'Private helper exposed'; end if;
 if (select intake_manager from public.organization_forms where id=public.fixture_form_id(20))<>public.fixture_form_id(1) then raise exception 'Manager transferred'; end if;
 if (select version->>'title' from public.organization_form_versions where id=public.fixture_form_id(80))<>'Sign up' then raise exception 'Published source changed'; end if;
end $$;
-- Losing the primary manager ends the entire chain, including indirect children.
update public.organization_workspace_boards set state='{}',updated_by=public.fixture_form_id(1);
truncate public.organization_forms cascade;
delete from public.organization_workspace_pages;
select public.fixture_form_publish(0,'publish',80,4);
update public.organization_memberships set role='staff' where org_id=public.fixture_form_id(1) and member_id=public.fixture_form_id(5);
select pg_temp.access('grant_reviewer',4,3,'manage',318);
select pg_temp.access('grant_reviewer',3,5,'edit',319);
update public.organization_memberships set role='member' where org_id=public.fixture_form_id(1) and member_id=public.fixture_form_id(4);
do $$ begin
 if exists(select 1 from public.organization_form_reviewers) then raise exception 'Primary manager loss retained indirect children'; end if;
 begin perform public.fixture_form_command('responses',5); raise exception 'Indirect read survived'; exception when insufficient_privilege then null; end;
end $$;
rollback;
