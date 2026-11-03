-- Full-schema owned native clone only. No real/provider objects are touched.
do $$begin if current_database() not like 'ch_c3_core_%' or current_setting('coach_house.core_cleanup_fixture',true) is distinct from 'isolated-test-only' then raise exception 'Owned core cleanup fixture required';end if;end$$;
begin;
create function public.c3_core_assert(ok boolean,message text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'Assertion failed: %',message;end if;end$$;
create function public.c3_core_error(command text,expected text) returns void language plpgsql as $$begin begin execute command;exception when others then if sqlstate=expected then return;end if;raise exception 'Expected %, got %: %',expected,sqlstate,sqlerrm;end;raise exception 'Unexpected success: %',command;end$$;
set local request.jwt.claim.role='service_role';
set local request.headers='{"x-coach-house-actor-id":"e972bc07-fbf5-4fc8-a416-7f00910a71e2"}';
\set org 'e972bc07-fbf5-4fc8-a416-7f00910a71e2'
\set other 'b80a076c-8ab7-4e16-90b7-98bdcbb09382'
\set closure 'b5000000-0000-4000-8000-000000000001'
\set operation 'b5000000-0000-4000-8000-000000000002'
\set file 'b5000000-0000-4000-8000-000000000003'
\set foreign_file 'b5000000-0000-4000-8000-000000000004'
\set binding_file 'b5000000-0000-4000-8000-000000000005'
select :'org'||'/library/'||:'file'||'-core.md' as path,
 :'org'||'/library/'||:'foreign_file'||'-foreign.md' as foreign_path,
 :'org'||'/library/'||:'binding_file'||'-binding.md' as binding_path \gset
create temporary table protected_before as select 'auth' kind,md5(coalesce(jsonb_agg(to_jsonb(u) order by id)::text,'')) value from auth.users u
union all select 'other_org',md5(to_jsonb(o)::text) from public.organizations o where user_id=:'other'
union all select 'financial',md5(coalesce(jsonb_agg(to_jsonb(f) order by id)::text,'')) from public.fiscal_sponsorship_documents f;
select public.c3_core_assert(public.project_retired_core_profile('{"roadmap":{"sections":{"budget":{"budgetRows":[{"amount":7}]},"origin_story":{"content":"old"},"unknown":{"content":"retain"}}},"mission":"remove","documents":{"w9":{"path":"retain"}}}')='{"roadmap":{"sections":{"unknown":{"content":"retain"}}},"documents":{"w9":{"path":"retain"}}}'::jsonb,'legacy full planning projection preserves unknown and physical binding');
select public.c3_core_error($q$select public.project_retired_core_profile('{"roadmap":{"sections":[{"content":"missing identity"}]}}')$q$,'42501');
select public.c3_core_error($q$select public.project_retired_core_profile('{"roadmap":[]}')$q$,'42501');
select public.c3_core_error($q$select public.project_retired_core_profile('{"roadmap":{"sections":{"budget":"malformed"}}}')$q$,'42501');
insert into public.organization_document_files(id,org_id,name,mime_type,size_bytes,storage_path,created_by)
values(:'file',:'org','core.md','text/markdown',4,:'path',:'org'),(:'foreign_file',:'org','foreign.md','text/markdown',4,:'foreign_path',:'org'),(:'binding_file',:'org','binding.md','text/markdown',4,:'binding_path',:'org');
insert into storage.objects(bucket_id,name,metadata) values('org-documents',:'path','{"size":4}'),('org-documents',:'foreign_path','{"size":4}'),('org-documents',:'binding_path','{"size":4}');
update public.organizations set profile=jsonb_build_object('mission',:'path','vision','remove','values','remove','needStatement','remove','need_statement','remove','description','remove','boilerplate','remove',
 'org_people',jsonb_build_array(jsonb_build_object('id','retained-contact','name','Retained pending operating cleanup')),
 'documents',jsonb_build_object('w9',jsonb_build_object('path',:'binding_path')),'policies',jsonb_build_array(jsonb_build_object('id','retained-policy','document',jsonb_build_object('path',:'binding_path'))),
 'unknownField','retain','roadmap',jsonb_build_object('sections',(select jsonb_agg(jsonb_build_object('id',id,'title','Owned','content',:'path','budgetRows',jsonb_build_array(jsonb_build_object('amount',9)))) from unnest(public.closure_core_section_ids()) id))) where user_id=:'org';
-- Replace only this transaction's owned fixture copies before closing.
delete from public.organization_core_document_versions where org_id=:'org';
delete from public.organization_core_document_sessions where org_id=:'org';
delete from public.organization_core_document_presence where org_id=:'org';
insert into public.organization_core_document_versions(id,org_id,section_id,content,actor_id)
select ('b5000000-0000-4000-8000-'||lpad((100+n)::text,12,'0'))::uuid,:'org','budget',jsonb_build_object('imageUrl','http://127.0.0.1:55321/storage/v1/object/sign/org-documents/'||:'path'||'?token=fixture-only','budgetRows',jsonb_build_array(jsonb_build_object('amount',n))),:'org' from generate_series(1,55)n;
insert into public.organization_core_document_versions(org_id,section_id,content,actor_id) values(:'org','unknown-retained','{"content":"unknown"}',:'org'),(:'other','origin_story',jsonb_build_object('imageUrl',:'foreign_path'),:'other');
insert into public.organization_core_document_sessions(org_id,section_id,generation,document,steps,section_content)
select :'org',id,gen_random_uuid(),jsonb_build_object('body',:'path'),'[]',:'path' from unnest(public.closure_core_section_ids()) id;
insert into public.organization_core_document_presence(org_id,section_id,session_id,actor_id,display_name,role,selection)
select :'org','budget','fixture-'||n,:'org','Owned name','owner',jsonb_build_object('content',:'path') from generate_series(1,55)n;
select md5((to_jsonb(o)-array['profile','updated_at'])::text) as organization_identity_before from public.organizations o where user_id=:'org' \gset
select count(*) as activity_before from public.organization_project_activity_events where org_id=:'org' \gset
insert into public.organization_closures(org_id,state,revision,request_id,requested_at,export_until)
values(:'org','closing',1,:'closure',statement_timestamp()-interval '31 days',statement_timestamp()-interval '31 days'+interval '720 hours');
insert into public.organization_closure_operations(org_id,operation_id,action,expected_revision,completed_at)
select org_id,request_id,'request',0,requested_at from public.organization_closures where org_id=:'org';
select public.c3_core_error(format('select public.reserve_expired_closure_document_purge(%L,%L,%L,1,%L)',:'org',:'file',:'closure',:'operation'),'PT409');
select public.c3_core_error(format('select public.purge_expired_organization_core_content(%L,%L,2,%L)',:'org',:'closure',:'operation'),'42501');
savepoint early;
update public.organization_closures set requested_at=clock_timestamp(),export_until=clock_timestamp()+interval '720 hours' where org_id=:'org';
select public.c3_core_error(format('select public.purge_expired_organization_core_content(%L,%L,1,%L)',:'org',:'closure',:'operation'),'42501');
rollback to early;
release early;
select public.c3_core_assert(not has_function_privilege('service_role','public.purge_expired_organization_core_content(uuid,uuid,integer,uuid)','execute') and not has_function_privilege('authenticated','public.purge_expired_organization_core_content(uuid,uuid,integer,uuid)','execute'),'operator ACL');
savepoint api_actor;
set local role service_role;
select public.c3_core_error(format('select public.purge_expired_organization_core_content(%L,%L,1,%L)',:'org',:'closure',:'operation'),'42501');
reset role;
rollback to api_actor;
release api_actor;
savepoint atomic;
select public.purge_expired_organization_core_content(:'org',:'closure',1,:'operation');
rollback to atomic;
release atomic;
select public.c3_core_assert((select count(*)=55 from public.organization_core_document_versions where org_id=:'org' and section_id='budget') and not exists(select 1 from public.organization_closure_core_cleanups where org_id=:'org'),'transaction rollback restores content and receipt');
select public.purge_expired_organization_core_content(:'org',:'closure',1,:'operation')::text as receipt \gset
select public.c3_core_assert((:'receipt'::jsonb->>'deletedVersions')::integer=50 and (:'receipt'::jsonb->>'deletedSessions')::integer=19 and (:'receipt'::jsonb->>'deletedPresence')::integer=50 and (:'receipt'::jsonb->>'moreRemainingAtCommit')::boolean,'bounded first batch');
select public.c3_core_assert(public.purge_expired_organization_core_content(:'org',:'closure',1,:'operation')=:'receipt'::jsonb,'exact retry immutable result');
select public.c3_core_assert((select profile#>'{roadmap,sections}'='[]'::jsonb and not(profile ? 'mission') and not(profile ? 'needStatement') and profile ? 'org_people' and profile ? 'documents' and profile ? 'policies' and profile->>'unknownField'='retain' from public.organizations where user_id=:'org'),'full known planning removed; physical and operating bindings retained');
select public.c3_core_assert((select md5((to_jsonb(o)-array['profile','updated_at'])::text)=:'organization_identity_before' from public.organizations o where user_id=:'org'),'minimal organization identity preserved');
select public.c3_core_assert((select count(*)=:'activity_before'::integer from public.organization_project_activity_events where org_id=:'org'),'scrub creates no copied history titles/activity');
select public.c3_core_error(format('update public.organizations set profile=''{}'' where user_id=%L',:'org'),'42501');
select public.c3_core_error(format('delete from public.organization_core_document_versions where org_id=%L',:'org'),'42501');
select public.c3_core_error(format('update public.organization_closure_core_cleanups set result=''{}'' where org_id=%L',:'org'),'42501');
select public.c3_core_error('truncate public.organization_closure_core_cleanups','42501');
select public.c3_core_error(format('select public.reserve_expired_closure_document_purge(%L,%L,%L,1,%L)',:'org',:'file',:'closure',:'operation'),'PT409');
select public.purge_expired_organization_core_content(:'org',:'closure',1,'b5000000-0000-4000-8000-000000000010')::text as second \gset
select public.c3_core_assert((:'second'::jsonb->>'deletedVersions')::integer=5 and (:'second'::jsonb->>'deletedPresence')::integer=5 and not(:'second'::jsonb->>'moreRemainingAtCommit')::boolean and (:'second'::jsonb->>'unknownCoreSectionsRequireReconciliation')::boolean,'remaining batch preserves unknown reconciliation');
select public.purge_expired_organization_core_content(:'org',:'closure',1,'b5000000-0000-4000-8000-000000000011')::text as empty \gset
select public.c3_core_assert((:'empty'::jsonb->>'deletedVersions')::integer=0 and not(:'empty'::jsonb->>'profileChanged')::boolean,'empty stable pass');
select public.c3_core_assert((public.reserve_expired_closure_document_purge(:'org',:'file',:'closure',1,'b5000000-0000-4000-8000-000000000012')->'paths')=jsonb_build_array(:'path'),'owned reference retirement unlocks existing exact library purge');
select public.c3_core_error(format('select public.reserve_expired_closure_document_purge(%L,%L,%L,1,%L)',:'org',:'foreign_file',:'closure','b5000000-0000-4000-8000-000000000013'),'PT409');
select public.c3_core_error(format('select public.reserve_expired_closure_document_purge(%L,%L,%L,1,%L)',:'org',:'binding_file',:'closure','b5000000-0000-4000-8000-000000000014'),'PT409');
select public.c3_core_assert((select count(*)=3 from storage.objects where bucket_id='org-documents' and name in(:'path',:'foreign_path',:'binding_path')),'this stage does not delete physical source metadata');
savepoint lifecycle;
select public.c3_core_error(format('select public.organization_closure_command(%L,%L,''cancel'',%L,1)',:'org',:'org','b5000000-0000-4000-8000-000000000015'),'42501');
update public.organization_closures set requested_at=statement_timestamp(),export_until=statement_timestamp()+interval '720 hours' where org_id=:'org';
select public.organization_closure_command(:'org',:'org','cancel','b5000000-0000-4000-8000-000000000015',1);
select public.c3_core_error(format('select public.purge_expired_organization_core_content(%L,%L,1,%L)',:'org',:'closure',:'operation'),'42501');
select public.organization_closure_command(:'org',:'org','request','b5000000-0000-4000-8000-000000000016',2);
select public.c3_core_error(format('select public.purge_expired_organization_core_content(%L,%L,1,%L)',:'org',:'closure',:'operation'),'42501');
rollback to lifecycle;
release lifecycle;
select public.c3_core_assert((select value from protected_before where kind='auth')=(select md5(coalesce(jsonb_agg(to_jsonb(u) order by id)::text,'')) from auth.users u),'shared Auth preserved');
select public.c3_core_assert((select value from protected_before where kind='other_org')=(select md5(to_jsonb(o)::text) from public.organizations o where user_id=:'other'),'other organization preserved');
select public.c3_core_assert((select value from protected_before where kind='financial')=(select md5(coalesce(jsonb_agg(to_jsonb(f) order by id)::text,'')) from public.fiscal_sponsorship_documents f),'independent financial records preserved');
select 'core projection/bounded cleanup/guard/retry/lifecycle/library dependency/preservation pass';
rollback;
