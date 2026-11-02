-- Existing page invitations retain page-only editing unless an org editor
-- explicitly opts a reviewed canonical workspace note into source editing.
begin;
create table public.workspace_page_note_scopes(
 page_id uuid not null references public.organization_workspace_pages(id) on delete cascade,
 org_id uuid not null references public.organizations(user_id) on delete cascade,
 particle_id uuid not null,canvas_id uuid,source_created_at timestamptz not null,enabled boolean not null,
 granted_by uuid references auth.users(id) on delete set null,revoked_at timestamptz,updated_at timestamptz not null default now(),
 primary key(page_id,particle_id)
);
create table public.workspace_page_note_receipts(
 page_id uuid not null references public.organization_workspace_pages(id) on delete cascade,
 org_id uuid not null references public.organizations(user_id) on delete cascade,
 operation_id uuid not null,actor_id uuid references auth.users(id) on delete set null,
 command_hash text not null check(command_hash ~ '^[a-f0-9]{64}$'),
 action text not null check(action in('set_scope','write')),particle_id uuid not null,
 result_page_revision integer not null,result_note_revision bigint,
 created_at timestamptz not null default now(),primary key(page_id,operation_id)
);
create index workspace_page_note_scopes_active_org on public.workspace_page_note_scopes(org_id) where enabled;
alter table public.workspace_page_note_scopes enable row level security;
alter table public.workspace_page_note_receipts enable row level security;
revoke all on public.workspace_page_note_scopes,public.workspace_page_note_receipts from public,anon,authenticated,service_role;
create function public.guard_page_note_store() returns trigger language plpgsql security definer set search_path='' as $$
declare org uuid;actor_column text;parent_actor uuid;
begin
 org:=case when tg_op='DELETE' then old.org_id else new.org_id end;
 if tg_op='DELETE' and (not exists(select 1 from public.organizations where user_id=org) or not exists(select 1 from public.organization_workspace_pages where id=old.page_id)) then return old; end if;
 actor_column:=case when tg_table_name='workspace_page_note_scopes' then 'granted_by' else 'actor_id' end;
 if tg_op='UPDATE' then
  parent_actor:=(to_jsonb(old)->>actor_column)::uuid;
  if parent_actor is not null and to_jsonb(new)->actor_column='null'::jsonb and (to_jsonb(old)-actor_column)=(to_jsonb(new)-actor_column)
   and not exists(select 1 from auth.users where id=parent_actor) then return new; end if;
  if old.org_id<>new.org_id or old.page_id<>new.page_id or old.particle_id<>new.particle_id or (tg_table_name='workspace_page_note_scopes' and to_jsonb(old)->'canvas_id' is distinct from to_jsonb(new)->'canvas_id') then raise exception 'Source scope identity cannot change' using errcode='42501'; end if;
 end if;
 perform public.guard_uploaded_document_organization(org);
 if tg_table_name='workspace_page_note_receipts' and tg_op<>'INSERT' then raise exception 'Source receipts are immutable' using errcode='42501'; end if;
 if tg_op<>'DELETE' and not exists(select 1 from public.organization_workspace_pages where id=new.page_id and org_id=org) then raise exception 'Page unavailable' using errcode='42501'; end if;
 return case when tg_op='DELETE' then old else new end;
end $$;
revoke all on function public.guard_page_note_store() from public,anon,authenticated,service_role;
create trigger page_note_scope_closure before insert or update or delete on public.workspace_page_note_scopes for each row execute function public.guard_page_note_store();
create trigger page_note_receipt_closure before insert or update or delete on public.workspace_page_note_receipts for each row execute function public.guard_page_note_store();

