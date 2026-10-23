create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
create function auth.role() returns text language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'authenticated');
$$;
create function public.is_admin() returns boolean language sql stable as $$ select false; $$;
create table public.organizations (user_id uuid primary key references auth.users(id));
create table public.organization_memberships (org_id uuid, member_id uuid, role text);
create function public.handle_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;
grant usage on schema auth, public to anon, authenticated, service_role;
grant select on public.organization_memberships to authenticated;
-- Supabase's baseline grants precede these migrations. The migrations revoke
-- member writes; test that revocation instead of assuming tables had no grants.
alter default privileges in schema public grant all on tables to authenticated, service_role;
insert into auth.users values
  ('00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000002');
insert into public.organizations select id from auth.users;
