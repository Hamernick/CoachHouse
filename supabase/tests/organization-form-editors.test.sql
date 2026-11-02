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
 'email','person4@example.org','memberId',public.fixture_form_id(4),'operationId',public.fixture_form_id(200),'expectedRevision',1,'role','edit')||patch);
$$;
create function pg_temp.source_access(actor integer, org integer default 1, form integer default 20) returns jsonb language sql as $$
 select public.organization_form_review_access(public.fixture_form_id(actor),jsonb_build_object('action','source_access','organizationId',public.fixture_form_id(org),'formId',public.fixture_form_id(form)));
$$;
do $$ begin
 if pg_temp.source_access(4)->>'canEdit'<>'false' or pg_temp.source_access(1)->>'canEdit'<>'true' then raise exception 'Implicit edit permission'; end if;
 begin perform pg_temp.source_access(2); raise exception 'Foreign source read'; exception when insufficient_privilege then null; end;
 begin perform pg_temp.access('grant_reviewer',1,'{"role":"owner"}'); raise exception 'Unsupported owner enabled'; exception when invalid_parameter_value then null; end;
end $$;
select pg_temp.access('grant_reviewer');
select pg_temp.access('grant_reviewer');
do $$ begin
 if pg_temp.source_access(4)->>'canEdit'<>'true' then raise exception 'Missing source edit'; end if;
 if public.fixture_form_command('responses',4)#>>'{permissions,canCorrect}'<>'true'
  or public.fixture_form_command('responses',4)#>>'{permissions,canManageAccess}'<>'false' then raise exception 'Invalid editor rights'; end if;
 if pg_temp.access('review_access')#>>'{reviewers,0,role}'<>'edit' then raise exception 'Missing roster role'; end if;
 if (select count(*) from public.organization_form_access_operations)<>1 then raise exception 'Duplicate edit grant'; end if;
 begin perform pg_temp.access('grant_reviewer',4); raise exception 'Editor delegation'; exception when insufficient_privilege then null; end;
 begin perform pg_temp.access('review_access',4); raise exception 'Editor grant roster'; exception when insufficient_privilege then null; end;
 begin perform public.fixture_form_publish(1,'publish',81,4); raise exception 'Editor publication'; exception when insufficient_privilege then null; end;
 begin update public.organization_workspace_boards set state='{}',updated_by=public.fixture_form_id(4); raise exception 'Editor removal'; exception when insufficient_privilege then null; end;
end $$;
update public.organization_workspace_boards set state=jsonb_set(state,'{particleGraph,particles,0,title}','"Updated by editor"'),updated_by=public.fixture_form_id(4);
select public.fixture_form_command('correct',4,'{"answers":[{"questionId":"10000000-0000-4000-8000-000000000090","value":"Joanne"}],"hash":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"}');
do $$ begin
 if (select intake_manager from public.organization_forms where id=public.fixture_form_id(20))<>public.fixture_form_id(1) then raise exception 'Edit transferred management'; end if;
 if (select version->>'title' from public.organization_form_versions where id=public.fixture_form_id(80))<>'Sign up' then raise exception 'Changed published version'; end if;
 if (select answers#>>'{0,value}' from public.organization_form_responses where id=public.fixture_form_id(91))<>'Joanne' then raise exception 'Correction missing'; end if;
end $$;
-- Downgrade keeps view, removes source and response editing immediately.
select pg_temp.access('grant_reviewer',1,jsonb_build_object('role','view','expectedRevision',2,'operationId',public.fixture_form_id(201)));
select pg_temp.access('grant_reviewer'); -- Late edit retry cannot undo downgrade.
do $$ begin
 if pg_temp.source_access(4)->>'canEdit'<>'false' or public.fixture_form_command('responses',4)#>>'{permissions,canCorrect}'<>'false' then raise exception 'Downgrade not effective'; end if;
 begin update public.organization_workspace_boards set state=jsonb_set(state,'{particleGraph,particles,0,title}','"Stale edit"'),updated_by=public.fixture_form_id(4); raise exception 'Downgraded source edit'; exception when insufficient_privilege then null; end;
 begin perform public.fixture_form_command('correct',4); raise exception 'Downgraded correction'; exception when insufficient_privilege then null; end;
end $$;
-- A removed organization role cannot reuse an intact edit grant.
select pg_temp.access('grant_reviewer',1,jsonb_build_object('expectedRevision',3,'operationId',public.fixture_form_id(202)));
update public.organization_memberships set role='member' where member_id=public.fixture_form_id(4);
do $$ begin
 begin perform pg_temp.source_access(4); raise exception 'Demoted source read'; exception when insufficient_privilege then null; end;
 begin update public.organization_workspace_boards set state=jsonb_set(state,'{particleGraph,particles,0,title}','"Demoted edit"'),updated_by=public.fixture_form_id(4); raise exception 'Demoted source edit'; exception when insufficient_privilege then null; end;
 begin perform public.fixture_form_command('correct',4); raise exception 'Demoted correction'; exception when insufficient_privilege then null; end;
 if has_function_privilege('service_role','public.can_edit_organization_form(uuid,uuid,uuid)','execute') then raise exception 'Helper exposed'; end if;
end $$;
rollback;
