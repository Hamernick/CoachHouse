create table public.fiscal_guest_email_proofs (
  job_id uuid primary key references public.fiscal_guest_email_outbox(id),
  submission_id uuid not null references public.fiscal_guest_submissions(id),
  nonce text not null check (nonce ~ '^[a-f0-9]{64}$'),
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  consumed_session_hash text check (consumed_session_hash ~ '^[a-f0-9]{64}$'),
  check ((consumed_at is null) = (consumed_session_hash is null))
);
create table public.fiscal_guest_verified_sessions (
  key_hash text not null check (key_hash ~ '^[a-f0-9]{64}$'),
  submission_id uuid not null references public.fiscal_guest_submissions(id),
  expires_at timestamptz not null,
  primary key(key_hash, submission_id)
);
create index fiscal_guest_email_proofs_expiry_idx on public.fiscal_guest_email_proofs(expires_at);
create index fiscal_guest_verified_sessions_expiry_idx on public.fiscal_guest_verified_sessions(expires_at);
alter table public.fiscal_guest_email_proofs enable row level security;
alter table public.fiscal_guest_verified_sessions enable row level security;
revoke all on public.fiscal_guest_email_proofs, public.fiscal_guest_verified_sessions from public, anon, authenticated;
grant select, insert, update, delete on public.fiscal_guest_email_proofs, public.fiscal_guest_verified_sessions to service_role;

-- Freeze link material before sending, so all retries use identical email copy.
-- Nonce is not a bearer secret: the server HMAC key is also required.
create function public.prepare_fiscal_guest_email_proof(
  p_job_id uuid, p_lease_token uuid, p_nonce text, p_token_hash text, p_expires_at timestamptz
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_job public.fiscal_guest_email_outbox%rowtype; v_proof public.fiscal_guest_email_proofs%rowtype;
begin
  if p_nonce is null or p_nonce !~ '^[a-f0-9]{64}$' or p_token_hash is null
    or p_token_hash !~ '^[a-f0-9]{64}$' or p_expires_at is null
    or p_expires_at <= now() or p_expires_at > now()+interval '7 days' then raise exception 'Invalid email proof'; end if;
  select * into v_job from public.fiscal_guest_email_outbox where id=p_job_id for update;
  if not found or v_job.kind<>'applicant_receipt' or v_job.status<>'sending'
    or v_job.lease_token is distinct from p_lease_token or v_job.leased_until<=now() then
    raise exception 'Inactive receipt lease';
  end if;
  insert into public.fiscal_guest_email_proofs(job_id,submission_id,nonce,token_hash,expires_at)
    values(v_job.id,v_job.submission_id,p_nonce,p_token_hash,p_expires_at) on conflict(job_id) do nothing;
  select * into v_proof from public.fiscal_guest_email_proofs where job_id=v_job.id;
  return jsonb_build_object('nonce',v_proof.nonce,'expiresAt',v_proof.expires_at,'tokenHash',v_proof.token_hash);
end $$;

-- Explicit POST endpoint only. Matching browser retries can recover a lost ack;
-- another browser cannot replay an already exchanged proof.
create function public.verify_fiscal_guest_email(p_token_hash text,p_key_hash text,p_expires_at timestamptz)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_proof public.fiscal_guest_email_proofs%rowtype;
begin
  if p_key_hash is null or p_key_hash !~ '^[a-f0-9]{64}$' or p_token_hash is null
    or p_token_hash !~ '^[a-f0-9]{64}$' or p_expires_at is null
    or p_expires_at <= now() or p_expires_at > now()+interval '7 days' then return null; end if;
  select * into v_proof from public.fiscal_guest_email_proofs where token_hash=p_token_hash for update;
  if not found or v_proof.expires_at<=now() or
    (v_proof.consumed_session_hash is not null and v_proof.consumed_session_hash<>p_key_hash) then return null; end if;
  update public.fiscal_guest_email_proofs set consumed_at=coalesce(consumed_at,now()),consumed_session_hash=p_key_hash
    where job_id=v_proof.job_id;
  update public.fiscal_guest_submissions set email_verified_at=coalesce(email_verified_at,now()) where id=v_proof.submission_id;
  insert into public.fiscal_guest_verified_sessions(key_hash,submission_id,expires_at)
    values(p_key_hash,v_proof.submission_id,p_expires_at)
    on conflict(key_hash,submission_id) do update set expires_at=least(fiscal_guest_verified_sessions.expires_at,excluded.expires_at);
  return jsonb_build_object('reference',v_proof.submission_id);
end $$;

create function public.purge_expired_fiscal_guest_proofs()
returns integer language plpgsql security definer set search_path = '' as $$
declare v_proofs integer; v_sessions integer;
begin
  delete from public.fiscal_guest_email_proofs where job_id in (
    select job_id from public.fiscal_guest_email_proofs where expires_at<=now() order by expires_at limit 250 for update skip locked);
  get diagnostics v_proofs = row_count;
  delete from public.fiscal_guest_verified_sessions where (key_hash,submission_id) in (
    select key_hash,submission_id from public.fiscal_guest_verified_sessions where expires_at<=now() order by expires_at limit 250 for update skip locked);
  get diagnostics v_sessions = row_count;
  return v_proofs+v_sessions;
end $$;
revoke all on function public.prepare_fiscal_guest_email_proof(uuid,uuid,text,text,timestamptz),
  public.verify_fiscal_guest_email(text,text,timestamptz),public.purge_expired_fiscal_guest_proofs() from public,anon,authenticated;
grant execute on function public.prepare_fiscal_guest_email_proof(uuid,uuid,text,text,timestamptz),
  public.verify_fiscal_guest_email(text,text,timestamptz),public.purge_expired_fiscal_guest_proofs() to service_role;
