-- Removes only the derived invalidation infrastructure; Event data is untouched.
drop trigger if exists workspace_particle_calendar_revision on public.organization_workspace_boards;
drop function if exists public.record_workspace_particle_calendar_revision();
drop function if exists public.workspace_particle_calendar_projection(jsonb);
-- PostgreSQL removes this relation's publication membership with the table.
drop table if exists public.organization_workspace_calendar_revisions;
