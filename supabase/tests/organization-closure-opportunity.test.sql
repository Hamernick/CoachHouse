\set ON_ERROR_STOP on
begin;
select public.fixture_closure_opportunities();
-- Use production RLS and privileges, not only privileged trigger calls.
set local role authenticated;
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000005';
do $$ begin
 if (select count(*) from public.organization_finance_opportunities)<>2
 or (select count(*) from public.organization_resource_opportunity_matches)<>2
 or (select count(*) from public.organization_finance_engagement_events)<>1 then raise exception 'Granted board visibility changed'; end if;
 begin update public.organization_finance_opportunities set title='Unauthorized';
 raise exception 'Direct board write admitted'; exception when insufficient_privilege then null; end;
 begin perform * from public.finance_opportunity_scan_runs;
 raise exception 'Private scan runs exposed'; exception when insufficient_privilege then null; end;
end $$;
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000006';
do $$ begin
 if exists(select 1 from public.organization_finance_opportunities)
 or exists(select 1 from public.organization_resource_opportunity_matches)
 or exists(select 1 from public.organization_finance_engagement_events) then raise exception 'Outsider read finance'; end if;
end $$;
reset role;
-- Identity fences apply even while active.
do $$ declare target text; key text; begin
 foreach target in array array['organization_finance_opportunities','organization_finance_engagement_events','finance_opportunity_scan_runs','organization_resource_opportunity_matches'] loop
 foreach key in array array['org_id','id'] loop
 begin execute format('update public.%I set %I=public.fixture_form_id(999) where org_id=public.fixture_form_id(1)',target,key);
 raise exception 'Identity changed'; exception when insufficient_privilege then
 if sqlerrm<>'Opportunity identity cannot change' then raise; end if; end;
 end loop; end loop;
end $$;
select public.fixture_closure('request',600,0);
set local role service_role;
do $$ declare target text; command text; begin
 foreach target in array array['organization_finance_opportunities','organization_finance_engagement_events','finance_opportunity_scan_runs','organization_resource_opportunity_matches'] loop
 foreach command in array array[
 format('insert into public.%1$I select (jsonb_populate_record(null::public.%1$I,to_jsonb(t)||jsonb_build_object(''id'',public.fixture_form_id(999)))).* from public.%1$I t where org_id=public.fixture_form_id(1)',target),
 format('update public.%I set id=id where org_id=public.fixture_form_id(1)',target),
 format('delete from public.%I where org_id=public.fixture_form_id(1)',target)
 ] loop
 begin execute command; raise exception 'Closing write admitted: %',command;
 exception when insufficient_privilege then if sqlerrm<>'Organization unavailable' then raise; end if; end;
 end loop; end loop;
 foreach command in array array[
 'select public.fixture_opportunity_reorder()',
 'select public.fixture_opportunity_match()',
 'select public.fixture_opportunity_match(''dismiss'')',
 'update public.organization_finance_engagement_events set finance_record_id=null where id=public.fixture_form_id(940)',
 'update public.organization_resource_opportunity_matches set opportunity_id=null where id=public.fixture_form_id(931)',
 'insert into public.organization_finance_opportunities(org_id,title,external_provider,external_opportunity_id) values(public.fixture_form_id(1),''Late'',''manual'',''first'') on conflict(org_id,external_provider,external_opportunity_id) do update set title=excluded.title'
 ] loop
 begin execute command; raise exception 'Closing compound/write effect admitted';
 exception when insufficient_privilege then if sqlerrm<>'Organization unavailable' then raise; end if; end;
 end loop;
 -- The shared registry and another organization's writes remain independent.
 update public.finance_opportunity_sources set enabled=true where source_key='grants_gov';
 update public.organization_finance_opportunities set title='Other saved' where id=public.fixture_form_id(922);
 update public.finance_opportunity_scan_runs set status='running' where id=public.fixture_form_id(951);
end $$;
reset role;
do $$ begin
 if (select count(*) from public.organization_finance_opportunities)<>3
 or (select title from public.organization_finance_opportunities where id=public.fixture_form_id(920))<>'First'
 or (select feed_position from public.organization_finance_opportunities where id=public.fixture_form_id(920))<>1
 or (select status from public.organization_resource_opportunity_matches where id=public.fixture_form_id(930))<>'new'
 or (select status from public.finance_opportunity_scan_runs where id=public.fixture_form_id(950))<>'queued' then raise exception 'Rejected write left effects'; end if;
 -- Actual active-organization cascade may clear legacy cross-org references;
 -- it preserves the closing organization's rows, the shared identity/source.
 delete from public.organizations where user_id=public.fixture_form_id(2);
 if not exists(select 1 from auth.users where id=public.fixture_form_id(2))
 or not exists(select 1 from public.finance_opportunity_sources where source_key='grants_gov')
 or (select count(*) from public.organization_finance_engagement_events)<>1
 or exists(select 1 from public.organization_finance_engagement_events where finance_record_id is not null)
 or (select count(*) from public.organization_resource_opportunity_matches)<>2
 or exists(select 1 from public.organization_resource_opportunity_matches where opportunity_id is not null)
 then raise exception 'Cross-organization cascade lost or retained wrong data'; end if;
 perform public.fixture_closure('cancel',601,1);
 if public.read_workspace_page_public('community-table',public.fixture_form_id(10)) is not null
 or exists(select 1 from public.workspace_page_image_grants where org_id=public.fixture_form_id(1)) then raise exception 'Cancel restored publication/grants'; end if;
end $$;
set local role service_role;
select public.fixture_opportunity_reorder();
select public.fixture_opportunity_match();
select public.fixture_opportunity_match(); -- existing save remains idempotent
select public.fixture_opportunity_match('dismiss');
select public.fixture_opportunity_match('restore');
update public.organization_finance_engagement_events set event_type='click' where id=public.fixture_form_id(940);
update public.finance_opportunity_scan_runs set status='running' where id=public.fixture_form_id(950);
reset role;
do $$ declare role_name text; begin
 if (select count(*) from public.organization_finance_opportunities)<>3
 or (select feed_position from public.organization_finance_opportunities where id=public.fixture_form_id(920))<>2
 or not exists(select 1 from public.organization_resource_opportunity_matches m join public.organization_finance_opportunities o on o.id=m.opportunity_id where m.id=public.fixture_form_id(930) and m.status='saved' and o.status='saved') then raise exception 'Explicit retry/readback failed'; end if;
 foreach role_name in array array['anon','authenticated','service_role'] loop
 if has_function_privilege(role_name,'public.guard_organization_opportunity_closure()','EXECUTE')
 or has_function_privilege(role_name,'public.organization_closure_command(uuid,uuid,text,uuid,integer)','EXECUTE') then raise exception 'Lifecycle authority exposed'; end if;
 end loop;
end $$;
select public.fixture_closure('request',602,2);
update public.organization_closures set requested_at='2000-01-01Z',export_until='2000-01-31Z';
set local role service_role;
do $$ declare target text; begin
 foreach target in array array['organization_finance_opportunities','organization_finance_engagement_events','finance_opportunity_scan_runs','organization_resource_opportunity_matches'] loop
 begin execute format('delete from public.%I where org_id=public.fixture_form_id(1)',target);
 raise exception 'Expiry authorized purge'; exception when insufficient_privilege then
 if sqlerrm<>'Organization unavailable' then raise; end if; end;
 end loop;
end $$;
reset role;
rollback;
