-- Private reconciliation journal, not closure activation or provider dispatch.
begin;
create table public.organization_closure_refunds (
 id uuid primary key default gen_random_uuid(),
 org_id uuid not null references public.organizations(user_id),
 closure_request_id uuid not null, closure_revision integer not null,
 order_id uuid not null unique references public.ai_credit_purchase_orders(id),
 payment_intent_id text not null, mode text not null check(mode in('test','live')),
 currency text not null, amount integer not null check(amount>0),
 paid_minor_units integer not null check(paid_minor_units>0), purchased_credits integer not null, consumed_credits bigint not null,
 state text not null default 'ready' check(state in('ready','dispatching','uncertain','pending','requires_action','succeeded','failed','canceled')),
 refund_id text, reason text,
 created_at timestamptz not null default clock_timestamp(),
 started_at timestamptz, updated_at timestamptz not null default clock_timestamp(),
 unique(mode,refund_id)
);
alter table public.organization_closure_refunds enable row level security;
revoke all on public.organization_closure_refunds from public,anon,authenticated,service_role;
create function public.guard_closure_refund_identity() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' or (to_jsonb(old)-array['state','refund_id','reason','started_at','updated_at'])
   is distinct from (to_jsonb(new)-array['state','refund_id','reason','started_at','updated_at'])
   or (old.refund_id is not null and old.refund_id is distinct from new.refund_id)
   or (old.started_at is not null and old.started_at is distinct from new.started_at)
   or (old.state<>'ready' and new.state='ready') then
  raise exception 'Closure refund identity is immutable' using errcode='42501'; end if;
 return new;
end $$;
create trigger closure_refund_identity before update or delete on public.organization_closure_refunds
 for each row execute function public.guard_closure_refund_identity();
revoke all on function public.guard_closure_refund_identity() from public,anon,authenticated,service_role;

-- Eligibility is recomputed at prepare AND the one-shot dispatch claim under
-- the same organization/accounting locks used by closure and settlement.
create function public.closure_refund_basis(p_org uuid,p_order uuid,p_actor uuid) returns jsonb
 language plpgsql security definer set search_path='' as $$
declare report jsonb; item jsonb; purchase public.ai_credit_purchase_orders%rowtype; reason text;
begin
 report:=public.review_organization_closure_refunds(p_org,p_actor);
 select * into purchase from public.ai_credit_purchase_orders where id=p_order and org_id=p_org;
 if not found then raise exception 'Purchase unavailable' using errcode='42501'; end if;
 select value into item from jsonb_array_elements(report->'orders') where value->>'orderId'=p_order::text;
 reason:=case
  when (report->>'cancelWindowOpen')::boolean then 'cancellation_window_open'
  when (report->>'truncated')::boolean then 'purchase_inventory_incomplete'
  when (report->>'unsettledRuns')::bigint>0 then 'unsettled_runs'
  when (report->>'unreconciledPurchases')::bigint>0 then 'unreconciled_purchases'
  when (report->>'unboundPurchasedLots')::bigint>0 then 'unbound_purchased_lots'
  when item is null or purchase.paid_at is null or purchase.payment_intent_id is null then 'payment_unconfirmed'
  when exists(select 1 from public.ai_credit_payment_restrictions where order_id=p_order
    and (kind in('refund','dispute') or blocked)) then 'prior_payment_adjustment'
  when item->>'reviewReason' is not null then item->>'reviewReason'
  when item->>'exactUnusedMinorUnits' is null then 'fractional_minor_unit'
  when (item->>'exactUnusedMinorUnits')::bigint=0 then 'no_unused_balance'
  else null end;
 return jsonb_build_object('reason',reason,'report',report-'orders','item',item,'order',to_jsonb(purchase));
end $$;
revoke all on function public.closure_refund_basis(uuid,uuid,uuid) from public,anon,authenticated,service_role;

create function public.read_organization_closure_refund(p_org uuid,p_order uuid,p_actor uuid) returns jsonb
 language plpgsql security definer set search_path='' as $$
declare intent public.organization_closure_refunds%rowtype; purchase public.ai_credit_purchase_orders%rowtype;
begin
 if p_actor is null or p_actor is distinct from p_org or not exists(select 1 from public.organizations where user_id=p_org)
 then raise exception 'Organization owner required' using errcode='42501'; end if;
 select * into purchase from public.ai_credit_purchase_orders where id=p_order and org_id=p_org;
 if not found then raise exception 'Purchase unavailable' using errcode='42501'; end if;
 select * into intent from public.organization_closure_refunds where order_id=p_order and org_id=p_org;
 return jsonb_build_object('intent',case when intent.id is null then null else to_jsonb(intent) end,'order',to_jsonb(purchase),'dispatchAllowed',false);
end $$;
create function public.prepare_organization_closure_refund(p_org uuid,p_order uuid,p_actor uuid) returns jsonb
 language plpgsql security definer set search_path='' as $$
