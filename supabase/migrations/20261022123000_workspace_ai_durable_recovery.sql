-- Provider retention stays disabled. Persist our terminal receipt before
-- settlement; no recovery path launches another provider request.
create table public.workspace_ai_result_receipts (
  run_id uuid primary key references public.workspace_ai_runs(id) on delete restrict,
  result jsonb not null check (jsonb_typeof(result)='object' and octet_length(result::text)<=160000),
  created_at timestamptz not null default clock_timestamp()
);
create table public.workspace_ai_cost_resolutions (
  operation_id uuid primary key,
  run_id uuid not null unique references public.workspace_ai_runs(id) on delete restrict,
  operator_id uuid references auth.users(id) on delete restrict,
  evidence text not null check (length(evidence) between 1 and 1000),
  previous_bound bigint not null check (previous_bound>=0),
  measured_cost bigint not null check (measured_cost>=0),
  response_id text,
  created_at timestamptz not null default clock_timestamp()
);
alter table public.workspace_ai_result_receipts enable row level security;
alter table public.workspace_ai_cost_resolutions enable row level security;
revoke all on public.workspace_ai_result_receipts,public.workspace_ai_cost_resolutions from public,anon,authenticated;
grant select,insert on public.workspace_ai_result_receipts,public.workspace_ai_cost_resolutions to service_role;
create trigger workspace_ai_receipts_immutable before update or delete on public.workspace_ai_result_receipts
  for each row execute function public.ai_credit_immutable();
create trigger workspace_ai_cost_resolutions_immutable before update or delete on public.workspace_ai_cost_resolutions
  for each row execute function public.ai_credit_immutable();

create function public.correlate_workspace_ai_response(p_id uuid,p_response_id text)
returns void language plpgsql security definer set search_path='' as $$
declare run public.workspace_ai_runs;
begin
  if p_response_id is null or length(p_response_id) not between 1 and 200 then raise exception 'Invalid provider response'; end if;
  select * into run from public.workspace_ai_runs where id=p_id for update;
  if not found or run.status='reserved' then raise exception 'AI request not claimed'; end if;
  if run.provider_response_id is not null and run.provider_response_id<>p_response_id then raise exception 'AI provider identity conflict'; end if;
  update public.workspace_ai_runs set provider_response_id=p_response_id where id=p_id;
end $$;

create function public.record_workspace_ai_result(p_id uuid,p_status text,p_cost bigint,p_credits integer,
  p_proposal text,p_usage jsonb,p_response_id text)
returns void language plpgsql security definer set search_path='' as $$
declare run public.workspace_ai_runs; receipt jsonb; previous jsonb;
begin
  select * into run from public.workspace_ai_runs where id=p_id for update;
  if not found then raise exception 'AI request not found'; end if;
  if p_status is null or p_status not in ('succeeded','failed','canceled') or p_cost is null or p_cost<0
    or p_credits is null or p_credits<0 or p_credits>run.max_credits
    or (p_status<>'succeeded' and (p_credits<>0 or p_proposal is not null))
    or (p_status='succeeded' and (p_proposal is null or length(trim(p_proposal))=0))
    or (run.provider_response_id is not null and run.provider_response_id is distinct from p_response_id) then
    raise exception 'Invalid AI result receipt';
  end if;
  receipt:=jsonb_build_object('status',p_status,'cost',p_cost,'credits',p_credits,
    'proposal',p_proposal,'usage',p_usage,'responseId',p_response_id);
  select result into previous from public.workspace_ai_result_receipts where run_id=p_id;
  if found then
    if previous<>receipt then raise exception 'AI result identity conflict'; end if;
    return;
  end if;
  insert into public.workspace_ai_result_receipts(run_id,result) values(p_id,receipt);
end $$;

