\set ON_ERROR_STOP on
\ir organization-closure-fiscal-signing-fixture.sql
-- Replace only disposable guest stubs; retain actual fiscal schema and closure
-- predecessors. Omitted notification/task prerequisites are explicitly synthetic.
drop table public.fiscal_guest_submissions,public.fiscal_project_reviewers cascade;
alter table public.profiles add column email text,add column full_name text;
alter table public.organization_projects add column if not exists organization_unassigned boolean default false,add column if not exists option_settings jsonb default '{}';
alter table public.organization_tasks add column id uuid primary key default gen_random_uuid(),add column org_id uuid,
 add column title text,add column description text,add column task_type text,add column status text,
 add column start_date date,add column end_date date,add column created_source text,add column created_by uuid,add column updated_by uuid,
 add column created_at timestamptz default now(),add column updated_at timestamptz default now();
create table public.organization_task_assignees(org_id uuid,task_id uuid,user_id uuid,created_by uuid,unique(task_id,user_id));
create table public.notifications(id uuid primary key default gen_random_uuid(),user_id uuid,org_id uuid,actor_id uuid,title text,description text,href text,tone text,type text,metadata jsonb);
\ir ../migrations/20261010100000_guest_fiscal_submission.sql
\ir ../migrations/20261010120000_fiscal_staff_event_notifications.sql
\ir ../migrations/20261010150000_guest_fiscal_delivery.sql
\ir ../migrations/20261010160000_guest_fiscal_drafts.sql
\ir ../migrations/20261010170000_guest_fiscal_email_proof.sql
\ir ../migrations/20261010180000_guest_fiscal_profile_claim.sql
\ir ../migrations/20261011090000_guest_fiscal_followup.sql
\ir ../migrations/20261011100000_guest_fiscal_followup_notifications.sql
\ir ../migrations/20261011110000_guest_fiscal_recovery.sql
\ir ../migrations/20261011120000_fiscal_email_delivery_tracking.sql
\ir ../migrations/20261012160000_guest_fiscal_submission_notifications.sql
\ir ../migrations/20261015040000_fiscal_linked_applicant_access.sql
\ir ../migrations/20261015210000_fiscal_receipt_copy_and_browser_return.sql
\ir ../migrations/20261016200000_fiscal_review_tasks_and_cc.sql
\ir ../migrations/20261020230000_fiscal_organization_link.sql
\ir ../migrations/20261102210000_organization_closure_fiscal_ancillary.sql
-- The predecessor fixture had stub guest tables without child FKs. Its reset
-- must include the real dependent guest tables in this disposable fixture only.
do $$ declare definition text; begin
 definition:=pg_get_functiondef('public.fixture_closure_fiscal_documents()'::regprocedure);
 if strpos(definition,'truncate public.fiscal_guest_submissions,public.fiscal_project_reviewers;')=0 then raise exception 'Unexpected fixture reset'; end if;
 execute replace(definition,'truncate public.fiscal_guest_submissions,public.fiscal_project_reviewers;',
  'truncate public.fiscal_guest_submissions,public.fiscal_project_reviewers cascade;');
