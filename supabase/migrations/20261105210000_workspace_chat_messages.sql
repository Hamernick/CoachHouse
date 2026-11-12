-- Message history belongs to the existing private run owner. Capture it in the
-- same transaction as admission/settlement, including disconnected/recovered runs.
begin;
alter table public.workspace_ai_runs add column conversation_messages jsonb;

create function public.workspace_research_message_snapshot(r public.workspace_ai_runs)
returns jsonb language plpgsql immutable set search_path='' as $$
declare messages jsonb:='[]'; result jsonb;
begin
  if not (r.target ? 'conversation') then return null; end if;
  if r.prompt is not null then
    messages:=jsonb_build_array(jsonb_build_object('id',r.id::text||':user','role','user',
      'parts',jsonb_build_array(jsonb_build_object('type','text','text',r.prompt))));
  end if;
  if r.status='succeeded' and r.proposal is not null then
    begin result:=r.proposal::jsonb; exception when invalid_text_representation then result:=null; end;
    if jsonb_typeof(result->'summary')='string' and jsonb_typeof(result->'title')='string' then
      messages:=messages||jsonb_build_array(jsonb_build_object('id',r.id::text||':assistant','role','assistant',
        'parts',jsonb_build_array(jsonb_build_object('type','text','text',result->>'summary'),
          jsonb_build_object('type','data-plan','data',jsonb_build_object('runId',r.id,'title',result->>'title')))));
    end if;
  end if;
  return messages;
end $$;
revoke all on function public.workspace_research_message_snapshot(public.workspace_ai_runs) from public,anon,authenticated,service_role;

create function public.capture_workspace_research_messages() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  -- Recompute from server-owned records only. Retirement/redaction of source
  -- ledger text also removes its message copy; callers cannot inject messages.
  new.conversation_messages:=public.workspace_research_message_snapshot(new);
  return new;
end $$;
create trigger workspace_research_messages before insert or update on public.workspace_ai_runs
  for each row execute function public.capture_workspace_research_messages();
revoke all on function public.capture_workspace_research_messages() from public,anon,authenticated,service_role;
-- Preserve only actual recorded prompts/summaries/references, never invented replies.
update public.workspace_ai_runs set conversation_messages=public.workspace_research_message_snapshot(workspace_ai_runs)
  where target ? 'conversation';

create or replace function public.guard_workspace_research_conversation() returns trigger
language plpgsql security definer set search_path='' as $$
declare c jsonb:=new.target->'conversation'; p public.workspace_ai_runs; d public.workspace_research_drafts;
  board jsonb; canvas jsonb; objective jsonb; plan jsonb; origin jsonb; applied boolean:=false;
