-- Minimal Auth/profile columns in the isolated database, not production changes.
create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz);
alter table public.organizations add column profile jsonb not null default '{}';
alter table public.organizations add column is_public boolean not null default false;
