-- Private draft recovery follows the stored run's current canvas audience.
-- Preserve closure admission, CAS, attempted-payload pinning and exact retries.
begin;
do $$
declare target regprocedure := 'public.access_workspace_research_draft_before_read_closure(uuid,uuid,uuid,text,uuid,integer,jsonb,boolean)'::regprocedure;
 definition text; previous text; replacement text;
begin
 definition:=pg_get_functiondef(target);
 previous:='begin
  if p_org_id is null';
 replacement:='begin
  if auth.role() is distinct from ''service_role'' or p_actor_id is null
    or p_actor_id is distinct from public.organization_activity_actor_id()
    or current_setting(''transaction_isolation'')<>''read committed'' then
    raise exception ''Draft access denied'' using errcode=''42501'';
  end if;
  -- Audience changes lock the organization first; never wait holding a run lock.
  perform 1 from public.organizations where user_id=p_org_id for share;
  if p_org_id is null';
 if (length(definition)-length(replace(definition,previous,'')))/length(previous)<>1 then
  raise exception 'Unexpected draft admission body';end if;
 definition:=replace(definition,previous,replacement);
 previous:='  if p_base is null or p_base';
 replacement:='  if not (r.target ? ''canvasId'') or jsonb_typeof(r.target->''canvasId'') not in (''string'',''null'') then
    raise exception ''Draft access denied'' using errcode=''42501'';
  end if;
  -- Personal unsaved edits require View; applying them still requires canonical
  -- write authority. Check before both reads and identical edit-id replay.
  perform public.assert_workspace_chat_canvas(p_org_id,p_actor_id,r.target->>''canvasId'');
  if p_base is null or p_base';
 if (length(definition)-length(replace(definition,previous,'')))/length(previous)<>1 then
  raise exception 'Unexpected draft checkpoint body';end if;
 execute replace(definition,previous,replacement);
end $$;
commit;
