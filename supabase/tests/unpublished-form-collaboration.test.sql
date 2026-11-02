\set ON_ERROR_STOP on
begin;
do $$ begin
 if current_setting('coach_house.workspace_sharing_fixture',true) is distinct from 'isolated-test-only' or current_database() not like 'workspace_sharing_fixture_%' then raise exception 'Fixture required'; end if;
end $$;
insert into public.organization_memberships(org_id,member_id,role) values(public.fixture_form_id(1),public.fixture_form_id(4),'staff') on conflict(org_id,member_id) do update set role='staff';
update public.organization_workspace_boards set state='{}',updated_by=public.fixture_form_id(1);
truncate public.organization_forms cascade;
delete from public.organization_workspace_pages;
-- Create real canonical drafts through the existing board guard; never publish.
update public.organization_workspace_boards set state=jsonb_build_object('particleGraph',jsonb_build_object('revision',1,'workspaceId',public.fixture_form_id(1),'particles',(
 select jsonb_agg(jsonb_build_object('id',public.fixture_form_id(n),'type','activity','title','Draft '||n,'description','','revision',1,'data',jsonb_build_object('widget',jsonb_build_object('kind','form','definition',jsonb_build_object('questions','[]'::jsonb)))) order by n)
 from generate_series(20,74) n))),updated_by=public.fixture_form_id(4) where org_id=public.fixture_form_id(1);
