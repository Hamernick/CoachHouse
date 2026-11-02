\set ON_ERROR_STOP on
\ir organization-closure-refund-review-fixture.sql
\ir ../migrations/20261103030000_organization_closure_refund_execution.sql
-- Synthetic fixture only: old unrelated credits are included, never an
-- unbound purchase. Production immutable lots are not edited or inferred.
do $$ declare definition text; begin
 definition:=pg_get_functiondef('public.fixture_closure_ai()'::regprocedure);
 definition:=replace(definition,$match$'purchased',10000$match$,$replacement$'included',10000$replacement$);
 execute definition;
end $$;
create function public.fixture_refund_mature() returns void language plpgsql as $$
declare requested timestamptz:=clock_timestamp()-interval '31 days';
begin
 perform public.fixture_closure('request',600,0);
 update public.organization_closures set requested_at=requested,
 export_until=requested+interval '720 hours' where org_id=public.fixture_form_id(1);
end $$;
