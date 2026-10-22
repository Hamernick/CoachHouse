-- Additive, local-only until separately approved. Canonical titles/completion stay in objective_steps.
create unique index if not exists workspace_objective_org_identity on public.organization_workspace_objectives(org_id,id);
create unique index if not exists workspace_step_org_identity on public.organization_workspace_objective_steps(org_id,id);
create table public.workspace_objective_plans (
  id uuid primary key,
  org_id uuid not null,
  objective_id uuid not null,
  title text not null check (length(trim(title)) between 1 and 240),
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(org_id,id),
  foreign key(org_id,objective_id) references public.organization_workspace_objectives(org_id,id) on delete cascade
);
create table public.workspace_objective_plan_steps (
  org_id uuid not null,
  plan_id uuid not null,
  step_id uuid not null,
  position integer not null check(position >= 0),
  primary key(plan_id,step_id),
  unique(plan_id,position),
  foreign key(org_id,plan_id) references public.workspace_objective_plans(org_id,id) on delete cascade,
  foreign key(org_id,step_id) references public.organization_workspace_objective_steps(org_id,id) on delete cascade
);
create table public.workspace_objective_plan_edges (
  id uuid primary key,
  org_id uuid not null,
  plan_id uuid not null,
  source uuid not null,
  target uuid not null,
  label text not null default '' check(length(label) <= 120),
  check(source <> target),
  unique(plan_id,source,target,label),
  foreign key(org_id,plan_id) references public.workspace_objective_plans(org_id,id) on delete cascade,
  foreign key(org_id,source) references public.organization_workspace_objective_steps(org_id,id) on delete cascade,
  foreign key(org_id,target) references public.organization_workspace_objective_steps(org_id,id) on delete cascade
);
create index workspace_plan_steps_org on public.workspace_objective_plan_steps(org_id,step_id);
create index workspace_plan_edges_org on public.workspace_objective_plan_edges(org_id);
alter table public.workspace_objective_plans enable row level security;
alter table public.workspace_objective_plans force row level security;
alter table public.workspace_objective_plan_steps enable row level security;
alter table public.workspace_objective_plan_steps force row level security;
alter table public.workspace_objective_plan_edges enable row level security;
alter table public.workspace_objective_plan_edges force row level security;
-- Session access only through authenticated, scoped RPCs below. No direct table grants/policies.
revoke all on public.workspace_objective_plans, public.workspace_objective_plan_steps, public.workspace_objective_plan_edges from anon, authenticated;

create function public.read_workspace_objective_plans(p_org_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not (auth.uid() = p_org_id or exists (
    select 1 from public.organization_memberships where org_id=p_org_id and member_id=auth.uid()
  )) then raise exception 'Organization access required' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'id',p.id,'objectiveId',p.objective_id,'title',p.title,'revision',p.revision,
    'stepIds',coalesce((select jsonb_agg(s.step_id order by s.position) from public.workspace_objective_plan_steps s where s.plan_id=p.id),'[]'::jsonb),
    'edges',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'source',e.source,'target',e.target,'label',e.label) order by e.id)
      from public.workspace_objective_plan_edges e where e.plan_id=p.id),'[]'::jsonb)
  ) order by p.created_at,p.id) from public.workspace_objective_plans p where p.org_id=p_org_id),'[]'::jsonb);
end $$;

