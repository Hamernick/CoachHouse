\set ON_ERROR_STOP on
begin;
do $$ begin
 if current_setting('coach_house.workspace_sharing_fixture',true) is distinct from 'isolated-test-only' then raise exception 'Fixture required'; end if;
end $$;
insert into public.organization_memberships(org_id,member_id,role) values(public.fixture_form_id(1),public.fixture_form_id(4),'staff') on conflict(org_id,member_id) do update set role='staff';
update public.organization_workspace_boards set state='{}',updated_by=coalesce((select intake_manager from public.organization_forms where org_id=public.fixture_form_id(1) and id=public.fixture_form_id(20)),public.fixture_form_id(1));
truncate public.organization_forms cascade;
delete from public.organization_workspace_pages;
select public.fixture_form_publish(0,'publish',80,4);
select public.fixture_form_command('submit');
create function pg_temp.versions(actor integer default 2,version_id integer default 80,cursor_id integer default null) returns jsonb language sql as $$
 select public.list_organization_form_response_versions(public.fixture_form_id(actor),public.fixture_form_id(version_id),case when cursor_id is null then null else public.fixture_form_id(cursor_id) end);
$$;
create function pg_temp.viewer(action text,actor integer default 4,op integer default 600,rev integer default 1) returns jsonb language sql as $$
 select public.organization_form_viewer_access(public.fixture_form_id(actor),jsonb_build_object('action',action,'versionId',public.fixture_form_id(80),
 'email','person2@example.org','operationId',public.fixture_form_id(op),'expectedRevision',rev,'invitationId',public.fixture_form_id(600)));
$$;
select pg_temp.viewer('invite_viewer');
do $$ begin
 begin perform pg_temp.versions(); raise exception 'Pending invitation discovered versions'; exception when insufficient_privilege then null; end;
 begin perform pg_temp.versions(1); raise exception 'Owner bypassed explicit form access'; exception when insufficient_privilege then null; end;
 begin perform pg_temp.versions(null); raise exception 'Anonymous discovery'; exception when insufficient_privilege then null; end;
 begin perform pg_temp.versions(4,999); raise exception 'Missing locator disclosed'; exception when insufficient_privilege then null; end;
 if jsonb_array_length(pg_temp.versions(4)->'versions')<>1 then raise exception 'Manager discovery failed'; end if;
end $$;
select pg_temp.viewer('accept_viewer',2);
-- Tie timestamps intentionally: the UUID tiebreaker must paginate deterministically.
insert into public.organization_form_versions(id,org_id,form_id,page_id,version,created_at)
 select public.fixture_form_id(n),v.org_id,v.form_id,v.page_id,
 jsonb_set(jsonb_set(v.version,'{id}',to_jsonb(public.fixture_form_id(n)::text)),'{revision}',to_jsonb(n)),v.created_at
 from public.organization_form_versions v cross join generate_series(1000,1053) n where v.id=public.fixture_form_id(80);
insert into public.organization_forms(org_id,id,intake_manager) values(public.fixture_form_id(1),public.fixture_form_id(21),public.fixture_form_id(4));
insert into public.organization_form_versions(id,org_id,form_id,page_id,version)
 select public.fixture_form_id(81),org_id,public.fixture_form_id(21),page_id,version from public.organization_form_versions where id=public.fixture_form_id(80);
do $$ declare first_page jsonb; second_page jsonb; cursor_id uuid; begin
 first_page:=pg_temp.versions(); cursor_id:=(first_page->>'next')::uuid;
 if jsonb_array_length(first_page->'versions')<>50 or cursor_id is null then raise exception 'Unbounded or incomplete first page'; end if;
 second_page:=public.list_organization_form_response_versions(public.fixture_form_id(2),public.fixture_form_id(80),cursor_id);
 if jsonb_array_length(second_page->'versions')<>5 or second_page->>'next' is not null then raise exception 'Pagination dropped rows'; end if;
 if exists(select 1 from jsonb_array_elements(first_page->'versions') a join jsonb_array_elements(second_page->'versions') b on a->>'id'=b->>'id') then raise exception 'Duplicate pagination'; end if;
 if first_page#>>'{versions,0,id}'<>public.fixture_form_id(1053)::text then raise exception 'Unstable ordering'; end if;
 if second_page#>>'{versions,4,id}'<>public.fixture_form_id(80)::text then raise exception 'Original version missing'; end if;
 if exists(select 1 from jsonb_array_elements(first_page->'versions') a where a ? 'definition' or a ? 'answers' or a ? 'pageId') then raise exception 'Private payload included'; end if;
 begin perform pg_temp.versions(2,81); raise exception 'Neighbor form disclosed'; exception when insufficient_privilege then null; end;
 begin perform pg_temp.versions(2,80,81); raise exception 'Foreign form cursor allowed'; exception when invalid_parameter_value then null; end;
 begin perform pg_temp.versions(2,80,999); raise exception 'Missing cursor allowed'; exception when invalid_parameter_value then null; end;
 -- Version listing grants neither a page-wide directory nor correction.
 begin perform public.list_organization_form_versions(public.fixture_form_id(2),public.fixture_form_id(10)); raise exception 'Page discovery allowed'; exception when insufficient_privilege then null; end;
 begin perform public.fixture_form_command('correct',2); raise exception 'Correction allowed'; exception when insufficient_privilege then null; end;
 if (select count(*) from public.organization_form_responses)<>1 then raise exception 'Answers changed'; end if;
 if has_function_privilege('authenticated','public.list_organization_form_response_versions(uuid,uuid,uuid)','EXECUTE') or has_function_privilege('anon','public.list_organization_form_response_versions(uuid,uuid,uuid)','EXECUTE') then raise exception 'RPC exposed'; end if;
 if not has_function_privilege('service_role','public.list_organization_form_response_versions(uuid,uuid,uuid)','EXECUTE') then raise exception 'Service RPC unavailable'; end if;
end $$;
select pg_temp.viewer('revoke_viewer',4,601,3);
do $$ begin
 begin perform pg_temp.versions(); raise exception 'Revoked discovery survived'; exception when insufficient_privilege then null; end;
end $$;
rollback;
