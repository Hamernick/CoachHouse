-- No entitlements are seeded. Commercial policies require explicit configuration.
create table public.ai_credit_allowance_rules (
  key text primary key check(length(key) between 1 and 100),
  mode text not null check(mode in ('test','live')),
  price_id text not null check(price_id like 'price_%'),
  label text not null check(length(label) between 1 and 100),
  credits integer not null check(credits between 1 and 100000000),
  amount integer not null check(amount>0),
  currency text not null check(currency~'^[a-z]{3}$'),
  allow_discounted boolean not null default false,
  enabled boolean not null default false
);
create unique index ai_credit_allowance_enabled_price on public.ai_credit_allowance_rules(mode,price_id) where enabled;
create table public.ai_credit_subscription_bindings (
  mode text not null check(mode in ('test','live')),
  subscription_id text not null check(subscription_id like 'sub_%'),
  customer_id text not null check(customer_id like 'cus_%'),
  owner_id uuid not null references auth.users(id),
  org_id uuid not null references public.organizations(user_id),
  operation_id uuid not null unique,
  created_at timestamptz not null default clock_timestamp(),
  primary key(mode,subscription_id),
  unique(mode,org_id)
);
create table public.ai_credit_allowance_grants (
  mode text not null, subscription_id text not null,
  period_start timestamptz not null, period_end timestamptz not null check(period_end>period_start),
  invoice_id text not null check(invoice_id like 'in_%'),
  rule_key text not null references public.ai_credit_allowance_rules(key),
  lot_id uuid not null unique references public.ai_credit_lots(id),
  recorded_at timestamptz not null default clock_timestamp(),
  primary key(mode,subscription_id,period_start),
  unique(mode,invoice_id),
  foreign key(mode,subscription_id) references public.ai_credit_subscription_bindings(mode,subscription_id)
);
alter table public.ai_credit_allowance_rules enable row level security;
alter table public.ai_credit_subscription_bindings enable row level security;
alter table public.ai_credit_allowance_grants enable row level security;
revoke all on public.ai_credit_allowance_rules,public.ai_credit_subscription_bindings,public.ai_credit_allowance_grants from public,anon,authenticated,service_role;
grant select,insert on public.ai_credit_allowance_rules to service_role;
grant update(enabled) on public.ai_credit_allowance_rules to service_role;
create trigger ai_credit_subscription_binding_immutable before update or delete on public.ai_credit_subscription_bindings
  for each row execute function public.ai_credit_immutable();
create trigger ai_credit_allowance_grant_immutable before update or delete on public.ai_credit_allowance_grants
  for each row execute function public.ai_credit_immutable();

