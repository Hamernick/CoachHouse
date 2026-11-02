\set ON_ERROR_STOP on
\ir organization-form-creation-fixture.sql
\ir ../migrations/20261101160000_organization_form_recovery.sql
-- Match the production membership FK so missing-member recovery/rejoin races are real.
alter table public.organization_memberships add constraint fixture_membership_org_fkey
 foreign key(org_id) references public.organizations(user_id) on delete cascade;
