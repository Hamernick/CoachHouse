-- Queue one email for Karissa for each committed fiscal workflow event.
-- Applicant and Joel receipts remain in the guest submission outbox.
create table public.fiscal_staff_email_outbox (
  event_id uuid primary key references public.fiscal_sponsorship_events(id) on delete cascade,
  project_id uuid not null,
  event_type text not null,
  status text not null default 'pending' check (status in ('pending','sending','sent','failed')),
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  first_attempt_at timestamptz,
  leased_until timestamptz,
  lease_token uuid,
  provider_message_id text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.fiscal_staff_email_outbox enable row level security;
revoke all on public.fiscal_staff_email_outbox from public, anon, authenticated;
grant select, insert, update, delete on public.fiscal_staff_email_outbox to service_role;
create index fiscal_staff_email_pending on public.fiscal_staff_email_outbox(available_at) where status in ('pending','sending');

create function public.queue_fiscal_staff_email() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- Draft edits are not milestones and must not send an email on every save.
  if new.event_type not in ('draft_saved', 'application_draft_saved') then
    insert into public.fiscal_staff_email_outbox(event_id, project_id, event_type)
    values (new.id, new.project_id, new.event_type) on conflict do nothing;
  end if;
  return new;
end $$;
revoke all on function public.queue_fiscal_staff_email() from public, anon, authenticated;
create trigger fiscal_staff_email_after_event after insert on public.fiscal_sponsorship_events
for each row execute function public.queue_fiscal_staff_email();

create function public.claim_fiscal_staff_emails() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  -- Resend retains keys for 24h. Stop ambiguous retries before that expires.
  update public.fiscal_staff_email_outbox set status='failed', lease_token=null, leased_until=null
    where status in ('pending','sending')
      and (attempts >= 8 or first_attempt_at < now() - interval '23 hours')
      and (leased_until is null or leased_until <= now());
  with ready as (
    select event_id from public.fiscal_staff_email_outbox
    where (status='pending' and available_at<=now()) or (status='sending' and leased_until<=now())
    order by available_at for update skip locked limit 5
  ), claimed as (
    update public.fiscal_staff_email_outbox q set status='sending', attempts=attempts+1,
      first_attempt_at=coalesce(first_attempt_at,now()), leased_until=now()+interval '5 minutes', lease_token=gen_random_uuid()
    from ready where q.event_id=ready.event_id
    returning q.event_id, q.project_id, q.event_type, q.lease_token
  ) select coalesce(jsonb_agg(to_jsonb(claimed)), '[]'::jsonb) into result from claimed;
  return result;
end $$;

create function public.finish_fiscal_staff_email(p_event_id uuid, p_lease_token uuid, p_message_id text, p_success boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update public.fiscal_staff_email_outbox set
    status=case when p_success then 'sent' when attempts>=8 then 'failed' else 'pending' end,
    provider_message_id=case when p_success then p_message_id else provider_message_id end,
    sent_at=case when p_success then now() else null end,
    available_at=now()+make_interval(secs=>least(3600,30*power(2,attempts))::integer),
    leased_until=null, lease_token=null
  where event_id=p_event_id and lease_token=p_lease_token and status='sending';
  return found;
end $$;
revoke all on function public.claim_fiscal_staff_emails() from public, anon, authenticated;
revoke all on function public.finish_fiscal_staff_email(uuid,uuid,text,boolean) from public, anon, authenticated;
grant execute on function public.claim_fiscal_staff_emails() to service_role;
grant execute on function public.finish_fiscal_staff_email(uuid,uuid,text,boolean) to service_role;
