-- Native-file activity is derived source content, including retained events after
-- purge. Keep the audit record; filter disclosure using current source authority.
begin;
create function public.document_file_disclosure_actor_can(p_file uuid,p_actor uuid) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare binding public.document_file_folder_authorities%rowtype; receipt public.document_file_purges%rowtype;
begin
 if p_actor is null then return false; end if;
 select * into binding from public.document_file_folder_authorities where file_id=p_file;
 if found then return public.project_folder_actor_can(binding.project_id,binding.folder_id,p_actor,'view'); end if;
 select * into receipt from public.document_file_purges where file_id=p_file and folder_id is not null;
 if not found then return true; end if;
 -- Scope survives source deletion. Owner retains history even if the folder is
 -- subsequently retired; everyone else needs a current grant and membership.
 return p_actor=receipt.org_id or (
   exists(select 1 from public.organization_projects where id=receipt.folder_project_id and org_id=receipt.org_id)
   and public.project_folder_actor_can(receipt.folder_project_id,receipt.folder_id,p_actor,'view'));
end $$;
revoke all on function public.document_file_disclosure_actor_can(uuid,uuid) from public,anon,authenticated,service_role;

create function public.can_read_native_file_activity(p_entity_type text,p_source text,p_file uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select p_entity_type is distinct from 'file' or p_source is distinct from 'organization_document_files'
   or public.document_file_disclosure_actor_can(p_file,auth.uid());
$$;
revoke all on function public.can_read_native_file_activity(text,text,uuid) from public,anon,service_role;
grant execute on function public.can_read_native_file_activity(text,text,uuid) to authenticated;
create policy document_folder_activity_read on public.organization_project_activity_events
as restrictive for select to authenticated
using(public.can_read_native_file_activity(entity_type,metadata->>'source',entity_id));

-- Elevated project/staff readers retain their existing parent-scope checks,
-- then filter the exact selected event IDs. No activity payload is returned.
create function public.filter_document_activity_audience(p_event_ids uuid[],p_actor_id uuid) returns uuid[]
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.role() is distinct from 'service_role' or p_actor_id is null
   or p_actor_id is distinct from public.organization_activity_actor_id() then
   raise exception 'Verified activity reader required.' using errcode='42501'; end if;
 if p_event_ids is null or cardinality(p_event_ids)>500 then
   raise exception 'Invalid activity audience request.' using errcode='22023'; end if;
 return coalesce((select array_agg(e.id order by e.id) from public.organization_project_activity_events e
   where e.id=any(p_event_ids) and (e.entity_type<>'file'
     or e.metadata->>'source' is distinct from 'organization_document_files'
     or public.document_file_disclosure_actor_can(e.entity_id,p_actor_id))),'{}'::uuid[]);
end $$;
revoke all on function public.filter_document_activity_audience(uuid[],uuid) from public,anon,authenticated;
grant execute on function public.filter_document_activity_audience(uuid[],uuid) to service_role;
commit;
