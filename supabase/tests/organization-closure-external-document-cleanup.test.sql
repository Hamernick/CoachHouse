-- Existing full-schema source owners +370/410 in an owned disposable clone.
do $$begin if current_database() not like 'ch_c3_external_%' or current_setting('coach_house.external_cleanup_fixture',true) is distinct from 'isolated-test-only' then raise exception 'Owned external cleanup fixture required';end if;end$$;
begin;
create function public.c3_external_assert(ok boolean,message text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'Assertion failed: %',message;end if;end$$;
create function public.c3_external_error(command text,expected text) returns void language plpgsql as $$begin begin execute command;exception when others then if sqlstate=expected then return;end if;raise exception 'Expected %, got %: %',expected,sqlstate,sqlerrm;end;raise exception 'Unexpected success: %',command;end$$;
\set org 'e972bc07-fbf5-4fc8-a416-7f00910a71e2'
\set other 'b80a076c-8ab7-4e16-90b7-98bdcbb09382'
\set connection 'c1000000-0000-4000-8000-000000000060'
\set closure 'c1000000-0000-4000-8000-000000000090'
\set operation 'c1000000-0000-4000-8000-000000000091'
\set first 'c1000000-0000-4000-8000-000000000001'
\set foreign 'c1000000-0000-4000-8000-000000000056'
set local request.jwt.claim.role='service_role';
set local request.headers='{"x-coach-house-actor-id":"e972bc07-fbf5-4fc8-a416-7f00910a71e2"}';
select public.c3_external_assert(not exists(select 1 from public.organization_external_documents where org_id=:'org') and not exists(select 1 from public.google_drive_connections where user_id=:'org'),'isolated synthetic owner');
insert into public.google_drive_connections(id,user_id,google_subject,google_email,refresh_token_ciphertext,refresh_token_iv,refresh_token_auth_tag,key_version,granted_scopes)
values(:'connection',:'org','synthetic-subject','synthetic@example.invalid','SYNTHETIC_SHARED_TOKEN','SYNTHETIC_IV','SYNTHETIC_TAG','fixture',array['https://www.googleapis.com/auth/drive.file']);
insert into public.organization_external_documents(id,org_id,provider_file_id,connection_id,name,mime_type,web_view_link,attached_by)
select ('c1000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,:'org','synthetic_file_'||n,:'connection','RAW_EXTERNAL_'||n,'application/vnd.google-apps.document','https://docs.google.com/document/d/synthetic_file_'||n||'/edit',:'org' from generate_series(1,55)n;
insert into public.organization_external_documents(id,org_id,provider_file_id,connection_id,name,mime_type,web_view_link,attached_by)
values(:'foreign',:'other','synthetic_file_1',:'connection','FOREIGN_REFERENCE','application/vnd.google-apps.document','https://docs.google.com/document/d/synthetic_file_1/edit',:'org');
insert into public.google_drive_oauth_intents(id,user_id,org_id,state_sha256,pkce_verifier_ciphertext,pkce_verifier_iv,pkce_verifier_auth_tag,key_version,expires_at)
select ('c1000000-0000-4000-8001-'||lpad(n::text,12,'0'))::uuid,:'org',:'org',encode(sha256(convert_to('owned-intent-'||n,'UTF8')),'hex'),'SYNTHETIC_PKCE','SYNTHETIC_IV','SYNTHETIC_TAG','fixture',now()+interval '10 minutes' from generate_series(1,55)n;
insert into public.google_drive_oauth_intents(id,user_id,org_id,state_sha256,pkce_verifier_ciphertext,pkce_verifier_iv,pkce_verifier_auth_tag,key_version,expires_at)
values('c1000000-0000-4000-8001-000000000056',:'org',:'other',repeat('f',64),'FOREIGN_PKCE','FOREIGN_IV','FOREIGN_TAG','fixture',now()+interval '10 minutes');
insert into public.organization_project_activity_events(id,org_id,entity_type,entity_id,event_type,title,metadata,actor_id,from_status,to_status)
select ('c1000000-0000-4000-8002-'||lpad(n::text,12,'0'))::uuid,:'org','file',gen_random_uuid(),'uploaded','RAW_ORPHAN',jsonb_build_object('source','organization_external_documents','privateBody','RAW_ORPHAN'),:'org',case when n=1 then 'RAW_FROM' else 'available' end,case when n=1 then 'RAW_TO' else 'inaccessible' end from generate_series(1,2)n;
insert into public.organization_project_activity_events(id,org_id,entity_type,entity_id,event_type,title,metadata)
values('c1000000-0000-4000-8002-000000000003',:'org','file',gen_random_uuid(),'uploaded','KEEP_OTHER_SOURCE','{"source":"organization_document_files","body":"KEEP"}'),('c1000000-0000-4000-8002-000000000004',:'org','fiscal_application',gen_random_uuid(),'updated','KEEP_FINANCIAL','{"body":"KEEP"}');
select public.c3_external_error(format('update public.google_drive_oauth_intents set org_id=%L where id=%L',:'other','c1000000-0000-4000-8001-000000000001'),'42501');
create temporary table external_preserved as
select 'connection' kind,md5(to_jsonb(c)::text) value from public.google_drive_connections c where id=:'connection'
union all select 'foreign_reference',md5(to_jsonb(d)::text) from public.organization_external_documents d where id=:'foreign'
union all select 'foreign_intent',md5(to_jsonb(i)::text) from public.google_drive_oauth_intents i where id='c1000000-0000-4000-8001-000000000056'
union all select 'auth',md5(jsonb_agg(to_jsonb(u) order by id)::text) from auth.users u
union all select 'activity_identities',md5(jsonb_agg(to_jsonb(e)-array['title','metadata','from_status','to_status'] order by id)::text) from public.organization_project_activity_events e where org_id=:'org' and entity_type='file' and metadata->>'source'='organization_external_documents'
union all select 'other_activity',md5(jsonb_agg(to_jsonb(e) order by id)::text) from public.organization_project_activity_events e where not(org_id=:'org' and entity_type='file' and metadata->>'source'='organization_external_documents');
-- Malformed cross-owner historical event is not inferred to be owned content.
savepoint foreign_alias;
insert into public.organization_project_activity_events(id,org_id,entity_type,entity_id,event_type,title,metadata)
values('00000000-0000-4000-8000-000000000001',:'org','file',:'foreign','uploaded','FOREIGN_ALIAS','{"source":"organization_external_documents"}');
insert into public.organization_closures(org_id,state,revision,request_id,requested_at,export_until)
values(:'org','closing',1,:'closure',now()-interval '31 days',now()-interval '24 hours');
select public.c3_external_error(format('select public.purge_expired_organization_external_documents(%L,%L,1,%L)',:'org',:'closure',:'operation'),'42501');
select public.c3_external_assert((select count(*)=55 from public.organization_external_documents where org_id=:'org'),'foreign alias denial changes no sources');
rollback to foreign_alias;release foreign_alias;
insert into public.organization_closures(org_id,state,revision,request_id,requested_at,export_until)
values(:'org','closing',1,:'closure',now()-interval '31 days',now()-interval '24 hours');
insert into public.organization_closure_operations(org_id,operation_id,action,expected_revision,completed_at)
select org_id,request_id,'request',0,requested_at from public.organization_closures where org_id=:'org';
select public.c3_external_error(format('update public.google_drive_oauth_intents set consumed_at=now() where id=%L','c1000000-0000-4000-8001-000000000001'),'42501');
select public.c3_external_error(format('insert into public.google_drive_oauth_intents(user_id,org_id,state_sha256,pkce_verifier_ciphertext,pkce_verifier_iv,pkce_verifier_auth_tag,key_version,expires_at) values(%L,%L,%L,''synthetic'',''synthetic'',''synthetic'',''fixture'',now()+interval ''5 minutes'')',:'org',:'org',repeat('e',64)),'42501');
select public.c3_external_error(format('delete from public.organization_external_documents where id=%L',:'first'),'42501');
select public.c3_external_error(format('select public.purge_expired_organization_external_documents(%L,%L,2,%L)',:'org',:'closure',:'operation'),'42501');
savepoint early;
update public.organization_closures set requested_at=statement_timestamp(),export_until=statement_timestamp()+interval '720 hours' where org_id=:'org';
select public.c3_external_error(format('select public.purge_expired_organization_external_documents(%L,%L,1,%L)',:'org',:'closure',:'operation'),'42501');
rollback to early;release early;
savepoint api;set local role service_role;
select public.c3_external_error(format('select public.purge_expired_organization_external_documents(%L,%L,1,%L)',:'org',:'closure',:'operation'),'42501');
reset role;rollback to api;release api;
savepoint other_org_admission;
set local role service_role;
insert into public.google_drive_oauth_intents(id,user_id,org_id,state_sha256,pkce_verifier_ciphertext,pkce_verifier_iv,pkce_verifier_auth_tag,key_version,expires_at)
values('c1000000-0000-4000-8001-000000000057',:'org',:'other',repeat('c',64),'SYNTHETIC','SYNTHETIC','SYNTHETIC','fixture',now()+interval '5 minutes');
update public.google_drive_oauth_intents set consumed_at=now() where id='c1000000-0000-4000-8001-000000000057';
reset role;
select public.c3_external_assert((select consumed_at is not null from public.google_drive_oauth_intents where id='c1000000-0000-4000-8001-000000000057'),'same user retains active otherorganization intent admission');
rollback to other_org_admission;release other_org_admission;
savepoint safe_departure;
set local role service_role;
delete from public.google_drive_oauth_intents where id='c1000000-0000-4000-8001-000000000001';
reset role;
select public.c3_external_assert(not exists(select 1 from public.google_drive_oauth_intents where id='c1000000-0000-4000-8001-000000000001'),'existing safe intent expiry/delete remains possible');
rollback to safe_departure;release safe_departure;
savepoint atomic;
select public.purge_expired_organization_external_documents(:'org',:'closure',1,:'operation');
rollback to atomic;release atomic;
select public.c3_external_assert((select count(*)=55 from public.organization_external_documents where org_id=:'org') and (select count(*)=55 from public.google_drive_oauth_intents where org_id=:'org') and not exists(select 1 from public.organization_closure_external_cleanups where org_id=:'org'),'transaction rollback retains source/intents/receipt');
select public.purge_expired_organization_external_documents(:'org',:'closure',1,:'operation')::text as first_result \gset
select public.c3_external_assert((:'first_result'::jsonb->>'deletedReferences')::integer=50 and (:'first_result'::jsonb->>'deletedOAuthIntents')::integer=50 and (:'first_result'::jsonb->>'retiredActivityPayloads')::integer=50 and (:'first_result'::jsonb->>'moreRemainingAtCommit')::boolean,'bounded50 batch');
select public.c3_external_assert(public.purge_expired_organization_external_documents(:'org',:'closure',1,:'operation')=:'first_result'::jsonb,'exact retry cannot delete next batch');
select public.purge_expired_organization_external_documents(:'org',:'closure',1,'c1000000-0000-4000-8000-000000000092')::text as second_result \gset
select public.c3_external_assert((:'second_result'::jsonb->>'deletedReferences')::integer=5 and (:'second_result'::jsonb->>'deletedOAuthIntents')::integer=5 and (:'second_result'::jsonb->>'retiredActivityPayloads')::integer=7 and not(:'second_result'::jsonb->>'moreRemainingAtCommit')::boolean,'remaining reference/intent/activity batch');
select public.c3_external_assert((public.purge_expired_organization_external_documents(:'org',:'closure',1,'c1000000-0000-4000-8000-000000000093')->>'retiredActivityPayloads')::integer=0,'empty stable pass');
select public.c3_external_assert((select count(*)=57 and bool_and(title='Retired content' and metadata='{"source":"organization_external_documents"}'::jsonb and (from_status is null or from_status='available') and (to_status is null or to_status='inaccessible')) from public.organization_project_activity_events where org_id=:'org' and entity_type='file' and metadata->>'source'='organization_external_documents'),'copied payloads retired without recaptured filename event');
select public.c3_external_assert((select from_status='available' and to_status='inaccessible' from public.organization_project_activity_events where id='c1000000-0000-4000-8002-000000000002'),'known external file status facts preserved');
select public.c3_external_assert((select value from external_preserved where kind='activity_identities')=(select md5(jsonb_agg(to_jsonb(e)-array['title','metadata','from_status','to_status'] order by id)::text) from public.organization_project_activity_events e where org_id=:'org' and entity_type='file' and metadata->>'source'='organization_external_documents'),'minimal event identities/type/actor/time preserved');
select public.c3_external_assert((select value from external_preserved where kind='other_activity')=(select md5(jsonb_agg(to_jsonb(e) order by id)::text) from public.organization_project_activity_events e where not(org_id=:'org' and entity_type='file' and metadata->>'source'='organization_external_documents')),'other file/financial activity preserved');
select public.c3_external_assert((select value from external_preserved where kind='connection')=(select md5(to_jsonb(c)::text) from public.google_drive_connections c where id=:'connection'),'shared user connection/token bytes unchanged');
select public.c3_external_assert((select value from external_preserved where kind='foreign_reference')=(select md5(to_jsonb(d)::text) from public.organization_external_documents d where id=:'foreign'),'same provider file remains referenced by other organization');
select public.c3_external_assert((select value from external_preserved where kind='foreign_intent')=(select md5(to_jsonb(i)::text) from public.google_drive_oauth_intents i where id='c1000000-0000-4000-8001-000000000056'),'same user otherorganization intent preserved');
select public.c3_external_assert((select value from external_preserved where kind='auth')=(select md5(jsonb_agg(to_jsonb(u) order by id)::text) from auth.users u),'shared Auth preserved');
select public.c3_external_error(format('update public.organization_closure_external_cleanups set result=''{}'' where org_id=%L',:'org'),'42501');
select public.c3_external_error('truncate public.organization_closure_external_cleanups','42501');
savepoint lifecycle;
select public.c3_external_error(format('select public.organization_closure_command(%L,%L,''cancel'',%L,1)',:'org',:'org','c1000000-0000-4000-8000-000000000094'),'42501');
update public.organization_closures set requested_at=statement_timestamp(),export_until=statement_timestamp()+interval '720 hours' where org_id=:'org';
select public.organization_closure_command(:'org',:'org','cancel','c1000000-0000-4000-8000-000000000094',1);
select public.c3_external_error(format('select public.purge_expired_organization_external_documents(%L,%L,1,%L)',:'org',:'closure',:'operation'),'42501');
select public.organization_closure_command(:'org',:'org','request','c1000000-0000-4000-8000-000000000095',2);
select public.c3_external_error(format('select public.purge_expired_organization_external_documents(%L,%L,1,%L)',:'org',:'closure',:'operation'),'42501');
rollback to lifecycle;release lifecycle;
select 'external references/intents/activity/bounded retry/closure fence/shared identity preservation pass';
rollback;
