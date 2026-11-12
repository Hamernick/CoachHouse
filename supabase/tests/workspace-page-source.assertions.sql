-- Runs only in the disposable full-schema source-permission fixture.
create function pg_temp.catalog_check(ok boolean,message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'Catalog assertion: %',message;end if;end $$;
create function pg_temp.catalog_denied(command text,code text default '42501') returns void language plpgsql as $$
begin begin execute command;exception when others then if sqlstate=code then return;end if;raise;end;
 raise exception 'Unexpected catalog success';end $$;
-- Disposable full-schema fixture, following the catalog/source authority suite.
\set org 'e972bc07-fbf5-4fc8-a416-7f00910a71e2'
\set actor '90b6c688-889c-467f-9edd-166f28bf0819'
\set retained '75000000-0000-4000-8000-000000000003'
\set public '78000000-0000-4000-8000-000000000001'
\set native '78000000-0000-4000-8000-000000000002'
grant select on public.organizations,public.organization_workspace_pages to service_role;
set request.jwt.claim.role='service_role';
select set_config('request.headers',jsonb_build_object('x-coach-house-actor-id',:'org')::text,false);
update organizations set profile=profile||'{"name":"Source fixture"}',public_slug='source-fixture' where user_id=:'org';
insert into public_handles(handle,owner_type,organization_id) values('source-fixture','organization',:'org') on conflict(handle) do nothing;
update organization_workspace_boards set state=jsonb_build_object('particleGraph',jsonb_build_object('workspaceId',:'org','particles',jsonb_build_array(
 jsonb_build_object('id',:'retained','type','activity','title','Retained private note'),
 jsonb_build_object('id',:'public','type','activity','title','Unrestricted note'),
 jsonb_build_object('id',:'native','type','activity','title','Native source','data',jsonb_build_object('widget',jsonb_build_object('kind','document','fileId','75000000-0000-4000-8000-000000000005')))))) where org_id=:'org';
-- Fixture helper calls the real public RPC; no authority is replaced or mocked.
create function public.fixture_source_page_commit(actor uuid,selected uuid,page_id uuid,operation uuid,revision integer,intent text,expected jsonb default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare org uuid:='e972bc07-fbf5-4fc8-a416-7f00910a71e2'; g jsonb; o public.organizations%rowtype;
begin
 select state->'particleGraph' into g from public.organization_workspace_boards where org_id=org;
 select * into o from public.organizations where user_id=org;
 return public.commit_workspace_page(actor,org,page_id,operation,repeat('a',64),revision,intent,
 jsonb_build_object('title','Shared note','description','','particleIds',jsonb_build_array(selected)),
 case when intent in ('publish','share_with_guests') then jsonb_build_object('version',1,'title','Shared note','description','',
 'brand',jsonb_build_object('name',o.profile->>'name','organizationSlug',o.public_slug),
 'items',jsonb_build_array(jsonb_build_object('id',selected,'title','Reviewed note','description','','content',jsonb_build_object('kind','note','text','Reviewed copy')))) else null end,
 coalesce(expected,g),o.updated_at);
end; $$;
revoke all on function public.fixture_source_page_commit(uuid,uuid,uuid,uuid,integer,text,jsonb) from public,anon,authenticated;
grant execute on function public.fixture_source_page_commit(uuid,uuid,uuid,uuid,integer,text,jsonb) to service_role;
select set_config('request.headers',jsonb_build_object('x-coach-house-actor-id',:'actor')::text,false);
set role service_role;
-- A private sibling does not block independent draft or publication.
select public.fixture_source_page_commit(:'actor',:'public','78000000-0000-4000-8000-000000000010','78000000-0000-4000-8000-000000000020',0,'save_draft');
select public.fixture_source_page_commit(:'actor',:'public','78000000-0000-4000-8000-000000000010','78000000-0000-4000-8000-000000000021',1,'publish');
select pg_temp.catalog_denied(format('select public.fixture_source_page_commit(%L,%L,%L,%L,0,%L)',:'actor',:'retained','78000000-0000-4000-8000-000000000011','78000000-0000-4000-8000-000000000022','publish'));
select pg_temp.catalog_denied(format('select public.fixture_source_page_commit(%L,%L,%L,%L,0,%L)',:'actor',:'native','78000000-0000-4000-8000-000000000012','78000000-0000-4000-8000-000000000023','save_draft'));
select pg_temp.catalog_denied(format('select public.fixture_source_page_commit(%L,%L,%L,%L,0,%L)',:'org',:'public','78000000-0000-4000-8000-000000000013','78000000-0000-4000-8000-000000000024','save_draft'));
reset role;
select pg_temp.catalog_check(not exists(select 1 from organization_workspace_pages where id in ('78000000-0000-4000-8000-000000000011','78000000-0000-4000-8000-000000000012','78000000-0000-4000-8000-000000000013')),'Denied disclosures leave no page or receipt');
-- Owner retains access; an actual view grant permits a member to publish.
select set_config('request.headers',jsonb_build_object('x-coach-house-actor-id',:'org')::text,false);
set role service_role;
select public.fixture_source_page_commit(:'org',:'retained','78000000-0000-4000-8000-000000000014','78000000-0000-4000-8000-000000000025',0,'save_draft');
reset role;
insert into project_asset_folder_grants(project_id,folder_id,member_id,membership_created_at,capability)
 select '76000000-0000-4000-8000-000000000001','76000000-0000-4000-8000-000000000002',member_id,created_at,'view' from organization_memberships where org_id=:'org' and member_id=:'actor';
select set_config('request.headers',jsonb_build_object('x-coach-house-actor-id',:'actor')::text,false);
set role service_role;
select public.fixture_source_page_commit(:'actor',:'retained','78000000-0000-4000-8000-000000000011','78000000-0000-4000-8000-000000000022',0,'publish');
reset role;
delete from project_asset_folder_grants where project_id='76000000-0000-4000-8000-000000000001' and folder_id='76000000-0000-4000-8000-000000000002' and member_id=:'actor';
set role service_role;
-- Confirmed retry and revocation survive source loss; republish must fail.
select pg_temp.catalog_check((public.fixture_source_page_commit(:'actor',:'retained','78000000-0000-4000-8000-000000000011','78000000-0000-4000-8000-000000000022',0,'publish')->>'replayed')::boolean,'Confirmed retry survives source revocation');
select pg_temp.catalog_denied(format('select public.fixture_source_page_commit(%L,%L,%L,%L,1,%L)',:'actor',:'retained','78000000-0000-4000-8000-000000000011','78000000-0000-4000-8000-000000000026','share_with_guests'));
select public.fixture_source_page_commit(:'actor',:'retained','78000000-0000-4000-8000-000000000011','78000000-0000-4000-8000-000000000027',1,'make_private');
reset role;
select pg_temp.catalog_check((select visibility='private' and revision=2 and published_snapshot is not null and guest_snapshot is null from organization_workspace_pages where id='78000000-0000-4000-8000-000000000011'),'Revocation preserves reviewed copy and failed guest publication leaves nothing');
begin isolation level repeatable read;
set local role service_role;
select pg_temp.catalog_denied(format('select public.fixture_source_page_commit(%L,%L,%L,%L,0,%L)',:'actor',:'public','78000000-0000-4000-8000-000000000019','78000000-0000-4000-8000-000000000029','save_draft'),'40001');
rollback;
select pg_temp.catalog_check(not has_function_privilege('authenticated','public.commit_workspace_page(uuid,uuid,uuid,uuid,text,integer,text,jsonb,jsonb,jsonb,timestamptz,jsonb,jsonb,uuid,jsonb,jsonb,jsonb)','execute'),'No client publication bypass');

set role service_role;
select pg_temp.catalog_denied(format('select public.fixture_source_page_commit(%L,%L,%L,%L,2,%L,%L)',:'actor',:'public','78000000-0000-4000-8000-000000000010','78000000-0000-4000-8000-000000000030','save_draft','{}'),'40001');
reset role;
