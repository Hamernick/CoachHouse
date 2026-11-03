-- Actual canonical300–430 chain on a disposable full-schema native clone.
do $$begin if current_database() not like 'ch_c3_lifecycle_%' or current_setting('coach_house.cleanup_lifecycle_fixture',true) is distinct from 'isolated-test-only' then raise exception 'Owned lifecycle fixture required';end if;end$$;
begin;
create function public.c3_lifecycle_assert(ok boolean,message text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'Assertion failed: %',message;end if;end$$;
create function public.c3_lifecycle_error(command text,expected text) returns void language plpgsql as $$begin begin execute command;exception when others then if sqlstate=expected then return;end if;raise exception 'Expected %, got %: %',expected,sqlstate,sqlerrm;end;raise exception 'Unexpected success: %',command;end$$;
\set org 'b4300000-0000-4000-8000-000000000001'
\set empty 'b4300000-0000-4000-8000-000000000002'
\set closure 'b4300000-0000-4000-8000-000000000101'
\set empty_closure 'b4300000-0000-4000-8000-000000000102'
\set attempt 'b4300000-0000-4000-8000-000000000201'
\set next_attempt 'b4300000-0000-4000-8000-000000000202'
set local request.jwt.claim.role='service_role';
set local request.jwt.claim.sub='b4300000-0000-4000-8000-000000000001';
set local request.headers='{"x-coach-house-actor-id":"b4300000-0000-4000-8000-000000000001"}';
insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data,aud,role) select ('b4300000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'c3lifecycle-'||n||'@example.invalid',u.raw_user_meta_data,u.raw_app_meta_data,u.aud,u.role from (select * from auth.users order by id limit 1)u cross join generate_series(1,2)n;
insert into public.organizations(user_id,profile) values(:'org','{"name":"Private metadata","mission":"Private core","org_people":[{"name":"Private contact"}],"unknownAttachment":{"path":"preserve legacy binding"}}'),(:'empty','{}');
insert into public.organization_workspace_boards(org_id,state,updated_by) values(:'org','{"private":"board payload"}',:'org');
insert into public.organization_workspace_pages(id,org_id,title,description,particle_ids,visibility) values('b4300000-0000-4000-8000-000000000010',:'org','Private page','Private description',array['b4300000-0000-4000-8000-000000000011'::uuid],'private');
insert into public.organization_forms(org_id,id,intake_manager,creator_id) values(:'org','b4300000-0000-4000-8000-000000000011',:'org',:'org');
insert into public.organization_form_versions(id,org_id,form_id,page_id,version) values('b4300000-0000-4000-8000-000000000012',:'org','b4300000-0000-4000-8000-000000000011','b4300000-0000-4000-8000-000000000010','{"private":"form payload"}');
insert into public.organization_form_responses(version_id,id,original_hash,answers,submitted_at) select 'b4300000-0000-4000-8000-000000000012',('b4300000-0000-4000-8000-'||lpad((1000+n)::text,12,'0'))::uuid,repeat('a',64),'[{"value":"Private answer"}]',now()-interval '40 days' from generate_series(1,54)n;
insert into public.organization_brand_kits(org_id,identity) values(:'org','{"private":"Brand draft"}');
select public.c3_lifecycle_assert(public.organization_closure_cleanup_status(:'org')->>'status'='not_requested','active organization has no cleanup claim');
select public.organization_closure_command(:'org',:'org','request',:'closure',0);
select public.c3_lifecycle_assert(public.organization_closure_cleanup_status(:'org')->>'status'='pending','predeadline status is pending');
select public.c3_lifecycle_error(format('select public.claim_organization_closure_cleanup(%L,%L,1,%L)',:'org',:'closure',:'attempt'),'42501');
update public.organization_closures set requested_at=statement_timestamp()-interval '31 days',export_until=statement_timestamp()-interval '31 days'+interval '720 hours' where org_id=:'org';
select to_jsonb(c)::text as original_closure from public.organization_closures c where org_id=:'org' \gset
select public.c3_lifecycle_assert((public.organization_closure_cleanup_assessment(:'org')->>'assessmentAvailable')::boolean,'all canonical owners assess on actual chain');
select public.c3_lifecycle_assert(not has_function_privilege('service_role','public.claim_organization_closure_cleanup(uuid,uuid,integer,uuid)','execute') and not has_function_privilege('authenticated','public.run_organization_closure_sql_cleanup(uuid,uuid,integer,uuid)','execute') and not has_table_privilege('service_role','public.organization_closure_cleanup_attempts','select') and not has_function_privilege('service_role','public.organization_closure_command(uuid,uuid,text,uuid,integer)','execute'),'no cleanup or lifecycle API authority');
savepoint operator_role;
grant execute on function public.claim_organization_closure_cleanup(uuid,uuid,integer,uuid) to service_role;
set local role service_role;
select public.c3_lifecycle_error(format('select public.claim_organization_closure_cleanup(%L,%L,1,%L)',:'org',:'closure',:'attempt'),'42501');
reset role;
rollback to operator_role;
release operator_role;
select public.claim_organization_closure_cleanup(:'org',:'closure',1,:'attempt')::text as claim \gset
select public.c3_lifecycle_assert(public.claim_organization_closure_cleanup(:'org',:'closure',1,:'attempt')=:'claim'::jsonb,'exact claim never extends lease');
select public.c3_lifecycle_assert(public.organization_closure_cleanup_status(:'org')->>'status'='running','active claim visible as running');
select public.c3_lifecycle_error(format('select public.claim_organization_closure_cleanup(%L,%L,1,%L)',:'org',:'closure',:'next_attempt'),'PT409');
select public.c3_lifecycle_error(format('select public.claim_organization_closure_cleanup(%L,%L,2,%L)',:'org',:'closure',:'next_attempt'),'42501');
-- A source exception after earlier writes must roll back only that owner.
create function public.c3_lifecycle_injected_failure() returns trigger language plpgsql as $$begin raise exception 'PRIVATE RAW CONTENT MUST NOT ENTER JOB RECEIPT';end$$;
create trigger z_c3_lifecycle_failure before delete on public.organization_brand_kits for each row execute function public.c3_lifecycle_injected_failure();
select public.run_organization_closure_sql_cleanup(:'org',:'closure',1,:'attempt')::text as first_pass \gset
select public.c3_lifecycle_assert(:'first_pass'::jsonb#>>'{native_responses,state}'='more_pending' and :'first_pass'::jsonb#>>'{workspace_content,state}'='failed' and :'first_pass'::jsonb#>>'{operating_content,code}'='source_failed','batch dependency and actual failed owner reported');
select public.c3_lifecycle_assert(position('PRIVATE RAW CONTENT' in :'first_pass')=0,'raw SQL/source content never copied into job receipt');
select public.c3_lifecycle_assert((select count(*)=4 from public.organization_form_responses where version_id='b4300000-0000-4000-8000-000000000012') and (select profile ? 'org_people' and not(profile ? 'mission') from public.organizations where user_id=:'org') and exists(select 1 from public.organization_brand_kits where org_id=:'org'),'earlier source progress survives; failed source restores contacts/brand');
select public.c3_lifecycle_assert(public.run_organization_closure_sql_cleanup(:'org',:'closure',1,:'attempt')=:'first_pass'::jsonb and (select count(*)=4 from public.organization_form_responses where version_id='b4300000-0000-4000-8000-000000000012'),'lost SQL reply retry does not advance batch or repeat effects');
select public.finish_organization_closure_cleanup(:'org',:'closure',1,:'attempt')::text as first_result \gset
select public.c3_lifecycle_assert(:'first_result'::jsonb->>'status'='failed' and not(:'first_result'::jsonb->>'wholeCleanupComplete')::boolean,'failed attempt is not erasure');
select public.c3_lifecycle_assert(public.finish_organization_closure_cleanup(:'org',:'closure',1,:'attempt')=:'first_result'::jsonb,'exact finished retry immutable');
select public.c3_lifecycle_error(format('select public.finish_organization_closure_cleanup(%L,%L,1,%L,''storage_failed'',''direct_assets'')',:'org',:'closure',:'attempt'),'23505');
drop trigger z_c3_lifecycle_failure on public.organization_brand_kits;
-- Restore the existing synthetic accounting-policy prerequisite; no provider or
-- commercial values are invented by the cleanup implementation.
insert into public.ai_credit_policy(id) values(true) on conflict do nothing;
select public.claim_organization_closure_cleanup(:'org',:'closure',1,:'next_attempt');
select public.run_organization_closure_sql_cleanup(:'org',:'closure',1,:'next_attempt')::text as next_pass \gset
select public.c3_lifecycle_assert(not exists(select 1 from jsonb_each(:'next_pass'::jsonb) where value->>'state'='failed') and (select count(*)=0 from public.organization_form_responses where version_id='b4300000-0000-4000-8000-000000000012') and not exists(select 1 from public.organization_workspace_boards where org_id=:'org'),'new attempt advances remaining source batches after repair');
select public.c3_lifecycle_assert((select not(profile ? 'org_people') and profile ? 'unknownAttachment' from public.organizations where user_id=:'org'),'known content retired; unresolved recovery binding survives');
select public.c3_lifecycle_error(format('select public.finish_organization_closure_cleanup(%L,%L,1,%L,''raw provider token or error'',''direct_assets'')',:'org',:'closure',:'next_attempt'),'22023');
select public.finish_organization_closure_cleanup(:'org',:'closure',1,:'next_attempt','storage_outcome_unknown','direct_assets')::text as physical_failure \gset
select public.c3_lifecycle_assert(:'physical_failure'::jsonb->>'status'='failed' and :'physical_failure'::jsonb->>'code'='storage_outcome_unknown','ambiguous physical effect stays failed for explicit retry/reconciliation');
select public.c3_lifecycle_assert((select to_jsonb(c)=:'original_closure'::jsonb from public.organization_closures c where org_id=:'org'),'every claim/source/failure/retry preserves lifecycle revision and original export deadline');
select public.c3_lifecycle_error(format('update public.organization_closure_cleanup_attempts set source_outcomes=''{}'' where org_id=%L',:'org'),'42501');
select public.c3_lifecycle_error('truncate public.organization_closure_cleanup_attempts','42501');
-- Empty local stores still cannot attest450/hosted/provider/retention/refund gates.
select public.organization_closure_command(:'empty',:'empty','request',:'empty_closure',0);
update public.organization_closures set requested_at=statement_timestamp()-interval '31 days',export_until=statement_timestamp()-interval '31 days'+interval '720 hours' where org_id=:'empty';
-- Fixture-only old immutable claim models an interrupted worker without sleeps.
insert into public.organization_closure_cleanup_attempts(org_id,closure_request_id,closure_revision,attempt_id,operator_role,claimed_at,lease_until,phase)
values(:'empty',:'empty_closure',1,'b4300000-0000-4000-8000-000000000204',session_user,statement_timestamp()-interval '10 minutes',statement_timestamp()-interval '5 minutes','claimed');
select public.claim_organization_closure_cleanup(:'empty',:'empty_closure',1,'b4300000-0000-4000-8000-000000000204')::text as old_claim \gset
select public.c3_lifecycle_assert((:'old_claim'::jsonb->>'leaseUntil')::timestamptz<clock_timestamp(),'expired exact claim never renews itself');
select public.c3_lifecycle_error(format('select public.run_organization_closure_sql_cleanup(%L,%L,1,%L)',:'empty',:'empty_closure','b4300000-0000-4000-8000-000000000204'),'42501');
select public.c3_lifecycle_assert(public.organization_closure_cleanup_status(:'empty')->>'status'='failed' and public.organization_closure_cleanup_status(:'empty')->>'code'='lease_expired','expired worker is visibly failed');
select public.claim_organization_closure_cleanup(:'empty',:'empty_closure',1,'b4300000-0000-4000-8000-000000000203');
select public.run_organization_closure_sql_cleanup(:'empty',:'empty_closure',1,'b4300000-0000-4000-8000-000000000203')::text as empty_pass \gset
select public.c3_lifecycle_assert(not exists(select 1 from jsonb_each(:'empty_pass'::jsonb) where value->>'state'<>'batch_complete'),'all nine actual source procedures completed empty bounded pass');
select public.finish_organization_closure_cleanup(:'empty',:'empty_closure',1,'b4300000-0000-4000-8000-000000000203')::text as empty_result \gset
select public.c3_lifecycle_assert(:'empty_result'::jsonb->>'status'='blocked' and not(:'empty_result'::jsonb#>>'{assessment,localContentComplete}')::boolean and :'empty_result'::jsonb#>'{assessment,unqualifiedLocalOwners}'='["project_assets_and_document_activity_450"]'::jsonb and jsonb_array_length(:'empty_result'::jsonb#>'{assessment,requiredExternalQualification}')>0,'zero rows and completed batches never fabricate whole completion');
savepoint lifecycle;
update public.organization_closures set requested_at=statement_timestamp(),export_until=statement_timestamp()+interval '720 hours' where org_id=:'empty';
select public.organization_closure_command(:'empty',:'empty','cancel','b4300000-0000-4000-8000-000000000301',1);
select public.c3_lifecycle_assert(public.organization_closure_cleanup_status(:'empty')->>'status'='not_requested','canceled lifecycle cannot retain active claim status');
select public.c3_lifecycle_error(format('select public.run_organization_closure_sql_cleanup(%L,%L,1,%L)',:'empty',:'empty_closure','b4300000-0000-4000-8000-000000000203'),'42501');
rollback to lifecycle;
release lifecycle;
select 'cleanup claim/status/fixed lease/partial batches/failure/safe retry/qualification gates passed';
rollback;
