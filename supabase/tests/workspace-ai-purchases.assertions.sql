update public.ai_credit_policy set enabled=true;
update public.ai_credit_wallets set enabled=true where org_id='00000000-0000-0000-0000-000000000004';
insert into public.ai_credit_packs(key,mode,price_id,credits,amount,currency,enabled)
  values('fixture-test-v1','test','price_fixture',1000,1000,'usd',true),('fixture-disabled','test','price_disabled',10,100,'usd',false);

set role service_role;
select public.assert_ai((public.read_ai_credit_purchases('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000002','test')->>'canPurchase')='false','staff may consume but cannot purchase');
do $$ begin
  perform public.prepare_ai_credit_purchase('71000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000002','fixture-test-v1','test','http://localhost:3008/workspace');
  raise exception 'staff purchase accepted';
exception when insufficient_privilege then null; end $$;
select public.assert_ai(jsonb_array_length(public.read_ai_credit_purchases('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000004','test')->'packs')=1,'only enabled packs offered');
select public.assert_ai(jsonb_array_length(public.read_ai_credit_purchases('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000004','live')->'packs')=0,'test packs never offered in live mode');
select public.prepare_ai_credit_purchase('71000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000004','fixture-test-v1','test','http://localhost:3008/workspace');
select public.assert_ai((public.prepare_ai_credit_purchase('71000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000004','fixture-test-v1','test','http://localhost:3008/workspace')->>'id')='71000000-0000-4000-8000-000000000001','another tab reuses pending checkout');
select public.bind_ai_credit_checkout('71000000-0000-4000-8000-000000000001','cs_fixture');
do $$ begin
  perform public.fulfill_ai_credit_purchase('71000000-0000-4000-8000-000000000001','cs_fixture','pi_fixture','live',1000,'usd');
  raise exception 'mismatched payment mode accepted';
exception when raise_exception then if sqlerrm<>'Payment does not match purchase' then raise; end if; end $$;
do $$ begin
  perform public.fulfill_ai_credit_purchase('71000000-0000-4000-8000-000000000001','cs_fixture','pi_fixture','test',100,'usd');
  raise exception 'mismatched payment amount accepted';
exception when raise_exception then if sqlerrm<>'Payment does not match purchase' then raise; end if; end $$;
select public.fulfill_ai_credit_purchase('71000000-0000-4000-8000-000000000001','cs_fixture','pi_fixture','test',1000,'usd');
select public.fulfill_ai_credit_purchase('71000000-0000-4000-8000-000000000001','cs_fixture','pi_fixture','test',1000,'usd');
select public.assert_ai((public.read_ai_credit_purchases('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000004','test')->'orders'->0->>'status')='paid','verified payment shown as credited');
select public.prepare_ai_credit_purchase('71000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000004','fixture-test-v1','test','http://localhost:3008/workspace');
do $$ begin
  perform public.fulfill_ai_credit_purchase('71000000-0000-4000-8000-000000000002','cs_other','pi_fixture','test',1000,'usd');
  raise exception 'same payment granted twice';
exception when unique_violation then null; end $$;
do $$ begin
  update public.ai_credit_packs set credits=999999 where key='fixture-test-v1';
  raise exception 'commercial terms changed in place';
exception when insufficient_privilege then null; end $$;
reset role;
select public.assert_ai((select count(*)=1 and sum(credits)=1000 from public.ai_credit_lots where operation_key='stripe-credit:test:pi_fixture'),'duplicate delivery credits exactly once');
select public.assert_ai((select org_id='00000000-0000-0000-0000-000000000004' and expires_at is null from public.ai_credit_lots where operation_key='stripe-credit:test:pi_fixture'),'purchased balance belongs to bound org and does not expire');
select public.assert_ai((select paid_at is null from public.ai_credit_purchase_orders where id='71000000-0000-4000-8000-000000000002'),'duplicate payment rolls back order');
set role authenticated;
do $$ begin
  perform public.fulfill_ai_credit_purchase('71000000-0000-4000-8000-000000000002','cs_injected','pi_injected','test',1000,'usd');
  raise exception 'client fulfillment accepted';
exception when insufficient_privilege then null; end $$;
do $$ begin
  perform * from public.ai_credit_purchase_orders;
  raise exception 'client read private orders';
exception when insufficient_privilege then null; end $$;
reset role;
