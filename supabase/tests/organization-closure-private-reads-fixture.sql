\set ON_ERROR_STOP on
\ir organization-closure-integrated-fixture.sql
\ir ../migrations/20261102231000_organization_closure_calendar_reads.sql
\ir ../migrations/20261102233000_organization_closure_public_profile_reads.sql
-- Calendar bootstrap now has a durable publication FK child; include it in the
-- existing disposable reset. No production reset or table grant is introduced.
do $$ declare definition text; begin
 definition:=pg_get_functiondef('public.fixture_closure_calendar()'::regprocedure);
 execute replace(definition,'truncate public.roadmap_calendar_public_events',
 'truncate public.organization_calendar_publication_revocations,public.roadmap_calendar_public_events');
end $$;
-- Only two inherited sharing stubs omit production RLS. Model their existing
-- owner/member rights explicitly; no full hosted coach/support policy claim.
alter table public.organizations enable row level security;
alter table public.organization_workspace_boards enable row level security;
grant select on public.organization_workspace_boards to authenticated;
grant usage on schema storage to authenticated;
grant select on storage.objects to authenticated;
create policy fixture_private_org on public.organizations for select to authenticated using(user_id=auth.uid() or exists(select 1 from public.organization_memberships m where m.org_id=user_id and m.member_id=auth.uid()));
create policy fixture_private_board on public.organization_workspace_boards for select to authenticated using(org_id=auth.uid() or exists(select 1 from public.organization_memberships m where m.org_id=organization_workspace_boards.org_id and m.member_id=auth.uid()));
\ir ../migrations/20261102235000_organization_closure_private_reads.sql
create function public.fixture_closure_private_reads() returns void language plpgsql as $$
begin
 perform public.fixture_closure_integrated();
 perform public.fixture_ai_claim();
 perform public.fixture_ai_finish();
 perform public.fixture_ai_research();
 perform public.fixture_ai_claim(1810);
 perform public.fixture_ai_finish(1810);
 perform public.access_workspace_research_draft(public.fixture_form_id(1810),public.fixture_form_id(1),public.fixture_form_id(1),repeat('a',64),public.fixture_form_id(2401),0,'{"private":"draft"}',false);
 update public.fiscal_guest_submissions set email_verified_at=now(),contact_email=contact_email where id=public.fixture_form_id(2101);
 insert into public.fiscal_guest_verified_sessions(key_hash,submission_id,expires_at) values(repeat('9',64),public.fixture_form_id(2101),now()+interval '60 days');
end $$;
create function public.fixture_private_read_counts() returns jsonb language plpgsql security invoker as $$
declare result jsonb:='{}'; t text; n bigint;
begin
 foreach t in array array['organization_workspace_boards','organization_brand_kits','organization_people_tags','organization_finance_records','organization_finance_opportunities','organization_document_files','document_collaboration_rooms','document_file_versions','organization_projects','organization_tasks','organization_project_overview_documents','fiscal_sponsorship_applications','fiscal_sponsorship_documents','fiscal_sponsorship_signature_packets'] loop
 execute format('select count(*) from public.%I where org_id=public.fixture_form_id(1)',t) into n;
 result:=result||jsonb_build_object(t,n);
 end loop;
 return result;
end $$;
