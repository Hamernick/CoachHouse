-- Optional owner limits sit beneath service safety limits. No wallet or billing
-- policy is enabled here. Calendar periods and pending reservations use UTC.
alter table public.ai_credit_wallets add column monthly_credit_limit integer check(monthly_credit_limit between 0 and 100000000),
  add column limit_revision uuid not null default gen_random_uuid();
create table public.ai_credit_member_limits (
  org_id uuid not null references public.organizations(user_id),
  member_id uuid not null references auth.users(id),
  monthly_credit_limit integer check(monthly_credit_limit between 0 and 100000000),
  revision uuid not null default gen_random_uuid(),
  primary key(org_id,member_id)
);
create table public.ai_credit_limit_changes (
  id uuid primary key,
  org_id uuid not null references public.organizations(user_id),
  actor_id uuid not null references auth.users(id),
  member_id uuid references auth.users(id),
  previous_limit integer, next_limit integer,
  created_at timestamptz not null default now()
);
alter table public.ai_credit_member_limits enable row level security;
alter table public.ai_credit_limit_changes enable row level security;
revoke all on public.ai_credit_member_limits,public.ai_credit_limit_changes from public,anon,authenticated,service_role;
create trigger ai_credit_limit_changes_immutable before update or delete on public.ai_credit_limit_changes
  for each row execute function public.ai_credit_immutable();

create function public.workspace_ai_monthly_usage(p_org_id uuid,p_member_id uuid default null)
returns bigint language sql stable security definer set search_path='' as $$
  select coalesce(sum(coalesce(charged_credits,max_credits)),0) from public.workspace_ai_runs
    where org_id=p_org_id and (p_member_id is null or actor_id=p_member_id)
    and (settled_at is null or settled_at>=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC')
$$;

create function public.read_ai_credit_limits(p_org_id uuid,p_actor_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare wallet public.ai_credit_wallets; members jsonb;
begin
  if not public.can_use_workspace_ai(p_org_id,p_actor_id) then raise exception 'AI access denied' using errcode='42501'; end if;
  select * into wallet from public.ai_credit_wallets where org_id=p_org_id;
  if not found then raise exception 'AI wallet unavailable'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('memberId',m.id,'name',coalesce(nullif(trim(p.full_name),''),'Organization member'),
    'limit',l.monthly_credit_limit,'revision',l.revision,'used',public.workspace_ai_monthly_usage(p_org_id,m.id)) order by p.full_name,m.id),'[]')
    into members from (
      select p_org_id id union select member_id from public.organization_memberships
      where org_id=p_org_id and role in ('owner','admin','staff')
    ) m left join public.profiles p on p.id=m.id
      left join public.ai_credit_member_limits l on l.org_id=p_org_id and l.member_id=m.id
    where p_actor_id=p_org_id or m.id=p_actor_id;
  return jsonb_build_object('canManage',p_org_id=p_actor_id,
    'resetsAt',(date_trunc('month',now() at time zone 'UTC')+interval '1 month') at time zone 'UTC',
    'organization',jsonb_build_object('limit',wallet.monthly_credit_limit,'revision',wallet.limit_revision,'used',public.workspace_ai_monthly_usage(p_org_id)),
    'members',members);
end $$;

