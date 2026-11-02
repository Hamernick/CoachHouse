-- Fixed-range linked reads. No provider rows/credentials are retained in this owner.
begin;
alter table public.organization_data_views drop constraint organization_data_views_source_check;
alter table public.organization_data_views add constraint organization_data_views_source_check check(source in('projects','table','responses','sheets'));
alter table public.organization_data_views add column sheet_source jsonb, add column sheet_header_hash text;
alter table public.organization_data_views add constraint organization_data_views_sheet_source check((source='sheets')=(sheet_source is not null) and (source<>'sheets' or (sheet_header_hash is not null and sheet_header_hash ~ '^[a-f0-9]{64}$')));
create function public.validate_sheet_view_source(p_source jsonb) returns void language plpgsql set search_path='' as $$
begin
 if jsonb_typeof(p_source) is distinct from 'object' or (p_source-array['spreadsheetId','sheetId','startRow','rowCount','startColumn','columnCount'])<>'{}'::jsonb
  or not (p_source ?& array['spreadsheetId','sheetId','startRow','rowCount','startColumn','columnCount'])
  or jsonb_typeof(p_source->'spreadsheetId') is distinct from 'string' or (p_source->>'spreadsheetId') !~ '^[A-Za-z0-9_-]{10,200}$'
  or exists(select 1 from jsonb_each(p_source-'spreadsheetId') p where jsonb_typeof(value)<>'number' or (value::text) !~ '^[0-9]+$')
  or (p_source->>'sheetId')::numeric not between 0 and 2147483647
  or (p_source->>'startRow')::numeric not between 1 and 1000000 or (p_source->>'rowCount')::numeric not between 2 and 501
  or (p_source->>'startColumn')::numeric not between 1 and 18278 or (p_source->>'columnCount')::numeric not between 1 and 12
  or (p_source->>'startRow')::numeric+(p_source->>'rowCount')::numeric>1000001
  or (p_source->>'startColumn')::numeric+(p_source->>'columnCount')::numeric>18279
 then raise exception 'Invalid bounded sheet range' using errcode='22023'; end if;
end $$;
create function public.guard_sheet_view_source() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' and (old.sheet_source is distinct from new.sheet_source or old.sheet_header_hash is distinct from new.sheet_header_hash) then raise exception 'Sheet source cannot change' using errcode='42501'; end if;
 if new.source='sheets' then perform public.validate_sheet_view_source(new.sheet_source); end if;
 return new;
