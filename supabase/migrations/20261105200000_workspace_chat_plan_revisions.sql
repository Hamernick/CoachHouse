-- Extend an existing private chat to revisions of its own accepted plan.
-- Existing review, run locks, exact revisions, actor/canvas scope and dedupe remain authoritative.
begin;
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
    or (c->>'turn')::integer not between 1 and 12
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

create or replace function public.list_workspace_research_conversation(p_org_id uuid,p_actor_id uuid,p_canvas_id text,p_root_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if not public.can_read_workspace_ai(p_org_id,p_actor_id) then raise exception 'AI access denied' using errcode='42501'; end if;
  return (select coalesce(jsonb_agg(to_jsonb(r) order by r."createdAt",r.turn),'[]'::jsonb) from (
    select run.id,run.target->'conversation'->>'id' as "rootId",(run.target->'conversation'->>'turn')::integer as turn,
      run.created_at as "createdAt",run.status,m.title as "customTitle",coalesce(m.pinned,false) as pinned,coalesce(m.revision,0) as "metadataRevision"
    from public.workspace_ai_runs run left join public.workspace_research_chats m on m.root_id=(run.target->'conversation'->>'id')::uuid
    where run.org_id=p_org_id and run.actor_id=p_actor_id and run.task='plan'
      and run.target->>'kind'='particle_research'
      and run.target->>'userId'=p_actor_id::text and run.target->>'organizationId'=p_org_id::text
      and run.target ? 'conversation' and run.target ? 'canvasId' and m.deleted_at is null
      and (run.target->>'canvasId') is not distinct from p_canvas_id
      and (p_root_id is null or run.target->'conversation'->>'id'=p_root_id::text)
      and (p_root_id is not null or not exists(select 1 from public.workspace_ai_runs child
        where child.org_id=p_org_id and child.actor_id=p_actor_id and child.target->'conversation'->>'parentId'=run.id::text))
    order by coalesce(m.pinned,false) desc,run.created_at desc,run.id desc limit 12
  ) r);
end $$;
commit;
