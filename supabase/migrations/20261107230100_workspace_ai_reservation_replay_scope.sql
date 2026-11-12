-- An existing run's authority comes from its stored target, not retry input.
begin;
do $$
declare target regprocedure:='public.reserve_workspace_ai_run(uuid,uuid,uuid,text,jsonb,text,jsonb,integer,integer)'::regprocedure;
 definition text; previous text; replacement text;
begin
 definition:=pg_get_functiondef(target);
 previous:=E'begin\n perform public.assert_workspace_ai_admission(p_org_id,p_actor_id,p_target);';
 replacement:='declare stored_target jsonb;
begin
 perform public.assert_workspace_ai_admission(p_org_id,p_actor_id,p_target);
 -- Admission holds the organization lock before this fresh stored-scope read.
 select target into stored_target from public.workspace_ai_runs
  where id=p_id and org_id=p_org_id and actor_id=p_actor_id;
 if found then
  perform public.assert_workspace_ai_admission(p_org_id,p_actor_id,stored_target);
 end if;';
 if (length(definition)-length(replace(definition,previous,'')))/length(previous)<>1 then
  raise exception 'Unexpected AI reservation replay body';end if;
 execute replace(definition,previous,replacement);
end $$;
commit;
