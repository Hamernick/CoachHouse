-- Payment adjustments never rewrite grants or consumption, create debt, or
-- issue replacement charges. A partial/consumed refund stays held for review.
create table public.ai_credit_payment_restrictions (
  order_id uuid not null references public.ai_credit_purchase_orders(id),
  kind text not null check(kind in ('refund','dispute','verification')),
  provider_id text not null,
  status text not null,
  amount integer not null check(amount>=0),
  blocked boolean not null,
  event_created bigint not null,
  primary key(order_id,kind,provider_id)
);
create table public.ai_credit_payment_adjustments (
  operation_key text primary key check(length(operation_key) between 1 and 400),
  order_id uuid not null references public.ai_credit_purchase_orders(id),
  kind text not null, provider_id text not null, status text not null,
  amount integer not null, currency text not null,
  previous_status text, applied boolean not null,
  unspent_credits_held integer not null,
  consumed_credits_for_review integer not null,
  event_created bigint not null,
  recorded_at timestamptz not null default clock_timestamp()
);
alter table public.ai_credit_payment_restrictions enable row level security;
alter table public.ai_credit_payment_adjustments enable row level security;
revoke all on public.ai_credit_payment_restrictions,public.ai_credit_payment_adjustments from public,anon,authenticated,service_role;
create trigger ai_credit_payment_adjustments_immutable before update or delete on public.ai_credit_payment_adjustments
  for each row execute function public.ai_credit_immutable();

create function public.ai_credit_lot_restricted(p_lot_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.ai_credit_purchase_orders o join public.ai_credit_payment_restrictions r on r.order_id=o.id
    where o.lot_id=p_lot_id and r.blocked)
$$;
create function public.find_ai_credit_payment(p_payment text,p_mode text)
returns jsonb language sql stable security definer set search_path='' as $$
  select to_jsonb(o) from public.ai_credit_purchase_orders o where payment_intent_id=p_payment and mode=p_mode
$$;

create function public.record_ai_credit_payment_restriction(p_order_id uuid,p_payment text,p_mode text,p_kind text,p_provider_id text,
  p_status text,p_amount integer,p_currency text,p_operation_key text,p_event_created bigint)
returns void language plpgsql security definer set search_path='' as $$
declare purchase public.ai_credit_purchase_orders; prior public.ai_credit_payment_restrictions; existing public.ai_credit_payment_adjustments;
  blocked boolean; applied boolean:=true; spent integer; reserved integer; held integer;
