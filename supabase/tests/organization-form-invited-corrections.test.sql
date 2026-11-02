\set ON_ERROR_STOP on
begin;
do $$ begin
 if current_setting('coach_house.workspace_sharing_fixture',true) is distinct from 'isolated-test-only' then raise exception 'Fixture required'; end if;
end $$;
insert into public.organization_memberships(org_id,member_id,role) values(public.fixture_form_id(1),public.fixture_form_id(4),'staff') on conflict(org_id,member_id) do update set role='staff';
update public.organization_workspace_boards set state='{}',updated_by=coalesce((select intake_manager from public.organization_forms where org_id=public.fixture_form_id(1) and id=public.fixture_form_id(20)),public.fixture_form_id(1));
truncate public.organization_forms cascade;
delete from public.organization_workspace_pages;
select public.fixture_form_publish(0,'publish',80,4);
select public.fixture_form_command('submit');
create function pg_temp.invite(action text,actor integer default 4,op integer default 600,rev integer default 1,inv integer default 600,permission text default 'correct') returns jsonb language sql as $$
 select public.organization_form_viewer_access(public.fixture_form_id(actor),jsonb_build_object('action',action,'versionId',public.fixture_form_id(80),
 'email','person2@example.org','operationId',public.fixture_form_id(op),'expectedRevision',rev,'invitationId',public.fixture_form_id(inv),'responsePermission',permission));
$$;
create function pg_temp.correct(rev integer default 1,op integer default 700) returns jsonb language sql as $$
 select public.fixture_form_command('correct',2,jsonb_build_object('expectedRevision',rev,'operationId',public.fixture_form_id(op),'hash',repeat('b',64),
 'answers',jsonb_build_array(jsonb_build_object('questionId',public.fixture_form_id(90),'value','Joanne'))));
$$;
do $$ begin
 begin perform pg_temp.invite('invite_viewer',4,600,1,600,'admin'); raise exception 'Unsupported permission'; exception when invalid_parameter_value then null; end;
 begin perform pg_temp.invite('invite_viewer',2); raise exception 'External actor granted access'; exception when insufficient_privilege then null; end;
end $$;
select pg_temp.invite('invite_viewer');
do $$ begin
 if pg_temp.invite('viewer_offer',2)->>'responsePermission'<>'correct' or pg_temp.invite('viewer_invitations')#>>'{invitations,0,responsePermission}'<>'correct' then raise exception 'Missing correction disclosure'; end if;
 begin perform pg_temp.correct(); raise exception 'Unaccepted correction'; exception when insufficient_privilege then null; end;
 begin perform pg_temp.invite('invite_viewer',4,600,1,600,'view'); raise exception 'Changed permission replayed'; exception when unique_violation then null; end;
end $$;
select pg_temp.invite('accept_viewer',2);
select pg_temp.correct();
select pg_temp.correct();
-- Retry of the original public submission cannot undo an authorized correction.
select public.fixture_form_command('submit');
do $$ begin
 if public.fixture_form_command('responses',2)#>>'{permissions,canCorrect}'<>'true' or public.fixture_form_command('responses',2)#>>'{permissions,canManageAccess}'<>'false' then raise exception 'Wrong correction authority'; end if;
 if public.fixture_form_command('response',2)#>>'{answers,0,value}'<>'Joanne' then raise exception 'Correction lost'; end if;
 if (select count(*) from public.organization_form_corrections)<>1 or (select revision from public.organization_form_responses)<>2 then raise exception 'Duplicate correction'; end if;
 if (select actor_id from public.organization_form_corrections)<>public.fixture_form_id(2) or (select original_hash from public.organization_form_responses)<>repeat('a',64) then raise exception 'Audit/receipt changed'; end if;
 if exists(select 1 from public.organization_memberships where org_id=public.fixture_form_id(1) and member_id=public.fixture_form_id(2)) then raise exception 'Joined workspace'; end if;
 begin perform pg_temp.correct(1,701); raise exception 'Stale correction'; exception when serialization_failure then null; end;
 begin perform public.organization_form_review_access(public.fixture_form_id(2),jsonb_build_object('action','source_access','organizationId',public.fixture_form_id(1),'formId',public.fixture_form_id(20))); raise exception 'Opened source'; exception when insufficient_privilege then null; end;
 begin perform pg_temp.invite('viewer_invitations',2); raise exception 'Listed collaborators'; exception when insufficient_privilege then null; end;
 begin perform pg_temp.invite('revoke_viewer',2,602,3); raise exception 'Delegated access'; exception when insufficient_privilege then null; end;
 begin perform public.list_organization_form_versions(public.fixture_form_id(2),public.fixture_form_id(10),null); raise exception 'Enumerated workspace'; exception when insufficient_privilege then null; end;
 insert into public.organization_forms(org_id,id,intake_manager) values(public.fixture_form_id(1),public.fixture_form_id(21),public.fixture_form_id(4));
 insert into public.organization_form_versions(id,org_id,form_id,page_id,version)
   select public.fixture_form_id(81),org_id,public.fixture_form_id(21),page_id,version from public.organization_form_versions where id=public.fixture_form_id(80);
 begin perform public.fixture_form_command('correct',2,jsonb_build_object('versionId',public.fixture_form_id(81))); raise exception 'Crossed form boundary'; exception when insufficient_privilege then null; end;
 delete from public.organization_forms where id=public.fixture_form_id(21);
 -- Revoking the current manager revision fences the helper independently.
 update public.organization_forms set manager_revision=manager_revision+1;
 begin perform pg_temp.correct(2,701); raise exception 'Old manager revision authorized'; exception when insufficient_privilege then null; end;
 update public.organization_forms set manager_revision=manager_revision-1;
end $$;
-- Downgrade by reinvitation invalidates the accepted correction grant immediately.
select pg_temp.invite('invite_viewer',4,602,3,602,'view');
do $$ begin
 begin perform pg_temp.correct(2,701); raise exception 'Reinvite retained correction'; exception when insufficient_privilege then null; end;
 begin perform pg_temp.invite('accept_viewer',2); raise exception 'Old invitation restored'; exception when insufficient_privilege then null; end;
end $$;
select pg_temp.invite('accept_viewer',2,602,4,602,'view');
do $$ begin
 perform public.fixture_form_command('responses',2);
 begin perform pg_temp.correct(2,701); raise exception 'View grant corrected'; exception when insufficient_privilege then null; end;
end $$;
-- A new explicit correction invitation needs fresh acceptance.
select pg_temp.invite('invite_viewer',4,603,5,603);
select pg_temp.invite('accept_viewer',2,603,6,603);
update public.organization_memberships set role='member' where org_id=public.fixture_form_id(1) and member_id=public.fixture_form_id(4);
update public.organization_memberships set role='staff' where org_id=public.fixture_form_id(1) and member_id=public.fixture_form_id(4);
do $$ begin
 begin perform pg_temp.correct(2,701); raise exception 'Manager rejoin restored correction'; exception when insufficient_privilege then null; end;
 if has_function_privilege('service_role','public.can_correct_invited_form_responses(uuid,uuid,uuid)','EXECUTE') or has_function_privilege('authenticated','public.can_correct_invited_form_responses(uuid,uuid,uuid)','EXECUTE') then raise exception 'Exposed helper'; end if;
end $$;
rollback;
