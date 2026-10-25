-- Explicit consent only. No packs, payment methods, charges or enabled policies are seeded.
create table public.ai_credit_refill_setups (
  id uuid primary key,
  org_id uuid not null references public.ai_credit_wallets(org_id),
  actor_id uuid not null references auth.users(id),
  mode text not null check(mode in ('test','live')),
  runtime_target text not null check(runtime_target in ('primary','tester')),
  pack_key text not null references public.ai_credit_packs(key),
  price_id text not null,
  credits integer not null check(credits>0),
  amount integer not null check(amount>0),
  currency text not null,
  threshold integer not null check(threshold between 1 and credits),
  monthly_cap integer not null check(monthly_cap>=amount and monthly_cap<=amount*10),
  consent_version text not null check(consent_version='refill-v1'),
  consent_at timestamptz not null default clock_timestamp(),
  return_url text not null,
  expires_at timestamptz not null default date_trunc('second',now()+interval '1 hour'),
  status text not null default 'setup' check(status in ('setup','enabled','paused','disabled')),
  disabled_at timestamptz,
  checkout_session_id text unique,
  customer_id text,
  payment_method_id text,
  payment_label text,
  verified_at timestamptz,
  check((verified_at is null)=(payment_method_id is null))
);
create unique index ai_credit_refill_active on public.ai_credit_refill_setups(org_id,mode) where status<>'disabled';
create table public.ai_credit_refill_events (
  run_id uuid not null references public.workspace_ai_runs(id),
  setup_id uuid not null references public.ai_credit_refill_setups(id),
  consumed_at timestamptz,
  primary key(run_id,setup_id)
);
create table public.ai_credit_refill_attempts (
  id uuid primary key references public.ai_credit_purchase_orders(id),
  setup_id uuid not null references public.ai_credit_refill_setups(id),
  run_id uuid not null references public.workspace_ai_runs(id),
  state text not null default 'queued' check(state in ('queued','charging','processing','requires_action','uncertain','failed','canceled','succeeded')),
  started_at timestamptz,
  updated_at timestamptz not null default clock_timestamp(),
  unique(setup_id,run_id)
);
create index ai_credit_refill_open on public.ai_credit_refill_attempts(updated_at) where state not in ('succeeded','failed','canceled');
alter table public.ai_credit_refill_setups enable row level security;
alter table public.ai_credit_refill_setups force row level security;
alter table public.ai_credit_refill_events enable row level security;
alter table public.ai_credit_refill_events force row level security;
alter table public.ai_credit_refill_attempts enable row level security;
alter table public.ai_credit_refill_attempts force row level security;
revoke all on public.ai_credit_refill_setups,public.ai_credit_refill_events,public.ai_credit_refill_attempts from public,anon,authenticated,service_role;

create function public.guard_ai_refill_terms() returns trigger language plpgsql set search_path='' as $$
begin
  if tg_op='DELETE' or (to_jsonb(new)-array['status','disabled_at','checkout_session_id','customer_id','payment_method_id','payment_label','verified_at'])
    is distinct from (to_jsonb(old)-array['status','disabled_at','checkout_session_id','customer_id','payment_method_id','payment_label','verified_at']) then
    raise exception 'Refill consent terms are immutable'; end if;
  return new;
end $$;
create trigger ai_refill_terms_immutable before update or delete on public.ai_credit_refill_setups for each row execute function public.guard_ai_refill_terms();

