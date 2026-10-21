\set ON_ERROR_STOP on
-- Self-contained fixture; run only in a disposable local database named
-- workspace_calendar_fixture_*, with the explicit session marker below.
do $$ begin
  if current_setting('coach_house.workspace_calendar_fixture', true) is distinct from 'isolated-test-only'
    or current_database() not like 'workspace_calendar_fixture_%'
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
create table public.profiles(id uuid primary key, role text not null default 'member');
create table public.organizations(user_id uuid primary key references public.profiles(id), profile jsonb default '{}');
create table public.organization_memberships(
  org_id uuid references public.organizations(user_id) on delete cascade,
  member_id uuid references public.profiles(id), role text not null,
  primary key(org_id, member_id)
);
create table public.organization_access_settings(
  org_id uuid primary key references public.organizations(user_id) on delete cascade,
  staff_can_manage_calendar boolean not null default false
);
create function public.is_admin() returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin');
$$;
create function public.handle_updated_at() returns trigger language plpgsql as $$
  begin new.updated_at=now(); return new; end;
$$;
grant select on public.organization_memberships, public.organization_access_settings to authenticated;
create publication supabase_realtime;
\ir ../migrations/20260222183000_add_workspace_board_tables.sql
grant select, insert, update, delete on public.organization_workspace_boards to authenticated, service_role;

create function pg_temp.calendar_assert(value boolean, message text) returns void language plpgsql as $$
  begin if value is distinct from true then raise exception 'Calendar assertion failed: %', message; end if; end;
$$;
create function pg_temp.calendar_denied(command text) returns void language plpgsql as $$
  begin
    begin execute command;
    exception when insufficient_privilege then return;
    end;
    raise exception 'Calendar operation unexpectedly permitted: %', command;
  end;
$$;

insert into public.profiles(id, role) values
  ('10000000-0000-4000-8000-000000000001','member'),
  ('10000000-0000-4000-8000-000000000002','member'),
  ('10000000-0000-4000-8000-000000000003','member'),
  ('10000000-0000-4000-8000-000000000004','member'),
  ('10000000-0000-4000-8000-000000000005','member'),
  ('10000000-0000-4000-8000-000000000006','admin'),
  ('10000000-0000-4000-8000-000000000007','member');
insert into public.organizations(user_id) values
  ('10000000-0000-4000-8000-000000000001'),('10000000-0000-4000-8000-000000000002');
insert into public.organization_access_settings(org_id) select user_id from public.organizations;
insert into public.organization_memberships(org_id, member_id, role) values
  ('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000003','staff'),
  ('10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003','staff'),
  ('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000004','admin'),
  ('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000005','board');
insert into public.organization_workspace_boards(org_id,state) values
('10000000-0000-4000-8000-000000000001', '{"particleGraph":{"particles":[
  {"id":"event-one","type":"activity","title":"Planning","description":"Agenda","data":{"widget":{"kind":"event","startsAt":"2026-10-20T14:00:00.000Z"}}},
  {"id":"backing","type":"activity","title":"Existing calendar source","data":{"source":{"kind":"calendar_event"},"widget":{"kind":"event","startsAt":"2026-10-20T14:00:00.000Z"}}},
  {"id":"undated","type":"activity","title":"Draft","data":{"widget":{"kind":"event","startsAt":null}}}
]}}');

\ir ../migrations/20261015003000_workspace_particle_calendar_revisions.sql
-- Applying the DDL again must not duplicate publication membership or backfill.
\ir ../migrations/20261015003000_workspace_particle_calendar_revisions.sql
\ir ../migrations/20261019200000_workspace_named_canvas_calendar_guard.sql
select pg_temp.calendar_assert((select count(*)=0 from public.organization_workspace_calendar_revisions),'no event backfill');
select pg_temp.calendar_assert((select count(*)=1 from pg_publication_tables where pubname='supabase_realtime' and tablename='organization_workspace_calendar_revisions'),'signal published exactly once');
select pg_temp.calendar_assert(not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='organization_workspace_boards'),'full board remains unpublished');
select pg_temp.calendar_assert((select relrowsecurity and relforcerowsecurity from pg_class where oid='public.organization_workspace_calendar_revisions'::regclass),'forced signal RLS');

