-- Personal chat metadata and history require current canvas View authority.
-- The organization lock orders chat writes against audience/membership changes.
-- This does not authorize provider work or mutate credit/settlement policy.
begin;
create function public.assert_workspace_chat_canvas(p_org uuid,p_actor uuid,p_canvas text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.role() is distinct from 'service_role' or p_actor is null
  or p_actor is distinct from public.organization_activity_actor_id() then
  raise exception 'Verified chat actor required.' using errcode='42501';end if;
 if p_canvas is not null and p_canvas !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
  raise exception 'Chat unavailable.' using errcode='42501';end if;
 -- Acquire before any chat/run lock, matching audience revocation's org-first order.
 perform 1 from public.organizations where user_id=p_org for share;
 if not public.can_read_workspace_ai(p_org,p_actor)
  or not public.workspace_canvas_actor_can(p_org,coalesce(p_canvas,'default'),p_actor,'view') then
  raise exception 'Chat unavailable.' using errcode='42501';end if;
end $$;
revoke all on function public.assert_workspace_chat_canvas(uuid,uuid,text) from public,anon,authenticated,service_role;

-- Preserve existing revision, deletion, pagination, replay and lifecycle logic.
-- Exact replacements fail atomically if an upstream body has drifted.
do $$
declare target regprocedure; previous text; replacement text; definition text;
begin
 for target,previous,replacement in select * from (values
 ('public.manage_workspace_research_conversation(uuid,uuid,text,uuid,text,bigint,text,boolean)'::regprocedure,
  'if not public.can_read_workspace_ai(p_org_id,p_actor_id) then raise exception ''Chat access denied'' using errcode=''42501''; end if;',
  'perform public.assert_workspace_chat_canvas(p_org_id,p_actor_id,p_canvas_id);'),
 ('public.list_workspace_research_conversation(uuid,uuid,text,uuid)'::regprocedure,
  'if not public.can_read_workspace_ai(p_org_id,p_actor_id) then raise exception ''AI access denied'' using errcode=''42501''; end if;',
  'perform public.assert_workspace_chat_canvas(p_org_id,p_actor_id,p_canvas_id);'),
 ('public.page_workspace_research_conversation(uuid,uuid,text,uuid,integer,boolean)'::regprocedure,
  'if not public.can_read_workspace_ai(p_org_id,p_actor_id) then raise exception ''AI access denied'' using errcode=''42501''; end if;',
  'perform public.assert_workspace_chat_canvas(p_org_id,p_actor_id,p_canvas_id);'),
 ('public.list_workspace_research_runs(uuid,uuid,uuid,text,uuid)'::regprocedure,
  'if not public.can_read_workspace_ai(p_org_id,p_actor_id) then
    raise exception ''AI access denied'' using errcode=''42501'';
  end if;',
  'perform public.assert_workspace_chat_canvas(p_org_id,p_actor_id,p_canvas_id);'),
 ('public.read_workspace_ai_run(uuid,uuid,uuid)'::regprocedure,
  'perform public.recover_workspace_ai_runs(p_org_id);',
  'if auth.role() is distinct from ''service_role'' or p_actor_id is null
    or p_actor_id is distinct from public.organization_activity_actor_id() then
    raise exception ''Verified chat actor required.'' using errcode=''42501'';end if;
  -- Scope comes from the stored run, never from a caller-selected canvas.
  if exists(select 1 from public.workspace_ai_runs r where r.id=p_id and r.org_id=p_org_id
    and r.actor_id=p_actor_id and r.target->>''kind''=''particle_research'') then
    if exists(select 1 from public.workspace_ai_runs r where r.id=p_id and
      (not (r.target ? ''canvasId'') or jsonb_typeof(r.target->''canvasId'') not in (''string'',''null''))) then
      raise exception ''Chat unavailable.'' using errcode=''42501'';end if;
    perform public.assert_workspace_chat_canvas(p_org_id,p_actor_id,
      (select r.target->>''canvasId'' from public.workspace_ai_runs r where r.id=p_id));
  end if;
  perform public.recover_workspace_ai_runs(p_org_id);')
 ) as boundaries(target,previous,replacement) loop
  definition:=pg_get_functiondef(target);
  if (length(definition)-length(replace(definition,previous,'')))/length(previous)<>1 then
   raise exception 'Expected one chat canvas boundary: %',target;end if;
  execute replace(definition,previous,replacement);
 end loop;
end $$;
commit;
