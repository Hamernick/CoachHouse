\set ON_ERROR_STOP on
\ir organization-closure-fiscal-documents-fixture.sql
-- Minimal existing program prerequisite for the actual atomic application/budget
-- save. Direct program writers, linked/guest return and notification owners are
-- separate qualification gates; this fixture does not emulate hosted services.
alter table public.programs add column raised_cents integer default 0,
 add column goal_cents integer default 0,add column wizard_snapshot jsonb default '{}',
 add column updated_at timestamptz default now();
\ir ../migrations/20260805230500_atomic_fiscal_application_transitions.sql
\ir ../migrations/20260805232500_atomic_fiscal_application_draft_saves.sql
set check_function_bodies=on;
\ir ../migrations/20261102170000_organization_closure_fiscal_applications.sql
grant select,insert,update,delete on public.fiscal_sponsorship_applications,public.fiscal_sponsorship_reviews to service_role;
create function public.fixture_closure_fiscal_applications() returns void language plpgsql as $$
begin
 perform public.fixture_closure_fiscal_documents();
 insert into public.organization_projects(id,org_id,name) values(public.fixture_form_id(1404),public.fixture_form_id(1),'New application target');
 update public.fiscal_sponsorship_applications set status='submitted',project_name='Original',
 created_by=public.fixture_form_id(13),updated_by=public.fixture_form_id(13),reviewed_by=public.fixture_form_id(13);
 insert into public.fiscal_sponsorship_applications(id,org_id,project_id,project_name,created_by,updated_by,reviewed_by)
 values(public.fixture_form_id(1601),public.fixture_form_id(1),public.fixture_form_id(1403),'Original',public.fixture_form_id(13),public.fixture_form_id(13),public.fixture_form_id(13));
 insert into public.fiscal_sponsorship_reviews(id,org_id,project_id,application_id,decision,notes,reviewed_by)
 select public.fixture_form_id(1610+n),public.fixture_form_id(n),public.fixture_form_id(1400+n),public.fixture_form_id(1500+n),
 'needs_info','Original',public.fixture_form_id(13) from generate_series(1,2) n;
 insert into public.programs(id,user_id,raised_cents,goal_cents,wizard_snapshot)
 values(public.fixture_form_id(1620),public.fixture_form_id(1),100,200,'{"preserved":true}')
 on conflict(id) do update set raised_cents=100,goal_cents=200,wizard_snapshot='{"preserved":true}',updated_at=now();
end; $$;
create function public.fixture_fiscal_application_review(expected_at timestamptz default null) returns jsonb language sql as $$
 select public.review_fiscal_sponsorship_application_transition(id,public.fixture_form_id(1),'approved',null,coalesce(expected_at,updated_at))
 from public.fiscal_sponsorship_applications where id=public.fixture_form_id(1501); $$;
create function public.fixture_fiscal_application_submit() returns jsonb language sql as $$
 select public.submit_fiscal_sponsorship_application_transition(id,public.fixture_form_id(1),updated_at)
 from public.fiscal_sponsorship_applications where id=public.fixture_form_id(1601); $$;
create function public.fixture_fiscal_application_save(expected_at timestamptz default null) returns jsonb language sql as $$
 select public.save_fiscal_sponsorship_application_draft_transition(project_id,public.fixture_form_id(1),coalesce(expected_at,updated_at),
 '{"project_name":"Edited"}',public.fixture_form_id(1620)::text,true,'[{"name":"Budget","amount":500}]',500,true)
 from public.fiscal_sponsorship_applications where id=public.fixture_form_id(1501); $$;
create function public.fixture_fiscal_application_create() returns jsonb language sql as $$
 select public.save_fiscal_sponsorship_application_draft_transition(public.fixture_form_id(1404),public.fixture_form_id(1),null,
 '{"project_name":"Created"}',public.fixture_form_id(1620)::text,true,'[{"name":"Budget","amount":500}]',500,false); $$;
