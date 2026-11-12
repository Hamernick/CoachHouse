-- Retained document provenance applies to every profile writer, including legacy
-- full-profile saves. This is not a complete private-folder or editor ACL.
begin;
do $$ declare definition text; authority text; marker text; begin
 definition:=pg_get_functiondef('public.guard_document_commit_copy_sources(uuid,jsonb,jsonb,text)'::regprocedure);
 authority:=' if auth.role() is distinct from ''service_role'' or actor is null then'||chr(10)||
  '  raise exception ''Verified document actor required.'' using errcode=''42501'';end if;';
 marker:=' if ids is null then return;end if;';
 if strpos(definition,authority)=0 or strpos(definition,marker)=0 then
  raise exception 'Unexpected document source guard definition';end if;
 -- Unrelated changes need no source actor; system jobs may still update metadata.
 definition:=replace(definition,authority,'');
 execute replace(definition,marker,marker||chr(10)||authority||chr(10)||$body$
 if current_setting('transaction_isolation')<>'read committed' then
  raise exception 'Document permission changed; retry.' using errcode='40001';end if;
 -- Legacy writes already hold the changed organization tuple. Fence the source
 -- reader's identity/grants until commit, as the canonical RPCs do for editors.
 perform 1 from auth.users where id in(actor,p_org) order by id for update nowait;
 if not exists(select 1 from auth.users where id=actor and (banned_until is null or banned_until<now())) then
  raise exception 'Document source access denied.' using errcode='42501';end if;
 perform 1 from public.profiles where id=actor for update nowait;
 perform 1 from public.organization_memberships where org_id=p_org and member_id=actor for share nowait;
 perform 1 from public.platform_staff_members where user_id=actor for share nowait;
 perform public.guard_organization_closure(p_org);
$body$);
end $$;
create function public.guard_organization_profile_document_sources()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' then
  if old.user_id is distinct from new.user_id then
   perform public.guard_document_commit_copy_sources(old.user_id,old.profile,'{}');
   perform public.guard_document_commit_copy_sources(new.user_id,'{}',new.profile);
  elsif old.profile is distinct from new.profile then
   perform public.guard_document_commit_copy_sources(new.user_id,old.profile,new.profile);
  end if;
 else
  perform public.guard_document_commit_copy_sources(new.user_id,'{}',new.profile);
 end if;
 return null;
exception when lock_not_available then
 raise exception 'Document permission or content is changing; retry.' using errcode='40001';
end $$;
revoke all on function public.guard_organization_profile_document_sources() from public,anon,authenticated,service_role;
-- AFTER observes the final stored row, including other BEFORE triggers and the
-- actual UPSERT outcome. Failure rolls back the profile and activity atomically.
create trigger organization_profile_document_sources after insert or update on public.organizations
 for each row execute function public.guard_organization_profile_document_sources();
comment on function public.guard_organization_profile_document_sources() is
 'Retained AI document source fence for all profile writers. Unchanged sections are preserved. Changed retained copies require a verified server actor; authenticated legacy clients must use canonical document commits. No new editor grant, historical inference or private-folder activation.';
commit;
