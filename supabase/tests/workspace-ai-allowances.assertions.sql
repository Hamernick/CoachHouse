reset role;
insert into public.ai_credit_allowance_rules(key,mode,price_id,label,credits,amount,currency,enabled)
values('monthly-fixture-v1','test','price_monthly','Fixture monthly',500,2000,'usd',true);
insert into public.subscriptions(user_id,stripe_subscription_id,stripe_customer_id,status,metadata) values
 ('00000000-0000-0000-0000-000000000001','sub_allowance_one','cus_allowance_one','active','{"stripe_mode":"test"}'),
 ('00000000-0000-0000-0000-000000000004','sub_allowance_four','cus_allowance_four','active','{"stripe_mode":"test"}');
set role service_role;
do $$ declare org uuid:='00000000-0000-0000-0000-000000000001'; staff uuid:='00000000-0000-0000-0000-000000000002';
  period_start timestamptz:=now()-interval '1 day'; period_end timestamptz:=now()+interval '29 days'; lot uuid; setup jsonb;
begin
  begin perform public.bind_ai_credit_subscription(org,staff,'test','sub_allowance_one','cus_allowance_one',gen_random_uuid()); raise exception 'staff assigned allowance'; exception when insufficient_privilege then null; end;
  begin perform public.bind_ai_credit_subscription(org,org,'test','sub_allowance_four','cus_allowance_four',gen_random_uuid()); raise exception 'payer spoof accepted';
    exception when raise_exception then if sqlerrm<>'Verified active subscription required' then raise; end if; end;
  begin perform public.bind_ai_credit_subscription(org,org,'live','sub_allowance_one','cus_allowance_one',gen_random_uuid()); raise exception 'mode spoof accepted';
    exception when raise_exception then if sqlerrm<>'Verified active subscription required' then raise; end if; end;
  perform public.bind_ai_credit_subscription(org,org,'test','sub_allowance_one','cus_allowance_one','75000000-0000-4000-8000-000000000001');
  perform public.bind_ai_credit_subscription(org,org,'test','sub_allowance_one','cus_allowance_one','75000000-0000-4000-8000-000000000001');
  lot:=public.grant_ai_credit_allowance('test','sub_allowance_one','cus_allowance_one','monthly-fixture-v1','in_allowance_one',period_start,period_end);
  perform public.assert_ai(lot=public.grant_ai_credit_allowance('test','sub_allowance_one','cus_allowance_one','monthly-fixture-v1','in_allowance_one',period_start,period_end),'period grant replay returns original lot');
  perform public.assert_ai(lot=public.grant_ai_credit_allowance('test','sub_allowance_one','cus_allowance_one','a-new-rule-version','in_allowance_one',period_start,period_end),'replay cannot reinterpret a grant after commercial policy changes');
  setup:=public.read_ai_credit_allowance_setup(org,org,'test');
  perform public.assert_ai(setup->'grant'->>'credits'='500' and setup->'grant'->>'label'='Fixture monthly','visible confirmed allowance');
  begin perform public.grant_ai_credit_allowance('test','sub_allowance_one','cus_wrong','monthly-fixture-v1','in_allowance_bad',period_start,period_end); raise exception 'customer spoof accepted';
    exception when raise_exception then if sqlerrm<>'Subscription assignment mismatch' then raise; end if; end;
  begin perform public.grant_ai_credit_allowance('test','sub_allowance_one','cus_allowance_one','monthly-fixture-v1','in_allowance_overlap',period_start+interval '1 hour',period_end+interval '1 hour'); raise exception 'overlap granted';
    exception when raise_exception then if sqlerrm<>'Overlapping allowance period' then raise; end if; end;
  begin perform public.grant_ai_credit_allowance('test','sub_allowance_one','cus_allowance_one','monthly-fixture-v1','in_allowance_annual',period_start,period_start+interval '1 year'); raise exception 'annual multiplied';
    exception when raise_exception then if sqlerrm<>'Only a current full monthly entitlement is supported' and sqlerrm<>'Allowance grant identity conflict' then raise; end if; end;
  begin perform public.bind_ai_credit_subscription(org,org,'test','sub_replacement','cus_allowance_one',gen_random_uuid()); raise exception 'subscription replaced implicitly';
    exception when raise_exception then if sqlerrm not like 'Subscription allowance already assigned%' then raise; end if; end;
  begin perform public.read_ai_credit_allowance_setup(org,staff,'test'); raise exception 'private payer details exposed'; exception when insufficient_privilege then null; end;
  begin update public.ai_credit_allowance_rules set credits=100000 where key='monthly-fixture-v1'; raise exception 'commercial terms overwritten'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select public.assert_ai((select count(*)=1 from public.ai_credit_allowance_grants where subscription_id='sub_allowance_one'),'only one period grant');
select public.assert_ai((select kind='included' and credits=500 and expires_at>now() from public.ai_credit_lots where operation_key='stripe-allowance:test:sub_allowance_one:in_allowance_one'),'expiring included lot');
do $$ begin
  begin update public.ai_credit_subscription_bindings set org_id='00000000-0000-0000-0000-000000000004'; raise exception 'binding changed'; exception when raise_exception then if sqlerrm not like '%immutable%' then raise; end if; end;
  begin delete from public.ai_credit_allowance_grants; raise exception 'grant deleted'; exception when raise_exception then if sqlerrm not like '%immutable%' then raise; end if; end;
end $$;
set role authenticated;
do $$ begin
  begin perform * from public.ai_credit_subscription_bindings; raise exception 'binding read directly'; exception when insufficient_privilege then null; end;
  begin perform public.grant_ai_credit_allowance('test','sub_allowance_one','cus_allowance_one','monthly-fixture-v1','in_fake',now(),now()+interval '1 month'); raise exception 'session granted'; exception when insufficient_privilege then null; end;
end $$;
reset role;
