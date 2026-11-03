-- Permanent business conflicts must not enter PostgREST serialization retries.
-- Keep genuine serialization, isolation and temporary lock outcomes unchanged.
begin;
do $$
declare definition text; previous text; message text;
begin
 definition:=pg_get_functiondef('public.workspace_data_view_command_nonresponse(jsonb)'::regprocedure);
 foreach message in array array['Request identity reused','View already exists','View changed','Project changed or unavailable','Row changed'] loop
  previous:=format('raise exception %L using errcode=''40001''',message);
  if (length(definition)-length(replace(definition,previous,'')))/length(previous)<>1 then
   raise exception 'Expected one data view business boundary: %',message;
  end if;
  definition:=replace(definition,previous,replace(previous,'''40001''','''PT409'''));
 end loop;
 execute definition;
end $$;
-- Keep native-response/linked-sheet wrappers and the private implementation ACL.
commit;
