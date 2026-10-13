-- Fresh access links do not change applications, claims or existing verified sessions.
alter table public.fiscal_guest_email_outbox drop constraint fiscal_guest_email_outbox_kind_check;
alter table public.fiscal_guest_email_outbox add constraint fiscal_guest_email_outbox_kind_check
 check(kind in ('applicant_receipt','reviewer_notification','applicant_update','reviewer_update','applicant_recovery'));
alter table public.fiscal_guest_email_outbox add column recovery_key uuid;
alter table public.fiscal_guest_email_outbox add constraint fiscal_guest_recovery_key_check
 check ((kind='applicant_recovery') = (recovery_key is not null));
drop index public.fiscal_guest_email_original_key;
create unique index fiscal_guest_email_original_key on public.fiscal_guest_email_outbox(submission_id,kind,recipient)
 where event_id is null and kind<>'applicant_recovery';
create unique index fiscal_guest_email_recovery_key on public.fiscal_guest_email_outbox(submission_id,recovery_key)
 where recovery_key is not null;
create index fiscal_guest_email_recovery_recent on public.fiscal_guest_email_outbox(submission_id,created_at)
 where kind='applicant_recovery';

-- Only the server may call this after same-origin, captcha and durable abuse checks.
-- Always return void so unknown references, email mismatches and cooldowns look identical.
create function public.request_fiscal_guest_recovery(p_reference uuid,p_email text,p_request_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare s public.fiscal_guest_submissions%rowtype;
begin
 if p_reference is null or p_request_id is null or p_email is null or length(p_email)>254 then return; end if;
 select * into s from public.fiscal_guest_submissions
  where id=p_reference and lower(contact_email)=lower(trim(p_email)) for update;
 if not found then return; end if;
 if exists(select 1 from public.fiscal_guest_email_outbox where submission_id=s.id
  and kind='applicant_recovery' and (recovery_key=p_request_id or created_at>now()-interval '10 minutes')) then return; end if;
 insert into public.fiscal_guest_email_outbox(submission_id,kind,recipient,recovery_key)
  values(s.id,'applicant_recovery',s.contact_email,p_request_id);
end $$;
revoke all on function public.request_fiscal_guest_recovery(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.request_fiscal_guest_recovery(uuid,text,uuid) to service_role;

create or replace function public.prepare_fiscal_guest_email_proof(
  p_job_id uuid, p_lease_token uuid, p_nonce text, p_token_hash text, p_expires_at timestamptz
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_job public.fiscal_guest_email_outbox%rowtype; v_proof public.fiscal_guest_email_proofs%rowtype;
begin
  if p_nonce is null or p_nonce !~ '^[a-f0-9]{64}$' or p_token_hash is null
    or p_token_hash !~ '^[a-f0-9]{64}$' or p_expires_at is null
    or p_expires_at <= now() or p_expires_at > now()+interval '7 days' then raise exception 'Invalid email proof'; end if;
  select * into v_job from public.fiscal_guest_email_outbox where id=p_job_id for update;
  if not found or v_job.kind not in ('applicant_receipt','applicant_update','applicant_recovery') or v_job.status<>'sending'
    or v_job.lease_token is distinct from p_lease_token or v_job.leased_until<=now() then
    raise exception 'Inactive receipt lease';
  end if;
  insert into public.fiscal_guest_email_proofs(job_id,submission_id,nonce,token_hash,expires_at)
    values(v_job.id,v_job.submission_id,p_nonce,p_token_hash,p_expires_at) on conflict(job_id) do nothing;
  select * into v_proof from public.fiscal_guest_email_proofs where job_id=v_job.id;
  return jsonb_build_object('nonce',v_proof.nonce,'expiresAt',v_proof.expires_at,'tokenHash',v_proof.token_hash);
end $$;
