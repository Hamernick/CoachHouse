\set ON_ERROR_STOP on
\ir workspace-sharing-commit-fixture.sql
-- Minimal provider schema for local transaction proof; not a Storage emulator.
create schema storage;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,created_at timestamptz default now(),metadata jsonb);
alter table storage.objects enable row level security;
create table public.organization_document_files(
 id uuid primary key,org_id uuid,document_kind text,deleted_at timestamptz,mime_type text,size_bytes bigint,storage_path text,updated_at timestamptz
);
\ir ../migrations/20261101120000_workspace_page_images.sql

create function public.fixture_image_sources() returns void language plpgsql as $seed$ begin
delete from storage.objects;
delete from public.organization_document_files;
insert into public.organization_document_files values('10000000-0000-4000-8000-000000000050','10000000-0000-4000-8000-000000000001',null,null,
 'image/png',123,'10000000-0000-4000-8000-000000000001/library/image.png','2026-10-16T18:30:00Z');
update public.organization_workspace_boards set state=jsonb_build_object('particleGraph',jsonb_build_object(
 'workspaceId',org_id,'particles',jsonb_build_array(jsonb_build_object('id','10000000-0000-4000-8000-000000000020',
 'type','activity','title','Reviewed image','data',jsonb_build_object('widget',jsonb_build_object('kind','image','fileId','10000000-0000-4000-8000-000000000050'))))));
insert into storage.objects(bucket_id,name,metadata) select 'workspace-page-assets',
 '10000000-0000-4000-8000-000000000001/10000000-0000-4000-8000-000000000010/10000000-0000-4000-8000-'||lpad(i::text,12,'0')||'.webp',
 '{"mimetype":"image/webp","size":20}' from generate_series(60,65) i;

end; $seed$;
create function public.fixture_image_commit(rev integer,intent text,op integer,asset integer default 60,patch jsonb default '{}') returns jsonb language sql as $$
 select public.commit_workspace_page('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',
 '10000000-0000-4000-8000-000000000010',('10000000-0000-4000-8000-'||lpad(op::text,12,'0'))::uuid,repeat('a',64),rev,intent,
 '{"title":"Images","description":"","particleIds":["10000000-0000-4000-8000-000000000020"]}',
 jsonb_build_object('version',1,'brand',jsonb_build_object('name','Community table','organizationSlug','community-table'),
 'title','Images','description','','items',jsonb_build_array(jsonb_build_object('id','10000000-0000-4000-8000-000000000020','title','Image',
 'content',jsonb_build_object('kind','image','assetId','10000000-0000-4000-8000-'||lpad(asset::text,12,'0'),'alt','Workshop')))),
 (select state->'particleGraph' from public.organization_workspace_boards limit 1),'2026-10-16T18:30:00Z','[]',null,null,
 case when intent='make_private' then '[]'::jsonb else jsonb_build_array(jsonb_build_object(
 'id','10000000-0000-4000-8000-'||lpad(asset::text,12,'0'),
 'source',jsonb_build_object('id','10000000-0000-4000-8000-000000000050','org_id','10000000-0000-4000-8000-000000000001',
 'storage_path','10000000-0000-4000-8000-000000000001/library/image.png','mime_type','image/png','size_bytes',123,'updated_at','2026-10-16T18:30:00Z'),
 'path','10000000-0000-4000-8000-000000000001/10000000-0000-4000-8000-000000000010/10000000-0000-4000-8000-'||lpad(asset::text,12,'0')||'.webp',
 'sha256',repeat('b',64),'size',20,'width',10,'height',10)||patch) end);
$$;

grant execute on function public.fixture_image_commit(integer,text,integer,integer,jsonb) to service_role,authenticated,anon;
