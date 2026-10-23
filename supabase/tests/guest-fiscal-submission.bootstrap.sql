create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create extension if not exists pgcrypto;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create function public.is_admin() returns boolean language sql stable as $$ select false $$;
create function public.handle_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
create table public.profiles(id uuid primary key, email text unique);
create table public.organizations(user_id uuid primary key references public.profiles(id));
create table public.platform_staff_members(user_id uuid primary key references public.profiles(id), access_level text not null default 'coach');
create table public.organization_memberships(org_id uuid, member_id uuid, role text);
create table public.organization_projects(
 id uuid primary key, org_id uuid not null references public.organizations(user_id),
 project_kind text not null, name text not null, created_source text not null,
 created_at timestamptz not null default now(),
 created_by uuid not null references public.profiles(id), updated_by uuid references public.profiles(id),
 organization_unassigned boolean not null default false, option_settings jsonb
);
create table public.fiscal_sponsorship_events(
 id uuid primary key default gen_random_uuid(), org_id uuid, project_id uuid, application_id uuid,
 event_type text, actor_id uuid, summary text, metadata jsonb
);
grant usage on schema public, auth to anon, authenticated, service_role;
insert into public.profiles values
 ('10000000-0000-0000-0000-000000000001','internal@example.test'),
 ('10000000-0000-0000-0000-000000000002','fs@coachhousesolutions.org'),
 ('10000000-0000-0000-0000-000000000003','joel@coachhousesolutions.org');
insert into public.organizations values('10000000-0000-0000-0000-000000000001');
insert into public.platform_staff_members(user_id) select id from public.profiles;

create table public.notifications(id uuid primary key default gen_random_uuid(),user_id uuid not null,org_id uuid,actor_id uuid,title text not null,description text not null,href text,tone text,type text,metadata jsonb);
