\set ON_ERROR_STOP on
do $$ begin
 if current_setting('coach_house.workspace_sharing_fixture',true) is distinct from 'isolated-test-only'
 or current_database() not like 'workspace_sharing_fixture_%' then raise exception 'Isolated fixture required'; end if;
end $$;
begin;
delete from public.organization_workspace_pages;
create function pg_temp.ok(value boolean) returns void language plpgsql as $$
begin if value is distinct from true then raise exception 'Image assertion failed'; end if; end $$;
create function pg_temp.denied(command text,expected text) returns void language plpgsql as $$
declare actual text; begin
 begin execute command; exception when others then get stacked diagnostics actual=returned_sqlstate;
 if actual=expected then return; end if; raise exception 'Expected %, got %: %',expected,actual,sqlerrm; end;
 raise exception 'Unexpected image operation success'; end $$;
select public.fixture_image_sources();
set local role anon;
select pg_temp.denied('select public.fixture_image_commit(0,''publish'',30)','42501');
select pg_temp.denied('select public.read_workspace_page_image(''10000000-0000-4000-8000-000000000060'',''public'')','42501');
reset role;
set local role authenticated;
select pg_temp.denied('select * from public.workspace_page_image_grants','42501');
reset role;
-- Source deletion/revision and wrong paths fail atomically, including new pages.
update public.organization_document_files set deleted_at=now();
set local role service_role;
select pg_temp.denied('select public.fixture_image_commit(0,''publish'',30)','40001');
reset role;
select pg_temp.ok(not exists(select 1 from public.organization_workspace_pages));
update public.organization_document_files set deleted_at=null;
set local role service_role;
select pg_temp.denied('select public.fixture_image_commit(0,''publish'',30,60,''{"path":"other-org/private.png"}'')','22023');
select pg_temp.denied('select public.fixture_image_commit(0,''publish'',30,60,''{"size":999}'')','40001');
select public.fixture_image_commit(0,'publish',30);
select pg_temp.ok(public.read_workspace_page_image('10000000-0000-4000-8000-000000000060','public')->>'sha256'=repeat('b',64));
select pg_temp.ok(public.read_workspace_page_image('10000000-0000-4000-8000-000000000061','public') is null);
select pg_temp.ok(public.read_workspace_page_image('10000000-0000-4000-8000-000000000060','guest','10000000-0000-4000-8000-000000000006') is null);
select pg_temp.ok(public.read_workspace_page_image('10000000-0000-4000-8000-000000000060','editor','10000000-0000-4000-8000-000000000006') is null);
select pg_temp.ok((public.fixture_image_commit(0,'publish',30)->>'replayed')::boolean);
select public.fixture_image_commit(1,'make_private',31);
select pg_temp.ok(public.read_workspace_page_image('10000000-0000-4000-8000-000000000060','public') is null);
select pg_temp.ok(public.read_workspace_page_image('10000000-0000-4000-8000-000000000060','editor','10000000-0000-4000-8000-000000000001') is not null);
select public.fixture_image_commit(2,'share_with_guests',32,61);
select public.workspace_page_guest_command('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000010',
 '{"action":"invite","operationId":"10000000-0000-4000-8000-000000000100","invitationId":"10000000-0000-4000-8000-000000000200","permission":"view","email":"person6@example.org"}',repeat('c',64));
select public.workspace_page_guest_command('10000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000010',
 '{"action":"accept","invitationId":"10000000-0000-4000-8000-000000000200"}',repeat('c',64));
select pg_temp.ok(public.read_workspace_page_image('10000000-0000-4000-8000-000000000061','guest','10000000-0000-4000-8000-000000000006') is not null);
select pg_temp.ok(public.read_workspace_page_image('10000000-0000-4000-8000-000000000061','public') is null);
select public.fixture_image_commit(3,'publish',33,62);
select pg_temp.ok(public.read_workspace_page_image('10000000-0000-4000-8000-000000000060','public') is null);
select pg_temp.ok(public.read_workspace_page_image('10000000-0000-4000-8000-000000000062','public') is not null);
select pg_temp.ok(public.read_workspace_page_image('10000000-0000-4000-8000-000000000062','guest','10000000-0000-4000-8000-000000000006') is null);
select public.workspace_page_guest_command('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000010',
 '{"action":"revoke","operationId":"10000000-0000-4000-8000-000000000101","invitationId":"10000000-0000-4000-8000-000000000200"}',repeat('c',64));
select pg_temp.ok(public.read_workspace_page_image('10000000-0000-4000-8000-000000000061','guest','10000000-0000-4000-8000-000000000006') is null);
reset role;
-- The approved copy survives a changed private source; no original bytes read.
update public.organization_document_files set deleted_at=now();
set local role service_role;
select pg_temp.ok(public.read_workspace_page_image('10000000-0000-4000-8000-000000000062','public') is not null);
select public.fixture_image_commit(4,'make_private',34);
select pg_temp.ok(public.read_workspace_page_image('10000000-0000-4000-8000-000000000062','public') is null);
reset role;
update public.organization_document_files set deleted_at=null;
update storage.objects set created_at=now()-interval '2 days' where name not like '%000000000065.webp';
set local role service_role;
select pg_temp.denied('select public.fixture_image_commit(5,''publish'',35,63)','40001');
select pg_temp.ok(jsonb_array_length(public.workspace_page_image_orphans())=2);
select pg_temp.ok(not public.workspace_page_image_orphans() @> '["10000000-0000-4000-8000-000000000001/10000000-0000-4000-8000-000000000010/10000000-0000-4000-8000-000000000060.webp"]');
reset role;
rollback;
\echo 'image publication: atomic source checks, exact retry, public/private/guest separation, direct revocation, immutable reviewed copies and orphan bounds passed'