select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',true);
set local role authenticated;
-- Staff without calendar rights can still move/hide cards and edit draft Events.
update public.organization_workspace_boards set state=jsonb_set(state,'{particleGraph,particles,0,position}','{"x":12,"y":34}');
update public.organization_workspace_boards set state=jsonb_set(state,'{particleGraph,particles,0,canvasHidden}','true');
update public.organization_workspace_boards set state=jsonb_set(state,'{particleGraph,particles,0,revision}','99');
update public.organization_workspace_boards set state=jsonb_set(state,'{particleGraph,particles,0,updatedAt}','"2030-01-01T00:00:00Z"');
update public.organization_workspace_boards set state=jsonb_set(state,'{particleGraph,particles,1,title}','"Changed backing card"');
update public.organization_workspace_boards set state=jsonb_set(state,'{particleGraph,particles,2,title}','"Changed unscheduled draft"');
select pg_temp.calendar_assert((select count(*)=0 from public.organization_workspace_calendar_revisions),'layout, backing sources and drafts are silent');
select pg_temp.calendar_denied($cmd$ update public.organization_workspace_boards set state=jsonb_set(state,'{particleGraph,particles,0,title}','"Denied"') $cmd$);
-- Forging a JWT role claim cannot bypass the authenticated invoker-role check.
select set_config('request.jwt.claim.role','service_role',true);
select pg_temp.calendar_denied($cmd$ update public.organization_workspace_boards set state=jsonb_set(state,'{particleGraph,particles,0,title}','"Forged claim"') $cmd$);
select set_config('request.jwt.claim.role','authenticated',true);
select pg_temp.calendar_assert((select state#>>'{particleGraph,particles,0,title}'='Planning' from public.organization_workspace_boards),'denied mutation rolls back board');

-- Owners can change every canonical semantic field, atomically with receipts.
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
update public.organization_workspace_boards set state=jsonb_set(state,'{particleGraph,particles,0,title}','"Owner title"');
update public.organization_workspace_boards set state=jsonb_set(state,'{particleGraph,particles,0,data,widget,startsAt}','"2026-10-21T15:00:00.000Z"');
update public.organization_workspace_boards set state=jsonb_set(state,'{particleGraph,particles,0,data,widget,location}','"Room 4"');
update public.organization_workspace_boards set state=jsonb_set(state,'{particleGraph,particles,0,data,widget,attendees}','["Cal","Alex"]');
update public.organization_workspace_boards set state=jsonb_set(state,'{particleGraph,particles,0,description}','"Updated agenda"');
select pg_temp.calendar_assert((select revision=5 from public.organization_workspace_calendar_revisions),'one revision per semantic mutation');
select pg_temp.calendar_denied($cmd$ insert into public.organization_workspace_calendar_revisions(org_id) values('10000000-0000-4000-8000-000000000002') $cmd$);
select pg_temp.calendar_denied('update public.organization_workspace_calendar_revisions set revision=999');
select pg_temp.calendar_denied('delete from public.organization_workspace_calendar_revisions');
select pg_temp.calendar_denied('select public.workspace_particle_calendar_projection(null)');
reset role;

update public.organization_access_settings set staff_can_manage_calendar=true where org_id='10000000-0000-4000-8000-000000000001';
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',true);
set local role authenticated;
update public.organization_workspace_boards set state=jsonb_set(state,'{particleGraph,particles,0,title}','"Allowed staff"');
select pg_temp.calendar_assert((select revision=6 from public.organization_workspace_calendar_revisions),'enabled staff can manage scheduled events');
-- Staff has board-edit rights in both orgs, but calendar rights only in the old.
select pg_temp.calendar_denied($cmd$ update public.organization_workspace_boards set org_id='10000000-0000-4000-8000-000000000002' $cmd$);
select pg_temp.calendar_assert((select revision=6 from public.organization_workspace_calendar_revisions),'failed scope move emits no receipt');
reset role;
update public.organization_access_settings set staff_can_manage_calendar=false where org_id='10000000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_temp.calendar_denied($cmd$ update public.organization_workspace_boards set state=jsonb_set(state,'{particleGraph,particles,0,data,widget,startsAt}','null') $cmd$);
select pg_temp.calendar_denied('delete from public.organization_workspace_boards');
reset role;

-- Organizational admins and platform admins retain the internal-calendar grant.
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000004',true);
set local role authenticated;
update public.organization_workspace_boards set state=jsonb_set(state,'{particleGraph,particles,0,title}','"Org admin"');
select pg_temp.calendar_assert((select revision=7 from public.organization_workspace_calendar_revisions),'organization admin permitted');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000006',true);
update public.organization_workspace_boards set state=jsonb_set(state,'{particleGraph,particles,0,title}','"Platform admin"');
select pg_temp.calendar_assert((select revision=8 from public.organization_workspace_calendar_revisions),'platform admin permitted');
-- Removing scheduling and undoing that removal each notify exactly once.
update public.organization_workspace_boards set state=jsonb_set(state,'{particleGraph,particles,0,data,widget,startsAt}','null');
update public.organization_workspace_boards set state=jsonb_set(state,'{particleGraph,particles,0,data,widget,startsAt}','"2026-10-21T15:00:00.000Z"');
select pg_temp.calendar_assert((select revision=10 from public.organization_workspace_calendar_revisions),'unschedule and restore both notify');
update public.organization_workspace_boards set org_id='10000000-0000-4000-8000-000000000002';
select pg_temp.calendar_assert((select revision=11 from public.organization_workspace_calendar_revisions where org_id='10000000-0000-4000-8000-000000000001'),'old scope notified');
select pg_temp.calendar_assert((select revision=1 from public.organization_workspace_calendar_revisions where org_id='10000000-0000-4000-8000-000000000002'),'new scope notified');
update public.organization_workspace_boards set org_id='10000000-0000-4000-8000-000000000001';
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000005',true);
select pg_temp.calendar_assert((select count(*)=1 from public.organization_workspace_calendar_revisions),'ordinary member reads only own org signal');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000007',true);
select pg_temp.calendar_assert((select count(*)=0 from public.organization_workspace_calendar_revisions),'outsider cannot read receipts');
reset role;
set local role anon;
select pg_temp.calendar_denied('select * from public.organization_workspace_calendar_revisions');
reset role;

-- Explicit service-role writes are already authorized by the server boundary.
select set_config('request.jwt.claim.sub','',true);
set local role service_role;
insert into public.organization_workspace_boards(org_id,state)
  select '10000000-0000-4000-8000-000000000002',state from public.organization_workspace_boards;
select pg_temp.calendar_assert((select revision=3 from public.organization_workspace_calendar_revisions where org_id='10000000-0000-4000-8000-000000000002'),'scheduled insert signals');
delete from public.organization_workspace_boards where org_id='10000000-0000-4000-8000-000000000002';
select pg_temp.calendar_assert((select revision=4 from public.organization_workspace_calendar_revisions where org_id='10000000-0000-4000-8000-000000000002'),'scheduled board delete signals');
insert into public.organization_workspace_boards(org_id,state)
  select '10000000-0000-4000-8000-000000000002',state from public.organization_workspace_boards;
reset role;
delete from public.organizations where user_id='10000000-0000-4000-8000-000000000002';
select pg_temp.calendar_assert(not exists(select 1 from public.organization_workspace_calendar_revisions where org_id='10000000-0000-4000-8000-000000000002'),'organization cascade never recreates orphan signal');

-- Canonical projection is independent of particle ordering and graph metadata.
select pg_temp.calendar_assert(
  public.workspace_particle_calendar_projection('{"particleGraph":{"particles":[{"id":"b","type":"activity","title":"B","data":{"widget":{"kind":"event","startsAt":"2026-10-20T14:00:00Z"}}},{"id":"a","type":"activity","title":"A","data":{"widget":{"kind":"event","startsAt":"2026-10-20T14:00:00Z"}}}]}}') =
  public.workspace_particle_calendar_projection('{"particleGraph":{"revision":42,"particles":[{"id":"a","type":"activity","title":"A","data":{"widget":{"kind":"event","startsAt":"2026-10-20T14:00:00Z","location":"","attendees":[]}}},{"id":"b","type":"activity","title":"B","position":{"x":4,"y":8},"data":{"widget":{"kind":"event","startsAt":"2026-10-20T14:00:00Z"}}}]}}'),
  'order, layout and optional legacy defaults are equivalent');
-- Named canvases must use the same permission guard and semantic receipts.
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',true);
set local role authenticated;
select pg_temp.calendar_assert(public.workspace_canvas_storage_version()=1, 'named canvas storage ready');
select pg_temp.calendar_denied($command$
  update public.organization_workspace_boards set state=jsonb_set(state,'{workspaceCatalog}',
    '{"version":1,"defaultName":"Main","entries":[{"id":"named","name":"Planning","state":{"particleGraph":{"particles":[{"id":"named-event","type":"activity","title":"Named event","data":{"widget":{"kind":"event","startsAt":"2026-10-20T14:00:00Z"}}}]}}}]}');
$command$);
reset role;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
do $$ declare before_revision bigint; begin
  select revision into before_revision from public.organization_workspace_calendar_revisions where org_id='10000000-0000-4000-8000-000000000001';
  update public.organization_workspace_boards set state=jsonb_set(state,'{workspaceCatalog}',
    '{"version":1,"defaultName":"Main","entries":[{"id":"named","name":"Planning","state":{"particleGraph":{"particles":[{"id":"named-event","type":"activity","title":"Named event","data":{"widget":{"kind":"event","startsAt":"2026-10-20T14:00:00Z"}}}]}}}]}');
  perform pg_temp.calendar_assert((select revision=before_revision+1 from public.organization_workspace_calendar_revisions where org_id='10000000-0000-4000-8000-000000000001'), 'named event save notifies');
  update public.organization_workspace_boards set state=jsonb_set(state,'{workspaceCatalog,entries,0,name}','"Renamed"');
  perform pg_temp.calendar_assert((select revision=before_revision+1 from public.organization_workspace_calendar_revisions where org_id='10000000-0000-4000-8000-000000000001'), 'rename does not invalidate calendar');
  update public.organization_workspace_boards set state=state-'workspaceCatalog';
  perform pg_temp.calendar_assert((select state#>>'{workspaceCatalog,entries,0,name}'='Renamed' from public.organization_workspace_boards), 'legacy client preserves named canvases');
  perform pg_temp.calendar_assert((select revision=before_revision+1 from public.organization_workspace_calendar_revisions where org_id='10000000-0000-4000-8000-000000000001'), 'legacy client does not delete named calendar events');
end $$;
-- Default canvas deletion must remain empty under stale writes and retain the
-- same calendar permission boundary. Existing names are not migrated.
\ir ../migrations/20261019223500_workspace_default_canvas_lifecycle.sql
select pg_temp.calendar_assert(public.workspace_canvas_storage_version()=2, 'default deletion ready');
select pg_temp.calendar_assert((select state#>>'{workspaceCatalog,defaultName}'='Main' from public.organization_workspace_boards), 'existing workspace name preserved');
insert into public.organizations(user_id) values ('10000000-0000-4000-8000-000000000002');
insert into public.organization_workspace_boards(org_id,state) values
  ('10000000-0000-4000-8000-000000000002','{}');
select pg_temp.calendar_assert((select state#>>'{workspaceCatalog,defaultName}'='Build' and jsonb_array_length(state#>'{workspaceCatalog,entries}')=0 from public.organization_workspace_boards where org_id='10000000-0000-4000-8000-000000000002'), 'new organization gets only Build');
delete from public.organization_workspace_boards where org_id='10000000-0000-4000-8000-000000000002';
create temp table default_before_delete as select state from public.organization_workspace_boards;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',true);
set local role authenticated;
select pg_temp.calendar_denied($command$
  update public.organization_workspace_boards set state=jsonb_set(state,'{workspaceCatalog,defaultDeleted}','true');
$command$);
reset role;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
do $$ declare before_revision bigint; begin
  select revision into before_revision from public.organization_workspace_calendar_revisions where org_id='10000000-0000-4000-8000-000000000001';
  update public.organization_workspace_boards set state=jsonb_set(state,'{workspaceCatalog,defaultDeleted}','true');
  perform pg_temp.calendar_assert((select not (state ? 'particleGraph') and state#>>'{workspaceCatalog,defaultDeleted}'='true' from public.organization_workspace_boards), 'deleted root data removed');
  perform pg_temp.calendar_assert((select state#>>'{workspaceCatalog,entries,0,name}'='Renamed' from public.organization_workspace_boards), 'sibling preserved');
  perform pg_temp.calendar_assert((select revision=before_revision+1 from public.organization_workspace_calendar_revisions where org_id='10000000-0000-4000-8000-000000000001'), 'root event removal notifies once');
  update public.organization_workspace_boards set state=(select state-'workspaceCatalog' from default_before_delete);
  perform pg_temp.calendar_assert((select not (state ? 'particleGraph') and state#>>'{workspaceCatalog,defaultDeleted}'='true' from public.organization_workspace_boards), 'legacy write cannot resurrect root');
  update public.organization_workspace_boards set state=(select state from default_before_delete);
  perform pg_temp.calendar_assert((select not (state ? 'particleGraph') and state#>>'{workspaceCatalog,defaultDeleted}'='true' from public.organization_workspace_boards), 'stale catalog cannot revive root');
  perform pg_temp.calendar_assert((select revision=before_revision+1 from public.organization_workspace_calendar_revisions where org_id='10000000-0000-4000-8000-000000000001'), 'stale saves do not restore calendar events');
end $$;
\ir ../rollbacks/20261019223500_workspace_default_canvas_lifecycle.sql
select pg_temp.calendar_assert(public.workspace_canvas_storage_version()=1, 'rollback gates root deletion');
update public.organization_workspace_boards set state=(select state from default_before_delete);
select pg_temp.calendar_assert((select not (state ? 'particleGraph') and state#>>'{workspaceCatalog,defaultDeleted}'='true' from public.organization_workspace_boards), 'rollback retains resurrection protection');
\ir ../rollbacks/20261019200000_workspace_named_canvas_calendar_guard.sql
select pg_temp.calendar_assert(to_regprocedure('public.workspace_canvas_storage_version()') is null, 'rollback gates named writes');
select pg_temp.calendar_assert((select state#>>'{workspaceCatalog,entries,0,name}'='Renamed' from public.organization_workspace_boards), 'rollback preserves named canvas');
\ir ../rollbacks/20261015003000_workspace_particle_calendar_revisions.sql
select pg_temp.calendar_assert(to_regclass('public.organization_workspace_calendar_revisions') is null,'rollback removes signal table');
select pg_temp.calendar_assert(not exists(select 1 from pg_trigger where tgname='workspace_particle_calendar_revision'),'rollback removes trigger');
select pg_temp.calendar_assert((select count(*)=1 from public.organization_workspace_boards),'rollback preserves source Event data');
rollback;
\echo 'workspace-particle-calendar: semantic receipts, direct-write authorization, RLS, scope changes, cascade and rollback passed'
