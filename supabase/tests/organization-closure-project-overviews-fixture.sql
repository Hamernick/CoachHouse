\set ON_ERROR_STOP on
\ir organization-closure-brand-kits-fixture.sql
-- Expand the inherited project stub only in this disposable fixture. Actual
-- overview schema/RLS and current project-save RPCs are loaded below. Full
-- project/task/support/billing policy qualification remains a separate gate.
alter table public.organization_projects alter column id set default gen_random_uuid(),
 add column org_id uuid references public.organizations(user_id) on delete cascade,
 add column name text, add column description text, add column status text default 'planned',
 add column priority text default 'medium', add column start_date date, add column end_date date,
 add column created_by uuid references public.profiles(id) on delete restrict,
 add column updated_by uuid references public.profiles(id) on delete set null,
 add column created_at timestamptz default now(), add column updated_at timestamptz default now(),
 add column project_kind text default 'standard', add column canonical_org_id uuid,
 add column recurrence text default 'none', add column recurrence_anchor_start date,
 add column recurrence_anchor_end date, add column recurrence_occurrence integer default 0,
 add column client_name text, add column duration_label text, add column member_labels text[],
 add column tags text[], add column type_label text, add column progress integer,
 add column task_count integer, add column created_source text;
-- Synthetic paid-workspace prerequisites; production overview policies themselves
-- are unchanged. Owner writes, owner/member reads, unrelated identities excluded.
create function public.can_read_member_workspace_org(org uuid) returns boolean language sql stable as $$
 select auth.uid()=org or (auth.uid()=public.fixture_form_id(5) and org=public.fixture_form_id(1)); $$;
create function public.can_write_member_workspace_org(org uuid) returns boolean language sql stable as $$ select auth.uid()=org; $$;
\ir ../migrations/20260610194000_add_organization_project_overview_documents.sql
\ir ../migrations/20260928150000_optional_project_dates_and_assignment.sql
set check_function_bodies=on;
\ir ../migrations/20261102150000_organization_closure_project_overviews.sql
grant select,insert,update,delete on public.organization_project_overview_documents to authenticated,service_role;
grant select on public.organization_projects to authenticated,service_role;
create function public.fixture_closure_project_overviews() returns void language plpgsql as $$
begin
 perform public.fixture_closure_brand_kits();
 delete from public.organization_project_overview_documents;
 delete from public.organization_projects;
 insert into public.organization_projects(id,org_id,name,created_by,updated_by)
 select public.fixture_form_id(1400+n),public.fixture_form_id(case when n=3 then 1 else n end),
 'Original',public.fixture_form_id(1),public.fixture_form_id(1) from generate_series(1,3) n;
 insert into public.organization_project_overview_documents(id,org_id,project_id,document_html,document_text,created_by,updated_by)
 select public.fixture_form_id(1410+n),public.fixture_form_id(n),public.fixture_form_id(1400+n),
 '<p>Original</p>','Original',public.fixture_form_id(13),public.fixture_form_id(13) from generate_series(1,2) n;
end; $$;
create function public.fixture_overview_save(expected_at timestamptz default null) returns jsonb language sql as $$
 select public.update_organization_project_transition(id,public.fixture_form_id(1),org_id,coalesce(expected_at,updated_at),
 to_jsonb(p)||jsonb_build_object('name','Edited'),true,'<p>Edited</p>','Edited')
 from public.organization_projects p where id=public.fixture_form_id(1401); $$;
create function public.fixture_overview_create() returns jsonb language sql as $$
 select public.create_organization_project_transition(public.fixture_form_id(1),public.fixture_form_id(1),
 '{"name":"Created","status":"planned","priority":"medium"}',true,'<p>Created</p>','Created'); $$;
