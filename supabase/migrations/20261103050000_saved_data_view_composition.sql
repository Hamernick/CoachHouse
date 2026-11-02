-- Metadata-only reuse and exact read-only receipts for existing table/response views.
begin;
create function public.require_composable_data_view_source(p_org uuid,p_source jsonb) returns text
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); version public.organization_form_versions%rowtype; title text; role_name text;
begin
 if actor is null then raise exception 'Source unavailable' using errcode='42501'; end if;
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'Read committed required' using errcode='40001'; end if;
 perform 1 from public.organizations where user_id=p_org for share nowait;
 if not found then raise exception 'Source unavailable' using errcode='42501'; end if;
 perform public.guard_organization_closure(p_org,true);
 perform 1 from public.profiles where id=actor for share nowait;
 if not found then raise exception 'Source unavailable' using errcode='42501'; end if;
 select role into role_name from public.organization_memberships where org_id=p_org and member_id=actor for share nowait;
 if p_source->>'kind'='table' and (p_source-array['kind','tableId'])='{}'::jsonb and jsonb_typeof(p_source->'tableId')='string' then
   if not public.data_view_workspace_access(p_org,true) then raise exception 'Source unavailable' using errcode='42501'; end if;
   select name into title from public.organization_data_tables where id=(p_source->>'tableId')::uuid and org_id=p_org for share nowait;
   if not found then raise exception 'Source unavailable' using errcode='42501'; end if;
 elsif p_source->>'kind'='responses' and (p_source-array['kind','versionId'])='{}'::jsonb and jsonb_typeof(p_source->'versionId')='string' then
   select * into version from public.organization_form_versions where id=(p_source->>'versionId')::uuid and org_id=p_org;
   if not found then raise exception 'Source unavailable' using errcode='42501'; end if;
   -- Existing authority and form locks, with definition-only action. No response rows.
   perform public.organization_form_intake(actor,jsonb_build_object('action','editor_version','versionId',version.id));
   if not (((actor=p_org or coalesce(role_name,'') in('owner','admin','staff')) and public.can_edit_organization_form(p_org,version.form_id,actor))
       or public.can_correct_invited_form_responses(p_org,version.form_id,actor)) then raise exception 'Source unavailable' using errcode='42501'; end if;
   title:=version.version->>'title';
 else raise exception 'Invalid source' using errcode='22023'; end if;
 return left(coalesce(title,''),240);
end $$;
revoke all on function public.require_composable_data_view_source(uuid,jsonb) from public,anon,authenticated,service_role;

create function public.read_composable_data_view_source(p_org uuid,p_view uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v public.organization_data_views%rowtype; source jsonb; title text; closing boolean;
begin
 select * into v from public.organization_data_views dv where dv.id=p_view and dv.org_id=p_org and dv.source in('table','responses');
 if not found then raise exception 'Source unavailable' using errcode='42501'; end if;
 source:=case v.source when 'table' then jsonb_build_object('kind','table','tableId',v.table_id) else jsonb_build_object('kind','responses','versionId',v.response_version_id) end;
 title:=public.require_composable_data_view_source(p_org,source);
 select * into v from public.organization_data_views where id=p_view and org_id=p_org for share nowait;
 if not found or (case v.source when 'table' then jsonb_build_object('kind','table','tableId',v.table_id) when 'responses' then jsonb_build_object('kind','responses','versionId',v.response_version_id) else '{}'::jsonb end) is distinct from source then raise exception 'Source unavailable' using errcode='42501'; end if;
 closing:=public.guard_organization_closure(p_org,true);
 return jsonb_build_object('viewId',v.id,'updatedAt',v.updated_at,'name',left(v.name,100),'source',source,'sourceTitle',title,'canCreate',not closing);
end $$;
revoke all on function public.read_composable_data_view_source(uuid,uuid) from public,anon,service_role;
grant execute on function public.read_composable_data_view_source(uuid,uuid) to authenticated;

create function public.read_existing_data_view_creation(p_command jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); org uuid; request uuid; view_id uuid; source jsonb;
 receipt public.organization_data_view_receipts%rowtype; v public.organization_data_views%rowtype;
begin
 if p_command is null or jsonb_typeof(p_command) is distinct from 'object' or octet_length(p_command::text)>4096
  or (p_command-array['action','organizationId','viewId','requestId','name','source'])<>'{}'::jsonb
  or not(p_command ?& array['action','organizationId','viewId','requestId','name','source'])
  or p_command->>'action' is distinct from 'create_view' or jsonb_typeof(p_command->'source') is distinct from 'object'
  or jsonb_typeof(p_command->'organizationId') is distinct from 'string' or jsonb_typeof(p_command->'viewId') is distinct from 'string'
  or jsonb_typeof(p_command->'requestId') is distinct from 'string' or jsonb_typeof(p_command->'name') is distinct from 'string'
  or length(btrim(p_command->>'name')) not between 1 and 100 then raise exception 'Invalid creation receipt request' using errcode='22023'; end if;
 org:=(p_command->>'organizationId')::uuid;request:=(p_command->>'requestId')::uuid;view_id:=(p_command->>'viewId')::uuid;source:=p_command->'source';
 perform public.require_composable_data_view_source(org,source);
 select * into receipt from public.organization_data_view_receipts where org_id=org and request_id=request;
 if not found then return jsonb_build_object('receipt',null,'view',null); end if;
 if receipt.actor_id<>actor then raise exception 'Creation receipt unavailable' using errcode='42501'; end if;
 if receipt.command<>p_command then raise exception 'Creation request changed' using errcode='40001'; end if;
 select * into v from public.organization_data_views dv where dv.id=view_id and dv.org_id=org and dv.source=(p_command#>>'{source,kind}')
   and (case p_command#>>'{source,kind}' when 'table' then dv.table_id=(p_command#>>'{source,tableId}')::uuid else dv.response_version_id=(p_command#>>'{source,versionId}')::uuid end);
 return jsonb_build_object('receipt',receipt.result,'view',case when v.id is null then null else jsonb_build_object('id',v.id,'name',v.name,'revision',v.revision) end);
end $$;
revoke all on function public.read_existing_data_view_creation(jsonb) from public,anon,service_role;
grant execute on function public.read_existing_data_view_creation(jsonb) to authenticated;
commit;
