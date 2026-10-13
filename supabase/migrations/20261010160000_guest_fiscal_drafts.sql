-- Private, seven-day browser drafts. No anonymous/authenticated table or RPC grants.
create table public.fiscal_guest_drafts (
  key_hash text primary key check (key_hash ~ '^[a-f0-9]{64}$'),
  answers jsonb not null check (jsonb_typeof(answers) = 'object' and octet_length(answers::text) <= 65536),
  version integer not null check (version > 0),
  last_request_id uuid not null,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);
create index fiscal_guest_drafts_expiry_idx on public.fiscal_guest_drafts(expires_at);
alter table public.fiscal_guest_drafts enable row level security;
revoke all on public.fiscal_guest_drafts from public, anon, authenticated;
grant select, insert, update, delete on public.fiscal_guest_drafts to service_role;

create function public.read_fiscal_guest_draft(p_key_hash text, p_expires_at timestamptz)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_draft public.fiscal_guest_drafts%rowtype; v_reference uuid;
begin
  if p_key_hash is null or p_key_hash !~ '^[a-f0-9]{64}$'
    or p_expires_at is null or p_expires_at > now() + interval '7 days' then
    raise exception 'Invalid draft session';
  end if;
  if p_expires_at <= now() then return jsonb_build_object('state', 'expired'); end if;
  -- Same lock as submission: read/save cannot race past a committed handoff.
  perform pg_advisory_xact_lock(hashtextextended(p_key_hash, 0));
  select id into v_reference from public.fiscal_guest_submissions where submission_key_hash = p_key_hash;
  if found then return jsonb_build_object('state', 'submitted', 'reference', v_reference); end if;
  select * into v_draft from public.fiscal_guest_drafts where key_hash = p_key_hash;
  if found then
    if v_draft.expires_at <= now() or v_draft.expires_at <> p_expires_at then
      return jsonb_build_object('state', 'expired');
    end if;
    return jsonb_build_object('state', 'draft', 'version', v_draft.version,
      'draft', v_draft.answers, 'expiresAt', v_draft.expires_at);
  end if;
  return jsonb_build_object('state', 'draft', 'version', 0, 'draft', '{}'::jsonb, 'expiresAt', p_expires_at);
end $$;

create function public.save_fiscal_guest_draft(
  p_key_hash text, p_expires_at timestamptz, p_version integer, p_request_id uuid, p_draft jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_state jsonb; v_draft public.fiscal_guest_drafts%rowtype;
begin
  if p_request_id is null or p_version is null or p_version < 0 or p_version >= 2147483647
    or p_draft is null or jsonb_typeof(p_draft) <> 'object' or octet_length(p_draft::text) > 65536 then
    raise exception 'Invalid draft';
  end if;
  -- Defense in depth: only form fields, all raw strings. No IDs, review state,
  -- historical budget rows, source snapshots or account/profile metadata.
  if exists(select 1 from jsonb_each(p_draft) entry where
    entry.key <> all(array[
      'applicantFirstName','applicantLastName','primaryEmail','mailingStreetAddress',
      'mailingStreetAddress2','mailingCity','mailingState','mailingPostalCode','phoneNumber',
      'legalEntityType','legalEntityHas501c3','formationStatus','projectName','projectDescription',
      'projectLocation','projectDurationType','temporaryStartDate','temporaryEndDate','focusArea',
      'fundraisingGoalDollars','fundraisingGoalPeriod','expenseSummary','prospectiveFundingSources',
      'publicBenefit','leadershipBackground','initiativeHistory','operatesOutsideUnitedStates',
      'engagesInLobbying','hasLegalComplianceFinancialConcerns','concernsExplanation'
    ]) or jsonb_typeof(entry.value) <> 'string' or length(entry.value #>> '{}') > 6000
  ) then raise exception 'Invalid draft fields'; end if;
  v_state := public.read_fiscal_guest_draft(p_key_hash, p_expires_at);
  if v_state->>'state' <> 'draft' then return v_state; end if;
  select * into v_draft from public.fiscal_guest_drafts where key_hash = p_key_hash;
  if found and v_draft.last_request_id = p_request_id then
    if v_draft.version = p_version + 1 and v_draft.answers = p_draft then return v_state; end if;
    return jsonb_build_object('state', 'conflict');
  end if;
  if (v_state->>'version')::integer <> p_version then return jsonb_build_object('state', 'conflict'); end if;
  insert into public.fiscal_guest_drafts(key_hash, answers, version, last_request_id, expires_at)
    values(p_key_hash, p_draft, p_version + 1, p_request_id, p_expires_at)
    on conflict(key_hash) do update set answers = excluded.answers, version = excluded.version,
      last_request_id = excluded.last_request_id, updated_at = now();
  return public.read_fiscal_guest_draft(p_key_hash, p_expires_at);
end $$;

create function public.discard_submitted_fiscal_guest_draft()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.submission_key_hash, 0));
  delete from public.fiscal_guest_drafts where key_hash = new.submission_key_hash;
  return new;
end $$;
create trigger fiscal_guest_submission_discards_draft after insert on public.fiscal_guest_submissions
  for each row execute function public.discard_submitted_fiscal_guest_draft();

-- Service scheduler must invoke regularly; reads deny expired records even if delayed.
create function public.purge_expired_fiscal_guest_drafts()
returns integer language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  delete from public.fiscal_guest_drafts where key_hash in (
    select key_hash from public.fiscal_guest_drafts where expires_at <= now()
    order by expires_at limit 500 for update skip locked
  );
  get diagnostics v_count = row_count;
  return v_count;
end $$;

revoke all on function public.read_fiscal_guest_draft(text,timestamptz),
  public.save_fiscal_guest_draft(text,timestamptz,integer,uuid,jsonb),
  public.discard_submitted_fiscal_guest_draft(), public.purge_expired_fiscal_guest_drafts()
  from public, anon, authenticated;
grant execute on function public.read_fiscal_guest_draft(text,timestamptz),
  public.save_fiscal_guest_draft(text,timestamptz,integer,uuid,jsonb),
  public.purge_expired_fiscal_guest_drafts() to service_role;
