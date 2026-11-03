-- Full430+440 owned disposable clone. All synthetic fixtures roll back.
do $$begin if current_database() not like 'ch_c3_early_%' or current_setting('coach_house.early_fixture',true) is distinct from 'isolated-test-only' then raise exception 'Owned early deletion fixture required';end if;end$$;
begin;
set request.jwt.claim.role='service_role';
insert into auth.users(id,email,raw_app_meta_data) values('c4400000-0000-4000-8000-000000000001','c440-owner@example.invalid','{"legal_consent_exempt":"service_provisioned"}'),('c4400000-0000-4000-8000-000000000002','c440-other@example.invalid','{"legal_consent_exempt":"service_provisioned"}');
insert into public.organizations(user_id,profile) values('c4400000-0000-4000-8000-000000000001','{"name":"Early fixture","description":"RETIRE","roadmap":{"mission":"RETIRE"}}'),('c4400000-0000-4000-8000-000000000002','{"name":"Other preserved"}');
insert into public.organization_workspace_pages(id,org_id,particle_ids,title) values('c4400000-0000-4000-8000-000000000010','c4400000-0000-4000-8000-000000000001','{c4400000-0000-4000-8000-000000000020}','Fixture page');
insert into public.organization_forms(org_id,id,intake_manager) values('c4400000-0000-4000-8000-000000000001','c4400000-0000-4000-8000-000000000020','c4400000-0000-4000-8000-000000000002');
insert into public.organization_form_versions(id,org_id,form_id,page_id,version) values('c4400000-0000-4000-8000-000000000030','c4400000-0000-4000-8000-000000000001','c4400000-0000-4000-8000-000000000020','c4400000-0000-4000-8000-000000000010','{}');
insert into public.organization_form_responses(version_id,id,original_hash,answers) values('c4400000-0000-4000-8000-000000000030','c4400000-0000-4000-8000-000000000040',repeat('a',64),'[{"secret":"NATIVE RESPONSE"}]');
select public.read_organization_suppression_events()->>'highWater';

