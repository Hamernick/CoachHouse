\set ON_ERROR_STOP on
\ir workspace-data-views-fixture.sql
-- Restore board timestamp columns omitted by the inherited minimal sharing stub;
-- actual definitions come from 20260222183000_add_workspace_board_tables.sql.
alter table public.organization_workspace_boards add column created_at timestamptz not null default timezone('utc',now()), add column updated_at timestamptz not null default timezone('utc',now());
\ir ../migrations/20261103040000_workspace_page_note_edit_scope.sql
-- Uses actual guest/page/closure/source write constraints over scoped local
-- prerequisites. Test harness creates canonical notes with real Particle code.
