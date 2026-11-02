\set ON_ERROR_STOP on
begin;
do $$ begin
 if current_setting('coach_house.workspace_sharing_fixture',true) is distinct from 'isolated-test-only' then raise exception 'Fixture required'; end if;
end $$;
-- Create through the canonical board writer; no public page or version exists.
update public.organization_workspace_boards set state='{}',updated_by=public.fixture_form_id(1);
truncate public.organization_forms cascade;
delete from public.organization_workspace_pages;
insert into public.organization_memberships(org_id,member_id,role) values(public.fixture_form_id(1),public.fixture_form_id(6),'staff');
update public.organization_workspace_boards set updated_by=public.fixture_form_id(4),state=jsonb_build_object('particleGraph',jsonb_build_object('particles',jsonb_build_array(
 jsonb_build_object('id',public.fixture_form_id(20),'type','activity','title','Private draft','data',jsonb_build_object('widget',jsonb_build_object('kind','form','definition',
 jsonb_build_object('questions',jsonb_build_array(jsonb_build_object('id',public.fixture_form_id(90),'type','text','label','Name','required',true)))))))));
create function pg_temp.access(action text, actor integer, patch jsonb default '{}') returns jsonb language sql as $$
 select public.organization_form_review_access(public.fixture_form_id(actor),jsonb_build_object('action',action,
 'organizationId',public.fixture_form_id(1),'formId',public.fixture_form_id(20))||patch);
$$;
create function pg_temp.grant_access(actor integer, member integer, role text, op integer, revision integer) returns jsonb language sql as $$
 select pg_temp.access('grant_reviewer',actor,jsonb_build_object('email','person'||member||'@example.org','role',role,
 'operationId',public.fixture_form_id(op),'expectedRevision',revision));
$$;
do $$ declare result jsonb; begin
 if exists(select 1 from public.organization_form_versions) or exists(select 1 from public.organization_workspace_pages) then raise exception 'Unexpected publication'; end if;
 result:=pg_temp.access('source_access',4);
 if result->>'canEdit'<>'true' or result->>'canManageAccess'<>'true' then raise exception 'Missing creator capability'; end if;
 if pg_temp.access('source_access',1)->>'canManageAccess'<>'false' then raise exception 'Owner stole management'; end if;
 begin perform pg_temp.access('review_access',1); raise exception 'Owner read private roster'; exception when insufficient_privilege then null; end;
 begin perform pg_temp.access('review_access',2); raise exception 'Foreign actor read roster'; exception when insufficient_privilege then null; end;
 begin perform pg_temp.access('review_access',4,jsonb_build_object('organizationId',public.fixture_form_id(2))); raise exception 'Cross-org target'; exception when insufficient_privilege then null; end;
 begin perform pg_temp.access('review_access',4,jsonb_build_object('formId',public.fixture_form_id(99))); raise exception 'Invented form target'; exception when insufficient_privilege then null; end;
 begin perform pg_temp.access('review_access',4,jsonb_build_object('versionId',public.fixture_form_id(80))); raise exception 'Ambiguous target'; exception when invalid_parameter_value then null; end;
end $$;
select pg_temp.grant_access(4,3,'manage',400,1);
select pg_temp.grant_access(3,6,'edit',401,2);
do $$ begin
 if pg_temp.access('source_access',3)->>'canManageAccess'<>'true' or pg_temp.access('source_access',6)->>'canEdit'<>'true'
 or pg_temp.access('source_access',6)->>'canManageAccess'<>'false' then raise exception 'Wrong delegated capabilities'; end if;
 begin perform pg_temp.grant_access(3,6,'manage',402,3); raise exception 'Delegated Manage escalation'; exception when insufficient_privilege then null; end;
 begin perform pg_temp.grant_access(4,6,'edit',402,1); raise exception 'Stale grant accepted'; exception when serialization_failure then null; end;
end $$;
-- A delegated Edit can save, but cannot publish or remove the form.
update public.organization_workspace_boards set updated_by=public.fixture_form_id(6),state=jsonb_set(state,'{particleGraph,particles,0,title}','"Edited before publication"');
do $$ begin
 begin update public.organization_workspace_boards set updated_by=public.fixture_form_id(6),state='{}'; raise exception 'Editor removed source'; exception when insufficient_privilege then null; end;
 begin perform public.fixture_form_publish(0,'publish',80,6); raise exception 'Editor published'; exception when insufficient_privilege then null; end;
end $$;
select pg_temp.access('revoke_reviewer',4,jsonb_build_object('memberId',public.fixture_form_id(3),'operationId',public.fixture_form_id(403),'expectedRevision',3));
do $$ begin
 if pg_temp.access('source_access',6)->>'canEdit'<>'false' or pg_temp.access('source_access',3)->>'canManageAccess'<>'false' then raise exception 'Cascade failed'; end if;
 begin perform pg_temp.grant_access(3,6,'edit',401,2); raise exception 'Revoked retry accepted'; exception when insufficient_privilege then null; end;
 -- Original canonical receipt returns, but must never resurrect the removed grant.
 perform pg_temp.grant_access(4,3,'manage',400,1);
 if exists(select 1 from public.organization_form_reviewers) then raise exception 'Replay resurrected access'; end if;
 if exists(select 1 from public.organization_form_versions) or exists(select 1 from public.organization_workspace_pages)
 or exists(select 1 from public.organization_form_responses) then raise exception 'Access created public or answer state'; end if;
 if (select creator_id from public.organization_forms)<>public.fixture_form_id(4)
 or (select intake_manager from public.organization_forms)<>public.fixture_form_id(4) then raise exception 'Access transferred ownership'; end if;
end $$;
rollback;
