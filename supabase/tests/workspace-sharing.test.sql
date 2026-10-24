\set ON_ERROR_STOP on
-- Disposable fixture only. Never run against a linked/shared Supabase project.
do $$ begin
  if current_setting('coach_house.workspace_sharing_fixture', true) is distinct from 'isolated-test-only'
    or current_database() not like 'workspace_sharing_fixture_%'
    or (inet_server_addr() is not null and inet_server_addr() not in ('127.0.0.1'::inet, '::1'::inet)) then
    raise exception 'This test requires a marked isolated local database.';
  end if;
end $$;
begin;
do $$ begin
  if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema auth;
grant usage on schema public, auth to anon, authenticated, service_role;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
create table public.organizations(user_id uuid primary key);
create table public.organization_memberships(org_id uuid, member_id uuid, role text, primary key(org_id, member_id));
create table public.organization_workspace_boards(org_id uuid primary key, state jsonb);
grant select on public.organization_memberships to authenticated;
insert into public.organizations values
  ('10000000-0000-4000-8000-000000000001'), ('10000000-0000-4000-8000-000000000002');
insert into public.organization_memberships values
  ('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000003','admin'),
  ('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000004','staff'),
  ('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000005','board'),
  ('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000006','member');
insert into public.organization_workspace_boards values
  ('10000000-0000-4000-8000-000000000001', '{"particleGraph":{"particles":[{"id":"10000000-0000-4000-8000-000000000020","title":"Original"}]}}');

\ir ../migrations/20261016183000_workspace_page_membership.sql
create function pg_temp.sharing_assert(value boolean, message text) returns void language plpgsql as $$
  begin if value is distinct from true then raise exception 'Sharing assertion failed: %', message; end if; end;
$$;
create function pg_temp.sharing_rejected(command text, expected_state text) returns void language plpgsql as $$
  declare actual_state text;
  begin
    begin execute command;
    exception when others then
      get stacked diagnostics actual_state = returned_sqlstate;
      if actual_state = expected_state then return; end if;
      raise exception 'Unexpected SQLSTATE % (expected %) for %', actual_state, expected_state, command;
    end;
    raise exception 'Sharing operation unexpectedly permitted: %', command;
  end;
$$;

select pg_temp.sharing_assert((select relrowsecurity and relforcerowsecurity from pg_class where oid='public.organization_workspace_pages'::regclass),'forced RLS');
set local role service_role;
insert into public.organization_workspace_pages(id, org_id, link_id, particle_ids) values
('10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000030',
 array['10000000-0000-4000-8000-000000000021','10000000-0000-4000-8000-000000000020']::uuid[]),
('10000000-0000-4000-8000-000000000011','10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000030',
 array['10000000-0000-4000-8000-000000000020']::uuid[]);
select pg_temp.sharing_assert((select visibility='private' and revision=1 and published_snapshot is null from public.organization_workspace_pages where id='10000000-0000-4000-8000-000000000010'),'private by default');
select pg_temp.sharing_assert((select particle_ids[1]='10000000-0000-4000-8000-000000000021'::uuid from public.organization_workspace_pages where id='10000000-0000-4000-8000-000000000010'),'explicit order retained');
select pg_temp.sharing_rejected($cmd$ insert into public.organization_workspace_pages(org_id,link_id,particle_ids) select org_id,link_id,particle_ids from public.organization_workspace_pages where id='10000000-0000-4000-8000-000000000010' $cmd$,'23505');
select pg_temp.sharing_rejected($cmd$ update public.organization_workspace_pages set particle_ids='{}' $cmd$,'23514');
select pg_temp.sharing_rejected($cmd$ update public.organization_workspace_pages set particle_ids=array['10000000-0000-4000-8000-000000000020','10000000-0000-4000-8000-000000000020']::uuid[] $cmd$,'23514');
select pg_temp.sharing_rejected($cmd$ update public.organization_workspace_pages set particle_ids=array[null]::uuid[] $cmd$,'23514');
select pg_temp.sharing_rejected($cmd$ update public.organization_workspace_pages set particle_ids=array(select gen_random_uuid() from generate_series(1,51)) $cmd$,'23514');
select pg_temp.sharing_rejected($cmd$ update public.organization_workspace_pages set particle_ids=array[array['10000000-0000-4000-8000-000000000020']]::uuid[] $cmd$,'23514');
select pg_temp.sharing_rejected($cmd$ update public.organization_workspace_pages set visibility='public' $cmd$,'23514');
select pg_temp.sharing_rejected($cmd$ update public.organization_workspace_pages set published_at=now() $cmd$,'23514');
select pg_temp.sharing_rejected($cmd$ update public.organization_workspace_pages set published_snapshot='[]',published_at=now() $cmd$,'23514');
select pg_temp.sharing_rejected($cmd$ update public.organization_workspace_pages set title=repeat('x',241) $cmd$,'23514');
select pg_temp.sharing_rejected($cmd$ update public.organization_workspace_pages set revision=0 $cmd$,'23514');
reset role;

