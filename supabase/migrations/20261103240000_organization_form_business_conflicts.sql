-- Business revision conflicts must reach the caller, not enter PostgREST's
-- automatic serialization retry loop. Genuine serialization errors stay40001.
begin;
do $$
declare target regprocedure; definition text; previous text; replacement text; entry record;
begin
 for entry in select * from (values
  ('public.organization_form_source_command_before_closure(uuid,jsonb)',
   'if token is distinct from p_command->>''expectedRevision'' then raise exception ''Form changed'' using errcode=''40001''; end if;'),
  ('public.organization_form_intake_before_closure(uuid,jsonb)',
   'if r.revision is distinct from (p_command->>''expectedRevision'')::integer then raise exception ''Response changed'' using errcode=''40001''; end if;')
 ) as changes(signature,statement) loop
  target:=entry.signature::regprocedure;
  definition:=pg_get_functiondef(target); previous:=entry.statement;
  -- Refuse unknown function drift rather than replacing unrelated exceptions.
  if (length(definition)-length(replace(definition,previous,'')))/length(previous)<>1 then
   raise exception 'Expected one business conflict boundary in %',entry.signature;
  end if;
  replacement:=replace(previous,'''40001''','''PT409''');
  execute replace(definition,previous,replacement);
 end loop;
end $$;
-- CREATE OR REPLACE retains owners and ACLs. No new RPC or lifecycle grants.
commit;
