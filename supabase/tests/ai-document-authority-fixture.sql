-- Synthetic data only, in a disposable clone of the full-schema fixture.
do $$begin if current_database() not like 'ch_ai_document_%' then raise exception 'Owned document fixture required';end if;end$$;
set request.jwt.claim.role='service_role';
set request.headers='{"x-coach-house-actor-id":"e972bc07-fbf5-4fc8-a416-7f00910a71e2"}';
insert into organization_memberships(org_id,member_id,role,member_email)
 select 'e972bc07-fbf5-4fc8-a416-7f00910a71e2','90b6c688-889c-467f-9edd-166f28bf0819','staff',email
 from auth.users where id='90b6c688-889c-467f-9edd-166f28bf0819'
 on conflict(org_id,member_id) do update set role='staff';
insert into ai_credit_wallets(org_id,enabled) values('e972bc07-fbf5-4fc8-a416-7f00910a71e2',true) on conflict do nothing;
insert into workspace_ai_runs(id,org_id,actor_id,request_hash,task,target,prompt,tariff,max_credits,max_provider_microdollars,status,settled_at,charged_credits,provider_microdollars,proposal)
 select ('89000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 'e972bc07-fbf5-4fc8-a416-7f00910a71e2',case when n=2 then 'e972bc07-fbf5-4fc8-a416-7f00910a71e2'::uuid else '90b6c688-889c-467f-9edd-166f28bf0819'::uuid end,
 lpad(n::text,64,'0'),'document','{"sectionId":"vision","revision":null}', 'Synthetic draft','{}',1,1000,'succeeded',now(),0,0,'Synthetic draft'
 from generate_series(1,3) n;
-- Helpers are fixture-only. The real service wrapper still validates actor/header.
create function public.fixture_document_commit(p_run integer default 1,p_stale boolean default false) returns jsonb
language plpgsql security definer set search_path='public' as $$
declare o public.organizations; actor uuid:=public.organization_activity_actor_id();
begin
 select * into o from public.organizations where user_id='e972bc07-fbf5-4fc8-a416-7f00910a71e2';
 return public.commit_workspace_ai_document(('89000000-0000-4000-8000-'||lpad(p_run::text,12,'0'))::uuid,o.user_id,actor,
 o.updated_at-case when p_stale then interval '1 second' else interval '0' end,null,
 jsonb_set(coalesce(o.profile,'{}'),'{authority_fixture}','"Reviewed draft"'),
 '{"id":"vision","lastUpdated":"2026-11-06T12:00:00Z","isPublic":false,"status":"in_progress"}',repeat('a',64));
end $$;
grant execute on function public.fixture_document_commit(integer,boolean) to service_role;