-- Owner/admin/staff see only their own organization's draft page records.
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select pg_temp.sharing_assert((select count(*)=1 from public.organization_workspace_pages),'owner scoped read');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',true);
select pg_temp.sharing_assert((select count(*)=1 from public.organization_workspace_pages),'admin scoped read');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000004',true);
select pg_temp.sharing_assert((select count(*)=1 from public.organization_workspace_pages),'staff scoped read');
-- No direct writes: even the owner must use the future validated writer.
select pg_temp.sharing_rejected('update public.organization_workspace_pages set visibility=''public''','42501');
select pg_temp.sharing_rejected('delete from public.organization_workspace_pages','42501');
select pg_temp.sharing_rejected($cmd$ insert into public.organization_workspace_pages(org_id,particle_ids) values('10000000-0000-4000-8000-000000000001',array['10000000-0000-4000-8000-000000000020']::uuid[]) $cmd$,'42501');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000005',true);
select pg_temp.sharing_assert((select count(*)=0 from public.organization_workspace_pages),'board member denied');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000006',true);
select pg_temp.sharing_assert((select count(*)=0 from public.organization_workspace_pages),'member denied');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000007',true);
select pg_temp.sharing_assert((select count(*)=0 from public.organization_workspace_pages),'outsider/platform-support alone denied');
select set_config('request.jwt.claim.role','service_role',true);
select pg_temp.sharing_assert((select count(*)=0 from public.organization_workspace_pages),'forged JWT role does not bypass RLS');
reset role;

-- Published content still cannot be fetched by enumerating this private table.
set local role service_role;
update public.organization_workspace_pages set visibility='public', published_snapshot='{"version":1,"title":"Confirmed"}', published_at=now()
  where id='10000000-0000-4000-8000-000000000010';
update public.organization_workspace_pages set title='Unfinished private edit', particle_ids=array['10000000-0000-4000-8000-000000000020']::uuid[]
  where id='10000000-0000-4000-8000-000000000010';
select pg_temp.sharing_assert((select published_snapshot->>'title'='Confirmed' from public.organization_workspace_pages where id='10000000-0000-4000-8000-000000000010'),'draft edit preserves snapshot');
reset role;
set local role anon;
select pg_temp.sharing_rejected('select * from public.organization_workspace_pages','42501');
select pg_temp.sharing_rejected('select particle_ids from public.organization_workspace_pages','42501');
reset role;

-- Page removal never removes the source; organization deletion removes pages.
delete from public.organizations where user_id='10000000-0000-4000-8000-000000000002';
select pg_temp.sharing_assert((select count(*)=1 from public.organization_workspace_pages),'organization cascade');
delete from public.organization_workspace_pages where id='10000000-0000-4000-8000-000000000010';
select pg_temp.sharing_assert((select state#>>'{particleGraph,particles,0,title}'='Original' from public.organization_workspace_boards),'page deletion preserves board/source');
\ir ../rollbacks/20261016183000_workspace_page_membership.sql
select pg_temp.sharing_assert(to_regclass('public.organization_workspace_pages') is null,'rollback removes only page table');
select pg_temp.sharing_assert((select count(*)=1 from public.organization_workspace_boards),'rollback preserves board');
rollback;
\echo 'workspace-sharing: membership, snapshot separation, role isolation, write denial, cascade and rollback passed'
