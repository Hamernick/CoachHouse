\set ON_ERROR_STOP on
begin;
do $$ begin
 if current_setting('coach_house.workspace_sharing_fixture',true) is distinct from 'isolated-test-only' then raise exception 'Fixture required'; end if;
end $$;
update public.organization_workspace_boards set state='{}',updated_by=public.fixture_form_id(1);
truncate public.organization_forms cascade;
delete from public.organization_workspace_pages;
-- Staff creates the form; the actual owner deliberately has no membership row.
select public.fixture_form_publish(0,'publish',80,4);
select public.fixture_form_command('submit');
create function pg_temp.owner_access(action text, role text default 'view', op integer default 500, revision integer default 1, email text default 'person1@example.org') returns jsonb language sql as $$
 select public.organization_form_review_access(public.fixture_form_id(4),jsonb_build_object('action',action,
 'organizationId',public.fixture_form_id(1),'formId',public.fixture_form_id(20),'email',email,
 'memberId',public.fixture_form_id(1),'role',role,'operationId',public.fixture_form_id(op),'expectedRevision',revision));
$$;
do $$ begin
 if exists(select 1 from public.organization_memberships where org_id=public.fixture_form_id(1) and member_id=public.fixture_form_id(1)) then raise exception 'Owner fixture has membership'; end if;
 begin perform public.fixture_form_command('responses',1); raise exception 'Implicit owner response access'; exception when insufficient_privilege then null; end;
 begin perform pg_temp.owner_access('grant_reviewer','view',500,1,'person2@example.org'); raise exception 'Foreign owner accepted'; exception when invalid_parameter_value then null; end;
end $$;
update auth.users set email_confirmed_at=null where id=public.fixture_form_id(1);
do $$ begin
 begin perform pg_temp.owner_access('grant_reviewer'); raise exception 'Unverified owner accepted'; exception when invalid_parameter_value then null; end;
end $$;
update auth.users set email_confirmed_at=now() where id=public.fixture_form_id(1);
-- This is the original regression: no artificial membership may be created.
select pg_temp.owner_access('grant_reviewer','view',500,1,'  PERSON1@EXAMPLE.ORG  ');
do $$ begin
 if public.fixture_form_command('responses',1)#>>'{permissions,canCorrect}'<>'false' then raise exception 'View gained Edit'; end if;
 begin perform public.fixture_form_command('correct',1); raise exception 'View corrected'; exception when insufficient_privilege then null; end;
 if exists(select 1 from public.organization_memberships where member_id=public.fixture_form_id(1)) then raise exception 'Created membership'; end if;
end $$;
select pg_temp.owner_access('grant_reviewer','edit',501,2);
select public.fixture_form_command('correct',1);
update public.organization_workspace_boards set updated_by=public.fixture_form_id(1),state=jsonb_set(state,'{particleGraph,particles,0,title}','"Owner edited"');
do $$ begin
 begin perform public.fixture_form_publish(1,'publish',81,1); raise exception 'Owner stole publication'; exception when insufficient_privilege then null; end;
 if (select creator_id from public.organization_forms)<>public.fixture_form_id(4) or (select intake_manager from public.organization_forms)<>public.fixture_form_id(4) then raise exception 'Ownership changed'; end if;
end $$;
-- Optional owner membership metadata is not the owner's authority.
select pg_temp.owner_access('grant_reviewer','manage',502,3);
select public.organization_form_review_access(public.fixture_form_id(1),jsonb_build_object('action','grant_reviewer','versionId',public.fixture_form_id(80),
 'email','person3@example.org','role','view','operationId',public.fixture_form_id(503),'expectedRevision',4));
insert into public.organization_memberships(org_id,member_id,role) values(public.fixture_form_id(1),public.fixture_form_id(1),'staff');
update public.organization_memberships set role='member' where org_id=public.fixture_form_id(1) and member_id=public.fixture_form_id(1);
delete from public.organization_memberships where org_id=public.fixture_form_id(1) and member_id=public.fixture_form_id(1);
do $$ begin
 if (select count(*) from public.organization_form_reviewers)<>2 or (select access_revision from public.organization_forms)<>5 then raise exception 'Owner metadata revoked grants'; end if;
 if public.fixture_form_command('responses',1)#>>'{permissions,canManageAccess}'<>'true' then raise exception 'Owner lost explicit Manage'; end if;
 perform public.fixture_form_command('responses',3);
 -- Preserve database membership integrity for every non-owner target.
 begin insert into public.organization_form_reviewers(org_id,form_id,member_id,manager_revision,granted_by)
 values(public.fixture_form_id(1),public.fixture_form_id(20),public.fixture_form_id(2),1,public.fixture_form_id(4));
 raise exception 'Missing membership allowed'; exception when foreign_key_violation then null; end;
end $$;
select pg_temp.owner_access('revoke_reviewer','view',504,5);
do $$ begin
 if exists(select 1 from public.organization_form_reviewers) then raise exception 'Revoked Manage retained children'; end if;
 begin perform public.fixture_form_command('responses',1); raise exception 'Revoked owner read answers'; exception when insufficient_privilege then null; end;
 begin perform public.fixture_form_command('responses',3); raise exception 'Revoked child read answers'; exception when insufficient_privilege then null; end;
 -- Exact old receipt cannot recreate a grant or change newer authority.
 perform pg_temp.owner_access('grant_reviewer','view',500,1,'  PERSON1@EXAMPLE.ORG  ');
 if exists(select 1 from public.organization_form_reviewers) then raise exception 'Retry restored access'; end if;
 if (select original_hash from public.organization_form_responses)<>repeat('a',64) or (select count(*) from public.organization_form_versions)<>1 then raise exception 'Changed immutable intake'; end if;
 if has_function_privilege('authenticated','public.organization_form_review_access(uuid,jsonb)','EXECUTE') or has_table_privilege('anon','public.organization_form_reviewers','SELECT') then raise exception 'Untrusted access exposed'; end if;
 if has_table_privilege('authenticated','public.organization_form_reviewers','SELECT') or has_table_privilege('service_role','public.organization_form_reviewers','INSERT') then raise exception 'Direct access exposed'; end if;
 if not (select relrowsecurity from pg_class where oid='public.organization_form_reviewers'::regclass) then raise exception 'RLS disabled'; end if;
end $$;
-- The same explicit owner grant works on a saved draft with no publication.
update public.organization_workspace_boards set state='{}',updated_by=public.fixture_form_id(4);
truncate public.organization_forms cascade;
delete from public.organization_workspace_pages;
update public.organization_workspace_boards set updated_by=public.fixture_form_id(4),state=jsonb_build_object('particleGraph',jsonb_build_object('particles',jsonb_build_array(
 jsonb_build_object('id',public.fixture_form_id(20),'type','activity','title','Private draft','data',jsonb_build_object('widget',jsonb_build_object('kind','form','definition',
 jsonb_build_object('questions',jsonb_build_array(jsonb_build_object('id',public.fixture_form_id(90),'type','text','label','Name','required',true)))))))));
select pg_temp.owner_access('grant_reviewer','edit',505,1);
update public.organization_workspace_boards set updated_by=public.fixture_form_id(1),state=jsonb_set(state,'{particleGraph,particles,0,title}','"Owner draft edit"');
do $$ begin
 if exists(select 1 from public.organization_workspace_pages) or exists(select 1 from public.organization_form_versions)
 or exists(select 1 from public.organization_form_responses) then raise exception 'Draft access created publication or answers'; end if;
end $$;
rollback;
