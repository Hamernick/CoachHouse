-- S09: saved projections reference canonical projects or one workspace-owned table.
-- No form responses, provider credentials, public projection or copied project rows.
begin;
create table public.organization_data_tables (
 id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(user_id) on delete cascade,
 name text not null check(length(name) between 1 and 100), columns jsonb not null,
 provenance jsonb not null, created_at timestamptz not null default now()
);
create table public.organization_data_rows (
 id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(user_id) on delete cascade,
 table_id uuid not null references public.organization_data_tables(id) on delete cascade,
 values jsonb not null, revision integer not null default 1 check(revision>0), updated_at timestamptz not null default now()
);
create index organization_data_rows_source on public.organization_data_rows(table_id,id);
create table public.organization_data_views (
 id uuid primary key, org_id uuid not null references public.organizations(user_id) on delete cascade,
 name text not null check(length(name) between 1 and 100), source text not null check(source in('projects','table')),
 table_id uuid references public.organization_data_tables(id) on delete cascade,
 config jsonb not null, revision integer not null default 1 check(revision>0), updated_at timestamptz not null default now(),
 check((source='table')=(table_id is not null))
);
create table public.organization_data_view_receipts (
 org_id uuid not null references public.organizations(user_id) on delete cascade, request_id uuid not null,
 actor_id uuid not null, command jsonb not null, result jsonb not null, created_at timestamptz not null default now(),
 primary key(org_id,request_id)
);
alter table public.organization_data_tables enable row level security;
alter table public.organization_data_rows enable row level security;
alter table public.organization_data_views enable row level security;
alter table public.organization_data_view_receipts enable row level security;
-- No direct API mutation grants. The authenticated RPC derives its actor and checks
-- existing workspace audience and each source reader/writer; privileged SQL writes also join closure below.
revoke all on public.organization_data_tables,public.organization_data_rows,public.organization_data_views,public.organization_data_view_receipts from public,anon,authenticated,service_role;
create function public.guard_data_view_store() returns trigger language plpgsql security definer set search_path='' as $$
declare org uuid;
begin
 org:=case when tg_op='DELETE' then old.org_id else new.org_id end;
 if tg_op='UPDATE' and (old.org_id<>new.org_id or (tg_table_name<>'organization_data_view_receipts' and to_jsonb(old)->'id' is distinct from to_jsonb(new)->'id')) then raise exception 'Dataset owner cannot change' using errcode='42501'; end if;
 if tg_op='DELETE' and not exists(select 1 from public.organizations where user_id=org) then return old; end if;
 perform public.guard_uploaded_document_organization(org);
 if tg_table_name='organization_data_view_receipts' and tg_op<>'INSERT' then raise exception 'Data view receipts are immutable' using errcode='42501'; end if;
 if tg_table_name='organization_data_rows' and tg_op<>'DELETE' then
   if tg_op='UPDATE' and (old.id<>new.id or old.table_id<>new.table_id) then raise exception 'Dataset identity cannot change' using errcode='42501'; end if;
   if not exists(select 1 from public.organization_data_tables where id=new.table_id and org_id=org) then raise exception 'Dataset unavailable' using errcode='42501'; end if;
 elsif tg_table_name='organization_data_views' and tg_op<>'DELETE' then
   if tg_op='UPDATE' and (old.id<>new.id or old.source<>new.source or old.table_id is distinct from new.table_id) then raise exception 'View source cannot change' using errcode='42501'; end if;
   if new.source='table' and not exists(select 1 from public.organization_data_tables where id=new.table_id and org_id=org) then raise exception 'Dataset unavailable' using errcode='42501'; end if;
 end if;
 return case when tg_op='DELETE' then old else new end;
