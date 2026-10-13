create function auth.role() returns text language sql stable as $$
 select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'authenticated');
$$;
create table public.subscriptions (
 user_id uuid, status text, metadata jsonb, stripe_subscription_id text, created_at timestamptz default now()
);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
create policy existing_storage_owner on storage.objects for all to authenticated
 using (split_part(name, '/', 1) = auth.uid()::text)
 with check (split_part(name, '/', 1) = auth.uid()::text);
grant all on storage.objects to authenticated;
create table public.organization_workspace_invites (id uuid primary key default gen_random_uuid(), org_id uuid, revoked_at timestamptz);
alter table public.organization_workspace_invites enable row level security;
create policy existing_invite_owner on public.organization_workspace_invites for all to authenticated
 using (org_id = auth.uid()) with check (org_id = auth.uid());
grant all on public.organization_workspace_invites to authenticated;
grant select, update on public.organizations to authenticated;
update public.organizations set profile = '{"roadmap":{"sections":[{"id":"budget","content":"Existing plan"}]}}';
insert into storage.objects (bucket_id,name) values ('org-documents','00000000-0000-0000-0000-000000000001/existing.pdf');
insert into public.organization_workspace_invites (org_id) values ('00000000-0000-0000-0000-000000000001');
