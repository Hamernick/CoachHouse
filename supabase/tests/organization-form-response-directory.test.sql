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
create function pg_temp.directory(actor integer default 2,version_id integer default 80,cursor_id uuid default null) returns jsonb language sql as $$
 select public.list_accessible_organization_forms(public.fixture_form_id(actor),public.fixture_form_id(version_id),cursor_id);
$$;
do $$ begin
 begin perform pg_temp.directory(); raise exception 'Ungrantable discovery'; exception when insufficient_privilege then null; end;
 begin perform pg_temp.directory(1); raise exception 'Implicit owner discovery'; exception when insufficient_privilege then null; end;
 begin perform pg_temp.directory(null); raise exception 'Anonymous discovery'; exception when insufficient_privilege then null; end;
 begin perform pg_temp.directory(4,999); raise exception 'Missing anchor discovery'; exception when insufficient_privilege then null; end;
 if jsonb_array_length(pg_temp.directory(4)->'forms')<>1 then raise exception 'Manager discovery failed'; end if;
end $$;
-- Synthetic grants cover accepted, pending, revoked, stale-manager, ungranted
-- and unpublished forms. None creates organization membership for the invitee.
insert into public.organization_forms(org_id,id,intake_manager)
 select public.fixture_form_id(1),public.fixture_form_id(n),public.fixture_form_id(4) from generate_series(1000,1057) n;
insert into public.organization_form_versions(id,org_id,form_id,page_id,version,created_at)
 select public.fixture_form_id(n+1000),v.org_id,public.fixture_form_id(n),v.page_id,
 jsonb_set(jsonb_set(jsonb_set(v.version,'{id}',to_jsonb(public.fixture_form_id(n+1000)::text)),
 '{formId}',to_jsonb(public.fixture_form_id(n)::text)),'{title}',to_jsonb('Form '||n)),v.created_at
 from public.organization_form_versions v cross join generate_series(1000,1056) n where v.id=public.fixture_form_id(80);
insert into public.organization_form_viewer_invitations(id,org_id,form_id,email,invited_by,manager_revision,accepted_by,accepted_at,revoked_at)
 select public.fixture_form_id(n+3000),f.org_id,f.id,'person2@example.org',f.intake_manager,
 case when n=1056 then f.manager_revision+1 else f.manager_revision end,
 case when n=1054 then null else public.fixture_form_id(2) end,
 case when n=1054 then null else now() end,
 case when n=1055 then now() else null end
 from generate_series(1000,1057) n join public.organization_forms f on f.id=public.fixture_form_id(n);
select public.organization_form_viewer_access(public.fixture_form_id(4),jsonb_build_object('action','invite_viewer','versionId',public.fixture_form_id(80),
 'email','person2@example.org','operationId',public.fixture_form_id(600),'expectedRevision',1));
do $$ begin
 begin perform pg_temp.directory(); raise exception 'Pending anchor discovery'; exception when insufficient_privilege then null; end;
end $$;
select public.organization_form_viewer_access(public.fixture_form_id(2),jsonb_build_object('action','accept_viewer','versionId',public.fixture_form_id(80),'invitationId',public.fixture_form_id(600)));
-- Same canonical UUID in another organization must not cross the anchor scope.
insert into public.organization_forms(org_id,id,intake_manager) values(public.fixture_form_id(2),public.fixture_form_id(1000),public.fixture_form_id(2));
insert into public.organization_workspace_pages(id,org_id,particle_ids) values(public.fixture_form_id(11),public.fixture_form_id(2),array[public.fixture_form_id(1000)]);
insert into public.organization_form_versions(id,org_id,form_id,page_id,version)
 select public.fixture_form_id(8000),public.fixture_form_id(2),public.fixture_form_id(1000),public.fixture_form_id(11),jsonb_set(version,'{title}','"Other organization"')
 from public.organization_form_versions where id=public.fixture_form_id(2000);
-- An explicit owner grant, without a membership row, exposes only that form.
select public.organization_form_review_access(public.fixture_form_id(4),jsonb_build_object('action','grant_reviewer','versionId',public.fixture_form_id(80),
 'email','person1@example.org','role','view','expectedRevision',3,'operationId',public.fixture_form_id(620)));
do $$ begin
 if jsonb_array_length(pg_temp.directory(1)->'forms')<>1 then raise exception 'Owner grant widened directory'; end if;
 if jsonb_array_length(pg_temp.directory(2,8000)->'forms')<>1 then raise exception 'Cross-organization directory leak'; end if;
 if exists(select 1 from public.organization_memberships where org_id=public.fixture_form_id(1) and member_id=public.fixture_form_id(1)) then raise exception 'Owner membership manufactured'; end if;
end $$;
-- A second version must replace, not duplicate, the one directory entry.
insert into public.organization_form_versions(id,org_id,form_id,page_id,version,created_at)
 select public.fixture_form_id(3000),org_id,form_id,page_id,jsonb_set(version,'{title}','"Latest form"'),created_at
 from public.organization_form_versions where id=public.fixture_form_id(2000);
do $$ declare first_page jsonb; second_page jsonb; begin
 first_page:=pg_temp.directory();
 if jsonb_array_length(first_page->'forms')<>50 or first_page->>'next' is null then raise exception 'First page unbounded or incomplete'; end if;
 second_page:=pg_temp.directory(2,80,(first_page->>'next')::uuid);
 if jsonb_array_length(second_page->'forms')<>5 or second_page->>'next' is not null then raise exception 'Pagination lost forms or leaked excluded forms'; end if;
 if exists(select 1 from jsonb_array_elements(first_page->'forms') a join jsonb_array_elements(second_page->'forms') b on a->>'formId'=b->>'formId') then raise exception 'Duplicate canonical form'; end if;
 if first_page#>>'{forms,1,versionId}'<>public.fixture_form_id(3000)::text then raise exception 'Latest version not selected'; end if;
 if exists(select 1 from jsonb_array_elements(first_page->'forms') a where a ? 'definition' or a ? 'answers' or a ? 'pageId' or a ? 'email') then raise exception 'Private payload included'; end if;
 if (select count(*) from public.organization_form_responses)<>1 or exists(select 1 from public.organization_form_corrections) then raise exception 'Directory mutated responses'; end if;
 if has_function_privilege('authenticated','public.list_accessible_organization_forms(uuid,uuid,uuid)','EXECUTE') or has_function_privilege('anon','public.list_accessible_organization_forms(uuid,uuid,uuid)','EXECUTE') then raise exception 'RPC exposed'; end if;
 if not has_function_privilege('service_role','public.list_accessible_organization_forms(uuid,uuid,uuid)','EXECUTE') then raise exception 'Service unavailable'; end if;
end $$;
update public.organization_form_viewer_invitations set revoked_at=now() where form_id=public.fixture_form_id(1000);
do $$ begin
 if exists(select 1 from jsonb_array_elements(pg_temp.directory()->'forms') x where x->>'formId'=public.fixture_form_id(1000)::text) then raise exception 'Revoked neighbor disclosed'; end if;
end $$;
select public.organization_form_viewer_access(public.fixture_form_id(4),jsonb_build_object('action','revoke_viewer','versionId',public.fixture_form_id(80),
 'operationId',public.fixture_form_id(601),'expectedRevision',4,'invitationId',public.fixture_form_id(600)));
do $$ begin
 begin perform pg_temp.directory(); raise exception 'Revoked anchor discovery'; exception when insufficient_privilege then null; end;
end $$;
rollback;
