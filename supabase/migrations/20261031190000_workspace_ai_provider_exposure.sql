-- Operator-configured provider expense is separate from customer credit limits.
-- No price, allowance, wallet, provider or live flag is enabled here. NULL keeps
-- new admission closed until an explicit per-organization safety cap is set.
alter table public.ai_credit_policy add column org_daily_provider_microdollars bigint
  check (org_daily_provider_microdollars > 0);

-- Private accounting projection. Unsettled and uncertain costs survive UTC
-- day boundaries. Unconfirmed estimates can never release reserved exposure.
create function public.workspace_ai_provider_exposure(p_org_id uuid default null)
returns numeric language sql stable security definer set search_path='' as $$
  select coalesce(sum(case
    when settled_at is null or provider_cost_state='unconfirmed'
      then greatest(max_provider_microdollars,coalesce(provider_microdollars,0))
    else provider_microdollars end),0)
  from public.workspace_ai_runs
  where (p_org_id is null or org_id=p_org_id) and (
    settled_at is null or provider_cost_state='unconfirmed'
    or settled_at >= date_trunc('day',now() at time zone 'UTC') at time zone 'UTC')
$$;
revoke all on function public.workspace_ai_provider_exposure(uuid) from public,anon,authenticated,service_role;

-- Keep the existing admission/settlement lock and single run ledger. Customer
-- balance changes and purchases cannot reset either provider-spend window.
create or replace function public.reserve_workspace_ai_run(p_id uuid,p_org_id uuid,p_actor_id uuid,p_hash text,p_target jsonb,p_prompt text,p_tariff jsonb,p_max_credits integer,p_max_cost integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare policy public.ai_credit_policy; org_limit integer; member_limit integer;
begin
  if not public.can_use_workspace_ai(p_org_id,p_actor_id) then raise exception 'AI access denied' using errcode='42501'; end if;
  select * into policy from public.ai_credit_policy where id for update;
  -- Existing identities still reach the original identity validator. Lowered
  -- caps or disabled policy cannot turn a committed run into a fresh denial.
  if not exists(select 1 from public.workspace_ai_runs where id=p_id) then
    if policy.org_daily_provider_microdollars is null then
      raise exception 'AI provider safety limits are not configured';
    end if;
    if public.workspace_ai_provider_exposure(p_org_id)+p_max_cost>policy.org_daily_provider_microdollars then
      raise exception 'Organization daily AI service limit reached';
    end if;
    if public.workspace_ai_provider_exposure(null)+p_max_cost>policy.daily_provider_microdollars then
      raise exception 'AI daily service limit reached';
    end if;
    select monthly_credit_limit into org_limit from public.ai_credit_wallets where org_id=p_org_id;
    select monthly_credit_limit into member_limit from public.ai_credit_member_limits where org_id=p_org_id and member_id=p_actor_id;
    if org_limit is not null and public.workspace_ai_monthly_usage(p_org_id)+p_max_credits>org_limit then raise exception 'Organization monthly AI credit limit reached'; end if;
    if member_limit is not null and public.workspace_ai_monthly_usage(p_org_id,p_actor_id)+p_max_credits>member_limit then raise exception 'Your monthly AI credit limit reached'; end if;
  end if;
  return public.reserve_workspace_ai_run_service_limits(p_id,p_org_id,p_actor_id,p_hash,p_target,p_prompt,p_tariff,p_max_credits,p_max_cost);
end $$;
revoke all on function public.reserve_workspace_ai_run(uuid,uuid,uuid,text,jsonb,text,jsonb,integer,integer) from public,anon,authenticated;
grant execute on function public.reserve_workspace_ai_run(uuid,uuid,uuid,text,jsonb,text,jsonb,integer,integer) to service_role;
