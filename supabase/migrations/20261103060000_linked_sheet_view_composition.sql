-- Reuse a selected, already-linked source through the canonical manual writer.
-- Only the server can cross this boundary after checking the viewer's provider access.
begin;
create index organization_data_view_creation_identity on public.organization_data_view_receipts
 (org_id,((command->>'viewId')),created_at) where command->>'action'='create_view';
create function public.workspace_sheet_view_composition(
 p_actor_id uuid,p_org uuid,p_source_view uuid,p_expected jsonb default null,
 p_command jsonb default null,p_commit boolean default false
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v public.organization_data_views%rowtype; connection public.google_drive_connections%rowtype;
 meta jsonb; source jsonb; access jsonb; identity text; receipt public.organization_data_view_receipts%rowtype;
 created public.organization_data_views%rowtype; request uuid; target uuid;
begin
 if p_actor_id is null or p_org is null or p_source_view is null then raise exception 'Source unavailable' using errcode='42501'; end if;
 -- This owner takes organization/profile/membership locks and current closure authority first.
 access:=public.workspace_sheet_view_command(p_actor_id,jsonb_build_object('action','read','organizationId',p_org,'viewId',p_source_view,'page',0));
 if access is null or not public.data_view_workspace_access(p_org,true) then raise exception 'Source unavailable' using errcode='42501'; end if;
 select * into v from public.organization_data_views where id=p_source_view and org_id=p_org and organization_data_views.source='sheets' for share nowait;
 if not found or v.sheet_source is distinct from access->'source' then raise exception 'Source unavailable' using errcode='42501'; end if;
 select * into connection from public.google_drive_connections where user_id=p_actor_id for share nowait;
 if not found or connection.status<>'connected' then raise exception 'Google execution identity unavailable' using errcode='42501'; end if;
 identity:=encode(sha256(convert_to('google-sheet-viewer:'||connection.id::text||':'||connection.google_subject||':'||floor(extract(epoch from connection.connected_at)*1000)::bigint::text,'UTF8')),'hex');
 source:=jsonb_build_object('kind','sheets','range',v.sheet_source);
 meta:=jsonb_build_object('viewId',v.id,'updatedAt',v.updated_at,'name',left(v.name,100),'source',source,'sourceTitle',left(v.name,240),
   'canCreate',access->'canEdit','sheet',jsonb_build_object('headerHash',v.sheet_header_hash,'executionIdentity',identity));
 if p_expected is not null and (p_expected-'canCreate') is distinct from (meta-'canCreate') then raise exception 'Linked source binding changed' using errcode='40001'; end if;
 if p_command is null then
  if p_commit then raise exception 'Creation request required' using errcode='22023'; end if;
  return meta;
 end if;
 if p_expected is null or jsonb_typeof(p_command) is distinct from 'object' or octet_length(p_command::text)>10000
  or (p_command-array['action','organizationId','viewId','requestId','name','source'])<>'{}'::jsonb
  or not(p_command ?& array['action','organizationId','viewId','requestId','name','source'])
  or p_command->>'action' is distinct from 'create_view' or p_command->'source' is distinct from source
  or p_command->>'organizationId' is distinct from p_org::text
  or jsonb_typeof(p_command->'viewId') is distinct from 'string' or jsonb_typeof(p_command->'requestId') is distinct from 'string'
  or jsonb_typeof(p_command->'name') is distinct from 'string' or length(btrim(p_command->>'name')) not between 1 and 100
 then raise exception 'Invalid linked view creation request' using errcode='22023'; end if;
 request:=(p_command->>'requestId')::uuid;target:=(p_command->>'viewId')::uuid;
 select * into receipt from public.organization_data_view_receipts where org_id=p_org and request_id=request;
 if found then
  if receipt.actor_id<>p_actor_id then raise exception 'Creation receipt unavailable' using errcode='42501'; end if;
  if receipt.command<>p_command then raise exception 'Creation request changed' using errcode='40001'; end if;
 end if;
 if receipt.request_id is not null then
  select * into created from public.organization_data_views where id=target and org_id=p_org and organization_data_views.source='sheets'
   and sheet_source=v.sheet_source and sheet_header_hash=v.sheet_header_hash
   -- Every canonical creation records an immutable receipt. A later competing
   -- creation is another incarnation, even if its UUID/range are identical.
   -- Equal timestamps are ambiguous and therefore fail closed.
   and not exists(select 1 from public.organization_data_view_receipts other
    where other.org_id=p_org and other.request_id<>request and other.command->>'action'='create_view'
     and other.command->>'viewId'=target::text and other.created_at>=receipt.created_at);
 end if;
 if p_commit then
  if not (meta->>'canCreate')::boolean then raise exception 'View editing unavailable' using errcode='42501'; end if;
  if receipt.request_id is not null then
   if created.id is null then raise exception 'Created view no longer available' using errcode='42501'; end if;
   return receipt.result;
  end if;
  -- Under the same source/connection locks, reuse the sole existing writer.
  return public.workspace_sheet_view_command(p_actor_id,p_command,true,v.sheet_header_hash);
 end if;
 if receipt.request_id is null then return jsonb_build_object('receipt',null,'view',null); end if;
 return jsonb_build_object('receipt',receipt.result,'view',case when created.id is null then null else jsonb_build_object('id',created.id,'name',created.name,'revision',created.revision) end);
end $$;
revoke all on function public.workspace_sheet_view_composition(uuid,uuid,uuid,jsonb,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.workspace_sheet_view_composition(uuid,uuid,uuid,jsonb,jsonb,boolean) to service_role;
commit;