end $$;
create function public.fixture_closure_fiscal_ancillary() returns void language plpgsql as $$
begin
 -- Synthetic reset only; no immutable production evidence is deleted by a user.
 truncate public.fiscal_guest_intake_settings,public.organization_tasks,public.organization_task_assignees,public.notifications;
 perform public.fixture_closure_fiscal_signing();
 update public.profiles set email=case id when public.fixture_form_id(1) then 'joel@coachhousesolutions.org'
  when public.fixture_form_id(5) then 'fs@coachhousesolutions.org' when public.fixture_form_id(6) then 'caleb@bandto.com' else 'synthetic@example.org' end,
  full_name='Synthetic reviewer';
 insert into public.platform_staff_members(user_id,access_level) select public.fixture_form_id(n),'developer' from unnest(array[1,5,6]) n
 on conflict(user_id) do update set access_level='developer';
 insert into auth.users values(public.fixture_form_id(14),'guest-applicant@example.org',now()) on conflict(id) do nothing;
 insert into public.profiles(id,role,email,full_name) values(public.fixture_form_id(14),'member','guest-applicant@example.org','Guest applicant') on conflict(id) do nothing;
 insert into public.organizations(user_id,profile,public_slug,updated_at) values(public.fixture_form_id(14),'{"name":"Applicant"}','guest-applicant',now()) on conflict(user_id) do nothing;
 insert into public.fiscal_guest_intake_settings(org_id,system_actor_id) values(public.fixture_form_id(1),public.fixture_form_id(1));
 insert into public.fiscal_guest_submissions(id,submission_key_hash,application_id,project_id,contact_email)
 select public.fixture_form_id(1800+n),repeat(n::text,64),public.fixture_form_id(1500+n),public.fixture_form_id(1400+n),case when n=1 then 'guest-applicant@example.org' else 'person2@example.org' end
 from generate_series(1,2) n;
 insert into public.fiscal_project_reviewers(project_id,user_id)
 select public.fixture_form_id(1400+n),public.fixture_form_id(r) from generate_series(1,2) n cross join unnest(array[1,5,6]) r;
 insert into public.fiscal_guest_email_outbox(id,submission_id,kind,recipient)
 select public.fixture_form_id(1810+n),public.fixture_form_id(1800+n),'applicant_receipt',case when n=1 then 'guest-applicant@example.org' else 'person2@example.org' end from generate_series(1,2) n;
 insert into public.fiscal_guest_email_proofs(job_id,submission_id,nonce,token_hash,expires_at)
 select public.fixture_form_id(1810+n),public.fixture_form_id(1800+n),repeat('a',64),repeat((n+6)::text,64),now()+interval '1 day' from generate_series(1,2) n;
 insert into public.fiscal_guest_verified_sessions(key_hash,submission_id,expires_at)
 select repeat((n+4)::text,64),public.fixture_form_id(1800+n),now()+interval '1 day' from generate_series(1,2) n;
 insert into public.fiscal_sponsorship_events(id,application_id,org_id,project_id,event_type,summary)
 select public.fixture_form_id(1820+n),public.fixture_form_id(1500+n),public.fixture_form_id(n),public.fixture_form_id(1400+n),'document_reviewed','Synthetic event'
 from generate_series(1,2) n;
end $$;
create function public.fixture_fiscal_recovery() returns void language sql as $$
 select public.request_fiscal_guest_recovery(public.fixture_form_id(1801),'guest-applicant@example.org',public.fixture_form_id(1831)); $$;
create function public.fixture_fiscal_prepare() returns jsonb language sql as $$
 select public.prepare_fiscal_guest_email_proof(id,lease_token,repeat('a',64),repeat('b',64),now()+interval '1 day')
 from public.fiscal_guest_email_outbox where id=public.fixture_form_id(1811); $$;

create function public.fixture_fiscal_link() returns jsonb language sql as $$
 select public.link_fiscal_organization(public.fixture_form_id(1401),public.fixture_form_id(14),public.fixture_form_id(1844),
 public.search_fiscal_organization_link(public.fixture_form_id(1401),'Applicant')->'candidates'->0->>'version'); $$;
create function public.fixture_fiscal_guest_submit() returns jsonb language sql as $$
 select public.submit_guest_fiscal_application(repeat('d',64),'{"primary_email":"fresh@example.org","project_name":"Synthetic guest","applicant_first_name":"Test","applicant_last_name":"Guest","mailing_street_address":"Synthetic","mailing_city":"Test","mailing_state":"IL","mailing_postal_code":"00000","legal_entity_type":"individual","project_description":"Synthetic","public_benefit":"Synthetic","prospective_funding_sources":"Synthetic","operates_outside_united_states":false,"engages_in_lobbying":false,"has_legal_compliance_financial_concerns":false,"fundraising_goal":{"period":"total","amountCents":500}}'); $$;
