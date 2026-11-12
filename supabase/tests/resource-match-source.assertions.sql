-- Disposable full-schema fixture; real authority, canonical RPC and raw RLS.
create function pg_temp.resource_check(ok boolean,message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'Resource assertion: %',message;end if;end $$;
create function pg_temp.resource_denied(command text,code text default '42501') returns void language plpgsql as $$
begin begin execute command;exception when others then if sqlstate=code then return;end if;raise;end;
 raise exception 'Unexpected resource success';end $$;
\set org 'e972bc07-fbf5-4fc8-a416-7f00910a71e2'
\set actor '90b6c688-889c-467f-9edd-166f28bf0819'
\set retained '75000000-0000-4000-8000-000000000003'
\set independent '78000000-0000-4000-8000-000000000001'
\set native '78000000-0000-4000-8000-000000000002'
set request.jwt.claim.role='service_role';
select set_config('request.headers',jsonb_build_object('x-coach-house-actor-id',:'org')::text,false);
update organization_memberships set role='board' where org_id=:'org' and member_id=:'actor';
insert into organization_finance_access(org_id,member_id,access_level,granted_by) values(:'org',:'actor','manager',:'org')
 on conflict(org_id,member_id) do update set access_level='manager';
update organization_workspace_boards set state=jsonb_set(state,'{particleGraph,particles}',
 (select jsonb_agg(p||'{"revision":0}') from jsonb_array_elements(state#>'{particleGraph,particles}') p)) where org_id=:'org';
create function public.fixture_resource_source_call(actor uuid,resource uuid,action text default 'list',payload jsonb default null,revision integer default 0,canvas text default null)
returns jsonb language sql security invoker set search_path='' as $$
 select public.manage_resource_opportunity_matches(action,'e972bc07-fbf5-4fc8-a416-7f00910a71e2',actor,resource,revision,canvas,
 coalesce(payload,case when action='put' then jsonb_build_array(jsonb_build_object(
 'notice',jsonb_build_object('provider','grants_gov','externalId','123','title','Source fixture','agency','Fixture','verifiedAt',clock_timestamp(),'originalUrl','https://www.grants.gov/search-results-detail/123'),
 'need',jsonb_build_object('resourceId',resource,'resourceRevision',revision),
 'assessment',jsonb_build_object('resourceId',resource,'resourceRevision',revision,'externalId','123','active',true))) else '[]'::jsonb end));
$$;
revoke all on function public.fixture_resource_source_call(uuid,uuid,text,jsonb,integer,text) from public,anon,authenticated;
grant execute on function public.fixture_resource_source_call(uuid,uuid,text,jsonb,integer,text) to service_role;
-- The restored full-schema template omits table ACLs; restore the original SELECT grant for raw RLS assertions.
grant select on public.organization_resource_opportunity_matches to service_role,authenticated;
select set_config('request.headers',jsonb_build_object('x-coach-house-actor-id',:'actor')::text,false);
set role service_role;
select fixture_resource_source_call(:'actor',:'independent','put');
select pg_temp.resource_check(jsonb_array_length(fixture_resource_source_call(:'actor',:'independent')->'matches')=1,'Independent resource works beside restricted siblings');
select pg_temp.resource_denied(format('select fixture_resource_source_call(%L,%L,%L)',:'actor',:'retained','put'));
select pg_temp.resource_denied(format('select fixture_resource_source_call(%L,%L,%L)',:'actor',:'native','put'));
select pg_temp.resource_denied(format('select fixture_resource_source_call(%L,%L)',:'org',:'independent'));
select pg_temp.resource_denied(format('select fixture_resource_source_call(%L,%L,%L,null,1)',:'actor',:'independent','list'),'40001');
select pg_temp.resource_denied(format('select fixture_resource_source_call(%L,%L,%L,null,0,%L)',:'actor',:'independent','list','missing'),'40001');
reset role;
select pg_temp.resource_check((select count(*)=1 from organization_resource_opportunity_matches where org_id=:'org'),'Denied writes leave no match');
-- Owner retains access, with no folder grant.
select set_config('request.headers',jsonb_build_object('x-coach-house-actor-id',:'org')::text,false);
set role service_role;
select fixture_resource_source_call(:'org',:'retained','put');
select fixture_resource_source_call(:'org',:'native','put');
reset role;
select pg_temp.resource_check((select source_file_ids=array['75000000-0000-4000-8000-000000000005'::uuid] from organization_resource_opportunity_matches where org_id=:'org' and resource_id=:'native'),'Native source captured');
-- Detached current references still protect the stored match.
update organization_workspace_boards set state=jsonb_set(state,'{particleGraph,particles}',
 (select jsonb_agg(case when p->>'id'=:'native' then p-'data' else p end) from jsonb_array_elements(state#>'{particleGraph,particles}') p)) where org_id=:'org';
select set_config('request.headers',jsonb_build_object('x-coach-house-actor-id',:'actor')::text,false);
set role service_role;
select pg_temp.resource_denied(format('select fixture_resource_source_call(%L,%L)',:'actor',:'native'));
select pg_temp.resource_denied(format('select fixture_resource_source_call(%L,%L,%L)',:'actor',:'native','put'));
reset role;
set request.jwt.claim.role='authenticated';
select set_config('request.jwt.claim.sub',:'actor',false);
set role authenticated;
select pg_temp.resource_check((select count(*)=1 from organization_resource_opportunity_matches where org_id=:'org'),'Raw RLS withholds current, retained and detached source matches');
reset role;
set request.jwt.claim.role='service_role';
select set_config('request.headers',jsonb_build_object('x-coach-house-actor-id',:'org')::text,false);
insert into project_asset_folder_grants(project_id,folder_id,member_id,membership_created_at,capability)
 select '76000000-0000-4000-8000-000000000001','76000000-0000-4000-8000-000000000002',member_id,created_at,'view' from organization_memberships where org_id=:'org' and member_id=:'actor';
select set_config('request.headers',jsonb_build_object('x-coach-house-actor-id',:'actor')::text,false);
set role service_role;
select fixture_resource_source_call(:'actor',:'native','put');
select fixture_resource_source_call(:'actor',:'retained');
-- Existing save/dismiss/restore and microsecond CAS remain real, not mocked.
do $$ declare actor uuid:='90b6c688-889c-467f-9edd-166f28bf0819'; resource uuid:='78000000-0000-4000-8000-000000000001'; item jsonb; result jsonb;
begin
 item:=fixture_resource_source_call(actor,resource)->'matches'->0;
 result:=fixture_resource_source_call(actor,resource,'save',jsonb_build_object('id',item->'id','updatedAt',item->'updated_at','report','{"version":1,"blocks":[]}'::jsonb));
 perform pg_temp.resource_check(result->'matches'->0->>'status'='saved','Save remains usable');
 perform pg_temp.resource_denied(format('select fixture_resource_source_call(%L,%L,%L,%L)',actor,resource,'dismiss',jsonb_build_object('id',item->'id','updatedAt',item->'updated_at')),'40001');
 item:=result->'matches'->0;
 result:=fixture_resource_source_call(actor,resource,'dismiss',jsonb_build_object('id',item->'id','updatedAt',item->'updated_at'));
 item:=result->'matches'->0;
 result:=fixture_resource_source_call(actor,resource,'restore',jsonb_build_object('id',item->'id','updatedAt',item->'updated_at'));
 perform pg_temp.resource_check(result->'matches'->0->>'status'='saved','Restore preserves saved association');
end $$;
reset role;
select pg_temp.resource_check((select cardinality(source_file_ids)=1 from organization_resource_opportunity_matches where org_id=:'org' and resource_id=:'native'),'Refresh cannot erase retained dependencies');
update organization_finance_access set access_level='viewer' where org_id=:'org' and member_id=:'actor';
set role service_role;
select fixture_resource_source_call(:'actor',:'independent');
select pg_temp.resource_denied(format('select fixture_resource_source_call(%L,%L,%L)',:'actor',:'independent','put'));
reset role;
update organization_memberships set role='staff' where org_id=:'org' and member_id=:'actor';
set role service_role;
select pg_temp.resource_denied(format('select fixture_resource_source_call(%L,%L)',:'actor',:'independent'));
reset role;
update organization_memberships set role='board' where org_id=:'org' and member_id=:'actor';
insert into organization_finance_access(org_id,member_id,access_level,granted_by) values(:'org',:'actor','manager',:'org') on conflict(org_id,member_id) do update set access_level='manager';
-- Exact named-canvas scope and ambiguous IDs are checked on the locked board.
select set_config('request.headers',jsonb_build_object('x-coach-house-actor-id',:'org')::text,false);
update organization_workspace_boards set state=state||jsonb_build_object('workspaceCatalog',jsonb_build_object('entries',jsonb_build_array(jsonb_build_object(
 'id','79000000-0000-4000-8000-000000000090','state',jsonb_build_object('particleGraph',jsonb_build_object('particles',jsonb_build_array(jsonb_build_object('id','79000000-0000-4000-8000-000000000091','type','activity','revision',0)))))))) where org_id=:'org';
select set_config('request.headers',jsonb_build_object('x-coach-house-actor-id',:'actor')::text,false);
set role service_role;
select fixture_resource_source_call(:'actor','79000000-0000-4000-8000-000000000091','put',null,0,'79000000-0000-4000-8000-000000000090');
select pg_temp.resource_denied(format('select fixture_resource_source_call(%L,%L)',:'actor','79000000-0000-4000-8000-000000000091'),'40001');
reset role;
select set_config('request.headers',jsonb_build_object('x-coach-house-actor-id',:'org')::text,false);
update organization_workspace_boards set state=jsonb_set(state,'{workspaceCatalog,entries,0,state,particleGraph,particles,0,id}',to_jsonb(:'independent'::text)) where org_id=:'org';
select set_config('request.headers',jsonb_build_object('x-coach-house-actor-id',:'actor')::text,false);
set role service_role;
select pg_temp.resource_denied(format('select fixture_resource_source_call(%L,%L)',:'actor',:'independent'),'40001');
reset role;
select set_config('request.headers',jsonb_build_object('x-coach-house-actor-id',:'org')::text,false);
update organization_workspace_boards set state=state-'workspaceCatalog' where org_id=:'org';
select set_config('request.headers',jsonb_build_object('x-coach-house-actor-id',:'actor')::text,false);
begin isolation level repeatable read;
set local role service_role;
select pg_temp.resource_denied(format('select fixture_resource_source_call(%L,%L)',:'actor',:'independent'),'40001');
rollback;
select pg_temp.resource_check(not has_function_privilege('service_role','public.manage_resource_opportunity_matches_before_sources(text,uuid,uuid,uuid,integer,text,jsonb)','execute'),'Inner bypass denied');
select pg_temp.resource_check(not has_function_privilege('authenticated','public.manage_resource_opportunity_matches(text,uuid,uuid,uuid,integer,text,jsonb)','execute'),'Browser actor spoof denied');
select pg_temp.resource_check(not has_table_privilege('service_role','organization_resource_opportunity_matches','update'),'Direct dependency erasure denied');
