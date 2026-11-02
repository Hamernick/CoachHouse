\set ON_ERROR_STOP on
begin;
select public.fixture_closure_finance();
-- Existing finance RLS still separates owner, granted board member and outsider.
set local role authenticated;
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000005';
do $$ begin
 if (select count(*) from public.organization_finance_records)<>2 then raise exception 'Board grant read changed'; end if;
 begin update public.organization_finance_records set amount_cents=999;
 raise exception 'Board direct ledger write admitted'; exception when insufficient_privilege then null; end;
 begin insert into public.organization_finance_access(org_id,member_id,granted_by)
 values(public.fixture_form_id(1),public.fixture_form_id(6),public.fixture_form_id(5));
 raise exception 'Board granted access'; exception when insufficient_privilege then null; end;
end $$;
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000006';
do $$ begin
 if exists(select 1 from public.organization_finance_records) then raise exception 'Outsider read finance'; end if;
end $$;
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001';
update public.organization_finance_access set access_level='manager' where member_id=public.fixture_form_id(5);
insert into public.organization_finance_access(org_id,member_id,granted_by)
 values(public.fixture_form_id(1),public.fixture_form_id(6),public.fixture_form_id(1));
reset role;
do $$ declare command text; begin
 foreach command in array array[
 'update public.organization_finance_records set org_id=public.fixture_form_id(2) where id=public.fixture_form_id(910)',
 'update public.organization_finance_records set id=public.fixture_form_id(919) where id=public.fixture_form_id(910)',
 'update public.organization_finance_access set member_id=public.fixture_form_id(6) where member_id=public.fixture_form_id(5)'
 ] loop
 begin execute command; raise exception 'Finance identity moved'; exception when insufficient_privilege then
 if sqlerrm<>'Finance identity cannot change' then raise; end if; end;
 end loop;
end $$;
select public.fixture_closure('request',600,0);
set local role authenticated;
delete from public.organization_finance_access where member_id=public.fixture_form_id(6);
do $$ begin
 begin insert into public.organization_finance_access(org_id,member_id,granted_by)
 values(public.fixture_form_id(1),public.fixture_form_id(6),public.fixture_form_id(1));
 raise exception 'Closing owner granted finance access'; exception when insufficient_privilege then
 if sqlerrm<>'Organization unavailable' then raise; end if; end;
end $$;
reset role;
set local role service_role;
do $$ declare command text; begin
 foreach command in array array[
 'select public.fixture_finance_reconcile()', 'select public.fixture_finance_correct()', 'select public.fixture_finance_import()',
 'update public.organization_finance_records set amount_cents=999 where id=public.fixture_form_id(910)',
 'delete from public.organization_finance_records where id=public.fixture_form_id(910)',
 'update public.organization_finance_records set created_by=null where id=public.fixture_form_id(910)',
 'insert into public.organization_finance_records(id,org_id,effective_at,record_type,direction,source_kind,source_label,amount_cents) values(public.fixture_form_id(910),public.fixture_form_id(1),now(),''donation'',''in'',''donations'',''Late'',999) on conflict(id) do update set amount_cents=999',
 'insert into public.organization_finance_access(org_id,member_id,granted_by) values(public.fixture_form_id(1),public.fixture_form_id(6),public.fixture_form_id(1))',
 'update public.organization_finance_access set access_level=''viewer'' where member_id=public.fixture_form_id(5)',
 'insert into public.organization_finance_record_events(org_id,record_id,event_type,actor_id) values(public.fixture_form_id(1),public.fixture_form_id(910),''reconciled'',public.fixture_form_id(1))',
 'insert into public.organization_finance_record_provider_evidence(org_id,record_id,provider,provider_account_id,provider_record_id,observed_at,payload_sha256) values(public.fixture_form_id(1),public.fixture_form_id(910),''stripe_balance_transaction'',''acct_fixture'',''late'',now(),repeat(''a'',64))',
 'insert into public.organization_finance_record_corrections(org_id,original_record_id,replacement_record_id,evidence_id,reason,created_by) values(public.fixture_form_id(1),public.fixture_form_id(912),public.fixture_form_id(910),public.fixture_form_id(919),''Late'',public.fixture_form_id(1))'
 ] loop
 begin execute command; raise exception 'Closing accounting effect admitted: %',command;
 exception when insufficient_privilege then if sqlerrm<>'Organization unavailable' then raise; end if; end;
 end loop;
 update public.organization_finance_records set source_label='Other saved' where id=public.fixture_form_id(911);
