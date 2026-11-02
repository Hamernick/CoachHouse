\set ON_ERROR_STOP on
\ir organization-form-intake-fixture.sql
-- Exercise upgrading an existing live intake and an unattributed named-canvas draft.
select public.fixture_form_publish(0);
select public.fixture_form_command('submit');
update public.organization_workspace_boards set state=state||jsonb_build_object('workspaceCatalog',jsonb_build_object('entries',jsonb_build_array(
 jsonb_build_object('id',public.fixture_form_id(40),'state',jsonb_build_object('particleGraph',jsonb_build_object('particles',jsonb_build_array(
 jsonb_set(state#>'{particleGraph,particles,0}','{id}',to_jsonb(public.fixture_form_id(30))))))))));
\ir ../migrations/20261101150000_organization_form_creation.sql
do $$ begin
 if (select creator_id from public.organization_forms where id=public.fixture_form_id(20)) is not null
   or (select intake_manager from public.organization_forms where id=public.fixture_form_id(20))<>public.fixture_form_id(1)
   or (select creator_id from public.organization_forms where id=public.fixture_form_id(30)) is not null
   or (select intake_manager from public.organization_forms where id=public.fixture_form_id(30))<>public.fixture_form_id(1)
   or (select count(*) from public.organization_form_responses)<>1 then raise exception 'Legacy attribution or intake changed'; end if;
end $$;
-- Leave the reusable fixture empty, using the actual owner guard rather than disabling triggers.
update public.organization_workspace_boards set state='{}',updated_by=public.fixture_form_id(1);
truncate public.organization_forms cascade;
delete from public.organization_workspace_pages;