create function public.read_ai_credit_allowance_setup(p_org_id uuid,p_actor_id uuid,p_mode text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare rules jsonb; binding jsonb; current_grant jsonb;
begin
  if not public.can_use_workspace_ai(p_org_id,p_actor_id) or p_org_id<>p_actor_id then raise exception 'Allowance owner access denied' using errcode='42501'; end if;
  select coalesce(jsonb_agg(to_jsonb(r) order by r.label),'[]') into rules from public.ai_credit_allowance_rules r where mode=p_mode and enabled;
  select to_jsonb(b) into binding from public.ai_credit_subscription_bindings b where org_id=p_org_id and mode=p_mode;
  select jsonb_build_object('label',r.label,'credits',l.credits,'expiresAt',g.period_end) into current_grant
    from public.ai_credit_subscription_bindings b join public.ai_credit_allowance_grants g using(mode,subscription_id)
      join public.ai_credit_allowance_rules r on r.key=g.rule_key join public.ai_credit_lots l on l.id=g.lot_id
    where b.org_id=p_org_id and b.mode=p_mode and g.period_start<=now() and g.period_end>now() order by g.period_start desc limit 1;
  return jsonb_build_object('rules',rules,'binding',binding,'grant',current_grant,
    'organizationName',coalesce((select nullif(profile->>'name','') from public.organizations where user_id=p_org_id),'this organization'));
end $$;

create function public.bind_ai_credit_subscription(p_org_id uuid,p_actor_id uuid,p_mode text,p_subscription text,p_customer text,p_operation_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare prior public.ai_credit_subscription_bindings;
begin
  if not public.can_use_workspace_ai(p_org_id,p_actor_id) or p_org_id<>p_actor_id then raise exception 'Allowance owner access denied' using errcode='42501'; end if;
  perform 1 from public.ai_credit_policy where id for update;
  select * into prior from public.ai_credit_subscription_bindings where (mode=p_mode and (subscription_id=p_subscription or org_id=p_org_id)) or operation_id=p_operation_id;
  if found then
    if prior.mode<>p_mode or prior.subscription_id<>p_subscription or prior.customer_id<>p_customer or prior.owner_id<>p_actor_id or prior.org_id<>p_org_id then
      raise exception 'Subscription allowance already assigned. Assignment changes require review for a future period';
    end if;
    return;
  end if;
  if not exists(select 1 from public.subscriptions where user_id=p_actor_id and stripe_subscription_id=p_subscription
    and stripe_customer_id=p_customer and status='active' and metadata->>'stripe_mode'=p_mode) then raise exception 'Verified active subscription required'; end if;
  insert into public.ai_credit_subscription_bindings(mode,subscription_id,customer_id,owner_id,org_id,operation_id)
    values(p_mode,p_subscription,p_customer,p_actor_id,p_org_id,p_operation_id);
  insert into public.ai_credit_wallets(org_id,enabled) values(p_org_id,true) on conflict(org_id) do nothing;
end $$;

create function public.find_ai_credit_subscription_binding(p_mode text,p_subscription text)
returns jsonb language sql stable security definer set search_path='' as $$
  select to_jsonb(b) from public.ai_credit_subscription_bindings b where mode=p_mode and subscription_id=p_subscription
$$;

create function public.grant_ai_credit_allowance(p_mode text,p_subscription text,p_customer text,p_rule_key text,p_invoice text,p_start timestamptz,p_end timestamptz)
returns uuid language plpgsql security definer set search_path='' as $$
declare binding public.ai_credit_subscription_bindings; rule public.ai_credit_allowance_rules; prior public.ai_credit_allowance_grants; lot uuid;
begin
  perform 1 from public.ai_credit_policy where id for update;
  select * into binding from public.ai_credit_subscription_bindings where mode=p_mode and subscription_id=p_subscription;
  if not found or binding.customer_id is distinct from p_customer then raise exception 'Subscription assignment mismatch'; end if;
  select * into prior from public.ai_credit_allowance_grants where mode=p_mode and (invoice_id=p_invoice or (subscription_id=p_subscription and period_start=p_start));
  if found then
    if prior.subscription_id<>p_subscription or prior.period_start<>p_start or prior.period_end<>p_end or prior.invoice_id<>p_invoice then raise exception 'Allowance grant identity conflict'; end if;
    return prior.lot_id;
  end if;
  select * into rule from public.ai_credit_allowance_rules where key=p_rule_key and mode=p_mode and enabled;
  if not found or not exists(select 1 from public.subscriptions where user_id=binding.owner_id and stripe_subscription_id=p_subscription
    and stripe_customer_id=p_customer and status='active' and metadata->>'stripe_mode'=p_mode) then raise exception 'Verified active allowance required'; end if;
  if p_start is null or p_end is null or p_start>now() or p_end<=now() or p_end<=p_start or p_end-p_start<interval '27 days' or p_end-p_start>interval '32 days' then
    raise exception 'Only a current full monthly entitlement is supported'; end if;
  if exists(select 1 from public.ai_credit_allowance_grants where mode=p_mode and subscription_id=p_subscription and period_start<p_end and period_end>p_start) then
    raise exception 'Overlapping allowance period'; end if;
  insert into public.ai_credit_lots(org_id,operation_key,kind,credits,expires_at)
    values(binding.org_id,'stripe-allowance:'||p_mode||':'||p_subscription||':'||p_invoice,'included',rule.credits,p_end) returning id into lot;
  insert into public.ai_credit_allowance_grants(mode,subscription_id,period_start,period_end,invoice_id,rule_key,lot_id)
    values(p_mode,p_subscription,p_start,p_end,p_invoice,p_rule_key,lot);
  return lot;
end $$;
revoke all on function public.read_ai_credit_allowance_setup(uuid,uuid,text),public.bind_ai_credit_subscription(uuid,uuid,text,text,text,uuid),
  public.find_ai_credit_subscription_binding(text,text),public.grant_ai_credit_allowance(text,text,text,text,text,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.read_ai_credit_allowance_setup(uuid,uuid,text),public.bind_ai_credit_subscription(uuid,uuid,text,text,text,uuid),
  public.find_ai_credit_subscription_binding(text,text),public.grant_ai_credit_allowance(text,text,text,text,text,timestamptz,timestamptz) to service_role;
