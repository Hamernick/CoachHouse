-- Local-only fixture. Never load app credentials or run against a provider.
do $$ begin
  if current_setting('coach_house.document_room_fixture', true) is distinct from 'isolated-test-only'
    then raise exception 'This fixture requires an isolated local database.'; end if;
end $$;
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create schema storage;
grant usage on schema public, auth to authenticated, service_role;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
create function auth.role() returns text language sql stable as $$
  select current_setting('role', true);
$$;
create table public.profiles(id uuid primary key);
create table public.organizations(user_id uuid primary key references profiles(id), profile jsonb default '{}');
create table public.organization_memberships(org_id uuid references organizations(user_id), member_id uuid references profiles(id), role text not null, primary key(org_id, member_id));
create table public.platform_staff_members(user_id uuid primary key references profiles(id), access_level text);
create table public.subscriptions(user_id uuid, status text, metadata jsonb, stripe_subscription_id text, created_at timestamptz default now());
create table storage.buckets(id text primary key, allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text not null,name text not null,metadata jsonb,unique(bucket_id,name));
alter table storage.objects enable row level security;
grant usage on schema storage to authenticated,service_role;
grant select,insert,update,delete on storage.objects to authenticated;
grant all on storage.objects to service_role;
-- Deliberately permissive legacy access proves version policies are restrictive.
create policy fixture_objects on storage.objects for all to authenticated using (true) with check (true);
create function public.handle_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
create function public.is_admin() returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.platform_staff_members where user_id=(select auth.uid()) and access_level='developer');
$$;
grant select on public.organization_memberships to authenticated;
create publication supabase_realtime;

create or replace function public.has_workspace_paid_features(p_org_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select s.status in ('active', 'trialing') and (
      lower(trim(coalesce(s.metadata->>'plan_tier', ''))) in ('organization', 'operations_support')
      or (lower(trim(coalesce(s.metadata->>'planName', ''))) not like '%free%'
          and length(trim(coalesce(s.metadata->>'planName', ''))) > 0)
    )
    from public.subscriptions s
    where s.user_id = p_org_id and s.stripe_subscription_id not ilike 'stub_%'
    order by s.created_at desc limit 1
  ), false);
$$;
revoke all on function public.has_workspace_paid_features(uuid) from public;
grant execute on function public.has_workspace_paid_features(uuid) to authenticated, service_role;

