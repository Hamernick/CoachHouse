# Particle Event calendar — migration receipt

- Recorded: 2026-10-15T02:50:15.248254+00:00.
- Lane: `feat/particle-system-20261009`, existing isolated worktree/localhost:3008.
- Target: configured Supabase project `vswzhuwjtgzrkxknrmxu`, matched against main's linked project reference. This is the shared application database, not only a local fixture.
- Applied only: `20261015003000_workspace_particle_calendar_revisions.sql`.
- Source SHA-256: `f6408b71397a016b4328c147a97eee4586c9aee810ca7a735343cee036362477`.
- Method: official Management API database endpoint, one transaction with advisory lock, 5-second lock timeout, 15-second statement timeout, object/history collision checks and exact-source migration history. No all-pending migration push or existing Event conversion.

## Architecture

Saved scheduled standalone Event Activities remain canonical in `organization_workspace_boards.state.particleGraph`. Calendar rows are validated read projections with namespaced Particle identity. No parallel Event table row, provider invitation or notification is created. Undated records remain unscheduled; canvas visibility does not affect scheduling.

The migration adds one small `organization_workspace_calendar_revisions` row per affected organization, a deterministic semantic comparison helper and a transactional board trigger. Creation, rescheduling, details edits, unscheduling and deletion increment the signal. Positions, sizing, selection, timestamps and hiding do not. The trigger also enforces existing calendar-management rights for direct authenticated board writes; the service-role graph action separately checks the real actor before its conditional write.

## Verification

- Remote exact-source history verified; forced RLS and one authenticated SELECT policy enabled.
- Authenticated has SELECT only; anon has no read or write grants. Trigger is enabled and its SECURITY DEFINER helper uses an empty search path.
- Only the small signal relation was added to `supabase_realtime`; the workspace board is not published.
- Actual migration, repeat DDL, authorization/role-forgery matrix, no-op gestures, scheduling/deletion, scope transitions, RLS, organization cascades and rollback passed against a marked disposable loopback PostgreSQL database. That test database was dropped.
- Rollback: `supabase/rollbacks/20261015003000_workspace_particle_calendar_revisions.sql`. Removes only the signal infrastructure; preserves saved Particle data.

Evidence: `/tmp/particle-event-calendar-{preflight,application,verification}.json`, `/tmp/particle-event-calendar-sql.log`.

## Review boundary

Provider verification covers schema/history/grants/publication, not authenticated browser Realtime delivery or visual approval. No production Event content was created or modified for testing. Google Calendar board export, ICS feeds and invitation delivery remain unchanged and do not yet project these Events. No commit, push, deployment or release is implied.

Implementation follows [Supabase Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes) for scoped RLS subscriptions and [Next.js native history navigation](https://nextjs.org/docs/app/getting-started/linking-and-navigating) for consuming a completed selection request without another server render.
