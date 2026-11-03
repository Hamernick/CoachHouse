-- Stale user revisions are permanent conflicts, not serialization failures.
-- Preserve genuine isolation/serialization errors and all existing authority.
begin;
do $$
declare definition text; previous text; target regprocedure; message text;
begin
 for target,message in select * from (values
  ('public.workspace_page_guest_command_before_closure(uuid,uuid,jsonb,text)'::regprocedure,'Page changed; reload before saving'),
  ('public.workspace_page_note_command(uuid,uuid,jsonb,text,jsonb,jsonb)'::regprocedure,'Reviewed source changed'),
  ('public.workspace_page_note_command(uuid,uuid,jsonb,text,jsonb,jsonb)'::regprocedure,'Note changed; reload before saving')
 ) as conflicts(target,message) loop
  definition:=pg_get_functiondef(target);
  previous:=format('raise exception %L using errcode=''40001''',message);
  if (length(definition)-length(replace(definition,previous,'')))/length(previous)<>1 then
   raise exception 'Expected one sharing business boundary: %',message;
  end if;
  execute replace(definition,previous,replace(previous,'''40001''','''PT409'''));
 end loop;
end $$;
-- CREATE OR REPLACE retains function ownership and ACLs; no new RPC grants.
commit;
