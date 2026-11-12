-- Authorize new work and reservation replay before touching the credit ledger.
-- Cancellation and actorless accounting retain their existing lifecycle rules.
begin;
create function public.assert_workspace_ai_admission(p_org uuid,p_actor uuid,p_target jsonb)
returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.role() is distinct from 'service_role' or p_actor is null
  or p_actor is distinct from public.organization_activity_actor_id()
  or current_setting('transaction_isolation')<>'read committed' then
  raise exception 'AI access denied' using errcode='42501';end if;
 perform 1 from public.organizations where user_id=p_org for share;
 if not public.can_use_workspace_ai(p_org,p_actor) then
  raise exception 'AI access denied' using errcode='42501';end if;
 if p_target->>'kind'='particle_research' then
  if not (p_target ? 'canvasId') or jsonb_typeof(p_target->'canvasId') not in ('string','null') then
   raise exception 'AI access denied' using errcode='42501';end if;
  perform public.assert_workspace_chat_canvas(p_org,p_actor,p_target->>'canvasId');
 end if;
end $$;
revoke all on function public.assert_workspace_ai_admission(uuid,uuid,jsonb) from public,anon,authenticated,service_role;

-- Guard each public reservation entry point before scope reads or ledger locks.
-- The original implementations retain scope validation, identity and budget rules.
do $$
declare target regprocedure; definition text; previous text; replacement text;
begin
 for target in select unnest(array[
  'public.reserve_workspace_ai_run(uuid,uuid,uuid,text,jsonb,text,jsonb,integer,integer)'::regprocedure,
  'public.reserve_workspace_ai_research_run(uuid,uuid,uuid,text,jsonb,text,jsonb,integer,integer)'::regprocedure,
  'public.reserve_workspace_ai_plan_run(uuid,uuid,uuid,text,jsonb,text,jsonb,integer,integer)'::regprocedure
 ]) loop
  definition:=pg_get_functiondef(target);previous:=E'begin\n';
  replacement:=E'begin\n perform public.assert_workspace_ai_admission(p_org_id,p_actor_id,p_target);\n';
  if (length(definition)-length(replace(definition,previous,'')))/length(previous)<>1 then
   raise exception 'Unexpected AI reservation body: %',target;end if;
  execute replace(definition,previous,replacement);
 end loop;

 target:='public.claim_workspace_ai_run(uuid,uuid)'::regprocedure;
 definition:=pg_get_functiondef(target);previous:=E'begin\n  update public.workspace_ai_runs';
 replacement:='declare scope_org uuid; scope_target jsonb;
begin
  if auth.role() is distinct from ''service_role'' or p_actor_id is null
    or p_actor_id is distinct from public.organization_activity_actor_id()
    or current_setting(''transaction_isolation'')<>''read committed'' then
    raise exception ''AI access denied'' using errcode=''42501'';end if;
  select org_id into scope_org from public.workspace_ai_runs where id=p_id and actor_id=p_actor_id;
  if not found then return false;end if;
  -- Lock organization before run; reread scope after any audience lock wait.
  perform 1 from public.organizations where user_id=scope_org for share;
  select target into scope_target from public.workspace_ai_runs where id=p_id and actor_id=p_actor_id and org_id=scope_org;
  if not found then return false;end if;
  begin
    perform public.assert_workspace_ai_admission(scope_org,p_actor_id,scope_target);
  exception when insufficient_privilege then
    -- No dispatch occurred. Existing callers settle a false claim as canceled.
    return false;
  end;
  update public.workspace_ai_runs';
 if (length(definition)-length(replace(definition,previous,'')))/length(previous)<>1 then
  raise exception 'Unexpected AI claim body';end if;
 execute replace(definition,previous,replacement);

 target:='public.cancel_workspace_ai_run(uuid,uuid,uuid)'::regprocedure;
 definition:=pg_get_functiondef(target);previous:=E'begin\n';
 replacement:='begin
  if auth.role() is distinct from ''service_role'' or p_actor_id is null
    or p_actor_id is distinct from public.organization_activity_actor_id() then
    raise exception ''AI access denied'' using errcode=''42501'';end if;
  -- Stop-only command: canvas revocation must not prevent stopping owned work.
';
 if (length(definition)-length(replace(definition,previous,'')))/length(previous)<>1 then
  raise exception 'Unexpected AI cancellation body';end if;
 execute replace(definition,previous,replacement);
end $$;
commit;
