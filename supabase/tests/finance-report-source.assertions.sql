create function pg_temp.report_check(ok boolean,message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'Report assertion: %',message;end if;end $$;
create function pg_temp.report_denied(command text,code text default '42501') returns void language plpgsql as $$
begin begin execute command;exception when others then if sqlstate=code then return;end if;raise;end;
 raise exception 'Unexpected report success';end $$;
\set org 'e972bc07-fbf5-4fc8-a416-7f00910a71e2'
\set actor '90b6c688-889c-467f-9edd-166f28bf0819'
\set saved '80000000-0000-4000-8000-000000000001'
\set manual '80000000-0000-4000-8000-000000000002'
\set file '75000000-0000-4000-8000-000000000005'
select pg_temp.report_check(not exists(select 1 from fixture_finance_before b join organization_finance_opportunities o using(id) where b.updated_at<>o.updated_at or b.report<>o.report),'Backfill preserves content and revisions');
select pg_temp.report_check((select source_file_ids=array[:'file'::uuid] from organization_finance_opportunities where id=:'saved'),'Historical match copy backfilled');
update organization_memberships set role='board' where org_id=:'org' and member_id=:'actor';
insert into organization_finance_access(org_id,member_id,access_level,granted_by) values(:'org',:'actor','manager',:'org') on conflict(org_id,member_id) do update set access_level='manager';
-- Template ACLs are absent; restore the actual transport table privileges.
grant select,insert,update,delete on organization_finance_opportunities to service_role;
grant select on organization_finance_opportunities to authenticated;
grant usage on sequence opportunity_feed_position_seq to service_role;
set request.jwt.claim.role='authenticated';
select set_config('request.jwt.claim.sub',:'actor',false);
set role authenticated;
select pg_temp.report_check(not exists(select 1 from organization_finance_opportunities where id=:'saved'),'Catalog/detail/AI actor SELECT hides private report');
reset role;
set request.jwt.claim.role='service_role';
select set_config('request.headers',jsonb_build_object('x-coach-house-actor-id',:'actor')::text,false);
set role service_role;
select pg_temp.report_denied(format('update organization_finance_opportunities set source_file_ids=%L,report=%L where id=%L','{}','{"version":1,"blocks":[]}',:'saved'));
select pg_temp.report_denied(format('delete from organization_finance_opportunities where id=%L',:'saved'));
reset role;
-- Owner retains access and explicit native references/images acquire lineage.
select set_config('request.headers',jsonb_build_object('x-coach-house-actor-id',:'org')::text,false);
set role service_role;
insert into organization_finance_opportunities(id,org_id,title,external_provider,external_opportunity_id,report)
 values(:'manual',:'org','Manual image report','manual',:'manual',jsonb_build_object('version',1,'blocks',jsonb_build_array(jsonb_build_object('kind','image','fileId',:'file'))));
update organization_finance_opportunities set report='{"version":1,"blocks":[]}',source_file_ids='{}' where id=:'manual';
reset role;
select pg_temp.report_check((select source_file_ids=array[:'file'::uuid] from organization_finance_opportunities where id=:'manual'),'Removing image cannot erase lineage');
-- A match from an independent resource cannot return an existing private copy.
update organization_finance_opportunities set source_file_ids=array[:'file'::uuid] where org_id=:'org' and external_provider='grants_gov' and external_opportunity_id='123';
select set_config('request.headers',jsonb_build_object('x-coach-house-actor-id',:'actor')::text,false);
set role service_role;
do $$ declare actor uuid:='90b6c688-889c-467f-9edd-166f28bf0819';resource uuid:='78000000-0000-4000-8000-000000000001';item jsonb;
begin
 item:=fixture_resource_source_call(actor,resource)->'matches'->0;
 perform pg_temp.report_denied(format('select fixture_resource_source_call(%L,%L,%L,%L)',actor,resource,'save',jsonb_build_object('id',item->'id','updatedAt',item->'updated_at','report','{"version":1,"blocks":[]}'::jsonb)));
end $$;
reset role;
select set_config('request.headers',jsonb_build_object('x-coach-house-actor-id',:'org')::text,false);
select set_project_asset_folder_access('76000000-0000-4000-8000-000000000001','76000000-0000-4000-8000-000000000002',:'org',
 (select access_revision from project_asset_folders where project_id='76000000-0000-4000-8000-000000000001' and id='76000000-0000-4000-8000-000000000002'),'restricted',jsonb_build_array(jsonb_build_object('memberId',:'actor','capability','view')));
select set_config('request.headers',jsonb_build_object('x-coach-house-actor-id',:'actor')::text,false);
set role service_role;
update organization_finance_opportunities set status='saved' where id=:'saved';
reset role;
set request.jwt.claim.role='authenticated';set role authenticated;
select pg_temp.report_check(exists(select 1 from organization_finance_opportunities where id=:'saved'),'Current grant reveals saved report');
reset role;set request.jwt.claim.role='service_role';
update organization_finance_access set access_level='viewer' where org_id=:'org' and member_id=:'actor';
set role service_role;
select pg_temp.report_denied(format('update organization_finance_opportunities set status=%L where id=%L','applied',:'saved'));
reset role;
update organization_finance_access set access_level='manager' where org_id=:'org' and member_id=:'actor';
-- New match -> saved report carries its lineage in the same transaction.
select set_config('request.headers',jsonb_build_object('x-coach-house-actor-id',:'org')::text,false);
do $$ declare resource uuid:='75000000-0000-4000-8000-000000000003';actor uuid:='e972bc07-fbf5-4fc8-a416-7f00910a71e2';item jsonb;result jsonb;
begin
 item:=fixture_resource_source_call(actor,resource)->'matches'->0;
 item:=jsonb_set(item->'notice','{externalId}','"456"');
 result:=fixture_resource_source_call(actor,resource,'put',jsonb_build_array(jsonb_build_object('notice',item||jsonb_build_object('verifiedAt',clock_timestamp()),'need',jsonb_build_object('resourceId',resource,'resourceRevision',0),'assessment',jsonb_build_object('resourceId',resource,'resourceRevision',0,'externalId','456','active',true))));
 select value into item from jsonb_array_elements(result->'matches') where value->>'external_id'='456';
 result:=fixture_resource_source_call(actor,resource,'save',jsonb_build_object('id',item->'id','updatedAt',item->'updated_at','report','{"version":1,"blocks":[]}'::jsonb));
 perform pg_temp.report_check(jsonb_array_length(result#>'{opportunity,source_file_ids}')>0,'New saved copy retains source metadata');
end $$;
-- Public registered feed updates cannot overwrite private content or lineage.
update organization_finance_opportunities set source_id=(select id from finance_opportunity_sources where source_key='grants_gov' limit 1) where id=:'saved';
insert into finance_opportunity_sources(source_key,source_type,name,base_url,allowed_domains,auth_type,trust_level,enabled)
values('grants_gov','api','Synthetic public feed','https://api.grants.gov',array['api.grants.gov'],'none','public_api',true)
on conflict(source_key) do update set enabled=true;
-- Separate real public-feed row to avoid changing its immutable external identity.
update organization_finance_opportunities set source_id=(select id from finance_opportunity_sources where source_key='grants_gov' limit 1) where external_provider='grants_gov' and external_opportunity_id='456' and org_id=:'org';
set request.headers='{}';set role service_role;
update organization_finance_opportunities set title='Refreshed public notice' where external_provider='grants_gov' and external_opportunity_id='456' and org_id=:'org';
select pg_temp.report_denied(format('update organization_finance_opportunities set report=%L where id=%L','{"version":1,"blocks":[]}',:'saved'));
reset role;
select pg_temp.report_check(not has_function_privilege('service_role','public.manage_resource_opportunity_matches_before_sources(text,uuid,uuid,uuid,integer,text,jsonb)','execute'),'Inner copy function stays private');
select pg_temp.report_check(not has_table_privilege('authenticated','organization_finance_opportunities','update'),'Browser cannot erase lineage');
