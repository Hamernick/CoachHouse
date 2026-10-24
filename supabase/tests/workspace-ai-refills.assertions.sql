-- Isolated organization; no Stripe or persistent application database involved.
insert into public.profiles(id) values('90000000-0000-4000-8000-000000000090');
insert into auth.users(id) values('90000000-0000-4000-8000-000000000090');
insert into public.organizations(user_id) values('90000000-0000-4000-8000-000000000090');
insert into public.ai_credit_wallets(org_id,enabled) values('90000000-0000-4000-8000-000000000090',true);
insert into public.ai_credit_packs values('refill-fixture-v1','test','price_refill_fixture',100,1000,'usd',true);
update public.ai_credit_policy set enabled=true,daily_provider_microdollars=100000000;
create function public.fixture_refill_input() returns jsonb language sql as $$
  select '{"id":"90000000-0000-4000-8000-000000000091","organizationId":"90000000-0000-4000-8000-000000000090","actorId":"90000000-0000-4000-8000-000000000090","pack":"refill-fixture-v1","mode":"test","runtimeTarget":"primary","threshold":100,"monthlyPacks":1,"consent":true,"consentVersion":"refill-v1","returnUrl":"http://localhost:3008/workspace"}'::jsonb
$$;
set role authenticated;
do $$ begin
  begin perform * from public.ai_credit_refill_setups; raise exception 'Private saved card leaked'; exception when insufficient_privilege then null; end;
  begin perform public.prepare_ai_credit_refill_setup(public.fixture_refill_input()); raise exception 'Browser can forge consent'; exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
  begin perform public.prepare_ai_credit_refill_setup(public.fixture_refill_input()||'{"consent":false}'); raise exception 'Missing consent allowed';
    exception when raise_exception then if sqlerrm<>'Explicit refill consent is required' then raise; end if; end;
  begin perform public.prepare_ai_credit_refill_setup(public.fixture_refill_input()||'{"actorId":"00000000-0000-0000-0000-000000000002"}'); raise exception 'Staff configured billing'; exception when insufficient_privilege then null; end;
end $$;
select public.prepare_ai_credit_refill_setup(public.fixture_refill_input());
select public.prepare_ai_credit_refill_setup(public.fixture_refill_input());
select public.assert_ai((select count(*)=1 from public.ai_credit_refill_setups),'setup replay does not duplicate consent');
do $$ begin
  begin perform public.prepare_ai_credit_refill_setup(public.fixture_refill_input()||'{"threshold":null}'); raise exception 'Missing replay terms allowed';
    exception when raise_exception then if sqlerrm<>'Refill setup identity conflict' then raise; end if; end;
  begin update public.ai_credit_refill_setups set amount=1; raise exception 'Consent terms mutable';
    exception when raise_exception then if sqlerrm<>'Refill consent terms are immutable' then raise; end if; end;
  begin delete from public.ai_credit_refill_setups; raise exception 'Consent removable';
    exception when raise_exception then if sqlerrm<>'Refill consent terms are immutable' then raise; end if; end;
end $$;
select public.verify_ai_credit_refill_setup('{"id":"90000000-0000-4000-8000-000000000091","mode":"test","session":"cs_refill","customer":"cus_refill","paymentMethod":"pm_refill","label":"Visa 4242"}');
select public.assert_ai(public.prepare_next_ai_credit_refill('test','primary') is null,'reading an empty wallet does not initiate a charge');
create function public.fixture_refill_run(suffix integer) returns uuid language plpgsql as $$
declare run uuid:=('90000000-0000-4000-8000-'||lpad(suffix::text,12,'0'))::uuid; begin
  insert into public.workspace_ai_runs(id,org_id,actor_id,request_hash,task,target,prompt,tariff,max_credits,max_provider_microdollars)
    values(run,'90000000-0000-4000-8000-000000000090','90000000-0000-4000-8000-000000000090',repeat('a',64),'document','{}','fixture','{}',1,1);
  update public.workspace_ai_runs set settled_at=now(),charged_credits=1,provider_microdollars=1,status='succeeded',proposal='fixture' where id=run;
  return run;
