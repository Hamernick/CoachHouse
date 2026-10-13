-- Durable guest delivery. Frozen receipt copy intentionally includes no private answers.
alter table public.fiscal_guest_email_outbox add column first_attempt_at timestamptz;
alter table public.fiscal_guest_email_outbox add column lease_token uuid;
create function public.claim_fiscal_guest_emails() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
 update public.fiscal_guest_email_outbox q set status='failed',last_error_code='reviewer_unavailable',lease_token=null,leased_until=null
 where q.kind='reviewer_notification' and q.status in ('pending','sending')
 and (q.leased_until is null or q.leased_until<=now()) and not exists (
  select 1 from public.fiscal_guest_submissions s
  join public.fiscal_project_reviewers r on r.project_id=s.project_id
  join public.platform_staff_members staff on staff.user_id=r.user_id
  join public.profiles profile on profile.id=staff.user_id
  where s.id=q.submission_id and lower(profile.email)=lower(q.recipient)
 );
 update public.fiscal_guest_email_outbox set status='failed',lease_token=null,leased_until=null
 where status in ('pending','sending') and (attempts>=8 or first_attempt_at<now()-interval '23 hours')
   and (leased_until is null or leased_until<=now());
 with ready as (
  select id from public.fiscal_guest_email_outbox
  where (status='pending' and available_at<=now()) or (status='sending' and leased_until<=now())
  order by available_at,id for update skip locked limit 3
 ), claimed as (
  update public.fiscal_guest_email_outbox q set status='sending',attempts=attempts+1,
   first_attempt_at=coalesce(first_attempt_at,now()),leased_until=now()+interval '5 minutes',lease_token=gen_random_uuid()
  from ready where q.id=ready.id returning q.id,q.submission_id,q.kind,q.recipient,q.lease_token
 ) select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'submissionId',c.submission_id,
    'projectId',s.project_id,'kind',c.kind,'recipient',c.recipient,'leaseToken',c.lease_token)), '[]'::jsonb)
 into result from claimed c join public.fiscal_guest_submissions s on s.id=c.submission_id;
 return result;
end $$;
create function public.finish_fiscal_guest_email(p_id uuid,p_lease_token uuid,p_message_id text,p_success boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
 update public.fiscal_guest_email_outbox set
  status=case when p_success then 'sent' when attempts>=8 then 'failed' else 'pending' end,
  provider_message_id=case when p_success then p_message_id else provider_message_id end,
  last_error_code=case when p_success then null else 'provider_unavailable' end,
  sent_at=case when p_success then now() else null end,
  available_at=now()+make_interval(secs=>least(3600,30*power(2,attempts))::integer),
  leased_until=null,lease_token=null
 where id=p_id and lease_token=p_lease_token and status='sending';
 return found;
end $$;
revoke all on function public.claim_fiscal_guest_emails(), public.finish_fiscal_guest_email(uuid,uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.claim_fiscal_guest_emails(), public.finish_fiscal_guest_email(uuid,uuid,text,boolean) to service_role;

-- Expiring HMAC buckets: never store raw IP addresses or applicant email here.
create table public.fiscal_guest_request_limits (
 key_hash text primary key check(key_hash ~ '^[a-f0-9]{64}$'),
 attempts integer not null, expires_at timestamptz not null
);
create index fiscal_guest_request_limits_expiry on public.fiscal_guest_request_limits(expires_at);
alter table public.fiscal_guest_request_limits enable row level security;
revoke all on public.fiscal_guest_request_limits from public,anon,authenticated;
grant select,insert,update,delete on public.fiscal_guest_request_limits to service_role;
create function public.consume_fiscal_guest_limit(p_key_hash text,p_limit integer,p_window_seconds integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare accepted boolean;
begin
 if p_key_hash is null or p_key_hash !~ '^[a-f0-9]{64}$' or p_limit not between 1 and 100
  or p_window_seconds not between 60 and 86400 or p_limit is null or p_window_seconds is null then
  raise exception 'Invalid limit' using errcode='22023';
 end if;
 delete from public.fiscal_guest_request_limits where key_hash in (
  select key_hash from public.fiscal_guest_request_limits where expires_at<now()-interval '1 day' limit 50
 );
 insert into public.fiscal_guest_request_limits values(p_key_hash,1,now()+make_interval(secs=>p_window_seconds))
 on conflict(key_hash) do update set
  attempts=case when fiscal_guest_request_limits.expires_at<=now() then 1 else fiscal_guest_request_limits.attempts+1 end,
  expires_at=case when fiscal_guest_request_limits.expires_at<=now() then now()+make_interval(secs=>p_window_seconds) else fiscal_guest_request_limits.expires_at end
 where fiscal_guest_request_limits.expires_at<=now() or fiscal_guest_request_limits.attempts<p_limit
 returning true into accepted;
 return coalesce(accepted,false);
end $$;
create function public.get_fiscal_guest_receipt(p_key_hash text) returns jsonb
language sql stable security definer set search_path = '' as $$
 select jsonb_build_object('submissionId',id) from public.fiscal_guest_submissions where submission_key_hash=p_key_hash
$$;
revoke all on function public.consume_fiscal_guest_limit(text,integer,integer),public.get_fiscal_guest_receipt(text) from public,anon,authenticated;
grant execute on function public.consume_fiscal_guest_limit(text,integer,integer),public.get_fiscal_guest_receipt(text) to service_role;
