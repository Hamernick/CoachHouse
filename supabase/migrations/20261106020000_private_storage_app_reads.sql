-- Native private bytes are delivered by authenticated app routes. Their
-- source checks remain session-scoped; only the internal Storage read uses
-- service_role. Never expose that credential or an internal signed URL.
begin;

-- SELECT is also needed by upload/update/delete. Preserve those operations
-- under every existing permissive AND restrictive policy. Do not allow copy,
-- move, list, info, S3 reads, image transforms or signed-URL creation: each can
-- expose bytes/metadata or create a new capability outside the app boundary.
create policy private_files_app_read_boundary on storage.objects
as restrictive for select to anon, authenticated
using (
  bucket_id not in ('org-documents', 'project-assets')
  or storage.allow_any_operation(array[
    'object.upload', 'object.upload_update',
    'object.delete', 'object.delete_many'
  ])
);

-- No objects, existing grants or public buckets are modified. Previously
-- issued signed links and cached responses need a separate cutover horizon;
-- this policy alone does not invalidate them or recall downloaded bytes.
commit;
