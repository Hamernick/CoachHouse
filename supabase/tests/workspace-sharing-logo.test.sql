\set ON_ERROR_STOP on
do $$ begin
 if current_setting('coach_house.workspace_sharing_fixture',true) is distinct from 'isolated-test-only'
 or current_database() not like 'workspace_sharing_fixture_%' then raise exception 'Isolated fixture required'; end if;
end $$;
begin;
create function pg_temp.ok(value boolean) returns void language plpgsql as $$
begin if value is distinct from true then raise exception 'Logo assertion failed'; end if; end $$;
create function pg_temp.denied(command text,expected text) returns void language plpgsql as $$
declare actual text; begin
 begin execute command; exception when others then get stacked diagnostics actual=returned_sqlstate;
 if actual=expected then return; end if; raise exception 'Expected %, got %: %',expected,actual,sqlerrm; end;
 raise exception 'Unexpected logo operation success'; end $$;
delete from public.organization_workspace_pages;
select public.fixture_image_sources();
update public.organizations set profile=profile||'{"brandIdentity":{"assets":{"primary-logo":{"fileId":"10000000-0000-4000-8000-000000000050"}}}}',updated_at='2026-10-16T18:30:00Z'
 where user_id='10000000-0000-4000-8000-000000000001';
create function pg_temp.logo_commit(rev integer,intent text,op integer,asset integer default 60,logo_patch jsonb default '{}',asset_patch jsonb default '{}')
returns jsonb language sql as $$
select public.commit_workspace_page('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',
 '10000000-0000-4000-8000-000000000010',('10000000-0000-4000-8000-'||lpad(op::text,12,'0'))::uuid,repeat('a',64),rev,intent,
 '{"title":"Logo","description":"","particleIds":["10000000-0000-4000-8000-000000000020"]}',
 jsonb_build_object('version',1,'brand',jsonb_build_object('name','Community table','organizationSlug','community-table',
 'logo',jsonb_build_object('assetId','10000000-0000-4000-8000-'||lpad(asset::text,12,'0'),'width',10,'height',10)||logo_patch),
 'title','Logo','description','','items','[{"id":"10000000-0000-4000-8000-000000000020","title":"Saved","content":{"kind":"text"}}]'::jsonb),
 (select state->'particleGraph' from public.organization_workspace_boards where org_id='10000000-0000-4000-8000-000000000001'),
 '2026-10-16T18:30:00Z','[]',null,null,
 case when intent='make_private' then '[]'::jsonb else jsonb_build_array(jsonb_build_object(
 'id','10000000-0000-4000-8000-'||lpad(asset::text,12,'0'),
 'source',jsonb_build_object('id','10000000-0000-4000-8000-000000000050','org_id','10000000-0000-4000-8000-000000000001',
 'storage_path','10000000-0000-4000-8000-000000000001/library/image.png','mime_type','image/png','size_bytes',123,'updated_at','2026-10-16T18:30:00Z'),
 'path','10000000-0000-4000-8000-000000000001/10000000-0000-4000-8000-000000000010/10000000-0000-4000-8000-'||lpad(asset::text,12,'0')||'.webp',
 'sha256',repeat('b',64),'size',20,'width',10,'height',10)||asset_patch) end,'[]','[]');
