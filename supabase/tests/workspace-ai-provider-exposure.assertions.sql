-- Synthetic safety budgets only; no production allowance/pricing recommendation.
insert into public.profiles(id) select ('e1000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid from generate_series(1,3) n;
insert into auth.users(id) select id from public.profiles where id::text like 'e1000000-%';
insert into public.organizations(user_id) select id from public.profiles where id::text like 'e1000000-%' and right(id::text,1) in ('1','2');
insert into public.organization_memberships(org_id,member_id,role) values ('e1000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000003','staff');
insert into public.ai_credit_wallets(org_id,enabled) select user_id,true from public.organizations where user_id::text like 'e1000000-%';
insert into public.ai_credit_lots(org_id,operation_key,kind,credits) select org_id,'exposure-fixture:'||org_id,'purchased',10000 from public.ai_credit_wallets where org_id::text like 'e1000000-%';

create function public.fixture_provider_reserve(p_id integer,p_org integer default 1,p_actor integer default 1,p_cost integer default 80000)
returns jsonb language sql as $$
  select public.reserve_workspace_ai_run(('e2000000-0000-4000-8000-'||lpad(p_id::text,12,'0'))::uuid,
    ('e1000000-0000-4000-8000-'||lpad(p_org::text,12,'0'))::uuid,
    ('e1000000-0000-4000-8000-'||lpad(p_actor::text,12,'0'))::uuid,
    repeat('a',64),'{}','Expense fixture','{}',10,p_cost)
$$;
create function public.fixture_provider_denied(p_id integer,p_message text,p_cost integer default 80000)
returns void language plpgsql as $$ begin
  begin
    perform public.fixture_provider_reserve(p_id,1,1,p_cost);
    raise exception 'Missing provider exposure denial';
  exception when raise_exception then if sqlerrm<>p_message then raise; end if; end;
  perform public.assert_ai(not exists(select 1 from public.workspace_ai_runs where id=('e2000000-0000-4000-8000-'||lpad(p_id::text,12,'0'))::uuid),'denial leaves no run or reservation');
end $$;

begin;
update public.ai_credit_policy set enabled=true,org_daily_provider_microdollars=null,daily_provider_microdollars=1000000000,user_daily_credits=100000,user_hourly_runs=100000;
select public.fixture_provider_denied(1,'AI provider safety limits are not configured');
update public.ai_credit_policy set org_daily_provider_microdollars=100000;
select public.fixture_provider_reserve(1,1,1,40000);
select public.claim_workspace_ai_run('e2000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000001');
select public.settle_workspace_ai_run('e2000000-0000-4000-8000-000000000001','failed',40000,0,null,'{}',null);
select public.fixture_provider_reserve(2,1,1,40000);
select public.claim_workspace_ai_run('e2000000-0000-4000-8000-000000000002','e1000000-0000-4000-8000-000000000001');
select public.cancel_workspace_ai_run('e2000000-0000-4000-8000-000000000002','e1000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000001');
select public.settle_workspace_ai_run('e2000000-0000-4000-8000-000000000002','succeeded',40000,5,'unused','{}',null);
select public.settle_workspace_ai_run('e2000000-0000-4000-8000-000000000002','succeeded',40000,5,'unused','{}',null);
select public.assert_ai((select sum(charged_credits)=0 and sum(provider_microdollars)=80000 from public.workspace_ai_runs where org_id='e1000000-0000-4000-8000-000000000001'),'failed/canceled expenses retained once with zero customer charge');
select public.assert_ai(not exists(select 1 from public.ai_credit_entries e join public.workspace_ai_runs r on r.id=e.run_id where r.org_id='e1000000-0000-4000-8000-000000000001'),'failed/canceled runs consume no customer credits');
select public.fixture_provider_denied(3,'Organization daily AI service limit reached',30000);
-- More purchased credits and removed customer limits cannot release service expense.
insert into public.ai_credit_lots(org_id,operation_key,kind,credits) values('e1000000-0000-4000-8000-000000000001','expense-topup', 'purchased',10000);
select public.fixture_provider_denied(3,'Organization daily AI service limit reached',30000);
select public.fixture_provider_reserve(3,1,1,20000);
select public.assert_ai(public.workspace_ai_provider_exposure('e1000000-0000-4000-8000-000000000001')=100000,'exact limit includes outstanding reservation');
-- Lowered/unconfigured limits still allow original replay, never identity substitution.
update public.ai_credit_policy set org_daily_provider_microdollars=null;
select public.assert_ai(not (public.fixture_provider_reserve(3,1,1,20000)->>'created')::boolean,'replay works with missing configuration');
do $$ begin
  begin
    perform public.reserve_workspace_ai_run('e2000000-0000-4000-8000-000000000003','e1000000-0000-4000-8000-000000000002','e1000000-0000-4000-8000-000000000002',repeat('a',64),'{}','forged replay','{}',10,20000);
    raise exception 'Foreign replay accepted';
  exception when raise_exception then if sqlerrm<>'AI request identity conflict' then raise; end if; end;
end $$;
update public.ai_credit_policy set org_daily_provider_microdollars=100000;
select public.settle_workspace_ai_run('e2000000-0000-4000-8000-000000000003','failed',0,0,null,'{}',null);
-- Move fixture timestamps to yesterday; neither session timezone nor creation
-- time decides whether today's measured settlement is charged to this window.
update public.workspace_ai_runs set settled_at=(date_trunc('day',now() at time zone 'UTC') at time zone 'UTC')-interval '1 second' where org_id='e1000000-0000-4000-8000-000000000001';
set local timezone='Pacific/Honolulu';
select public.assert_ai(public.workspace_ai_provider_exposure('e1000000-0000-4000-8000-000000000001')=0,'known prior UTC-day costs expire');
update public.workspace_ai_runs set provider_cost_state='unconfirmed',provider_microdollars=1 where id='e2000000-0000-4000-8000-000000000001';
select public.fixture_provider_reserve(4,1,1,60000);
update public.workspace_ai_runs set created_at=now()-interval '3 days' where id='e2000000-0000-4000-8000-000000000004';
select public.assert_ai(public.workspace_ai_provider_exposure('e1000000-0000-4000-8000-000000000001')=100000,'uncertain and unfinished exposure survive rollover at maximum bound');
select public.fixture_provider_denied(5,'Organization daily AI service limit reached',1);
select public.resolve_workspace_ai_cost('e2000000-0000-4000-8000-000000000001','e3000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000001',10000,null,'fixture-confirmed-cost');
select public.assert_ai(public.workspace_ai_provider_exposure('e1000000-0000-4000-8000-000000000001')=70000,'authorized cost resolution releases only proven unused exposure');
select public.assert_ai((select charged_credits=0 from public.workspace_ai_runs where id='e2000000-0000-4000-8000-000000000001'),'resolution never charges failed customer run');
select public.fixture_provider_reserve(5,1,3,30000);
select public.assert_ai(public.workspace_ai_provider_exposure('e1000000-0000-4000-8000-000000000001')=100000,'remaining capacity shared across members');
select public.fixture_provider_reserve(6,2,2,80000);
select public.assert_ai(public.workspace_ai_provider_exposure('e1000000-0000-4000-8000-000000000002')=80000,'organization costs are isolated');
-- The global cap includes uncertain historic costs, regardless of customer charges.
update public.ai_credit_policy set daily_provider_microdollars=public.workspace_ai_provider_exposure(null)::bigint;
update public.ai_credit_policy set org_daily_provider_microdollars=1000000;
select public.fixture_provider_denied(7,'AI daily service limit reached',1);
rollback;

select public.assert_ai(not has_function_privilege('anon','public.reserve_workspace_ai_run(uuid,uuid,uuid,text,jsonb,text,jsonb,integer,integer)','EXECUTE'),'anonymous cannot admit spending');
select public.assert_ai(not has_function_privilege('authenticated','public.reserve_workspace_ai_run(uuid,uuid,uuid,text,jsonb,text,jsonb,integer,integer)','EXECUTE'),'browser cannot forge spending actor');
select public.assert_ai(not has_function_privilege('authenticated','public.workspace_ai_provider_exposure(uuid)','EXECUTE'),'private service costs not exposed to browser');
select public.assert_ai(not has_function_privilege('service_role','public.workspace_ai_provider_exposure(uuid)','EXECUTE'),'projection is internal to admission');
select public.assert_ai(not has_function_privilege('service_role','public.reserve_workspace_ai_run_service_limits(uuid,uuid,uuid,text,jsonb,text,jsonb,integer,integer)','EXECUTE'),'trusted client cannot bypass organization safety cap');
