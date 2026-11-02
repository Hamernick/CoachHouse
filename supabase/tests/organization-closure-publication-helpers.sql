-- Fixture-only setup. Real publication and form ingestion precede synthetic
-- mixed-asset/guest selections; provider bytes are not emulated here.
create or replace function public.fixture_closure_publication() returns void language plpgsql as $$
declare snapshot jsonb;
begin
 delete from public.organization_closure_operations;
 delete from public.organization_closures;
 -- Remove the empty secondary board used by first-insert closure schedules.
 delete from public.organization_workspace_boards where org_id=public.fixture_form_id(2);
 update public.organization_workspace_boards set state='{}',updated_by=public.fixture_form_id(1);
 truncate public.organization_workspace_pages cascade;
 delete from public.organization_forms;
 delete from storage.objects;
 perform public.fixture_form_publish(0);
 perform public.fixture_form_command('submit');
 select published_snapshot into snapshot from public.organization_workspace_pages where id=public.fixture_form_id(10);
 snapshot:=jsonb_set(snapshot,'{items}',snapshot->'items'||jsonb_build_array(
   jsonb_build_object('id',public.fixture_form_id(21),'content',jsonb_build_object('kind','image','assetId',public.fixture_form_id(60))),
   jsonb_build_object('id',public.fixture_form_id(22),'content',jsonb_build_object('kind','document','assetId',public.fixture_form_id(61)))));
 update public.organization_workspace_pages set published_snapshot=snapshot,guest_snapshot=snapshot where id=public.fixture_form_id(10);
 insert into public.organization_workspace_pages(id,org_id,link_id,title,particle_ids,visibility,published_snapshot,published_at,guest_snapshot)
 values(public.fixture_form_id(11),public.fixture_form_id(2),public.fixture_form_id(11),'Other',array[public.fixture_form_id(20)],'public',
   jsonb_set(snapshot,'{brand,organizationSlug}','"other"'),now(),snapshot);
 insert into public.public_handles values('other','organization',public.fixture_form_id(2)) on conflict do nothing;
 insert into public.workspace_page_invitations(id,page_id,email,permission,invited_by,accepted_by,accepted_at)
 select public.fixture_form_id(70+n),public.fixture_form_id(10+n),'person6@example.org','view',public.fixture_form_id(1+n),public.fixture_form_id(6),now()
 from generate_series(0,1) n;
 insert into public.workspace_page_image_grants(id,page_id,org_id,revision,source_id,storage_path,sha256,size_bytes,width,height)
 select public.fixture_form_id(60+2*n),public.fixture_form_id(10+n),public.fixture_form_id(1+n),1,public.fixture_form_id(50),
 'fixture/'||n||'.webp',repeat('b',64),20,10,10 from generate_series(0,1) n;
 insert into public.workspace_page_document_grants(id,page_id,org_id,revision,source_id,storage_path,sha256,size_bytes)
 select public.fixture_form_id(61+2*n),public.fixture_form_id(10+n),public.fixture_form_id(1+n),1,public.fixture_form_id(51),
 'fixture/'||n||'.txt',repeat('c',64),20 from generate_series(0,1) n;
 insert into storage.objects(bucket_id,name,metadata) values('workspace-page-assets','fixture/0.webp','{}'),('workspace-page-assets','fixture/0.txt','{}');
end; $$;
