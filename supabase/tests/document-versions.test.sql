-- Marker-protected disposable PostgreSQL only. Every record is rolled back.
do $$ begin
  if current_setting('coach_house.document_room_fixture',true) is distinct from 'isolated-test-only'
    then raise exception 'Isolated fixture required'; end if;
end $$;
begin;
create function public.fixture_assert(condition boolean,message text) returns void language plpgsql as $$
begin if condition is distinct from true then raise exception 'Assertion failed: %',message; end if; end $$;
create function public.fixture_error(command text,expected text) returns void language plpgsql as $$
begin
  begin execute command;
  exception when others then if sqlstate=expected then return; end if;
    raise exception 'Expected %, received %: %',expected,sqlstate,sqlerrm; end;
  raise exception 'Expected %, command succeeded',expected;
end $$;
-- Test wrapper reserves in the same transaction for compact SQL assertions;
-- service tests separately exercise the actual two-request staging boundary.
create function public.fixture_version_commit(
  p_file_id uuid,p_actor_id uuid,p_request_id uuid,p_generation uuid,p_expected_revision text,
  p_expected_updated_at timestamptz,p_sequence bigint,p_previous_hash text,p_new_hash text,p_new_size bigint,
  p_restore_version_id uuid default null,p_restore_checkpoint_base64 text default null
) returns jsonb language plpgsql as $$ begin
  perform public.reserve_uploaded_document_version(p_file_id,p_actor_id,p_request_id,p_generation,
    p_expected_revision,p_expected_updated_at,p_sequence,p_previous_hash,p_new_hash,p_new_size,p_restore_version_id);
  return public.commit_uploaded_document_version(p_file_id,p_actor_id,p_request_id,p_generation,
    p_expected_revision,p_expected_updated_at,p_sequence,p_previous_hash,p_new_hash,p_new_size,p_restore_version_id,p_restore_checkpoint_base64);
