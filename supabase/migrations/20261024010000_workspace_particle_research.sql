-- Reuse plan credits/recovery for particle research. No AI activation or grants to users.
create function public.reserve_workspace_ai_research_run(p_id uuid,p_org_id uuid,p_actor_id uuid,p_hash text,p_target jsonb,p_prompt text,p_tariff jsonb,p_max_credits integer,p_max_cost integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; board jsonb; canvas jsonb; objective jsonb;
begin
  if not public.can_use_workspace_ai(p_org_id,p_actor_id) then raise exception 'AI access denied' using errcode='42501'; end if;
  if p_target->>'kind' is distinct from 'particle_research' or p_target->>'organizationId' is distinct from p_org_id::text or p_target->>'userId' is distinct from p_actor_id::text then raise exception 'Invalid research scope'; end if;
  select state into board from public.organization_workspace_boards where org_id=p_org_id;
  canvas:=board;
  if p_target->>'canvasId' is not null then
    select e->'state' into canvas from jsonb_array_elements(coalesce(board->'workspaceCatalog'->'entries','[]')) e where e->>'id'=p_target->>'canvasId';
  elsif coalesce((board->'workspaceCatalog'->>'defaultDeleted')::boolean,false) then
    raise exception 'Workspace not found';
  end if;
  select p into objective from jsonb_array_elements(coalesce(canvas->'particleGraph'->'particles','[]')) p where p->>'id'=p_target->>'objectiveId' and p->>'type'='objective';
  if objective is null or objective->>'revision' is distinct from p_target->>'revision' then raise exception 'Objective changed' using errcode='40001'; end if;
  result:=public.reserve_workspace_ai_run(p_id,p_org_id,p_actor_id,p_hash,p_target,p_prompt,p_tariff,p_max_credits,p_max_cost);
  if (result->>'created')::boolean then update public.workspace_ai_runs set task='plan' where id=p_id;
  elsif result->'run'->>'task' is distinct from 'plan' then raise exception 'AI request identity conflict'; end if;
  return jsonb_build_object('created',result->'created','run',(select to_jsonb(r) from public.workspace_ai_runs r where id=p_id));
end $$;
create table public.workspace_ai_research_calls (
  run_id uuid not null references public.workspace_ai_runs(id) on delete restrict,
  response_id text not null check(length(response_id) between 1 and 200),
  created_at timestamptz not null default clock_timestamp(),
  primary key(run_id,response_id)
);
alter table public.workspace_ai_research_calls enable row level security;
alter table public.workspace_ai_research_calls force row level security;
revoke all on public.workspace_ai_research_calls from public,anon,authenticated;
create function public.correlate_workspace_ai_research_response(p_id uuid,p_response_id text)
returns void language plpgsql security definer set search_path='' as $$
declare run public.workspace_ai_runs;
begin
  select * into run from public.workspace_ai_runs where id=p_id for update;
  if not found or run.target->>'kind' is distinct from 'particle_research' or run.status <> 'running' then raise exception 'Research request is not running'; end if;
  if exists(select 1 from public.workspace_ai_research_calls where run_id=p_id and response_id=p_response_id) then return; end if;
  if (select count(*) from public.workspace_ai_research_calls where run_id=p_id)>=3 then raise exception 'Research call budget exhausted'; end if;
  insert into public.workspace_ai_research_calls(run_id,response_id) values(p_id,p_response_id);
  update public.workspace_ai_runs set provider_response_id=p_response_id where id=p_id;
end $$;
revoke all on function public.reserve_workspace_ai_research_run(uuid,uuid,uuid,text,jsonb,text,jsonb,integer,integer), public.correlate_workspace_ai_research_response(uuid,text) from public,anon,authenticated;
grant execute on function public.reserve_workspace_ai_research_run(uuid,uuid,uuid,text,jsonb,text,jsonb,integer,integer), public.correlate_workspace_ai_research_response(uuid,text) to service_role;
