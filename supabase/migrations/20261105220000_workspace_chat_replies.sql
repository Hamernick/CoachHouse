-- Read-only conversation outcomes use the existing private run and credit ledger.
begin;
create or replace function public.workspace_research_message_snapshot(r public.workspace_ai_runs)
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
          case when result->>'responseKind' in ('answer','clarify') then
            jsonb_build_object('type','data-reply','data',jsonb_build_object('runId',r.id,'title',result->>'title','kind',result->>'responseKind'))
          else jsonb_build_object('type','data-plan','data',jsonb_build_object('runId',r.id,'title',result->>'title')) end)));
    end if;
  end if;
  return messages;
end $$;
revoke all on function public.workspace_research_message_snapshot(public.workspace_ai_runs) from public,anon,authenticated,service_role;

create or replace function public.page_workspace_research_conversation(p_org_id uuid,p_actor_id uuid,p_canvas_id text,p_root_id uuid,p_before_turn integer default null,p_for_context boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if not public.can_read_workspace_ai(p_org_id,p_actor_id) then raise exception 'AI access denied' using errcode='42501'; end if;
  if p_root_id is null or (p_before_turn is not null and p_before_turn<1) then raise exception 'Invalid chat page'; end if;
  if (public.manage_workspace_research_conversation(p_org_id,p_actor_id,p_canvas_id,p_root_id,'read')->>'deleted')::boolean then
    raise exception 'Chat deleted' using errcode='42501';
  end if;
  return (with scoped as (
    select run.id,run.target->'conversation'->>'id' as "rootId",(run.target->'conversation'->>'turn')::integer as turn,
      run.created_at as "createdAt",run.status,
      coalesce(run.conversation_messages->1->'parts'->1->'data'->>'kind','proposal') as "responseKind"
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
      or id=(select id from scoped where status='succeeded' and "responseKind"='proposal' order by turn desc limit 1)
    order by turn desc limit 12
  ) select coalesce(jsonb_agg(to_jsonb(r) order by r.turn),'[]'::jsonb) from picked r);
end $$;
revoke all on function public.page_workspace_research_conversation(uuid,uuid,text,uuid,integer,boolean) from public,anon,authenticated;
grant execute on function public.page_workspace_research_conversation(uuid,uuid,text,uuid,integer,boolean) to service_role;
-- Read-only replies never enter the editable-artifact lifecycle, including direct RPC writes.
create function public.guard_workspace_reply_draft() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from public.workspace_ai_runs r where r.id=new.run_id
    and r.conversation_messages->1->'parts'->1->>'type'='data-reply') then
    raise exception 'Chat replies have no editable plan draft' using errcode='42501';
  end if;
  return new;
end $$;
create trigger workspace_reply_draft before insert or update on public.workspace_research_drafts
  for each row execute function public.guard_workspace_reply_draft();
revoke all on function public.guard_workspace_reply_draft() from public,anon,authenticated,service_role;
commit;