create function public.c440_assert(ok boolean,message text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'Assertion failed: %',message;end if;end$$;
create function public.c440_error(command text,expected text) returns void language plpgsql as $$begin begin execute command;exception when others then if sqlstate=expected then return;end if;raise exception 'Expected %, got %: %',expected,sqlstate,sqlerrm;end;raise exception 'Unexpected success: %',command;end$$;
\set org 'c4400000-0000-4000-8000-000000000001'
\set other 'c4400000-0000-4000-8000-000000000002'
\set request 'c4400000-0000-4000-8000-000000000090'
\set confirmation 'c4400000-0000-4000-8000-000000000091'
\set version 'organization-early-deletion-v1'
create temporary table preserved440 as select 'other' kind,md5(to_jsonb(o)::text) digest from public.organizations o where user_id=:'other'
union all select 'auth',md5(jsonb_agg(to_jsonb(u) order by id)::text) from auth.users u;
select public.organization_closure_command(:'org',:'org','request',:'request',0);
select public.c440_assert(not public.organization_closure_cleanup_due(:'org',:'request',1),'ordinary closure remains fixed30day');
select public.c440_assert(public.organization_closure_read_window(:'org'),'ordinary export window open');
select public.c440_assert((public.organization_storage_link_deadline(:'org',60)->>'expiresAt')::timestamptz>clock_timestamp(),'ordinary bounded link');
select public.c440_assert(not public.can_review_organization_form(:'org','c4400000-0000-4000-8000-000000000020',:'org'),'owner is not response authority');
select public.c440_error(format('select public.confirm_organization_early_deletion(%L,%L,%L,1,%L,%L,true)',:'other',:'org',:'request',:'confirmation',:'version'),'42501');
select public.c440_error(format('select public.confirm_organization_early_deletion(%L,%L,%L,2,%L,%L,true)',:'org',:'org',:'request',:'confirmation',:'version'),'40001');
select public.c440_error(format('select public.confirm_organization_early_deletion(%L,%L,%L,1,%L,%L,false)',:'org',:'org',:'request',:'confirmation',:'version'),'42501');
select public.c440_error(format('select public.confirm_organization_early_deletion(%L,%L,%L,1,%L,''unknown'',true)',:'org',:'org',:'request',:'confirmation'),'42501');
select public.c440_error(format('select public.purge_expired_organization_form_responses(%L,%L,1,%L)',:'org',:'request',:'confirmation'),'42501');
savepoint api;set local role service_role;
select public.c440_error(format('select public.confirm_organization_early_deletion(%L,%L,%L,1,%L,%L,true)',:'org',:'org',:'request',:'confirmation',:'version'),'42501');
reset role;rollback to api;release api;
-- Every mandatory new hook rejects admission before any confirmation commits.
do $$declare name text;relation text;begin
 for name,relation in select * from(values('a_organization_read_only_boundary','organization_closure_early_deletions'),('early_deletion_capture','organization_closure_early_deletions'),('early_deletion_immutable','organization_closure_early_deletions'),('early_deletion_retained','organization_closure_early_deletions'),('organization_early_deletion_irreversible','organization_closures'),('organization_suppression_capacity','organization_suppression_events')) t loop
  execute format('alter table public.%I disable trigger %I',relation,name);
  perform public.c440_error('select public.confirm_organization_early_deletion(''c4400000-0000-4000-8000-000000000001'',''c4400000-0000-4000-8000-000000000001'',''c4400000-0000-4000-8000-000000000090'',1,''c4400000-0000-4000-8000-000000000091'',''organization-early-deletion-v1'',true)','42501');
  execute format('alter table public.%I enable trigger %I',relation,name);
 end loop;
end$$;
select public.c440_assert(not exists(select 1 from public.organization_closure_early_deletions where org_id=:'org'),'disabled hooks leave no intent');
savepoint malformed_hook;
drop trigger early_deletion_capture on public.organization_closure_early_deletions;
create trigger early_deletion_capture after insert on public.organization_closure_early_deletions for each row when(false) execute function public.capture_organization_early_deletion();
select public.c440_error('select public.read_organization_suppression_events()','42501');
rollback to malformed_hook;release malformed_hook;
-- Capture capacity failure rolls back intent and sequence together.
savepoint capacity;
with missing as(select generate_series((select high_water+1 from public.organization_suppression_capture_state),1000)n),advanced as(update public.organization_suppression_capture_state set high_water=1000 returning high_water)
insert into public.organization_suppression_events(sequence,event_id,kind,organization_id,operation_id,revision,occurred_at)
select n,gen_random_uuid(),'closure_cancel',:'other',gen_random_uuid(),2,clock_timestamp() from missing,advanced;
select public.c440_error(format('select public.confirm_organization_early_deletion(%L,%L,%L,1,%L,%L,true)',:'org',:'org',:'request',:'confirmation',:'version'),'54000');
select public.c440_assert(not exists(select 1 from public.organization_closure_early_deletions where org_id=:'org') and (select high_water=1000 from public.organization_suppression_capture_state),'capacity failure atomic');
rollback to capacity;release capacity;
savepoint atomic;
select public.confirm_organization_early_deletion(:'org',:'org',:'request',1,:'confirmation',:'version',true);
rollback to atomic;release atomic;
select public.c440_assert(not exists(select 1 from public.organization_closure_early_deletions where org_id=:'org') and public.organization_closure_read_window(:'org'),'transaction rollback restores prior ordinary window');
select public.confirm_organization_early_deletion(:'org',:'org',:'request',1,:'confirmation',:'version',true)::text as receipt \gset
select public.c440_assert(public.confirm_organization_early_deletion(:'org',:'org',:'request',1,:'confirmation',:'version',true)=:'receipt'::jsonb,'exact retry stable');
select public.c440_assert((select export_until=requested_at+interval '720 hours' and revision=1 from public.organization_closures where org_id=:'org'),'original deadline and revision preserved');
select public.c440_assert((select confirmed_at>transaction_timestamp() from public.organization_closure_early_deletions where org_id=:'org'),'real capture time not transaction start');
select public.c440_assert(public.organization_closure_cleanup_due(:'org',:'request',1),'captured early eligibility');
select public.c440_assert((select not public.organization_closure_cleanup_due_at(org_id,closure_request_id,closure_revision,confirmed_at-interval '1 microsecond') and public.organization_closure_cleanup_due_at(org_id,closure_request_id,closure_revision,confirmed_at) from public.organization_closure_early_deletions where org_id=:'org'),'exact captured boundary');
set local timezone='America/New_York';
select public.c440_assert(public.organization_closure_cleanup_due(:'org',:'request',1),'eligibility independent of session timezone');
set local timezone='UTC';
select public.c440_assert(not public.organization_closure_read_window(:'org') and public.organization_storage_link_deadline(:'org',60) is null,'new export/link access ends');
select public.c440_error(format('select public.guard_organization_closure(%L,true)',:'org'),'42501');
select public.c440_error(format('select public.organization_closure_command(%L,%L,''cancel'',gen_random_uuid(),1)',:'org',:'org'),'42501');
select public.c440_error(format('update public.organization_closures set export_until=export_until+interval ''1 day'' where org_id=%L',:'org'),'42501');
select public.c440_error(format('delete from public.organization_closures where org_id=%L',:'org'),'42501');
select public.c440_error(format('delete from public.organization_closure_early_deletions where org_id=%L',:'org'),'42501');
select public.c440_error('truncate public.organization_closure_early_deletions','42501');
select public.c440_error(format('select public.confirm_organization_early_deletion(%L,%L,%L,1,gen_random_uuid(),%L,true)',:'org',:'org',:'request',:'version'),'23505');
select public.purge_expired_organization_form_responses(:'org',:'request',1,'c4400000-0000-4000-8000-000000000092');
select public.c440_assert(not exists(select 1 from public.organization_form_responses where id='c4400000-0000-4000-8000-000000000040'),'response owner executes before original deadline');
select public.c440_assert((select d.deleted_at>=e.confirmed_at and d.deleted_at<c.export_until from public.organization_form_response_deletions d join public.organization_closure_early_deletions e on e.org_id=:'org' join public.organization_closures c on c.org_id=e.org_id where d.response_id='c4400000-0000-4000-8000-000000000040'),'deletion event real-time follows early confirmation');
select public.assert_expired_document_closure(:'org',:'request',1);
select public.claim_organization_closure_cleanup(:'org',:'request',1,'c4400000-0000-4000-8000-000000000093');
select public.run_organization_closure_sql_cleanup(:'org',:'request',1,'c4400000-0000-4000-8000-000000000093')::text as source_outcomes \gset
select public.c440_assert((select bool_and(value->>'state'='batch_complete') from jsonb_each(:'source_outcomes'::jsonb-'ai_content')),'eight SQL owners accept exact early eligibility');
select public.c440_assert(:'source_outcomes'::jsonb#>>'{ai_content,code}'='reconciliation_required','missing canonical AI policy remains blocked');
select public.c440_assert((select digest from preserved440 where kind='other')=(select md5(to_jsonb(o)::text) from public.organizations o where user_id=:'other'),'other organization preserved');
select public.c440_assert((select digest from preserved440 where kind='auth')=(select md5(jsonb_agg(to_jsonb(u) order by id)::text) from auth.users u),'shared identities preserved');
select public.read_organization_suppression_events()->>'highWater';
select 'early confirmation, exact cutoff, immutable retries, capacity rollback, owner separation and source eligibility pass';
rollback;
