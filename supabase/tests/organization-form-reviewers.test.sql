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
create function pg_temp.access(action text, actor integer default 1, patch jsonb default '{}') returns jsonb language sql as $$
 select public.organization_form_review_access(public.fixture_form_id(actor),jsonb_build_object('action',action,'versionId',public.fixture_form_id(80),
 'email','person4@example.org','memberId',public.fixture_form_id(4),'operationId',public.fixture_form_id(180),'expectedRevision',1)||patch);
$$;
do $$ begin
 begin perform public.fixture_form_command('responses',4); raise exception 'Automatic response access'; exception when insufficient_privilege then null; end;
 begin perform pg_temp.access('grant_reviewer',3); raise exception 'Admin grant bypass'; exception when insufficient_privilege then null; end;
 begin perform pg_temp.access('review_access',2); raise exception 'Foreign discovery'; exception when insufficient_privilege then null; end;
 begin perform pg_temp.access('grant_reviewer',1,'{"email":"person2@example.org"}'); raise exception 'Foreign recipient'; exception when invalid_parameter_value then null; end;
 begin perform pg_temp.access('grant_reviewer',1,'{"email":"person5@example.org"}'); raise exception 'Unsupported recipient role'; exception when invalid_parameter_value then null; end;
 begin perform pg_temp.access('grant_reviewer',1,'{"expectedRevision":2}'); raise exception 'Stale grant'; exception when serialization_failure then null; end;
end $$;
select pg_temp.access('grant_reviewer');
select pg_temp.access('grant_reviewer');
do $$ declare result jsonb; begin
 result:=public.fixture_form_command('responses',4);
 if result#>>'{permissions,canCorrect}'<>'false' or result#>>'{permissions,canManageAccess}'<>'false' or jsonb_array_length(result->'responses')<>1 then raise exception 'Invalid reviewer capability'; end if;
 if public.fixture_form_command('responses',1)#>>'{permissions,canCorrect}'<>'true' then raise exception 'Manager correction lost'; end if;
 if jsonb_array_length(public.list_organization_form_versions(public.fixture_form_id(4),public.fixture_form_id(10))->'versions')<>1 then raise exception 'Missing discovery'; end if;
 if jsonb_array_length(pg_temp.access('review_access')->'reviewers')<>1 or (select count(*) from public.organization_form_access_operations)<>1 then raise exception 'Duplicate grant'; end if;
 begin perform public.fixture_form_command('correct',4); raise exception 'Reviewer correction'; exception when insufficient_privilege then null; end;
 begin perform pg_temp.access('review_access',4); raise exception 'Reviewer read grant roster'; exception when insufficient_privilege then null; end;
 begin perform pg_temp.access('grant_reviewer',4); raise exception 'Reviewer shared'; exception when insufficient_privilege then null; end;
 begin perform public.fixture_form_publish(1,'publish',81,4); raise exception 'Reviewer publication'; exception when insufficient_privilege then null; end;
 begin update public.organization_workspace_boards set state=jsonb_set(state,'{particleGraph,particles,0,title}','"Altered"'),updated_by=public.fixture_form_id(4); raise exception 'Reviewer source edit'; exception when insufficient_privilege then null; end;
 begin perform pg_temp.access('grant_reviewer',1,'{"email":"person3@example.org"}'); raise exception 'Operation reused'; exception when unique_violation then null; end;
end $$;
-- Another form on the same page remains invisible, even with its exact version ID.
insert into public.organization_forms(org_id,id,intake_manager) values(public.fixture_form_id(1),public.fixture_form_id(21),public.fixture_form_id(1));
insert into public.organization_form_versions(id,org_id,form_id,page_id,version)
 select public.fixture_form_id(82),org_id,public.fixture_form_id(21),page_id,
   version||jsonb_build_object('id',public.fixture_form_id(82),'formId',public.fixture_form_id(21))
 from public.organization_form_versions where id=public.fixture_form_id(80);
do $$ begin
 begin perform public.fixture_form_command('responses',4,jsonb_build_object('versionId',public.fixture_form_id(82))); raise exception 'Neighbor responses'; exception when insufficient_privilege then null; end;
 if jsonb_array_length(public.list_organization_form_versions(public.fixture_form_id(4),public.fixture_form_id(10))->'versions')<>1 then raise exception 'Neighbor discovery'; end if;
end $$;
-- New immutable versions belong to the same form grant.
select public.fixture_form_publish(1,'publish',81);
select public.fixture_form_command('responses',4,jsonb_build_object('versionId',public.fixture_form_id(81)));
select pg_temp.access('revoke_reviewer',1,jsonb_build_object('expectedRevision',2,'operationId',public.fixture_form_id(181)));
select pg_temp.access('revoke_reviewer',1,jsonb_build_object('expectedRevision',2,'operationId',public.fixture_form_id(181)));
-- A late retry returns its original receipt without restoring the revoked grant.
select pg_temp.access('grant_reviewer');
do $$ begin
 begin perform public.fixture_form_command('responses',4); raise exception 'Revoked read'; exception when insufficient_privilege then null; end;
 begin perform public.fixture_form_command('response',4); raise exception 'Revoked direct read'; exception when insufficient_privilege then null; end;
 if public.list_organization_form_versions(public.fixture_form_id(4),public.fixture_form_id(10))->'versions'<>'[]'::jsonb then raise exception 'Revoked discovery'; end if;
end $$;
select pg_temp.access('grant_reviewer',1,jsonb_build_object('expectedRevision',3,'operationId',public.fixture_form_id(182)));
-- Membership removal deletes the grant. Rejoining never silently restores it.
delete from public.organization_memberships where org_id=public.fixture_form_id(1) and member_id=public.fixture_form_id(4);
insert into public.organization_memberships values(public.fixture_form_id(1),public.fixture_form_id(4),'staff');
do $$ begin
 begin perform public.fixture_form_command('responses',4); raise exception 'Rejoin restored review'; exception when insufficient_privilege then null; end;
 if has_table_privilege('service_role','public.organization_form_reviewers','SELECT')
 or has_table_privilege('authenticated','public.organization_form_access_operations','SELECT')
 or has_function_privilege('authenticated','public.organization_form_review_access(uuid,jsonb)','EXECUTE')
 or has_function_privilege('service_role','public.can_review_organization_form(uuid,uuid,uuid)','EXECUTE') then raise exception 'Direct bypass'; end if;
end $$;
-- Manager recovery invalidates grants under the previous manager revision.
update public.organization_workspace_boards set state='{}',updated_by=public.fixture_form_id(1);
truncate public.organization_forms cascade;
delete from public.organization_workspace_pages;
select public.fixture_form_publish(0,'publish',80,4);
select pg_temp.access('grant_reviewer',4,jsonb_build_object('email','person3@example.org'));
update public.organization_memberships set role='board' where org_id=public.fixture_form_id(1) and member_id=public.fixture_form_id(4);
select public.organization_form_recovery(public.fixture_form_id(1),jsonb_build_object('action','recover_form','pageId',public.fixture_form_id(10),'formId',public.fixture_form_id(20),'operationId',public.fixture_form_id(190),'expectedRevision',1));
do $$ begin
 begin perform public.fixture_form_command('responses',3); raise exception 'Recovery retained old grant'; exception when insufficient_privilege then null; end;
end $$;
rollback;