create function public.save_workspace_objective_plan(p_org_id uuid,p_draft jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := (p_draft->>'id')::uuid;
  v_objective uuid := (p_draft->>'objectiveId')::uuid;
  v_revision integer := (p_draft->>'revision')::integer;
  v_title text := trim(p_draft->>'title');
  v_plan public.workspace_objective_plans%rowtype;
  v_step public.organization_workspace_objective_steps%rowtype;
  v_item jsonb; v_edge jsonb; v_step_id uuid; v_position integer := 0; v_order integer;
begin
  if auth.uid() is null or not (auth.uid()=p_org_id or exists (
    select 1 from public.organization_memberships where org_id=p_org_id and member_id=auth.uid() and role in ('owner','admin','staff')
  )) then raise exception 'Organization edit access required' using errcode='42501'; end if;
  if v_id is null or v_objective is null or v_revision is null or v_revision < 0 or v_title is null or length(v_title) not between 1 and 240
    or jsonb_typeof(p_draft->'steps') is distinct from 'array' or jsonb_array_length(p_draft->'steps') > 80
    or jsonb_typeof(p_draft->'edges') is distinct from 'array' or jsonb_array_length(p_draft->'edges') > 160
    then raise exception 'Invalid plan'; end if;
  -- Serialize graph changes within this organization; canonical step updates additionally lock their rows.
  perform pg_advisory_xact_lock(hashtextextended('workspace-plans:'||p_org_id::text,0));
  if not exists(select 1 from public.organization_workspace_objectives where id=v_objective and org_id=p_org_id and kind='custom')
    then raise exception 'Use the source editor for this objective'; end if;
  select * into v_plan from public.workspace_objective_plans where id=v_id for update;
  if found then
    if v_plan.org_id <> p_org_id or v_plan.objective_id <> v_objective then raise exception 'Plan scope mismatch' using errcode='42501'; end if;
    if v_plan.revision <> v_revision then raise exception 'Plan changed. Refresh before editing again.' using errcode='40001'; end if;
    update public.workspace_objective_plans set title=v_title,revision=revision+1,updated_at=clock_timestamp() where id=v_id;
  else
    if v_revision <> 0 then raise exception 'Plan changed. Refresh before editing again.' using errcode='40001'; end if;
    insert into public.workspace_objective_plans(id,org_id,objective_id,title) values(v_id,p_org_id,v_objective,v_title);
  end if;
  -- Membership changes never delete canonical steps (which may appear in another plan).
  delete from public.workspace_objective_plan_steps where plan_id=v_id;
  delete from public.workspace_objective_plan_edges where plan_id=v_id;
  for v_item in select value from jsonb_array_elements(p_draft->'steps') loop
    v_step_id := (v_item->>'id')::uuid;
    if v_step_id is null or coalesce(length(trim(v_item->>'title')),0) not between 1 and 240
      or coalesce(v_item->>'status','') not in ('todo','in_progress','blocked','done') then raise exception 'Invalid plan step'; end if;
    select * into v_step from public.organization_workspace_objective_steps where id=v_step_id for update;
    if found then
      if v_step.org_id <> p_org_id or v_step.step_type <> 'custom' or not exists (
        select 1 from public.organization_workspace_objectives where id=v_step.objective_id and org_id=p_org_id and kind='custom'
      ) then raise exception 'Step scope mismatch' using errcode='42501'; end if;
      if v_step.updated_at is distinct from (v_item->>'expectedUpdatedAt')::timestamptz
        then raise exception 'A step changed. Refresh before editing again.' using errcode='40001'; end if;
      if v_step.title <> trim(v_item->>'title') or v_step.status <> v_item->>'status' then
        update public.organization_workspace_objective_steps set title=trim(v_item->>'title'),status=v_item->>'status',
          completed_at=case when v_item->>'status'='done' then coalesce(completed_at,clock_timestamp()) else null end
          where id=v_step_id;
      end if;
    else
      if v_item->>'expectedUpdatedAt' is not null then raise exception 'Step no longer exists' using errcode='40001'; end if;
      select coalesce(max(step_order),-1)+1 into v_order from public.organization_workspace_objective_steps where objective_id=v_objective;
      insert into public.organization_workspace_objective_steps(id,org_id,objective_id,step_order,step_type,title,status,completed_at)
        values(v_step_id,p_org_id,v_objective,v_order,'custom',trim(v_item->>'title'),v_item->>'status',case when v_item->>'status'='done' then clock_timestamp() else null end);
    end if;
    insert into public.workspace_objective_plan_steps(org_id,plan_id,step_id,position) values(p_org_id,v_id,v_step_id,v_position);
    v_position := v_position+1;
  end loop;
  for v_edge in select value from jsonb_array_elements(p_draft->'edges') loop
    if not exists(select 1 from public.workspace_objective_plan_steps where plan_id=v_id and step_id=(v_edge->>'source')::uuid)
      or not exists(select 1 from public.workspace_objective_plan_steps where org_id=p_org_id and step_id=(v_edge->>'target')::uuid)
      then raise exception 'Connections must reference saved plan steps'; end if;
    insert into public.workspace_objective_plan_edges(id,org_id,plan_id,source,target,label)
      values((v_edge->>'id')::uuid,p_org_id,v_id,(v_edge->>'source')::uuid,(v_edge->>'target')::uuid,coalesce(v_edge->>'label',''));
  end loop;
  -- Do not leave another plan pointing to a step removed from its last plan.
  if exists(select 1 from public.workspace_objective_plan_edges e where e.org_id=p_org_id and not exists (
    select 1 from public.workspace_objective_plan_steps s where s.org_id=p_org_id and s.step_id=e.target
  )) then raise exception 'This step is connected from another plan. Remove that connection first.'; end if;
  if exists(with recursive reach(source,target) as (
    select source,target from public.workspace_objective_plan_edges where org_id=p_org_id
    union select r.source,e.target from reach r join public.workspace_objective_plan_edges e on e.source=r.target and e.org_id=p_org_id
    ) select 1 from reach where source=target) then raise exception 'A plan cannot loop back into itself'; end if;
end $$;
revoke all on function public.read_workspace_objective_plans(uuid),public.save_workspace_objective_plan(uuid,jsonb) from public,anon;
grant execute on function public.read_workspace_objective_plans(uuid),public.save_workspace_objective_plan(uuid,jsonb) to authenticated;
