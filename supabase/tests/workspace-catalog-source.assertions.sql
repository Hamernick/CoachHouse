-- Runs only in the disposable full-schema source-permission fixture.
create function pg_temp.catalog_check(ok boolean,message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'Catalog assertion: %',message;end if;end $$;
create function pg_temp.catalog_denied(command text,code text default '42501') returns void language plpgsql as $$
begin begin execute command;exception when others then if sqlstate=code then return;end if;raise;end;
 raise exception 'Unexpected catalog success';end $$;
\set org 'e972bc07-fbf5-4fc8-a416-7f00910a71e2'
\set actor '90b6c688-889c-467f-9edd-166f28bf0819'
\set private '76000000-0000-4000-8000-000000000006'
\set empty '77000000-0000-4000-8000-000000000001'
set request.jwt.claim.role='service_role';
select set_config('request.jwt.claim.sub','',false);
select set_config('request.headers',jsonb_build_object('x-coach-house-actor-id',:'org')::text,false);
-- Retained lineage (without a current file reference) must also protect deletion.
update organization_workspace_boards set state=jsonb_build_object('particleGraph',jsonb_build_object('particles',jsonb_build_array(
 jsonb_build_object('id','75000000-0000-4000-8000-000000000003','type','activity','title','Retained private content'))),
 'workspaceCatalog',jsonb_build_object('version',1,'defaultName','Main workspace','entries',jsonb_build_array(
 jsonb_build_object('id',:'private','name','Private','createdAt',now(),'updatedAt',now(),'state',jsonb_build_object('particleGraph',jsonb_build_object('particles',jsonb_build_array(jsonb_build_object('id','77000000-0000-4000-8000-000000000002','type','activity','data',jsonb_build_object('widget',jsonb_build_object('kind','document','fileId','75000000-0000-4000-8000-000000000005'))))))),
 jsonb_build_object('id',:'empty','name','Empty','createdAt',now(),'updatedAt',now(),'state','{"nodes":[],"connections":[],"visibility":{"allCardsHiddenExplicitly":true,"organizationHiddenExplicitly":true}}'::jsonb)))) where org_id=:'org';
create temporary table catalog_before as select state from organization_workspace_boards where org_id=:'org';
grant select on catalog_before to service_role;
select set_config('request.headers',jsonb_build_object('x-coach-house-actor-id',:'actor')::text,false);
set role service_role;
select pg_temp.catalog_check(public.commit_workspace_catalog(:'org',:'actor',(select state from catalog_before),jsonb_set((select state from catalog_before),'{workspaceCatalog,defaultName}','"Renamed"')),'Rename mixed board');
reset role;
select pg_temp.catalog_check((select (a.state-'workspaceCatalog')=(b.state-'workspaceCatalog') and a.state#>'{workspaceCatalog,entries}'=b.state#>'{workspaceCatalog,entries}' from organization_workspace_boards a cross join catalog_before b where org_id=:'org'),'Exact private root/named content preserved');
-- Create a new empty canvas against the complete board, preserving both sources.
set role service_role;
select pg_temp.catalog_check((select public.commit_workspace_catalog(:'org',:'actor',state,jsonb_set(state,'{workspaceCatalog,entries}',(state#>'{workspaceCatalog,entries}')||jsonb_build_array(jsonb_build_object('id','77000000-0000-4000-8000-000000000009','name','New','createdAt',now(),'updatedAt',now(),'state','{"nodes":[],"connections":[],"visibility":{"allCardsHiddenExplicitly":true,"organizationHiddenExplicitly":true}}'::jsonb)))) from organization_workspace_boards where org_id=:'org'),'Create beside restricted content');
select pg_temp.catalog_check((select public.commit_workspace_catalog(:'org',:'actor',state,jsonb_set(state,'{workspaceCatalog,entries}',(state#>'{workspaceCatalog,entries}')-2)) from organization_workspace_boards where org_id=:'org'),'Remove only new empty canvas');
reset role;
-- Stale full-state CAS cannot overwrite a collaborator or even another rename.
set role service_role;
select pg_temp.catalog_check(not public.commit_workspace_catalog(:'org',:'actor',(select state from catalog_before),(select state from catalog_before)),'Stale CAS denied');
reset role;
update catalog_before set state=(select state from organization_workspace_boards where org_id=:'org');
set role service_role;
select pg_temp.catalog_denied(format('select public.commit_workspace_catalog(%L,%L,%L,%L)',:'org',:'actor',(select state from catalog_before),(select jsonb_set(state,'{workspaceCatalog,entries}',(state#>'{workspaceCatalog,entries}')-0) from catalog_before)));
select pg_temp.catalog_denied(format('select public.commit_workspace_catalog(%L,%L,%L,%L)',:'org',:'actor',(select state from catalog_before),(select jsonb_build_object('nodes','[]'::jsonb,'connections','[]'::jsonb,'visibility','{"allCardsHiddenExplicitly":true,"organizationHiddenExplicitly":true}'::jsonb,'workspaceCatalog',jsonb_set(state->'workspaceCatalog','{defaultDeleted}','true')) from catalog_before)));
-- Surviving bodies and unmarked root stripping cannot be supplied through this RPC.
select pg_temp.catalog_denied(format('select public.commit_workspace_catalog(%L,%L,%L,%L)',:'org',:'actor',(select state from catalog_before),(select jsonb_set(state,'{particleGraph,particles}','[]') from catalog_before)),'22023');
select pg_temp.catalog_denied(format('select public.commit_workspace_catalog(%L,%L,%L,%L)',:'org',:'actor',(select state from catalog_before),(select jsonb_set(state,'{workspaceCatalog,entries,0,state}','{}') from catalog_before)),'22023');
select pg_temp.catalog_denied(format('select public.commit_workspace_catalog(%L,%L,%L,%L)',:'org',:'actor',(select state from catalog_before),(select '{"nodes":[],"connections":[],"visibility":{"allCardsHiddenExplicitly":true,"organizationHiddenExplicitly":true}}'::jsonb||jsonb_build_object('workspaceCatalog',state->'workspaceCatalog') from catalog_before)),'22023');
select pg_temp.catalog_check(public.commit_workspace_catalog(:'org',:'actor',(select state from catalog_before),(select jsonb_set(state,'{workspaceCatalog,entries}',(state#>'{workspaceCatalog,entries}')-1) from catalog_before)),'Delete unrelated empty canvas');
reset role;
update catalog_before set state=(select state from organization_workspace_boards where org_id=:'org');
-- A fresh member downgrade blocks even metadata-only writes. Owner still works.
update organization_memberships set role='member' where org_id=:'org' and member_id=:'actor';
set role service_role;
select pg_temp.catalog_denied(format('select public.commit_workspace_catalog(%L,%L,%L,%L)',:'org',:'actor',(select state from catalog_before),(select state from catalog_before)));
select set_config('request.headers',jsonb_build_object('x-coach-house-actor-id',:'org')::text,false);
select pg_temp.catalog_check(public.commit_workspace_catalog(:'org',:'org',(select state from catalog_before),(select state from catalog_before)),'Owner access retained');
select pg_temp.catalog_denied(format('select public.commit_workspace_catalog(%L,%L,%L,%L)',:'org',:'actor',(select state from catalog_before),(select state from catalog_before)));
reset role;
update organization_memberships set role='staff' where org_id=:'org' and member_id=:'actor';
-- Actual source grants permit deletion; revocation rejects the same candidate.
begin;
insert into project_asset_folder_grants(project_id,folder_id,member_id,membership_created_at,capability)
 select '76000000-0000-4000-8000-000000000001','76000000-0000-4000-8000-000000000002',member_id,created_at,'view' from organization_memberships where org_id=:'org' and member_id=:'actor';
select set_config('request.headers',jsonb_build_object('x-coach-house-actor-id',:'actor')::text,true);
set local role service_role;
select pg_temp.catalog_check(public.commit_workspace_catalog(:'org',:'actor',(select state from catalog_before),(select jsonb_set(state,'{workspaceCatalog,entries}','[]') from catalog_before)),'Granted deletion works');
rollback;
select set_config('request.headers',jsonb_build_object('x-coach-house-actor-id',:'actor')::text,false);
set role service_role;
select pg_temp.catalog_denied(format('select public.commit_workspace_catalog(%L,%L,%L,%L)',:'org',:'actor',(select state from catalog_before),(select jsonb_set(state,'{workspaceCatalog,entries}','[]') from catalog_before)));
reset role;
select pg_temp.catalog_check(not has_function_privilege('anon','public.commit_workspace_catalog(uuid,uuid,jsonb,jsonb)','execute') and not has_function_privilege('authenticated','public.commit_workspace_catalog(uuid,uuid,jsonb,jsonb)','execute'),'No direct client access');
select pg_temp.catalog_check((select a.state=b.state from organization_workspace_boards a cross join catalog_before b where org_id=:'org'),'Denied operations leave canonical state intact');

begin isolation level repeatable read;
set local role service_role;
select pg_temp.catalog_denied(format('select public.commit_workspace_catalog(%L,%L,%L,%L)',:'org',:'actor',(select state from catalog_before),(select state from catalog_before)),'40001');
rollback;
