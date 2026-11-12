-- Synthetic actors in a disposable database only.
do $$begin if current_database() not like 'ch_roadmap_profile_%' then raise exception 'Owned fixture required';end if;end$$;
set request.jwt.claim.role='service_role';
set request.headers='{"x-coach-house-actor-id":"e972bc07-fbf5-4fc8-a416-7f00910a71e2"}';
insert into organization_memberships(org_id,member_id,role,member_email)
 select 'e972bc07-fbf5-4fc8-a416-7f00910a71e2',id,'staff',email from auth.users where id='90b6c688-889c-467f-9edd-166f28bf0819'
 on conflict(org_id,member_id) do update set role='staff';
insert into organization_coach_scope_settings(id) values(true) on conflict(id) do nothing;
create function public.fixture_roadmap_commit(p_support boolean default false,p_stale boolean default false,p_storage boolean default true)
returns boolean language plpgsql security definer set search_path='public' as $$
declare o public.organizations;
begin
 select * into o from public.organizations where user_id='e972bc07-fbf5-4fc8-a416-7f00910a71e2';
 return public.commit_roadmap_profile(o.user_id,o.updated_at-case when p_stale then interval '1 second' else interval '0' end,
  jsonb_set(coalesce(o.profile,'{}'),'{roadmap_authority_fixture}',to_jsonb(coalesce((o.profile->>'roadmap_authority_fixture')::integer,0)+1)),p_support,p_storage);
end $$;
grant execute on function public.fixture_roadmap_commit(boolean,boolean,boolean) to service_role;

create function public.fixture_roadmap_publication(p_support boolean default false,p_stale boolean default false)
returns boolean language plpgsql security definer set search_path='public' as $$
declare o public.organizations;
begin
 select * into o from public.organizations where user_id='e972bc07-fbf5-4fc8-a416-7f00910a71e2';
 return public.commit_roadmap_publication(o.user_id,o.updated_at-case when p_stale then interval '1 second' else interval '0' end,
  not coalesce(o.is_public_roadmap,false),p_support);
end $$;
grant execute on function public.fixture_roadmap_publication(boolean,boolean) to service_role;
