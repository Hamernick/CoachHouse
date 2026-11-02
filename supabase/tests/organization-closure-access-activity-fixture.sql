\set ON_ERROR_STOP on
\ir organization-closure-external-documents-fixture.sql
-- Expand only omitted fixture prerequisites; load actual access schemas/policies.
-- The inherited membership role is text, and unrelated hosted support policies
-- are not represented. Runtime access/RLS definitions below are unmodified.
alter table public.organization_memberships
 add column member_email text not null default 'synthetic@example.org',
 add column created_at timestamptz not null default now(),add column updated_at timestamptz not null default now(),
 add foreign key(org_id) references public.organizations(user_id) on delete cascade,
 add foreign key(member_id) references auth.users(id) on delete cascade;
alter table public.organization_access_settings add column admins_can_invite boolean not null default false,
 add column created_at timestamptz not null default now(),add column updated_at timestamptz not null default now();
alter table public.organizations add column is_public boolean not null default false;
alter table public.programs add column is_public boolean not null default false;
create table public.roadmap_events(org_id uuid);
\ir ../migrations/20260115203000_add_organization_access.sql
\ir ../migrations/20260115220000_multi_account_org_access.sql
\ir ../migrations/20260313190000_add_organization_access_requests.sql
\ir ../migrations/20260313193000_restrict_organization_access_request_updates.sql
-- Scoped actual activity policy from20260716203000; upstream project/table
-- prerequisites remain synthetic, while document audit triggers are actual SQL.
alter table public.organization_project_activity_events enable row level security;
alter table public.organization_project_activity_events force row level security;
create policy organization_project_activity_events_select on public.organization_project_activity_events
 for select to authenticated using(public.is_admin() or org_id=auth.uid() or exists(
 select 1 from public.organization_memberships m where m.org_id=organization_project_activity_events.org_id and m.member_id=auth.uid()));
revoke all on public.organization_project_activity_events from anon,authenticated;
grant select on public.organization_project_activity_events to authenticated;
grant select,insert,update,delete on public.organization_access_settings,public.organization_memberships,
 public.organization_invites,public.organization_access_requests to authenticated,service_role;
grant select,insert,update,delete on public.organization_project_activity_events to service_role;
alter table public.organization_project_assets add column name text,add column updated_at timestamptz default now(),
 add column created_by uuid references public.profiles(id) on delete set null,
 add column updated_by uuid references public.profiles(id) on delete set null;
set check_function_bodies=on;
\ir ../migrations/20261102200000_organization_closure_access_activity.sql
create function public.fixture_closure_access_activity() returns void language plpgsql as $$
begin
 truncate public.organization_access_requests,public.organization_invites;
 truncate public.organization_access_settings,public.organization_project_assets;
 perform public.fixture_closure_external_documents();
 delete from public.organization_memberships where member_id in(public.fixture_form_id(6),public.fixture_form_id(13));
 insert into public.organization_access_settings(org_id,admins_can_invite) select public.fixture_form_id(n),true from generate_series(1,2) n;
 insert into public.organization_memberships(org_id,member_id,role)
 select public.fixture_form_id(n),public.fixture_form_id(13),'member' from generate_series(1,2) n
 on conflict(org_id,member_id) do update set role='member';
 insert into public.organization_invites(id,org_id,email,token,expires_at,invited_by)
 select public.fixture_form_id(2000+n),public.fixture_form_id(n),'synthetic@example.org','synthetic-access-invite-'||n,now()+interval '1 day',public.fixture_form_id(13) from generate_series(1,2) n;
 insert into public.organization_access_requests(id,org_id,invitee_user_id,invitee_email,invited_by_user_id,organization_invite_id,expires_at)
 select public.fixture_form_id(2010+n),public.fixture_form_id(n),public.fixture_form_id(13),'synthetic@example.org',public.fixture_form_id(13),public.fixture_form_id(2000+n),now()+interval '1 day' from generate_series(1,2) n;
 insert into public.organization_project_activity_events(id,org_id,entity_type,entity_id,event_type,title,actor_id)
 select public.fixture_form_id(2020+n),public.fixture_form_id(n),'project',public.fixture_form_id(2030+n),'updated','Original',public.fixture_form_id(13) from generate_series(1,2) n;
 insert into public.organization_project_assets(id,org_id,name,created_by,updated_by)
 select public.fixture_form_id(2040+n),public.fixture_form_id(n),'Asset',public.fixture_form_id(13),public.fixture_form_id(13) from generate_series(1,2) n;
end; $$;
