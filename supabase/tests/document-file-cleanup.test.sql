-- Full-schema synthetic clone only; every record below rolls back.
do $$ begin if current_database() not like 'ch_o3_cleanup_%' or current_setting('coach_house.document_cleanup_fixture',true) is distinct from 'isolated-test-only' then raise exception 'Owned cleanup fixture required';end if;end $$;
begin;
-- Isolated metadata-only fixture; physical Storage API proof is separate.
set local storage.allow_delete_query='true';
create function public.o3_assert(ok boolean,message text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'Assertion failed: %',message;end if;end $$;
create function public.o3_error(command text,expected text) returns void language plpgsql as $$begin begin execute command;exception when others then if sqlstate=expected then return;end if;raise exception 'Expected %, got %: %',expected,sqlstate,sqlerrm;end;raise exception 'Unexpected success: %',command;end $$;
select set_config('request.jwt.claim.role','service_role',true);
select set_config('request.headers','{"x-coach-house-actor-id":"e972bc07-fbf5-4fc8-a416-7f00910a71e2"}',true);
\set org 'e972bc07-fbf5-4fc8-a416-7f00910a71e2'
\set file '50000000-0000-4000-8000-000000000001'
\set operation '50000000-0000-4000-8000-000000000002'
\set other '50000000-0000-4000-8000-000000000003'
insert into public.organization_document_files(id,org_id,name,mime_type,size_bytes,storage_path,created_by) values(:'file',:'org','cleanup.md','text/markdown',10,:'org'||'/library/o3-original.md',:'org'),(:'other',:'org','preserve.md','text/markdown',3,:'org'||'/library/o3-preserve.md',:'org');
insert into storage.objects(bucket_id,name,metadata) values('org-documents',:'org'||'/library/o3-original.md','{"size":10}'),('org-documents',:'org'||'/library/o3-preserve.md','{"size":3}');
select updated_at as stamp from public.organization_document_files where id=:'file' \gset
select public.initialize_document_room(:'file',:'org','original',:'stamp','AQHVhqvjBQAHAQdjb250ZW50AwlwYXJhZ3JhcGgA');
select generation from public.document_collaboration_rooms where file_id=:'file' \gset
select public.o3_error(format('select public.reserve_document_file_purge(%L,%L,%L)',:'org',:'file',:'org'),'PT409');
select public.reserve_uploaded_document_version(:'file',:'org',:'operation',:'generation','original',:'stamp',0,repeat('a',64),repeat('b',64),3);
select public.o3_assert((select source_storage_path=:'org'||'/library/o3-original.md' and source_size_bytes=10 from public.document_version_operations where file_id=:'file'),'reservation captures exact source bytes');
insert into storage.objects(bucket_id,name,metadata) values('org-documents',:'org'||'/library/versions/'||:'file'||'/'||:'operation'||'.md','{"size":3}'),('org-documents',:'org'||'/library/versions/'||:'file'||'/'||:'operation'||'-previous.md','{"size":10}');
select public.commit_uploaded_document_version(:'file',:'org',:'operation',:'generation','original',:'stamp',0,repeat('a',64),repeat('b',64),3);

select id as original_version from public.document_file_versions where file_id=:'file' and request_id is null \gset
select base_revision as saved_revision,base_updated_at as saved_stamp from public.document_collaboration_rooms where file_id=:'file' \gset
\set restore_operation '50000000-0000-4000-8000-000000000008'
select public.reserve_uploaded_document_version(:'file',:'org',:'restore_operation',:'generation',:'saved_revision',:'saved_stamp',0,repeat('b',64),repeat('a',64),10,:'original_version');
insert into storage.objects(bucket_id,name,metadata) values('org-documents',:'org'||'/library/versions/'||:'file'||'/'||:'restore_operation'||'.md','{"size":10}');
select public.commit_uploaded_document_version(:'file',:'org',:'restore_operation',:'generation',:'saved_revision',:'saved_stamp',0,repeat('b',64),repeat('a',64),10,:'original_version','AQHVhqvjBQAHAQdjb250ZW50AwlwYXJhZ3JhcGgA');
select public.o3_assert((select count(*)=1 from public.document_file_versions where file_id=:'file' and restored_from=:'original_version'),'canonical Restore retains exact self-reference');
select public.o3_assert(public.document_retained_source_bytes(:'org')=10,'original object accounted outside copied history');
select public.o3_assert(not public.abandon_uploaded_document_version(:'file',:'org',:'operation'),'committed request preserved');

-- Fill metadata-only quota to one byte below the exact retained total; this
-- catches the original object's previously missing ten bytes in the live gate.
do $$ declare available bigint; n integer:=1; chunk bigint; begin
 select 5368709120-1-(select coalesce(sum(size_bytes),0) from public.organization_document_files where org_id='e972bc07-fbf5-4fc8-a416-7f00910a71e2')
 -(select coalesce(sum(v.size_bytes),0) from public.document_file_versions v where v.org_id='e972bc07-fbf5-4fc8-a416-7f00910a71e2' and not exists(select 1 from public.organization_document_files f where f.storage_path=v.storage_path))
 -public.document_retained_source_bytes('e972bc07-fbf5-4fc8-a416-7f00910a71e2') into available;
 while available>0 loop
  chunk:=least(available,52428800);
  insert into public.organization_document_files(org_id,name,mime_type,size_bytes,storage_path,created_by) values('e972bc07-fbf5-4fc8-a416-7f00910a71e2','quota'||n,'application/octet-stream',chunk,'e972bc07-fbf5-4fc8-a416-7f00910a71e2/library/quota-'||n,'e972bc07-fbf5-4fc8-a416-7f00910a71e2');
  n:=n+1;available:=available-chunk;
 end loop;
end $$;
select public.o3_error($cmd$insert into public.organization_document_files(org_id,name,mime_type,size_bytes,storage_path,created_by) values('e972bc07-fbf5-4fc8-a416-7f00910a71e2','overflow','application/octet-stream',2,'e972bc07-fbf5-4fc8-a416-7f00910a71e2/library/overflow','e972bc07-fbf5-4fc8-a416-7f00910a71e2')$cmd$,'23514');
select public.o3_error(format('update storage.objects set metadata=''{}'' where bucket_id=''org-documents'' and name=%L',:'org'||'/library/o3-original.md'),'42501');
select public.o3_assert(public.is_document_version_object('org-documents',:'org'||'/library/o3-original.md'),'original source retains authenticated immutability');
select 'save/source-provenance/quota pass';
update public.organization_document_files set deleted_at=clock_timestamp() where id=:'file';
select public.o3_error(format('select public.reserve_document_file_purge(%L,%L,%L,false,true)',:'org',:'file',:'org'),'PT409');
update public.organization_document_files set deleted_at=clock_timestamp()-interval '31 days' where id=:'file';
select public.reserve_document_file_purge(:'org',:'file',:'org',false,true) as reservation \gset
select public.o3_assert((:'reservation'::jsonb->'paths') ? (:'org'||'/library/o3-original.md'),'original frozen in purge');
select public.o3_error(format('update public.organization_document_files set deleted_at=null where id=%L',:'file'),'PT409');
select public.o3_error(format('select public.reserve_uploaded_document_version(%L,%L,%L,%L,%L,%L,0,repeat(''a'',64),repeat(''b'',64),3)',:'file',:'org',:'operation',:'generation','original',:'stamp'),'42501');
select public.o3_error(format('insert into storage.objects(bucket_id,name,metadata) values(''org-documents'',%L,''{"size":10}'')',:'org'||'/library/o3-original.md'),'42501');
select public.o3_error(format('update public.organization_document_files set storage_path=%L where id=%L',:'org'||'/library/o3-original.md',:'other'),'PT409');
select public.o3_assert(public.reserve_document_file_purge(:'org',:'file',:'org')=:'reservation'::jsonb,'same frozen path set on retry');
select public.o3_error(format('select public.finish_document_file_purge(%L,%L,%L)',:'org',:'file',:'org'),'PT409');
delete from storage.objects where bucket_id='org-documents' and name=:'org'||'/library/o3-original.md';
select public.o3_error(format('select public.finish_document_file_purge(%L,%L,%L)',:'org',:'file',:'org'),'PT409');
select public.o3_assert((select count(*)=3 from public.document_file_versions where file_id=:'file'),'partial deletion preserves history/quota');
delete from storage.objects where bucket_id='org-documents' and name in(select jsonb_array_elements_text(:'reservation'::jsonb->'paths'));
select public.o3_assert(public.finish_document_file_purge(:'org',:'file',:'org'),'finish exact absent set');
select public.o3_assert(public.finish_document_file_purge(:'org',:'file',:'org'),'lost finish reply retry');
select public.o3_assert((select state='complete' from public.document_file_purges where file_id=:'file'),'durable completion');
select public.o3_assert(not exists(select 1 from public.document_file_versions where file_id=:'file') and not exists(select 1 from public.organization_document_files where id=:'file'),'metadata/history removed only after bytes');
select public.o3_assert(exists(select 1 from public.organization_document_files where id=:'other') and exists(select 1 from storage.objects where name=:'org'||'/library/o3-preserve.md'),'other file and bytes preserved');
select public.o3_assert(public.document_retained_source_bytes(:'org')=0,'retained original quota released');
select public.o3_error(format('insert into storage.objects(bucket_id,name,metadata) values(''org-documents'',%L,''{"size":3}'')',:'org'||'/library/versions/'||:'file'||'/'||:'operation'||'.md'),'42501');
select 'purge/30day/partial-retry/reuse-fence pass';
-- Known abandoned stages are safe; active/unknown and committed work stay out.
insert into public.document_version_operations(file_id,request_id,org_id,actor_id,fingerprint,staged_bytes) values(:'other','50000000-0000-4000-8000-000000000004',:'org',:'org','fixture',5),(:'other','50000000-0000-4000-8000-000000000005',:'org',:'org','unknown',5);
insert into storage.objects(bucket_id,name,metadata) values('org-documents',:'org'||'/library/versions/'||:'other'||'/50000000-0000-4000-8000-000000000004.md','{"size":5}');
select public.abandon_uploaded_document_version(:'other',:'org','50000000-0000-4000-8000-000000000004');
select public.o3_assert(jsonb_array_length(public.read_abandoned_document_stages(:'org',:'org'))=1,'unknown staged work excluded');
select public.o3_assert(not public.finish_abandoned_document_version(:'other',:'org','50000000-0000-4000-8000-000000000004'),'capacity retained while object exists');
delete from storage.objects where name=:'org'||'/library/versions/'||:'other'||'/50000000-0000-4000-8000-000000000004.md';
select public.o3_assert(public.finish_abandoned_document_version(:'other',:'org','50000000-0000-4000-8000-000000000004'),'abandoned cleanup confirmed');
select public.o3_error(format('insert into storage.objects(bucket_id,name,metadata) values(''org-documents'',%L,''{"size":5}'')',:'org'||'/library/versions/'||:'other'||'/50000000-0000-4000-8000-000000000004.md'),'42501');
select public.o3_assert((select state='staged' and staged_bytes=5 from public.document_version_operations where file_id=:'other' and request_id='50000000-0000-4000-8000-000000000005'),'unknown reserve intact');
select 'abandoned-stage/delayed-upload/capacity pass';

-- Existing Documents route parity: paid scoped coach, board restriction, and
-- separately granted support (including free workspaces) are rechecked live.
\set coach '90b6c688-889c-467f-9edd-166f28bf0819'
insert into public.platform_staff_members(user_id,access_level,can_access_unassigned_organizations) values(:'coach','coach',false) on conflict(user_id) do update set access_level='coach',can_access_unassigned_organizations=false;
select set_config('request.headers',jsonb_build_object('x-coach-house-actor-id',:'coach')::text,true);
insert into public.organization_coach_scope_settings(id,assigned_only_enabled,activated_at,activated_by) values(true,true,now(),:'org') on conflict(id) do update set assigned_only_enabled=true,activated_at=now(),activated_by=excluded.activated_by;
select public.o3_error(format('select public.read_abandoned_document_stages(%L,%L)',:'org',:'coach'),'42501');
insert into public.organization_coach_assignments(organization_id,coach_user_id,assigned_by) values(:'org',:'coach',:'org');
select public.read_abandoned_document_stages(:'org',:'coach');
insert into public.organization_memberships(org_id,member_id,role,member_email) select :'org',:'coach','board',email from auth.users where id=:'coach';
select public.o3_error(format('select public.read_abandoned_document_stages(%L,%L)',:'org',:'coach'),'42501');
insert into public.workspace_support_grants(user_id,granted_by) values(:'coach',:'org');
update public.subscriptions set status='canceled' where user_id=:'org';
select public.read_abandoned_document_stages(:'org',:'coach',true);
update public.workspace_support_grants set revoked_at=now() where user_id=:'coach';
select public.o3_error(format('select public.read_abandoned_document_stages(%L,%L,true)',:'org',:'coach'),'42501');
select public.o3_assert(not has_function_privilege('authenticated','public.reserve_document_file_purge(uuid,uuid,uuid,boolean,boolean)','execute') and not has_function_privilege('anon','public.finish_document_file_purge(uuid,uuid,uuid,boolean)','execute'),'no API role privilege expansion');
select 'support-revocation/coach-scope/ACL pass';
rollback;
