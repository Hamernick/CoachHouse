\set ON_ERROR_STOP on
\ir workspace-sharing-images-fixture.sql
\ir ../migrations/20261101130000_workspace_page_documents.sql

create function public.fixture_document_sources() returns void language plpgsql as $seed$ begin
delete from storage.objects;
delete from public.organization_document_files;
insert into public.organization_document_files values('10000000-0000-4000-8000-000000000050','10000000-0000-4000-8000-000000000001',null,null,
 'text/plain',123,'10000000-0000-4000-8000-000000000001/library/guide.txt','2026-10-16T18:30:00Z');
update public.organization_workspace_boards set state=jsonb_build_object('particleGraph',jsonb_build_object(
 'workspaceId',org_id,'particles',jsonb_build_array(jsonb_build_object('id','10000000-0000-4000-8000-000000000020',
 'type','activity','title','Reviewed document','data',jsonb_build_object('widget',jsonb_build_object('kind','document','format','txt','fileId','10000000-0000-4000-8000-000000000050'))))));
insert into storage.objects(bucket_id,name,metadata) select 'workspace-page-assets',
 '10000000-0000-4000-8000-000000000001/10000000-0000-4000-8000-000000000010/10000000-0000-4000-8000-'||lpad(i::text,12,'0')||'.txt',
 '{"mimetype":"text/plain","size":20}' from generate_series(60,65) i;

end; $seed$;
create function public.fixture_document_commit(rev integer,intent text,op integer,asset integer default 60,patch jsonb default '{}') returns jsonb language sql as $$
 select public.commit_workspace_page('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',
 '10000000-0000-4000-8000-000000000010',('10000000-0000-4000-8000-'||lpad(op::text,12,'0'))::uuid,repeat('a',64),rev,intent,
 '{"title":"Documents","description":"","particleIds":["10000000-0000-4000-8000-000000000020"]}',
 jsonb_build_object('version',1,'brand',jsonb_build_object('name','Community table','organizationSlug','community-table'),
 'title','Documents','description','','items',jsonb_build_array(jsonb_build_object('id','10000000-0000-4000-8000-000000000020','title','Document',
 'content',jsonb_build_object('kind','document','assetId','10000000-0000-4000-8000-'||lpad(asset::text,12,'0'),'name','Guide.txt')))),
 (select state->'particleGraph' from public.organization_workspace_boards limit 1),'2026-10-16T18:30:00Z','[]',null,null,'[]',
 case when intent='make_private' then '[]'::jsonb else jsonb_build_array(jsonb_build_object(
 'id','10000000-0000-4000-8000-'||lpad(asset::text,12,'0'),
 'source',jsonb_build_object('id','10000000-0000-4000-8000-000000000050','org_id','10000000-0000-4000-8000-000000000001',
 'storage_path','10000000-0000-4000-8000-000000000001/library/guide.txt','mime_type','text/plain','size_bytes',123,'updated_at','2026-10-16T18:30:00Z'),
 'path','10000000-0000-4000-8000-000000000001/10000000-0000-4000-8000-000000000010/10000000-0000-4000-8000-'||lpad(asset::text,12,'0')||'.txt',
 'sha256',repeat('b',64),'size',20)||patch) end);
$$;

grant execute on function public.fixture_document_commit(integer,text,integer,integer,jsonb) to service_role,authenticated,anon;
