\set ON_ERROR_STOP on
\ir organization-closure-ai-billing-fixture.sql
\ir ../migrations/20261102235800_organization_closure_refund_review.sql
-- Explicitly order the synthetic older purchased lot before this new payment.
-- Same-transaction now() timestamps otherwise tie and UUID ordering varies.
do $$ declare definition text; begin
 definition:=pg_get_functiondef('public.fixture_closure_ai()'::regprocedure);
 definition:=replace(definition,'ai_credit_lots(org_id,operation_key,kind,credits)',
  'ai_credit_lots(org_id,operation_key,kind,credits,created_at)');
 definition:=replace(definition,$match$'purchased',10000 from$match$, $replacement$'purchased',10000,clock_timestamp()-interval '1 day' from$replacement$);
 execute definition;
end $$;
create function public.fixture_closure_refund_review() returns void language plpgsql as $$
begin
 perform public.fixture_closure_ai_billing();
 perform public.fixture_billing_purchase();
 perform public.fulfill_ai_credit_purchase(public.fixture_form_id(2511),'cs_refund_fixture','pi_refund_fixture','test',1000,'usd');
end $$;
create function public.fixture_refund_spend(p_credits integer) returns void language plpgsql as $$
begin
 update public.ai_credit_policy set max_run_credits=30000,user_daily_credits=50000;
 perform public.reserve_workspace_ai_run(public.fixture_form_id(2801),public.fixture_form_id(1),public.fixture_form_id(1),repeat('a',64),'{}','Refund fixture','{}',p_credits,1000);
 perform public.fixture_ai_claim(2801);
 perform public.record_workspace_ai_result(public.fixture_form_id(2801),'succeeded',100,p_credits,'Private result','{"input":10,"output":5}',null);
 perform public.settle_recorded_workspace_ai_run(public.fixture_form_id(2801));
end $$;
