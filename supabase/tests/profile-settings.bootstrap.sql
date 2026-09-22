alter table auth.users add column email text, add column raw_user_meta_data jsonb default '{}'::jsonb;
alter table public.profiles add column headline text, add column avatar_url text;
create table public.platform_email_topics(id text primary key, label text, description text, required boolean);
insert into public.platform_email_topics values ('product_updates', 'Product updates', '', false);
create table public.platform_email_preferences (
  email text, topic_id text references public.platform_email_topics(id), status text check(status in ('subscribed','unsubscribed','pending')),
  source text, person_id text, updated_at timestamptz default now(), unique(email, topic_id)
);
create table public.platform_email_consent_events (email text, topic_id text, action text, source text, person_id text);
create table public.platform_email_suppressions(id uuid default gen_random_uuid(), email text, reason text);
insert into auth.users(id,email,raw_user_meta_data) values
 ('00000000-0000-0000-0000-000000000005','settings@example.test','{"marketing_opt_in":true,"newsletter_opt_in":false}'),
 ('00000000-0000-0000-0000-000000000006','other@example.test','{}');
insert into public.profiles(id,full_name,headline,avatar_url) values
 ('00000000-0000-0000-0000-000000000005','Settings Tester','Original role','https://example.test/old.png'),
 ('00000000-0000-0000-0000-000000000006','Other Tester',null,null);
-- Existing opt-out must win over legacy Auth metadata during migration.
insert into public.platform_email_preferences(email,topic_id,status) values('settings@example.test','product_updates','unsubscribed');
