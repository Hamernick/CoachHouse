-- Provider acceptance and recipient-server delivery are separate facts.
-- Store only signed event identifiers/status/timestamps, never message bodies,
-- recipients, verification links or the raw webhook. Events may precede the
-- worker's acknowledgement; joining by provider ID reconciles either order.
create table public.fiscal_email_delivery_events (
  provider_event_id text primary key check (length(provider_event_id) between 1 and 200),
  provider_message_id text not null check (length(provider_message_id) between 1 and 200),
  event_type text not null check (event_type in ('email.sent','email.delivered','email.delivery_delayed','email.bounced','email.complained','email.failed','email.suppressed')),
  occurred_at timestamptz not null,
  received_at timestamptz not null default now()
);
create index fiscal_email_delivery_message_idx on public.fiscal_email_delivery_events(provider_message_id,occurred_at desc);
create index fiscal_email_delivery_retention_idx on public.fiscal_email_delivery_events(received_at);
alter table public.fiscal_email_delivery_events enable row level security;
revoke all on public.fiscal_email_delivery_events from public,anon,authenticated;
grant select,insert,delete on public.fiscal_email_delivery_events to service_role;

create function public.record_fiscal_email_delivery(p_event_id text,p_message_id text,p_event_type text,p_occurred_at timestamptz)
returns void language plpgsql security definer set search_path='' as $$
begin
  insert into public.fiscal_email_delivery_events(provider_event_id,provider_message_id,event_type,occurred_at)
  values(p_event_id,p_message_id,p_event_type,p_occurred_at) on conflict(provider_event_id) do nothing;
  if not exists(select 1 from public.fiscal_email_delivery_events where provider_event_id=p_event_id
    and provider_message_id=p_message_id and event_type=p_event_type and occurred_at=p_occurred_at) then
    raise exception 'Conflicting provider event';
  end if;
end $$;
revoke all on function public.record_fiscal_email_delivery(text,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.record_fiscal_email_delivery(text,text,text,timestamptz) to service_role;

create function public.get_fiscal_guest_email_status(p_project_id uuid,p_user_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if public.fiscal_guest_project_reviewer_access(p_project_id,p_user_id) is distinct from true then return null; end if;
  return (
    with jobs as (
      select case when o.kind in ('reviewer_notification','reviewer_update') then 'Joel' else 'Applicant' end as recipient,
        o.id, o.status, o.attempts, o.provider_message_id, o.created_at
      from public.fiscal_guest_email_outbox o join public.fiscal_guest_submissions s on s.id=o.submission_id
      where s.project_id=p_project_id
      union all
      select 'Karissa',o.event_id,o.status,o.attempts,o.provider_message_id,o.created_at
      from public.fiscal_staff_email_outbox o where o.project_id=p_project_id
    ), latest as (
      select distinct on (recipient) * from jobs order by recipient,created_at desc,id desc
    )
    select coalesce(jsonb_agg(jsonb_build_object(
      'recipient',j.recipient,'queuedAt',j.created_at,
      'status',coalesce(e.event_type,case when j.status='sent' then 'accepted'
        when j.status='failed' then 'send_failed' when j.attempts>0 then 'retrying' else 'queued' end),
      'occurredAt',e.occurred_at
    ) order by j.recipient),'[]'::jsonb)
    from latest j left join lateral (
      -- Terminal outcomes never regress to a late-arriving sent/delay event.
      select event_type,occurred_at from public.fiscal_email_delivery_events e
      where e.provider_message_id=j.provider_message_id
      order by case event_type when 'email.complained' then 7 when 'email.bounced' then 6
        when 'email.suppressed' then 5 when 'email.failed' then 4 when 'email.delivered' then 3
        when 'email.delivery_delayed' then 2 else 1 end desc,occurred_at desc,provider_event_id desc limit 1
    ) e on true
  );
end $$;
revoke all on function public.get_fiscal_guest_email_status(uuid,uuid) from public,anon;
grant execute on function public.get_fiscal_guest_email_status(uuid,uuid) to authenticated,service_role;

create function public.purge_fiscal_email_delivery_events()
returns integer language plpgsql security definer set search_path='' as $$
declare removed integer;
begin
  -- Retain linked outcomes while the outbox exists. Only orphaned receipts
  -- expire; acceptance must never replace a known bounce after cleanup.
  with expired as (
    select e.provider_event_id from public.fiscal_email_delivery_events e
    where e.received_at < now()-interval '90 days'
      and not exists(select 1 from public.fiscal_guest_email_outbox o where o.provider_message_id=e.provider_message_id)
      and not exists(select 1 from public.fiscal_staff_email_outbox o where o.provider_message_id=e.provider_message_id)
    order by e.received_at limit 500 for update skip locked
  ) delete from public.fiscal_email_delivery_events e using expired x where x.provider_event_id=e.provider_event_id;
  get diagnostics removed=row_count;
  return removed;
end $$;
create index fiscal_guest_email_provider_idx on public.fiscal_guest_email_outbox(provider_message_id) where provider_message_id is not null;
create index fiscal_staff_email_provider_idx on public.fiscal_staff_email_outbox(provider_message_id) where provider_message_id is not null;
revoke all on function public.purge_fiscal_email_delivery_events() from public,anon,authenticated;
grant execute on function public.purge_fiscal_email_delivery_events() to service_role;
