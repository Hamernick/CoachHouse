-- This file runs only in the owned, disposable full-schema provenance fixture.
create function pg_temp.check_write(ok boolean,message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'Assertion failed: %',message;end if;end $$;
create function pg_temp.deny_write(command text,expected_message text default 'Board source access required.') returns void language plpgsql as $$
begin begin execute command;exception when others then if sqlstate='42501' and sqlerrm=expected_message then return;end if;raise exception 'Expected %, got %: %',expected_message,sqlstate,sqlerrm;end;raise exception 'Unexpected success: %',command;end $$;
\set org 'e972bc07-fbf5-4fc8-a416-7f00910a71e2'
\set actor '90b6c688-889c-467f-9edd-166f28bf0819'
\set project '76000000-0000-4000-8000-000000000001'
\set folder '76000000-0000-4000-8000-000000000002'
\set file '75000000-0000-4000-8000-000000000005'
\set second_file '75000000-0000-4000-8000-000000000006'
set request.jwt.claim.role='service_role';
select set_config('request.headers',jsonb_build_object('x-coach-house-actor-id',:'org')::text,false);
insert into organization_projects(id,org_id,name,created_by,updated_by,status,start_date,end_date)
 values(:'project',:'org','Source fence fixture',:'org',:'org','active','2027-01-01','2027-01-31');
insert into project_asset_folder_libraries(project_id) values(:'project');
insert into project_asset_folders(project_id,id,name,position,audience,created_by) values(:'project',:'folder','Private',0,'restricted',:'org');
insert into organization_document_files(id,org_id,storage_path,name,mime_type,size_bytes,created_by) values
 (:'file',:'org',:'org'||'/library/write-fence.md','Private evidence.md','text/markdown',10,:'org'),
 (:'second_file',:'org',:'org'||'/library/write-fence-shared.md','Shared.md','text/markdown',10,:'org');
insert into document_file_folder_authorities(file_id,project_id,folder_id) values(:'file',:'project',:'folder');
create temporary table fence_original as select state from organization_workspace_boards where org_id=:'org';
-- Native source, detached generated note (captured by the previous real trigger
-- test), transitive checklist, independent work and incident connection.
update organization_workspace_boards set state=jsonb_set(state,'{particleGraph}',jsonb_build_object(
 'rootId','76000000-0000-4000-8000-000000000003','revision',0,'receipts','[]'::jsonb,
 'particles',jsonb_build_array(
 jsonb_build_object('id','76000000-0000-4000-8000-000000000003','type','activity','title','Private file','data',jsonb_build_object('widget',jsonb_build_object('kind','document','fileId',:'file'))),
 jsonb_build_object('id','75000000-0000-4000-8000-000000000003','type','activity','title','Detached generated note'),
 jsonb_build_object('id','76000000-0000-4000-8000-000000000004','type','activity','title','Public work'),
 jsonb_build_object('id','76000000-0000-4000-8000-000000000005','type','workflow','title','Container','data',jsonb_build_object('steps',jsonb_build_array(jsonb_build_object('particleId','75000000-0000-4000-8000-000000000003'))))),
 'connections',jsonb_build_array(jsonb_build_object('id','fence-edge','source','76000000-0000-4000-8000-000000000003','target','76000000-0000-4000-8000-000000000004')))) where org_id=:'org';
create temporary table fence_baseline as select state from organization_workspace_boards where org_id=:'org';
grant select on fence_baseline to authenticated,service_role;
select pg_temp.check_write((select count(*)=3 from workspace_particle_board_files(:'org',(select state from fence_baseline)) where file_id=:'file'),'Native, detached and container dependencies found');
select pg_temp.check_write(not exists(select 1 from workspace_particle_board_files(:'org',(select state from fence_baseline)) where record_id='particle:76000000-0000-4000-8000-000000000004'),'Public work stays independent');
-- The restored template omits Supabase default table ACLs. Give the actors
-- their real table verbs; keep every existing RLS policy/trigger active.
grant select,insert,update,delete on organization_workspace_boards to authenticated,service_role;
grant select on organization_memberships to authenticated;
-- Authenticated direct SQL cannot use a forged owner header to bypass the JWT.
set role authenticated;
set request.jwt.claim.role='authenticated';
select set_config('request.jwt.claim.sub',:'actor',false);
select pg_temp.deny_write(format('update organization_workspace_boards set state=jsonb_set(state,''{particleGraph,particles,0,title}'',''"Forged"'') where org_id=%L',:'org'));
select pg_temp.deny_write(format('update organization_workspace_boards set state=jsonb_set(state,''{particleGraph,particles,0,data,widget}'',''{}'') where org_id=%L',:'org'));
select pg_temp.deny_write(format('update organization_workspace_boards set state=jsonb_set(state,''{particleGraph,particles,1,title}'',''"Forged"'') where org_id=%L',:'org'));
select pg_temp.deny_write(format('update organization_workspace_boards set state=jsonb_set(state,''{particleGraph,particles,3,title}'',''"Forged"'') where org_id=%L',:'org'));
select pg_temp.deny_write(format('update organization_workspace_boards set state=jsonb_set(state,''{particleGraph,connections}'',''[]'') where org_id=%L',:'org'));
select pg_temp.deny_write(format('update organization_workspace_boards set state=jsonb_set(state,''{particleGraph,rootId}'',''null'') where org_id=%L',:'org'));
select pg_temp.deny_write(format('update organization_workspace_boards set state=state-''particleGraph'' where org_id=%L',:'org'));
select pg_temp.deny_write(format('delete from organization_workspace_boards where org_id=%L',:'org'));
update organization_workspace_boards set state=jsonb_set(state,'{particleGraph,particles,2,title}','"Collaborator edit"') where org_id=:'org';
select pg_temp.check_write((select state#>>'{particleGraph,particles,2,title}'='Collaborator edit' and state#>>'{particleGraph,particles,1,title}'='Detached generated note' from organization_workspace_boards where org_id=:'org'),'Unrelated edits preserve restricted records');
reset role;
set request.jwt.claim.role='service_role';
select set_config('request.jwt.claim.sub','',false);
select set_config('request.headers',jsonb_build_object('x-coach-house-actor-id',:'actor')::text,false);
set role service_role;
select pg_temp.deny_write(format('update organization_workspace_boards set state=jsonb_set(state,''{particleGraph,particles,1,title}'',''"Elevated bypass"'') where org_id=%L',:'org'));
select set_config('request.headers','{}',false);
select pg_temp.deny_write(format('update organization_workspace_boards set state=jsonb_set(state,''{particleGraph,particles,0,title}'',''"Missing actor"'') where org_id=%L',:'org'),'Verified board actor required.');
reset role;
select set_config('request.headers',jsonb_build_object('x-coach-house-actor-id',:'org')::text,false);
update organization_workspace_boards set state=jsonb_set(state,'{particleGraph,particles,0,title}','"Owner retains access"') where org_id=:'org';
-- A view grant admits board edits, not canonical file-body edits; parent board
-- write authorization still owns the operation. Fresh revocation denies again.
insert into project_asset_folder_grants(project_id,folder_id,member_id,membership_created_at,capability)
 select :'project',:'folder',member_id,created_at,'view' from organization_memberships where org_id=:'org' and member_id=:'actor';
select set_config('request.headers',jsonb_build_object('x-coach-house-actor-id',:'actor')::text,false);
update organization_workspace_boards set state=jsonb_set(state,'{particleGraph,particles,1,title}','"Granted edit"') where org_id=:'org';
delete from project_asset_folder_grants where project_id=:'project' and member_id=:'actor';
select pg_temp.deny_write(format('update organization_workspace_boards set state=jsonb_set(state,''{particleGraph,particles,1,title}'',''"Revoked edit"'') where org_id=%L',:'org'));
select pg_temp.check_write(not has_function_privilege('authenticated','workspace_particle_board_files(uuid,jsonb)','execute') and not has_function_privilege('service_role','assert_workspace_particle_source_view(uuid,uuid,uuid)','execute'),'No public/elevated helper bypass');
-- Named canvases and first-time receipt bindings are checked before their
-- AFTER trigger captures origins. Client citations are deliberately empty.
create temporary table fence_named as select jsonb_set(state,'{workspaceCatalog,entries}',
 coalesce(state#>'{workspaceCatalog,entries}','[]'::jsonb)||jsonb_build_array(jsonb_build_object('id','76000000-0000-4000-8000-000000000006','state',jsonb_build_object('particleGraph',jsonb_build_object('particles',jsonb_build_array(
 jsonb_build_object('id','76000000-0000-4000-8000-000000000007','type','objective','data',jsonb_build_object('planning',jsonb_build_object('proposals',jsonb_build_array(jsonb_build_object('id','76000000-0000-4000-8000-000000000008','researchRunId','75000000-0000-4000-8000-000000000001','sources','[]'::jsonb,'particleIds',jsonb_build_array('76000000-0000-4000-8000-000000000009')))))),
 jsonb_build_object('id','76000000-0000-4000-8000-000000000009','type','activity','title','New generated note'))))))) as state
 from organization_workspace_boards where org_id=:'org';
select pg_temp.deny_write(format('update organization_workspace_boards set state=(select state from fence_named) where org_id=%L',:'org'));
select pg_temp.check_write(not exists(select 1 from workspace_particle_ai_origins where record_id='particle:76000000-0000-4000-8000-000000000009'),'Rejected write does not capture new origins');
select set_config('request.headers',jsonb_build_object('x-coach-house-actor-id',:'org')::text,false);
update organization_workspace_boards set state=(select state from fence_named) where org_id=:'org';
select pg_temp.check_write(exists(select 1 from workspace_particle_ai_origins where record_id='particle:76000000-0000-4000-8000-000000000009'),'Authorized named-canvas insert captures origins');
select set_config('request.headers',jsonb_build_object('x-coach-house-actor-id',:'actor')::text,false);
select pg_temp.deny_write(format('update organization_workspace_boards set state=jsonb_set(state,''{workspaceCatalog,entries}'',''[]'') where org_id=%L',:'org'));
-- An unchanged canonical snapshot and viewport-only save need no private grant.
update organization_workspace_boards set state=jsonb_set(state,'{sourceFenceViewport}','{"x":1}') where org_id=:'org';
-- Keep this graph for two-client race tests; only the disposable DB is changed.
