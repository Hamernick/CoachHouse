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
update public.organization_memberships set role='admin' where member_id='10000000-0000-4000-8000-000000000003';
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
      raise exception 'Unexpected SQLSTATE % expected % for %',actual_state,expected_state,command;
    end;
    raise exception 'Sharing operation unexpectedly permitted: %',command;
  end;
$$;
set local role authenticated;
select pg_temp.sharing_rejected($cmd$ select public.fixture_page_commit(0,'publish','10000000-0000-4000-8000-000000000030') $cmd$,'42501');
reset role;
set local role anon;
select pg_temp.sharing_rejected($cmd$ select public.fixture_page_commit(0,'publish','10000000-0000-4000-8000-000000000030') $cmd$,'42501');
reset role;
set local role service_role;
select pg_temp.sharing_rejected($cmd$ select public.fixture_page_commit(0,'publish','10000000-0000-4000-8000-000000000030','10000000-0000-4000-8000-000000000005') $cmd$,'42501');
select public.fixture_page_commit(0,'save_draft','10000000-0000-4000-8000-000000000030');
select pg_temp.sharing_assert((select visibility='private' and revision=1 from public.organization_workspace_pages),'draft defaults private');
select public.fixture_page_commit(1,'publish','10000000-0000-4000-8000-000000000031');
select pg_temp.sharing_assert((select visibility='public' and revision=2 and link_id=id from public.organization_workspace_pages),'publish stable identity');
select pg_temp.sharing_assert((public.fixture_page_commit(1,'publish','10000000-0000-4000-8000-000000000031')->>'replayed')::boolean,'same operation replay');
select pg_temp.sharing_rejected($cmd$ select public.fixture_page_commit(1,'publish','10000000-0000-4000-8000-000000000031',hash=>repeat('b',64)) $cmd$,'22023');
select pg_temp.sharing_rejected($cmd$ select public.fixture_page_commit(1,'publish','10000000-0000-4000-8000-000000000032') $cmd$,'40001');
select pg_temp.sharing_rejected($cmd$ select public.fixture_page_commit(2,'publish','10000000-0000-4000-8000-000000000032',expected_graph=>'{}') $cmd$,'40001');
select public.fixture_page_commit(2,'save_draft','10000000-0000-4000-8000-000000000032');
select pg_temp.sharing_assert((select visibility='public' and revision=3 and published_snapshot->>'title'='Gather together' from public.organization_workspace_pages),'draft update retains confirmed snapshot');
update public.organization_workspace_boards set state='{"particleGraph":{"workspaceId":"10000000-0000-4000-8000-000000000001","particles":[]}}';
select pg_temp.sharing_rejected($cmd$ select public.fixture_page_commit(3,'publish','10000000-0000-4000-8000-000000000033',expected_graph=>'{"workspaceId":"10000000-0000-4000-8000-000000000001","particles":[]}') $cmd$,'40001');
select public.fixture_page_commit(3,'make_private','10000000-0000-4000-8000-000000000033');
select pg_temp.sharing_assert((select visibility='private' and revision=4 and published_snapshot is not null from public.organization_workspace_pages),'revoke survives missing source');
select pg_temp.sharing_rejected($cmd$ select public.fixture_page_commit(1,'publish','10000000-0000-4000-8000-000000000031') $cmd$,'40001');
select public.fixture_page_commit(4,'make_private','10000000-0000-4000-8000-000000000034','10000000-0000-4000-8000-000000000003');
select public.fixture_page_commit(5,'make_private','10000000-0000-4000-8000-000000000035','10000000-0000-4000-8000-000000000004');
update public.organization_memberships set role='member' where member_id='10000000-0000-4000-8000-000000000003';
select pg_temp.sharing_rejected($cmd$ select public.fixture_page_commit(6,'make_private','10000000-0000-4000-8000-000000000036','10000000-0000-4000-8000-000000000003') $cmd$,'42501');
select pg_temp.sharing_rejected($cmd$ select public.fixture_page_commit(6,'make_private','10000000-0000-4000-8000-000000000036','10000000-0000-4000-8000-000000000099') $cmd$,'42501');
reset role;
-- Revert only the new writer; retain previously confirmed content and boards.
\ir ../rollbacks/20261016190000_workspace_page_commit.sql
select pg_temp.sharing_assert((select visibility='private' and revision=6 and published_snapshot is not null from public.organization_workspace_pages),'writer rollback retains saved page');
select pg_temp.sharing_assert((select count(*)=1 from public.organization_workspace_boards),'writer rollback preserves board');
rollback;
\echo 'workspace-sharing commit: roles, CAS, stale sources, retry, private drafts, revocation and rollback passed'
