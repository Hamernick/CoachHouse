-- Work is queued by real settled wallet activity, never by a balance/page read.
create function public.read_ai_credit_refill_attempt(p_id uuid) returns jsonb language sql security definer set search_path='' as $$
  select jsonb_build_object('attempt',to_jsonb(a),'order',to_jsonb(o),'setup',to_jsonb(s))
    from public.ai_credit_refill_attempts a join public.ai_credit_purchase_orders o on o.id=a.id join public.ai_credit_refill_setups s on s.id=a.setup_id where a.id=p_id
$$;
create function public.prepare_next_ai_credit_refill(p_mode text,p_target text) returns jsonb language plpgsql security definer set search_path='' as $$
declare event public.ai_credit_refill_events; setup public.ai_credit_refill_setups; available bigint; used bigint; order_id uuid; iteration integer;
begin
  perform 1 from public.ai_credit_policy where id and enabled for update;
  if not found then return null; end if;
  for iteration in 1..20 loop
    select e.* into event from public.ai_credit_refill_events e join public.ai_credit_refill_setups s on s.id=e.setup_id
      where e.consumed_at is null and s.mode=p_mode and s.runtime_target=p_target order by e.run_id for update of e skip locked limit 1;
    if not found then return null; end if;
    update public.ai_credit_refill_events set consumed_at=clock_timestamp() where run_id=event.run_id and setup_id=event.setup_id;
    select * into setup from public.ai_credit_refill_setups where id=event.setup_id;
    if setup.status<>'enabled' or setup.verified_at is null or not public.can_use_workspace_ai(setup.org_id,setup.actor_id) then continue; end if;
    perform 1 from public.ai_credit_wallets where org_id=setup.org_id and enabled for update;
    if not found or not exists(select 1 from public.ai_credit_packs where key=setup.pack_key and enabled) then continue; end if;
    if exists(select 1 from public.ai_credit_purchase_orders o join public.ai_credit_payment_restrictions r on r.order_id=o.id where o.org_id=setup.org_id and r.blocked) then continue; end if;
    if exists(select 1 from public.ai_credit_purchase_orders o where o.org_id=setup.org_id and o.mode=p_mode and o.paid_at is null and o.expires_at>now()
      and not exists(select 1 from public.ai_credit_refill_attempts a where a.id=o.id)) then continue; end if;
    if exists(select 1 from public.ai_credit_refill_attempts a join public.ai_credit_purchase_orders o on o.id=a.id
      where o.org_id=setup.org_id and o.mode=p_mode and a.state not in ('succeeded','failed','canceled')) then continue; end if;
    select coalesce(sum(greatest(0,l.credits-coalesce((select sum(credits) from public.ai_credit_entries where lot_id=l.id),0)
      -coalesce((select sum(r.credits) from public.ai_credit_reservations r join public.workspace_ai_runs run on run.id=r.run_id where r.lot_id=l.id and run.settled_at is null),0))),0)
      into available from public.ai_credit_lots l where l.org_id=setup.org_id and (l.expires_at is null or l.expires_at>now()) and not public.ai_credit_lot_restricted(l.id);
    if available>=setup.threshold then continue; end if;
    select coalesce(sum(o.amount),0) into used from public.ai_credit_refill_attempts a join public.ai_credit_purchase_orders o on o.id=a.id
      where o.org_id=setup.org_id and o.mode=p_mode and ((o.paid_at at time zone 'UTC')>=date_trunc('month',now() at time zone 'UTC') or a.state not in ('succeeded','failed','canceled'));
    if used+setup.amount>setup.monthly_cap then continue; end if;
    order_id:=gen_random_uuid();
    insert into public.ai_credit_purchase_orders(id,org_id,actor_id,pack_key,mode,price_id,credits,amount,currency,return_url)
      values(order_id,setup.org_id,setup.actor_id,setup.pack_key,setup.mode,setup.price_id,setup.credits,setup.amount,setup.currency,setup.return_url);
    insert into public.ai_credit_refill_attempts(id,setup_id,run_id) values(order_id,setup.id,event.run_id);
    return public.read_ai_credit_refill_attempt(order_id);
  end loop;
  return null;
end $$;

