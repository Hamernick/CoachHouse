# Uploaded document rooms — migration application receipt

- Authorization: user explicitly requested “apply migration. keep going.”
- Lane: `feat/particle-system-20261009`; existing isolated Particle worktree/localhost:3008 retained.
- Date: 2026-10-14T20:13:54.847740+00:00.
- Target: configured Supabase project `vswzhuwjtgzrkxknrmxu`; preview configuration and main's linked project reference match. This is a shared provider write, not a local-only fixture.
- Applied migration: `20261014213000_add_document_collaboration_rooms.sql`.
- SHA-256: `f4664b756295d1fb2be61eade3fd751cee0faf915cfbc1fb99ad0e8e76843213`.
- Method: official Supabase Management API SQL endpoint; only this reviewed migration plus its history receipt applied in one transaction, with advisory lock and lock/statement timeouts. No all-pending migration push, existing-data conversion or user-content writes.

## Collision resolved before application

Remote version `20261014160000` already records `core_document_collaboration`, which adds profile-backed roadmap section sessions/history/presence. Inspected its schema/source and preserved it. The uploaded-file room tables and five new function names did not exist. Renumbered the prepared migration to `20261014213000`, checked required canonical-file columns and helpers, then applied it. Recorded the exact source in `supabase_migrations.schema_migrations`; both history entries remain intact.

## Verified after commit

- Two new tables exist with enabled and forced RLS; authenticated clients have SELECT only and anon has no table grants.
- Two read policies reuse existing canonical-file access.
- Five functions have SECURITY DEFINER and an empty search path; bootstrap/compaction execute grants are restricted to service_role and database owner.
- `document_collaboration_updates` is in `supabase_realtime`; the checkpoint table is not. Client subscriptions select INSERT only.
- Both new tables remain empty: no production rooms/files were created for verification.

Private credential values are absent from this receipt and command outputs. Temporary response artifacts: `/tmp/particle-document-room-application.json`, `/tmp/particle-document-room-verification.json`.

## Verification boundary

Isolated PostgreSQL tests exercise actual policies/functions and concurrent writers, with synthetic data in the marked loopback fixture. Shared-provider checks establish migration/history/schema/grants/publication only. They do not establish authenticated browser Realtime delivery, canonical Save, provider write-back, visual approval or deployment. Editor/window wiring remains gated on lifecycle/recovery and versioned persistence.
