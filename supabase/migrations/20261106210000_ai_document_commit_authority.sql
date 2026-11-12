-- Keep the existing document compiler, CAS and immutable receipt owner. Bind
-- its elevated commit to the authenticated actor and serialize revocation.
begin;
alter function public.commit_workspace_ai_document(uuid,uuid,uuid,timestamptz,text,jsonb,jsonb,text,text)
 rename to commit_workspace_ai_document_before_authority;
revoke all on function public.commit_workspace_ai_document_before_authority(uuid,uuid,uuid,timestamptz,text,jsonb,jsonb,text,text)
 from public,anon,authenticated,service_role;

create function public.commit_workspace_ai_document(p_id uuid,p_org_id uuid,p_actor_id uuid,
 p_expected_updated_at timestamptz,p_expected_section_revision text,p_profile jsonb,p_section jsonb,
 p_content_hash text,p_reviewed_revision text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.role() is distinct from 'service_role' or p_actor_id is null
  or p_actor_id is distinct from public.organization_activity_actor_id() then
  raise exception 'Verified document actor required.' using errcode='42501';end if;
 if current_setting('transaction_isolation')<>'read committed' then
  raise exception 'Document permission changed; retry.' using errcode='40001';end if;
 -- Organization first: the inner writer will UPDATE this row. Taking UPDATE
 -- now avoids lock upgrades and serializes closure/deletion before the run.
 perform 1 from public.organizations where user_id=p_org_id for update nowait;
 if not found then raise exception 'Document editor access required.' using errcode='42501';end if;
 perform 1 from public.organization_memberships where org_id=p_org_id and member_id=p_actor_id for share nowait;
 perform public.guard_organization_closure(p_org_id);
 -- AI document editing has always required owner/admin/staff, not merely a
 -- readable profile or platform-support role. Recheck after acquiring locks.
 if not public.can_use_workspace_ai(p_org_id,p_actor_id) then
  raise exception 'Document editor access required.' using errcode='42501';end if;
 return public.commit_workspace_ai_document_before_authority(p_id,p_org_id,p_actor_id,
  p_expected_updated_at,p_expected_section_revision,p_profile,p_section,p_content_hash,p_reviewed_revision);
exception when lock_not_available then
 raise exception 'Document permission or content is changing; retry.' using errcode='40001';
end;
$$;
revoke all on function public.commit_workspace_ai_document(uuid,uuid,uuid,timestamptz,text,jsonb,jsonb,text,text)
 from public,anon,authenticated,service_role;
grant execute on function public.commit_workspace_ai_document(uuid,uuid,uuid,timestamptz,text,jsonb,jsonb,text,text) to service_role;
comment on function public.commit_workspace_ai_document(uuid,uuid,uuid,timestamptz,text,jsonb,jsonb,text,text) is
 'Verified service actor and locked current editor/closure admission before canonical profile CAS and immutable AI receipt. Does not qualify profile source lineage, private folders or publication.';
commit;