-- A second canonical appearance shares one identity; a mirrored source is excluded.
update public.organization_workspace_boards set state=jsonb_set(state,'{workspaceCatalog}',jsonb_build_object('entries',jsonb_build_array(jsonb_build_object('id',public.fixture_form_id(500),'state',jsonb_build_object('particleGraph',jsonb_build_object('revision',1,'particles',jsonb_build_array(state#>'{particleGraph,particles,0}'))))))),updated_by=public.fixture_form_id(4) where org_id=public.fixture_form_id(1);
create function pg_temp.source(actor integer,action text default 'read_form_source',form integer default 20,patch jsonb default '{}') returns jsonb language sql as $$
 select public.organization_form_source_command(public.fixture_form_id(actor),jsonb_build_object('action',action,'organizationId',public.fixture_form_id(1),'formId',public.fixture_form_id(form))||patch);
$$;
create function pg_temp.access(actor integer,action text,patch jsonb default '{}') returns jsonb language sql as $$
 select public.organization_form_viewer_access(public.fixture_form_id(actor),jsonb_build_object('action',action,'organizationId',public.fixture_form_id(1),'formId',public.fixture_form_id(20))||patch);
$$;
create function pg_temp.invite(actor integer,person integer,scope text,op integer) returns jsonb language sql as $$
 select pg_temp.access(actor,'invite_viewer',jsonb_build_object('email','person'||person||'@example.org','responsePermission',scope,'operationId',public.fixture_form_id(op),'expectedRevision',(select access_revision from public.organization_forms where org_id=public.fixture_form_id(1) and id=public.fixture_form_id(20))));
$$;
create function pg_temp.accept(actor integer,op integer) returns jsonb language sql as $$
 select pg_temp.access(actor,'accept_viewer',jsonb_build_object('invitationId',public.fixture_form_id(op)));
$$;
do $$ begin
 if exists(select 1 from public.organization_form_versions) then raise exception 'Synthetic publication'; end if;
 if (select intake_manager from public.organization_forms where org_id=public.fixture_form_id(1) and id=public.fixture_form_id(20))<>public.fixture_form_id(4) then raise exception 'Draft ownership changed'; end if;
 begin perform pg_temp.source(1); raise exception 'Implicit owner source access'; exception when insufficient_privilege then null; end;
 begin perform pg_temp.source(2); raise exception 'Uninvited read'; exception when insufficient_privilege then null; end;
 begin perform pg_temp.source(2,'form_source_directory'); raise exception 'Uninvited discovery'; exception when insufficient_privilege then null; end;
 begin perform pg_temp.invite(4,2,'view',800); raise exception 'Draft View accepted'; exception when invalid_parameter_value then null; end;
 begin perform pg_temp.invite(4,2,'correct',800); raise exception 'Draft Correct accepted'; exception when invalid_parameter_value then null; end;
 begin perform pg_temp.source(4,'read_form_source',20,jsonb_build_object('versionId',public.fixture_form_id(80))); raise exception 'Ambiguous address'; exception when invalid_parameter_value then null; end;
end $$;
select pg_temp.invite(4,2,'manage',800);
do $$ declare offer jsonb; begin
 offer:=pg_temp.access(2,'viewer_offer');
 if offer->>'title'<>'Draft 20' or offer ? 'versionId' or offer->>'formId'<>public.fixture_form_id(20)::text then raise exception 'Wrong draft invitation'; end if;
 begin perform pg_temp.source(2); raise exception 'Pending grant read'; exception when insufficient_privilege then null; end;
 begin perform pg_temp.access(3,'viewer_offer'); raise exception 'Other email offer'; exception when insufficient_privilege then null; end;
 begin perform pg_temp.accept(9,800); raise exception 'Unverified acceptance'; exception when insufficient_privilege then null; end;
end $$;
select pg_temp.accept(2,800); select pg_temp.accept(2,800);
select pg_temp.invite(2,3,'edit',801); select pg_temp.accept(3,801);
do $$ declare result jsonb; content jsonb; command jsonb; receipt jsonb; begin
 result:=pg_temp.source(2,'form_source_entry');
 if not (result->>'canManageInvitations')::boolean then raise exception 'Manager cannot invite'; end if;
 if (pg_temp.source(3,'form_source_entry')->>'canManageInvitations')::boolean then raise exception 'Edit can invite'; end if;
 result:=pg_temp.source(2,'form_source_directory');
 if jsonb_array_length(result->'forms')<>1 or result#>>'{forms,0,formId}'<>public.fixture_form_id(20)::text then raise exception 'Directory leaked other drafts'; end if;
 begin perform pg_temp.invite(2,5,'manage',802); raise exception 'Manage redelegated'; exception when insufficient_privilege then null; end;
 begin perform pg_temp.source(3,'read_form_source',21); raise exception 'Other draft read'; exception when insufficient_privilege then null; end;
 begin perform pg_temp.source(3,'read_form_source',20,jsonb_build_object('organizationId',public.fixture_form_id(2))); raise exception 'Other organization read'; exception when insufficient_privilege then null; end;
 result:=pg_temp.source(3); content:=result-array['formId','revision']; content:=jsonb_set(content,'{title}','"Edited unpublished form"');
 command:=jsonb_build_object('operationId',public.fixture_form_id(803),'expectedRevision',result->>'revision','content',content);
 receipt:=pg_temp.source(3,'save_form_source',20,command);
 if pg_temp.source(3,'save_form_source',20,command)<>receipt then raise exception 'Retry receipt changed'; end if;
 if pg_temp.source(3)->>'title'<>'Edited unpublished form' then raise exception 'Canonical save missing'; end if;
 if (select state#>>'{workspaceCatalog,entries,0,state,particleGraph,particles,0,title}' from public.organization_workspace_boards where org_id=public.fixture_form_id(1))<>'Edited unpublished form' then raise exception 'Named appearance not saved'; end if;
 if pg_temp.source(4,'read_form_source',21)->>'title'<>'Draft 21' then raise exception 'Other form changed'; end if;
 begin perform pg_temp.source(3,'save_form_source',20,command||jsonb_build_object('operationId',public.fixture_form_id(804))); raise exception 'Stale draft saved'; exception when serialization_failure then null; end;
 begin perform pg_temp.source(3,'save_form_source',20,jsonb_set(command,'{content,title}','"Different payload"')); raise exception 'Operation reused'; exception when unique_violation then null; end;
 if exists(select 1 from public.organization_form_versions) then raise exception 'Save published'; end if;
end $$;
-- Fifty-row stable keyset discovery includes only accepted Edit/Manage grants.
insert into public.organization_form_viewer_invitations(id,org_id,form_id,email,invited_by,manager_revision,response_permission,accepted_by,accepted_at)
select public.fixture_form_id(1000+n),public.fixture_form_id(1),public.fixture_form_id(n),'person2@example.org',public.fixture_form_id(4),1,'edit',public.fixture_form_id(2),now() from generate_series(21,73) n;
do $$ declare first_page jsonb; last_page jsonb; begin
 first_page:=pg_temp.source(2,'form_source_directory');
 if jsonb_array_length(first_page->'forms')<>50 or first_page->>'next'<>public.fixture_form_id(69)::text then raise exception 'Wrong first keyset'; end if;
 last_page:=pg_temp.source(2,'form_source_directory',20,jsonb_build_object('after',first_page->>'next'));
 if jsonb_array_length(last_page->'forms')<>4 or last_page->>'next' is not null or last_page#>>'{forms,0,formId}'<>public.fixture_form_id(70)::text then raise exception 'Wrong last keyset'; end if;
end $$;
-- Removing the exact anchor ends discovery, children and retries immediately.
select pg_temp.access(4,'revoke_viewer',jsonb_build_object('invitationId',public.fixture_form_id(800),'operationId',public.fixture_form_id(805),'expectedRevision',(select access_revision from public.organization_forms where org_id=public.fixture_form_id(1) and id=public.fixture_form_id(20))));
do $$ begin
 begin perform pg_temp.source(2,'form_source_directory'); raise exception 'Revoked anchor discovery'; exception when insufficient_privilege then null; end;
 begin perform pg_temp.source(3); raise exception 'Revoked child read'; exception when insufficient_privilege then null; end;
end $$;
select pg_temp.invite(4,2,'manage',806); select pg_temp.accept(2,806);
do $$ begin
 begin perform pg_temp.source(3); raise exception 'Regrant restored child'; exception when insufficient_privilege then null; end;
end $$;
select public.fixture_closure('request',900,0);
do $$ begin
 begin perform pg_temp.source(2); raise exception 'Closing draft read'; exception when insufficient_privilege then null; end;
 begin perform pg_temp.source(2,'save_form_source',20,jsonb_build_object('operationId',public.fixture_form_id(808),'expectedRevision',repeat('a',64),'content',jsonb_build_object('title','Closed write','description','','definition',jsonb_build_object('questions','[]'::jsonb)))); raise exception 'Closing draft write'; exception when insufficient_privilege then null; end;
 begin perform pg_temp.source(2,'form_source_directory'); raise exception 'Closing discovery'; exception when insufficient_privilege then null; end;
 begin perform pg_temp.access(2,'viewer_invitations'); raise exception 'Closing invitations'; exception when insufficient_privilege then null; end;
 begin perform pg_temp.invite(4,5,'edit',807); raise exception 'Closing invite'; exception when insufficient_privilege then null; end;
end $$;
select public.fixture_closure('cancel',901,1);
do $$ begin
 if exists(select 1 from public.organization_form_versions) then raise exception 'Cancel published'; end if;
 begin perform pg_temp.source(3); raise exception 'Cancel restored child'; exception when insufficient_privilege then null; end;
 if has_function_privilege('service_role','public.organization_form_source_command_before_closure(uuid,jsonb)','EXECUTE') or has_function_privilege('authenticated','public.organization_form_source_command(uuid,jsonb)','EXECUTE') then raise exception 'Private writer exposed'; end if;
end $$;
-- A surviving ledger/grant never makes a removed canonical draft discoverable.
update public.organization_workspace_boards set state=jsonb_set(jsonb_set(state,'{particleGraph,particles}',
  (select jsonb_agg(p) from jsonb_array_elements(state#>'{particleGraph,particles}') p where p->>'id'<>public.fixture_form_id(20)::text)),
  '{workspaceCatalog,entries,0,state,particleGraph,particles}','[]'),updated_by=public.fixture_form_id(4) where org_id=public.fixture_form_id(1);
do $$ begin
 begin perform pg_temp.source(2); raise exception 'Removed canonical source read'; exception when insufficient_privilege then null; end;
 begin perform pg_temp.access(2,'viewer_offer'); raise exception 'Removed canonical invitation offered'; exception when insufficient_privilege then null; end;
 if exists(select 1 from jsonb_array_elements(pg_temp.source(2,'form_source_directory',21)->'forms') f where f->>'formId'=public.fixture_form_id(20)::text) then raise exception 'Removed canonical source discovered'; end if;
end $$;
rollback;
