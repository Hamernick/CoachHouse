-- An explicit, current page-note grant authorizes one validated note delta,
-- never general membership, canvas access, or a caller-controlled bypass flag.
begin;
create table public.workspace_page_note_write_context (
 backend_pid integer not null,transaction_id bigint not null,org_id uuid not null,actor_id uuid not null,
 before_state jsonb not null,after_state jsonb not null,
 primary key(backend_pid,transaction_id,org_id)
);
alter table public.workspace_page_note_write_context enable row level security;
revoke all on public.workspace_page_note_write_context from public,anon,authenticated,service_role;
comment on table public.workspace_page_note_write_context is
 'Private transaction-local proof of an exact delta already validated by workspace_page_note_command. Removed before success; rollback removes failed attempts.';

do $$
declare target regprocedure; previous text; replacement text; definition text;
begin
 for target,previous,replacement in select * from (values
 ('public.workspace_page_note_command(uuid,uuid,jsonb,text,jsonb,jsonb)'::regprocedure,
  'allowed:=array[''action'']',
  'if auth.role() is distinct from ''service_role'' or p_actor_id is null
   or p_actor_id is distinct from public.organization_activity_actor_id() then
   raise exception ''Verified note actor required.'' using errcode=''42501'';end if;
 allowed:=array[''action'']'),
 ('public.workspace_page_note_command(uuid,uuid,jsonb,text,jsonb,jsonb)'::regprocedure,
  'update public.organization_workspace_boards set state=jsonb_set(board,graph_path,p_next_graph),updated_by=p_actor_id,updated_at=stamp where org_id=page.org_id;',
  '-- Only this RPC can mint proof, after current invitation/scope locks and
  -- exact single-note/CAS validation. Other source and closure triggers still run.
  insert into public.workspace_page_note_write_context(backend_pid,transaction_id,org_id,actor_id,before_state,after_state)
   values(pg_backend_pid(),txid_current(),page.org_id,p_actor_id,board,jsonb_set(board,graph_path,p_next_graph));
  update public.organization_workspace_boards set state=jsonb_set(board,graph_path,p_next_graph),updated_by=p_actor_id,updated_at=stamp where org_id=page.org_id;
  delete from public.workspace_page_note_write_context where backend_pid=pg_backend_pid() and transaction_id=txid_current() and org_id=page.org_id;'),
 ('public.guard_workspace_canvas_write()'::regprocedure,
  'actor:=public.organization_activity_actor_id();',
  'actor:=public.organization_activity_actor_id();
 if tg_op=''UPDATE'' and new.org_id=old.org_id and auth.role()=''service_role''
  and current_setting(''transaction_isolation'')=''read committed''
  and exists(select 1 from public.workspace_page_note_write_context c
   where c.backend_pid=pg_backend_pid() and c.transaction_id=txid_current()
    and c.org_id=old.org_id and c.actor_id=actor and new.updated_by=actor
    and c.before_state=old.state and c.after_state=new.state) then return new;end if;')
 ) as boundaries(target,previous,replacement) loop
  definition:=pg_get_functiondef(target);
  if (length(definition)-length(replace(definition,previous,'')))/length(previous)<>1 then
   raise exception 'Expected one guest note canvas boundary: %',target;end if;
  execute replace(definition,previous,replacement);
 end loop;
end $$;
commit;
