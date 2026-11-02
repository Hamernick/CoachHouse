\set ON_ERROR_STOP on
\ir account-organization-boundary-fixture.sql
\ir ../migrations/20261102030000_organization_closure_state.sql
create function public.fixture_closure(action text,operation integer default null,revision integer default null,actor integer default 1,org integer default 1)
 returns jsonb language sql as $$
 select public.organization_closure_command(public.fixture_form_id(actor),public.fixture_form_id(org),action,
   case when operation is null then null else public.fixture_form_id(operation) end,revision);
$$;
\ir ../migrations/20261102040000_organization_closure_publication.sql
\ir organization-closure-publication-helpers.sql
\ir ../migrations/20261102050000_organization_closure_form_writes.sql
\ir ../migrations/20261102060000_organization_closure_profile_writes.sql
