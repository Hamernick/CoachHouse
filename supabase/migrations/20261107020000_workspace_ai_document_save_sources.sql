-- Check retained source identity before a canonical AI save or receipt replay.
-- Source audiences and unknown historical copies remain separate launch gates.
begin;
create or replace function public.commit_workspace_ai_document(p_id uuid,p_org_id uuid,p_actor_id uuid,
 p_expected_updated_at timestamptz,p_expected_section_revision text,p_profile jsonb,p_section jsonb,
 p_content_hash text,p_reviewed_revision text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare retained jsonb; run public.workspace_ai_runs;
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
 -- Lock the mutable run before comparing it with its immutable source identity.
 -- A selection-only draft is applied in its editor, never as a whole core document.
 select * into run from public.workspace_ai_runs
  where id=p_id and org_id=p_org_id and actor_id=p_actor_id for update;
 if not found or run.task is distinct from 'document' or run.target ? 'selection'
  or run.target->>'sectionId' like 'selection:%' then
  raise exception 'Document sources could not be verified.' using errcode='42501';end if;
 retained:=public.read_workspace_ai_document_sources(p_org_id,p_actor_id,p_id);
 if retained->'sources'->0->>'sectionId' is distinct from p_section->>'id'
  or run.target->>'sectionId' is distinct from p_section->>'id'
  or exists(select 1 from jsonb_array_elements(retained->'sources') s where s->>'kind' is distinct from 'editor') then
  raise exception 'Document sources could not be verified.' using errcode='42501';end if;
 return public.commit_workspace_ai_document_before_authority(p_id,p_org_id,p_actor_id,
  p_expected_updated_at,p_expected_section_revision,p_profile,p_section,p_content_hash,p_reviewed_revision);
exception when lock_not_available then
 raise exception 'Document permission or content is changing; retry.' using errcode='40001';
end;
$$;
comment on function public.commit_workspace_ai_document(uuid,uuid,uuid,timestamptz,text,jsonb,jsonb,text,text) is
 'Verified actor, locked editor/closure admission and retained editor source identity before canonical profile CAS and immutable receipt. Incomplete provenance does not enable private folders.';
commit;
