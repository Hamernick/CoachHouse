\set ON_ERROR_STOP on
\ir organization-closure-opportunity-fixture.sql
-- Omitted access settings and public-roadmap flag are synthetic. Calendar tables, RLS,
-- constraints and board-to-calendar revision trigger use actual migrations.
create table public.organization_access_settings(org_id uuid primary key references public.organizations(user_id) on delete cascade);
alter table public.organizations add column is_public_roadmap boolean not null default false;
\ir ../migrations/20260124220000_roadmap_calendar_events.sql
\ir ../migrations/20260306163000_add_roadmap_calendar_event_type.sql
\ir ../migrations/20261015003000_workspace_particle_calendar_revisions.sql
set check_function_bodies=on;
\ir ../migrations/20261102100000_organization_closure_calendar_writes.sql
grant select,insert,update,delete on public.roadmap_calendar_public_events,public.roadmap_calendar_internal_events,
 public.roadmap_calendar_public_feeds,public.roadmap_calendar_internal_feeds to authenticated,service_role;
grant select on public.roadmap_calendar_public_events to anon;
grant select,insert,update,delete on public.organization_workspace_calendar_revisions to service_role;
grant select on public.organization_access_settings,public.organizations to authenticated,anon;
create function public.fixture_closure_calendar() returns void language plpgsql as $$
begin
 truncate public.roadmap_calendar_public_events,public.roadmap_calendar_internal_events,
   public.roadmap_calendar_public_feeds,public.roadmap_calendar_internal_feeds,public.organization_workspace_calendar_revisions;
 perform public.fixture_closure_opportunities();
 insert into public.roadmap_calendar_public_events(id,org_id,title,starts_at)
 select public.fixture_form_id(970+n),public.fixture_form_id(n),'Public event',now() from generate_series(1,2) n;
 insert into public.roadmap_calendar_internal_events(id,org_id,title,starts_at)
 select public.fixture_form_id(980+n),public.fixture_form_id(n),'Internal event',now() from generate_series(1,2) n;
 insert into public.roadmap_calendar_public_feeds(org_id,token)
 select public.fixture_form_id(n),'synthetic-public-'||n from generate_series(1,2) n;
 insert into public.roadmap_calendar_internal_feeds(org_id,token)
 select public.fixture_form_id(n),'synthetic-internal-'||n from generate_series(1,2) n;
 -- Trigger setup/reset can issue receipts; fix the synthetic baseline explicitly.
 insert into public.organization_workspace_calendar_revisions(org_id,revision)
 select public.fixture_form_id(n),1 from generate_series(1,2) n
 on conflict(org_id) do update set revision=1;
end; $$;
create function public.fixture_calendar_board_event() returns void language sql as $$
 update public.organization_workspace_boards set state=jsonb_set(state,'{particleGraph,particles}',
 state#>'{particleGraph,particles}'||jsonb_build_array(jsonb_build_object(
 'id',public.fixture_form_id(990),'type','activity','title','Board event','revision',1,
 'data',jsonb_build_object('widget',jsonb_build_object('kind','event','startsAt','2027-01-01T12:00:00Z')))))
 where org_id=public.fixture_form_id(1);
$$;
