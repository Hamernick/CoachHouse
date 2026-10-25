begin;
update public.ai_credit_policy set daily_provider_microdollars=10000000,user_daily_credits=5000;
insert into public.ai_credit_lots(org_id,operation_key,kind,credits)
  values('00000000-0000-0000-0000-000000000001','recovery-fixture','purchased',1000);
set local role authenticated;
do $$ begin
  begin perform public.recover_workspace_ai_runs(); raise exception 'Session could recover financial records'; exception when insufficient_privilege then null; end;
  begin perform * from public.workspace_ai_result_receipts; raise exception 'Receipt leaked'; exception when insufficient_privilege then null; end;
  begin perform public.resolve_workspace_ai_cost(gen_random_uuid(),gen_random_uuid(),null,0,null,'forged');
    raise exception 'Session could alter costs'; exception when insufficient_privilege then null; end;
end $$;
reset role;

-- Simulate a crash after receipt persistence but before settlement.
select public.reserve_workspace_ai_run('40000000-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001',repeat('a',64),'{}','help','{}',30,60000);
select public.claim_workspace_ai_run('40000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000001');
select public.correlate_workspace_ai_response('40000000-0000-4000-8000-000000000001','response-recovery-1');
select public.record_workspace_ai_result('40000000-0000-4000-8000-000000000001','succeeded',10000,5,'<p>Recovered draft</p>','{}','response-recovery-1');
select public.record_workspace_ai_result('40000000-0000-4000-8000-000000000001','succeeded',10000,5,'<p>Recovered draft</p>','{}','response-recovery-1');
select public.assert_ai(public.recover_workspace_ai_runs()=1,'one interrupted settlement recovered');
select public.assert_ai(public.recover_workspace_ai_runs()=0,'recovery replay does not settle twice');
select public.assert_ai(status='succeeded' and charged_credits=5 and proposal='<p>Recovered draft</p>', 'saved receipt completes the same request')
  from public.workspace_ai_runs where id='40000000-0000-4000-8000-000000000001';
do $$ begin
  begin perform public.record_workspace_ai_result('40000000-0000-4000-8000-000000000001','succeeded',10000,5,'Changed','{}','response-recovery-1');
    raise exception 'Changed receipt accepted'; exception when raise_exception then if sqlerrm<>'AI result identity conflict' then raise; end if; end;
  begin update public.workspace_ai_result_receipts set result='{}'; raise exception 'Receipt history mutable';
    exception when raise_exception then if sqlerrm<>'AI ledger history is immutable' then raise; end if; end;
end $$;

-- Never-claimed runs have no possible provider spend.
select public.reserve_workspace_ai_run('40000000-0000-4000-8000-000000000002',
  '00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001',repeat('b',64),'{}','help','{}',30,60000);
update public.workspace_ai_runs set created_at=now()-interval '16 minutes' where id='40000000-0000-4000-8000-000000000002';
select public.recover_workspace_ai_runs();
select public.assert_ai(status='failed' and charged_credits=0 and provider_microdollars=0 and provider_cost_state='measured','unclaimed timeout releases all cost')
  from public.workspace_ai_runs where id='40000000-0000-4000-8000-000000000002';
select public.assert_ai(not public.claim_workspace_ai_run('40000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000001'),'released run cannot start provider work');

-- Claimed runs without usage release customer credit, but keep a conservative
-- provider budget hold even across calendar days.
select public.reserve_workspace_ai_run('40000000-0000-4000-8000-000000000003',
  '00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001',repeat('c',64),'{}','help','{}',30,60000);
select public.claim_workspace_ai_run('40000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000001');
select public.correlate_workspace_ai_response('40000000-0000-4000-8000-000000000003','response-late');
update public.workspace_ai_runs set created_at=now()-interval '16 minutes' where id='40000000-0000-4000-8000-000000000003';
select public.recover_workspace_ai_runs();
select public.assert_ai(status='failed' and charged_credits=0 and provider_cost_state='unconfirmed' and provider_microdollars=60000,'unknown cost is bounded, not invented as measured')
  from public.workspace_ai_runs where id='40000000-0000-4000-8000-000000000003';
