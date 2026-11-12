-- Resolve retained input identities only. Current document access is checked by
-- the authenticated application reader; this does not certify full lineage.
begin;
create function public.read_workspace_ai_document_sources(p_org_id uuid,p_actor_id uuid,p_run_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare current_id uuid:=p_run_id; seen uuid[]:='{}'; result jsonb:='[]';
 origin public.workspace_ai_document_origins; section_id text;
begin
 if auth.role() is distinct from 'service_role' or p_actor_id is null
  or p_actor_id is distinct from public.organization_activity_actor_id()
  or not public.can_read_workspace_ai(p_org_id,p_actor_id) then
  raise exception 'Document source access denied.' using errcode='42501';end if;
 loop
  if current_id is null or current_id=any(seen) or cardinality(seen)>=64 then
   raise exception 'Document sources could not be verified.' using errcode='42501';end if;
  select * into origin from public.workspace_ai_document_origins
   where run_id=current_id and org_id=p_org_id and actor_id=p_actor_id;
  if not found or origin.source is null
   or coalesce(origin.source->>'revisionSourceState','') not in ('none','observed')
   or coalesce(origin.source->>'kind','') not in ('editor','selection')
   or coalesce(origin.source->>'sectionId','')='' then
   raise exception 'Document sources could not be verified.' using errcode='42501';end if;
  section_id:=coalesce(section_id,origin.source->>'sectionId');
  if origin.source->>'sectionId' is distinct from section_id then
   raise exception 'Document sources could not be verified.' using errcode='42501';end if;
  seen:=array_append(seen,current_id);
  result:=result||jsonb_build_array(jsonb_build_object('runId',current_id,
   'sectionId',section_id,'kind',origin.source->>'kind'));
  exit when origin.source->>'revisionSourceState'='none';
  current_id:=(origin.source->>'revisionSourceRunId')::uuid;
 end loop;
 return jsonb_build_object('sources',result,'complete',false);
end $$;
revoke all on function public.read_workspace_ai_document_sources(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.read_workspace_ai_document_sources(uuid,uuid,uuid) to service_role;
commit;
