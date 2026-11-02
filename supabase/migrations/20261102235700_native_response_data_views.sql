-- Native response views reuse the saved-view owner and canonical form authority.
-- No copied response dataset, organization-owner fallback, or answer-edit writer.
begin;
alter table public.organization_data_views drop constraint organization_data_views_source_check;
alter table public.organization_data_views add constraint organization_data_views_source_check check(source in('projects','table','responses'));
alter table public.organization_data_views add column response_version_id uuid references public.organization_form_versions(id) on delete cascade;
alter table public.organization_data_views add constraint organization_data_views_response_source check((source='responses')=(response_version_id is not null));
create function public.guard_response_view_source() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' and old.response_version_id is distinct from new.response_version_id then raise exception 'Response source cannot change' using errcode='42501'; end if;
 if new.source='responses' and not exists(select 1 from public.organization_form_versions where id=new.response_version_id and org_id=new.org_id) then raise exception 'Response source unavailable' using errcode='42501'; end if;
 return new;
end $$;
revoke all on function public.guard_response_view_source() from public,anon,authenticated,service_role;
create trigger response_view_source before insert or update on public.organization_data_views for each row execute function public.guard_response_view_source();
-- Ordinary board authority never reveals native-view metadata, filters or receipts.
alter function public.workspace_data_view_command(jsonb) rename to workspace_data_view_command_nonresponse;
revoke all on function public.workspace_data_view_command_nonresponse(jsonb) from public,anon,authenticated,service_role;
create function public.workspace_data_view_command(p_command jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if p_command#>>'{source,kind}'='responses' or exists(select 1 from public.organization_data_views where id=(p_command->>'viewId')::uuid and source='responses') then raise exception 'Dataset access required' using errcode='42501'; end if;
 return public.workspace_data_view_command_nonresponse(p_command);
end $$;
revoke all on function public.workspace_data_view_command(jsonb) from public,anon,service_role;
grant execute on function public.workspace_data_view_command(jsonb) to authenticated;

create function public.response_data_view_columns(p_version jsonb) returns jsonb language sql immutable set search_path='' as $$
 select '[{"key":"submitted_at","label":"Submitted","type":"text","options":[],"writable":false,"queryable":true}]'::jsonb || coalesce(jsonb_agg(jsonb_build_object(
 'key','q_'||replace(q->>'id','-',''),'label',left(q->>'label',80),
 'type',case when q->>'type' in('number','linear_scale','rating') then 'number' when q->>'type'='date' then 'date' else 'text' end,
 'options','[]'::jsonb,'writable',true,'queryable',q->>'type' not in('multiple_choice','multiple_choice_grid','checkbox_grid') and coalesce(q->>'allowOther','false')<>'true') order by ordinal),'[]'::jsonb)
 from jsonb_array_elements(p_version#>'{definition,questions}') with ordinality t(q,ordinal);
$$;
create function public.response_data_view_cells(p_version jsonb,p_answers jsonb,p_submitted timestamptz) returns jsonb language plpgsql stable set search_path='' as $$
declare q jsonb; val jsonb; result jsonb:=jsonb_build_object('submitted_at',p_submitted); label text;
begin
 for q in select value from jsonb_array_elements(p_version#>'{definition,questions}') loop
   select value->'value' into val from jsonb_array_elements(p_answers) where value->>'questionId'=q->>'id';
   if val is null then val:='null';
   elsif q->>'type' in('single_choice','dropdown') and jsonb_typeof(val)='string' then
     select value->>'label' into label from jsonb_array_elements(q->'options') where value->>'id'=val#>>'{}';
     val:=to_jsonb(coalesce(label,val#>>'{}'));
   elsif jsonb_typeof(val) in('array','object') then val:=to_jsonb(left(val::text,10000)); end if;
   result:=result||jsonb_build_object('q_'||replace(q->>'id','-',''),val);
 end loop;
 return result;
end $$;
revoke all on function public.response_data_view_columns(jsonb),public.response_data_view_cells(jsonb,jsonb,timestamptz) from public,anon,authenticated,service_role;

create function public.workspace_response_view_command(p_actor_id uuid,p_command jsonb) returns jsonb
 language plpgsql security definer set search_path='' as $$
declare action text:=p_command->>'action'; view_id uuid; org uuid; version_id uuid; version public.organization_form_versions%rowtype;
 v public.organization_data_views%rowtype; response_page jsonb; cols jsonb; config jsonb; can_edit boolean; result jsonb;
 receipt public.organization_data_view_receipts%rowtype; request uuid; allowed text[]; page_number integer; sort_key text; direction text; numeric_sort boolean;
begin
 if p_actor_id is null then raise exception 'Response access required' using errcode='42501'; end if;
 allowed:=case action when 'response_views' then array['action','versionId'] else array['action','organizationId','viewId']||case action
  when 'read' then array['page'] when 'create_view' then array['requestId','name','source'] when 'save_view' then array['requestId','revision','config']
  when 'edit_response_cell' then array['requestId','rowId','revision','questionId','value'] else array[]::text[] end end;
 if jsonb_typeof(p_command) is distinct from 'object' or (p_command-allowed)<>'{}'::jsonb or octet_length(p_command::text)>1000000
   or coalesce(action,'') not in('response_views','read','create_view','save_view','edit_response_cell') then raise exception 'Invalid response view command' using errcode='22023'; end if;
 if action='response_views' then version_id:=(p_command->>'versionId')::uuid;
 else
   view_id:=(p_command->>'viewId')::uuid; org:=(p_command->>'organizationId')::uuid;
   select * into v from public.organization_data_views where id=view_id and org_id=org and source='responses';
   if action='create_view' and p_command#>>'{source,kind}'='responses' then
     if ((p_command->'source')-array['kind','versionId'])<>'{}'::jsonb or jsonb_typeof(p_command->'name') is distinct from 'string' or length(btrim(p_command->>'name')) not between 1 and 100 then raise exception 'Invalid response source' using errcode='22023'; end if;
     version_id:=(p_command#>>'{source,versionId}')::uuid;
   elsif v.id is not null then version_id:=v.response_version_id;
   else return null; end if;
 end if;
 select * into version from public.organization_form_versions where id=version_id;
 if not found or (org is not null and org<>version.org_id) then raise exception 'Response source unavailable' using errcode='42501'; end if;
 org:=version.org_id;
 -- Canonical S08 reader owns response rights, current invitation state, form lock
 -- and export-window restrictions. Never derive access from board/org ownership.
 response_page:=public.organization_form_intake(p_actor_id,jsonb_build_object('action','responses','versionId',version.id));
 can_edit:=coalesce((response_page#>>'{permissions,canCorrect}')::boolean,false);
 if action='response_views' then
   return jsonb_build_object('organizationId',org,'versionId',version.id,'title',version.version->>'title','canCreate',can_edit,'views',
     coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name) order by name,id) from (select id,name from public.organization_data_views where response_version_id=version.id order by name,id limit 50) t),'[]'::jsonb));
 end if;
 if action='edit_response_cell' then
   if not can_edit then raise exception 'Response correction required' using errcode='42501'; end if;
   if not exists(select 1 from public.organization_form_responses r where r.version_id=version.id and r.id=(p_command->>'rowId')::uuid)
      or not exists(select 1 from jsonb_array_elements(version.version#>'{definition,questions}') q where q->>'id'=p_command->>'questionId') then raise exception 'Response field unavailable' using errcode='42501'; end if;
   -- No answer or receipt is copied here. The server invokes runFormIntake(correct)
   -- next, which rechecks authority and delegates all validation/CAS/replay to O5.
   return jsonb_build_object('versionId',version.id);
 end if;
 cols:=public.response_data_view_columns(version.version);
 if action<>'read' then
   if not can_edit then raise exception 'Response view editing required' using errcode='42501'; end if;
   perform public.guard_uploaded_document_organization(org);
   request:=(p_command->>'requestId')::uuid;
   if request is null or view_id is null then raise exception 'Request identity required' using errcode='22023'; end if;
   if not pg_try_advisory_xact_lock(hashtextextended(org::text||request::text,0)) then raise exception 'Request in flight' using errcode='40001'; end if;
   select * into receipt from public.organization_data_view_receipts where org_id=org and request_id=request;
   if found then
     if receipt.actor_id<>p_actor_id or receipt.command<>p_command then raise exception 'Request identity reused' using errcode='40001'; end if;
     return receipt.result;
   end if;
   if not pg_try_advisory_xact_lock(hashtextextended(org::text||view_id::text,1)) then raise exception 'View changed' using errcode='40001'; end if;
   if action='create_view' then
     if exists(select 1 from public.organization_data_views where id=view_id) then raise exception 'View changed' using errcode='40001'; end if;
     config:=jsonb_build_object('columns',(select jsonb_agg(c->'key') from (select value c from jsonb_array_elements(cols) limit 12) t),
       'filter',null,'sort',jsonb_build_object('column','submitted_at','direction','desc'));
     insert into public.organization_data_views(id,org_id,name,source,response_version_id,config) values(view_id,org,p_command->>'name','responses',version.id,config) returning * into v;
   else
     config:=p_command->'config'; perform public.validate_data_view_config(cols,config);
     if not exists(select 1 from jsonb_array_elements(cols) c where c->>'key'=config#>>'{sort,column}' and c->>'queryable'='true')
       or (config->'filter'<>'null'::jsonb and not exists(select 1 from jsonb_array_elements(cols) c where c->>'key'=config#>>'{filter,column}' and c->>'queryable'='true')) then raise exception 'This answer type has no scalar query' using errcode='22023'; end if;
     update public.organization_data_views set config=p_command->'config',revision=revision+1,updated_at=clock_timestamp()
       where id=view_id and org_id=org and response_version_id=version.id and revision=(p_command->>'revision')::integer returning * into v;
     if not found then raise exception 'View changed' using errcode='40001'; end if;
   end if;
   result:=jsonb_build_object('viewId',v.id,'revision',v.revision);
   insert into public.organization_data_view_receipts(org_id,request_id,actor_id,command,result) values(org,request,p_actor_id,p_command,result);
   return result;
 end if;
 config:=v.config; page_number:=coalesce((p_command->>'page')::integer,0);
 if page_number not between 0 and 400 then raise exception 'Invalid page' using errcode='22023'; end if;
 sort_key:=config#>>'{sort,column}'; direction:=config#>>'{sort,direction}';
 numeric_sort:=exists(select 1 from jsonb_array_elements(cols) c where c->>'key'=sort_key and c->>'type'='number');
 with rows as (
   select r.*,r source_row,public.response_data_view_cells(version.version,r.answers,r.submitted_at) cells from public.organization_form_responses r where r.version_id=version.id
 ), filtered as (
   select * from rows where config->'filter'='null'::jsonb or position(lower(config#>>'{filter,value}') in lower(coalesce(cells->>(config#>>'{filter,column}'),'')))>0
 ), paged as (
   select * from filtered order by
    case when numeric_sort and direction='asc' then (cells->>sort_key)::numeric end asc nulls last,
    case when numeric_sort and direction='desc' then (cells->>sort_key)::numeric end desc nulls last,
    case when not numeric_sort and direction='asc' then cells->>sort_key end collate "C" asc nulls last,
    case when not numeric_sort and direction='desc' then cells->>sort_key end collate "C" desc nulls last,id
    limit 25 offset page_number*25
 ) select jsonb_build_object('view',jsonb_build_object('id',v.id,'name',v.name,'revision',v.revision,'source','responses','tableId',null,'config',v.config),
  'columns',cols,'rows',coalesce((select jsonb_agg(jsonb_build_object('id',id,'revision',revision::text,'values',cells)) from paged),'[]'::jsonb),
  'total',(select count(*) from filtered),'page',page_number,'canEdit',can_edit,'provenance',null,
  'responseSource',jsonb_build_object('version',version.version,'responses',coalesce((select jsonb_agg(public.organization_form_response_json(p.source_row)) from paged p),'[]'::jsonb))) into result;
 return result;
end $$;
revoke all on function public.workspace_response_view_command(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.workspace_response_view_command(uuid,jsonb) to service_role;
commit;
