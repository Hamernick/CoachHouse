-- Guest identity is separate from the internal project's owning organization.
-- Configuration is deliberately empty: no personal organization is a fallback.
create table public.fiscal_guest_intake_settings (
  singleton boolean primary key default true check (singleton),
  org_id uuid not null references public.organizations(user_id),
  system_actor_id uuid not null references public.profiles(id)
);
create table public.fiscal_guest_submissions (
  id uuid primary key default gen_random_uuid(),
  submission_key_hash text not null unique check (submission_key_hash ~ '^[a-f0-9]{64}$'),
  application_id uuid not null unique references public.fiscal_sponsorship_applications(id),
  project_id uuid not null unique references public.organization_projects(id),
  contact_email text not null,
  email_verified_at timestamptz,
  claimed_user_id uuid references public.profiles(id),
  claimed_org_id uuid references public.organizations(user_id),
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  check ((claimed_user_id is null and claimed_org_id is null and claimed_at is null)
    or (claimed_user_id is not null and claimed_org_id is not null and claimed_at is not null and email_verified_at is not null))
);
create table public.fiscal_project_reviewers (
  project_id uuid not null references public.organization_projects(id) on delete cascade,
  user_id uuid not null references public.platform_staff_members(user_id),
  assigned_at timestamptz not null default now(),
  primary key (project_id, user_id)
);
create table public.fiscal_guest_email_outbox (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.fiscal_guest_submissions(id),
  kind text not null check (kind in ('applicant_receipt', 'reviewer_notification')),
  recipient text not null,
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  leased_until timestamptz,
  provider_message_id text,
  last_error_code text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (submission_id, kind, recipient)
);
create index fiscal_guest_email_outbox_pending_idx
  on public.fiscal_guest_email_outbox (available_at) where status in ('pending', 'failed', 'sending');
create index fiscal_project_reviewers_user_idx on public.fiscal_project_reviewers(user_id, project_id);

alter table public.fiscal_guest_intake_settings enable row level security;
alter table public.fiscal_guest_submissions enable row level security;
alter table public.fiscal_project_reviewers enable row level security;
alter table public.fiscal_guest_email_outbox enable row level security;
revoke all on public.fiscal_guest_intake_settings, public.fiscal_guest_submissions,
  public.fiscal_project_reviewers, public.fiscal_guest_email_outbox from public, anon, authenticated;
grant select, insert, update, delete on public.fiscal_guest_intake_settings, public.fiscal_guest_submissions,
  public.fiscal_project_reviewers, public.fiscal_guest_email_outbox to service_role;

