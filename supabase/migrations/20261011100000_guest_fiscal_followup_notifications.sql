alter table public.fiscal_guest_email_outbox drop constraint fiscal_guest_email_outbox_kind_check;
alter table public.fiscal_guest_email_outbox add constraint fiscal_guest_email_outbox_kind_check
 check(kind in ('applicant_receipt','reviewer_notification','applicant_update','reviewer_update'));
alter table public.fiscal_guest_email_outbox add column event_id uuid references public.fiscal_sponsorship_events(id);
alter table public.fiscal_guest_email_outbox drop constraint fiscal_guest_email_outbox_submission_id_kind_recipient_key;
create unique index fiscal_guest_email_original_key on public.fiscal_guest_email_outbox(submission_id,kind,recipient) where event_id is null;
create unique index fiscal_guest_email_event_key on public.fiscal_guest_email_outbox(event_id,kind,recipient) where event_id is not null;

create function public.queue_fiscal_guest_followup_email() returns trigger
language plpgsql security definer set search_path = '' as $$
declare s public.fiscal_guest_submissions%rowtype;
begin
 select * into s from public.fiscal_guest_submissions where application_id=new.application_id;
 if not found then return new; end if;
 if new.event_type in ('application_needs_info','application_approved','application_declined') then
  insert into public.fiscal_guest_email_outbox(submission_id,kind,recipient,event_id)
   values(s.id,'applicant_update',s.contact_email,new.id) on conflict do nothing;
 elsif new.event_type='application_submitted' and new.metadata->>'previousStatus'='needs_info' then
  insert into public.fiscal_guest_email_outbox(submission_id,kind,recipient,event_id)
   values(s.id,'applicant_update',s.contact_email,new.id),
    (s.id,'reviewer_update','joel@coachhousesolutions.org',new.id) on conflict do nothing;
 end if;
 return new;
end $$;
revoke all on function public.queue_fiscal_guest_followup_email() from public,anon,authenticated;
create trigger fiscal_guest_followup_after_event after insert on public.fiscal_sponsorship_events
 for each row execute function public.queue_fiscal_guest_followup_email();

create or replace function public.claim_fiscal_guest_emails() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
 update public.fiscal_guest_email_outbox q set status='failed',last_error_code='reviewer_unavailable',lease_token=null,leased_until=null
 where q.kind in ('reviewer_notification','reviewer_update') and q.status in ('pending','sending')
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

create or replace function public.prepare_fiscal_guest_email_proof(
  p_job_id uuid, p_lease_token uuid, p_nonce text, p_token_hash text, p_expires_at timestamptz
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_job public.fiscal_guest_email_outbox%rowtype; v_proof public.fiscal_guest_email_proofs%rowtype;
begin
  if p_nonce is null or p_nonce !~ '^[a-f0-9]{64}$' or p_token_hash is null
    or p_token_hash !~ '^[a-f0-9]{64}$' or p_expires_at is null
    or p_expires_at <= now() or p_expires_at > now()+interval '7 days' then raise exception 'Invalid email proof'; end if;
  select * into v_job from public.fiscal_guest_email_outbox where id=p_job_id for update;
  if not found or v_job.kind not in ('applicant_receipt','applicant_update') or v_job.status<>'sending'
    or v_job.lease_token is distinct from p_lease_token or v_job.leased_until<=now() then
    raise exception 'Inactive receipt lease';
  end if;
  insert into public.fiscal_guest_email_proofs(job_id,submission_id,nonce,token_hash,expires_at)
    values(v_job.id,v_job.submission_id,p_nonce,p_token_hash,p_expires_at) on conflict(job_id) do nothing;
  select * into v_proof from public.fiscal_guest_email_proofs where job_id=v_job.id;
  return jsonb_build_object('nonce',v_proof.nonce,'expiresAt',v_proof.expires_at,'tokenHash',v_proof.token_hash);
end $$;
