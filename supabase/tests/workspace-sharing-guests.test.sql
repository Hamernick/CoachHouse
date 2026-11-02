\set ON_ERROR_STOP on
do $$ begin
  if current_setting('coach_house.workspace_sharing_fixture',true) is distinct from 'isolated-test-only'
    or current_database() not like 'workspace_sharing_fixture_%' then raise exception 'Isolated fixture required'; end if;
end $$;
begin;
delete from public.organization_workspace_pages;
create function pg_temp.check_guest(value boolean) returns void language plpgsql as $$
begin if value is distinct from true then raise exception 'Guest assertion failed'; end if; end $$;
create function pg_temp.reject_guest(command text,expected text) returns void language plpgsql as $$
declare actual text; begin
  begin execute command; exception when others then get stacked diagnostics actual=returned_sqlstate;
    if actual=expected then return; end if; raise exception 'Expected %, got %: %',expected,actual,sqlerrm; end;
  raise exception 'Unexpected operation success'; end $$;
create function pg_temp.guest(actor integer,command jsonb,hash text default repeat('b',64)) returns jsonb language sql as $$
select public.workspace_page_guest_command(('10000000-0000-4000-8000-'||lpad(actor::text,12,'0'))::uuid,
 '10000000-0000-4000-8000-000000000010',command,hash);
