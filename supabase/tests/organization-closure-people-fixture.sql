\set ON_ERROR_STOP on
\ir organization-closure-fixture.sql
-- Minimal omitted identity dependencies; the actual taxonomy tables, constraints,
-- update triggers and RLS below come from their original production migrations.
create table public.profiles(id uuid primary key references auth.users(id) on delete cascade,role text);
insert into public.profiles select id,'member' from auth.users;
create function public.is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles where id=auth.uid() and role='admin');
$$;
create function public.handle_updated_at() returns trigger language plpgsql as $$
begin new.updated_at:=now(); return new; end; $$;
\ir ../migrations/20260801130500_add_organization_people_segments.sql
\ir ../migrations/20260801143000_add_organization_people_tags.sql
set check_function_bodies=on;
\ir ../migrations/20261102070000_organization_closure_people_writes.sql
-- Supabase's default table privileges are explicit in the isolated fixture.
grant select,insert,update,delete on public.organization_people_tags,public.organization_people_segments,
 public.organization_people_tag_members,public.organization_people_segment_members to authenticated,service_role;
grant select on public.organization_memberships,public.profiles to authenticated;
create function public.fixture_closure_people() returns void language plpgsql as $$
begin
 perform public.fixture_closure_publication();
 truncate public.organization_people_tags,public.organization_people_segments cascade;
 insert into auth.users values(public.fixture_form_id(12),'person12@example.org',now()) on conflict do nothing;
 insert into public.profiles select id,'member' from auth.users on conflict do nothing;
 insert into public.organization_people_tags(id,org_id,label,created_by)
   values(public.fixture_form_id(810),public.fixture_form_id(1),'Partners',public.fixture_form_id(12)),
         (public.fixture_form_id(811),public.fixture_form_id(2),'Other',public.fixture_form_id(12));
 insert into public.organization_people_segments(id,org_id,label,created_by)
   values(public.fixture_form_id(820),public.fixture_form_id(1),'Volunteers',public.fixture_form_id(12)),
         (public.fixture_form_id(821),public.fixture_form_id(2),'Other',public.fixture_form_id(12));
 insert into public.organization_people_tag_members(tag_id,person_id,added_by)
   values(public.fixture_form_id(810),'person-a',public.fixture_form_id(12));
 insert into public.organization_people_segment_members(segment_id,person_id,added_by)
   values(public.fixture_form_id(820),'person-a',public.fixture_form_id(12));
end; $$;
