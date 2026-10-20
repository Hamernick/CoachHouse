-- Rollback: drop function public.register_fiscal_guest_project_asset(uuid,uuid,uuid,text,text,text,text,bigint,text);
-- Keep saved assets and audit events; rolling back never deletes uploaded evidence.
-- Register reviewer uploads without opening generic guest-project mutation policies.
begin;

create function public.register_fiscal_guest_project_asset(
  p_actor_id uuid, p_project_id uuid, p_asset_id uuid, p_filename text,
  p_title text, p_description text, p_mime text, p_size_bytes bigint,
  p_storage_path text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_project public.organization_projects%rowtype;
  v_application public.fiscal_sponsorship_applications%rowtype;
  v_asset public.organization_project_assets%rowtype;
  v_prefix text;
begin
  if current_setting('role', true) is distinct from 'service_role' then
    raise exception 'Service role required' using errcode='42501';
  end if;
  select * into v_project from public.organization_projects where id=p_project_id for update;
  if not found or public.fiscal_guest_project_reviewer_access(p_project_id,p_actor_id) is distinct from true then
    return jsonb_build_object('ok',false,'code','forbidden');
  end if;
  select a.* into v_application from public.fiscal_sponsorship_applications a
    join public.fiscal_guest_submissions s on s.application_id=a.id and s.project_id=a.project_id
    where a.project_id=p_project_id and a.org_id=v_project.org_id for update of a;
  if not found then return jsonb_build_object('ok',false,'code','not_found'); end if;
  v_prefix := v_project.org_id::text || '/' || p_project_id::text || '/fiscal-uploads/' || p_actor_id::text || '/' || p_asset_id::text || '-';
  if p_asset_id is null or nullif(btrim(p_filename),'') is null or nullif(btrim(p_title),'') is null
    or p_size_bytes is null or p_size_bytes < 1 or p_size_bytes > 52428800
    or p_storage_path is null or left(p_storage_path,length(v_prefix)) <> v_prefix
    or p_storage_path like '%..%' then
    return jsonb_build_object('ok',false,'code','invalid_asset');
  end if;
  select * into v_asset from public.organization_project_assets where id=p_asset_id;
  if found then
    if v_asset.project_id=p_project_id and v_asset.org_id=v_project.org_id and v_asset.created_by=p_actor_id
      and left(v_asset.storage_path,length(v_prefix)+65)=left(p_storage_path,length(v_prefix)+65) and v_asset.size_bytes=p_size_bytes
      and v_asset.name=p_title and v_asset.mime is not distinct from p_mime
      and v_asset.description is not distinct from p_description then
      return jsonb_build_object('ok',true,'assetId',v_asset.id,'created',false);
    end if;
    return jsonb_build_object('ok',false,'code','conflict');
  end if;
  if not exists(select 1 from storage.objects where bucket_id='project-assets' and name=p_storage_path) then
    return jsonb_build_object('ok',false,'code','missing_file');
  end if;
  insert into public.organization_project_assets(id,org_id,project_id,name,description,asset_type,
    storage_path,mime,size_bytes,created_by,updated_by)
  values(p_asset_id,v_project.org_id,p_project_id,p_title,p_description,case
    when lower(p_filename) ~ '\.pdf$' then 'pdf' when lower(p_filename) ~ '\.zip$' then 'zip'
    when lower(p_filename) ~ '\.fig(ma)?$' then 'fig' when lower(p_filename) ~ '\.docx?$' then 'doc' else 'file' end,p_storage_path,p_mime,p_size_bytes,p_actor_id,p_actor_id);
  insert into public.fiscal_sponsorship_events(org_id,project_id,application_id,event_type,actor_id,summary,metadata)
  values(v_project.org_id,p_project_id,v_application.id,'document_uploaded',p_actor_id,'Reviewer uploaded a project file.',
    jsonb_build_object('asset_id',p_asset_id,'filename',p_filename));
  return jsonb_build_object('ok',true,'assetId',p_asset_id,'created',true);
end;
$$;
revoke all on function public.register_fiscal_guest_project_asset(uuid,uuid,uuid,text,text,text,text,bigint,text) from public,anon,authenticated;
grant execute on function public.register_fiscal_guest_project_asset(uuid,uuid,uuid,text,text,text,text,bigint,text) to service_role;

commit;