create function public.start_ai_credit_refill_charge(p_id uuid,p_actor_id uuid default null) returns boolean language plpgsql security definer set search_path='' as $$
declare attempt public.ai_credit_refill_attempts; setup public.ai_credit_refill_setups; available bigint;
begin
  perform 1 from public.ai_credit_policy where id and enabled for update;
  if not found then return false; end if;
  select * into attempt from public.ai_credit_refill_attempts where id=p_id for update;
  if not found then return false; end if;
  select * into setup from public.ai_credit_refill_setups where id=attempt.setup_id;
  if setup.status='disabled' or not public.can_use_workspace_ai(setup.org_id,setup.actor_id)
    or not exists(select 1 from public.ai_credit_wallets where org_id=setup.org_id and enabled) then return false; end if;
  if exists(select 1 from public.ai_credit_purchase_orders o join public.ai_credit_payment_restrictions r on r.order_id=o.id where o.org_id=setup.org_id and r.blocked) then return false; end if;
  if attempt.state='uncertain' then
    if p_actor_id is distinct from setup.actor_id or p_actor_id<>setup.org_id or attempt.started_at<=now()-interval '1 hour'
      or exists(select 1 from public.ai_credit_purchase_orders where id=p_id and payment_intent_id is not null) then return false; end if;
    -- Explicit owner retry only, bounded well inside Stripe idempotency retention.
  elsif attempt.state<>'queued' or setup.status<>'enabled' or not exists(select 1 from public.ai_credit_packs where key=setup.pack_key and enabled) then return false;
  end if;
  if attempt.state='queued' then
    -- A subscription grant or delayed manual payment may restore balance after queueing.
    select coalesce(sum(greatest(0,l.credits-coalesce((select sum(credits) from public.ai_credit_entries where lot_id=l.id),0)
      -coalesce((select sum(r.credits) from public.ai_credit_reservations r join public.workspace_ai_runs run on run.id=r.run_id where r.lot_id=l.id and run.settled_at is null),0))),0)
      into available from public.ai_credit_lots l where l.org_id=setup.org_id and (l.expires_at is null or l.expires_at>now()) and not public.ai_credit_lot_restricted(l.id);
    if available>=setup.threshold then
      update public.ai_credit_refill_attempts set state='canceled',updated_at=clock_timestamp() where id=p_id;
      return false;
    end if;
  end if;
  update public.ai_credit_refill_attempts set state='charging',started_at=coalesce(started_at,clock_timestamp()),updated_at=clock_timestamp() where id=p_id;
  return true;
end $$;

create function public.record_ai_credit_refill_attempt(p_input jsonb) returns void language plpgsql security definer set search_path='' as $$
declare attempt public.ai_credit_refill_attempts; purchase public.ai_credit_purchase_orders; setup public.ai_credit_refill_setups;
  new_state text:=p_input->>'state'; payment text:=p_input->>'payment'; lot uuid;
begin
  perform 1 from public.ai_credit_policy where id for update;
  select * into attempt from public.ai_credit_refill_attempts where id=(p_input->>'id')::uuid for update;
  select * into purchase from public.ai_credit_purchase_orders where id=attempt.id for update;
  select * into setup from public.ai_credit_refill_setups where id=attempt.setup_id;
  if attempt.id is null or new_state is null or new_state not in ('processing','requires_action','uncertain','failed','canceled','succeeded') then raise exception 'Invalid refill result'; end if;
  if payment is not null and (payment not like 'pi_%' or (purchase.payment_intent_id is not null and purchase.payment_intent_id<>payment)) then raise exception 'Refill payment identity conflict'; end if;
  if new_state<>'uncertain' and (payment is null or purchase.mode is distinct from p_input->>'mode' or purchase.amount is distinct from (p_input->>'amount')::integer
    or purchase.currency is distinct from p_input->>'currency' or setup.customer_id is distinct from p_input->>'customer' or setup.payment_method_id is distinct from p_input->>'paymentMethod') then raise exception 'Refill payment terms mismatch'; end if;
  if attempt.state='succeeded' or purchase.paid_at is not null then return; end if;
  if attempt.state in ('canceled','failed') and new_state<>attempt.state then raise exception 'Refill is terminal'; end if;
  if attempt.state='queued' then raise exception 'Refill charge has not started'; end if;
  -- An uncertain network result cannot override a verified provider result.
  if new_state='uncertain' and attempt.state<>'charging' then return; end if;
  -- Verified current provider state may advance an earlier uncertain event.
  if new_state='succeeded' then
    insert into public.ai_credit_lots(org_id,operation_key,kind,credits) values(purchase.org_id,'stripe-credit:'||purchase.mode||':'||payment,'purchased',purchase.credits) returning id into lot;
    update public.ai_credit_purchase_orders set payment_intent_id=payment,paid_at=clock_timestamp(),lot_id=lot where id=purchase.id;
  elsif payment is not null then update public.ai_credit_purchase_orders set payment_intent_id=payment where id=purchase.id;
  end if;
  update public.ai_credit_refill_attempts set state=new_state,updated_at=clock_timestamp() where id=attempt.id;
  if new_state in ('requires_action','uncertain','failed','canceled') then
    update public.ai_credit_refill_setups set status='paused' where id=setup.id and status='enabled';
  end if;
