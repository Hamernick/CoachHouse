\set ON_ERROR_STOP on
do $$ begin
 if current_setting('coach_house.workspace_sharing_fixture',true) is distinct from 'isolated-test-only'
 or current_database() not like 'workspace_sharing_fixture_%' then raise exception 'Isolated fixture required'; end if;
end $$;
begin;
delete from public.organization_workspace_pages;
create function pg_temp.ok(value boolean) returns void language plpgsql as $$
begin if value is distinct from true then raise exception 'Document assertion failed'; end if; end $$;
create function pg_temp.denied(command text,expected text) returns void language plpgsql as $$
declare actual text; begin
 begin execute command; exception when others then get stacked diagnostics actual=returned_sqlstate;
 if actual=expected then return; end if; raise exception 'Expected %, got %: %',expected,actual,sqlerrm; end;
 raise exception 'Unexpected document operation success'; end $$;
select public.fixture_document_sources();
set local role anon;
select pg_temp.denied('select public.fixture_document_commit(0,''publish'',30)','42501');
select pg_temp.denied('select public.read_workspace_page_document(''10000000-0000-4000-8000-000000000060'',''public'')','42501');
reset role;
set local role authenticated;
select pg_temp.denied('select * from public.workspace_page_document_grants','42501');
reset role;
-- The old image wrapper cannot bypass document validation through service_role.
set local role service_role;
select pg_temp.ok(not has_function_privilege('service_role','public.commit_workspace_page_with_images(uuid,uuid,uuid,uuid,text,integer,text,jsonb,jsonb,jsonb,timestamptz,jsonb,jsonb,uuid,jsonb)','EXECUTE'));
select pg_temp.ok(to_regprocedure('public.commit_workspace_page(uuid,uuid,uuid,uuid,text,integer,text,jsonb,jsonb,jsonb,timestamptz,jsonb,jsonb,uuid,jsonb)') is null);
reset role;
-- A declared PDF, HTML MIME or foreign source cannot become a text grant.
update public.organization_workspace_boards set state=jsonb_set(state,'{particleGraph,particles,0,data,widget,format}','"pdf"');
set local role service_role;
select pg_temp.denied('select public.fixture_document_commit(0,''publish'',30)','40001');
reset role;
select pg_temp.ok(not exists(select 1 from public.organization_workspace_pages));
select public.fixture_document_sources();
update public.organization_document_files set mime_type='text/html';
set local role service_role;
select pg_temp.denied('select public.fixture_document_commit(0,''publish'',30)','40001');
reset role;
select pg_temp.ok(not exists(select 1 from public.organization_workspace_pages));
select public.fixture_document_sources();
-- Source deletion/revision and wrong paths fail atomically, including new pages.
update public.organization_document_files set deleted_at=now();
set local role service_role;
select pg_temp.denied('select public.fixture_document_commit(0,''publish'',30)','40001');
reset role;
select pg_temp.ok(not exists(select 1 from public.organization_workspace_pages));
update public.organization_document_files set deleted_at=null;
set local role service_role;
select pg_temp.denied('select public.fixture_document_commit(0,''publish'',30,60,''{"path":"other-org/private.png"}'')','22023');
select pg_temp.denied('select public.fixture_document_commit(0,''publish'',30,60,''{"size":999}'')','40001');
select public.fixture_document_commit(0,'publish',30);
select pg_temp.ok(public.read_workspace_page_document('10000000-0000-4000-8000-000000000060','public')->>'sha256'=repeat('b',64));
select pg_temp.ok(public.read_workspace_page_document('10000000-0000-4000-8000-000000000061','public') is null);
select pg_temp.ok(public.read_workspace_page_document('10000000-0000-4000-8000-000000000060','guest','10000000-0000-4000-8000-000000000006') is null);
select pg_temp.ok(public.read_workspace_page_document('10000000-0000-4000-8000-000000000060','editor','10000000-0000-4000-8000-000000000006') is null);
select pg_temp.ok((public.fixture_document_commit(0,'publish',30)->>'replayed')::boolean);
select public.fixture_document_commit(1,'make_private',31);
select pg_temp.ok(public.read_workspace_page_document('10000000-0000-4000-8000-000000000060','public') is null);
select pg_temp.ok(public.read_workspace_page_document('10000000-0000-4000-8000-000000000060','editor','10000000-0000-4000-8000-000000000001') is not null);
select public.fixture_document_commit(2,'share_with_guests',32,61);
select public.workspace_page_guest_command('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000010',
 '{"action":"invite","operationId":"10000000-0000-4000-8000-000000000100","invitationId":"10000000-0000-4000-8000-000000000200","permission":"view","email":"person6@example.org"}',repeat('c',64));
select public.workspace_page_guest_command('10000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000010',
 '{"action":"accept","invitationId":"10000000-0000-4000-8000-000000000200"}',repeat('c',64));
select pg_temp.ok(public.read_workspace_page_document('10000000-0000-4000-8000-000000000061','guest','10000000-0000-4000-8000-000000000006') is not null);
select pg_temp.ok(public.read_workspace_page_document('10000000-0000-4000-8000-000000000061','public') is null);
select public.fixture_document_commit(3,'publish',33,62);
select pg_temp.ok(public.read_workspace_page_document('10000000-0000-4000-8000-000000000060','public') is null);
select pg_temp.ok(public.read_workspace_page_document('10000000-0000-4000-8000-000000000062','public') is not null);
select pg_temp.ok(public.read_workspace_page_document('10000000-0000-4000-8000-000000000062','guest','10000000-0000-4000-8000-000000000006') is null);
select public.workspace_page_guest_command('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000010',
 '{"action":"revoke","operationId":"10000000-0000-4000-8000-000000000101","invitationId":"10000000-0000-4000-8000-000000000200"}',repeat('c',64));
