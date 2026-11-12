-- Dependencies for real file/room/version migrations in the folder harness.
alter table public.organizations add column profile jsonb not null default '{}';
create schema storage;
create table storage.buckets(id text primary key,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,metadata jsonb);
alter table storage.objects enable row level security;
create publication supabase_realtime;
create function public.has_workspace_paid_features(uuid) returns boolean language sql stable as $$ select true $$;
create function auth.role() returns text language sql stable as $$select current_setting('role',true)$$;
