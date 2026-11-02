\set ON_ERROR_STOP on
\ir organization-closure-ai-fixture.sql
\ir ../migrations/20261102232000_organization_closure_ai_billing.sql
create function public.fixture_billing_input(n integer default 2501) returns jsonb language sql as $$
 select jsonb_build_object('id',public.fixture_form_id(n),'organizationId',public.fixture_form_id(1),'actorId',public.fixture_form_id(1),
 'pack','closure-test','mode','test','runtimeTarget','primary','threshold',20000,'monthlyPacks',2,'consentVersion','refill-v1','consent',true,'returnUrl','https://example.org/billing'); $$;
create function public.fixture_closure_ai_billing() returns void language plpgsql as $$
begin
 perform public.fixture_closure_ai();
 insert into public.ai_credit_packs(key,mode,price_id,credits,amount,currency,enabled)
 values('closure-test','test','price_synthetic_closure',20000,1000,'usd',true) on conflict(key) do nothing;
end $$;
create function public.fixture_billing_queue() returns uuid language plpgsql as $$
declare queued jsonb;
begin
 perform public.prepare_ai_credit_refill_setup(public.fixture_billing_input());
 perform public.verify_ai_credit_refill_setup(jsonb_build_object('id',public.fixture_form_id(2501),'mode','test','session','cs_synthetic',
 'customer','cus_synthetic','paymentMethod','pm_synthetic','label','Synthetic test'));
 perform public.fixture_ai_reserve();
 perform public.fixture_ai_claim();
 perform public.fixture_ai_finish();
 queued:=public.prepare_next_ai_credit_refill('test','primary');
 if queued is null then raise exception 'Fixture did not queue refill'; end if;
 return (queued->'order'->>'id')::uuid;
end $$;
create function public.fixture_billing_purchase(n integer default 2511,org integer default 1) returns jsonb language sql as $$
 select public.prepare_ai_credit_purchase(public.fixture_form_id(n),public.fixture_form_id(org),public.fixture_form_id(org),
 'closure-test','test','https://example.org/billing'); $$;
create function public.fixture_billing_finish(p_id uuid) returns void language sql as $$
 select public.record_ai_credit_refill_attempt(jsonb_build_object('id',p_id,'state','succeeded','payment','pi_synthetic_refill',
 'mode','test','amount',1000,'currency','usd','customer','cus_synthetic','paymentMethod','pm_synthetic'));  $$;