begin
  perform 1 from public.ai_credit_policy where id for update;
  select * into purchase from public.ai_credit_purchase_orders where id=p_order_id for update;
  if not found or purchase.mode is distinct from p_mode or purchase.currency is distinct from p_currency
    or p_payment is null or p_payment not like 'pi_%' or (purchase.payment_intent_id is not null and purchase.payment_intent_id<>p_payment)
    or p_provider_id is null or length(p_provider_id) not between 1 and 200 or p_event_created is null or p_event_created<0
    or p_amount is null or p_amount<0 then raise exception 'Payment restriction identity mismatch'; end if;
  if p_kind='refund' and p_status in ('pending','requires_action','succeeded','failed','canceled') and p_amount between 1 and purchase.amount then
    blocked:=p_status in ('pending','requires_action','succeeded');
  elsif p_kind='dispute' and p_status in ('warning_needs_response','warning_under_review','warning_closed','needs_response','under_review','won','lost') and p_amount>0 then
    blocked:=p_status not in ('won','warning_closed');
  elsif p_kind='verification' and p_status in ('pending','resolved') and p_amount=0 then blocked:=p_status='pending';
  else raise exception 'Invalid payment restriction'; end if;
  select * into existing from public.ai_credit_payment_adjustments where operation_key=p_operation_key;
  if found then
    if existing.order_id<>p_order_id or existing.kind<>p_kind or existing.provider_id<>p_provider_id or existing.status<>p_status
      or existing.amount<>p_amount or existing.currency<>p_currency then raise exception 'Payment adjustment identity conflict'; end if;
    return;
  end if;
  select * into prior from public.ai_credit_payment_restrictions where order_id=p_order_id and kind=p_kind and provider_id=p_provider_id;
  if found then
    if prior.amount<>p_amount then raise exception 'Payment adjustment amount changed'; end if;
    -- Do not let delayed snapshots reopen a terminal result or undo a newer hold.
    if p_event_created<prior.event_created or (prior.status in ('succeeded','failed','canceled','won','lost','resolved') and prior.status<>p_status) then applied:=false; end if;
  end if;
  update public.ai_credit_purchase_orders set payment_intent_id=p_payment where id=p_order_id;
  if applied then
    insert into public.ai_credit_payment_restrictions(order_id,kind,provider_id,status,amount,blocked,event_created)
      values(p_order_id,p_kind,p_provider_id,p_status,p_amount,blocked,p_event_created)
      on conflict(order_id,kind,provider_id) do update set status=excluded.status,blocked=excluded.blocked,event_created=excluded.event_created;
  end if;
  select coalesce(sum(credits),0) into spent from public.ai_credit_entries where lot_id=purchase.lot_id;
  select coalesce(sum(r.credits),0) into reserved from public.ai_credit_reservations r join public.workspace_ai_runs a on a.id=r.run_id
    where r.lot_id=purchase.lot_id and a.settled_at is null;
  held:=case when purchase.lot_id is not null and exists(select 1 from public.ai_credit_payment_restrictions r where r.order_id=p_order_id and r.blocked)
    then greatest(0,purchase.credits-spent-reserved) else 0 end;
  insert into public.ai_credit_payment_adjustments(operation_key,order_id,kind,provider_id,status,amount,currency,previous_status,applied,unspent_credits_held,consumed_credits_for_review,event_created)
    values(p_operation_key,p_order_id,p_kind,p_provider_id,p_status,p_amount,p_currency,prior.status,applied,held,spent,p_event_created);
end $$;

-- Serialize new grants against restrictions and enforce any payment binding
-- recorded by a refund/dispute arriving before the checkout webhook.
create or replace function public.fulfill_ai_credit_purchase(p_id uuid,p_session text,p_payment text,p_mode text,p_amount integer,p_currency text)
returns uuid language plpgsql security definer set search_path='' as $$
declare purchase public.ai_credit_purchase_orders; lot uuid;
begin
  perform 1 from public.ai_credit_policy where id for update;
  select * into purchase from public.ai_credit_purchase_orders where id=p_id for update;
  if not found then raise exception 'Purchase unavailable'; end if;
  if purchase.mode is distinct from p_mode or purchase.amount is distinct from p_amount or purchase.currency is distinct from p_currency
    or p_session is null or p_session not like 'cs_%' or p_payment is null or p_payment not like 'pi_%'
    or (purchase.checkout_session_id is not null and purchase.checkout_session_id<>p_session)
    or (purchase.payment_intent_id is not null and purchase.payment_intent_id<>p_payment) then raise exception 'Payment does not match purchase'; end if;
  if purchase.paid_at is not null then return purchase.lot_id; end if;
  insert into public.ai_credit_lots(org_id,operation_key,kind,credits)
    values(purchase.org_id,'stripe-credit:'||p_mode||':'||p_payment,'purchased',purchase.credits) returning id into lot;
  update public.ai_credit_purchase_orders set checkout_session_id=p_session,payment_intent_id=p_payment,paid_at=now(),lot_id=lot where id=p_id;
  return lot;
end $$;

create function public.ai_credit_purchase_payment_issue(p_id uuid)
returns text language sql stable security definer set search_path='' as $$
  select case
    when coalesce((select sum(amount) from public.ai_credit_payment_restrictions where order_id=p_id and kind='refund' and status='succeeded'),0)>=o.amount then 'refunded'
    when exists(select 1 from public.ai_credit_payment_restrictions where order_id=p_id and kind='dispute' and blocked) then 'disputed'
    when exists(select 1 from public.ai_credit_payment_restrictions where order_id=p_id and kind='refund' and status='succeeded') then 'partially_refunded'
    when exists(select 1 from public.ai_credit_payment_restrictions where order_id=p_id and kind='refund' and blocked) then 'refund_pending'
    when exists(select 1 from public.ai_credit_payment_restrictions where order_id=p_id and blocked) then 'verification_pending'
    else null end from public.ai_credit_purchase_orders o where o.id=p_id
