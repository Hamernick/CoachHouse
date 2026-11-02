-- Exact financial review only: no refund dispatch, write, pricing policy or lifecycle grant.
begin;
create function public.review_organization_closure_refunds(p_org_id uuid,p_actor_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare closure public.organization_closures%rowtype; orders jsonb; pending_runs bigint;
 pending_payments bigint; unbound_lots bigint; order_count bigint;
begin
 if p_actor_id is null or p_actor_id is distinct from p_org_id then
  raise exception 'Organization owner required' using errcode='42501'; end if;
 if current_setting('transaction_isolation')<>'read committed' then
  raise exception 'Refund review requires READ COMMITTED' using errcode='40001'; end if;
 -- Match lifecycle ownership, then take the existing accounting serialization
 -- lock without waiting in reverse order against settlement/payment writers.
 perform 1 from public.organizations where user_id=p_org_id for share;
 if not found then raise exception 'Organization unavailable' using errcode='42501'; end if;
 select * into closure from public.organization_closures where org_id=p_org_id;
 if not found or closure.state<>'closing' then
  raise exception 'Organization is not closing' using errcode='42501'; end if;
 begin
  perform 1 from public.ai_credit_policy where id for update nowait;
 exception when lock_not_available then
  raise exception 'Accounting is changing; retry refund review' using errcode='40001';
 end;
 select count(*) into pending_runs from public.workspace_ai_runs where org_id=p_org_id and settled_at is null;
 -- Expired checkout time is not proof of provider cancellation or nonpayment.
 select count(*) into pending_payments from public.ai_credit_purchase_orders where org_id=p_org_id and paid_at is null;
 select count(*) into unbound_lots from public.ai_credit_lots l where l.org_id=p_org_id and l.kind='purchased'
  and not exists(select 1 from public.ai_credit_purchase_orders o where o.lot_id=l.id and o.org_id=p_org_id and o.paid_at is not null);
 select count(*) into order_count from public.ai_credit_purchase_orders where org_id=p_org_id and paid_at is not null;
 select coalesce(jsonb_agg(jsonb_build_object(
  'orderId',s.id,'mode',s.mode,'currency',s.currency,'purchasedCredits',s.credits,'consumedCredits',s.spent,
  'unusedCredits',greatest(0,s.credits-s.spent),'paidMinorUnits',s.amount,
  'unusedMinorUnitsNumerator',(s.amount::bigint*greatest(0,s.credits-s.spent))::text,
  'unusedMinorUnitsDenominator',s.credits,
  'exactUnusedMinorUnits',case when s.spent<=s.credits and mod(s.amount::bigint*(s.credits-s.spent),s.credits)=0
    then s.amount::bigint*(s.credits-s.spent)/s.credits else null end,
  'confirmedRefundMinorUnits',s.refunded,'paymentIssue',s.issue,
  'reviewReason',case when s.spent>s.credits then 'ledger_mismatch'
    when s.issue is not null then 'payment_adjustment'
    when mod(s.amount::bigint*(s.credits-s.spent),s.credits)<>0 then 'fractional_minor_unit'
    else null end
 ) order by s.created_at,s.id),'[]'::jsonb) into orders from (
  select o.*,coalesce((select sum(e.credits) from public.ai_credit_entries e where e.lot_id=o.lot_id),0) spent,
   coalesce((select sum(r.amount) from public.ai_credit_payment_restrictions r where r.order_id=o.id and r.kind='refund' and r.status='succeeded'),0) refunded,
   public.ai_credit_purchase_payment_issue(o.id) issue
  from public.ai_credit_purchase_orders o where o.org_id=p_org_id and o.paid_at is not null order by o.created_at,o.id limit 500
 ) s;
 return jsonb_build_object('organizationId',p_org_id,'closureRequestId',closure.request_id,'closureRevision',closure.revision,
  'exportUntil',closure.export_until,'cancelWindowOpen',clock_timestamp()<closure.export_until,
  'unsettledRuns',pending_runs,'unreconciledPurchases',pending_payments,'unboundPurchasedLots',unbound_lots,
  'paidOrderCount',order_count,'truncated',order_count>500,'orders',orders,
  'dispatchAllowed',false);
end; $$;
revoke all on function public.review_organization_closure_refunds(uuid,uuid) from public,anon,authenticated;
grant execute on function public.review_organization_closure_refunds(uuid,uuid) to service_role;
comment on function public.review_organization_closure_refunds(uuid,uuid) is
 'Owner-scoped financial reconciliation after explicit closure, including after export expiry. Reports exact original purchase/consumption basis, unresolved runs/payments and fractional minor units without choosing rounding, spending credits or sending refunds. Included/promotional credits have no cash quote. Not independent backup evidence or refund completion; transition RPC remains private.';
commit;