end $$;
reset role;
do $$ begin
 if (select count(*) from public.organization_finance_records)<>3
 or exists(select 1 from public.organization_finance_record_evidence)
 or exists(select 1 from public.organization_finance_record_events)
 or exists(select 1 from public.organization_finance_record_corrections)
 or exists(select 1 from public.organization_finance_record_provider_evidence)
 or (select amount_cents from public.organization_finance_records where id=public.fixture_form_id(910))<>100 then
 raise exception 'Rejected transaction left accounting effects'; end if;
 -- Actual auth deletion clears only unreconciled attribution and revokes its
 -- finance grant; existing reconciled-record retention is not weakened.
 delete from auth.users where id=public.fixture_form_id(12);
 if exists(select 1 from public.organization_finance_records where created_by=public.fixture_form_id(12))
 or exists(select 1 from public.organization_finance_access where member_id=public.fixture_form_id(12))
 or (select count(*) from public.organizations)<>2 then raise exception 'Separate account cleanup failed'; end if;
 -- The production membership trigger must still revoke during closure.
 update public.organization_memberships set role='member' where org_id=public.fixture_form_id(1) and member_id=public.fixture_form_id(5);
 if exists(select 1 from public.organization_finance_access) then raise exception 'Membership revocation blocked'; end if;
 perform public.fixture_closure('cancel',601,1);
 if exists(select 1 from public.organization_finance_access)
 or public.read_workspace_page_public('community-table',public.fixture_form_id(10)) is not null then raise exception 'Cancel restored access/publication'; end if;
end $$;
-- Existing atomic accounting transactions remain usable after cancellation.
set local role service_role;
select public.fixture_finance_reconcile();
select public.fixture_finance_correct();
select public.fixture_finance_import();
select public.fixture_finance_import(); -- provider idempotency still applies
reset role;
do $$ declare target text; role_name text; begin
 if (select count(*) from public.organization_finance_records)<>5
 or (select count(*) from public.organization_finance_record_evidence)<>2
 or (select count(*) from public.organization_finance_record_events)<>4
 or (select count(*) from public.organization_finance_record_corrections)<>1
 or (select count(*) from public.organization_finance_record_provider_evidence)<>1 then raise exception 'Accounting transaction/readback mismatch'; end if;
 foreach target in array array['evidence','events','corrections','provider_evidence'] loop
   begin execute 'delete from public.organization_finance_record_'||target;
   raise exception 'Accounting history deleted'; exception when raise_exception then
     if sqlerrm not like '%immutable%' then raise; end if; end;
 end loop;
 begin update public.organization_finance_records set amount_cents=999 where id=public.fixture_form_id(912);
 raise exception 'Reconciled record changed'; exception when raise_exception then
 if sqlerrm<>'Reconciled Finance record fields are immutable' then raise; end if; end;
 foreach role_name in array array['anon','authenticated','service_role'] loop
 if has_function_privilege(role_name,'public.guard_organization_finance_closure()','EXECUTE')
 or has_function_privilege(role_name,'public.organization_closure_command(uuid,uuid,text,uuid,integer)','EXECUTE') then raise exception 'Lifecycle authority exposed'; end if;
 end loop;
end $$;
-- Expiration is not purge authority, and retained receipt rows stay fenced.
select public.fixture_closure('request',602,2);
-- Use one timestamp so the fixed-window check remains exact.
update public.organization_closures set requested_at='2000-01-01Z',export_until='2000-01-31Z';
set local role service_role;
do $$ declare target text; begin
 foreach target in array array['records','record_evidence','record_events','record_corrections','record_provider_evidence'] loop
 begin execute 'delete from public.organization_finance_'||target||' where org_id=public.fixture_form_id(1)';
 raise exception 'Expired closure permitted accounting purge'; exception when insufficient_privilege then
 if sqlerrm<>'Organization unavailable' then raise; end if; end;
 end loop;
end $$;
reset role;
rollback;