select pg_temp.ok(public.read_workspace_page_document('10000000-0000-4000-8000-000000000061','guest','10000000-0000-4000-8000-000000000006') is null);
reset role;
-- The approved copy survives a changed private source; no original bytes read.
update public.organization_document_files set deleted_at=now();
set local role service_role;
select pg_temp.ok(public.read_workspace_page_document('10000000-0000-4000-8000-000000000062','public') is not null);
select public.fixture_document_commit(4,'make_private',34);
select pg_temp.ok(public.read_workspace_page_document('10000000-0000-4000-8000-000000000062','public') is null);
reset role;
update public.organization_document_files set deleted_at=null;
update storage.objects set created_at=now()-interval '2 days' where name not like '%000000000065.txt';
set local role service_role;
select pg_temp.denied('select public.fixture_document_commit(5,''publish'',35,63)','40001');
select pg_temp.ok(jsonb_array_length(public.workspace_page_image_orphans())=2);
select pg_temp.ok(not public.workspace_page_image_orphans() @> '["10000000-0000-4000-8000-000000000001/10000000-0000-4000-8000-000000000010/10000000-0000-4000-8000-000000000060.txt"]');
reset role;
-- Image and document grants share one transaction, including rollback after
-- the image helper has already inserted its grant.
delete from public.organization_workspace_pages;
select public.fixture_image_sources();
insert into public.organization_document_files values('10000000-0000-4000-8000-000000000051','10000000-0000-4000-8000-000000000001',null,null,
 'text/plain',123,'10000000-0000-4000-8000-000000000001/library/guide.txt','2026-10-16T18:30:00Z');
update public.organization_workspace_boards set state=jsonb_set(state,'{particleGraph,particles}',
 state#>'{particleGraph,particles}' || '[{"id":"10000000-0000-4000-8000-000000000021","type":"activity","title":"Guide","data":{"widget":{"kind":"document","format":"txt","fileId":"10000000-0000-4000-8000-000000000051"}}}]');
insert into storage.objects(bucket_id,name,metadata) values('workspace-page-assets',
 '10000000-0000-4000-8000-000000000001/10000000-0000-4000-8000-000000000010/10000000-0000-4000-8000-000000000070.txt','{"mimetype":"text/plain","size":20}');
create function pg_temp.mixed_commit() returns jsonb language plpgsql as $$
declare root text:='10000000-0000-4000-8000-'; org uuid:=(root||'000000000001')::uuid;
 page uuid:=(root||'000000000010')::uuid; img jsonb; doc jsonb;
begin
 img:=jsonb_build_object('id',root||'000000000060','path',org::text||'/'||page::text||'/'||root||'000000000060.webp',
 'sha256',repeat('b',64),'size',20,'width',10,'height',10,'source',jsonb_build_object(
 'id',root||'000000000050','org_id',org,'storage_path',org::text||'/library/image.png','mime_type','image/png','size_bytes',123,'updated_at','2026-10-16T18:30:00Z'));
 doc:=jsonb_build_object('id',root||'000000000070','path',org::text||'/'||page::text||'/'||root||'000000000070.txt',
 'sha256',repeat('c',64),'size',20,'source',jsonb_build_object(
 'id',root||'000000000051','org_id',org,'storage_path',org::text||'/library/guide.txt','mime_type','text/plain','size_bytes',123,'updated_at','2026-10-16T18:30:00Z'));
 return public.commit_workspace_page(org,org,page,(root||'000000000300')::uuid,repeat('d',64),0,'publish',
 jsonb_build_object('title','Mixed','description','','particleIds',jsonb_build_array(root||'000000000020',root||'000000000021')),
 jsonb_build_object('version',1,'brand',jsonb_build_object('name','Community table','organizationSlug','community-table'),'title','Mixed','description','',
 'items',jsonb_build_array(jsonb_build_object('id',root||'000000000020','title','Photo','content',jsonb_build_object('kind','image','assetId',root||'000000000060','alt','Photo')),
 jsonb_build_object('id',root||'000000000021','title','Guide','content',jsonb_build_object('kind','document','assetId',root||'000000000070','name','Guide.txt')))),
 (select state->'particleGraph' from public.organization_workspace_boards limit 1),'2026-10-16T18:30:00Z','[]',null,null,jsonb_build_array(img),jsonb_build_array(doc));
end; $$;
update public.organization_document_files set deleted_at=now() where id='10000000-0000-4000-8000-000000000051';
set local role service_role;
select pg_temp.denied('select pg_temp.mixed_commit()','40001');
reset role;
select pg_temp.ok(not exists(select 1 from public.organization_workspace_pages));
select pg_temp.ok(not exists(select 1 from public.workspace_page_image_grants));
select pg_temp.ok(not exists(select 1 from public.workspace_page_document_grants));
update public.organization_document_files set deleted_at=null;
set local role service_role;
select pg_temp.mixed_commit();
select pg_temp.ok(public.read_workspace_page_image('10000000-0000-4000-8000-000000000060','public') is not null);
select pg_temp.ok(public.read_workspace_page_document('10000000-0000-4000-8000-000000000070','public') is not null);
select pg_temp.ok(public.read_workspace_page_image('10000000-0000-4000-8000-000000000070','public') is null);
select pg_temp.ok(public.read_workspace_page_document('10000000-0000-4000-8000-000000000060','public') is null);
reset role;
update storage.objects set created_at=now()-interval '2 days';
set local role service_role;
select pg_temp.ok(jsonb_array_length(public.workspace_page_image_orphans())=5);
reset role;
rollback;
\echo 'document publication: atomic source checks, exact retry, public/private/guest separation, direct revocation, immutable reviewed copies and orphan bounds passed'
