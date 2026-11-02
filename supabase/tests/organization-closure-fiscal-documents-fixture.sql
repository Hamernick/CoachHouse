\set ON_ERROR_STOP on
\ir organization-closure-project-overviews-fixture.sql
-- Synthetic omitted project-asset, coach and guest prerequisites. Production
-- fiscal schemas, immutable triggers, RLS and document RPCs are loaded unchanged.
alter table public.organization_project_assets alter column id set default gen_random_uuid(),
 add column asset_type text, add column external_url text, add column mime text,
 add column size_bytes bigint, add column storage_path text, add column name text,
 add column description text;
create table public.organization_coach_assignments(organization_id uuid,coach_user_id uuid);
create function public.is_platform_staff() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.platform_staff_members where user_id=auth.uid()); $$;
\ir ../migrations/20260609154000_add_fiscal_sponsorship_applications.sql
\ir ../migrations/20260610180000_add_fiscal_sponsorship_workflow.sql
\ir ../migrations/20260615130000_add_fiscal_sponsorship_required_document_metadata.sql
\ir ../migrations/20260716150000_add_native_fiscal_sponsorship_signing.sql
\ir ../migrations/20260727130000_complete_fiscal_sponsorship_signing.sql
\ir ../migrations/20260805231500_atomic_fiscal_document_transitions.sql
\ir ../migrations/20260806010000_harden_fiscal_sponsorship_rls.sql
create table public.fiscal_guest_submissions(id uuid primary key,project_id uuid unique);
create table public.fiscal_project_reviewers(project_id uuid,user_id uuid);
\ir ../migrations/20261010130000_guest_fiscal_reviewer_scope.sql
create table public.organization_tasks(project_id uuid);
create table public.organization_project_notes(project_id uuid);
create table public.organization_project_quick_links(project_id uuid);
create table public.platform_admin_project_workstream_states(project_id uuid);
\ir ../migrations/20261011130000_guest_fiscal_related_records.sql
set check_function_bodies=on;
\ir ../migrations/20261102160000_organization_closure_fiscal_documents.sql
grant select,insert,update,delete on public.fiscal_sponsorship_documents to authenticated,service_role;
grant select on public.fiscal_sponsorship_events,public.fiscal_sponsorship_applications to authenticated,service_role;
create function public.fixture_closure_fiscal_documents() returns void language plpgsql as $$
begin
 -- Test-only reset preserves production immutable-event triggers.
 truncate public.fiscal_sponsorship_applications cascade;
 truncate public.organization_project_assets cascade;
 truncate public.fiscal_guest_submissions,public.fiscal_project_reviewers;
 perform public.fixture_closure_project_overviews();
 insert into public.fiscal_sponsorship_applications(id,org_id,project_id)
 select public.fixture_form_id(1500+n),public.fixture_form_id(n),public.fixture_form_id(1400+n) from generate_series(1,2) n;
 insert into public.organization_project_assets(id,org_id,project_id,name,mime,storage_path)
 select public.fixture_form_id(1510+n),public.fixture_form_id(n),public.fixture_form_id(1400+n),'Original asset','application/pdf','synthetic/'||n from generate_series(1,2) n;
 insert into public.fiscal_sponsorship_documents(id,org_id,project_id,application_id,asset_id,kind,title,document_key,
 generated_by,uploaded_by,reviewed_by,confirmed_by)
 select public.fixture_form_id(1520+n),public.fixture_form_id(n),public.fixture_form_id(1400+n),public.fixture_form_id(1500+n),
 public.fixture_form_id(1510+n),'application','Original','governing_documents',
 public.fixture_form_id(13),public.fixture_form_id(13),public.fixture_form_id(13),public.fixture_form_id(13) from generate_series(1,2) n;
end; $$;
create function public.fixture_fiscal_review(expected_at timestamptz default null) returns jsonb language sql as $$
 select public.review_fiscal_sponsorship_document_transition(application_id,id,public.fixture_form_id(1),
 'accepted',null,coalesce(expected_at,updated_at)) from public.fiscal_sponsorship_documents where id=public.fixture_form_id(1521); $$;
create function public.fixture_fiscal_connect() returns jsonb language sql as $$
 select public.connect_fiscal_sponsorship_document_transition(public.fixture_form_id(1501),public.fixture_form_id(1511),
 public.fixture_form_id(1),'budget_support','Budget support','Connected'); $$;
