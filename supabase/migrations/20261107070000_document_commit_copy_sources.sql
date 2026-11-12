-- Extend the existing locked document commits; do not replace profile/session CAS.
-- This checks retained AI lineage, not complete historical or private-folder access.
begin;
create function public.guard_document_commit_copy_sources(
 p_org uuid,p_before jsonb,p_after jsonb,p_section text default null
) returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=public.organization_activity_actor_id(); ids text[]; batch text[]; result jsonb; offset_index integer;
begin
 if auth.role() is distinct from 'service_role' or actor is null then
  raise exception 'Verified document actor required.' using errcode='42501';end if;
 -- The callers already hold the organization UPDATE lock and current actor locks.
 -- Compare canonical sections, including deletion/recreation and legacy keyed data.
 -- Do not reject an unrelated edit simply because another section is unavailable.
 select array_agg(distinct section_id order by section_id) into ids from (
  select substring(coalesce(b.document_key,a.document_key) from 9) section_id
  from public.core_document_history_entries(coalesce(p_before,'{}')) b
  full join public.core_document_history_entries(coalesce(p_after,p_before,'{}')) a using(document_key)
  where b.document_value is distinct from a.document_value
  union select p_section where p_section is not null
 ) changed where exists (
  select 1 from public.workspace_ai_document_applications receipt
   join public.workspace_ai_runs run on run.id=receipt.run_id
   left join public.workspace_ai_document_origins origin on origin.run_id=run.id
   where receipt.section_id=changed.section_id and (run.org_id=p_org or origin.org_id=p_org)
 );
 if ids is null then return;end if;
 -- Receipts and origins are immutable. Lock mutable runs against identity changes
 -- until this commit completes. New application receipts use this same org lock.
 perform 1 from public.workspace_ai_runs run
  join public.workspace_ai_document_applications receipt on receipt.run_id=run.id
  left join public.workspace_ai_document_origins origin on origin.run_id=run.id
  where receipt.section_id=any(ids) and (run.org_id=p_org or origin.org_id=p_org)
  order by run.id for share of run nowait;
 for offset_index in 1..cardinality(ids) by 500 loop
  batch:=ids[offset_index:offset_index+499];
  result:=public.read_workspace_ai_document_copy_sources(p_org,actor,batch);
  if jsonb_typeof(result->'blockedSectionIds') is distinct from 'array'
   or jsonb_array_length(result->'blockedSectionIds')<>0 then
   raise exception 'Document source access changed. Reopen the document before saving.' using errcode='42501';end if;
 end loop;
end $$;
revoke all on function public.guard_document_commit_copy_sources(uuid,jsonb,jsonb,text)
 from public,anon,authenticated,service_role;
-- Preserve the current verified editor, storage, closure and optimistic concurrency
-- implementation verbatim. Fail migration if the expected insertion point changed.
do $$ declare definition text; marker text; begin
 definition:=pg_get_functiondef('public.commit_roadmap_profile(uuid,timestamptz,jsonb,boolean,boolean)'::regprocedure);
 marker:=' if existing.user_id is null then'||chr(10)||'  insert into public.organizations';
 if strpos(definition,marker)=0 then raise exception 'Unexpected roadmap commit definition';end if;
 execute replace(definition,marker,
  ' perform public.guard_document_commit_copy_sources(p_org,existing.profile,p_profile);'||chr(10)||marker);
 definition:=pg_get_functiondef('public.commit_core_document_session(uuid,text,timestamptz,uuid,integer,jsonb,jsonb,boolean)'::regprocedure);
 marker:=' return public.commit_core_document_session_before_authority(';
 if strpos(definition,marker)=0 then raise exception 'Unexpected collaboration commit definition';end if;
 execute replace(definition,marker,
  ' perform public.guard_document_commit_copy_sources(p_org,(select profile from public.organizations where user_id=p_org),p_profile,p_section);'||chr(10)||marker);
end $$;
commit;
