-- No products, prices, allowances or live billing are enabled by this migration.
-- Pack keys are versioned; changing commercial terms requires a new key.
create table public.ai_credit_packs (
  key text primary key check(length(key) between 1 and 100),
  mode text not null check(mode in ('test','live')),
  price_id text not null check(price_id like 'price_%'),
  credits integer not null check(credits between 1 and 1000000),
  amount integer not null check(amount between 1 and 10000000),
  currency text not null check(currency ~ '^[a-z]{3}$'),
  enabled boolean not null default false,
  unique(mode,price_id)
);
create table public.ai_credit_purchase_orders (
  id uuid primary key,
  org_id uuid not null references public.organizations(user_id),
  actor_id uuid not null references auth.users(id),
  pack_key text not null references public.ai_credit_packs(key),
  mode text not null check(mode in ('test','live')),
  price_id text not null,
  credits integer not null check(credits>0),
  amount integer not null check(amount>0),
  currency text not null,
  return_url text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default date_trunc('second',now()+interval '1 hour'),
  checkout_session_id text unique,
  payment_intent_id text,
  paid_at timestamptz,
  lot_id uuid unique references public.ai_credit_lots(id),
  unique(mode,payment_intent_id),
  check((paid_at is null)=(lot_id is null)),
  check(paid_at is null or payment_intent_id is not null)
);
create index ai_credit_purchase_orders_org on public.ai_credit_purchase_orders(org_id,created_at desc);
alter table public.ai_credit_packs enable row level security;
alter table public.ai_credit_purchase_orders enable row level security;
revoke all on public.ai_credit_packs,public.ai_credit_purchase_orders from public,anon,authenticated,service_role;
grant select,insert on public.ai_credit_packs to service_role;
grant update(enabled) on public.ai_credit_packs to service_role;

-- Conservatively owner-only until a distinct billing-authorized permission exists.
create function public.read_ai_credit_purchases(p_org_id uuid,p_actor_id uuid,p_mode text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare packs jsonb; orders jsonb;
begin
  if not public.can_use_workspace_ai(p_org_id,p_actor_id) then raise exception 'AI access denied' using errcode='42501'; end if;
  if p_org_id<>p_actor_id then return jsonb_build_object('canPurchase',false,'packs','[]'::jsonb,'orders','[]'::jsonb); end if;
  select coalesce(jsonb_agg(jsonb_build_object('key',key,'credits',credits,'amount',amount,'currency',currency) order by amount),'[]')
    into packs from public.ai_credit_packs where enabled and mode=p_mode
    and exists(select 1 from public.ai_credit_wallets w join public.ai_credit_policy p on p.id where w.org_id=p_org_id and w.enabled and p.enabled);
  select coalesce(jsonb_agg(to_jsonb(o)),'[]') into orders from (
    select id,credits,amount,currency,created_at,case when paid_at is not null then 'paid'
      when expires_at<=now() then 'expired' else 'pending' end status
    from public.ai_credit_purchase_orders where org_id=p_org_id and mode=p_mode order by created_at desc limit 10
  ) o;
  return jsonb_build_object('canPurchase',true,'packs',packs,'orders',orders);
end $$;

create function public.prepare_ai_credit_purchase(p_id uuid,p_org_id uuid,p_actor_id uuid,p_pack text,p_mode text,p_return_url text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare pack public.ai_credit_packs; purchase public.ai_credit_purchase_orders;
begin
  if p_org_id<>p_actor_id or not public.can_use_workspace_ai(p_org_id,p_actor_id) then
    raise exception 'Only the organization owner can buy credits' using errcode='42501'; end if;
  perform 1 from public.ai_credit_wallets where org_id=p_org_id and enabled for update;
  if not found or not exists(select 1 from public.ai_credit_policy where id and enabled) then raise exception 'AI is not enabled for this organization'; end if;
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
    and paid_at is null and expires_at>now() order by created_at desc limit 1;
  if found then
    if purchase.pack_key<>p_pack then raise exception 'Finish the pending credit purchase before choosing another pack'; end if;
    return to_jsonb(purchase);
  end if;
  insert into public.ai_credit_purchase_orders(id,org_id,actor_id,pack_key,mode,price_id,credits,amount,currency,return_url)
    values(p_id,p_org_id,p_actor_id,pack.key,pack.mode,pack.price_id,pack.credits,pack.amount,pack.currency,p_return_url)
    returning * into purchase;
  return to_jsonb(purchase);
end $$;

create function public.bind_ai_credit_checkout(p_id uuid,p_session text)
returns void language plpgsql security definer set search_path='' as $$
declare purchase public.ai_credit_purchase_orders;
begin
  select * into purchase from public.ai_credit_purchase_orders where id=p_id for update;
  if not found then raise exception 'Purchase unavailable'; end if;
  if p_session is null or p_session not like 'cs_%' or (purchase.checkout_session_id is not null and purchase.checkout_session_id<>p_session) then
    raise exception 'Checkout identity conflict'; end if;
  update public.ai_credit_purchase_orders set checkout_session_id=p_session where id=p_id;
end $$;

create function public.read_ai_credit_purchase_order(p_id uuid)
returns jsonb language sql security definer set search_path='' as $$
  select to_jsonb(o) from public.ai_credit_purchase_orders o where id=p_id
$$;

-- Only the signature-verified server handler calls this after matching the full
-- provider session and line item against the immutable order snapshot.
create function public.fulfill_ai_credit_purchase(p_id uuid,p_session text,p_payment text,p_mode text,p_amount integer,p_currency text)
returns uuid language plpgsql security definer set search_path='' as $$
declare purchase public.ai_credit_purchase_orders; lot uuid;
begin
  select * into purchase from public.ai_credit_purchase_orders where id=p_id for update;
  if not found then raise exception 'Purchase unavailable'; end if;
  if purchase.mode is distinct from p_mode or purchase.amount is distinct from p_amount or purchase.currency is distinct from p_currency
    or p_session is null or p_session not like 'cs_%' or p_payment is null or p_payment not like 'pi_%'
    or (purchase.checkout_session_id is not null and purchase.checkout_session_id<>p_session) then raise exception 'Payment does not match purchase'; end if;
  if purchase.paid_at is not null then
    if purchase.payment_intent_id<>p_payment then raise exception 'Payment identity conflict'; end if;
    return purchase.lot_id;
  end if;
  -- Payment identity is independently unique, including across different events/orders.
  insert into public.ai_credit_lots(org_id,operation_key,kind,credits)
    values(purchase.org_id,'stripe-credit:'||p_mode||':'||p_payment,'purchased',purchase.credits) returning id into lot;
  update public.ai_credit_purchase_orders set checkout_session_id=p_session,payment_intent_id=p_payment,paid_at=now(),lot_id=lot where id=p_id;
  return lot;
end $$;
revoke all on function public.read_ai_credit_purchases(uuid,uuid,text),public.prepare_ai_credit_purchase(uuid,uuid,uuid,text,text,text),
  public.bind_ai_credit_checkout(uuid,text),public.read_ai_credit_purchase_order(uuid),public.fulfill_ai_credit_purchase(uuid,text,text,text,integer,text) from public,anon,authenticated;
grant execute on function public.read_ai_credit_purchases(uuid,uuid,text),public.prepare_ai_credit_purchase(uuid,uuid,uuid,text,text,text),
  public.bind_ai_credit_checkout(uuid,text),public.read_ai_credit_purchase_order(uuid),public.fulfill_ai_credit_purchase(uuid,text,text,text,integer,text) to service_role;