$$;
-- Inner helpers remain inaccessible; the current closure/form/public wrapper owns admission.
select pg_temp.ok(not has_function_privilege('service_role','public.commit_workspace_page_with_images(uuid,uuid,uuid,uuid,text,integer,text,jsonb,jsonb,jsonb,timestamptz,jsonb,jsonb,uuid,jsonb)','execute'));
select pg_temp.ok(not has_function_privilege('service_role','public.read_workspace_page_image_before_closure(uuid,text,uuid)','execute'));
set local role service_role;
select pg_temp.denied('select pg_temp.logo_commit(0,''publish'',30,60,''{"sourceUrl":"https://private.example"}'')','22023');
select pg_temp.denied('select pg_temp.logo_commit(0,''publish'',30,60,''{"width":11}'')','40001');
select pg_temp.denied('select pg_temp.logo_commit(0,''publish'',30,60,''{"assetId":"10000000-0000-4000-8000-000000000099"}'')','22023');
reset role;
select pg_temp.ok(not exists(select 1 from public.organization_workspace_pages));
-- Exact canonical primary-logo binding is checked after the locked profile CAS.
update public.organizations set profile=jsonb_set(profile,'{brandIdentity,assets,primary-logo,fileId}','"10000000-0000-4000-8000-000000000051"');
set local role service_role;
select pg_temp.denied('select pg_temp.logo_commit(0,''publish'',30)','40001');
reset role;
update public.organizations set profile=jsonb_set(profile,'{brandIdentity,assets,primary-logo,fileId}','"10000000-0000-4000-8000-000000000050"'),updated_at='2026-10-17T18:30:00Z';
set local role service_role;
select pg_temp.denied('select pg_temp.logo_commit(0,''publish'',30)','40001');
reset role;
update public.organizations set updated_at='2026-10-16T18:30:00Z';
set local role service_role;
select pg_temp.logo_commit(0,'publish',30);
select pg_temp.ok(public.read_workspace_page_image('10000000-0000-4000-8000-000000000060','public') is not null);
select pg_temp.ok(public.read_workspace_page_image('10000000-0000-4000-8000-000000000060','guest','10000000-0000-4000-8000-000000000006') is null);
select pg_temp.ok(public.read_workspace_page_image('10000000-0000-4000-8000-000000000060','editor','10000000-0000-4000-8000-000000000006') is null);
select pg_temp.ok((pg_temp.logo_commit(0,'publish',30)->>'replayed')::boolean);
reset role;
select pg_temp.ok((select count(*)=1 from public.workspace_page_image_grants));
-- Later private logo edits and source deletion cannot replace committed bytes.
update public.organizations set profile=jsonb_set(profile,'{brandIdentity,assets,primary-logo,fileId}','"10000000-0000-4000-8000-000000000051"');
update public.organization_document_files set deleted_at=now();
set local role service_role;
select pg_temp.ok(public.read_workspace_page_image('10000000-0000-4000-8000-000000000060','public')->>'sha256'=repeat('b',64));
select pg_temp.ok((pg_temp.logo_commit(0,'publish',30)->>'replayed')::boolean);
select pg_temp.logo_commit(1,'make_private',31);
select pg_temp.ok(public.read_workspace_page_image('10000000-0000-4000-8000-000000000060','public') is null);
reset role;
update public.organizations set profile=jsonb_set(profile,'{brandIdentity,assets,primary-logo,fileId}','"10000000-0000-4000-8000-000000000050"');
update public.organization_document_files set deleted_at=null;
set local role service_role;
select pg_temp.logo_commit(2,'share_with_guests',32,61);
select public.workspace_page_guest_command('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000010',
 '{"action":"invite","operationId":"10000000-0000-4000-8000-000000000100","invitationId":"10000000-0000-4000-8000-000000000200","permission":"view","email":"person6@example.org"}',repeat('c',64));
select public.workspace_page_guest_command('10000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000010',
 '{"action":"accept","invitationId":"10000000-0000-4000-8000-000000000200"}',repeat('c',64));
select pg_temp.ok(public.read_workspace_page_image('10000000-0000-4000-8000-000000000061','guest','10000000-0000-4000-8000-000000000006') is not null);
select pg_temp.ok(public.read_workspace_page_image('10000000-0000-4000-8000-000000000061','public') is null);
select pg_temp.logo_commit(3,'publish',33,62);
select pg_temp.ok(public.read_workspace_page_image('10000000-0000-4000-8000-000000000060','public') is null);
select pg_temp.ok(public.read_workspace_page_image('10000000-0000-4000-8000-000000000062','public') is not null);
select pg_temp.ok(public.read_workspace_page_image('10000000-0000-4000-8000-000000000062','guest','10000000-0000-4000-8000-000000000006') is null);
select public.workspace_page_guest_command('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000010',
 '{"action":"revoke","operationId":"10000000-0000-4000-8000-000000000101","invitationId":"10000000-0000-4000-8000-000000000200"}',repeat('c',64));
select pg_temp.ok(public.read_workspace_page_image('10000000-0000-4000-8000-000000000061','guest','10000000-0000-4000-8000-000000000006') is null);
reset role;
-- Closure cancels access; cancellation never republishes or resurrects logo grants.
select public.fixture_closure('request',90,0);
select pg_temp.ok(public.read_workspace_page_image('10000000-0000-4000-8000-000000000062','public') is null);
select pg_temp.ok(not exists(select 1 from public.workspace_page_image_grants));
select public.fixture_closure('cancel',91,1);
select pg_temp.ok(public.read_workspace_page_image('10000000-0000-4000-8000-000000000062','public') is null);
select pg_temp.ok(not exists(select 1 from public.workspace_page_image_grants));
select pg_temp.ok((select count(*)=2 from public.organizations));
select pg_temp.ok((select count(*)=12 from auth.users));
rollback;
\echo 'reviewed logo SQL: exact binding/CAS, atomic rollback, direct public/guest/editor denial, immutable copy/retry, independent audience revocation, closure/cancel and private helper ACLs passed'