end $$;
select public.fixture_refill_run(101);
select public.fixture_refill_run(102);
create temporary table refill_check as select public.prepare_next_ai_credit_refill('test','primary') value;
select public.assert_ai((value->'order'->>'amount')::int=1000,'server stores exact pack price') from refill_check;
select public.assert_ai(public.prepare_next_ai_credit_refill('test','primary') is null,'second event cannot create another pending refill');
select public.assert_ai((public.read_ai_credit_refill(public.fixture_refill_input())->>'used')::int=1000,'pending payment reserves cap');
select public.assert_ai(jsonb_array_length(public.read_ai_credit_purchases('90000000-0000-4000-8000-000000000090','90000000-0000-4000-8000-000000000090','test')->'orders')=0,'automatic orders do not become manual checkout');
do $$ begin
  begin perform public.prepare_ai_credit_purchase(gen_random_uuid(),'90000000-0000-4000-8000-000000000090','90000000-0000-4000-8000-000000000090','refill-fixture-v1','test','http://localhost:3008/workspace'); raise exception 'Automatic order reused for checkout';
    exception when raise_exception then if sqlerrm<>'Resolve the pending auto-refill before buying credits' then raise; end if; end;
end $$;
select public.assert_ai(public.start_ai_credit_refill_charge((value->'order'->>'id')::uuid),'claim queued charge once') from refill_check;
select public.assert_ai(not public.start_ai_credit_refill_charge((value->'order'->>'id')::uuid),'concurrent/replayed claim cannot charge again') from refill_check;
select public.record_ai_credit_refill_attempt(jsonb_build_object('id',value->'order'->>'id','state','uncertain','payment',null)) from refill_check;
select public.assert_ai(not public.start_ai_credit_refill_charge((value->'order'->>'id')::uuid),'uncertain payment never retries automatically') from refill_check;
select public.assert_ai(public.start_ai_credit_refill_charge((value->'order'->>'id')::uuid,'90000000-0000-4000-8000-000000000090'),'explicit owner retry keeps original order') from refill_check;
select public.record_ai_credit_refill_attempt(jsonb_build_object('id',value->'order'->>'id','state','uncertain','payment',null)) from refill_check;
update public.ai_credit_refill_attempts set started_at=now()-interval '2 hours';
select public.assert_ai(not public.start_ai_credit_refill_charge((value->'order'->>'id')::uuid,'90000000-0000-4000-8000-000000000090'),'old uncertain payment cannot mint another provider charge') from refill_check;
-- Pending charges carry into the next period rather than disappearing on expiry.
update public.ai_credit_purchase_orders set created_at=now()-interval '2 months',expires_at=now()-interval '2 months' where org_id='90000000-0000-4000-8000-000000000090';
select public.assert_ai((public.read_ai_credit_refill(public.fixture_refill_input())->>'used')::int=1000,'expired uncertain charge still reserves cap');
select public.record_ai_credit_refill_attempt(jsonb_build_object('id',value->'order'->>'id','state','succeeded','payment','pi_refill','mode','test','amount',1000,'currency','usd','customer','cus_refill','paymentMethod','pm_refill')) from refill_check;
select public.record_ai_credit_refill_attempt(jsonb_build_object('id',value->'order'->>'id','state','succeeded','payment','pi_refill','mode','test','amount',1000,'currency','usd','customer','cus_refill','paymentMethod','pm_refill')) from refill_check;
select public.assert_ai((select count(*)=1 from public.ai_credit_lots where operation_key='stripe-credit:test:pi_refill'),'success delivery grants exactly once');
select public.assert_ai(jsonb_array_length(public.read_ai_credit_purchases('90000000-0000-4000-8000-000000000090','90000000-0000-4000-8000-000000000090','test')->'orders')=1,'paid refill remains in purchase history');
-- Consume the fixture lot, restore consent, and prove the cap still blocks a refill.
insert into public.ai_credit_entries(run_id,lot_id,credits) select '90000000-0000-4000-8000-000000000101',id,100 from public.ai_credit_lots where operation_key='stripe-credit:test:pi_refill';
update public.ai_credit_refill_setups set status='enabled';
select public.fixture_refill_run(103);
select public.assert_ai(public.prepare_next_ai_credit_refill('test','primary') is null,'paid charge exhausts monthly cap');
select public.disable_ai_credit_refill(public.fixture_refill_input());
select public.assert_ai(not public.verify_ai_credit_refill_setup('{"id":"90000000-0000-4000-8000-000000000091","mode":"test","session":"cs_refill","customer":"cus_refill","paymentMethod":"pm_refill","label":"Visa 4242"}'),'late webhook cannot re-enable disabled consent');
-- A new period and newly consented setup provide two events for real concurrency checks.
update public.ai_credit_purchase_orders set paid_at=now()-interval '2 months' where payment_intent_id='pi_refill';
select public.prepare_ai_credit_refill_setup(public.fixture_refill_input()||'{"id":"90000000-0000-4000-8000-000000000092"}');
select public.verify_ai_credit_refill_setup('{"id":"90000000-0000-4000-8000-000000000092","mode":"test","session":"cs_refill_two","customer":"cus_refill","paymentMethod":"pm_refill","label":"Visa 4242"}');
select public.fixture_refill_run(104);
select public.fixture_refill_run(105);
