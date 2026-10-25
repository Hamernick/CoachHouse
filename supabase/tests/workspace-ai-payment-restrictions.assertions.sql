update public.ai_credit_wallets set monthly_credit_limit=null where org_id='00000000-0000-0000-0000-000000000004';
select public.settle_workspace_ai_run(id,'failed',0,0,null,'{}',null) from public.workspace_ai_runs
  where org_id='00000000-0000-0000-0000-000000000004' and settled_at is null;
do $$
declare org uuid:='00000000-0000-0000-0000-000000000004'; first_order uuid:='71000000-0000-4000-8000-000000000001';
  second_order uuid:='71000000-0000-4000-8000-000000000002'; third_order uuid:='73000000-0000-4000-8000-000000000003'; lot uuid; charged integer;
begin
  perform public.record_ai_credit_payment_restriction(first_order,'pi_fixture','test','refund','re_partial','pending',250,'usd','refund-pending',10);
  perform public.record_ai_credit_payment_restriction(first_order,'pi_fixture','test','refund','re_partial','pending',250,'usd','refund-pending',10);
  perform public.assert_ai((select count(*)=1 from public.ai_credit_payment_adjustments where operation_key='refund-pending'),'replayed adjustment recorded once');
  select lot_id into lot from public.ai_credit_purchase_orders where id=first_order;
  perform public.assert_ai(public.ai_credit_lot_restricted(lot),'pending refund freezes affected lot');
  perform public.assert_ai(public.ai_credit_purchase_payment_issue(first_order)='refund_pending','pending is not described as refunded');
  perform public.assert_ai((public.read_workspace_ai_account(org,org)->>'paymentReview')='true','payment review is visible independently of remaining balance');
  perform public.record_ai_credit_payment_restriction(first_order,'pi_fixture','test','refund','re_partial','succeeded',250,'usd','refund-confirmed',20);
  perform public.record_ai_credit_payment_restriction(first_order,'pi_fixture','test','refund','re_partial','failed',250,'usd','late-refund-failed',5);
  perform public.assert_ai(public.ai_credit_purchase_payment_issue(first_order)='partially_refunded','partial refund remains held for review');
  perform public.assert_ai((select not applied from public.ai_credit_payment_adjustments where operation_key='late-refund-failed'),'stale failed event cannot undo confirmed refund');
  perform public.record_ai_credit_payment_restriction(second_order,'pi_race','test','dispute','du_fixture','under_review',1000,'usd','dispute-open',10);
  perform public.record_ai_credit_payment_restriction(second_order,'pi_race','test','dispute','du_fixture','won',1000,'usd','dispute-won',20);
  perform public.record_ai_credit_payment_restriction(second_order,'pi_race','test','dispute','du_fixture','under_review',1000,'usd','dispute-delayed',5);
  perform public.assert_ai((select not public.ai_credit_lot_restricted(lot_id) from public.ai_credit_purchase_orders where id=second_order),'won dispute releases only its own lot');
  perform public.assert_ai(public.ai_credit_lot_restricted(lot),'unrelated refund hold remains');
  begin
    perform public.record_ai_credit_payment_restriction(first_order,'pi_other','test','refund','re_injected','succeeded',1000,'usd','wrong-payment',30);
    raise exception 'wrong payment accepted';
  exception when raise_exception then if sqlerrm<>'Payment restriction identity mismatch' then raise; end if; end;
  begin
    perform public.record_ai_credit_payment_restriction(first_order,'pi_fixture','live','refund','re_injected','succeeded',1000,'usd','wrong-mode',30);
    raise exception 'wrong mode accepted';
  exception when raise_exception then if sqlerrm<>'Payment restriction identity mismatch' then raise; end if; end;
  -- A reversed payment can arrive before its checkout fulfillment. The later
  -- grant is recorded once for reconciliation but is never spendable.
  perform public.prepare_ai_credit_purchase(third_order,org,org,'fixture-test-v1','test','http://localhost:3008/workspace');
  perform public.record_ai_credit_payment_restriction(third_order,'pi_before','test','refund','re_before','succeeded',1000,'usd','refund-before-checkout',30);
  perform public.fulfill_ai_credit_purchase(third_order,'cs_before','pi_before','test',1000,'usd');
  perform public.fulfill_ai_credit_purchase(third_order,'cs_before','pi_before','test',1000,'usd');
  perform public.assert_ai((select public.ai_credit_lot_restricted(lot_id) from public.ai_credit_purchase_orders where id=third_order),'later checkout cannot restore refunded credits');
  perform public.assert_ai(public.ai_credit_purchase_payment_issue(third_order)='refunded','full refund shown only after confirmation');
  perform public.reserve_workspace_ai_run('73000000-0000-4000-8000-000000000004',org,org,repeat('c',64),'{}','restriction fixture','{}',125,80000);
  perform public.assert_ai(not exists(select 1 from public.ai_credit_reservations where run_id='73000000-0000-4000-8000-000000000004' and public.ai_credit_lot_restricted(lot_id)),'admission excludes restricted lots');
  perform public.record_ai_credit_payment_restriction(second_order,'pi_race','test','dispute','du_lost','lost',1000,'usd','dispute-lost',30);
  perform public.settle_workspace_ai_run('73000000-0000-4000-8000-000000000004','succeeded',12000,100,'<p>Already admitted</p>','{}','restricted-result');
  perform public.record_ai_credit_payment_restriction(second_order,'pi_race','test','dispute','du_lost','lost',1000,'usd','dispute-review',31);
  perform public.assert_ai((select consumed_credits_for_review>0 from public.ai_credit_payment_adjustments where operation_key='dispute-review'),'consumed disputed credits recorded for review without creating debt');
  select sum(credits) into charged from public.ai_credit_entries where run_id='73000000-0000-4000-8000-000000000004';
  perform public.assert_ai(charged=100,'in-flight settlement keeps original allocation and charge');
  begin
    perform public.reserve_workspace_ai_run('73000000-0000-4000-8000-000000000005',org,org,repeat('c',64),'{}','blocked','{}',1,80000);
    raise exception 'restricted credits spent';
  exception when raise_exception then if sqlerrm<>'Not enough AI credits' then raise; end if; end;
  perform public.assert_ai((select count(*)=1 from public.ai_credit_lots where operation_key='stripe-credit:test:pi_before'),'late/replayed checkout never issues extra credit');
  perform public.record_ai_credit_payment_restriction(second_order,'pi_race','test','verification','evt_verify','pending',0,'usd','verify-pending',40);
  perform public.record_ai_credit_payment_restriction(second_order,'pi_race','test','verification','evt_verify','resolved',0,'usd','verify-resolved',40);
  perform public.assert_ai(public.ai_credit_purchase_payment_issue(second_order)='disputed','successful verification cannot release a real dispute');
  begin
    update public.ai_credit_payment_adjustments set amount=0 where operation_key='refund-confirmed';
    raise exception 'journal was editable';
  exception when raise_exception then if position('immutable' in sqlerrm)=0 then raise; end if; end;
end $$;
set role authenticated;
do $$ begin
  perform public.record_ai_credit_payment_restriction('71000000-0000-4000-8000-000000000001','pi_fixture','test','refund','re_partial','failed',250,'usd','client-release',50);
  raise exception 'client released restriction';
exception when insufficient_privilege then null; end $$;
do $$ begin
  perform * from public.ai_credit_payment_adjustments;
  raise exception 'client read private adjustment ledger';
exception when insufficient_privilege then null; end $$;
reset role;