-- A removed source/selection permanently disables the opt-in. Restoring the
-- same client-visible IDs/timestamps cannot revive it without new consent.
create function public.revoke_removed_page_note_scopes() returns trigger language plpgsql security definer set search_path='' as $$
declare s public.workspace_page_note_scopes%rowtype;board jsonb;graph jsonb;item jsonb;matches integer;org uuid;
begin
 org:=old.org_id;
 if not exists(select 1 from public.organizations where user_id=org) then return case when tg_op='DELETE' then old else new end; end if;
 if tg_table_name='organization_workspace_pages' then
  if old.particle_ids is not distinct from new.particle_ids and old.guest_snapshot is not distinct from new.guest_snapshot and old.canvas_id is not distinct from new.canvas_id then return new; end if;
  update public.workspace_page_note_scopes scoped set enabled=false,revoked_at=coalesce(revoked_at,clock_timestamp()),updated_at=clock_timestamp()
   where scoped.page_id=new.id and scoped.enabled and (scoped.canvas_id is distinct from new.canvas_id or not scoped.particle_id=any(new.particle_ids)
    or not exists(select 1 from jsonb_array_elements(coalesce(new.guest_snapshot->'items','[]'))i where i->>'id'=scoped.particle_id::text and i#>>'{content,kind}'='notes'));
  return new;
 end if;
 if tg_op='UPDATE' and old.state is not distinct from new.state then return new; end if;
 board:=case when tg_op='DELETE' then '{}'::jsonb else new.state end;
 for s in select * from public.workspace_page_note_scopes where org_id=org and enabled loop
  graph:=null;
  if s.canvas_id is null then
   if not coalesce((board#>>'{workspaceCatalog,defaultDeleted}')::boolean,false) then graph:=board->'particleGraph'; end if;
  else
   select count(*) into matches from jsonb_array_elements(coalesce(board#>'{workspaceCatalog,entries}','[]'))e where e->>'id'=s.canvas_id::text;
   if matches=1 then select e#>'{state,particleGraph}' into graph from jsonb_array_elements(board#>'{workspaceCatalog,entries}')e where e->>'id'=s.canvas_id::text; end if;
  end if;
  select count(*) into matches from jsonb_array_elements(case when jsonb_typeof(graph->'particles')='array' then graph->'particles' else '[]'::jsonb end)p where p->>'id'=s.particle_id::text;
  item:=null;
  if matches=1 then select p into item from jsonb_array_elements(graph->'particles')p where p->>'id'=s.particle_id::text; end if;
  if matches<>1 or graph->>'workspaceId' is distinct from org::text or item->>'type' is distinct from 'activity' or item#>'{data,source}' is not null
   or item#>>'{data,widget,kind}' is distinct from 'notes' or item#>>'{data,widget,source,kind}' is distinct from 'workspace'
   or (item->>'createdAt')::timestamptz is distinct from s.source_created_at then
   update public.workspace_page_note_scopes set enabled=false,revoked_at=coalesce(revoked_at,clock_timestamp()),updated_at=clock_timestamp() where page_id=s.page_id and particle_id=s.particle_id;
  end if;
 end loop;
 return case when tg_op='DELETE' then old else new end;
end $$;
revoke all on function public.revoke_removed_page_note_scopes() from public,anon,authenticated,service_role;
create trigger workspace_page_note_source_removal after update or delete on public.organization_workspace_boards for each row execute function public.revoke_removed_page_note_scopes();
create trigger workspace_page_note_selection_removal after update of particle_ids,guest_snapshot,canvas_id on public.organization_workspace_pages for each row execute function public.revoke_removed_page_note_scopes();

create function public.workspace_page_note_command(p_actor_id uuid,p_page_id uuid,p_command jsonb,p_hash text default null,p_expected_graph jsonb default null,p_next_graph jsonb default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 access jsonb;page public.organization_workspace_pages%rowtype;board jsonb;graph jsonb;graph_path text[];
 item jsonb;next_item jsonb;chosen jsonb;listing jsonb:='[]';note jsonb:=null;scope public.workspace_page_note_scopes%rowtype;
 receipt public.workspace_page_note_receipts%rowtype;action text:=p_command->>'action';particle uuid:=(p_command->>'particleId')::uuid;
 operation uuid;matches integer;ordinal integer;can_manage boolean;can_edit boolean;allowed text[];replayed boolean:=false;next_revision bigint;stamp timestamptz:=clock_timestamp();
begin
 allowed:=array['action']||case action when 'list' then array[]::text[] when 'read' then array['particleId'] when 'review_scope' then array['particleId'] when 'set_scope' then array['particleId','operationId','expectedPageRevision','expectedNoteRevision','enabled'] when 'write' then array['particleId','operationId','expectedNoteRevision','content','html'] else array[]::text[] end;
 if p_actor_id is null or p_page_id is null or jsonb_typeof(p_command) is distinct from 'object' or coalesce(action,'') not in('list','read','review_scope','set_scope','write')
  or (p_command-allowed)<>'{}'::jsonb or octet_length(p_command::text)>1000000 or (action<>'list' and particle is null)
 or (action='write' and (jsonb_typeof(p_command->'content') is distinct from 'string' or length(p_command->>'content')>20000 or (p_command?'html' and (jsonb_typeof(p_command->'html') is distinct from 'string' or length(p_command->>'html')>120000))))
 then raise exception 'Invalid note command' using errcode='22023'; end if;
 -- Existing verified-account grant, delegation, page and closure authority.
 access:=public.workspace_page_guest_command(p_actor_id,p_page_id,'{"action":"read"}',null);
 can_manage:=(access->>'canGrantManage')::boolean;can_edit:=access->>'permission' in('edit','manage');
 if not can_edit then raise exception 'Page source editing unavailable' using errcode='42501'; end if;
 if action in('set_scope','review_scope') and not can_manage then raise exception 'Organization editor required' using errcode='42501'; end if;
 select * into page from public.organization_workspace_pages where id=p_page_id;
 select state into board from public.organization_workspace_boards where org_id=page.org_id for update nowait;
 if not found then raise exception 'Source unavailable' using errcode='42501'; end if;
 if page.canvas_id is null then
  if coalesce((board#>>'{workspaceCatalog,defaultDeleted}')::boolean,false) then raise exception 'Canvas unavailable' using errcode='42501'; end if;
  graph_path:=array['particleGraph'];
 else
  select count(*) into matches from jsonb_array_elements(coalesce(board#>'{workspaceCatalog,entries}','[]'))e where e->>'id'=page.canvas_id::text;
  if matches<>1 then raise exception 'Canvas unavailable' using errcode='42501'; end if;
  select n::integer-1 into ordinal from jsonb_array_elements(board#>'{workspaceCatalog,entries}') with ordinality e(value,n) where value->>'id'=page.canvas_id::text;
  graph_path:=array['workspaceCatalog','entries',ordinal::text,'state','particleGraph'];
 end if;
 graph:=board#>graph_path;
 if graph->>'workspaceId' is distinct from page.org_id::text or jsonb_typeof(graph->'particles') is distinct from 'array' then raise exception 'Source unavailable' using errcode='42501'; end if;
 if action in('set_scope','write') then
  perform public.guard_uploaded_document_organization(page.org_id);
  operation:=(p_command->>'operationId')::uuid;
  if operation is null or p_hash is null or p_hash !~ '^[a-f0-9]{64}$' then raise exception 'Operation identity required' using errcode='22023'; end if;
  select * into receipt from public.workspace_page_note_receipts where page_id=p_page_id and operation_id=operation;
  if found then
   if receipt.actor_id is distinct from p_actor_id or receipt.command_hash<>p_hash then raise exception 'Operation identity reused' using errcode='22023'; end if;
   replayed:=true;
  end if;
 end if;
 for chosen in select value from jsonb_array_elements(page.guest_snapshot->'items') where value#>>'{content,kind}'='notes' loop
  select count(*) into matches from jsonb_array_elements(graph->'particles')p where p->>'id'=chosen->>'id';
  select p into item from jsonb_array_elements(graph->'particles')p where p->>'id'=chosen->>'id' limit 1;
  if matches<>1 or not (chosen->>'id')::uuid=any(page.particle_ids) or item->>'type'<>'activity' or item#>'{data,source}' is not null
   or item#>>'{data,widget,kind}' is distinct from 'notes' or item#>>'{data,widget,source,kind}' is distinct from 'workspace' then continue; end if;
  select * into scope from public.workspace_page_note_scopes where page_id=p_page_id and particle_id=(chosen->>'id')::uuid;
  if can_manage or (scope.enabled and scope.canvas_id is not distinct from page.canvas_id and scope.source_created_at=(item->>'createdAt')::timestamptz) then
   listing:=listing||jsonb_build_array(jsonb_build_object('id',chosen->>'id','title',chosen->>'title','revision',(item->>'revision')::bigint,
    'enabled',coalesce(scope.enabled and scope.canvas_id is not distinct from page.canvas_id and scope.source_created_at=(item->>'createdAt')::timestamptz,false)));
  end if;
  if (chosen->>'id')::uuid=particle then note:=item; end if;
 end loop;
 if action<>'list' and note is null then raise exception 'Selected reviewed note unavailable' using errcode='42501'; end if;
 select * into scope from public.workspace_page_note_scopes where page_id=p_page_id and particle_id=particle;
 if action in('read','write') and (not coalesce(scope.enabled,false) or scope.canvas_id is distinct from page.canvas_id or scope.source_created_at is distinct from (note->>'createdAt')::timestamptz) then raise exception 'This note is not enabled for invited editors' using errcode='42501'; end if;
 if not replayed and action='set_scope' then
  if jsonb_typeof(p_command->'enabled') is distinct from 'boolean' or (p_command->>'expectedPageRevision')::integer is distinct from page.revision
   or ((p_command->>'enabled')::boolean and (p_command->>'expectedNoteRevision')::bigint is distinct from (note->>'revision')::bigint) then raise exception 'Reviewed source changed' using errcode='40001'; end if;
  insert into public.workspace_page_note_scopes(page_id,org_id,particle_id,canvas_id,source_created_at,enabled,granted_by)
   values(p_page_id,page.org_id,particle,page.canvas_id,(note->>'createdAt')::timestamptz,(p_command->>'enabled')::boolean,p_actor_id)
   on conflict(page_id,particle_id) do update set source_created_at=excluded.source_created_at,enabled=excluded.enabled,granted_by=excluded.granted_by,revoked_at=case when excluded.enabled then null else stamp end,updated_at=stamp;
 elsif not replayed and action='write' then
  if (p_command->>'expectedNoteRevision')::bigint is distinct from (note->>'revision')::bigint or p_expected_graph is distinct from graph then raise exception 'Note changed; reload before saving' using errcode='40001'; end if;
  if p_next_graph is null or octet_length(p_next_graph::text)>2000000 or jsonb_typeof(p_next_graph->'particles') is distinct from 'array' or jsonb_typeof(p_next_graph->'receipts') is distinct from 'array' then raise exception 'Invalid source update' using errcode='22023'; end if;
  select count(*) into matches from jsonb_array_elements(p_next_graph->'particles')p where p->>'id'=particle::text;
  select p into next_item from jsonb_array_elements(p_next_graph->'particles')p where p->>'id'=particle::text limit 1;
  next_revision:=(graph->>'revision')::bigint+1;
  select n::integer-1 into ordinal from jsonb_array_elements(graph->'particles') with ordinality e(value,n) where value->>'id'=particle::text;
  if matches<>1 or (p_next_graph->>'revision')::bigint is distinct from next_revision or (next_item->>'revision')::bigint is distinct from next_revision
   or jsonb_set(next_item,'{data,widget,source}',note#>'{data,widget,source}')-array['revision','updatedAt'] is distinct from note-array['revision','updatedAt']
   or jsonb_set(p_next_graph,array['particles',ordinal::text],note)-array['revision','receipts','minimumBaseRevision'] is distinct from graph-array['revision','receipts','minimumBaseRevision']
   or ((next_item#>'{data,widget,source}')-array['kind','content','html','contentEditedAt'])<>'{}'::jsonb
   or next_item#>>'{data,widget,source,kind}' is distinct from 'workspace'
   or next_item#>'{data,widget,source,content}' is distinct from p_command->'content'
   or next_item#>'{data,widget,source,html}' is distinct from p_command->'html'
  then raise exception 'Only the selected canonical note content may change' using errcode='42501'; end if;
  update public.organization_workspace_boards set state=jsonb_set(board,graph_path,p_next_graph),updated_by=p_actor_id,updated_at=stamp where org_id=page.org_id;
  note:=next_item;graph:=p_next_graph;
 end if;
 if not replayed and action in('set_scope','write') then
  update public.organization_workspace_pages set revision=revision+1,updated_at=stamp,last_operation_id=null,last_operation_actor=null,last_operation_hash=null where id=p_page_id returning * into page;
  insert into public.workspace_page_note_receipts(page_id,org_id,operation_id,actor_id,command_hash,action,particle_id,result_page_revision,result_note_revision)
   values(p_page_id,page.org_id,operation,p_actor_id,p_hash,action,particle,page.revision,(note->>'revision')::bigint);
 end if;
 return jsonb_build_object('pageId',p_page_id,'pageRevision',page.revision,'canManage',can_manage,'replayed',replayed,'notes',listing,
  'note',case when action in('read','review_scope','write') then jsonb_build_object('id',note->>'id','title',(select value->>'title' from jsonb_array_elements(page.guest_snapshot->'items') where value->>'id'=particle::text),
   'revision',(note->>'revision')::bigint,'content',note#>>'{data,widget,source,content}')||case when note#>'{data,widget,source,html}' is null then '{}'::jsonb else jsonb_build_object('html',note#>>'{data,widget,source,html}') end else null end,
  'graph',case when action='read' then graph else null end);
end $$;
revoke all on function public.workspace_page_note_command(uuid,uuid,jsonb,text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.workspace_page_note_command(uuid,uuid,jsonb,text,jsonb,jsonb) to service_role;
commit;