$$;
revoke all on function public.ai_credit_lot_restricted(uuid),public.ai_credit_purchase_payment_issue(uuid),public.find_ai_credit_payment(text,text),
  public.record_ai_credit_payment_restriction(uuid,text,text,text,text,text,integer,text,text,bigint) from public,anon,authenticated;
grant execute on function public.find_ai_credit_payment(text,text),
  public.record_ai_credit_payment_restriction(uuid,text,text,text,text,text,integer,text,text,bigint) to service_role;

-- Preserve existing admission budgets, recovery and read privacy; exclude only restricted lots.
create or replace function public.reserve_workspace_ai_run_service_limits(p_id uuid,p_org_id uuid,p_actor_id uuid,
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
      and not public.ai_credit_lot_restricted(l.id)
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

create or replace function public.read_workspace_ai_account(p_org_id uuid,p_actor_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare lots jsonb; history jsonb;
begin
  if not public.can_use_workspace_ai(p_org_id,p_actor_id) then raise exception 'AI access denied' using errcode='42501'; end if;
  perform public.recover_workspace_ai_runs(p_org_id);
  select coalesce(jsonb_agg(jsonb_build_object('kind',l.kind,'expiresAt',l.expires_at,'expired',coalesce(l.expires_at<=now(),false),'credits',l.credits,'restricted',public.ai_credit_lot_restricted(l.id),
    'spent',coalesce((select sum(credits) from public.ai_credit_entries where lot_id=l.id),0),
    'reserved',coalesce((select sum(r.credits) from public.ai_credit_reservations r join public.workspace_ai_runs a on a.id=r.run_id
      where r.lot_id=l.id and a.settled_at is null),0))), '[]') into lots
    from public.ai_credit_lots l where org_id=p_org_id and (expires_at is null or expires_at>now()
      or exists(select 1 from public.ai_credit_reservations r join public.workspace_ai_runs a on a.id=r.run_id
        where r.lot_id=l.id and a.settled_at is null));
  select coalesce(jsonb_agg(to_jsonb(h)), '[]') into history from
    (select id,status,created_at,charged_credits,max_credits,settled_at from public.workspace_ai_runs
      where org_id=p_org_id and actor_id=p_actor_id order by created_at desc limit 30) h;
  return jsonb_build_object('enabled',exists(select 1 from public.ai_credit_policy p join public.ai_credit_wallets w on w.org_id=p_org_id where p.id and p.enabled and w.enabled),
    'lots',lots,'history',history,'paymentReview',exists(select 1 from public.ai_credit_purchase_orders o
      join public.ai_credit_payment_restrictions r on r.order_id=o.id where o.org_id=p_org_id and r.blocked));
end $$;

create or replace function public.read_ai_credit_purchases(p_org_id uuid,p_actor_id uuid,p_mode text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare packs jsonb; orders jsonb;
begin
  if not public.can_use_workspace_ai(p_org_id,p_actor_id) then raise exception 'AI access denied' using errcode='42501'; end if;
  if p_org_id<>p_actor_id then return jsonb_build_object('canPurchase',false,'packs','[]'::jsonb,'orders','[]'::jsonb); end if;
  select coalesce(jsonb_agg(jsonb_build_object('key',key,'credits',credits,'amount',amount,'currency',currency) order by amount),'[]')
    into packs from public.ai_credit_packs where enabled and mode=p_mode
    and exists(select 1 from public.ai_credit_wallets w join public.ai_credit_policy p on p.id where w.org_id=p_org_id and w.enabled and p.enabled);
  select coalesce(jsonb_agg(to_jsonb(o)),'[]') into orders from (
    select id,credits,amount,currency,created_at,public.ai_credit_purchase_payment_issue(id) "paymentIssue",case when paid_at is not null then 'paid'
      when expires_at<=now() then 'expired' else 'pending' end status
    from public.ai_credit_purchase_orders where org_id=p_org_id and mode=p_mode order by created_at desc limit 10
  ) o;
  return jsonb_build_object('canPurchase',true,'packs',packs,'orders',orders);
end $$;

