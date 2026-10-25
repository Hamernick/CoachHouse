select public.assert_ai(not enabled,'disabled by default') from public.ai_credit_policy;
insert into public.ai_credit_wallets(org_id,enabled) values ('00000000-0000-0000-0000-000000000001',true);
insert into public.ai_credit_lots(id,org_id,operation_key,kind,credits,expires_at) values
  ('10000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000001','included/period-1','included',30,now()+interval '1 hour'),
  ('10000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000001','purchase/payment-1','purchased',50,null),
  ('10000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000001','expired','included',100,now()-interval '1 hour');

do $$ begin
  begin perform public.reserve_workspace_ai_run('20000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001',repeat('a',64),'{}','help','{}',40,80000);
    raise exception 'Expected disabled failure';
  exception when raise_exception then if sqlerrm<>'AI is not enabled for this organization' then raise; end if; end;
end $$;
update public.ai_credit_policy set enabled=true;

set role authenticated;
do $$ begin
  begin perform * from public.workspace_ai_runs; raise exception 'Private run leaked'; exception when insufficient_privilege then null; end;
  begin perform public.reserve_workspace_ai_run(gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),repeat('a',64),'{}','help','{}',1,1);
    raise exception 'Session could spend with forged actor'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set role service_role;
do $$ declare actor uuid; begin
  foreach actor in array array['00000000-0000-0000-0000-000000000003'::uuid,'00000000-0000-0000-0000-000000000004'::uuid] loop
    begin perform public.reserve_workspace_ai_run(gen_random_uuid(),'00000000-0000-0000-0000-000000000001',actor,repeat('a',64),'{}','help','{}',1,1);
      raise exception 'Viewer or cross-org admission allowed'; exception when insufficient_privilege then null; end;
  end loop;
end $$;
select public.reserve_workspace_ai_run('20000000-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001',repeat('a',64),'{}','help','{}',40,80000);
select public.assert_ai((select sum(credits)=30 from public.ai_credit_reservations where lot_id='10000000-0000-4000-8000-000000000001'),'included first');
select public.assert_ai((select sum(credits)=10 from public.ai_credit_reservations where lot_id='10000000-0000-4000-8000-000000000002'),'remainder purchased');
select public.assert_ai(not (public.reserve_workspace_ai_run('20000000-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001',repeat('a',64),'{}','help','{}',40,80000)->>'created')::boolean,'replay same request');
select public.assert_ai(public.claim_workspace_ai_run('20000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000001'),'claim once');
select public.assert_ai(not public.claim_workspace_ai_run('20000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000001'),'no duplicate provider claim');
do $$ begin
  begin perform public.reserve_workspace_ai_run(gen_random_uuid(),'00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002',repeat('b',64),'{}','help','{}',41,82000);
    raise exception 'Overspend allowed'; exception when raise_exception then if sqlerrm<>'Not enough AI credits' then raise; end if; end;
  begin perform public.reserve_workspace_ai_run(gen_random_uuid(),'00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001',repeat('b',64),'{}','help','{}',1,1);
    raise exception 'Parallel actor allowed'; exception when raise_exception then if sqlerrm<>'An AI request is already running' then raise; end if; end;
  begin perform public.reserve_workspace_ai_run('20000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001',repeat('b',64),'{}','help','{}',40,80000);
    raise exception 'Changed payload accepted'; exception when raise_exception then if sqlerrm<>'AI request identity conflict' then raise; end if; end;
end $$;
select public.settle_workspace_ai_run('20000000-0000-4000-8000-000000000001','succeeded',50000,25,'<p>Draft</p>','{}','response-1');
select public.settle_workspace_ai_run('20000000-0000-4000-8000-000000000001','succeeded',50000,25,'<p>Draft</p>','{}','response-1');
select public.assert_ai((select sum(credits)=25 from public.ai_credit_entries),'settle exactly once');
select public.assert_ai((select count(*)=1 from public.workspace_ai_runs),'failed reservations roll back');
select public.reserve_workspace_ai_run('20000000-0000-4000-8000-000000000002',
  '00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002',repeat('c',64),'{}','help','{}',55,110000);
select public.settle_workspace_ai_run('20000000-0000-4000-8000-000000000002','canceled',20000,0,null,'{}','response-2');
select public.assert_ai((select sum(credits)=25 from public.ai_credit_entries),'cancellation does not charge');
reset role;
select public.assert_ai((select sum(provider_microdollars)=70000 from public.workspace_ai_runs),'absorbed cancellation cost retained');
update public.ai_credit_policy set daily_provider_microdollars=70000;
do $$ begin
  begin perform public.reserve_workspace_ai_run(gen_random_uuid(),'00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001',repeat('d',64),'{}','help','{}',1,1);
    raise exception 'Provider budget ignored'; exception when raise_exception then if sqlerrm<>'AI daily service limit reached' then raise; end if; end;
  begin update public.ai_credit_entries set credits=1; raise exception 'Ledger mutable';
    exception when raise_exception then if sqlerrm<>'AI ledger history is immutable' then raise; end if; end;
  begin insert into public.ai_credit_lots(org_id,operation_key,kind,credits) values('00000000-0000-0000-0000-000000000001','purchase/payment-1','purchased',50);
    raise exception 'Duplicate payment credited'; exception when unique_violation then null; end;
end $$;
