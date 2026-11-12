-- Synthetic actors in an owned disposable full-schema database only.
do $$begin if current_database() not like 'ch_core_document_%' then raise exception 'Owned core fixture required';end if;end$$;
set request.jwt.claim.role='service_role';
set request.headers='{"x-coach-house-actor-id":"e972bc07-fbf5-4fc8-a416-7f00910a71e2"}';
insert into organization_memberships(org_id,member_id,role,member_email)
 select 'e972bc07-fbf5-4fc8-a416-7f00910a71e2',id,'staff',email from auth.users where id='90b6c688-889c-467f-9edd-166f28bf0819'
 on conflict(org_id,member_id) do update set role='staff';
insert into organization_coach_scope_settings(id) values(true) on conflict(id) do nothing;
create function public.fixture_core_commit(p_support boolean default false,p_stale text default null) returns boolean
language plpgsql security definer set search_path='public' as $$
declare o public.organizations; s public.organization_core_document_sessions; state jsonb;
begin
 select * into o from public.organizations where user_id='e972bc07-fbf5-4fc8-a416-7f00910a71e2';
 select * into s from public.organization_core_document_sessions where org_id=o.user_id and section_id='authority_fixture';
 state:=jsonb_build_object('generation',coalesce(s.generation,'89000000-0000-4000-8000-000000000001'::uuid),
  'version',coalesce(s.version,-1)+1,'document','{"type":"doc","content":[]}'::jsonb,'steps','[]'::jsonb,
  'section_revision','fixture-revision','section_content','Fixture text');
 return public.commit_core_document_session(o.user_id,'authority_fixture',
  o.updated_at-case when p_stale='profile' then interval '1 second' else interval '0' end,
  case when p_stale='generation' then '89000000-0000-4000-8000-000000000099'::uuid else s.generation end,
  case when p_stale='version' then -1 else s.version end,
  state,jsonb_set(coalesce(o.profile,'{}'),'{core_authority_fixture}',to_jsonb(coalesce(s.version,-1)+1)),p_support);
end $$;
grant execute on function public.fixture_core_commit(boolean,text) to service_role;
