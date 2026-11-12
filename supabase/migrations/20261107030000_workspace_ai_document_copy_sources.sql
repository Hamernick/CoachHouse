-- Saved core documents are shared organization content, not author-private runs.
-- Validate retained editor lineage without disclosing run identities or bodies.
begin;
create function public.read_workspace_ai_document_copy_sources(p_org_id uuid,p_actor_id uuid,p_section_ids text[])
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare receipt record; origin public.workspace_ai_document_origins;
 current_id uuid; seen uuid[]; blocked text[]:='{}'; checked integer:=0;
begin
 if auth.role() is distinct from 'service_role' or p_actor_id is null
  or p_actor_id is distinct from public.organization_activity_actor_id()
  or not public.can_read_workspace_ai(p_org_id,p_actor_id) then
  raise exception 'Document source access denied.' using errcode='42501';end if;
 if p_section_ids is null or cardinality(p_section_ids)>500
  or exists(select 1 from unnest(p_section_ids) id where id is null or id !~ '^[A-Za-z0-9_:-]{1,120}$') then
  raise exception 'Invalid document source request.' using errcode='22023';end if;
 for receipt in
  select a.run_id,a.section_id,r.actor_id,r.org_id,root.actor_id origin_actor,root.org_id origin_org from public.workspace_ai_document_applications a
   join public.workspace_ai_runs r on r.id=a.run_id
   left join public.workspace_ai_document_origins root on root.run_id=a.run_id
   where (r.org_id=p_org_id or root.org_id=p_org_id) and a.section_id=any(p_section_ids)
   limit 2049
 loop
  checked:=checked+1;
  if checked>2048 then raise exception 'Document sources could not be verified.' using errcode='42501';end if;
  if receipt.section_id=any(blocked) then continue;end if;
  if receipt.org_id is distinct from p_org_id or receipt.origin_org is distinct from p_org_id
   or receipt.origin_actor is distinct from receipt.actor_id then
   blocked:=array_append(blocked,receipt.section_id);continue;end if;
  current_id:=receipt.run_id;seen:='{}';
  loop
   if current_id is null or current_id=any(seen) or cardinality(seen)>=64 then
    blocked:=array_append(blocked,receipt.section_id);exit;end if;
   select * into origin from public.workspace_ai_document_origins
    where run_id=current_id and org_id=p_org_id and actor_id=receipt.actor_id;
   if not found or origin.source is null
    or origin.source->>'sectionId' is distinct from receipt.section_id
    or origin.source->>'kind' is distinct from 'editor'
    or coalesce(origin.source->>'revisionSourceState','') not in ('none','observed') then
    blocked:=array_append(blocked,receipt.section_id);exit;end if;
   seen:=array_append(seen,current_id);
   exit when origin.source->>'revisionSourceState'='none';
   current_id:=(origin.source->>'revisionSourceRunId')::uuid;
  end loop;
 end loop;
 -- Every retained receipt matters, even after subsequent manual edits. Missing
 -- historical receipts are unknown, not proof of complete or private-safe lineage.
 return jsonb_build_object('blockedSectionIds',to_jsonb(blocked),'complete',false);
end $$;
revoke all on function public.read_workspace_ai_document_copy_sources(uuid,uuid,text[]) from public,anon,authenticated;
grant execute on function public.read_workspace_ai_document_copy_sources(uuid,uuid,text[]) to service_role;
commit;
