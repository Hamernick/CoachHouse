drop function if exists public.commit_workspace_page(uuid,uuid,uuid,uuid,text,integer,text,jsonb,jsonb,jsonb,timestamptz,jsonb,jsonb);
alter table public.organization_workspace_pages
  drop constraint if exists organization_workspace_pages_operation_receipt,
  drop column if exists last_operation_id,
  drop column if exists last_operation_actor,
  drop column if exists last_operation_hash;
