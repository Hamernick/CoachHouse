-- Private, default-off AI accounting. No grants, billing products or live
-- entitlements are created by this migration. All money writes are server-only.
create table public.ai_credit_policy (
  id boolean primary key default true check (id),
  enabled boolean not null default false,
  daily_provider_microdollars bigint not null default 10000000 check (daily_provider_microdollars > 0),
  max_run_microdollars integer not null default 250000 check (max_run_microdollars > 0),
  max_run_credits integer not null default 125 check (max_run_credits > 0),
  org_concurrency integer not null default 3 check (org_concurrency between 1 and 10),
  user_daily_credits integer not null default 500 check (user_daily_credits > 0),
  user_hourly_runs integer not null default 30 check (user_hourly_runs > 0)
);
insert into public.ai_credit_policy(id) values (true);

create table public.ai_credit_wallets (
  org_id uuid primary key references public.organizations(user_id) on delete restrict,
  enabled boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.ai_credit_lots (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.ai_credit_wallets(org_id) on delete restrict,
  operation_key text not null unique check (length(operation_key) between 1 and 200),
  kind text not null check (kind in ('included','purchased','adjustment')),
  credits integer not null check (credits > 0),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
create index ai_credit_lots_wallet on public.ai_credit_lots(org_id);

create table public.workspace_ai_runs (
  id uuid primary key,
  org_id uuid not null references public.ai_credit_wallets(org_id) on delete restrict,
  actor_id uuid not null references auth.users(id) on delete restrict,
  request_hash text not null check (length(request_hash) = 64),
  task text not null check (task = 'document'),
  target jsonb not null check (jsonb_typeof(target) = 'object' and octet_length(target::text) <= 150000),
  prompt text not null check (length(prompt) between 1 and 4000),
  tariff jsonb not null check (jsonb_typeof(tariff) = 'object'),
  max_credits integer not null check (max_credits > 0),
  max_provider_microdollars integer not null check (max_provider_microdollars > 0),
  status text not null default 'reserved' check (status in ('reserved','running','reconciling','succeeded','failed','canceled')),
  provider_response_id text,
  provider_cost_state text not null default 'pending' check (provider_cost_state in ('pending','measured','unconfirmed')),
  provider_microdollars bigint check (provider_microdollars >= 0),
  charged_credits integer check (charged_credits >= 0 and charged_credits <= max_credits),
  proposal text check (octet_length(proposal) <= 150000),
  usage jsonb,
  cancel_requested_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  settled_at timestamptz,
  check ((settled_at is null and charged_credits is null) or
    (settled_at is not null and charged_credits is not null and provider_microdollars is not null)),
  check (status <> 'succeeded' or (proposal is not null and length(proposal) > 0))
);
create index workspace_ai_runs_wallet on public.workspace_ai_runs(org_id,created_at desc);
create index workspace_ai_runs_actor on public.workspace_ai_runs(actor_id,created_at desc);
create index workspace_ai_runs_pending on public.workspace_ai_runs(status) where settled_at is null;

create table public.ai_credit_reservations (
  run_id uuid not null references public.workspace_ai_runs(id) on delete restrict,
  lot_id uuid not null references public.ai_credit_lots(id) on delete restrict,
  credits integer not null check (credits > 0),
  primary key (run_id,lot_id)
);
create table public.ai_credit_entries (
  id bigint generated always as identity primary key,
  run_id uuid not null references public.workspace_ai_runs(id) on delete restrict,
  lot_id uuid not null references public.ai_credit_lots(id) on delete restrict,
  credits integer not null check (credits > 0),
  created_at timestamptz not null default clock_timestamp(),
  unique (run_id,lot_id)
);
create index ai_credit_entries_lot on public.ai_credit_entries(lot_id);
create index ai_credit_reservations_lot on public.ai_credit_reservations(lot_id);

create function public.ai_credit_immutable() returns trigger language plpgsql as $$
begin raise exception 'AI ledger history is immutable'; end $$;
create trigger ai_credit_entries_immutable before update or delete on public.ai_credit_entries
  for each row execute function public.ai_credit_immutable();
create trigger ai_credit_lots_immutable before update or delete on public.ai_credit_lots
  for each row execute function public.ai_credit_immutable();
create trigger ai_credit_reservations_immutable before update or delete on public.ai_credit_reservations
  for each row execute function public.ai_credit_immutable();

-- No anonymous/session table access, even for public organizations. Public
-- callers cannot impersonate p_actor_id; only the authenticated server can call.
alter table public.ai_credit_policy enable row level security;
alter table public.ai_credit_wallets enable row level security;
alter table public.ai_credit_lots enable row level security;
alter table public.workspace_ai_runs enable row level security;
alter table public.ai_credit_reservations enable row level security;
alter table public.ai_credit_entries enable row level security;
revoke all on public.ai_credit_policy, public.ai_credit_wallets, public.ai_credit_lots,
  public.workspace_ai_runs, public.ai_credit_reservations, public.ai_credit_entries from public,anon,authenticated;
grant select,insert,update on public.ai_credit_policy, public.ai_credit_wallets, public.workspace_ai_runs to service_role;
grant select,insert on public.ai_credit_lots, public.ai_credit_entries, public.ai_credit_reservations to service_role;
grant usage,select on sequence public.ai_credit_entries_id_seq to service_role;

create function public.can_use_workspace_ai(p_org_id uuid,p_actor_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.organizations where user_id=p_org_id)
    and (p_org_id=p_actor_id or exists(select 1 from public.organization_memberships
      where org_id=p_org_id and member_id=p_actor_id and role in ('owner','admin','staff')))
$$;

create function public.reserve_workspace_ai_run(p_id uuid,p_org_id uuid,p_actor_id uuid,
  p_hash text,p_target jsonb,p_prompt text,p_tariff jsonb,p_max_credits integer,p_max_cost integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare policy public.ai_credit_policy; existing public.workspace_ai_runs;
  lot record; needed integer:=p_max_credits; amount integer; consumed bigint;
begin
  if not public.can_use_workspace_ai(p_org_id,p_actor_id) then raise exception 'AI access denied' using errcode='42501'; end if;
  -- A single admission lock serializes global cost, per-actor concurrency and
  -- wallet reservations. Provider work never runs inside this transaction.
  select * into policy from public.ai_credit_policy where id for update;
  select * into existing from public.workspace_ai_runs where id=p_id;
  if found then
    if existing.org_id<>p_org_id or existing.actor_id<>p_actor_id or existing.request_hash<>p_hash then
      raise exception 'AI request identity conflict';
    end if;
    return jsonb_build_object('created',false,'run',to_jsonb(existing));
  end if;
  if not policy.enabled or not exists(select 1 from public.ai_credit_wallets where org_id=p_org_id and enabled) then
    raise exception 'AI is not enabled for this organization';
  end if;
  if p_max_credits is null or p_max_credits<=0 or p_max_credits>policy.max_run_credits
    or p_max_cost is null or p_max_cost<=0 or p_max_cost>policy.max_run_microdollars then raise exception 'AI request exceeds limits'; end if;
  if exists(select 1 from public.workspace_ai_runs where actor_id=p_actor_id and settled_at is null)
    or (select count(*) from public.workspace_ai_runs where org_id=p_org_id and settled_at is null)>=policy.org_concurrency then
    raise exception 'An AI request is already running';
  end if;
  select coalesce(sum(coalesce(provider_microdollars,max_provider_microdollars)),0) into consumed
    from public.workspace_ai_runs where settled_at is null or provider_cost_state='unconfirmed'
      or settled_at >= date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
  if consumed+p_max_cost>policy.daily_provider_microdollars then raise exception 'AI daily service limit reached'; end if;
  select coalesce(sum(coalesce(charged_credits,max_credits)),0) into consumed
    from public.workspace_ai_runs where actor_id=p_actor_id and (settled_at is null
      or settled_at >= date_trunc('day',now() at time zone 'UTC') at time zone 'UTC');
  if consumed+p_max_credits>policy.user_daily_credits then raise exception 'AI daily member limit reached'; end if;
  if (select count(*) from public.workspace_ai_runs where actor_id=p_actor_id and created_at>now()-interval '1 hour')>=policy.user_hourly_runs then
    raise exception 'AI hourly request limit reached';
  end if;
  insert into public.workspace_ai_runs(id,org_id,actor_id,request_hash,task,target,prompt,tariff,max_credits,max_provider_microdollars)
    values(p_id,p_org_id,p_actor_id,p_hash,'document',p_target,p_prompt,p_tariff,p_max_credits,p_max_cost);
  -- Expiring allowance first. A reservation keeps its original allocation even
  -- when that lot expires while the provider is working.
  for lot in select l.*,
    l.credits-coalesce((select sum(e.credits) from public.ai_credit_entries e where e.lot_id=l.id),0)
      -coalesce((select sum(r.credits) from public.ai_credit_reservations r
        join public.workspace_ai_runs a on a.id=r.run_id where r.lot_id=l.id and a.settled_at is null),0) available
    from public.ai_credit_lots l where l.org_id=p_org_id and (l.expires_at is null or l.expires_at>now())
    order by l.expires_at asc nulls last,l.created_at,l.id
  loop
    amount:=least(needed,greatest(0,lot.available));
    if amount>0 then
      insert into public.ai_credit_reservations values(p_id,lot.id,amount);
      needed:=needed-amount;
    end if;
    exit when needed=0;
  end loop;
  if needed>0 then raise exception 'Not enough AI credits'; end if;
  select * into existing from public.workspace_ai_runs where id=p_id;
  return jsonb_build_object('created',true,'run',to_jsonb(existing));
end $$;

create function public.claim_workspace_ai_run(p_id uuid,p_actor_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update public.workspace_ai_runs set status='running' where id=p_id and actor_id=p_actor_id and status='reserved' and cancel_requested_at is null
    and public.can_use_workspace_ai(org_id,p_actor_id)
    and exists(select 1 from public.ai_credit_policy where id and enabled)
    and exists(select 1 from public.ai_credit_wallets w where w.org_id=workspace_ai_runs.org_id and w.enabled);
  return found;
end $$;

create function public.settle_workspace_ai_run(p_id uuid,p_status text,p_cost bigint,p_credits integer,
  p_proposal text,p_usage jsonb,p_response_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare run public.workspace_ai_runs; allocation record; remaining integer:=p_credits; amount integer;
begin
  perform 1 from public.ai_credit_policy where id for update;
  select * into run from public.workspace_ai_runs where id=p_id for update;
  if not found then raise exception 'AI request not found'; end if;
  if run.cancel_requested_at is not null then
    p_status:='canceled'; p_credits:=0; remaining:=0; p_proposal:=null;
  end if;
  if run.settled_at is not null then
    if run.status<>p_status or run.provider_microdollars<>p_cost or run.charged_credits<>p_credits
      or run.proposal is distinct from p_proposal then raise exception 'AI settlement identity conflict'; end if;
    return to_jsonb(run);
  end if;
  if p_status is null or p_status not in ('succeeded','failed','canceled') or p_cost is null or p_cost<0
    or p_credits is null or p_credits<0 or p_credits>run.max_credits
    or (p_status<>'succeeded' and (p_credits<>0 or p_proposal is not null))
    or (p_status='succeeded' and (p_proposal is null or length(trim(p_proposal))=0)) then
    raise exception 'Invalid AI settlement';
  end if;
  for allocation in select r.* from public.ai_credit_reservations r
    join public.ai_credit_lots l on l.id=r.lot_id where r.run_id=p_id
    order by l.expires_at asc nulls last,l.created_at,l.id
  loop
    amount:=least(remaining,allocation.credits);
    if amount>0 then insert into public.ai_credit_entries(run_id,lot_id,credits) values(p_id,allocation.lot_id,amount); end if;
    remaining:=remaining-amount;
  end loop;
  if remaining<>0 then raise exception 'AI reservation mismatch'; end if;
  update public.workspace_ai_runs set status=p_status,provider_microdollars=p_cost,charged_credits=p_credits,
    proposal=p_proposal,usage=p_usage,provider_response_id=coalesce(p_response_id,provider_response_id),provider_cost_state='measured',settled_at=clock_timestamp()
    where id=p_id returning * into run;
  -- Account for an unexpected provider overrun, but stop further admissions.
  if p_cost>run.max_provider_microdollars then update public.ai_credit_policy set enabled=false where id; end if;
  return to_jsonb(run);
end $$;

revoke all on function public.can_use_workspace_ai(uuid,uuid),
  public.reserve_workspace_ai_run(uuid,uuid,uuid,text,jsonb,text,jsonb,integer,integer),
  public.claim_workspace_ai_run(uuid,uuid),
  public.settle_workspace_ai_run(uuid,text,bigint,integer,text,jsonb,text),
  public.ai_credit_immutable() from public,anon,authenticated;
grant execute on function public.can_use_workspace_ai(uuid,uuid),
  public.reserve_workspace_ai_run(uuid,uuid,uuid,text,jsonb,text,jsonb,integer,integer),
  public.claim_workspace_ai_run(uuid,uuid),
  public.settle_workspace_ai_run(uuid,text,bigint,integer,text,jsonb,text) to service_role;
