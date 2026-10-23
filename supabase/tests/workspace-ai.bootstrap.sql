create table auth.users(id uuid primary key);
alter table public.profiles add column full_name text;
insert into auth.users select id from public.profiles;
insert into public.organizations(user_id) values ('00000000-0000-0000-0000-000000000004');
create function public.assert_ai(condition boolean, message text) returns void language plpgsql as $$
begin if condition is distinct from true then raise exception 'Assertion: %',message; end if; end $$;

alter table public.organizations add column profile jsonb not null default '{}', add column updated_at timestamptz not null default now();
create function public.fixture_ai_organization_timestamp() returns trigger language plpgsql as $$
begin new.updated_at=clock_timestamp(); return new; end $$;
create trigger fixture_ai_organization_timestamp before update on public.organizations
  for each row execute function public.fixture_ai_organization_timestamp();

create table public.subscriptions(user_id uuid not null references public.profiles(id),stripe_subscription_id text not null,stripe_customer_id text,status text,metadata jsonb,primary key(user_id,stripe_subscription_id));
