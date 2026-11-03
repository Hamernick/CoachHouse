-- Full canonical300–460 owned clone; fixture effects roll back.
do $$begin if current_database() not like 'ch_c3_final_%' or current_setting('coach_house.final_cleanup_fixture',true) is distinct from 'isolated-test-only' then raise exception 'Owned final cleanup fixture required';end if;end$$;
begin;
set local request.jwt.claim.role='service_role';
\set org 'c4600000-0000-4000-8000-000000000001'
\set other 'c4600000-0000-4000-8000-000000000002'
\set request 'c4600000-0000-4000-8000-000000000090'
\set confirmation 'c4600000-0000-4000-8000-000000000091'
\set attempt 'c4600000-0000-4000-8000-000000000092'
create function public.c460_assert(ok boolean,message text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'Assertion failed: %',message;end if;end$$;
create function public.c460_error(command text,expected text) returns void language plpgsql as $$begin begin execute command;exception when others then if sqlstate=expected then return;end if;raise;end;raise exception 'Unexpected success';end$$;
insert into auth.users(id,email,raw_app_meta_data) values(:'org','c460-owner@example.invalid','{"legal_consent_exempt":"service_provisioned"}'),(:'other','c460-other@example.invalid','{"legal_consent_exempt":"service_provisioned"}');
insert into public.organizations(user_id,profile) values(:'org','{"name":"Private final content","mission":"Private narrative","org_people":[{"name":"Private person"}]}'),(:'other','{"name":"Other preserved"}');
insert into public.ai_credit_policy(id) values(true) on conflict do nothing;
set local request.jwt.claim.sub='c4600000-0000-4000-8000-000000000001';
insert into public.organization_workspace_boards(org_id,state,updated_by) values(:'org','{"private":"graph"}',:'org');
insert into public.organization_workspace_pages(id,org_id,title,particle_ids) values('c4600000-0000-4000-8000-000000000010',:'org','Private form page',array['c4600000-0000-4000-8000-000000000020'::uuid]);
insert into public.organization_forms(org_id,id,intake_manager) values(:'org','c4600000-0000-4000-8000-000000000020',:'other');
insert into public.organization_form_versions(id,org_id,form_id,page_id,version) values('c4600000-0000-4000-8000-000000000030',:'org','c4600000-0000-4000-8000-000000000020','c4600000-0000-4000-8000-000000000010','{"private":"form"}');
insert into public.organization_form_responses(version_id,id,original_hash,answers) values('c4600000-0000-4000-8000-000000000030','c4600000-0000-4000-8000-000000000040',repeat('a',64),'[{"private":"response"}]');
insert into public.organization_projects(id,org_id,name,start_date,end_date,created_by) values('c4600000-0000-4000-8000-000000000200',:'org','Private project','2026-01-01','2026-12-01',:'org');
insert into public.organization_project_assets(id,org_id,project_id,name,asset_type,external_url,created_by) values('c4600000-0000-4000-8000-000000000500',:'org','c4600000-0000-4000-8000-000000000200','Private external binding','file','https://external.example.invalid/preserve-remote-file',:'org');
-- An unresolved legacy physical source remains visible in the derived counts;
-- no API, remote file deletion or physical-absence assertion is simulated.
insert into public.organization_project_assets(id,org_id,project_id,name,asset_type,storage_path,created_by) values('c4600000-0000-4000-8000-000000000501',:'org','c4600000-0000-4000-8000-000000000200','Legacy owned binding','file',:'org'||'/legacy-unresolved.txt',:'org');
insert into storage.objects(id,bucket_id,name,owner,owner_id,metadata) values('c4600000-0000-4000-8000-000000000502','project-assets',:'org'||'/legacy-unresolved.txt',:'org',:'org','{"size":10}');
insert into public.organization_project_activity_events(id,org_id,entity_type,entity_id,event_type,title,actor_id,metadata) values
 ('c4600000-0000-4000-8000-000000000600',:'org','document',:'org','updated','Private copied title',:'org','{"documentKey":"roadmap:budget","private":"copy"}'),
 ('c4600000-0000-4000-8000-000000000601',:'org','document',:'org','updated','Unresolved legacy title',:'org','{"documentKey":"unknown:legacy","private":"preserve"}');
create temporary table c460_preserved as select 'other' kind,md5(to_jsonb(o)::text) digest from public.organizations o where user_id=:'other'
union all select 'auth',md5(jsonb_agg(to_jsonb(u) order by id)::text) from auth.users u;
select public.organization_closure_command(:'org',:'org','request',:'request',0);
select public.c460_assert(not public.can_review_organization_form(:'org','c4600000-0000-4000-8000-000000000020',:'org'),'organization owner gains no response authority');
select to_jsonb(c)::text as closure_before from public.organization_closures c where org_id=:'org' \gset
select public.c460_error(format('select public.claim_organization_closure_cleanup(%L,%L,1,%L)',:'org',:'request',:'attempt'),'42501');
select public.confirm_organization_early_deletion(:'org',:'org',:'request',1,:'confirmation','organization-early-deletion-v1',true);
select public.c460_assert(not public.organization_closure_read_window(:'org'),'captured intent closes read window before original deadline');
select public.claim_organization_closure_cleanup(:'org',:'request',1,:'attempt');
select public.run_organization_closure_sql_cleanup(:'org',:'request',1,:'attempt')::text as outcomes \gset
select public.c460_assert((select count(*)=10 from jsonb_each(:'outcomes'::jsonb)) and not exists(select 1 from jsonb_each(:'outcomes'::jsonb) where value->>'state'<>'batch_complete'),'ten real source owners run under captured early eligibility');
select public.c460_assert(not exists(select 1 from public.organization_form_responses where version_id='c4600000-0000-4000-8000-000000000030') and not exists(select 1 from public.organization_workspace_boards where org_id=:'org'),'native responses retire before dependent workspace payload');
select public.c460_assert(not exists(select 1 from public.organization_project_assets where id='c4600000-0000-4000-8000-000000000500') and (select title='Retired content' and not(metadata ? 'private') from public.organization_project_activity_events where id='c4600000-0000-4000-8000-000000000600'),'tenth source retires actual external binding and exact copied activity');
select public.organization_closure_cleanup_assessment(:'org')::text as assessment \gset
select public.c460_assert(:'assessment'::jsonb#>>'{remaining,projectAssetBindings}'='1' and :'assessment'::jsonb#>>'{remaining,controlledStorageObjects}'='1' and :'assessment'::jsonb#>>'{remaining,fileDocumentActivityPayloads}'='2','actual legacy object/binding/activity remain counted');
select public.c460_assert(:'assessment'::jsonb->'unqualifiedLocalOwners'='[]'::jsonb and jsonb_array_length(:'assessment'::jsonb->'requiredExternalQualification')>0 and not(:'assessment'::jsonb->>'wholeCleanupComplete')::boolean,'only implemented450 marker removed; external qualification remains');
select public.c460_assert(public.run_organization_closure_sql_cleanup(:'org',:'request',1,:'attempt')=:'outcomes'::jsonb,'lost reply returns exact ten-source receipt');
select public.finish_organization_closure_cleanup(:'org',:'request',1,:'attempt')::text as finished \gset
select public.c460_assert(:'finished'::jsonb->>'status'='pending' and not(:'finished'::jsonb->>'wholeCleanupComplete')::boolean,'all SQL batches do not attest unresolved physical/ownership completion');
select public.c460_assert(public.finish_organization_closure_cleanup(:'org',:'request',1,:'attempt')=:'finished'::jsonb,'finished result immutable');
select public.c460_error(format('select public.organization_closure_command(%L,%L,''cancel'',gen_random_uuid(),1)',:'org',:'org'),'42501');
select public.c460_assert((select to_jsonb(c)=:'closure_before'::jsonb from public.organization_closures c where org_id=:'org'),'original720h deadline and lifecycle revision remain unchanged');
select public.c460_assert((select md5(to_jsonb(o)::text)=(select digest from c460_preserved where kind='other') from public.organizations o where user_id=:'other') and (select md5(jsonb_agg(to_jsonb(u) order by id)::text)=(select digest from c460_preserved where kind='auth') from auth.users u),'other organization and shared identities unchanged');
select public.c460_assert(not exists(select 1 from pg_proc p cross join pg_roles r where p.pronamespace='public'::regnamespace and p.proname in('organization_closure_command','confirm_organization_early_deletion','claim_organization_closure_cleanup','run_organization_closure_sql_cleanup','finish_organization_closure_cleanup','purge_expired_organization_project_file_metadata') and r.rolname in('anon','authenticated','service_role') and has_function_privilege(r.oid,p.oid,'execute')),'transition early-intent and cleanup RPCs remain private');
select 'final ten-source early cleanup, exact retries, honest remaining counts and private boundaries passed';
rollback;
