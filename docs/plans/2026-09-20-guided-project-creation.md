# Guided project creation

## Audit

The old member-workspace guided adapter picked the first organization, used the description as the title, discarded owner/contributor IDs and outcomes, and converted the starter-task selection to a tag without creating tasks. Ownership UI contained demo people. This path is replaced for actual member-workspace creation; the isolated upstream design lab remains separate.

## Implemented local contract

- Project: explicit organization and title, required start/due dates, overview and outcomes. No fabricated schedule or fallback title.
- People/tasks: organization-scoped real people; owner and contributor responsibilities do not grant organization access. Explicit tasks carry their own assignee, workstream and start/end dates bounded by project dates.
- Files: existing connected Google Drive picker selects file references. Store links in project assets; do not copy contents or change provider sharing permissions. Existing connection/setup and access are required. Picker failures preserve wizard state.
- Review: show actual collected values. A request UUID makes retries idempotent; one service-only RPC saves project, overview, setup/person IDs, tasks, task assignments and assets atomically.
- Projection: overview reads saved content, sidebar Owner/Contributors resolve saved profile IDs, task/workstream views read real task/assignment rows, and Assets & Files lists project file links. Task date-only values normalize to the viewer's calendar before Gantt sizing.

## Persistence

Local migration: `supabase/migrations/20260920143000_guided_project_creation.sql` (UNAPPLIED to connected/live database). Adds optional guided_setup and creation_request_id columns on the existing RLS-protected project table, plus a service-role-only atomic creation RPC. Existing project/table access rules remain in force; application action rechecks actor organization scope and selected people. Setup JSON preserves initial selections; current task rows remain authoritative after task edits.

## Evidence / next batch

53 focused tests passed; owner/contributor projection assertions also pass. Scoped lint, import boundaries and diff checks pass. Isolated PostgreSQL 14 executed base/new migrations and confirmed children, dates, saved owner ID, retry deduplication, full rollback on invalid file, and denied authenticated direct RPC execution. Fixtures/log: /tmp/coach-guided-db-test.sql and /tmp/coach-guided-db-test.log. Local server stopped afterward.

No live migration, provider mutation or browser canary performed. Browser runtime is still unavailable. Next: authorized migration application, then desktop guided create/save/reload with a connected Drive account; verify owner, contributors, assigned personal task list, multi-day workstream bars and file links. Do not claim deployment or live readiness from local fixtures.
