create function pg_temp.check_origin(ok boolean,message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'Assertion failed: %',message;end if;end $$;
create function pg_temp.deny_origin(command text,expected text default '42501') returns void language plpgsql as $$
begin begin execute command;exception when others then if sqlstate=expected then return;end if;raise exception 'Expected %, got %: %',expected,sqlstate,sqlerrm;end;raise exception 'Unexpected success: %',command;end $$;
do $$begin if current_database() not like 'ch_particle_origins_%' then raise exception 'Owned provenance fixture required';end if;end$$;
\set org 'e972bc07-fbf5-4fc8-a416-7f00910a71e2'
\set actor '90b6c688-889c-467f-9edd-166f28bf0819'
\set run '75000000-0000-4000-8000-000000000001'
\set objective '75000000-0000-4000-8000-000000000002'
\set note '75000000-0000-4000-8000-000000000003'
\set plan '75000000-0000-4000-8000-000000000004'
\set file '75000000-0000-4000-8000-000000000005'
\set second_file '75000000-0000-4000-8000-000000000006'
set request.jwt.claim.role='service_role';
select set_config('request.headers',jsonb_build_object('x-coach-house-actor-id',:'org')::text,false);
insert into ai_credit_wallets(org_id,enabled) values(:'org',true) on conflict do nothing;
insert into workspace_ai_runs(id,org_id,actor_id,request_hash,task,target,prompt,tariff,max_credits,max_provider_microdollars)
 values(:'run',:'org',:'org',repeat('a',64),'plan',jsonb_build_object('kind','particle_research','mode','new_objective','organizationId',:'org','canvasId',null,'userId',:'org','revision',0,'conversation',jsonb_build_object('id',:'run','parentId',null,'turn',1,'draftRevision',0)),'Private prompt','{}',1,1000);
insert into workspace_ai_result_receipts(run_id,result) values(:'run',jsonb_build_object('status','succeeded','cost',0,'credits',0,'usage','{}'::jsonb,'responseId',null,'proposal',jsonb_build_object('runId',:'run','target',jsonb_build_object('organizationId',:'org'),'summary','Private answer','sources','[]'::jsonb,'dependencies',jsonb_build_object('version',1,'contextFingerprint',repeat('b',64),'nativeFileIds',jsonb_build_array(:'second_file'),'records',jsonb_build_array(jsonb_build_object('id','file:'||:'file','kind','document','fingerprint',repeat('c',64)))))::text));
create temporary table origin_board as select state from organization_workspace_boards where org_id=:'org';
-- An actual board update captures a named-canvas proposal with no citations.
-- Preserve all unrelated board fields and restore the synthetic addition below.
create temporary table origin_graph as
 with plan as (select jsonb_build_object('id',:'plan','researchRunId',:'run','particleIds',jsonb_build_array(:'note'),'sources','[]'::jsonb) value),
 objective as (select jsonb_build_object('id',:'objective','type','objective','data',jsonb_build_object('planning',jsonb_build_object('plans','[]'::jsonb,'proposals',jsonb_build_array(value)))) value from plan)
 select jsonb_build_object('particles',jsonb_build_array(value,jsonb_build_object('id',:'note','type','activity','title','Private derived note'))) value from objective;
update organization_workspace_boards set state=jsonb_set(state,'{particleGraph}',(select value from origin_graph)) where org_id=:'org';
select pg_temp.check_origin((select count(*)=3 from workspace_particle_ai_origins where org_id=:'org' and run_id=:'run'),'objective, proposal and member captured');
select pg_temp.check_origin((select dependencies->'records'->0->>'id'='file:'||:'file' from workspace_particle_ai_origins where org_id=:'org' and record_id='particle:'||:'note'),'uncited receipt input retained');
select pg_temp.check_origin(read_workspace_particle_ai_files(:'org',:'org',array['particle:'||:'note'])->0->'fileIds' @> jsonb_build_array(:'file',:'second_file'),'direct and inherited native files returned');
select pg_temp.check_origin(not (read_workspace_particle_ai_files(:'org',:'org',array['particle:'||:'note'])->0->>'complete')::boolean,'legacy completeness not invented');
-- Immutable captured observations survive membership/objective removal and
-- a later edit of the run proposal. The receipt, not mutable run text, is source.
update organization_workspace_boards set state=(select state from origin_board) where org_id=:'org';
update workspace_ai_runs set status='failed',proposal=null where id=:'run';
select manage_workspace_research_conversation(:'org',:'org',null,:'run','delete',0);
select pg_temp.check_origin((select deleted_at is not null from workspace_research_chats where root_id=:'run'),'actual chat deletion');
select pg_temp.check_origin(jsonb_array_length(read_workspace_particle_ai_files(:'org',:'org',array['particle:'||:'note'])->0->'fileIds')=2,'removal and chat deletion preserve origins');
select pg_temp.deny_origin(format('update workspace_particle_ai_origins set dependencies=null where org_id=%L',:'org'),'P0001');
select pg_temp.deny_origin(format('delete from workspace_particle_ai_origins where org_id=%L',:'org'),'P0001');
select pg_temp.deny_origin('truncate workspace_particle_ai_origins','P0001');
select pg_temp.check_origin(not has_table_privilege('authenticated','workspace_particle_ai_origins','select') and not has_table_privilege('service_role','workspace_particle_ai_origins','insert,update,delete'),'raw provenance is private and cannot be supplied by clients');
select pg_temp.check_origin(not has_function_privilege('authenticated','read_workspace_particle_ai_files(uuid,uuid,text[])','execute'),'RPC is server-only');
select pg_temp.deny_origin(format('select read_workspace_particle_ai_files(%L,%L,array[]::text[])',:'org',:'actor'));
select set_config('request.headers','{}',false);
select pg_temp.deny_origin(format('select read_workspace_particle_ai_files(%L,%L,array[]::text[])',:'org',:'org'));
select set_config('request.headers',jsonb_build_object('x-coach-house-actor-id',:'org')::text,false);
select pg_temp.deny_origin(format('select read_workspace_particle_ai_files(%L,%L,array_fill(''x''::text,array[501]))',:'org',:'org'),'22023');
select pg_temp.check_origin(public.workspace_particle_ai_snapshot(:'actor',:'run') is null,'cross-organization run cannot disclose dependencies');
-- Root and catalog paths, accepted and pending plans, repeated writes and bad
-- legacy JSON are deterministic; never reinterpret malformed JSON as authority.
select pg_temp.check_origin((select count(*)=0 from workspace_particle_ai_bindings('{"particleGraph":{"particles":"bad"},"workspaceCatalog":{"entries":null}}')),'malformed legacy collections tolerated');
select pg_temp.check_origin((select count(*)=3 from origin_graph cross join lateral workspace_particle_ai_bindings(jsonb_build_object('workspaceCatalog',jsonb_build_object('entries',jsonb_build_array(jsonb_build_object('state',jsonb_build_object('particleGraph',value))))))),'catalog proposal paths');
with accepted as (
 select jsonb_set(jsonb_set(value,'{particles,0,data,planning,plans}',value#>'{particles,0,data,planning,proposals}'),'{particles,0,data,planning,proposals}','[]'::jsonb) value from origin_graph
), bindings as (
 select binding.* from accepted cross join lateral workspace_particle_ai_bindings(jsonb_build_object('particleGraph',value)) binding
)
select pg_temp.check_origin((select count(*)=3 from bindings),'accepted plan paths');
select pg_temp.check_origin(read_workspace_particle_ai_files(:'org',:'org',array['particle:'||:'note'])::text not like '%Private%','no prompt, answer, or source title disclosed');

insert into organization_memberships(org_id,member_id,role,member_email) select :'org',:'actor','staff',email from auth.users where id=:'actor' on conflict(org_id,member_id) do update set role='staff';
select pg_temp.check_origin(can_read_workspace_ai(:'org',:'actor'),'staff fixture has AI read authority');
select set_config('request.headers',jsonb_build_object('x-coach-house-actor-id',:'actor')::text,false);
select pg_temp.check_origin(jsonb_array_length(read_workspace_particle_ai_files(:'org',:'actor',array['particle:'||:'note']))=1,'current staff can resolve source observations without reading private chat');
begin;
select set_config('request.headers',jsonb_build_object('x-coach-house-actor-id',:'org')::text,false);
update organization_memberships set role='board' where org_id=:'org' and member_id=:'actor';
select set_config('request.headers',jsonb_build_object('x-coach-house-actor-id',:'actor')::text,false);
select pg_temp.check_origin(not can_read_workspace_ai(:'org',:'actor'),'board reader does not gain AI use');
select pg_temp.check_origin(jsonb_array_length(read_workspace_particle_ai_files(:'org',:'actor',array['particle:'||:'note']))=1,'board reader can filter known origins');
select set_config('request.headers',jsonb_build_object('x-coach-house-actor-id',:'org')::text,false);
update organization_memberships set role='member' where org_id=:'org' and member_id=:'actor';
select set_config('request.headers',jsonb_build_object('x-coach-house-actor-id',:'actor')::text,false);
select pg_temp.check_origin(not can_read_workspace_ai(:'org',:'actor'),'member does not gain AI use');
select pg_temp.check_origin(jsonb_array_length(read_workspace_particle_ai_files(:'org',:'actor',array['particle:'||:'note']))=1,'ordinary member can filter known origins');
delete from organization_memberships where org_id=:'org' and member_id=:'actor';
select pg_temp.deny_origin(format('select read_workspace_particle_ai_files(%L,%L,array[]::text[])',:'org',:'actor'));
select pg_temp.check_origin(not has_function_privilege('service_role','can_read_workspace_particle_origins(uuid,uuid)','execute'),'authority helper remains private');
insert into platform_staff_members(user_id,access_level) values(:'actor','developer') on conflict(user_id) do update set access_level='developer';
select pg_temp.check_origin(jsonb_array_length(read_workspace_particle_ai_files(:'org',:'actor',array['particle:'||:'note']))=1,'existing developer board read access retained');
update platform_staff_members set access_level='coach' where user_id=:'actor';
select pg_temp.deny_origin(format('select read_workspace_particle_ai_files(%L,%L,array[]::text[])',:'org',:'actor'));
rollback;
begin;
select set_config('request.headers',jsonb_build_object('x-coach-house-actor-id',:'org')::text,false);
delete from organization_memberships where org_id=:'org' and member_id=:'actor';
select set_config('request.headers',jsonb_build_object('x-coach-house-actor-id',:'actor')::text,false);
select pg_temp.deny_origin(format('select read_workspace_particle_ai_files(%L,%L,array[]::text[])',:'org',:'actor'));
select set_config('request.headers',jsonb_build_object('x-coach-house-actor-id',:'org')::text,false);
select pg_temp.check_origin(jsonb_array_length(read_workspace_particle_ai_files(:'org',:'org',array['particle:'||:'note']))=1,'owner retains access after member removal');
rollback;
select pg_temp.check_origin((select b.state=original.state from organization_workspace_boards b cross join origin_board original where b.org_id=:'org'),'unrelated board state preserved');
