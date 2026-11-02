\set ON_ERROR_STOP on
\ir organization-closure-fiscal-signing-fixture.sql
-- Existing full AI ledger/policy/RPC migrations; only omitted billing/profile
-- prerequisites are synthetic. No production wallet, entitlement or provider.
alter table public.profiles add column full_name text;
alter table public.subscriptions add column stripe_customer_id text;
\ir ../migrations/20260227190000_add_workspace_objective_tables.sql
\ir ../migrations/20261022150000_workspace_objective_plans.sql
\ir ../migrations/20261022160000_workspace_plan_decisions.sql
\ir ../migrations/20261022120000_workspace_ai_metering.sql
\ir ../migrations/20261022121000_workspace_ai_read_and_recovery.sql
\ir ../migrations/20261022123000_workspace_ai_durable_recovery.sql
\ir ../migrations/20261022130000_workspace_ai_document_application.sql
\ir ../migrations/20261022140000_workspace_ai_document_review.sql
\ir ../migrations/20261022170000_workspace_ai_plans.sql
\ir ../migrations/20261022230000_workspace_ai_plan_revisions.sql
\ir ../migrations/20261022233000_workspace_ai_credit_purchases.sql
\ir ../migrations/20261022234500_workspace_ai_spending_limits.sql
\ir ../migrations/20261023001500_workspace_ai_payment_restrictions.sql
\ir ../migrations/20261023010000_workspace_ai_usage_history.sql
\ir ../migrations/20261023020000_workspace_ai_subscription_allowances.sql
\ir ../migrations/20261024010000_workspace_particle_research.sql
\ir ../migrations/20261024020000_workspace_ai_refill_setup.sql
\ir ../migrations/20261024021000_workspace_ai_refill_execution.sql
\ir ../migrations/20261030180000_workspace_research_history.sql
\ir ../migrations/20261030190000_workspace_new_objective_research.sql
\ir ../migrations/20261031190000_workspace_ai_provider_exposure.sql
\ir ../migrations/20261031200000_workspace_research_drafts.sql
set check_function_bodies=on;
\ir ../migrations/20261102220000_organization_closure_ai_admission.sql
create function public.fixture_closure_ai() returns void language plpgsql as $$
begin
 truncate public.ai_credit_wallets cascade;
 perform public.fixture_closure_fiscal_signing();
 update public.ai_credit_policy set enabled=true,org_daily_provider_microdollars=10000000,daily_provider_microdollars=100000000,
 user_hourly_runs=1000,user_daily_credits=10000;
 insert into public.ai_credit_wallets(org_id,enabled) select public.fixture_form_id(n),true from generate_series(1,2) n;
 insert into public.ai_credit_lots(org_id,operation_key,kind,credits)
 select public.fixture_form_id(n),'closure-test:'||n,'purchased',10000 from generate_series(1,2) n;
end; $$;
create function public.fixture_ai_reserve(n integer default 1801,org integer default 1,actor integer default 1) returns jsonb language sql as $$
 select public.reserve_workspace_ai_run(public.fixture_form_id(n),public.fixture_form_id(org),public.fixture_form_id(actor),repeat('a',64),
 '{}','Synthetic task','{}',10,1000); $$;
create function public.fixture_ai_claim(n integer default 1801,actor integer default 1) returns boolean language sql as $$
 select public.claim_workspace_ai_run(public.fixture_form_id(n),public.fixture_form_id(actor)); $$;
create function public.fixture_ai_finish(n integer default 1801) returns jsonb language plpgsql as $$
begin
 perform public.record_workspace_ai_result(public.fixture_form_id(n),'succeeded',100,5,'Private result','{"input":10,"output":5}',null);
 return public.settle_recorded_workspace_ai_run(public.fixture_form_id(n));
end; $$;
create function public.fixture_ai_research(n integer default 1810) returns jsonb language sql as $$
 select public.reserve_workspace_ai_research_run(public.fixture_form_id(n),public.fixture_form_id(1),public.fixture_form_id(1),repeat('b',64),
 jsonb_build_object('kind','particle_research','mode','new_objective','organizationId',public.fixture_form_id(1),
 'userId',public.fixture_form_id(1),'canvasId',null,'revision',coalesce((state->'particleGraph'->>'revision')::integer,0)),
 'Synthetic research','{}',10,1000) from public.organization_workspace_boards where org_id=public.fixture_form_id(1); $$;
