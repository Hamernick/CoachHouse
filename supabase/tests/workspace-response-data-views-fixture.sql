\set ON_ERROR_STOP on
\ir workspace-data-views-fixture.sql
\ir ../migrations/20261102235700_native_response_data_views.sql
create function public.fixture_response_data_views() returns void language plpgsql as $$
begin
 truncate public.organization_closures cascade;
 update public.organization_workspace_boards b set state='{}',updated_by=coalesce((select intake_manager from public.organization_forms where org_id=b.org_id and id=public.fixture_form_id(20)),b.org_id);
 perform public.fixture_data_views();
 update public.organization_workspace_boards set state='{}',updated_by=coalesce((select intake_manager from public.organization_forms where org_id=public.fixture_form_id(1) and id=public.fixture_form_id(20)),public.fixture_form_id(1));
 truncate public.organization_forms cascade;
 delete from public.organization_workspace_pages;
 perform public.fixture_form_publish(0,'publish',80,4);
 perform public.fixture_form_command('submit');
end $$;
create function public.fixture_response_view_invite(permission text default 'correct') returns void language plpgsql as $$
begin
 perform public.organization_form_viewer_access(public.fixture_form_id(4),jsonb_build_object('action','invite_viewer','versionId',public.fixture_form_id(80),
 'email','person2@example.org','operationId',public.fixture_form_id(5000),'expectedRevision',1,'responsePermission',permission));
 perform public.organization_form_viewer_access(public.fixture_form_id(2),jsonb_build_object('action','accept_viewer','versionId',public.fixture_form_id(80),'invitationId',public.fixture_form_id(5000)));
end $$;
