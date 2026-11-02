\set ON_ERROR_STOP on
\ir organization-form-source-recovery-fixture.sql
-- Upgrade must preserve already granted membership-backed access.
select public.fixture_form_publish(0);
select public.organization_form_review_access(public.fixture_form_id(1),jsonb_build_object('action','grant_reviewer','versionId',public.fixture_form_id(80),
 'email','person4@example.org','role','edit','operationId',public.fixture_form_id(520),'expectedRevision',1));
\ir ../migrations/20261101220000_organization_form_owner_access.sql
do $$ begin
 if not exists(select 1 from public.organization_form_reviewers where member_id=public.fixture_form_id(4)
   and membership_member_id=member_id and role='edit' and manager_revision=1)
   or (select access_revision from public.organization_forms)<>2 then raise exception 'Upgrade changed existing access'; end if;
end $$;
update public.organization_workspace_boards set state='{}',updated_by=public.fixture_form_id(1);
truncate public.organization_forms cascade;
delete from public.organization_workspace_pages;