declare basis jsonb; existing public.organization_closure_refunds%rowtype;
begin
 basis:=public.closure_refund_basis(p_org,p_order,p_actor);
 select * into existing from public.organization_closure_refunds where order_id=p_order;
 if existing.id is not null then return public.read_organization_closure_refund(p_org,p_order,p_actor); end if;
 if basis->>'reason' is not null then return jsonb_build_object('intent',null,'order',basis->'order','reason',basis->>'reason','dispatchAllowed',false); end if;
 insert into public.organization_closure_refunds(org_id,closure_request_id,closure_revision,order_id,payment_intent_id,mode,currency,amount,paid_minor_units,purchased_credits,consumed_credits)
 values(p_org,(basis#>>'{report,closureRequestId}')::uuid,(basis#>>'{report,closureRevision}')::integer,p_order,
 basis#>>'{order,payment_intent_id}',basis#>>'{order,mode}',basis#>>'{order,currency}',(basis#>>'{item,exactUnusedMinorUnits}')::integer,
 (basis#>>'{order,amount}')::integer,(basis#>>'{item,purchasedCredits}')::integer,(basis#>>'{item,consumedCredits}')::bigint);
 return public.read_organization_closure_refund(p_org,p_order,p_actor);
end $$;
create function public.claim_organization_closure_refund(p_org uuid,p_order uuid,p_actor uuid) returns jsonb
 language plpgsql security definer set search_path='' as $$
declare basis jsonb; intent public.organization_closure_refunds%rowtype; result jsonb;
begin
 basis:=public.closure_refund_basis(p_org,p_order,p_actor);
 select * into intent from public.organization_closure_refunds where org_id=p_org and order_id=p_order for update;
 if not found then raise exception 'Prepare refund first' using errcode='22023'; end if;
 if intent.state<>'ready' then return public.read_organization_closure_refund(p_org,p_order,p_actor); end if;
 if basis->>'reason' is not null then
  update public.organization_closure_refunds set reason=basis->>'reason',updated_at=clock_timestamp() where id=intent.id;
  return public.read_organization_closure_refund(p_org,p_order,p_actor);
 end if;
 if intent.closure_request_id is distinct from (basis#>>'{report,closureRequestId}')::uuid
  or intent.closure_revision is distinct from (basis#>>'{report,closureRevision}')::integer
  or intent.amount is distinct from (basis#>>'{item,exactUnusedMinorUnits}')::integer
  or intent.paid_minor_units is distinct from (basis#>>'{order,amount}')::integer
  or intent.purchased_credits is distinct from (basis#>>'{item,purchasedCredits}')::integer
  or intent.consumed_credits is distinct from (basis#>>'{item,consumedCredits}')::bigint
  or intent.payment_intent_id is distinct from basis#>>'{order,payment_intent_id}'
  or intent.mode is distinct from basis#>>'{order,mode}' or intent.currency is distinct from basis#>>'{order,currency}'
 then raise exception 'Refund basis changed' using errcode='40001'; end if;
 update public.organization_closure_refunds set state='dispatching',started_at=clock_timestamp(),updated_at=clock_timestamp(),reason=null where id=intent.id;
 result:=public.read_organization_closure_refund(p_org,p_order,p_actor);
 return result||jsonb_build_object('dispatchAllowed',true);
end $$;

-- Verified late provider results remain recordable independently of content
-- expiry. Original payment adjustment history owns financial effects.
create function public.record_organization_closure_refund(p_id uuid,p_refund text,p_status text,p_amount integer,p_currency text,p_payment text,p_mode text,p_created bigint)
 returns jsonb language plpgsql security definer set search_path='' as $$
declare intent public.organization_closure_refunds%rowtype; current_status text;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'Read committed required' using errcode='40001'; end if;
 perform 1 from public.ai_credit_policy where id for update;
 select * into intent from public.organization_closure_refunds where id=p_id for update;
 if not found or intent.started_at is null then raise exception 'Refund dispatch unavailable' using errcode='42501'; end if;
 if p_status='uncertain' then
  if p_refund is not null then raise exception 'Uncertain refund has no provider identity' using errcode='22023'; end if;
  if intent.state='dispatching' then update public.organization_closure_refunds set state='uncertain',reason='provider_result_unconfirmed',updated_at=clock_timestamp() where id=p_id; end if;
 else
  if p_refund is null or p_refund not like 're_%' or p_status not in('pending','requires_action','succeeded','failed','canceled')
   or p_amount is distinct from intent.amount or p_currency is distinct from intent.currency
   or p_payment is distinct from intent.payment_intent_id or p_mode is distinct from intent.mode
   or (intent.refund_id is not null and intent.refund_id<>p_refund) then raise exception 'Refund identity mismatch' using errcode='42501'; end if;
  perform public.record_ai_credit_payment_restriction(intent.order_id,p_payment,p_mode,'refund',p_refund,p_status,p_amount,p_currency,
   'closure-refund:'||p_id::text||':'||p_refund||':'||p_status,p_created);
  select status into current_status from public.ai_credit_payment_restrictions where order_id=intent.order_id and kind='refund' and provider_id=p_refund;
  update public.organization_closure_refunds set refund_id=p_refund,state=current_status,
   reason=case when current_status='succeeded' then null else 'provider_'||current_status end,updated_at=clock_timestamp() where id=p_id;
 end if;
 return public.read_organization_closure_refund(intent.org_id,intent.order_id,intent.org_id);
end $$;
revoke all on function public.read_organization_closure_refund(uuid,uuid,uuid),public.prepare_organization_closure_refund(uuid,uuid,uuid),public.claim_organization_closure_refund(uuid,uuid,uuid),public.record_organization_closure_refund(uuid,text,text,integer,text,text,text,bigint) from public,anon,authenticated;
grant execute on function public.read_organization_closure_refund(uuid,uuid,uuid),public.prepare_organization_closure_refund(uuid,uuid,uuid),public.claim_organization_closure_refund(uuid,uuid,uuid),public.record_organization_closure_refund(uuid,text,text,integer,text,text,text,bigint) to service_role;
comment on table public.organization_closure_refunds is 'Immutable exact-amount closure refund identity and one-shot provider admission. No automatic retry after dispatch, no rounding policy, provider activation, purge permission or new content access. Financial evidence survives content export expiry.';
commit;
