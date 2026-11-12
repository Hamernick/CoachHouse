-- Run after the existing real write/race fixture. Only its disposable DB changes.
create function pg_temp.check_read(ok boolean,message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'Assertion failed: %',message;end if;end $$;
create function pg_temp.deny_read(command text) returns void language plpgsql as $$
begin begin execute command;exception when others then
 if sqlstate='42501' and sqlerrm='Board source access required.' then return;end if;
 raise exception 'Expected source denial, got %: %',sqlstate,sqlerrm;
 end;raise exception 'Unexpected success: %',command;end $$;
\set org 'e972bc07-fbf5-4fc8-a416-7f00910a71e2'
\set actor '90b6c688-889c-467f-9edd-166f28bf0819'
\set project '76000000-0000-4000-8000-000000000001'
\set folder '76000000-0000-4000-8000-000000000002'
\set file '75000000-0000-4000-8000-000000000005'
set request.jwt.claim.role='service_role';
select set_config('request.headers',jsonb_build_object('x-coach-house-actor-id',:'org')::text,false);
insert into organization_memberships(org_id,member_id,role,member_email) select :'org',:'actor','staff',email from auth.users where id=:'actor' on conflict(org_id,member_id) do nothing;
delete from project_asset_folder_grants where project_id=:'project' and member_id=:'actor';
create temporary table read_baseline as select state,updated_at from organization_workspace_boards where org_id=:'org';
-- Confirm the fixture contains current sources and retained generated content.
select pg_temp.check_read((select count(*)>=3 from workspace_particle_board_files(:'org',(select state from read_baseline)) where file_id=:'file'),'Known private dependencies present');
set role authenticated;
set request.jwt.claim.role='authenticated';
select set_config('request.jwt.claim.sub',:'actor',false);
-- The header still claims owner. JWT wins. Error (not zero rows) prevents seeding
-- an empty board or a successful empty search from a denied canonical read.
select pg_temp.deny_read(format('select state from organization_workspace_boards where org_id=%L',:'org'));
select pg_temp.deny_read(format('select org_id from organization_workspace_boards where org_id=%L',:'org'));
select pg_temp.deny_read(format('select count(*) from organization_workspace_boards where org_id=%L',:'org'));
select pg_temp.deny_read(format('update organization_workspace_boards set state=state where org_id=%L returning state',:'org'));
select pg_temp.check_read(not public.can_read_workspace_particle_board('00000000-0000-4000-8000-000000000099','{}'),'Helper does not grant/probe another organization');
select set_config('request.jwt.claim.sub',:'org',false);
select pg_temp.check_read((select count(*)=1 from organization_workspace_boards where org_id=:'org'),'Owner retains raw board access');
reset role;
set request.jwt.claim.role='service_role';
select set_config('request.jwt.claim.sub','',false);
insert into project_asset_folder_grants(project_id,folder_id,member_id,membership_created_at,capability)
 select :'project',:'folder',member_id,created_at,'view' from organization_memberships where org_id=:'org' and member_id=:'actor';
set role authenticated;
set request.jwt.claim.role='authenticated';
select set_config('request.jwt.claim.sub',:'actor',false);
select pg_temp.check_read((select count(*)=1 from organization_workspace_boards where org_id=:'org'),'Current view grant admits full snapshot');
reset role;
set request.jwt.claim.role='service_role';
select set_config('request.jwt.claim.sub','',false);
delete from project_asset_folder_grants where project_id=:'project' and member_id=:'actor';
set role authenticated;
set request.jwt.claim.role='authenticated';
select set_config('request.jwt.claim.sub',:'actor',false);
select pg_temp.deny_read(format('select state from organization_workspace_boards where org_id=%L',:'org'));
reset role;
set request.jwt.claim.role='service_role';
select set_config('request.jwt.claim.sub','',false);
select pg_temp.check_read((select b.state=r.state and b.updated_at=r.updated_at from organization_workspace_boards b cross join read_baseline r where b.org_id=:'org'),'Reads and denied writes preserve exact canonical state/CAS');
-- Service canonical input is usable only by the verified current parent actor.
create function pg_temp.deny_projection(command text) returns void language plpgsql as $$
begin begin execute command;exception when others then
 if sqlstate='42501' and sqlerrm='Board projection access required.' then return;end if;raise;end;
 raise exception 'Projection unexpectedly allowed';end $$;
select set_config('request.headers',jsonb_build_object('x-coach-house-actor-id',:'actor')::text,false);
set role service_role;
select pg_temp.check_read((public.read_workspace_particle_board_for_projection(:'org',:'actor')->'state'->'particleGraph'->'particles'->0->>'title') is not null,'Trusted projection input remains canonical');
select pg_temp.deny_projection(format('select public.read_workspace_particle_board_for_projection(%L,%L)',:'org',:'org'));
select pg_temp.deny_projection(format('select public.read_workspace_particle_board_for_projection(%L,%L)','00000000-0000-4000-8000-000000000099',:'actor'));
select set_config('request.headers','{}',false);
select pg_temp.deny_projection(format('select public.read_workspace_particle_board_for_projection(%L,%L)',:'org',:'actor'));
reset role;
select pg_temp.check_read(not has_function_privilege('authenticated','public.read_workspace_particle_board_for_projection(uuid,uuid)','execute'),'Canonical RPC never granted to clients');
select set_config('request.headers',jsonb_build_object('x-coach-house-actor-id',:'org')::text,false);
-- Strip the current file and all named canvases as owner. The detached generated
-- note still carries immutable lineage, so stripping visible references cannot leak it.
update organization_workspace_boards set state=jsonb_set(jsonb_set(state,'{particleGraph,particles}',jsonb_build_array(
 jsonb_build_object('id','75000000-0000-4000-8000-000000000003','type','activity','title','Retained private content'))),'{workspaceCatalog,entries}','[]') where org_id=:'org';
set role authenticated;
set request.jwt.claim.role='authenticated';
select set_config('request.jwt.claim.sub',:'actor',false);
select pg_temp.deny_read(format('select state from organization_workspace_boards where org_id=%L',:'org'));
reset role;
set request.jwt.claim.role='service_role';
select set_config('request.jwt.claim.sub','',false);
-- Only public work: ordinary member reads remain usable. This changes only the
-- synthetic clone; originals and retained provenance are never deleted.
update organization_workspace_boards set state=jsonb_set(state,'{particleGraph,particles}',jsonb_build_array(
 jsonb_build_object('id','76000000-0000-4000-8000-000000000004','type','activity','title','Public work'))) where org_id=:'org';
set role authenticated;
set request.jwt.claim.role='authenticated';
select set_config('request.jwt.claim.sub',:'actor',false);
select pg_temp.check_read((select state#>>'{particleGraph,particles,0,title}'='Public work' from organization_workspace_boards where org_id=:'org'),'Unrestricted board remains readable');
select set_config('request.jwt.claim.sub','',false);
select pg_temp.check_read((select count(*)=0 from organization_workspace_boards where org_id=:'org'),'Missing JWT cannot use forged owner header');
reset role;
select pg_temp.check_read(not has_function_privilege('anon','public.can_read_workspace_particle_board(uuid,jsonb)','execute') and not has_function_privilege('service_role','public.can_read_workspace_particle_board(uuid,jsonb)','execute'),'No anonymous or service dispatch');
select pg_temp.check_read((select polpermissive=false and polcmd='r' from pg_policy where polname='workspace_particle_source_read' and polrelid='public.organization_workspace_boards'::regclass),'Restrictive SELECT guard installed');
