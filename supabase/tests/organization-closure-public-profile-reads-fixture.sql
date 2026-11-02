\set ON_ERROR_STOP on
\ir organization-closure-calendar-reads-fixture.sql
-- Original scoped organization stub predates the production publication column.
alter table public.organizations add column if not exists is_public boolean not null default false;
alter table public.programs add column if not exists is_public boolean not null default false;
-- Match actual program personal-identity ownership; other program columns/RLS
-- remain synthetic here. Integrated project fixture covers the canonical guard.
alter table public.programs drop constraint programs_user_id_fkey;
alter table public.programs add constraint programs_user_id_fkey foreign key(user_id) references auth.users(id) on delete cascade;
-- Exact original public-program read policy (20251019191500); complete hosted
-- membership/support policies remain a separate qualification boundary.
alter table public.programs enable row level security;
create policy programs_public_read on public.programs for select to anon,authenticated using(is_public);
grant select on public.programs to anon,authenticated;
-- Synthetic owner/member/public SELECT policy only; hosted support chain omitted.
alter table public.organizations enable row level security;
alter table public.organizations force row level security;
create policy fixture_org_read on public.organizations for select to authenticated
 using(user_id=auth.uid() or is_public or exists(select 1 from public.organization_memberships m where m.org_id=user_id and m.member_id=auth.uid()));
create policy fixture_org_public_read on public.organizations for select to anon using(is_public);
\ir ../migrations/20261102233000_organization_closure_public_profile_reads.sql