create function public.set_ai_credit_limit(p_org_id uuid,p_actor_id uuid,p_member_id uuid,p_limit integer,p_revision uuid,p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare previous integer; revision uuid; prior public.ai_credit_limit_changes;
begin
  if p_org_id<>p_actor_id or not public.can_use_workspace_ai(p_org_id,p_actor_id) then raise exception 'Only the organization owner can change spending limits' using errcode='42501'; end if;
  if p_limit is not null and (p_limit<0 or p_limit>100000000) then raise exception 'Invalid spending limit'; end if;
  -- Same admission lock prevents simultaneous requests racing past a lowered cap.
  perform 1 from public.ai_credit_policy where id for update;
  select * into prior from public.ai_credit_limit_changes where id=p_operation_id;
  if found then
    if prior.org_id<>p_org_id or prior.actor_id<>p_actor_id or prior.member_id is distinct from p_member_id or prior.next_limit is distinct from p_limit then
      raise exception 'Limit change identity conflict'; end if;
    return public.read_ai_credit_limits(p_org_id,p_actor_id);
  end if;
  if p_member_id is null then
    select monthly_credit_limit,limit_revision into previous,revision from public.ai_credit_wallets where org_id=p_org_id for update;
    if not found then raise exception 'AI wallet unavailable'; end if;
  else
    if not public.can_use_workspace_ai(p_org_id,p_member_id) then raise exception 'Member cannot use this wallet' using errcode='42501'; end if;
    select monthly_credit_limit,l.revision into previous,revision from public.ai_credit_member_limits l where org_id=p_org_id and member_id=p_member_id for update;
  end if;
  if revision is distinct from p_revision then raise exception 'Spending limit changed. Reload usage before saving'; end if;
  if p_member_id is null then
    update public.ai_credit_wallets set monthly_credit_limit=p_limit,limit_revision=gen_random_uuid() where org_id=p_org_id;
  else
    insert into public.ai_credit_member_limits(org_id,member_id,monthly_credit_limit) values(p_org_id,p_member_id,p_limit)
      on conflict(org_id,member_id) do update set monthly_credit_limit=excluded.monthly_credit_limit,revision=gen_random_uuid();
  end if;
  insert into public.ai_credit_limit_changes(id,org_id,actor_id,member_id,previous_limit,next_limit)
    values(p_operation_id,p_org_id,p_actor_id,p_member_id,previous,p_limit);
  return public.read_ai_credit_limits(p_org_id,p_actor_id);
end $$;

-- Wrap the canonical admission path so document/selection/plan requests all
-- share these limits. Only the wrapper is callable by the trusted server role.
alter function public.reserve_workspace_ai_run(uuid,uuid,uuid,text,jsonb,text,jsonb,integer,integer) rename to reserve_workspace_ai_run_service_limits;
revoke all on function public.reserve_workspace_ai_run_service_limits(uuid,uuid,uuid,text,jsonb,text,jsonb,integer,integer) from public,anon,authenticated,service_role;
create function public.reserve_workspace_ai_run(p_id uuid,p_org_id uuid,p_actor_id uuid,p_hash text,p_target jsonb,p_prompt text,p_tariff jsonb,p_max_credits integer,p_max_cost integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare org_limit integer; member_limit integer;
begin
  if not public.can_use_workspace_ai(p_org_id,p_actor_id) then raise exception 'AI access denied' using errcode='42501'; end if;
  perform 1 from public.ai_credit_policy where id for update;
  -- Replays keep their original reservation; the original function still
  -- validates request identity before returning it.
  if not exists(select 1 from public.workspace_ai_runs where id=p_id) then
    select monthly_credit_limit into org_limit from public.ai_credit_wallets where org_id=p_org_id;
    select monthly_credit_limit into member_limit from public.ai_credit_member_limits where org_id=p_org_id and member_id=p_actor_id;
    if org_limit is not null and public.workspace_ai_monthly_usage(p_org_id)+p_max_credits>org_limit then raise exception 'Organization monthly AI credit limit reached'; end if;
    if member_limit is not null and public.workspace_ai_monthly_usage(p_org_id,p_actor_id)+p_max_credits>member_limit then raise exception 'Your monthly AI credit limit reached'; end if;
  end if;
  return public.reserve_workspace_ai_run_service_limits(p_id,p_org_id,p_actor_id,p_hash,p_target,p_prompt,p_tariff,p_max_credits,p_max_cost);
end $$;
revoke all on function public.workspace_ai_monthly_usage(uuid,uuid),public.read_ai_credit_limits(uuid,uuid),
  public.set_ai_credit_limit(uuid,uuid,uuid,integer,uuid,uuid),public.reserve_workspace_ai_run(uuid,uuid,uuid,text,jsonb,text,jsonb,integer,integer) from public,anon,authenticated;
grant execute on function public.read_ai_credit_limits(uuid,uuid),public.set_ai_credit_limit(uuid,uuid,uuid,integer,uuid,uuid),
  public.reserve_workspace_ai_run(uuid,uuid,uuid,text,jsonb,text,jsonb,integer,integer) to service_role;
