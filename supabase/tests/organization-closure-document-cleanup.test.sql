-- Explicit owned full-schema clone; all synthetic rows below roll back.
do $$begin if (current_database() not like 'ch_c3_document_%' and current_database() not like 'ch_o3_cleanup_c3_%') or current_setting('coach_house.closure_document_fixture',true) is distinct from 'isolated-test-only' then raise exception 'Owned closure document fixture required';end if;end$$;
begin;
set local storage.allow_delete_query='true'; -- metadata fixture only; physical proof separate
create function public.c3_document_assert(ok boolean,message text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'Assertion failed: %',message;end if;end$$;
create function public.c3_document_error(command text,expected text) returns void language plpgsql as $$begin begin execute command;exception when others then if sqlstate=expected then return;end if;raise exception 'Expected %, got %: % (command %)',expected,sqlstate,sqlerrm,command;end;raise exception 'Unexpected success: %',command;end$$;
set local request.jwt.claim.role='service_role';
set local request.headers='{"x-coach-house-actor-id":"e972bc07-fbf5-4fc8-a416-7f00910a71e2"}';
\set org 'e972bc07-fbf5-4fc8-a416-7f00910a71e2'
\set file 'a0000000-0000-4000-8000-000000000001'
\set version_op 'a0000000-0000-4000-8000-000000000002'
\set neighbor 'a0000000-0000-4000-8000-000000000003'
\set trash 'a0000000-0000-4000-8000-000000000004'
\set legacy 'a0000000-0000-4000-8000-000000000005'
\set core 'a0000000-0000-4000-8000-000000000006'
\set tampered 'a0000000-0000-4000-8000-000000000007'
\set closure 'a0000000-0000-4000-8000-000000000090'
\set operation 'a0000000-0000-4000-8000-000000000091'
insert into public.organization_document_files(id,org_id,name,mime_type,size_bytes,storage_path,created_by)
select ('a0000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,:'org','closure-'||n||'.md','text/markdown',10,:'org'||'/library/a0000000-0000-4000-8000-'||lpad(n::text,12,'0')||'-closure.md',:'org' from generate_series(1,9)n;
update public.organization_document_files set deleted_at=clock_timestamp() where id=:'trash';
update public.organization_document_files set deleted_at=clock_timestamp()-interval '31 days' where id=:'tampered';
update public.organization_document_files set storage_path=:'org'||'/library/legacy.md' where id=:'legacy';
insert into storage.objects(bucket_id,name,metadata) select 'org-documents',storage_path,'{"size":10}'::jsonb from public.organization_document_files where id between :'file'::uuid and 'a0000000-0000-4000-8000-000000000009'::uuid;
select public.c3_document_error(format('select public.reserve_expired_closure_document_purge(%L,%L,%L,1,%L)',:'org',:'file',:'closure',:'operation'),'40001');
select updated_at as stamp from public.organization_document_files where id=:'file' \gset
select public.initialize_document_room(:'file',:'org','original',:'stamp','AQHVhqvjBQAHAQdjb250ZW50AwlwYXJhZ3JhcGgA');
select generation from public.document_collaboration_rooms where file_id=:'file' \gset
select public.reserve_uploaded_document_version(:'file',:'org',:'version_op',:'generation','original',:'stamp',0,repeat('a',64),repeat('b',64),3);
insert into storage.objects(bucket_id,name,metadata) values('org-documents',:'org'||'/library/versions/'||:'file'||'/'||:'version_op'||'.md','{"size":3}'),('org-documents',:'org'||'/library/versions/'||:'file'||'/'||:'version_op'||'-previous.md','{"size":10}');
select public.commit_uploaded_document_version(:'file',:'org',:'version_op',:'generation','original',:'stamp',0,repeat('a',64),repeat('b',64),3);
-- A pending real stage must be abandoned before exact Storage DELETE admission.
select base_revision as saved_revision,base_updated_at as saved_stamp from public.document_collaboration_rooms where file_id=:'file' \gset
\set pending 'a0000000-0000-4000-8000-000000000008'
select public.reserve_uploaded_document_version(:'file',:'org',:'pending',:'generation',:'saved_revision',:'saved_stamp',0,repeat('b',64),repeat('c',64),4);
insert into storage.objects(bucket_id,name,metadata) values('org-documents',:'org'||'/library/versions/'||:'file'||'/'||:'pending'||'.md','{"size":4}');
-- Service-writable ordinary receipt must not become private operator authority.
select public.reserve_document_file_purge(:'org',:'tampered',:'org');
update public.document_file_purges set paths=array[(select storage_path from public.organization_document_files where id=:'neighbor')] where file_id=:'tampered';
-- Historical pre-provenance operation, with its original guard restored before
-- invoking cleanup: unsupported history must remain blocked, not guessed.
alter table public.document_version_operations disable trigger document_purge_fence;
insert into public.document_version_operations(file_id,request_id,org_id,actor_id,fingerprint,staged_bytes,state)
values('a0000000-0000-4000-8000-000000000009','a0000000-0000-4000-8000-000000000010',:'org',:'org','legacy',0,'committed');
alter table public.document_version_operations enable trigger document_purge_fence;
insert into public.organization_core_document_versions(org_id,section_id,content,actor_id)
values('b80a076c-8ab7-4e16-90b7-98bdcbb09382','c3-core-reference',jsonb_build_object('imageUrl','http://127.0.0.1:55321/storage/v1/object/sign/org-documents/'||:'org'||'/library/a0000000-0000-4000-8000-000000000006-closure.md?token=synthetic-reference'),'b80a076c-8ab7-4e16-90b7-98bdcbb09382');
-- Independently retained reviewed copies have evidence-only source IDs. These
-- legacy fixtures exercise real audience readers and FK behavior; no new app
-- cross-organization publication authorization is inferred from fixture inserts.
\set copy_org 'b80a076c-8ab7-4e16-90b7-98bdcbb09382'
\set copy_page 'a0000000-0000-4000-8000-000000000101'
\set image 'a0000000-0000-4000-8000-000000000102'
\set document 'a0000000-0000-4000-8000-000000000103'
insert into public.organization_workspace_pages(id,org_id,title,particle_ids,published_at,published_snapshot)
values(:'copy_page',:'copy_org','Retained copies',array[:'image'::uuid,:'document'::uuid],clock_timestamp(),jsonb_build_object('version',1,'title','Retained copies','brand',jsonb_build_object('name','Synthetic retained copies','organizationSlug','c3-retained'),
'items',jsonb_build_array(jsonb_build_object('id',:'image','content',jsonb_build_object('kind','image','assetId',:'image')),jsonb_build_object('id',:'document','content',jsonb_build_object('kind','document','assetId',:'document')))));
insert into public.workspace_page_image_grants(id,page_id,org_id,revision,source_id,storage_path,sha256,size_bytes,width,height)
values(:'image',:'copy_page',:'copy_org',1,:'file',:'copy_org'||'/c3-retained-image.webp',repeat('d',64),3,1,1);
insert into public.workspace_page_document_grants(id,page_id,org_id,revision,source_id,storage_path,sha256,size_bytes)
values(:'document',:'copy_page',:'copy_org',1,:'file',:'copy_org'||'/c3-retained-document.txt',repeat('e',64),4);
insert into storage.objects(bucket_id,name,metadata) values('workspace-page-assets',:'copy_org'||'/c3-retained-image.webp','{"size":3}'),('workspace-page-assets',:'copy_org'||'/c3-retained-document.txt','{"size":4}');
-- Fixtures model an actual expired request without a production clock override.
insert into public.organization_closures(org_id,state,revision,request_id,requested_at,export_until)
values(:'org','closing',1,:'closure',statement_timestamp()-interval '31 days',statement_timestamp()-interval '31 days'+interval '720 hours');
insert into public.organization_closure_operations(org_id,operation_id,action,expected_revision,completed_at)
select org_id,request_id,'request',0,requested_at from public.organization_closures where org_id=:'org';
select public.c3_document_error(format('select public.reserve_expired_closure_document_purge(%L,%L,%L,2,%L)',:'org',:'file',:'closure',:'operation'),'40001');
select public.c3_document_error(format('select public.reserve_expired_closure_document_purge(%L,%L,%L,1,%L)',:'org',:'legacy',:'closure',:'operation'),'PT409');
select public.c3_document_error(format('select public.reserve_expired_closure_document_purge(%L,%L,%L,1,%L)',:'org',:'core',:'closure',:'operation'),'PT409');
select public.c3_document_error(format('select public.reserve_expired_closure_document_purge(%L,%L,%L,1,%L)',:'org','a0000000-0000-4000-8000-000000000009',:'closure',:'operation'),'PT409');
savepoint private_boundary;
update public.organization_closures set requested_at=statement_timestamp(),export_until=statement_timestamp()+interval '720 hours' where org_id=:'org';
select public.c3_document_error(format('select public.reserve_expired_closure_document_purge(%L,%L,%L,1,%L)',:'org',:'file',:'closure',:'operation'),'42501');
rollback to private_boundary;
release private_boundary;
savepoint private_bucket;
update storage.buckets set public=true where id='org-documents';
select public.c3_document_error(format('select public.reserve_expired_closure_document_purge(%L,%L,%L,1,%L)',:'org',:'file',:'closure',:'operation'),'42501');
rollback to private_bucket;
release private_bucket;
select public.c3_document_error(format('select public.reserve_expired_closure_document_purge(%L,%L,%L,1,%L)',:'org',:'tampered',:'closure',:'operation'),'42501');
select public.c3_document_assert(not exists(select 1 from public.organization_closure_document_cleanups where file_id=:'tampered'),'tampered ordinary receipt not promoted');
select public.c3_document_assert(exists(select 1 from storage.objects where bucket_id='org-documents' and name=(select storage_path from public.organization_document_files where id=:'neighbor')),'unreferenced neighbor preserved');
select public.c3_document_assert(not has_function_privilege('service_role','public.reserve_expired_closure_document_purge(uuid,uuid,uuid,integer,uuid)','execute') and not has_function_privilege('authenticated','public.finish_expired_closure_document_purge(uuid,uuid,uuid,integer,uuid)','execute'),'private operator ACL');
select public.c3_document_error(format('select public.reserve_document_file_purge(%L,%L,%L)',:'org',:'trash',:'org'),'42501');
select public.c3_document_error(format('delete from storage.objects where bucket_id=''org-documents'' and name=%L',:'org'||'/library/a0000000-0000-4000-8000-000000000001-closure.md'),'42501');
select public.reserve_expired_closure_document_purge(:'org',:'file',:'closure',1,:'operation')::text as reservation \gset
select public.c3_document_assert(public.reserve_expired_closure_document_purge(:'org',:'file',:'closure',1,:'operation')=:'reservation'::jsonb,'same frozen closure path set on retry');
select public.c3_document_assert((select state='abandoned' from public.document_version_operations where file_id=:'file' and request_id=:'pending'),'pending stage canceled before deletion');
select public.c3_document_error(format('select public.finish_expired_closure_document_purge(%L,%L,%L,1,%L)',:'org',:'file',:'closure',:'operation'),'PT409');
select public.c3_document_error(format('update public.organization_closure_document_cleanups set paths=array[%L] where file_id=%L',:'org'||'/library/neighbor.md',:'file'),'42501');
select public.c3_document_error(format('update public.organization_document_files set deleted_at=null where id=%L',:'file'),'42501');
select public.c3_document_error(format('insert into storage.objects(bucket_id,name,metadata) values(''org-documents'',%L,''{"size":4}'')',:'org'||'/library/versions/'||:'file'||'/'||:'pending'||'-previous.md'),'42501');
delete from storage.objects where bucket_id='org-documents' and name=:'org'||'/library/a0000000-0000-4000-8000-000000000001-closure.md';
select public.c3_document_error(format('select public.finish_expired_closure_document_purge(%L,%L,%L,1,%L)',:'org',:'file',:'closure',:'operation'),'PT409');
select public.c3_document_assert((select count(*)=2 from public.document_file_versions where file_id=:'file'),'partial deletion retains canonical history');
delete from storage.objects where bucket_id='org-documents' and name in(select jsonb_array_elements_text(:'reservation'::jsonb->'paths'));
select public.c3_document_assert(public.finish_expired_closure_document_purge(:'org',:'file',:'closure',1,:'operation'),'finish exact absent objects');
select public.c3_document_assert(public.finish_expired_closure_document_purge(:'org',:'file',:'closure',1,:'operation'),'lost reply finish retry');
select public.c3_document_assert((public.reserve_expired_closure_document_purge(:'org',:'file',:'closure',1,:'operation')->>'complete')::boolean,'completed reserve retry');
select public.c3_document_assert(not exists(select 1 from public.organization_document_files where id=:'file') and not exists(select 1 from public.document_file_versions where file_id=:'file'),'canonical metadata and history removed only after exact objects');
select public.c3_document_assert(exists(select 1 from public.organization_document_files where id=:'neighbor') and exists(select 1 from storage.objects where name=(select storage_path from public.organization_document_files where id=:'neighbor')),'unselected files and objects preserved');
select public.c3_document_assert((public.read_workspace_page_image(:'image','editor',:'copy_org')->>'path')=:'copy_org'||'/c3-retained-image.webp','other organization copied image reader survives original deletion');
select public.c3_document_assert((public.read_workspace_page_document(:'document','editor',:'copy_org')->>'path')=:'copy_org'||'/c3-retained-document.txt','other organization copied document reader survives original deletion');
select public.c3_document_assert(exists(select 1 from storage.objects where bucket_id='workspace-page-assets' and name=:'copy_org'||'/c3-retained-image.webp') and exists(select 1 from storage.objects where bucket_id='workspace-page-assets' and name=:'copy_org'||'/c3-retained-document.txt'),'copied object metadata retained independently');
select 'modern-active/partial-retry/stage-fence/canonical-preservation pass';
-- Newly trashed content qualifies at the closure deadline without inventing a
-- second trash-age wait. Ordinary recently-deleted behavior remains unchanged.
select public.c3_document_error(format('select public.reserve_expired_closure_document_purge(%L,%L,%L,1,%L)',:'org',:'trash',:'closure',:'operation'),'23505');
\set trash_operation 'a0000000-0000-4000-8000-000000000092'
select public.reserve_expired_closure_document_purge(:'org',:'trash',:'closure',1,:'trash_operation');
delete from storage.objects where bucket_id='org-documents' and name=(select storage_path from public.organization_document_files where id=:'trash');
select public.c3_document_assert(public.finish_expired_closure_document_purge(:'org',:'trash',:'closure',1,:'trash_operation'),'newly trashed canonical unversioned purge');
select 'canonical-unversioned/closure-deadline/ACL/legacy-tamper-denial pass';
rollback;
