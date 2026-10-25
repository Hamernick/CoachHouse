\set ON_ERROR_STOP on
do $$ begin
  if current_setting('coach_house.workspace_sharing_fixture',true) is distinct from 'isolated-test-only'
    or current_database() not like 'workspace_sharing_fixture_%'
    or (inet_server_addr() is not null and inet_server_addr() not in ('127.0.0.1'::inet,'::1'::inet)) then
    raise exception 'This test requires a marked isolated local database.';
  end if;
end $$;
begin;
delete from public.organization_workspace_pages;
update public.organizations set updated_at='2026-10-16T18:30:00Z' where user_id='10000000-0000-4000-8000-000000000001';
update public.organization_external_documents set status='available',updated_at='2026-10-16T18:30:00Z' where id='10000000-0000-4000-8000-000000000040';
update public.organization_workspace_boards set state='{"particleGraph":{"workspaceId":"10000000-0000-4000-8000-000000000001","particles":[{"id":"10000000-0000-4000-8000-000000000020","title":"Saved"}]}}';
create function pg_temp.sharing_assert(value boolean,message text) returns void language plpgsql as $$
  begin if value is distinct from true then raise exception 'Sharing assertion failed: %',message; end if; end;
$$;
create function pg_temp.sharing_rejected(command text,expected_state text) returns void language plpgsql as $$
  declare actual_state text;
  begin
    begin execute command;
    exception when others then
      get stacked diagnostics actual_state=returned_sqlstate;
      if actual_state=expected_state then return; end if;
      raise exception 'Unexpected SQLSTATE % expected %',actual_state,expected_state;
    end;
    raise exception 'Sharing operation unexpectedly permitted';
  end;
$$;
set local role service_role;
select public.fixture_page_commit(0,'save_draft','10000000-0000-4000-8000-000000000030');
select pg_temp.sharing_assert(public.read_workspace_page_public('community-table','10000000-0000-4000-8000-000000000010') is null,'private draft invisible');
select pg_temp.sharing_rejected($cmd$ select public.fixture_page_commit(1,'publish','10000000-0000-4000-8000-000000000031',expected_profile=>'{}') $cmd$,'40001');
select pg_temp.sharing_rejected($cmd$ select public.fixture_page_commit(1,'publish','10000000-0000-4000-8000-000000000031',drive_checks=>'[{"id":"10000000-0000-4000-8000-000000000040","provider_file_id":"anotherFile01","web_view_link":"https://docs.google.com/document/d/canonicalFile01/edit","updated_at":"2026-10-16T18:30:00Z"}]') $cmd$,'40001');
select public.fixture_page_commit(1,'publish','10000000-0000-4000-8000-000000000031',drive_checks=>'[{"id":"10000000-0000-4000-8000-000000000040","provider_file_id":"canonicalFile01","web_view_link":"https://docs.google.com/document/d/canonicalFile01/edit","updated_at":"2026-10-16T18:30:00Z"}]');
select pg_temp.sharing_assert((public.read_workspace_page_public('community-table','10000000-0000-4000-8000-000000000010')->'snapshot'->>'title')='Gather together','confirmed publication readable');
select pg_temp.sharing_assert((select array_agg(key order by key)=array['publishedAt','snapshot'] from jsonb_object_keys(public.read_workspace_page_public('community-table','10000000-0000-4000-8000-000000000010')) key),'no private row columns or draft revision returned');
update public.organization_workspace_pages set title='Unfinished private title',description='Private draft';
select pg_temp.sharing_assert((public.read_workspace_page_public('community-table','10000000-0000-4000-8000-000000000010')->'snapshot'->>'title')='Gather together','draft edits do not leak');
update public.public_handles set organization_id='10000000-0000-4000-8000-000000000002';
select pg_temp.sharing_assert(public.read_workspace_page_public('community-table','10000000-0000-4000-8000-000000000010') is null,'mismatched handle owner denied');
update public.public_handles set organization_id='10000000-0000-4000-8000-000000000001';
select pg_temp.sharing_assert(public.read_workspace_page_public('another-organization','10000000-0000-4000-8000-000000000010') is null,'wrong organization denied');
select pg_temp.sharing_assert(public.read_workspace_page_public('community-table','10000000-0000-4000-8000-000000000099') is null,'wrong link denied');
reset role;
insert into public.public_handle_reservations values ('community-table');
set local role service_role;
select pg_temp.sharing_assert(public.read_workspace_page_public('community-table','10000000-0000-4000-8000-000000000010') is null,'reserved public handle denied');
reset role;
delete from public.public_handle_reservations;
set local role service_role;
select pg_temp.sharing_assert(public.read_workspace_page_public('community-table','10000000-0000-4000-8000-000000000010') is not null,'unreserved current publication restored');
select public.fixture_page_commit(2,'make_private','10000000-0000-4000-8000-000000000032');
select pg_temp.sharing_assert(public.read_workspace_page_public('community-table','10000000-0000-4000-8000-000000000010') is null,'revocation blocks subsequent reads');
reset role;
set local role anon;
select pg_temp.sharing_rejected($cmd$ select public.read_workspace_page_public('community-table','10000000-0000-4000-8000-000000000010') $cmd$,'42501');
select pg_temp.sharing_rejected('select * from public.organization_workspace_pages','42501');
reset role;
set local role authenticated;
select pg_temp.sharing_rejected($cmd$ select public.read_workspace_page_public('community-table','10000000-0000-4000-8000-000000000010') $cmd$,'42501');
reset role;
\ir ../rollbacks/20261018120000_workspace_page_public_read.sql
select pg_temp.sharing_assert((select count(*)=1 from public.organization_workspace_pages),'reader rollback preserves page data');
rollback;
\echo 'workspace-sharing public read: canonical source freshness, committed-only output, scope, revoke, raw access denial and rollback passed'