create function public.prepare_ai_credit_refill_setup(p_input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare owner_id uuid:=(p_input->>'actorId')::uuid; org uuid:=(p_input->>'organizationId')::uuid;
  request_id uuid:=(p_input->>'id')::uuid; pack public.ai_credit_packs; existing public.ai_credit_refill_setups;
  threshold_value integer:=(p_input->>'threshold')::integer; packs integer:=(p_input->>'monthlyPacks')::integer;
begin
  if owner_id is distinct from org or not public.can_use_workspace_ai(org,owner_id) then raise exception 'Only the organization owner can configure refill' using errcode='42501'; end if;
  if p_input->>'consentVersion' is distinct from 'refill-v1' or p_input->'consent' is distinct from 'true'::jsonb then raise exception 'Explicit refill consent is required'; end if;
  perform 1 from public.ai_credit_policy where id and enabled for update;
  if not found then raise exception 'AI is not enabled'; end if;
  perform 1 from public.ai_credit_wallets where org_id=org and enabled for update;
  if not found then raise exception 'AI wallet is not enabled'; end if;
  select * into existing from public.ai_credit_refill_setups where id=request_id;
  if found then
    if existing.org_id is distinct from org or existing.actor_id is distinct from owner_id or existing.pack_key is distinct from p_input->>'pack' or existing.mode is distinct from p_input->>'mode'
      or existing.runtime_target is distinct from p_input->>'runtimeTarget' or existing.threshold is distinct from threshold_value or existing.monthly_cap is distinct from existing.amount*packs
      or existing.return_url is distinct from p_input->>'returnUrl' then raise exception 'Refill setup identity conflict'; end if;
    return to_jsonb(existing);
  end if;
  select * into pack from public.ai_credit_packs where key=p_input->>'pack' and mode=p_input->>'mode' and enabled;
  if not found or threshold_value is null or threshold_value not between 1 and pack.credits or packs is null or packs not between 1 and 10 then raise exception 'Invalid refill settings'; end if;
  if exists(select 1 from public.ai_credit_refill_attempts a join public.ai_credit_purchase_orders o on o.id=a.id
    where o.org_id=org and o.mode=pack.mode and a.state not in ('succeeded','failed','canceled')) then raise exception 'Resolve the pending refill before changing settings'; end if;
  select * into existing from public.ai_credit_refill_setups where org_id=org and mode=pack.mode order by consent_at desc limit 1;
  if found and existing.currency<>pack.currency then raise exception 'Refill currency cannot be changed'; end if;
  if found and existing.status<>'disabled' then raise exception 'Disable the existing setup before changing settings'; end if;
  insert into public.ai_credit_refill_setups(id,org_id,actor_id,mode,runtime_target,pack_key,price_id,credits,amount,currency,threshold,monthly_cap,consent_version,return_url)
    values(request_id,org,owner_id,pack.mode,p_input->>'runtimeTarget',pack.key,pack.price_id,pack.credits,pack.amount,pack.currency,threshold_value,pack.amount*packs,'refill-v1',p_input->>'returnUrl') returning * into existing;
  return to_jsonb(existing);
end $$;

create function public.read_ai_credit_refill_setup(p_id uuid) returns jsonb language sql security definer set search_path='' as $$
  select to_jsonb(s) from public.ai_credit_refill_setups s where id=p_id
$$;
create function public.bind_ai_credit_refill_setup(p_id uuid,p_session text) returns void language plpgsql security definer set search_path='' as $$
begin
  update public.ai_credit_refill_setups set checkout_session_id=p_session where id=p_id
    and p_session like 'cs_%' and (checkout_session_id is null or checkout_session_id=p_session);
  if not found then raise exception 'Refill checkout identity conflict'; end if;
end $$;
create function public.verify_ai_credit_refill_setup(p_input jsonb) returns boolean language plpgsql security definer set search_path='' as $$
declare setup public.ai_credit_refill_setups;
begin
  select * into setup from public.ai_credit_refill_setups where id=(p_input->>'id')::uuid for update;
  if not found or setup.mode is distinct from p_input->>'mode' or coalesce(p_input->>'session','') not like 'cs_%'
    or coalesce(p_input->>'customer','') not like 'cus_%' or coalesce(p_input->>'paymentMethod','') not like 'pm_%'
    or (setup.checkout_session_id is not null and setup.checkout_session_id<>p_input->>'session') then raise exception 'Refill setup identity mismatch'; end if;
  if setup.verified_at is not null then
    if setup.customer_id<>p_input->>'customer' or setup.payment_method_id<>p_input->>'paymentMethod' then raise exception 'Refill payment identity conflict'; end if;
    return setup.status='enabled';
  end if;
  -- A delayed webhook must never undo Disable or a superseding consent.
  if setup.status<>'setup' then return false; end if;
  update public.ai_credit_refill_setups set status='enabled',checkout_session_id=p_input->>'session',customer_id=p_input->>'customer',
    payment_method_id=p_input->>'paymentMethod',payment_label=left(p_input->>'label',80),verified_at=clock_timestamp() where id=setup.id;
  return true;
end $$;
create function public.disable_ai_credit_refill(p_input jsonb) returns void language plpgsql security definer set search_path='' as $$
declare org uuid:=(p_input->>'organizationId')::uuid; actor uuid:=(p_input->>'actorId')::uuid;
begin
  if org is distinct from actor or not public.can_use_workspace_ai(org,actor) then raise exception 'Only the organization owner can disable refill' using errcode='42501'; end if;
  perform 1 from public.ai_credit_policy where id for update;
  update public.ai_credit_refill_setups set status='disabled',disabled_at=clock_timestamp() where org_id=org and mode=p_input->>'mode' and status<>'disabled';
  update public.ai_credit_refill_attempts a set state='canceled',updated_at=clock_timestamp() from public.ai_credit_purchase_orders o
    where o.id=a.id and o.org_id=org and o.mode=p_input->>'mode' and a.state='queued';
end $$;

create function public.read_ai_credit_refill(p_input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid:=(p_input->>'organizationId')::uuid; actor uuid:=(p_input->>'actorId')::uuid; setup public.ai_credit_refill_setups; used bigint; pending jsonb;
begin
  if org is distinct from actor or not public.can_use_workspace_ai(org,actor) then return null; end if;
  select * into setup from public.ai_credit_refill_setups where org_id=org and mode=p_input->>'mode' order by consent_at desc limit 1;
  select coalesce(sum(o.amount),0) into used from public.ai_credit_refill_attempts a join public.ai_credit_purchase_orders o on o.id=a.id
    where o.org_id=org and o.mode=p_input->>'mode' and ((o.paid_at at time zone 'UTC')>=date_trunc('month',now() at time zone 'UTC') or a.state not in ('succeeded','failed','canceled'));
  select jsonb_build_object('id',a.id,'state',a.state,'amount',o.amount,'currency',o.currency,'canCancel',o.payment_intent_id is not null,'canRetry',a.state='uncertain' and o.payment_intent_id is null and a.started_at>now()-interval '1 hour') into pending
    from public.ai_credit_refill_attempts a join public.ai_credit_purchase_orders o on o.id=a.id where o.org_id=org and o.mode=p_input->>'mode'
    and a.state not in ('succeeded','failed','canceled') order by o.created_at limit 1;
  return jsonb_build_object('setup',case when setup.id is null then null else jsonb_build_object('id',setup.id,'status',setup.status,'credits',setup.credits,'amount',setup.amount,
    'currency',setup.currency,'threshold',setup.threshold,'monthlyCap',setup.monthly_cap,'paymentLabel',setup.payment_label,'expiresAt',setup.expires_at) end,
    'used',used,'pending',pending,'resetAt',(date_trunc('month',now() at time zone 'UTC')+interval '1 month') at time zone 'UTC');
end $$;

create function public.queue_ai_credit_refill() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if old.settled_at is null and new.settled_at is not null and new.charged_credits>0 then
    insert into public.ai_credit_refill_events(run_id,setup_id)
      select new.id,id from public.ai_credit_refill_setups where org_id=new.org_id and status='enabled' on conflict do nothing;
  end if;
  return new;
end $$;
create trigger queue_ai_credit_refill after update of settled_at on public.workspace_ai_runs for each row execute function public.queue_ai_credit_refill();
revoke all on function public.prepare_ai_credit_refill_setup(jsonb),public.read_ai_credit_refill_setup(uuid),public.bind_ai_credit_refill_setup(uuid,text),
  public.verify_ai_credit_refill_setup(jsonb),public.disable_ai_credit_refill(jsonb),public.read_ai_credit_refill(jsonb),public.queue_ai_credit_refill(),public.guard_ai_refill_terms() from public,anon,authenticated;
grant execute on function public.prepare_ai_credit_refill_setup(jsonb),public.read_ai_credit_refill_setup(uuid),public.bind_ai_credit_refill_setup(uuid,text),
  public.verify_ai_credit_refill_setup(jsonb),public.disable_ai_credit_refill(jsonb),public.read_ai_credit_refill(jsonb) to service_role;
