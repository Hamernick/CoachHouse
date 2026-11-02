\set ON_ERROR_STOP on
\ir organization-closure-calendar-fixture.sql
\ir ../migrations/20261102231000_organization_closure_calendar_reads.sql
-- Include the new private FK child in this disposable fixture's existing reset.
do $$ declare definition text; begin
 select pg_get_functiondef('public.fixture_closure_calendar()'::regprocedure) into definition;
 definition:=replace(definition,'truncate public.roadmap_calendar_public_events','truncate public.organization_calendar_publication_revocations,public.roadmap_calendar_public_events');
 execute definition;
end $$;