update public.workspace_ai_runs set settled_at=now()-interval '2 days';
update public.ai_credit_policy set daily_provider_microdollars=60000;
do $$ begin
  begin perform public.reserve_workspace_ai_run(gen_random_uuid(),'00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001',repeat('a',64),'{}','help','{}',1,1);
    raise exception 'Unconfirmed cost lost after midnight'; exception when raise_exception then if sqlerrm<>'AI daily service limit reached' then raise; end if; end;
end $$;
-- A late terminal receipt resolves actual cost without retroactive charges.
select public.record_workspace_ai_result('40000000-0000-4000-8000-000000000003','succeeded',14000,7,'<p>Too late</p>','{}','response-late');
select public.recover_workspace_ai_runs();
select public.assert_ai(status='failed' and charged_credits=0 and proposal is null and provider_cost_state='measured' and provider_microdollars=14000,'late receipt never charges the released customer')
  from public.workspace_ai_runs where id='40000000-0000-4000-8000-000000000003';
select public.assert_ai((select count(*)=1 from public.workspace_ai_cost_resolutions where run_id='40000000-0000-4000-8000-000000000003'),'resolution is audited once');
select public.assert_ai(public.recover_workspace_ai_runs()=0,'late receipt resolution replay is inert');

-- Historical allocation expired after admission: retain its reservation in
-- account presentation, without making expired credits spendable.
insert into public.ai_credit_lots(id,org_id,operation_key,kind,credits,expires_at)
  values('50000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000001','expired-inflight','included',10,now()-interval '1 minute');
insert into public.workspace_ai_runs(id,org_id,actor_id,request_hash,task,target,prompt,tariff,max_credits,max_provider_microdollars,status,created_at)
  values('40000000-0000-4000-8000-000000000004','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001',repeat('d',64),'document','{}','help','{}',10,20000,'running',now()-interval '2 minutes');
insert into public.ai_credit_reservations values('40000000-0000-4000-8000-000000000004','50000000-0000-4000-8000-000000000001',10);
select public.assert_ai(exists(select 1 from jsonb_array_elements(public.read_workspace_ai_account('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001')->'lots') l
  where (l->>'expired')::boolean and (l->>'reserved')::int=10),'expired in-flight reservation stays visible');

update public.ai_credit_policy set user_hourly_runs=1;
do $$ begin
  begin perform public.reserve_workspace_ai_run(gen_random_uuid(),'00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002',repeat('f',64),'{}','help','{}',1,1);
    raise exception 'Hourly cancellation abuse limit ignored'; exception when raise_exception then if sqlerrm<>'AI hourly request limit reached' then raise; end if; end;
end $$;
update public.ai_credit_policy set user_hourly_runs=30,daily_provider_microdollars=10000000;
select public.reserve_workspace_ai_run('40000000-0000-4000-8000-000000000005',
  '00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002',repeat('e',64),'{}','help','{}',30,60000);
select public.claim_workspace_ai_run('40000000-0000-4000-8000-000000000005','00000000-0000-0000-0000-000000000002');
select public.correlate_workspace_ai_response('40000000-0000-4000-8000-000000000005','response-support-proof');
update public.workspace_ai_runs set created_at=now()-interval '16 minutes' where id='40000000-0000-4000-8000-000000000005';
select public.recover_workspace_ai_runs();
select public.resolve_workspace_ai_cost('40000000-0000-4000-8000-000000000005','60000000-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000001',65000,'response-support-proof','Fixture provider cost confirmation');
select public.resolve_workspace_ai_cost('40000000-0000-4000-8000-000000000005','60000000-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000001',65000,'response-support-proof','Fixture provider cost confirmation');
select public.assert_ai(not enabled,'unexpected verified overrun stops further admission') from public.ai_credit_policy;
select public.assert_ai(charged_credits=0 and provider_microdollars=65000,'provider adjustment cannot retroactively charge customer')
  from public.workspace_ai_runs where id='40000000-0000-4000-8000-000000000005';
do $$ begin
  begin perform public.resolve_workspace_ai_cost('40000000-0000-4000-8000-000000000005','60000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000001',0,'response-support-proof','Fixture provider cost confirmation');
    raise exception 'Changed resolution accepted'; exception when raise_exception then if sqlerrm<>'AI resolution identity conflict' then raise; end if; end;
end $$;
rollback;
