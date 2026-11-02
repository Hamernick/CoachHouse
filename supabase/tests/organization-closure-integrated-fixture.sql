\set ON_ERROR_STOP on
\ir organization-closure-project-tasks-fixture.sql
-- Integrate actual shutdown hooks over one synthetic prerequisite fixture.
-- Expand only omitted fixture prerequisites; load actual access schemas/policies.
-- The inherited membership role is text, and unrelated hosted support policies
-- are not represented. Runtime access/RLS definitions below are unmodified.
alter table public.organization_memberships
 add column member_email text not null default 'synthetic@example.org',
 add column created_at timestamptz not null default now(),add column updated_at timestamptz not null default now(),
 add foreign key(org_id) references public.organizations(user_id) on delete cascade,
 add foreign key(member_id) references auth.users(id) on delete cascade;
alter table public.organization_access_settings add column admins_can_invite boolean not null default false,
 add column created_at timestamptz not null default now(),add column updated_at timestamptz not null default now();

create table public.roadmap_events(org_id uuid);
\ir ../migrations/20260115203000_add_organization_access.sql
\ir ../migrations/20260115220000_multi_account_org_access.sql
\ir ../migrations/20260313190000_add_organization_access_requests.sql
\ir ../migrations/20260313193000_restrict_organization_access_request_updates.sql
-- Scoped actual activity policy from20260716203000; upstream project/table
-- prerequisites remain synthetic, while document audit triggers are actual SQL.
alter table public.organization_project_activity_events enable row level security;
alter table public.organization_project_activity_events force row level security;
create policy organization_project_activity_events_select on public.organization_project_activity_events
 for select to authenticated using(public.is_admin() or org_id=auth.uid() or exists(
 select 1 from public.organization_memberships m where m.org_id=organization_project_activity_events.org_id and m.member_id=auth.uid()));
revoke all on public.organization_project_activity_events from anon,authenticated;
grant select on public.organization_project_activity_events to authenticated;
grant select,insert,update,delete on public.organization_access_settings,public.organization_memberships,
 public.organization_invites,public.organization_access_requests to authenticated,service_role;
grant select,insert,update,delete on public.organization_project_activity_events to service_role;
set check_function_bodies=on;
\ir ../migrations/20261102200000_organization_closure_access_activity.sql
drop table public.fiscal_guest_submissions,public.fiscal_project_reviewers cascade;
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
alter table public.subscriptions add column stripe_customer_id text;
\ir ../migrations/20260227190000_add_workspace_objective_tables.sql
\ir ../migrations/20261022150000_workspace_objective_plans.sql
\ir ../migrations/20261022160000_workspace_plan_decisions.sql
\ir ../migrations/20261022120000_workspace_ai_metering.sql
\ir ../migrations/20261022121000_workspace_ai_read_and_recovery.sql
\ir ../migrations/20261022123000_workspace_ai_durable_recovery.sql
\ir ../migrations/20261022130000_workspace_ai_document_application.sql
\ir ../migrations/20261022140000_workspace_ai_document_review.sql
\ir ../migrations/20261022170000_workspace_ai_plans.sql
\ir ../migrations/20261022230000_workspace_ai_plan_revisions.sql
\ir ../migrations/20261022233000_workspace_ai_credit_purchases.sql
\ir ../migrations/20261022234500_workspace_ai_spending_limits.sql
\ir ../migrations/20261023001500_workspace_ai_payment_restrictions.sql
\ir ../migrations/20261023010000_workspace_ai_usage_history.sql
\ir ../migrations/20261023020000_workspace_ai_subscription_allowances.sql
\ir ../migrations/20261024010000_workspace_particle_research.sql
\ir ../migrations/20261024020000_workspace_ai_refill_setup.sql
\ir ../migrations/20261024021000_workspace_ai_refill_execution.sql
\ir ../migrations/20261030180000_workspace_research_history.sql
\ir ../migrations/20261030190000_workspace_new_objective_research.sql
\ir ../migrations/20261031190000_workspace_ai_provider_exposure.sql
\ir ../migrations/20261031200000_workspace_research_drafts.sql
set check_function_bodies=on;
\ir ../migrations/20261102220000_organization_closure_ai_admission.sql
create function public.fixture_closure_ai() returns void language plpgsql as $$
begin
 truncate public.ai_credit_wallets cascade;
 perform public.fixture_closure_project_tasks();
 update public.ai_credit_policy set enabled=true,org_daily_provider_microdollars=10000000,daily_provider_microdollars=100000000,
 user_hourly_runs=1000,user_daily_credits=10000;
 insert into public.ai_credit_wallets(org_id,enabled) select public.fixture_form_id(n),true from generate_series(1,2) n;
 insert into public.ai_credit_lots(org_id,operation_key,kind,credits)
 select public.fixture_form_id(n),'closure-test:'||n,'purchased',10000 from generate_series(1,2) n;
