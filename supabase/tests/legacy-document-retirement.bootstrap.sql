-- Minimal data dependencies; guards under test are the actual migration.
-- Exact closure-receipt authorization is separately tested against full schema.
create function public.closure_asset_file_finalization_allowed(uuid,uuid)
returns boolean language sql stable as $$select false$$;
create table public.document_file_versions(storage_path text);
create table public.document_version_operations(source_storage_path text,state text);
create table public.fixture_legacy_dependents(file_id uuid references public.organization_document_files(id) on delete cascade,label text);
