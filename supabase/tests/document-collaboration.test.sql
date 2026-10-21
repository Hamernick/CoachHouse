-- Execute only in the marker-protected local fixture, inside a rollback.
do $$ begin
  if current_setting('coach_house.document_room_fixture', true) is distinct from 'isolated-test-only'
    then raise exception 'This test requires an isolated local database.'; end if;
end $$;
begin;
create function public.fixture_assert(condition boolean, message text) returns void
language plpgsql as $$ begin if condition is distinct from true then raise exception 'Assertion failed: %', message; end if; end $$;
create function public.fixture_error(command text, expected text) returns void
language plpgsql as $$ begin
  begin execute command;
  exception when others then
    if sqlstate=expected then return; end if;
    raise exception 'Expected %, received %: %', expected, sqlstate, sqlerrm;
  end;
  raise exception 'Expected SQLSTATE %, but command succeeded: %', expected, command;
end $$;
insert into public.profiles(id) select ('00000000-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid from generate_series(1,6) i;
insert into public.organizations(user_id) values ('00000000-0000-4000-8000-000000000001'), ('00000000-0000-4000-8000-000000000006');
insert into public.organization_memberships(org_id, member_id, role) values
('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','staff'),
('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000003','board');
insert into public.platform_staff_members values ('00000000-0000-4000-8000-000000000005','developer');
insert into public.subscriptions(user_id,status,metadata,stripe_subscription_id) values
('00000000-0000-4000-8000-000000000001','active','{"plan_tier":"organization"}','sub_fixture'),
('00000000-0000-4000-8000-000000000006','active','{"plan_tier":"organization"}','stub_fixture');
insert into public.organization_document_files(id,org_id,storage_path,name,mime_type,size_bytes,created_by,updated_at) values
('00000000-0000-4000-8000-000000000100','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001/library/notes.md','notes.md','text/markdown',10,'00000000-0000-4000-8000-000000000001','2026-10-14T00:00:00Z'),
('00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000006','00000000-0000-4000-8000-000000000006/library/private.md','private.md','text/markdown',10,'00000000-0000-4000-8000-000000000006','2026-10-14T00:00:00Z');
set role service_role;
select public.fixture_error(format($cmd$ select public.initialize_document_room('00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000006','revision','2026-10-14T00:00:00Z','AQHVhqvjBQAHAQdjb250ZW50AwlwYXJhZ3JhcGgA') $cmd$, 'unused', 'unused'), '42501');
select public.fixture_error(format($cmd$ select public.initialize_document_room('00000000-0000-4000-8000-000000000100','00000000-0000-4000-8000-000000000004','revision','2026-10-14T00:00:00Z','AQHVhqvjBQAHAQdjb250ZW50AwlwYXJhZ3JhcGgA') $cmd$, 'unused', 'unused'), '42501');
select public.fixture_error(format($cmd$ select public.initialize_document_room('00000000-0000-4000-8000-000000000100','00000000-0000-4000-8000-000000000001','revision','2026-10-13T00:00:00Z','AQHVhqvjBQAHAQdjb250ZW50AwlwYXJhZ3JhcGgA') $cmd$, 'unused', 'unused'), '40001');
select public.initialize_document_room('00000000-0000-4000-8000-000000000100','00000000-0000-4000-8000-000000000001','revision','2026-10-14T00:00:00Z','AQHVhqvjBQAHAQdjb250ZW50AwlwYXJhZ3JhcGgA') as initialized \gset
select id as room_id, generation as generation from public.document_collaboration_rooms \gset
select public.fixture_error(format($cmd$ select public.initialize_document_room('00000000-0000-4000-8000-000000000100',null,'revision','2026-10-14T00:00:00Z','AAA=') $cmd$, :'room_id', :'generation'),'42501');
select public.fixture_assert(public.initialize_document_room('00000000-0000-4000-8000-000000000100','00000000-0000-4000-8000-000000000001','revision','2026-10-14T00:00:00Z','AQHVhqvjBQAHAQdjb250ZW50AwlwYXJhZ3JhcGgA')->>'roomId'=:'room_id', 'bootstrap is idempotent');
reset role;
set role anon;
select public.fixture_error('select * from public.document_collaboration_rooms','42501');
select public.fixture_error('select * from public.document_collaboration_updates','42501');
select public.fixture_error(format($cmd$ select public.append_document_room_update('%1$s','%2$s','00000000-0000-4000-8000-000000000201','AQLVhqvjBQEHANWGq+MFAAYEANWGq+MFAQFBAA==') $cmd$, :'room_id', :'generation'),'42501');
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000004',false);
select public.fixture_assert((select count(*) from public.document_collaboration_rooms)=0, 'outsider cannot read room');
select public.fixture_error(format($cmd$ select public.append_document_room_update('%1$s','%2$s','00000000-0000-4000-8000-000000000201','AQLVhqvjBQEHANWGq+MFAAYEANWGq+MFAQFBAA==') $cmd$, :'room_id', :'generation'),'42501');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',false);
select public.fixture_assert((select count(*) from public.document_collaboration_rooms)=1, 'viewer can read shared state');
select public.fixture_assert(not public.can_edit_document_room(:'room_id'), 'viewer cannot edit');
select public.fixture_error(format($cmd$ select public.append_document_room_update('%1$s','%2$s','00000000-0000-4000-8000-000000000201','AQLVhqvjBQEHANWGq+MFAAYEANWGq+MFAQFBAA==') $cmd$, :'room_id', :'generation'),'42501');
select public.fixture_error(format($cmd$ select public.initialize_document_room('00000000-0000-4000-8000-000000000100','00000000-0000-4000-8000-000000000003','revision','2026-10-14T00:00:00Z','AQHVhqvjBQAHAQdjb250ZW50AwlwYXJhZ3JhcGgA') $cmd$, :'room_id', :'generation'),'42501');
select public.fixture_error(format($cmd$ select public.compact_document_room('%1$s','%2$s',0,'AQHVhqvjBQAHAQdjb250ZW50AwlwYXJhZ3JhcGgA') $cmd$, :'room_id', :'generation'),'42501');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
select public.fixture_assert(public.can_edit_document_room(:'room_id'), 'owner can edit');
select public.fixture_error(format($cmd$ update public.document_collaboration_rooms set last_sequence=100 where id='%1$s' $cmd$, :'room_id', :'generation'), '42501');
select public.fixture_error(format($cmd$ insert into public.document_collaboration_updates(room_id,sequence,batch_id,actor_id,payload,payload_hash) values ('%1$s',1,'00000000-0000-4000-8000-000000000201','00000000-0000-4000-8000-000000000001',decode('AQLVhqvjBQEHANWGq+MFAAYEANWGq+MFAQFBAA==','base64'),sha256(decode('AQLVhqvjBQEHANWGq+MFAAYEANWGq+MFAQFBAA==','base64'))) $cmd$, :'room_id', :'generation'),'42501');
select public.fixture_error(format($cmd$ select public.append_document_room_update('%1$s','00000000-0000-4000-8000-000000000999','00000000-0000-4000-8000-000000000201','AQLVhqvjBQEHANWGq+MFAAYEANWGq+MFAQFBAA==') $cmd$, :'room_id', :'generation'),'40001');
select public.fixture_error(format($cmd$ select public.append_document_room_update('%1$s','%2$s',null,'AQLVhqvjBQEHANWGq+MFAAYEANWGq+MFAQFBAA==') $cmd$, :'room_id', :'generation'),'22023');
select public.fixture_error(format($cmd$ select public.append_document_room_update('%1$s','%2$s','00000000-0000-4000-8000-000000000201',encode(convert_to(repeat('x',131073),'UTF8'),'base64')) $cmd$, :'room_id', :'generation'),'22023');
select public.fixture_assert(public.append_document_room_update(:'room_id',:'generation','00000000-0000-4000-8000-000000000201','AQLVhqvjBQEHANWGq+MFAAYEANWGq+MFAQFBAA==')->>'sequence'='1','first durable sequence');
select public.fixture_assert(public.append_document_room_update(:'room_id',:'generation','00000000-0000-4000-8000-000000000201','AQLVhqvjBQEHANWGq+MFAAYEANWGq+MFAQFBAA==')->>'sequence'='1','lost-response retry reuses receipt');
select public.fixture_error(format($cmd$ select public.append_document_room_update('%1$s','%2$s','00000000-0000-4000-8000-000000000201','AQHVhqvjBQOE1Yar4wUCAUIA') $cmd$, :'room_id', :'generation'),'22023');
select public.fixture_assert((select count(*) from public.document_collaboration_updates)=1,'retry did not duplicate update');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false);
select public.fixture_assert(public.can_edit_document_room(:'room_id'), 'staff can edit');
select public.fixture_error(format($cmd$ select public.append_document_room_update('%1$s','%2$s','00000000-0000-4000-8000-000000000201','AQLVhqvjBQEHANWGq+MFAAYEANWGq+MFAQFBAA==') $cmd$, :'room_id', :'generation'),'22023');
select public.fixture_assert(public.append_document_room_update(:'room_id',:'generation','00000000-0000-4000-8000-000000000202','AQHVhqvjBQOE1Yar4wUCAUIA')->>'sequence'='2','staff sequence');
reset role;
update public.organization_memberships set role='board' where member_id='00000000-0000-4000-8000-000000000002';
set role authenticated;
select public.fixture_error(format($cmd$ select public.append_document_room_update('%1$s','%2$s','00000000-0000-4000-8000-000000000203','AQHVhqvjBQSE1Yar4wUDAUMA') $cmd$, :'room_id', :'generation'),'42501');
reset role;
delete from public.organization_memberships where member_id='00000000-0000-4000-8000-000000000002';
set role authenticated;
select public.fixture_assert((select count(*) from public.document_collaboration_updates)=0,'revoked membership loses update access');
select public.fixture_error(format($cmd$ select public.append_document_room_update('%1$s','%2$s','00000000-0000-4000-8000-000000000203','AQHVhqvjBQSE1Yar4wUDAUMA') $cmd$, :'room_id', :'generation'),'42501');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000005',false);
select public.fixture_assert(public.can_edit_document_room(:'room_id'),'developer inherits canonical access');
reset role;
set role service_role;
select public.fixture_assert(not public.compact_document_room(:'room_id',:'generation',1,'AQHVhqvjBQAHAQdjb250ZW50AwlwYXJhZ3JhcGgA'),'stale compaction cannot remove update');
select public.fixture_assert((select count(*) from public.document_collaboration_updates where payload is not null)=2,'stale compaction retained tail');
select public.fixture_assert(public.compact_document_room(:'room_id',:'generation',2,'AQTVhqvjBQAHAQdjb250ZW50AwlwYXJhZ3JhcGgHANWGq+MFAAYEANWGq+MFAQFBhNWGq+MFAgFCAA=='),'verified compaction');
select public.fixture_assert((select count(*) from public.document_collaboration_updates where payload is not null)=0,'compaction retires payloads');
select public.fixture_assert((select recovery_bytes=0 and checkpoint_sequence=2 and last_sequence=2 from public.document_collaboration_rooms),'checkpoint accounting');
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
select public.fixture_assert(public.append_document_room_update(:'room_id',:'generation','00000000-0000-4000-8000-000000000201','AQLVhqvjBQEHANWGq+MFAAYEANWGq+MFAQFBAA==')->>'sequence'='1','archived receipt remains retry-safe');
reset role;
update public.document_collaboration_rooms set recovery_bytes=8388608 where id=:'room_id';
set role authenticated;
select public.fixture_error(format($cmd$ select public.append_document_room_update('%1$s','%2$s','00000000-0000-4000-8000-000000000203','AQHVhqvjBQSE1Yar4wUDAUMA') $cmd$, :'room_id', :'generation'),'54000');
select public.fixture_assert((select last_sequence=2 from public.document_collaboration_rooms),'capacity failure does not advance sequence');
reset role;
update public.document_collaboration_rooms set recovery_bytes=0 where id=:'room_id';
update public.organization_document_files set deleted_at=now() where id='00000000-0000-4000-8000-000000000100';
set role authenticated;
select public.fixture_assert((select count(*) from public.document_collaboration_rooms)=0,'deleted source hides room');
select public.fixture_error(format($cmd$ select public.append_document_room_update('%1$s','%2$s','00000000-0000-4000-8000-000000000203','AQHVhqvjBQSE1Yar4wUDAUMA') $cmd$, :'room_id', :'generation'),'42501');
reset role;
update public.organization_document_files set deleted_at=null where id='00000000-0000-4000-8000-000000000100';
set role authenticated;
select public.fixture_error(format($cmd$ select public.append_document_room_update('%1$s','%2$s','00000000-0000-4000-8000-000000000203','AQHVhqvjBQSE1Yar4wUDAUMA') $cmd$, :'room_id', :'generation'),'40001');
reset role;
update public.organization_document_files set updated_at='2026-10-14T00:00:00Z' where id='00000000-0000-4000-8000-000000000100';
-- The canonical trigger owns updated_at, so source-change detection stays active.
set role service_role;
select public.fixture_error(format($cmd$ select public.initialize_document_room('00000000-0000-4000-8000-000000000100','00000000-0000-4000-8000-000000000001','revision','2026-10-14T00:00:00Z','AQHVhqvjBQAHAQdjb250ZW50AwlwYXJhZ3JhcGgA') $cmd$, :'room_id', :'generation'),'40001');
reset role;
select public.fixture_assert((select count(*) from pg_publication_tables where pubname='supabase_realtime' and tablename='document_collaboration_updates')=1,'publication contains only durable update table');
select public.fixture_assert((select count(*) from pg_class where oid in ('public.document_collaboration_rooms'::regclass,'public.document_collaboration_updates'::regclass) and relrowsecurity and relforcerowsecurity)=2,'both tables force RLS');
rollback;
\echo 'Document room SQL authorization, receipts, sequence, recovery and compaction checks passed.'
