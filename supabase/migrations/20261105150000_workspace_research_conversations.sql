-- Private conversations reuse the immutable run ledger. No new credit pool or
-- authority is created; admission and its budget reservation remain one transaction.
begin;
create unique index workspace_research_conversation_turn on public.workspace_ai_runs
  (org_id,actor_id,(target->'conversation'->>'id'),((target->'conversation'->>'turn')::integer))
  where target ? 'conversation';

create function public.guard_workspace_research_conversation() returns trigger
language plpgsql security definer set search_path='' as $$
declare c jsonb:=new.target->'conversation'; p public.workspace_ai_runs; d public.workspace_research_drafts;
begin
  if c is null then return new; end if;
  if new.target->>'mode' is distinct from 'new_objective'
    or new.target->>'kind' is distinct from 'particle_research'
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
    if c->>'id' is distinct from new.id::text or c->>'turn'<>'1' or c->>'draftRevision'<>'0' then raise exception 'Invalid conversation root'; end if;
  else
    -- The same parent lock also guards draft saves/Apply. Exactly one turn wins.
    select * into p from public.workspace_ai_runs where id=(c->>'parentId')::uuid for update;
    if p.id is null or p.org_id<>new.org_id or p.actor_id<>new.actor_id
      or p.target->>'mode' is distinct from 'new_objective'
      or p.target->'conversation'->>'id' is distinct from c->>'id'
      or (p.target->'conversation'->>'turn')::integer+1<>(c->>'turn')::integer
      or p.target->'canvasId' is distinct from new.target->'canvasId'
      or p.target->'revision' is distinct from new.target->'revision'
      or p.status not in ('succeeded','failed','canceled') then raise exception 'Conversation changed' using errcode='40001'; end if;
    select * into d from public.workspace_research_drafts where run_id=p.id;
    if coalesce(d.attempted,false) or coalesce(d.revision,0)<>(c->>'draftRevision')::integer then
      raise exception 'Conversation draft changed' using errcode='40001';
    end if;
  end if;
  return new;
end $$;
create trigger workspace_research_conversation_guard before insert on public.workspace_ai_runs
  for each row execute function public.guard_workspace_research_conversation();
revoke all on function public.guard_workspace_research_conversation() from public,anon,authenticated,service_role;

-- A superseded draft cannot be edited or applied by a stale tab. This runs under
-- the run lock already acquired by access_workspace_research_draft.
create function public.guard_superseded_research_draft() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from public.workspace_ai_runs where target->'conversation'->>'parentId'=new.run_id::text) then
    raise exception 'Conversation advanced. Reopen its latest draft.' using errcode='40001';
  end if;
  return new;
end $$;
create trigger workspace_research_draft_conversation_guard before insert or update on public.workspace_research_drafts
  for each row execute function public.guard_superseded_research_draft();
revoke all on function public.guard_superseded_research_draft() from public,anon,authenticated,service_role;

create function public.list_workspace_research_conversation(p_org_id uuid,p_actor_id uuid,p_canvas_id text,p_root_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if not public.can_read_workspace_ai(p_org_id,p_actor_id) then raise exception 'AI access denied' using errcode='42501'; end if;
  return (select coalesce(jsonb_agg(to_jsonb(r) order by r."createdAt",r.turn),'[]'::jsonb) from (
    select id,target->'conversation'->>'id' as "rootId",(target->'conversation'->>'turn')::integer as turn,
      created_at as "createdAt",status
    from public.workspace_ai_runs
    where org_id=p_org_id and actor_id=p_actor_id and task='plan'
      and target->>'kind'='particle_research' and target->>'mode'='new_objective'
      and target->>'userId'=p_actor_id::text and target->>'organizationId'=p_org_id::text
      and target ? 'conversation' and target ? 'canvasId'
      and (target->>'canvasId') is not distinct from p_canvas_id
      and (p_root_id is null or target->'conversation'->>'id'=p_root_id::text)
      and (p_root_id is not null or not exists(select 1 from public.workspace_ai_runs child
        where child.org_id=p_org_id and child.actor_id=p_actor_id and child.target->'conversation'->>'parentId'=workspace_ai_runs.id::text))
    order by created_at desc,id desc limit 12
  ) r);
end $$;
revoke all on function public.list_workspace_research_conversation(uuid,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.list_workspace_research_conversation(uuid,uuid,text,uuid) to service_role;
commit;
