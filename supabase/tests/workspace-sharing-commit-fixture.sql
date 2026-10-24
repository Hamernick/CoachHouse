\set ON_ERROR_STOP on
-- Only a disposable local database may contain these synthetic fixtures.
do $$ begin
  if current_setting('coach_house.workspace_sharing_fixture',true) is distinct from 'isolated-test-only'
    or current_database() not like 'workspace_sharing_fixture_%'
    or (inet_server_addr() is not null and inet_server_addr() not in ('127.0.0.1'::inet,'::1'::inet)) then
    raise exception 'This fixture requires a marked isolated local database.';
  end if;
end $$;
begin;
do $$ begin
  if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema auth;
grant usage on schema public,auth to anon,authenticated,service_role;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
$$;
create table public.organizations(user_id uuid primary key,profile jsonb,public_slug text,updated_at timestamptz);
create table public.organization_memberships(org_id uuid,member_id uuid,role text,primary key(org_id,member_id));
create table public.organization_workspace_boards(org_id uuid primary key,state jsonb);
create table public.organization_external_documents(id uuid primary key,org_id uuid,provider text,
  provider_file_id text,web_view_link text,updated_at timestamptz,status text);
create table public.public_handles(handle text primary key,owner_type text,organization_id uuid);
create table public.public_handle_reservations(handle text primary key);
grant select on public.organization_memberships to authenticated;
grant select,update on public.organizations,public.organization_memberships,public.organization_workspace_boards to service_role;
grant select,update on public.organization_external_documents to service_role;
grant select,update on public.public_handles to service_role;
grant select on public.public_handle_reservations to service_role;
insert into public.organizations values
  ('10000000-0000-4000-8000-000000000001','{"name":"Community table","private":"never publish"}','community-table','2026-10-16T18:30:00Z'),
  ('10000000-0000-4000-8000-000000000002','{"name":"Other"}','other','2026-10-16T18:30:00Z');
insert into public.organization_memberships values
  ('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000003','admin'),
  ('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000004','staff'),
  ('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000005','board');
insert into public.organization_workspace_boards values
  ('10000000-0000-4000-8000-000000000001','{"particleGraph":{"workspaceId":"10000000-0000-4000-8000-000000000001","particles":[{"id":"10000000-0000-4000-8000-000000000020","title":"Saved"}]}}');
insert into public.public_handles values ('community-table','organization','10000000-0000-4000-8000-000000000001');
\ir ../migrations/20261016183000_workspace_page_membership.sql
\ir ../migrations/20261016190000_workspace_page_commit.sql
\ir ../migrations/20261018120000_workspace_page_public_read.sql
insert into public.organization_external_documents values
  ('10000000-0000-4000-8000-000000000040','10000000-0000-4000-8000-000000000001','google_drive',
   'canonicalFile01','https://docs.google.com/document/d/canonicalFile01/edit','2026-10-16T18:30:00Z','available');
-- Shared helper is fixture-only. Independent psql sessions exercise real locks.
create function public.fixture_page_commit(
  revision integer,intent text,operation_id uuid,
  actor uuid default '10000000-0000-4000-8000-000000000001',
  expected_graph jsonb default '{"workspaceId":"10000000-0000-4000-8000-000000000001","particles":[{"id":"10000000-0000-4000-8000-000000000020","title":"Saved"}]}',
  hash text default repeat('a',64), drive_checks jsonb default '[]', expected_profile jsonb default null
) returns jsonb language sql security invoker set search_path='' as $$
  select public.commit_workspace_page(actor,'10000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000010',operation_id,hash,revision,intent,
    '{"title":"Gather together","description":"Welcome","particleIds":["10000000-0000-4000-8000-000000000020"]}',
    '{"version":1,"brand":{"name":"Community table","organizationSlug":"community-table"},"title":"Gather together","description":"Welcome","items":[{"id":"10000000-0000-4000-8000-000000000020","title":"Saved","content":{"kind":"text"}}]}',
    expected_graph,'2026-10-16T18:30:00Z',drive_checks,expected_profile);
$$;
grant execute on function public.fixture_page_commit(integer,text,uuid,uuid,jsonb,text,jsonb,jsonb) to service_role,authenticated,anon;
commit;
