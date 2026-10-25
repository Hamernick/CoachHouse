do $$
declare org uuid:='00000000-0000-0000-0000-000000000004'; staff uuid:='00000000-0000-0000-0000-000000000002';
  current_usage integer; revision uuid; result jsonb; plan_target jsonb;
begin
  current_usage:=public.workspace_ai_monthly_usage(org);
  select limit_revision into revision from public.ai_credit_wallets where org_id=org;
  result:=public.set_ai_credit_limit(org,org,null,current_usage+30,revision,'72000000-0000-4000-8000-000000000001');
  perform public.assert_ai((result->'organization'->>'limit')::int=current_usage+30,'owner sets organization cap');
  perform public.set_ai_credit_limit(org,org,null,current_usage+30,revision,'72000000-0000-4000-8000-000000000001');
  perform public.assert_ai((select count(*)=1 from public.ai_credit_limit_changes where id='72000000-0000-4000-8000-000000000001'),'lost-response retry is idempotent');
  begin
    perform public.set_ai_credit_limit(org,org,null,999,revision,'72000000-0000-4000-8000-000000000002');
    raise exception 'stale limit accepted';
  exception when raise_exception then if sqlerrm not like 'Spending limit changed%' then raise; end if; end;
  begin
    perform public.set_ai_credit_limit(org,staff,null,999,null,'72000000-0000-4000-8000-000000000002');
    raise exception 'staff cap update accepted';
  exception when insufficient_privilege then null; end;
  begin
    perform public.set_ai_credit_limit(org,org,'00000000-0000-0000-0000-000000000003',999,null,'72000000-0000-4000-8000-000000000002');
    raise exception 'foreign member cap update accepted';
  exception when insufficient_privilege then null; end;
  perform public.reserve_workspace_ai_run('72000000-0000-4000-8000-000000000003',org,org,repeat('a',64),'{}','limit fixture','{}',20,80000);
  perform public.assert_ai(public.workspace_ai_monthly_usage(org)=current_usage+20,'pending worst case counts toward monthly cap');
  revision:=(result->'organization'->>'revision')::uuid;
  result:=public.set_ai_credit_limit(org,org,null,0,revision,'72000000-0000-4000-8000-000000000004');
  perform public.reserve_workspace_ai_run('72000000-0000-4000-8000-000000000003',org,org,repeat('a',64),'{}','limit fixture','{}',20,80000);
  begin
    perform public.reserve_workspace_ai_run('72000000-0000-4000-8000-000000000005',org,staff,repeat('a',64),'{}','limit fixture','{}',1,80000);
    raise exception 'zero wallet cap allowed request';
  exception when raise_exception then if sqlerrm<>'Organization monthly AI credit limit reached' then raise; end if; end;
  perform public.settle_workspace_ai_run('72000000-0000-4000-8000-000000000003','succeeded',12000,10,'<p>Completed</p>','{}','caps-result');
  perform public.assert_ai(public.workspace_ai_monthly_usage(org)=current_usage+10,'settlement replaces bound with actual even after limit lowered');
  revision:=(result->'organization'->>'revision')::uuid;
  result:=public.set_ai_credit_limit(org,org,null,null,revision,'72000000-0000-4000-8000-000000000006');
  perform public.set_ai_credit_limit(org,org,staff,0,null,'72000000-0000-4000-8000-000000000007');
  begin
    perform public.reserve_workspace_ai_run('72000000-0000-4000-8000-000000000008',org,staff,repeat('a',64),'{}','limit fixture','{}',1,80000);
    raise exception 'zero member cap allowed request';
  exception when raise_exception then if sqlerrm<>'Your monthly AI credit limit reached' then raise; end if; end;
  perform public.assert_ai(jsonb_array_length(public.read_ai_credit_limits(org,staff)->'members')=1,'staff sees only own member usage');
  perform public.assert_ai((public.read_ai_credit_limits(org,staff)->>'canManage')='false','staff has no management permission');
  -- Old completed work leaves the UTC calendar period; old pending work stays.
  update public.workspace_ai_runs set settled_at=(date_trunc('month',now() at time zone 'UTC') at time zone 'UTC')-interval '1 second'
    where id='72000000-0000-4000-8000-000000000003';
  perform public.assert_ai(public.workspace_ai_monthly_usage(org)=current_usage,'previous UTC month excluded');
  perform public.reserve_workspace_ai_run('72000000-0000-4000-8000-000000000013',org,org,repeat('a',64),'{}','old pending fixture','{}',10,80000);
  update public.workspace_ai_runs set created_at=(date_trunc('month',now() at time zone 'UTC') at time zone 'UTC')-interval '1 second'
    where id='72000000-0000-4000-8000-000000000013';
  perform public.assert_ai(public.workspace_ai_monthly_usage(org)=current_usage+10,'unsettled previous-month reservation still counts');
  perform public.settle_workspace_ai_run('72000000-0000-4000-8000-000000000013','failed',0,0,null,'{}',null);
  select l.revision into revision from public.ai_credit_member_limits l where org_id=org and member_id=staff;
  perform public.set_ai_credit_limit(org,org,staff,null,revision,'72000000-0000-4000-8000-000000000009');
  select limit_revision into revision from public.ai_credit_wallets where org_id=org;
  perform public.set_ai_credit_limit(org,org,null,current_usage+30,revision,'72000000-0000-4000-8000-000000000010');
  -- Plans reach the same admission wrapper, not the renamed service-only body.
  update public.ai_credit_wallets set monthly_credit_limit=0 where org_id='00000000-0000-0000-0000-000000000001';
  select jsonb_build_object('kind','plan','organizationId',org_id,'userId',org_id,'objectiveId',id,'revision',updated_at)
    into plan_target from public.organization_workspace_objectives where org_id='00000000-0000-0000-0000-000000000001' and kind='custom' and status<>'archived' limit 1;
  perform public.assert_ai(plan_target is not null,'plan cap fixture exists');
  begin
    perform public.reserve_workspace_ai_plan_run('72000000-0000-4000-8000-000000000011','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001',repeat('b',64),plan_target,'capped plan','{}',10,80000);
    raise exception 'plan bypassed organization cap';
  exception when raise_exception then if sqlerrm<>'Organization monthly AI credit limit reached' then raise; end if; end;
end $$;
set role service_role;
do $$ begin
  perform public.reserve_workspace_ai_run_service_limits('72000000-0000-4000-8000-000000000012','00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000004',repeat('a',64),'{}','bypass','{}',20,80000);
  raise exception 'server bypassed owner limits';
exception when insufficient_privilege then null; end $$;
reset role;
set role authenticated;
do $$ begin
  perform public.set_ai_credit_limit('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000004',null,999,null,'72000000-0000-4000-8000-000000000012');
  raise exception 'client spoofed owner';
exception when insufficient_privilege then null; end $$;
reset role;