begin
  if c is null then return new; end if;
  if new.target->>'kind' is distinct from 'particle_research'
    or new.target->>'userId' is distinct from new.actor_id::text
    or new.target->>'organizationId' is distinct from new.org_id::text
    or jsonb_typeof(c) is distinct from 'object'
    or not (c ?& array['id','parentId','turn','draftRevision'])
    or jsonb_typeof(c->'id') is distinct from 'string'
    or jsonb_typeof(c->'turn') is distinct from 'number'
    or jsonb_typeof(c->'draftRevision') is distinct from 'number'
    or (c->>'turn')::integer < 1
    or (c->>'draftRevision')::integer < 0 then raise exception 'Invalid conversation'; end if;
  if c->>'parentId' is null then
    if new.target->>'mode' is distinct from 'new_objective' or c->>'id' is distinct from new.id::text or c->>'turn'<>'1' or c->>'draftRevision'<>'0' then raise exception 'Invalid conversation root'; end if;
  else
    -- The same parent lock also guards draft saves/Apply. Exactly one turn wins.
    select * into p from public.workspace_ai_runs where id=(c->>'parentId')::uuid for update;
    if p.id is null or p.org_id<>new.org_id or p.actor_id<>new.actor_id
      or p.target->'conversation'->>'id' is distinct from c->>'id'
      or (p.target->'conversation'->>'turn')::integer+1<>(c->>'turn')::integer
      or p.target->'canvasId' is distinct from new.target->'canvasId'
      or p.status not in ('succeeded','failed','canceled') then raise exception 'Conversation changed' using errcode='40001'; end if;
    if new.target ? 'plan' then
      select state into board from public.organization_workspace_boards where org_id=new.org_id;
      canvas:=board;
      if new.target->>'canvasId' is not null then
        select e->'state' into canvas from jsonb_array_elements(coalesce(board->'workspaceCatalog'->'entries','[]')) e where e->>'id'=new.target->>'canvasId';
      end if;
      select e into objective from jsonb_array_elements(coalesce(canvas->'particleGraph'->'particles','[]')) e
        where e->>'id'=new.target->>'objectiveId' and e->>'type'='objective';
      select e into plan from jsonb_array_elements(coalesce(objective->'data'->'planning'->'plans','[]')) e
        where e->>'id'=new.target->'plan'->>'id';
      select e into origin from jsonb_array_elements(coalesce(objective->'data'->'planning'->'proposals','[]')) e
        where e->>'researchRunId'=p.id::text;
      if new.target ? 'mode' or plan is null or objective->'revision' is distinct from new.target->'revision'
        or plan->'revision' is distinct from new.target->'plan'->'revision' then
        raise exception 'Saved plan changed' using errcode='40001';
      end if;
      applied:=p.status='succeeded' and ((origin->>'status'='accepted' and origin->>'planId'=plan->>'id')
        or (origin is null and plan->>'researchRunId'=p.id::text));
    end if;
    if not coalesce(applied,false) and (
      p.target->'mode' is distinct from new.target->'mode' or p.target->'objectiveId' is distinct from new.target->'objectiveId'
      or p.target->'plan' is distinct from new.target->'plan' or p.target->'revision' is distinct from new.target->'revision') then
      raise exception 'Conversation target changed' using errcode='40001';
    end if;
    select * into d from public.workspace_research_drafts where run_id=p.id;
    if (coalesce(d.attempted,false) and not coalesce(applied,false)) or coalesce(d.revision,0)<>(c->>'draftRevision')::integer then
      raise exception 'Conversation draft changed' using errcode='40001';
    end if;
  end if;
  return new;
end $$;


-- Keyset pages are independent of the bounded model context. The old four-arg
-- list remains compatible for Recents; this reader only returns scoped metadata.
create function public.page_workspace_research_conversation(p_org_id uuid,p_actor_id uuid,p_canvas_id text,p_root_id uuid,p_before_turn integer default null,p_for_context boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if not public.can_read_workspace_ai(p_org_id,p_actor_id) then raise exception 'AI access denied' using errcode='42501'; end if;
  if p_root_id is null or (p_before_turn is not null and p_before_turn<1) then raise exception 'Invalid chat page'; end if;
  if (public.manage_workspace_research_conversation(p_org_id,p_actor_id,p_canvas_id,p_root_id,'read')->>'deleted')::boolean then
    raise exception 'Chat deleted' using errcode='42501';
  end if;
  return (with scoped as (
    select run.id,run.target->'conversation'->>'id' as "rootId",(run.target->'conversation'->>'turn')::integer as turn,
      run.created_at as "createdAt",run.status
    from public.workspace_ai_runs run
    where run.org_id=p_org_id and run.actor_id=p_actor_id and run.task='plan'
      and run.target->>'kind'='particle_research' and run.target->>'userId'=p_actor_id::text
      and run.target->>'organizationId'=p_org_id::text
      and run.target->'conversation'->>'id'=p_root_id::text
      and (run.target->>'canvasId') is not distinct from p_canvas_id
      and (p_before_turn is null or (run.target->'conversation'->>'turn')::integer<p_before_turn)
  ), picked as (
    select * from scoped where not p_for_context
      or turn>(select max(turn)-4 from scoped)
      or id=(select id from scoped where status='succeeded' order by turn desc limit 1)
    order by turn desc limit 12
  ) select coalesce(jsonb_agg(to_jsonb(r) order by r.turn),'[]'::jsonb) from picked r);
end $$;
revoke all on function public.page_workspace_research_conversation(uuid,uuid,text,uuid,integer,boolean) from public,anon,authenticated;
grant execute on function public.page_workspace_research_conversation(uuid,uuid,text,uuid,integer,boolean) to service_role;
commit;
