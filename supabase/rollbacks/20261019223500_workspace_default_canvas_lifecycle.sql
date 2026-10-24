-- Disable new default-canvas deletion requests. Keep the tombstone trigger:
-- removing it would let older clients resurrect already-deleted canvas data.
-- This rollback intentionally does not recreate deleted data or rename canvases.
create or replace function public.workspace_canvas_storage_version()
returns integer language sql immutable set search_path = '' as $$ select 1; $$;
revoke all on function public.workspace_canvas_storage_version() from public, anon;
grant execute on function public.workspace_canvas_storage_version() to authenticated, service_role;