end; $$;
create function public.fixture_ai_reserve(n integer default 1801,org integer default 1,actor integer default 1) returns jsonb language sql as $$
 select public.reserve_workspace_ai_run(public.fixture_form_id(n),public.fixture_form_id(org),public.fixture_form_id(actor),repeat('a',64),
 '{}','Synthetic task','{}',10,1000); $$;
create function public.fixture_ai_claim(n integer default 1801,actor integer default 1) returns boolean language sql as $$
 select public.claim_workspace_ai_run(public.fixture_form_id(n),public.fixture_form_id(actor)); $$;
create function public.fixture_ai_finish(n integer default 1801) returns jsonb language plpgsql as $$
begin
 perform public.record_workspace_ai_result(public.fixture_form_id(n),'succeeded',100,5,'Private result','{"input":10,"output":5}',null);
 return public.settle_recorded_workspace_ai_run(public.fixture_form_id(n));
end; $$;
create function public.fixture_ai_research(n integer default 1810) returns jsonb language sql as $$
 select public.reserve_workspace_ai_research_run(public.fixture_form_id(n),public.fixture_form_id(1),public.fixture_form_id(1),repeat('b',64),
 jsonb_build_object('kind','particle_research','mode','new_objective','organizationId',public.fixture_form_id(1),
 'userId',public.fixture_form_id(1),'canvasId',null,'revision',coalesce((state->'particleGraph'->>'revision')::integer,0)),
 'Synthetic research','{}',10,1000) from public.organization_workspace_boards where org_id=public.fixture_form_id(1); $$;
-- Seed only the independent effects needed to prove one all-domain transition.
create function public.fixture_closure_integrated() returns void language plpgsql as $$
begin
 truncate public.organization_access_requests,public.organization_invites,public.fiscal_guest_intake_settings;
 perform public.fixture_closure_ai();
 insert into public.organization_invites(id,org_id,email,token,expires_at,invited_by)
 values(public.fixture_form_id(2001),public.fixture_form_id(1),'synthetic@example.org','synthetic-integration-invite',now()+interval '1 day',public.fixture_form_id(13));
 insert into public.organization_access_requests(id,org_id,invitee_user_id,invitee_email,invited_by_user_id,organization_invite_id,expires_at)
 values(public.fixture_form_id(2011),public.fixture_form_id(1),public.fixture_form_id(13),'synthetic@example.org',public.fixture_form_id(13),public.fixture_form_id(2001),now()+interval '1 day');
 insert into public.fiscal_guest_submissions(id,submission_key_hash,application_id,project_id,contact_email)
 values(public.fixture_form_id(2101),repeat('1',64),public.fixture_form_id(1501),public.fixture_form_id(1401),'synthetic@example.org');
 insert into public.fiscal_guest_email_outbox(id,submission_id,kind,recipient)
 values(public.fixture_form_id(2111),public.fixture_form_id(2101),'applicant_receipt','synthetic@example.org');
 perform public.fixture_ai_reserve();
end $$;