-- Trusted operations only, with a durable provider/support evidence reference.
-- Never changes customer charges or makes a failed result billable later.
create function public.resolve_workspace_ai_cost(p_id uuid,p_operation_id uuid,p_operator_id uuid,
  p_cost bigint,p_response_id text,p_evidence text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare run public.workspace_ai_runs; previous public.workspace_ai_cost_resolutions;
begin
  perform 1 from public.ai_credit_policy where id for update;
  select * into run from public.workspace_ai_runs where id=p_id for update;
  if not found then raise exception 'AI request not found'; end if;
  select * into previous from public.workspace_ai_cost_resolutions where operation_id=p_operation_id;
  if found then
    if previous.run_id<>p_id or previous.measured_cost is distinct from p_cost
      or previous.response_id is distinct from p_response_id or previous.evidence is distinct from p_evidence
      or previous.operator_id is distinct from p_operator_id then raise exception 'AI resolution identity conflict'; end if;
    return to_jsonb(run);
  end if;
  if run.provider_cost_state<>'unconfirmed' or run.settled_at is null or p_cost is null or p_cost<0
    or (run.provider_response_id is not null and run.provider_response_id is distinct from p_response_id) then
    raise exception 'Invalid AI cost resolution';
  end if;
  insert into public.workspace_ai_cost_resolutions(operation_id,run_id,operator_id,evidence,previous_bound,measured_cost,response_id)
    values(p_operation_id,p_id,p_operator_id,p_evidence,run.provider_microdollars,p_cost,p_response_id);
  update public.workspace_ai_runs set provider_microdollars=p_cost,provider_cost_state='measured',
    provider_response_id=coalesce(p_response_id,provider_response_id),settled_at=clock_timestamp()
    where id=p_id returning * into run;
  if p_cost>run.max_provider_microdollars then update public.ai_credit_policy set enabled=false where id; end if;
  return to_jsonb(run);
end $$;

create function public.settle_recorded_workspace_ai_run(p_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare run public.workspace_ai_runs; receipt jsonb;
begin
  perform 1 from public.ai_credit_policy where id for update;
  select * into run from public.workspace_ai_runs where id=p_id for update;
  select result into receipt from public.workspace_ai_result_receipts where run_id=p_id;
  if not found then raise exception 'AI result receipt not found'; end if;
  if run.provider_cost_state='unconfirmed' then
    return public.resolve_workspace_ai_cost(p_id,p_id,null,(receipt->>'cost')::bigint,
      receipt->>'responseId','Recorded provider terminal result');
  end if;
  if run.settled_at is not null then return to_jsonb(run); end if;
  return public.settle_workspace_ai_run(p_id,receipt->>'status',(receipt->>'cost')::bigint,
    (receipt->>'credits')::integer,receipt->>'proposal',receipt->'usage',receipt->>'responseId');
end $$;

create function public.recover_workspace_ai_runs(p_org_id uuid default null)
returns integer language plpgsql security definer set search_path='' as $$
declare run public.workspace_ai_runs; recovered integer:=0;
begin
  -- Same lock order as admission/settlement. A worker and a status read cannot
  -- settle twice; an unclaimed run cannot be claimed after it is released.
  perform 1 from public.ai_credit_policy where id for update;
  for run in select r.* from public.workspace_ai_runs r
    where (p_org_id is null or r.org_id=p_org_id) and (
      (r.settled_at is null and (r.created_at<now()-interval '15 minutes'
        or exists(select 1 from public.workspace_ai_result_receipts where run_id=r.id)))
      or (r.provider_cost_state='unconfirmed' and exists(select 1 from public.workspace_ai_result_receipts where run_id=r.id)))
    order by r.created_at limit 100 for update skip locked
  loop
    if exists(select 1 from public.workspace_ai_result_receipts where run_id=run.id) then
      perform public.settle_recorded_workspace_ai_run(run.id);
    else
      perform public.settle_workspace_ai_run(run.id,'failed',
        case when run.status='reserved' then 0 else run.max_provider_microdollars end,
        0,null,jsonb_build_object('recovery','expired_without_terminal_receipt'),run.provider_response_id);
      if run.status<>'reserved' then
        -- This is a conservative bound, NOT reported measured usage. Admission
        -- keeps this budget held across midnight until evidence resolves it.
        update public.workspace_ai_runs set provider_cost_state='unconfirmed' where id=run.id;
      end if;
    end if;
    recovered:=recovered+1;
  end loop;
  return recovered;
end $$;

revoke all on function public.correlate_workspace_ai_response(uuid,text),
  public.record_workspace_ai_result(uuid,text,bigint,integer,text,jsonb,text),
  public.resolve_workspace_ai_cost(uuid,uuid,uuid,bigint,text,text),
  public.settle_recorded_workspace_ai_run(uuid),public.recover_workspace_ai_runs(uuid) from public,anon,authenticated;
grant execute on function public.correlate_workspace_ai_response(uuid,text),
  public.record_workspace_ai_result(uuid,text,bigint,integer,text,jsonb,text),
  public.resolve_workspace_ai_cost(uuid,uuid,uuid,bigint,text,text),
  public.settle_recorded_workspace_ai_run(uuid),public.recover_workspace_ai_runs(uuid) to service_role;