-- Server-only transaction. The public endpoint must normalize/validate fields,
-- enforce abuse limits, and generate a secret submission capability before calling.
-- This function is intentionally NOT executable by anon or authenticated.
create function public.submit_guest_fiscal_application(p_submission_key_hash text, p_application jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_settings public.fiscal_guest_intake_settings%rowtype;
  v_existing public.fiscal_guest_submissions%rowtype;
  v_application public.fiscal_sponsorship_applications%rowtype;
  v_project uuid := gen_random_uuid();
  v_application_id uuid := gen_random_uuid();
  v_submission uuid := gen_random_uuid();
  v_karissa uuid;
  v_joel uuid;
  v_email text;
begin
  if p_submission_key_hash is null or p_submission_key_hash !~ '^[a-f0-9]{64}$'
    or p_application is null or jsonb_typeof(p_application) <> 'object'
    or octet_length(p_application::text) > 100000 then
    raise exception 'Invalid submission' using errcode = '22023';
  end if;
  -- Only application fields may enter this boundary. IDs, ownership, review state,
  -- claimed identity, source snapshots and template metadata are server-owned.
  if exists (select 1 from jsonb_object_keys(p_application) k where k not in (
    'applicant_full_name','applicant_first_name','applicant_last_name',
    'mailing_street_address','mailing_street_address_2','mailing_city','mailing_state','mailing_postal_code',
    'phone_number','primary_email','legal_entity_type','legal_entity_has_501c3','formation_status',
    'project_name','project_duration_type','temporary_start_date','temporary_end_date','focus_area',
    'project_description','project_location','estimated_budget_cents','expense_summary',
    'prospective_funding_sources','public_benefit','leadership_background','initiative_history',
    'fundraising_goal','operates_outside_united_states',
    'engages_in_lobbying','has_legal_compliance_financial_concerns','concerns_explanation','budget_rows'
  )) then raise exception 'Unexpected application field' using errcode = '22023'; end if;

  if p_application ? 'budget_rows' then
    if jsonb_typeof(p_application->'budget_rows') <> 'array' then
      raise exception 'Invalid budget rows' using errcode = '22023';
    end if;
    if jsonb_array_length(p_application->'budget_rows') > 200 then
      raise exception 'Too many budget rows' using errcode = '22023';
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_submission_key_hash, 0));
  select * into v_existing from public.fiscal_guest_submissions where submission_key_hash = p_submission_key_hash;
  if found then
    return jsonb_build_object('submissionId', v_existing.id, 'applicationId', v_existing.application_id,
      'projectId', v_existing.project_id, 'created', false);
  end if;
  select * into v_settings from public.fiscal_guest_intake_settings where singleton;
  if not found then raise exception 'Fiscal intake is not configured'; end if;
  if not exists (select 1 from public.platform_staff_members where user_id = v_settings.system_actor_id) then
    raise exception 'Fiscal system actor must be staff';
  end if;
  select p.id into v_karissa from public.profiles p join public.platform_staff_members s on s.user_id=p.id
    where lower(p.email) = 'fs@coachhousesolutions.org';
  select p.id into v_joel from public.profiles p join public.platform_staff_members s on s.user_id=p.id
    where lower(p.email) = 'joel@coachhousesolutions.org';
  if v_karissa is null or v_joel is null or v_karissa = v_joel then
    raise exception 'Fiscal reviewers are not configured';
  end if;
  v_application := jsonb_populate_record(null::public.fiscal_sponsorship_applications, p_application);
  v_email := lower(btrim(v_application.primary_email));
  if v_email is null or length(v_email) > 254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or nullif(btrim(v_application.project_name), '') is null
    or length(v_application.project_name) > 200 then
    raise exception 'Invalid contact or project' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(array[
      'applicant_first_name','applicant_last_name','mailing_street_address','mailing_city',
      'mailing_state','mailing_postal_code','legal_entity_type','project_description',
      'public_benefit','prospective_funding_sources'
    ]) field where nullif(btrim(p_application->>field), '') is null)
    or (v_application.legal_entity_type <> 'individual' and nullif(btrim(v_application.formation_status),'') is null)
    or v_application.operates_outside_united_states is null
    or v_application.engages_in_lobbying is null
    or ((v_application.operates_outside_united_states or v_application.engages_in_lobbying
      or coalesce(v_application.has_legal_compliance_financial_concerns,false))
      and nullif(btrim(v_application.concerns_explanation),'') is null) then
    raise exception 'Incomplete application' using errcode = '22023';
  end if;
  if jsonb_typeof(p_application->'fundraising_goal') is distinct from 'object'
    or (p_application->'fundraising_goal'->>'period') is null
    or (p_application->'fundraising_goal'->>'period') not in ('monthly','annually','total')
    or jsonb_typeof(p_application->'fundraising_goal'->'amountCents') is distinct from 'number' then
    raise exception 'Invalid fundraising goal' using errcode = '22023';
  end if;
  if (p_application->'fundraising_goal'->>'amountCents')::numeric <= 0
    or (p_application->'fundraising_goal'->>'amountCents')::numeric > 9007199254740991
    or mod((p_application->'fundraising_goal'->>'amountCents')::numeric,1) <> 0 then
    raise exception 'Invalid fundraising amount' using errcode = '22023';
  end if;
  -- Never attribute a guest's submission to a staff reviewer as its applicant.
  v_application.id := v_application_id;
  v_application.org_id := v_settings.org_id;
  v_application.project_id := v_project;
  v_application.primary_email := v_email;
  v_application.status := 'submitted';
  v_application.submitted_at := now();
  v_application.created_at := now();
  v_application.updated_at := now();
  v_application.source_snapshot := '{}';
  v_application.document_template_payload := '{}';
  v_application.metadata := jsonb_build_object('intake_source', 'public_guest',
    'fundraisingGoal', p_application->'fundraising_goal', 'budgetMode', 'fundraising_goal',
    'budgetRows', coalesce(p_application->'budget_rows', '[]'::jsonb));

  insert into public.organization_projects(id, org_id, project_kind, name, created_source,
    created_by, updated_by, organization_unassigned, option_settings)
  values(v_project, v_settings.org_id, 'standard', btrim(v_application.project_name), 'system',
    v_settings.system_actor_id, v_settings.system_actor_id, true, '{"fiscalSponsorshipEnabled":true}');
  insert into public.fiscal_sponsorship_applications select (v_application).*;
  insert into public.fiscal_guest_submissions(id, submission_key_hash, application_id, project_id, contact_email)
    values(v_submission, p_submission_key_hash, v_application_id, v_project, v_email);
  insert into public.fiscal_project_reviewers(project_id, user_id) values(v_project, v_karissa), (v_project, v_joel);
  insert into public.fiscal_sponsorship_events(org_id, project_id, application_id, event_type, actor_id, summary, metadata)
    values(v_settings.org_id, v_project, v_application_id, 'application_submitted', null,
      'Guest fiscal sponsorship application submitted.', jsonb_build_object('submission_id', v_submission));
  insert into public.fiscal_guest_email_outbox(submission_id, kind, recipient) values
    (v_submission, 'applicant_receipt', v_email),
    (v_submission, 'reviewer_notification', 'joel@coachhousesolutions.org');
  return jsonb_build_object('submissionId', v_submission, 'applicationId', v_application_id,
    'projectId', v_project, 'created', true);
end;
$$;
revoke all on function public.submit_guest_fiscal_application(text, jsonb) from public, anon, authenticated;
grant execute on function public.submit_guest_fiscal_application(text, jsonb) to service_role;