end $$;
revoke all on function public.guard_data_view_store() from public,anon,authenticated,service_role;
create trigger data_view_closure before insert or update or delete on public.organization_data_tables for each row execute function public.guard_data_view_store();
create trigger data_view_closure before insert or update or delete on public.organization_data_rows for each row execute function public.guard_data_view_store();
create trigger data_view_closure before insert or update or delete on public.organization_data_views for each row execute function public.guard_data_view_store();
create trigger data_view_closure before insert or update or delete on public.organization_data_view_receipts for each row execute function public.guard_data_view_store();

create function public.validate_data_columns(p_columns jsonb) returns void language plpgsql set search_path='' as $$
declare col jsonb; seen text[]:='{}';
begin
 if jsonb_typeof(p_columns)<>'array' or jsonb_array_length(p_columns) not between 1 and 12 then raise exception 'Invalid columns' using errcode='22023'; end if;
 for col in select value from jsonb_array_elements(p_columns) loop
   if jsonb_typeof(col) is distinct from 'object' or (col-array['key','label','type','options','writable'])<>'{}'::jsonb
    or jsonb_typeof(col->'key') is distinct from 'string' or jsonb_typeof(col->'label') is distinct from 'string' or jsonb_typeof(col->'type') is distinct from 'string' or col->>'key' is null or col->>'key' !~ '^[a-z][a-z0-9_]{0,39}$' or col->>'key'=any(seen)
    or coalesce(length(col->>'label'),0) not between 1 and 80 or coalesce(col->>'type','') not in('text','number','boolean','date','select')
    or jsonb_typeof(col->'writable') is distinct from 'boolean' or jsonb_typeof(col->'options') is distinct from 'array'
    or jsonb_array_length(col->'options')>30 then raise exception 'Invalid column' using errcode='22023'; end if;
   if col->>'type'='select' and jsonb_array_length(col->'options')=0 then raise exception 'Selection options required' using errcode='22023'; end if;
   if exists(select 1 from jsonb_array_elements(col->'options') option where jsonb_typeof(option)<>'string' or length(option#>>'{}') not between 1 and 80) then raise exception 'Invalid options' using errcode='22023'; end if;
   seen:=array_append(seen,col->>'key');
 end loop;
end $$;
create function public.validate_data_values(p_columns jsonb,p_values jsonb) returns void language plpgsql set search_path='' as $$
declare col jsonb; val jsonb; entry record; date_value date;
begin
 if jsonb_typeof(p_values) is distinct from 'object' then raise exception 'Invalid row' using errcode='22023'; end if;
 for entry in select * from jsonb_each(p_values) loop
   select value into col from jsonb_array_elements(p_columns) where value->>'key'=entry.key;
   if col is null or col->>'writable'<>'true' then raise exception 'Field is read only' using errcode='42501'; end if;
   val:=entry.value;
   if val='null'::jsonb then continue; end if;
   if (col->>'type' in('text','date','select') and jsonb_typeof(val)<>'string')
    or (col->>'type'='number' and jsonb_typeof(val)<>'number')
    or (col->>'type'='boolean' and jsonb_typeof(val)<>'boolean') or length(val#>>'{}')>4000 then raise exception 'Invalid cell' using errcode='22023'; end if;
   if col->>'type'='number' and abs((val#>>'{}')::numeric)>1e308::numeric then raise exception 'Number is out of range' using errcode='22023'; end if;
   if col->>'type'='date' then
     if val#>>'{}' !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Invalid date' using errcode='22023'; end if;
     begin date_value:=(val#>>'{}')::date; exception when others then raise exception 'Invalid date' using errcode='22023'; end;
   elsif col->>'type'='select' and not (col->'options' @> jsonb_build_array(val)) then raise exception 'Invalid selection' using errcode='22023'; end if;
 end loop;
end $$;
create function public.validate_data_view_config(p_columns jsonb,p_config jsonb) returns void language plpgsql set search_path='' as $$
declare key text; keys text[];
begin
 select array_agg(value->>'key') into keys from jsonb_array_elements(p_columns);
 if jsonb_typeof(p_config) is distinct from 'object' or (p_config-array['columns','filter','sort'])<>'{}'::jsonb
   or jsonb_typeof(p_config->'sort') is distinct from 'object' or ((p_config->'sort')-array['column','direction'])<>'{}'::jsonb
   or (p_config->'filter'<>'null'::jsonb and ((p_config->'filter')-array['column','value'])<>'{}'::jsonb) or not (p_config ?& array['columns','filter','sort'])
   or jsonb_typeof(p_config->'columns') is distinct from 'array' or jsonb_array_length(p_config->'columns') not between 1 and 12
   or coalesce(p_config#>>'{sort,direction}','') not in('asc','desc') or not coalesce(p_config#>>'{sort,column}'=any(keys),false)
   or (p_config->'filter'<>'null'::jsonb and (jsonb_typeof(p_config->'filter') is distinct from 'object' or jsonb_typeof(p_config#>'{filter,value}') is distinct from 'string' or not coalesce(p_config#>>'{filter,column}'=any(keys),false) or length(p_config#>>'{filter,value}')>120))
 then raise exception 'Invalid view configuration' using errcode='22023'; end if;
 for key in select jsonb_array_elements_text(p_config->'columns') loop
   if not key=any(keys) then raise exception 'Unknown view column' using errcode='22023'; end if;
 end loop;
 if (select count(distinct value) from jsonb_array_elements_text(p_config->'columns'))<>jsonb_array_length(p_config->'columns') then raise exception 'Duplicate view column' using errcode='22023'; end if;
end $$;
revoke all on function public.validate_data_columns(jsonb),public.validate_data_values(jsonb,jsonb),public.validate_data_view_config(jsonb,jsonb) from public,anon,authenticated,service_role;

-- Same standard owner/admin/member audience as organization_workspace_boards.
-- Table creation adds no subscription gate or external/support grant.
create function public.data_view_workspace_access(p_org uuid,p_write boolean) returns boolean
 language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (public.is_admin() or p_org=auth.uid() or exists(
  select 1 from public.organization_memberships where org_id=p_org and member_id=auth.uid()
  and (not p_write or role in('admin','staff'))));
$$;
revoke all on function public.data_view_workspace_access(uuid,boolean) from public,anon,authenticated,service_role;

create function public.workspace_data_view_command(p_command jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 actor uuid:=auth.uid(); org uuid:=(p_command->>'organizationId')::uuid; view_id uuid:=(p_command->>'viewId')::uuid;
 action text:=p_command->>'action'; writable boolean; closing boolean:=false; allowed text[]; v public.organization_data_views%rowtype; source_table public.organization_data_tables%rowtype;
 cols jsonb; config jsonb; result jsonb; receipt public.organization_data_view_receipts%rowtype; request uuid;
 record_id uuid; row_record public.organization_data_rows%rowtype; source_kind text; input_source jsonb; entry jsonb;
 page_number integer:=coalesce((p_command->>'page')::integer,0); sort_key text; numeric_sort boolean; direction text;
begin
 allowed:=array['action','organizationId','viewId'] || case action
  when 'read' then array['page'] when 'sources' then array[]::text[]
  when 'create_view' then array['requestId','name','source'] when 'save_view' then array['requestId','revision','config']
  when 'edit_cell' then array['requestId','rowId','revision','column','value'] when 'add_row' then array['requestId','values'] else array[]::text[] end;
 if jsonb_typeof(p_command) is distinct from 'object' or coalesce(action,'') not in('read','sources','create_view','save_view','edit_cell','add_row') or octet_length(p_command::text)>1000000
   or (p_command-allowed)<>'{}'::jsonb or not (p_command ?& array['action','organizationId','viewId'])
   or jsonb_typeof(p_command->'organizationId') is distinct from 'string' or jsonb_typeof(p_command->'viewId') is distinct from 'string'
   or (action='create_view' and (jsonb_typeof(p_command->'name') is distinct from 'string' or length(btrim(p_command->>'name')) not between 1 and 100))
   or (action='save_view' and jsonb_typeof(p_command->'revision') is distinct from 'number')
   or (action='edit_cell' and (jsonb_typeof(p_command->'rowId') is distinct from 'string' or jsonb_typeof(p_command->'revision') is distinct from 'string' or jsonb_typeof(p_command->'column') is distinct from 'string' or not p_command?'value'))
 then raise exception 'Invalid bounded data view command' using errcode='22023'; end if;
 if actor is null or org is null or view_id is null or not public.data_view_workspace_access(org,false) then raise exception 'Dataset access required' using errcode='42501'; end if;
 if action in('read','sources') then
   if current_setting('transaction_isolation')<>'read committed' then raise exception 'Read committed required' using errcode='40001'; end if;
   perform 1 from public.organizations where user_id=org for share nowait;
   closing:=public.guard_organization_closure(org,true);
 else perform public.guard_uploaded_document_organization(org); end if;
 -- Stabilize the existing authorization facts before waiting on source writes.
 perform 1 from public.profiles where id=actor for share nowait;
 perform 1 from public.organization_memberships where org_id=org and member_id=actor for share nowait;
 if not public.data_view_workspace_access(org,false) then raise exception 'Dataset access changed' using errcode='42501'; end if;
 writable:=not closing and public.data_view_workspace_access(org,true);
 if action='sources' then
   return coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name) order by name,id) from (select id,name from public.organization_data_tables where org_id=org order by name,id limit 100) t),'[]'::jsonb);
 end if;
 if action not in('read','create_view','save_view','edit_cell','add_row') then raise exception 'Invalid action' using errcode='22023'; end if;
 select * into v from public.organization_data_views where id=view_id and org_id=org;
 source_kind:=case when action='create_view' then p_command#>>'{source,kind}' else v.source end;
 if source_kind='projects' then
   perform 1 from public.subscriptions where user_id=org for share nowait;
   if not public.can_read_member_workspace_org(org) or (action<>'read' and not public.can_write_member_workspace_org(org)) then
     raise exception 'Project source access required' using errcode='42501'; end if;
 end if;
 if action<>'read' then
   if not writable then raise exception 'Dataset editing required' using errcode='42501'; end if;
   request:=(p_command->>'requestId')::uuid;
   if request is null then raise exception 'Request identity required' using errcode='22023'; end if;
   if not pg_try_advisory_xact_lock(hashtextextended(org::text||request::text,0)) then raise exception 'Request is in flight; retry unchanged' using errcode='40001'; end if;
   select * into receipt from public.organization_data_view_receipts where org_id=org and request_id=request;
   if found then
     if receipt.actor_id<>actor or receipt.command<>p_command then raise exception 'Request identity reused' using errcode='40001'; end if;
     return receipt.result;
   end if;
   if not pg_try_advisory_xact_lock(hashtextextended(org::text||view_id::text,1)) then raise exception 'View is changing; retry' using errcode='40001'; end if;
 end if;
 select * into v from public.organization_data_views where id=view_id and org_id=org;
 if action='create_view' then
   if v.id is not null then raise exception 'View already exists' using errcode='40001'; end if;
   input_source:=p_command->'source'; source_kind:=input_source->>'kind';
   if jsonb_typeof(input_source) is distinct from 'object'
     or (input_source-(case source_kind when 'projects' then array['kind'] when 'table' then array['kind','tableId'] when 'new_table' then array['kind','columns','rows','provenance','audienceConfirmed'] else array[]::text[] end))<>'{}'::jsonb
   then raise exception 'Invalid source fields' using errcode='22023'; end if;
   if source_kind='new_table' then
     if input_source->'audienceConfirmed' is distinct from 'true'::jsonb then raise exception 'Audience review required' using errcode='22023'; end if;
     if jsonb_typeof(input_source->'provenance') is distinct from 'object' or ((input_source->'provenance')-array['kind','filename','rowCount'])<>'{}'::jsonb
       or not (input_source->'provenance' ?& array['kind','filename','rowCount'])
       or jsonb_typeof(input_source#>'{provenance,rowCount}') is distinct from 'number'
       or jsonb_typeof(input_source#>'{provenance,filename}') not in('string','null') or coalesce(length(input_source#>>'{provenance,filename}'),0)>255
     then raise exception 'Invalid import provenance' using errcode='22023'; end if;
     cols:=input_source->'columns'; perform public.validate_data_columns(cols);
     if jsonb_typeof(input_source->'rows') is distinct from 'array' or jsonb_array_length(input_source->'rows')>500
       or coalesce(input_source#>>'{provenance,kind}','') not in('new','csv_copy')
       or (input_source#>>'{provenance,rowCount}')::integer is distinct from jsonb_array_length(input_source->'rows')
     then raise exception 'Invalid import receipt' using errcode='22023'; end if;
     insert into public.organization_data_tables(org_id,name,columns,provenance) values(org,p_command->>'name',cols,input_source->'provenance') returning * into source_table;
     for entry in select value from jsonb_array_elements(input_source->'rows') loop
       perform public.validate_data_values(cols,entry);
       insert into public.organization_data_rows(org_id,table_id,values) values(org,source_table.id,entry);
     end loop;
     source_kind:='table';
   elsif source_kind='table' then
     select * into source_table from public.organization_data_tables where id=(input_source->>'tableId')::uuid and org_id=org;
     if not found then raise exception 'Dataset unavailable' using errcode='42501'; end if;
     cols:=source_table.columns;
   elsif source_kind<>'projects' or source_kind is null then raise exception 'Invalid source' using errcode='22023'; end if;
 else
   if v.id is null then
     if action='read' then return jsonb_build_object('view',null,'columns','[]'::jsonb,'rows','[]'::jsonb,'total',0,'page',0,'canEdit',writable,'provenance',null); end if;
     raise exception 'View unavailable' using errcode='42501';
   end if;
   source_kind:=v.source;
   if source_kind='table' then select * into source_table from public.organization_data_tables where id=v.table_id and org_id=org; cols:=source_table.columns; end if;
 end if;
 if source_kind='projects' then
   cols:='[{"key":"title","label":"Project","type":"text","options":[],"writable":false},{"key":"status","label":"Status","type":"select","options":["backlog","planned","active","cancelled","completed"],"writable":true},{"key":"start_date","label":"Starts","type":"date","options":[],"writable":false},{"key":"end_date","label":"Ends","type":"date","options":[],"writable":false}]'::jsonb;
 end if;
 if action='create_view' then
   config:=jsonb_build_object('columns',(select jsonb_agg(value->'key') from jsonb_array_elements(cols)),'filter',null,'sort',jsonb_build_object('column',cols->0->>'key','direction','asc'));
   insert into public.organization_data_views(id,org_id,name,source,table_id,config) values(view_id,org,p_command->>'name',source_kind,source_table.id,config) returning * into v;
   result:=jsonb_build_object('viewId',v.id,'revision',v.revision);
 elsif action='save_view' then
   perform public.validate_data_view_config(cols,p_command->'config');
   update public.organization_data_views set config=p_command->'config',revision=revision+1,updated_at=clock_timestamp() where id=view_id and revision=(p_command->>'revision')::integer returning * into v;
   if not found then raise exception 'View changed' using errcode='40001'; end if;
   result:=jsonb_build_object('viewId',v.id,'revision',v.revision);
 elsif action='edit_cell' then
   record_id:=(p_command->>'rowId')::uuid;
   perform public.validate_data_values(cols,jsonb_build_object(p_command->>'column',p_command->'value'));
   if source_kind='projects' then
     if p_command->'value'='null'::jsonb then raise exception 'Project status required' using errcode='22023'; end if;
     perform 1 from public.organization_projects where id=record_id and org_id=org and public.fiscal_guest_project_reviewer_access(id,actor) is null for update nowait;
     if not found then raise exception 'Project unavailable' using errcode='42501'; end if;
     result:=public.update_organization_project_status_transition(record_id,actor,org,(p_command->>'revision')::timestamptz,p_command->>'value');
     if result->>'ok' is distinct from 'true' then raise exception 'Project changed or unavailable' using errcode='40001'; end if;
   else
     select * into row_record from public.organization_data_rows where id=record_id and table_id=v.table_id and org_id=org for update nowait;
     if not found then raise exception 'Row unavailable' using errcode='42501'; end if;
     if row_record.revision::text is distinct from p_command->>'revision' then raise exception 'Row changed' using errcode='40001'; end if;
     update public.organization_data_rows set values=jsonb_set(values,array[p_command->>'column'],p_command->'value'),revision=revision+1,updated_at=clock_timestamp() where id=record_id returning * into row_record;
     result:=jsonb_build_object('rowId',record_id,'revision',row_record.revision::text);
   end if;
 elsif action='add_row' then
   if source_kind<>'table' then raise exception 'Use the project creator' using errcode='42501'; end if;
   perform public.validate_data_values(cols,p_command->'values');
   insert into public.organization_data_rows(org_id,table_id,values) values(org,v.table_id,p_command->'values') returning id into record_id;
   result:=jsonb_build_object('rowId',record_id,'revision','1');
 else
   if page_number not between 0 and 400 then raise exception 'Invalid page' using errcode='22023'; end if;
   config:=v.config; sort_key:=config#>>'{sort,column}'; direction:=config#>>'{sort,direction}';
   numeric_sort:=exists(select 1 from jsonb_array_elements(cols) c where c->>'key'=sort_key and c->>'type'='number');
   with source_rows as (
     select id,revision::text as row_revision,values as cells from public.organization_data_rows where source_kind='table' and table_id=v.table_id and org_id=org
     union all
     select id,updated_at::text,jsonb_build_object('title',name,'status',status,'start_date',start_date,'end_date',end_date) from public.organization_projects where source_kind='projects' and org_id=org and public.fiscal_guest_project_reviewer_access(id,actor) is null
   ), filtered as (
     select * from source_rows where config->'filter'='null'::jsonb or position(lower(config#>>'{filter,value}') in lower(coalesce(cells->>(config#>>'{filter,column}'),'')))>0
   ), page_rows as (
     select * from filtered order by
       case when numeric_sort and direction='asc' then (cells->>sort_key)::numeric end asc nulls last,
       case when numeric_sort and direction='desc' then (cells->>sort_key)::numeric end desc nulls last,
       case when not numeric_sort and direction='asc' then cells->>sort_key end collate "C" asc nulls last,
       case when not numeric_sort and direction='desc' then cells->>sort_key end collate "C" desc nulls last,id
       limit 25 offset page_number*25
   ) select jsonb_build_object('view',jsonb_build_object('id',v.id,'name',v.name,'revision',v.revision,'source',v.source,'tableId',v.table_id,'config',v.config),
     'columns',cols,'rows',coalesce((select jsonb_agg(jsonb_build_object('id',id,'revision',row_revision,'values',cells)) from page_rows),'[]'::jsonb),
     'total',(select count(*) from filtered),'page',page_number,'canEdit',writable,'provenance',source_table.provenance) into result;
   return result;
 end if;
 insert into public.organization_data_view_receipts(org_id,request_id,actor_id,command,result) values(org,request,actor,p_command,result);
 return result;
end $$;
revoke all on function public.workspace_data_view_command(jsonb) from public,anon,service_role;
grant execute on function public.workspace_data_view_command(jsonb) to authenticated;
comment on function public.workspace_data_view_command(jsonb) is 'Authenticated bounded saved views; existing workspace authorization, project CAS writer, typed owned tables, request receipts and organization closure fence. No private responses or external providers.';
commit;
