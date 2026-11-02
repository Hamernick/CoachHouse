\set ON_ERROR_STOP on
begin;
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001';
select public.fixture_closure_ai();
set local role authenticated;
do $$ begin
 begin perform public.fixture_ai_reserve(); raise exception 'Browser admitted AI'; exception when insufficient_privilege then null; end;
 begin perform 1 from public.workspace_ai_runs; raise exception 'Browser read private ledger'; exception when insufficient_privilege then null; end;
end $$;
reset role;
savepoint research;
set local role service_role;
do $$ begin if public.fixture_ai_research()->>'created'<>'true' then raise exception 'Research admission failed'; end if; end $$;
reset role;
do $$ begin if (select task from public.workspace_ai_runs where id=public.fixture_form_id(1810))<>'plan' then raise exception 'Research task binding lost'; end if; end $$;
rollback to research;
set local role service_role;
do $$ begin
 if public.fixture_ai_reserve()->>'created'<>'true' or public.fixture_ai_reserve()->>'created'<>'false' then raise exception 'Reservation/replay failed'; end if;
 if not public.fixture_ai_claim() then raise exception 'Active claim failed'; end if;
 perform public.fixture_ai_reserve(1802,2,2);
end $$;
reset role;
select public.fixture_closure('request',600,0);
do $$ begin
 if not exists(select 1 from public.workspace_ai_runs where id=public.fixture_form_id(1801) and cancel_requested_at is not null)
 or exists(select 1 from public.workspace_ai_runs where id=public.fixture_form_id(1802) and cancel_requested_at is not null) then raise exception 'Cancellation crossed organizations'; end if;
end $$;
set local role service_role;
do $$ begin
 begin perform public.fixture_ai_reserve(1803); raise exception 'Closing reservation admitted'; exception when insufficient_privilege then if sqlerrm<>'Organization unavailable' then raise; end if; end;
 begin perform public.fixture_ai_research(); raise exception 'Closing research admitted'; exception when insufficient_privilege then if sqlerrm<>'Organization unavailable' then raise; end if; end;
 if public.fixture_ai_claim() then raise exception 'Canceled run claimed again'; end if;
 begin update public.workspace_ai_runs set cancel_requested_at=null where id=public.fixture_form_id(1801); raise exception 'Cancellation reversed';
 exception when insufficient_privilege then if sqlerrm<>'AI cancellation cannot be reversed' then raise; end if; end;
 begin update public.workspace_ai_runs set org_id=public.fixture_form_id(2) where id=public.fixture_form_id(1801); raise exception 'Run reparented';
 exception when insufficient_privilege then if sqlerrm<>'AI run identity cannot change' then raise; end if; end;
 perform public.fixture_ai_finish();
 perform public.fixture_ai_finish();
end $$;
reset role;
do $$ begin
 if not exists(select 1 from public.workspace_ai_runs where id=public.fixture_form_id(1801) and status='canceled'
 and charged_credits=0 and provider_microdollars=100 and proposal is null and provider_cost_state='measured')
 or exists(select 1 from public.ai_credit_entries)
 or (select count(*) from public.workspace_ai_result_receipts)<>1 then raise exception 'Late settlement lost cost or charged canceled work'; end if;
 if public.workspace_ai_provider_exposure(public.fixture_form_id(1))<>100 then raise exception 'Canceled provider exposure erased'; end if;
 perform public.fixture_closure('cancel',601,1);
end $$;
set local role service_role;
do $$ begin
 if public.fixture_ai_claim() then raise exception 'Organization cancel restarted old AI'; end if;
 begin update public.workspace_ai_runs set status='running' where id=public.fixture_form_id(1801); raise exception 'Canceled run restarted';
 exception when insufficient_privilege then if sqlerrm<>'Canceled AI work cannot restart or succeed' then raise; end if; end;
 if public.fixture_ai_reserve(1803)->>'created'<>'true' then raise exception 'Explicit new request unavailable after cancel'; end if;
end $$;
reset role;
do $$ declare role_name text; begin
 if public.read_workspace_page_public('community-table',public.fixture_form_id(10)) is not null
 or exists(select 1 from public.workspace_page_image_grants where org_id=public.fixture_form_id(1)) then raise exception 'Cancel restored publication/grants'; end if;
 foreach role_name in array array['anon','authenticated','service_role'] loop
 if has_function_privilege(role_name,'public.guard_workspace_ai_closure()','EXECUTE')
 or has_function_privilege(role_name,'public.cancel_workspace_ai_on_closure()','EXECUTE')
 or has_function_privilege(role_name,'public.reserve_workspace_ai_run_before_closure(uuid,uuid,uuid,text,jsonb,text,jsonb,integer,integer)','EXECUTE')
 or has_function_privilege(role_name,'public.organization_closure_command(uuid,uuid,text,uuid,integer)','EXECUTE') then raise exception 'Private lifecycle authority exposed'; end if;
 end loop;
end $$;
rollback;