end $$;

create function public.list_ai_credit_refill_attempts(p_mode text,p_target text) returns jsonb language sql security definer set search_path='' as $$
  select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from (
    select a.id from public.ai_credit_refill_attempts a join public.ai_credit_refill_setups s on s.id=a.setup_id
    where s.mode=p_mode and s.runtime_target=p_target and (a.state in ('queued','processing') or (a.state='charging' and a.started_at<now()-interval '90 seconds')) order by a.updated_at limit 10
  ) t
$$;
revoke all on function public.read_ai_credit_refill_attempt(uuid),public.prepare_next_ai_credit_refill(text,text),public.start_ai_credit_refill_charge(uuid,uuid),
  public.record_ai_credit_refill_attempt(jsonb),public.list_ai_credit_refill_attempts(text,text) from public,anon,authenticated;
grant execute on function public.read_ai_credit_refill_attempt(uuid),public.prepare_next_ai_credit_refill(text,text),public.start_ai_credit_refill_charge(uuid,uuid),
  public.record_ai_credit_refill_attempt(jsonb),public.list_ai_credit_refill_attempts(text,text) to service_role;

-- Manual checkout must never reuse an automatic payment order.
create or replace function public.prepare_ai_credit_purchase(p_id uuid,p_org_id uuid,p_actor_id uuid,p_pack text,p_mode text,p_return_url text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare pack public.ai_credit_packs; purchase public.ai_credit_purchase_orders;
begin
  if p_org_id<>p_actor_id or not public.can_use_workspace_ai(p_org_id,p_actor_id) then
    raise exception 'Only the organization owner can buy credits' using errcode='42501'; end if;
  perform 1 from public.ai_credit_wallets where org_id=p_org_id and enabled for update;
  if not found or not exists(select 1 from public.ai_credit_policy where id and enabled) then raise exception 'AI is not enabled for this organization'; end if;
  if exists(select 1 from public.ai_credit_refill_attempts a join public.ai_credit_purchase_orders o on o.id=a.id
    where a.id=p_id or (o.org_id=p_org_id and o.mode=p_mode and a.state not in ('succeeded','failed','canceled'))) then
    raise exception 'Resolve the pending auto-refill before buying credits'; end if;
  select * into purchase from public.ai_credit_purchase_orders where id=p_id;
  if found then
    if purchase.org_id<>p_org_id or purchase.actor_id<>p_actor_id or purchase.pack_key<>p_pack or purchase.mode<>p_mode then raise exception 'Purchase identity conflict'; end if;
    return to_jsonb(purchase);
  end if;
  select * into pack from public.ai_credit_packs where key=p_pack and mode=p_mode and enabled;
  if not found then raise exception 'This credit pack is unavailable'; end if;
  -- Multiple clicks/tabs reuse a single pending order. Never start another charge
  -- to work around an uncertain network outcome.
  select * into purchase from public.ai_credit_purchase_orders where org_id=p_org_id and mode=p_mode
    and paid_at is null and expires_at>now() and not exists(select 1 from public.ai_credit_refill_attempts a where a.id=ai_credit_purchase_orders.id) order by created_at desc limit 1;
  if found then
    if purchase.pack_key<>p_pack then raise exception 'Finish the pending credit purchase before choosing another pack'; end if;
    return to_jsonb(purchase);
  end if;
  insert into public.ai_credit_purchase_orders(id,org_id,actor_id,pack_key,mode,price_id,credits,amount,currency,return_url)
    values(p_id,p_org_id,p_actor_id,pack.key,pack.mode,pack.price_id,pack.credits,pack.amount,pack.currency,p_return_url)
    returning * into purchase;
  return to_jsonb(purchase);
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
    from public.ai_credit_purchase_orders o where org_id=p_org_id and mode=p_mode and (o.paid_at is not null or not exists(select 1 from public.ai_credit_refill_attempts a where a.id=o.id)) order by created_at desc limit 10
  ) o;
  return jsonb_build_object('canPurchase',true,'packs',packs,'orders',orders);
end $$;
