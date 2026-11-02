\set ON_ERROR_STOP on
\ir organization-form-response-deletion-fixture.sql
-- The sharing fixture omits the original owner FK. Restore the production
-- constraint from 20250926140000 before applying the new boundary migration.
alter table public.organizations add constraint organizations_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;
\ir ../migrations/20261102020000_organization_owner_deletion_boundary.sql