$$;
set local role service_role;
select public.fixture_page_commit(0,'share_with_guests','10000000-0000-4000-8000-000000000030');
select pg_temp.check_guest(public.read_workspace_page_public('community-table','10000000-0000-4000-8000-000000000010') is null);
select pg_temp.check_guest((select visibility='private' and guest_snapshot is not null and published_snapshot is null from public.organization_workspace_pages));
select pg_temp.reject_guest('select pg_temp.guest(6,''{"action":"read"}'')','42501');
select pg_temp.reject_guest('select pg_temp.guest(2,''{"action":"read"}'')','42501');
select pg_temp.guest(1,'{"action":"invite","operationId":"10000000-0000-4000-8000-000000000100","invitationId":"10000000-0000-4000-8000-000000000200","permission":"view","email":"person6@example.org"}');
select pg_temp.reject_guest('select pg_temp.guest(7,''{"action":"accept","invitationId":"10000000-0000-4000-8000-000000000200"}'')','42501');
select pg_temp.guest(6,'{"action":"accept","invitationId":"10000000-0000-4000-8000-000000000200"}');
select pg_temp.check_guest(pg_temp.guest(6,'{"action":"read"}')->'draft'='null'::jsonb);
select pg_temp.check_guest(pg_temp.guest(6,'{"action":"read"}')->'invitations'='[]'::jsonb);
select pg_temp.reject_guest('select pg_temp.guest(6,''{"action":"edit"}'')','42501');
select pg_temp.reject_guest('select pg_temp.guest(6,''{"action":"invite"}'')','42501');
select pg_temp.guest(1,'{"action":"invite","operationId":"10000000-0000-4000-8000-000000000101","invitationId":"10000000-0000-4000-8000-000000000201","permission":"edit","email":"person7@example.org"}');
select pg_temp.guest(7,'{"action":"accept","invitationId":"10000000-0000-4000-8000-000000000201"}');
select pg_temp.guest(7,'{"action":"edit","operationId":"10000000-0000-4000-8000-000000000102","expectedRevision":1,"title":"Corrected","description":"Private draft"}');
select pg_temp.check_guest((select revision=2 and title='Corrected' and guest_snapshot->>'title'='Gather together' and published_snapshot is null from public.organization_workspace_pages));
select pg_temp.check_guest((pg_temp.guest(7,'{"action":"edit","operationId":"10000000-0000-4000-8000-000000000102","expectedRevision":1,"title":"Corrected","description":"Private draft"}')->>'replayed')::boolean);
select pg_temp.reject_guest('select pg_temp.guest(7,''{"action":"edit","operationId":"10000000-0000-4000-8000-000000000103","expectedRevision":1,"title":"Stale","description":""}'')','40001');
select pg_temp.reject_guest('select pg_temp.guest(7,''{"action":"edit","operationId":"10000000-0000-4000-8000-000000000102","expectedRevision":2,"title":"Injected","description":""}'',repeat(''c'',64))','22023');
select pg_temp.reject_guest('select pg_temp.guest(7,''{"action":"invite"}'')','42501');
select pg_temp.reject_guest('select public.fixture_page_commit(2,''publish'',''10000000-0000-4000-8000-000000000104'',''10000000-0000-4000-8000-000000000007'')','42501');
-- A manager may delegate view/edit, not manage or unrelated organization access.
select pg_temp.guest(1,'{"action":"invite","operationId":"10000000-0000-4000-8000-000000000105","invitationId":"10000000-0000-4000-8000-000000000202","permission":"manage","email":"person8@example.org"}');
select pg_temp.guest(8,'{"action":"accept","invitationId":"10000000-0000-4000-8000-000000000202"}');
select pg_temp.guest(8,'{"action":"invite","operationId":"10000000-0000-4000-8000-000000000106","invitationId":"10000000-0000-4000-8000-000000000203","permission":"edit","email":"person10@example.org"}');
select pg_temp.guest(10,'{"action":"accept","invitationId":"10000000-0000-4000-8000-000000000203"}');
select pg_temp.reject_guest('select pg_temp.guest(8,''{"action":"invite","operationId":"10000000-0000-4000-8000-000000000107","invitationId":"10000000-0000-4000-8000-000000000204","permission":"manage","email":"person11@example.org"}'')','42501');
select pg_temp.reject_guest('select pg_temp.guest(8,''{"action":"revoke","operationId":"10000000-0000-4000-8000-000000000108","invitationId":"10000000-0000-4000-8000-000000000201"}'')','42501');
select pg_temp.guest(1,'{"action":"revoke","operationId":"10000000-0000-4000-8000-000000000109","invitationId":"10000000-0000-4000-8000-000000000202"}');
select pg_temp.reject_guest('select pg_temp.guest(10,''{"action":"read"}'')','42501');
select pg_temp.reject_guest('select pg_temp.guest(8,''{"action":"read"}'')','42501');
-- Unconfirmed identity and expired invitations cannot be accepted.
select pg_temp.guest(1,'{"action":"invite","operationId":"10000000-0000-4000-8000-000000000110","invitationId":"10000000-0000-4000-8000-000000000205","permission":"view","email":"person9@example.org"}');
select pg_temp.reject_guest('select pg_temp.guest(9,''{"action":"accept","invitationId":"10000000-0000-4000-8000-000000000205"}'')','42501');
reset role;
update public.workspace_page_invitations set expires_at=now()-interval '1 day' where id='10000000-0000-4000-8000-000000000205';
update auth.users set email_confirmed_at=now() where id='10000000-0000-4000-8000-000000000009';
set local role service_role;
select pg_temp.reject_guest('select pg_temp.guest(9,''{"action":"accept","invitationId":"10000000-0000-4000-8000-000000000205"}'')','42501');
-- Revocation denies reads and even a previously successful edit replay.
select pg_temp.guest(1,'{"action":"revoke","operationId":"10000000-0000-4000-8000-000000000111","invitationId":"10000000-0000-4000-8000-000000000201"}');
select pg_temp.reject_guest('select pg_temp.guest(7,''{"action":"edit","operationId":"10000000-0000-4000-8000-000000000102","expectedRevision":1,"title":"Corrected","description":"Private draft"}'')','42501');
reset role;
select pg_temp.check_guest((select count(*)=3 from public.organization_memberships));
select pg_temp.check_guest((select action='edit' and result_revision=2 and changed_fields=array['title','description']
  from public.workspace_page_guest_receipts where operation_id='10000000-0000-4000-8000-000000000102'));
select pg_temp.check_guest((select revoked_at is not null from public.workspace_page_invitations where id='10000000-0000-4000-8000-000000000203'));
set local role anon;
select pg_temp.reject_guest('select pg_temp.guest(1,''{"action":"read"}'')','42501');
select pg_temp.reject_guest('select * from public.workspace_page_invitations','42501');
set local role authenticated;
select pg_temp.reject_guest('select pg_temp.guest(1,''{"action":"read"}'')','42501');
select pg_temp.reject_guest('select * from public.workspace_page_guest_receipts','42501');
reset role;
rollback;
