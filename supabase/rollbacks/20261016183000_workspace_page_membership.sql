-- Only newly introduced page records are removed. Board and source data stay.
drop table if exists public.organization_workspace_pages;
drop function if exists public.workspace_page_membership_valid(uuid[]);
