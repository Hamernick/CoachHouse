-- Owned disposable schema with310000 and380000; all rows roll back.
do $$begin if current_database() not like 'ch_c3_ai_%' or current_setting('coach_house.ai_cleanup_fixture',true) is distinct from 'isolated-test-only' then raise exception 'Owned AI cleanup fixture required';end if;end$$;
begin;
create function public.c3_ai_assert(ok boolean,message text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'Assertion failed: %',message;end if;end$$;
create function public.c3_ai_error(command text,expected text) returns void language plpgsql as $$begin begin execute command;exception when others then if sqlstate=expected then return;end if;raise exception 'Expected %, got %: %',expected,sqlstate,sqlerrm;end;raise exception 'Unexpected success: %',command;end$$;
\set org 'e972bc07-fbf5-4fc8-a416-7f00910a71e2'
\set other 'b80a076c-8ab7-4e16-90b7-98bdcbb09382'
\set closure 'b8000000-0000-4000-8000-000000000090'
\set operation 'b8000000-0000-4000-8000-000000000091'
\set first 'b8000000-0000-4000-8000-000000000001'
\set second 'b8000000-0000-4000-8000-000000000002'
\set no_receipt 'b8000000-0000-4000-8000-000000000055'
\set tariff '{"version":"fixture-v1","model":"fixture-model","inputMicrodollarsPerMillion":1,"cachedMicrodollarsPerMillion":0,"outputMicrodollarsPerMillion":2,"microdollarsPerCredit":1,"webSearchMicrodollarsPerCall":3,"raw":"RAW_TARIFF"}'
\set usage '{"input":1,"cachedInput":0,"output":2,"webSearchCalls":0,"providerBody":"RAW_USAGE"}'
set local request.jwt.claim.role='service_role';
select public.c3_ai_assert(not exists(select 1 from public.workspace_ai_runs where org_id=:'org'),'isolated owner has no preexisting runs');
insert into public.ai_credit_policy(id) values(true) on conflict do nothing;
insert into public.ai_credit_wallets(org_id) values(:'org'),(:'other') on conflict do nothing;
insert into public.ai_credit_lots(id,org_id,operation_key,kind,credits) values('b8000000-0000-4000-8000-000000000060',:'org','c3-fixture-ledger','adjustment',10);
insert into public.workspace_ai_runs(id,org_id,actor_id,request_hash,task,target,prompt,tariff,max_credits,max_provider_microdollars,status,provider_response_id)
select ('b8000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,:'org',:'org',repeat('a',64),'plan','{"body":"RAW_TARGET"}','RAW_PROMPT',:'tariff',5,100,'running','fixture-response-'||n from generate_series(1,55)n;
insert into public.ai_credit_reservations(run_id,lot_id,credits) values(:'first','b8000000-0000-4000-8000-000000000060',5);
select public.record_workspace_ai_result(id,'succeeded',3,case when id=:'first' then 2 else 0 end,'RAW_PROPOSAL',:'usage',provider_response_id) from public.workspace_ai_runs where org_id=:'org' and id<>:'no_receipt';
select count(public.settle_recorded_workspace_ai_run(id)) from public.workspace_ai_runs where org_id=:'org' and id<>:'no_receipt';
select (public.settle_workspace_ai_run(:'no_receipt','failed',0,0,null,null,'fixture-response-55')->>'status')='failed';
insert into public.workspace_ai_runs(id,org_id,actor_id,request_hash,task,target,prompt,tariff,max_credits,max_provider_microdollars,status,provider_cost_state,provider_microdollars,charged_credits,proposal,usage,settled_at)
values('b8000000-0000-4000-8000-000000000056',:'other',:'other',repeat('b',64),'document','{"body":"FOREIGN_RAW"}','FOREIGN_RAW',:'tariff',5,100,'succeeded','measured',3,0,'FOREIGN_RAW',:'usage',clock_timestamp());
insert into public.workspace_ai_plan_applications(run_id,plan_id,step_snapshots,before_draft,applied_revision)
values(:'first','b8000000-0000-4000-8000-000000000061','{"b8000000-0000-4000-8000-000000000062":"2026-11-01T00:00:00Z"}','{"body":"RAW_BEFORE_DRAFT"}',1);
insert into public.workspace_ai_document_applications(run_id,section_id,saved_revision,content_hash) values(:'second','origin_story','fixed-revision',repeat('c',64));
insert into public.workspace_ai_research_calls(run_id,response_id) values(:'first','fixture-response-1');
insert into public.workspace_research_drafts(run_id,base_hash,draft) values(:'second',repeat('d',64),'{"body":"RAW_RECOVERY_DRAFT"}');
insert into public.ai_credit_packs(key,mode,price_id,credits,amount,currency) values('c3-private-fixture','test','price_c3_private_fixture',10,100,'usd');
insert into public.ai_credit_refill_setups(id,org_id,actor_id,mode,runtime_target,pack_key,price_id,credits,amount,currency,threshold,monthly_cap,consent_version,return_url)
values('b8000000-0000-4000-8000-000000000063',:'org',:'org','test','tester','c3-private-fixture','price_c3_private_fixture',10,100,'usd',1,100,'refill-v1','http://localhost:3148');
insert into public.ai_credit_purchase_orders(id,org_id,actor_id,pack_key,mode,price_id,credits,amount,currency,return_url)
values('b8000000-0000-4000-8000-000000000064',:'org',:'org','c3-private-fixture','test','price_c3_private_fixture',10,100,'usd','http://localhost:3148');
insert into public.ai_credit_refill_attempts(id,setup_id,run_id,state)
values('b8000000-0000-4000-8000-000000000064','b8000000-0000-4000-8000-000000000063',:'first','processing');
select public.c3_ai_error($q$select public.ai_retained_tariff('{"version":"v1","model":"model","inputMicrodollarsPerMillion":"RAW"}')$q$,'42501');
select public.c3_ai_error($q$select public.ai_retained_usage('{"input":"RAW"}')$q$,'42501');
select public.c3_ai_assert(public.ai_retained_usage('null') is null,'legacy null usage preserved');
insert into public.organization_closures(org_id,state,revision,request_id,requested_at,export_until)
values(:'org','closing',1,:'closure',statement_timestamp()-interval '31 days',statement_timestamp()-interval '31 days'+interval '720 hours');
insert into public.organization_closure_operations(org_id,operation_id,action,expected_revision,completed_at)
select org_id,request_id,'request',0,requested_at from public.organization_closures where org_id=:'org';
select public.c3_ai_error(format('select public.purge_expired_organization_ai_content(%L,%L,1,%L)',:'org',:'closure',:'operation'),'42501');
-- Fixture-only terminal provider evidence: no cleanup command changes this state.
update public.ai_credit_refill_attempts set state='failed' where run_id=:'first';
select public.c3_ai_error(format('select public.purge_expired_organization_ai_content(%L,%L,1,%L)',:'org',:'closure',:'operation'),'42501');
select public.purge_expired_organization_research_drafts(:'org',:'closure',1,'b8000000-0000-4000-8000-000000000065');
savepoint uncertain;
update public.workspace_ai_runs set provider_cost_state='unconfirmed' where id=:'second';
select public.c3_ai_error(format('select public.purge_expired_organization_ai_content(%L,%L,1,%L)',:'org',:'closure',:'operation'),'42501');
rollback to uncertain;release uncertain;
savepoint active_run;
update public.workspace_ai_runs set status='reconciling' where id=:'second';
select public.c3_ai_error(format('select public.purge_expired_organization_ai_content(%L,%L,1,%L)',:'org',:'closure',:'operation'),'42501');
rollback to active_run;release active_run;
savepoint evidence;
insert into public.workspace_ai_cost_resolutions(operation_id,run_id,evidence,previous_bound,measured_cost) values('b8000000-0000-4000-8000-000000000066',:'second','RAW_PROVIDER_BODY masquerading as evidence',3,3);
select public.c3_ai_error(format('select public.purge_expired_organization_ai_content(%L,%L,1,%L)',:'org',:'closure',:'operation'),'42501');
rollback to evidence;release evidence;
insert into public.workspace_ai_cost_resolutions(operation_id,run_id,evidence,previous_bound,measured_cost,response_id) values('b8000000-0000-4000-8000-000000000066',:'second','Recorded provider terminal result',3,3,'fixture-response-2');
create temporary table preserved_ai_facts as
select 'runs' kind,md5(jsonb_agg(to_jsonb(r)-array['target','prompt','proposal','usage','tariff','content_retired_at','retired_proposal_hash'] order by id)::text) value from public.workspace_ai_runs r where org_id=:'org'
union all select 'other',md5(to_jsonb(r)::text) from public.workspace_ai_runs r where org_id=:'other' and id='b8000000-0000-4000-8000-000000000056'
union all select 'entries',md5(coalesce(jsonb_agg(to_jsonb(e) order by id)::text,'')) from public.ai_credit_entries e
union all select 'reservations',md5(coalesce(jsonb_agg(to_jsonb(e) order by run_id,lot_id)::text,'')) from public.ai_credit_reservations e
union all select 'cost_evidence',md5(coalesce(jsonb_agg(to_jsonb(e) order by operation_id)::text,'')) from public.workspace_ai_cost_resolutions e
union all select 'calls',md5(coalesce(jsonb_agg(to_jsonb(e) order by run_id,response_id)::text,'')) from public.workspace_ai_research_calls e
union all select 'document_apps',md5(coalesce(jsonb_agg(to_jsonb(e) order by run_id)::text,'')) from public.workspace_ai_document_applications e;
savepoint missing_policy;
delete from public.ai_credit_policy where id;
select public.c3_ai_error(format('select public.purge_expired_organization_ai_content(%L,%L,1,%L)',:'org',:'closure',:'operation'),'42501');
rollback to missing_policy;release missing_policy;
savepoint early;
update public.organization_closures set requested_at=statement_timestamp(),export_until=statement_timestamp()+interval '720 hours' where org_id=:'org';
select public.c3_ai_error(format('select public.purge_expired_organization_ai_content(%L,%L,1,%L)',:'org',:'closure',:'operation'),'42501');
rollback to early;release early;
select public.c3_ai_error(format('select public.purge_expired_organization_ai_content(%L,%L,2,%L)',:'org',:'closure',:'operation'),'42501');
savepoint api;set local role service_role;
select public.c3_ai_error(format('select public.purge_expired_organization_ai_content(%L,%L,1,%L)',:'org',:'closure',:'operation'),'42501');
reset role;rollback to api;release api;
savepoint atomic;
select public.purge_expired_organization_ai_content(:'org',:'closure',1,:'operation');
rollback to atomic;release atomic;
select public.c3_ai_assert((select count(*)=55 from public.workspace_ai_runs where org_id=:'org' and content_retired_at is null) and not exists(select 1 from public.organization_closure_ai_cleanups where org_id=:'org'),'atomic rollback keeps raw content and no receipt');
select public.purge_expired_organization_ai_content(:'org',:'closure',1,:'operation')::text as first_receipt \gset
select public.c3_ai_assert((:'first_receipt'::jsonb->>'retiredRuns')::integer=50 and (:'first_receipt'::jsonb->>'moreRemainingAtCommit')::boolean,'bounded50 first batch');
select public.c3_ai_assert(public.purge_expired_organization_ai_content(:'org',:'closure',1,:'operation')=:'first_receipt'::jsonb,'exact retry does not advance batch');
select public.purge_expired_organization_ai_content(:'org',:'closure',1,'b8000000-0000-4000-8000-000000000092')::text as second_receipt \gset
select public.c3_ai_assert((:'second_receipt'::jsonb->>'retiredRuns')::integer=5 and not(:'second_receipt'::jsonb->>'moreRemainingAtCommit')::boolean,'remaining5 batch');
select public.c3_ai_assert((public.purge_expired_organization_ai_content(:'org',:'closure',1,'b8000000-0000-4000-8000-000000000093')->>'retiredRuns')::integer=0,'empty stable pass');
select public.c3_ai_assert(not exists(select 1 from public.workspace_ai_runs r where org_id=:'org' and to_jsonb(r)::text like '%RAW_%') and not exists(select 1 from public.workspace_ai_result_receipts x join public.workspace_ai_runs r on r.id=x.run_id where r.org_id=:'org' and to_jsonb(x)::text like '%RAW_%') and (select before_draft is null from public.workspace_ai_plan_applications where run_id=:'first'),'all actual run/result/rollback content copies removed');
select public.c3_ai_assert((select usage='{"input":1,"cachedInput":0,"output":2,"webSearchCalls":0}'::jsonb and tariff=(:'tariff'::jsonb-'raw') and proposal is null and target='{}' and prompt='' from public.workspace_ai_runs where id=:'first'),'only metric and pricing facts retained');
-- Exact late result retry is a void no-op; changed raw usage/proposal is denied.
select public.record_workspace_ai_result(:'first','succeeded',3,2,'RAW_PROPOSAL',:'usage','fixture-response-1');
select public.c3_ai_error(format('select public.record_workspace_ai_result(%L,''succeeded'',3,2,''CHANGED'',%L,''fixture-response-1'')',:'first',:'usage'),'42501');
select public.c3_ai_error(format('select public.record_workspace_ai_result(%L,''succeeded'',3,2,''RAW_PROPOSAL'',''{"input":999}'',''fixture-response-1'')',:'first'),'42501');
select public.c3_ai_assert((public.settle_workspace_ai_run(:'first','succeeded',3,2,'RAW_PROPOSAL',:'usage','fixture-response-1')->>'proposal') is null,'late exact settlement retry returns redacted facts');
select public.c3_ai_error(format('select public.settle_workspace_ai_run(%L,''succeeded'',3,2,''CHANGED'',%L,''fixture-response-1'')',:'first',:'usage'),'P0001');
select public.c3_ai_assert((public.settle_recorded_workspace_ai_run(:'first')->>'proposal') is null,'recorded settlement replay retains no content');
select public.c3_ai_error(format('update public.workspace_ai_runs set proposal=''RESURRECT'' where id=%L',:'first'),'42501');
select public.c3_ai_error(format('update public.workspace_ai_runs set usage=''{"body":"RESURRECT"}'' where id=%L',:'first'),'42501');
select public.c3_ai_error(format('update public.workspace_ai_plan_applications set before_draft=''{"body":"RESURRECT"}'' where run_id=%L',:'first'),'42501');
select public.c3_ai_error(format('insert into public.workspace_ai_result_receipts(run_id,result) values(%L,''{"body":"RESURRECT"}'')',:'no_receipt'),'42501');
select public.c3_ai_error(format('insert into public.workspace_research_drafts(run_id,base_hash,draft) values(%L,%L,''{"body":"RESURRECT"}'')',:'no_receipt',repeat('e',64)),'42501');
select public.c3_ai_error(format('update public.ai_credit_entries set credits=1 where run_id=%L',:'first'),'P0001');
select public.c3_ai_error(format('update public.organization_closure_ai_cleanups set result=''{}'' where org_id=%L',:'org'),'42501');
select public.c3_ai_error('truncate public.organization_closure_ai_cleanups','42501');
select public.c3_ai_assert((select value from preserved_ai_facts where kind='runs')=(select md5(jsonb_agg(to_jsonb(r)-array['target','prompt','proposal','usage','tariff','content_retired_at','retired_proposal_hash'] order by id)::text) from public.workspace_ai_runs r where org_id=:'org'),'all original run settlement identities and financial values preserved');
select public.c3_ai_assert((select value from preserved_ai_facts where kind='other')=(select md5(to_jsonb(r)::text) from public.workspace_ai_runs r where id='b8000000-0000-4000-8000-000000000056'),'other organization raw content and accounting preserved');
select public.c3_ai_assert((select value from preserved_ai_facts where kind='entries')=(select md5(coalesce(jsonb_agg(to_jsonb(e) order by id)::text,'')) from public.ai_credit_entries e),'immutable charged ledger preserved');
select public.c3_ai_assert((select value from preserved_ai_facts where kind='reservations')=(select md5(coalesce(jsonb_agg(to_jsonb(e) order by run_id,lot_id)::text,'')) from public.ai_credit_reservations e),'reservation facts preserved');
select public.c3_ai_assert((select value from preserved_ai_facts where kind='cost_evidence')=(select md5(coalesce(jsonb_agg(to_jsonb(e) order by operation_id)::text,'')) from public.workspace_ai_cost_resolutions e),'necessary accounting evidence preserved');
select public.c3_ai_assert((select value from preserved_ai_facts where kind='calls')=(select md5(coalesce(jsonb_agg(to_jsonb(e) order by run_id,response_id)::text,'')) from public.workspace_ai_research_calls e),'provider effect IDs preserved');
select public.c3_ai_assert((select value from preserved_ai_facts where kind='document_apps')=(select md5(coalesce(jsonb_agg(to_jsonb(e) order by run_id)::text,'')) from public.workspace_ai_document_applications e),'document application hashes/revisions preserved');
savepoint lifecycle;
select public.c3_ai_error(format('select public.organization_closure_command(%L,%L,''cancel'',%L,1)',:'org',:'org','b8000000-0000-4000-8000-000000000094'),'42501');
-- Fixture-only rewind permits proving the separate canceled/new-request branch.
update public.organization_closures set requested_at=statement_timestamp(),export_until=statement_timestamp()+interval '720 hours' where org_id=:'org';
select public.organization_closure_command(:'org',:'org','cancel','b8000000-0000-4000-8000-000000000094',1);
select public.c3_ai_error(format('select public.purge_expired_organization_ai_content(%L,%L,1,%L)',:'org',:'closure',:'operation'),'42501');
select public.c3_ai_error(format('update public.workspace_ai_runs set target=''{"body":"RESURRECT"}'' where id=%L',:'first'),'42501');
select public.organization_closure_command(:'org',:'org','request','b8000000-0000-4000-8000-000000000095',2);
select public.c3_ai_error(format('select public.purge_expired_organization_ai_content(%L,%L,1,%L)',:'org',:'closure',:'operation'),'42501');
rollback to lifecycle;release lifecycle;
select 'AI terminal gates/bounded retirement/raw-copy removal/exact retries/fences/accounting preservation pass';
rollback;
