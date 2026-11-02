\set ON_ERROR_STOP on
\ir organization-closure-integrated-fixture.sql
\ir ../migrations/20261102231000_organization_closure_calendar_reads.sql
\ir ../migrations/20261102232000_organization_closure_ai_billing.sql
\ir ../migrations/20261102233000_organization_closure_public_profile_reads.sql
\ir ../migrations/20261102234000_organization_closure_drive_admission.sql
-- Test-only reset includes the calendar migration's new dependent receipt.
do $$ declare definition text; begin
 select pg_get_functiondef('public.fixture_closure_calendar()'::regprocedure) into definition;
 if strpos(definition,'truncate public.roadmap_calendar_public_events')=0 then raise exception 'Unexpected calendar fixture reset'; end if;
 execute replace(definition,'truncate public.roadmap_calendar_public_events','truncate public.organization_calendar_publication_revocations,public.roadmap_calendar_public_events');
end $$;
