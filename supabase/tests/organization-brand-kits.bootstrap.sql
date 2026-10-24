create table auth.users(id uuid primary key);
insert into auth.users select id from public.profiles;
alter table public.organizations add column ein text, add column public_slug text,
  add column is_public boolean default false, add column location_lat double precision,
  add column location_lng double precision, add column updated_at timestamptz default now();
-- Exercise private kits even when the parent organization is public.
update public.organizations set is_public=true, public_slug='public-test';