end $$;
insert into public.profiles(id) select ('10000000-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid from generate_series(1,4) i;
insert into public.organizations(user_id) values('10000000-0000-4000-8000-000000000001');
insert into public.organization_memberships values
('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','staff'),
('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000003','board');
insert into public.subscriptions(user_id,status,metadata,stripe_subscription_id) values
('10000000-0000-4000-8000-000000000001','active','{"plan_tier":"organization"}','sub_fixture');
insert into public.organization_document_files(id,org_id,storage_path,name,mime_type,size_bytes,created_by,updated_at) values
('10000000-0000-4000-8000-000000000100','10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001/library/original.md','original.md','text/markdown',10,'10000000-0000-4000-8000-000000000001','2026-10-14T00:00:00Z');
insert into storage.objects(bucket_id,name,metadata) values
('org-documents','10000000-0000-4000-8000-000000000001/library/original.md','{"size":10}'),
('org-documents','10000000-0000-4000-8000-000000000001/library/versions/10000000-0000-4000-8000-000000000100/10000000-0000-4000-8000-000000000301-previous.md','{"size":10}');
set role service_role;
select public.initialize_document_room('10000000-0000-4000-8000-000000000100','10000000-0000-4000-8000-000000000001','original','2026-10-14T00:00:00Z','AQHVhqvjBQAHAQdjb250ZW50AwlwYXJhZ3JhcGgA');
select id as room_id,generation as generation from public.document_collaboration_rooms where file_id='10000000-0000-4000-8000-000000000100' \gset
update public.document_collaboration_rooms set last_sequence=2 where id=:'room_id';
insert into public.document_collaboration_updates(room_id,sequence,batch_id,generation,actor_id,payload,payload_hash)
select :'room_id',i,('10000000-0000-4000-8000-' || lpad((200+i)::text,12,'0'))::uuid,:'generation','10000000-0000-4000-8000-000000000001',decode('0000','hex'),sha256(decode('0000','hex')) from generate_series(1,2) i;
insert into storage.objects(bucket_id,name,metadata) values
('org-documents','10000000-0000-4000-8000-000000000001/library/versions/10000000-0000-4000-8000-000000000100/10000000-0000-4000-8000-000000000301.md','{"size":3}'),
('org-documents','10000000-0000-4000-8000-000000000001/library/versions/10000000-0000-4000-8000-000000000100/10000000-0000-4000-8000-000000000302.md','{"size":3}'),
('org-documents','10000000-0000-4000-8000-000000000001/library/versions/10000000-0000-4000-8000-000000000100/10000000-0000-4000-8000-000000000303.md','{"size":10}');
select public.fixture_version_commit('10000000-0000-4000-8000-000000000100','10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000301',:'generation','original','2026-10-14T00:00:00Z',1,repeat('a',64),repeat('b',64),3) as saved \gset
select public.fixture_assert((select count(*)=2 from public.document_file_versions),'original and new version retained');
select public.fixture_assert(not public.abandon_uploaded_document_version('10000000-0000-4000-8000-000000000100','10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000301'),'committed stage cannot be abandoned');
select public.fixture_assert((select generation=:'generation' and canonical_sequence=1 and last_sequence=2 from public.document_collaboration_rooms where id=:'room_id'),'Save preserves generation and later shared edits');
select public.fixture_assert((select count(*)=2 from public.document_collaboration_updates where room_id=:'room_id'),'Save retains ledger');
select public.fixture_assert((select id='10000000-0000-4000-8000-000000000100' and name='original.md' from public.organization_document_files where id='10000000-0000-4000-8000-000000000100'),'file identity and title preserved');
select public.fixture_assert(public.fixture_version_commit('10000000-0000-4000-8000-000000000100','10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000301',:'generation','original','2026-10-14T00:00:00Z',1,repeat('a',64),repeat('b',64),3)=:'saved'::jsonb,'lost-response retry returns exact receipt');
select public.fixture_error(format($cmd$ select public.fixture_version_commit('10000000-0000-4000-8000-000000000100','10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000301','%s','original','2026-10-14T00:00:00Z',1,repeat('a',64),repeat('c',64),3) $cmd$,:'generation'),'22023');
select public.fixture_error(format($cmd$ select public.fixture_version_commit('10000000-0000-4000-8000-000000000100','10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000302','%s','original','2026-10-14T00:00:00Z',2,repeat('a',64),repeat('c',64),3) $cmd$,:'generation'),'40001');
select id as original_version from public.document_file_versions where request_id is null \gset
select base_revision as revision,base_updated_at as stamp from public.document_collaboration_rooms where id=:'room_id' \gset
select public.fixture_error(format($cmd$ select public.fixture_version_commit('10000000-0000-4000-8000-000000000100','10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000303','%s','%s','%s',2,repeat('b',64),repeat('a',64),10,'%s','AQHVhqvjBQAHAQdjb250ZW50AwlwYXJhZ3JhcGgA') $cmd$,:'generation',:'revision',:'stamp',:'original_version'),'40001');
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000004',false);
select public.fixture_assert((select count(*)=0 from public.document_file_versions),'outsider cannot read history');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',false);
select public.fixture_assert((select count(*)=2 from public.document_file_versions),'canonical readonly member can read history');
select public.fixture_error($cmd$ delete from public.document_file_versions $cmd$,'42501');
select public.fixture_error($cmd$ select * from public.document_version_operations $cmd$,'42501');
select public.fixture_error($cmd$ insert into storage.objects(bucket_id,name,metadata) values('org-documents','10000000-0000-4000-8000-000000000001/library/versions/attacker.md','{"size":1}') $cmd$,'42501');
select public.fixture_error(format($cmd$ select public.fixture_version_commit('10000000-0000-4000-8000-000000000100','10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000302','%s','%s','%s',2,repeat('b',64),repeat('c',64),3) $cmd$,:'generation',:'revision',:'stamp'),'42501');
update storage.objects set metadata='{"size":1}' where name='10000000-0000-4000-8000-000000000001/library/versions/10000000-0000-4000-8000-000000000100/10000000-0000-4000-8000-000000000301-previous.md';
delete from storage.objects where name='10000000-0000-4000-8000-000000000001/library/versions/10000000-0000-4000-8000-000000000100/10000000-0000-4000-8000-000000000301-previous.md';
select public.fixture_assert((select metadata->>'size'='10' from storage.objects where name='10000000-0000-4000-8000-000000000001/library/versions/10000000-0000-4000-8000-000000000100/10000000-0000-4000-8000-000000000301-previous.md'),'history object is immutable despite permissive old policies');
reset role;
set role service_role;
select public.fixture_error(format($cmd$ select public.fixture_version_commit('10000000-0000-4000-8000-000000000100','10000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000302','%s','%s','%s',2,repeat('b',64),repeat('c',64),3) $cmd$,:'generation',:'revision',:'stamp'),'42501');
select public.fixture_version_commit('10000000-0000-4000-8000-000000000100','10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000302',:'generation',:'revision',:'stamp',2,repeat('b',64),repeat('c',64),3);
select base_revision as revision,base_updated_at as stamp from public.document_collaboration_rooms where id=:'room_id' \gset
select public.fixture_version_commit('10000000-0000-4000-8000-000000000100','10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000303',:'generation',:'revision',:'stamp',2,repeat('c',64),repeat('a',64),10,:'original_version','AQHVhqvjBQAHAQdjb250ZW50AwlwYXJhZ3JhcGgA') as restored \gset
select public.fixture_assert((select generation<>:'generation' and canonical_sequence=0 and last_sequence=0 from public.document_collaboration_rooms where id=:'room_id'),'restore creates a new generation');
select public.fixture_assert((select count(*)=4 from public.document_file_versions),'restore retains all versions');
select public.fixture_assert((select count(*)=0 from public.document_collaboration_updates where room_id=:'room_id'),'restore retires old-generation ledger');
select public.fixture_assert(public.fixture_version_commit('10000000-0000-4000-8000-000000000100','10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000303',:'generation',:'revision',:'stamp',2,repeat('c',64),repeat('a',64),10,:'original_version','AQHVhqvjBQAHAQdjb250ZW50AwlwYXJhZ3JhcGgA')=:'restored'::jsonb,'restore retry does not reset generation again');
select generation as current_generation,base_revision as current_revision,base_updated_at as current_stamp from public.document_collaboration_rooms where id=:'room_id' \gset
select public.fixture_error(format($cmd$ select public.fixture_version_commit('10000000-0000-4000-8000-000000000100','10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000304','%s','%s','%s',0,repeat('a',64),repeat('b',64),3) $cmd$,:'current_generation',:'current_revision',:'current_stamp'),'22023');
select public.fixture_assert((select count(*)=4 from public.document_file_versions),'missing stage rolls back without creating history');
reset role;
delete from public.organization_memberships where member_id='10000000-0000-4000-8000-000000000002';
set role service_role;
select public.fixture_error(format($cmd$ select public.fixture_version_commit('10000000-0000-4000-8000-000000000100','10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000304','%s','%s','%s',0,repeat('a',64),repeat('b',64),3) $cmd$,:'current_generation',:'current_revision',:'current_stamp'),'42501');
reset role;
update public.subscriptions set status='canceled' where user_id='10000000-0000-4000-8000-000000000001';
set role service_role;
select public.fixture_error(format($cmd$ select public.fixture_version_commit('10000000-0000-4000-8000-000000000100','10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000304','%s','%s','%s',0,repeat('a',64),repeat('b',64),3) $cmd$,:'current_generation',:'current_revision',:'current_stamp'),'42501');
reset role;
update public.subscriptions set status='active' where user_id='10000000-0000-4000-8000-000000000001';
-- Fill only synthetic metadata to exercise the hard history cap; no provider IO.
insert into public.document_file_versions(file_id,org_id,actor_id,storage_path,name,mime_type,size_bytes,content_hash,revision,source_updated_at,generation,sequence)
select '10000000-0000-4000-8000-000000000100','10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001/library/fixture/'||i::text||'.md','fixture.md','text/markdown',0,repeat('a',64),'fixture',now(),:'current_generation',0 from generate_series(1,45) i;
set role service_role;
select public.fixture_error(format($cmd$ select public.fixture_version_commit('10000000-0000-4000-8000-000000000100','10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000304','%s','%s','%s',0,repeat('a',64),repeat('b',64),3) $cmd$,:'current_generation',:'current_revision',:'current_stamp'),'54000');
select public.fixture_assert((select base_revision=:'current_revision' from public.document_collaboration_rooms where id=:'room_id'),'capacity failure retains canonical state');
reset role;
-- History participates in ordinary uploads' existing 5GiB quota too.
insert into public.organization_document_files(org_id,storage_path,name,mime_type,size_bytes,created_by)
select '10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001/library/quota/'||i::text,'quota.txt','text/plain',52428800,'10000000-0000-4000-8000-000000000001' from generate_series(1,102) i;
insert into public.organization_document_files(org_id,storage_path,name,mime_type,size_bytes,created_by)
values('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001/library/quota/final','quota.txt','text/plain',20971494,'10000000-0000-4000-8000-000000000001');
select public.fixture_error($cmd$ insert into public.organization_document_files(org_id,storage_path,name,mime_type,size_bytes,created_by) values('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001/library/quota/over','quota.txt','text/plain',1,'10000000-0000-4000-8000-000000000001') $cmd$,'23514');
-- Preserve the deployed policy replacement/upsert quota fix at capacity.
delete from public.organization_document_files where storage_path='10000000-0000-4000-8000-000000000001/library/quota/1';
insert into public.organization_document_files(org_id,document_kind,storage_path,name,mime_type,size_bytes,created_by)
values('10000000-0000-4000-8000-000000000001','bylaws','10000000-0000-4000-8000-000000000001/policies/original.pdf','Bylaws.pdf','application/pdf',52428800,'10000000-0000-4000-8000-000000000001');
insert into public.organization_document_files(org_id,document_kind,storage_path,name,mime_type,size_bytes,created_by)
values('10000000-0000-4000-8000-000000000001','bylaws','10000000-0000-4000-8000-000000000001/policies/replaced.pdf','Bylaws.pdf','application/pdf',52428800,'10000000-0000-4000-8000-000000000001')
on conflict(org_id,document_kind) do update set storage_path=excluded.storage_path,size_bytes=excluded.size_bytes;
select public.fixture_assert((select storage_path like '%/replaced.pdf' from public.organization_document_files where document_kind='bylaws'),'policy upsert does not double count replaced bytes');
set role service_role;
select public.reserve_uploaded_document_version('10000000-0000-4000-8000-000000000100','10000000-0000-4000-8000-000000000001',
  ('10000000-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid,:'current_generation',:'current_revision',:'current_stamp',0,repeat('a',64),repeat('b',64),3)
from generate_series(400,407) i;
select public.fixture_assert(public.abandon_uploaded_document_version('10000000-0000-4000-8000-000000000100','10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000400'),'uncommitted stage can be fenced');
select public.fixture_error(format($cmd$ select public.reserve_uploaded_document_version('10000000-0000-4000-8000-000000000100','10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000400','%s','%s','%s',0,repeat('a',64),repeat('b',64),3) $cmd$,:'current_generation',:'current_revision',:'current_stamp'),'40001');
select public.fixture_error(format($cmd$ select public.reserve_uploaded_document_version('10000000-0000-4000-8000-000000000100','10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000408','%s','%s','%s',0,repeat('a',64),repeat('b',64),3) $cmd$,:'current_generation',:'current_revision',:'current_stamp'),'54000');
select public.fixture_assert(public.finish_abandoned_document_version('10000000-0000-4000-8000-000000000100','10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000400'),'verified cleanup releases capacity');
select public.fixture_assert(public.reserve_uploaded_document_version('10000000-0000-4000-8000-000000000100','10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000408',:'current_generation',:'current_revision',:'current_stamp',0,repeat('a',64),repeat('b',64),3),'cleanup permits bounded new staging');
reset role;
update public.organization_document_files set deleted_at=now() where id='10000000-0000-4000-8000-000000000100';
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
select public.fixture_assert((select count(*)=0 from public.document_file_versions),'deleted canonical file hides version history');
reset role;
rollback;
select 'document version checks passed';
