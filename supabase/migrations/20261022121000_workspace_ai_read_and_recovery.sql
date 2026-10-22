create function public.read_workspace_ai_account(p_org_id uuid,p_actor_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare lots jsonb; history jsonb;
begin
  if not public.can_use_workspace_ai(p_org_id,p_actor_id) then raise exception 'AI access denied' using errcode='42501'; end if;
  perform public.recover_workspace_ai_runs(p_org_id);
  select coalesce(jsonb_agg(jsonb_build_object('kind',l.kind,'expiresAt',l.expires_at,'expired',coalesce(l.expires_at<=now(),false),'credits',l.credits,
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
    'lots',lots,'history',history);
end $$;

create function public.read_workspace_ai_run(p_id uuid,p_org_id uuid,p_actor_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not public.can_use_workspace_ai(p_org_id,p_actor_id) then return null; end if;
  perform public.recover_workspace_ai_runs(p_org_id);
  return (select to_jsonb(r) from public.workspace_ai_runs r where id=p_id and org_id=p_org_id and actor_id=p_actor_id);
end $$;

-- Unknown provider outcomes retain the reservation. No timeout silently releases
-- budget or starts another provider request; reconciliation uses the response id.
create function public.reconcile_workspace_ai_run(p_id uuid,p_response_id text)
returns void language sql security definer set search_path = '' as $$
  update public.workspace_ai_runs set status='reconciling',provider_response_id=coalesce(p_response_id,provider_response_id)
    where id=p_id and settled_at is null
$$;

create function public.cancel_workspace_ai_run(p_id uuid,p_org_id uuid,p_actor_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not public.can_use_workspace_ai(p_org_id,p_actor_id) then raise exception 'AI access denied' using errcode='42501'; end if;
  update public.workspace_ai_runs set cancel_requested_at=coalesce(cancel_requested_at,clock_timestamp())
    where id=p_id and org_id=p_org_id and actor_id=p_actor_id and settled_at is null;
  return found;
end $$;

revoke all on function public.read_workspace_ai_account(uuid,uuid),
  public.read_workspace_ai_run(uuid,uuid,uuid),public.reconcile_workspace_ai_run(uuid,text),
  public.cancel_workspace_ai_run(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.read_workspace_ai_account(uuid,uuid),
  public.read_workspace_ai_run(uuid,uuid,uuid),public.reconcile_workspace_ai_run(uuid,text),
  public.cancel_workspace_ai_run(uuid,uuid,uuid) to service_role;