end $$;
revoke all on function public.validate_sheet_view_source(jsonb),public.guard_sheet_view_source() from public,anon,authenticated,service_role;
create trigger sheet_view_source before insert or update on public.organization_data_views for each row execute function public.guard_sheet_view_source();
-- Provider-backed metadata is private until the server proves the viewer's own Google access.
alter function public.workspace_data_view_command(jsonb) rename to workspace_data_view_command_nonlinked;
revoke all on function public.workspace_data_view_command_nonlinked(jsonb) from public,anon,authenticated,service_role;
create function public.workspace_data_view_command(p_command jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if p_command#>>'{source,kind}'='sheets' or exists(select 1 from public.organization_data_views where id=(p_command->>'viewId')::uuid and source='sheets') then raise exception 'Dataset access required' using errcode='42501'; end if;
 return public.workspace_data_view_command_nonlinked(p_command);
end $$;
revoke all on function public.workspace_data_view_command(jsonb) from public,anon,service_role;
grant execute on function public.workspace_data_view_command(jsonb) to authenticated;
create function public.workspace_sheet_view_command(p_actor_id uuid,p_command jsonb,p_commit boolean default false,p_header_hash text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 org uuid:=(p_command->>'organizationId')::uuid; view_id uuid:=(p_command->>'viewId')::uuid; action text:=p_command->>'action';
 v public.organization_data_views%rowtype; source jsonb; cols jsonb; config jsonb; result jsonb; receipt public.organization_data_view_receipts%rowtype;
 request uuid; closing boolean; can_edit boolean; allowed text[];
begin
 allowed:=array['action','organizationId','viewId']||case action when 'read' then array['page','sourceRevision'] when 'create_view' then array['requestId','name','source'] when 'save_view' then array['requestId','revision','config'] else array[]::text[] end;
 if p_actor_id is null or org is null or view_id is null or jsonb_typeof(p_command) is distinct from 'object' or octet_length(p_command::text)>10000
  or coalesce(action,'') not in('read','create_view','save_view') or (p_command-allowed)<>'{}'::jsonb
  or (action='create_view' and (jsonb_typeof(p_command->'name') is distinct from 'string' or length(btrim(p_command->>'name')) not between 1 and 100))
 then raise exception 'Invalid sheet view command' using errcode='22023'; end if;
 if action<>'create_view' and not exists(select 1 from public.organization_data_views where id=view_id and org_id=org and organization_data_views.source='sheets') then return null; end if;
 perform set_config('request.jwt.claim.sub',p_actor_id::text,true);
 if not public.data_view_workspace_access(org,false) then raise exception 'Workspace access required' using errcode='42501'; end if;
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'Read committed required' using errcode='40001'; end if;
 perform 1 from public.organizations where user_id=org for share nowait;
 if not found then raise exception 'Organization unavailable' using errcode='42501'; end if;
 closing:=public.guard_organization_closure(org,true);
 perform 1 from public.profiles where id=p_actor_id for share nowait;
 perform 1 from public.organization_memberships where org_id=org and member_id=p_actor_id for share nowait;
 if not public.data_view_workspace_access(org,false) then raise exception 'Workspace access changed' using errcode='42501'; end if;
 can_edit:=not closing and public.data_view_workspace_access(org,true);
 select * into v from public.organization_data_views where id=view_id and org_id=org;
 if action='create_view' then
  if p_command#>>'{source,kind}' is distinct from 'sheets' or ((p_command->'source')-array['kind','range'])<>'{}'::jsonb then raise exception 'Invalid sheet source' using errcode='22023'; end if;
  source:=p_command#>'{source,range}'; perform public.validate_sheet_view_source(source);
 else
  if v.id is null or v.source<>'sheets' then return null; end if;
  source:=v.sheet_source;
 end if;
 if action<>'read' and not can_edit then raise exception 'View editing unavailable' using errcode='42501'; end if;
 if not p_commit or action='read' then
  return jsonb_build_object('source',source,'headerHash',v.sheet_header_hash,'canEdit',can_edit,'view',case when v.id is not null then jsonb_build_object('id',v.id,'name',v.name,'revision',v.revision,'source','sheets','tableId',null,'config',v.config) else null end);
 end if;
 perform public.guard_uploaded_document_organization(org);
 request:=(p_command->>'requestId')::uuid;
 if request is null then raise exception 'Request identity required' using errcode='22023'; end if;
 if not pg_try_advisory_xact_lock(hashtextextended(org::text||request::text,0)) then raise exception 'Request in flight' using errcode='40001'; end if;
 select * into receipt from public.organization_data_view_receipts where org_id=org and request_id=request;
 if found then
  if receipt.actor_id<>p_actor_id or receipt.command<>p_command then raise exception 'Request identity reused' using errcode='40001'; end if;
  return receipt.result;
 end if;
 if not pg_try_advisory_xact_lock(hashtextextended(org::text||view_id::text,1)) then raise exception 'View changed' using errcode='40001'; end if;
 select jsonb_agg(jsonb_build_object('key','column_'||n)) into cols from generate_series(1,(source->>'columnCount')::integer)n;
 if action='create_view' then
  if p_header_hash is null or p_header_hash !~ '^[a-f0-9]{64}$' then raise exception 'Header identity required' using errcode='22023'; end if;
  if exists(select 1 from public.organization_data_views where id=view_id) then raise exception 'View changed' using errcode='40001'; end if;
  config:=jsonb_build_object('columns',(select jsonb_agg(c->'key') from jsonb_array_elements(cols)c),'filter',null,'sort',jsonb_build_object('column','column_1','direction','asc'));
  insert into public.organization_data_views(id,org_id,name,source,sheet_source,sheet_header_hash,config) values(view_id,org,p_command->>'name','sheets',source,p_header_hash,config) returning * into v;
 else
  perform public.validate_data_view_config(cols,p_command->'config');
  update public.organization_data_views dv set config=p_command->'config',revision=revision+1,updated_at=clock_timestamp()
   where id=view_id and org_id=org and dv.source='sheets' and revision=(p_command->>'revision')::integer returning * into v;
  if not found then raise exception 'View changed' using errcode='40001'; end if;
 end if;
 result:=jsonb_build_object('viewId',v.id,'revision',v.revision);
 insert into public.organization_data_view_receipts(org_id,request_id,actor_id,command,result) values(org,request,p_actor_id,p_command,result);
 return result;
end $$;
revoke all on function public.workspace_sheet_view_command(uuid,jsonb,boolean,text) from public,anon,authenticated;
grant execute on function public.workspace_sheet_view_command(uuid,jsonb,boolean,text) to service_role;
commit;
