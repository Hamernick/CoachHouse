# Organization activity continuation

## Batch 1 — complete document/file coverage and refresh

Plan: retain the existing project/task/program/fiscal activity stream; capture organization documents/files at the database mutation boundary; distinguish unavailable/error/empty history; refresh only the visible Activity tab without page reloads. Current worktree preserved. No remote mutations, commits, push, migration application or deployment.

Implementation:
- Migration `20260919194000_record_organization_document_activity.sql` captures meaningful roadmap, compliance-upload and policy profile changes plus library, Drive-link and project-asset rows. Ignores timestamp-only writes, untouched default roadmap sections and duplicate compliance file tracking. Lifecycle events include upload/update/removal/restore. Events store titles and source identifiers, never document bodies or storage paths. Existing table RLS/write restrictions stay intact; new trigger helpers are not executable by public/anon/authenticated roles.
- No backfill: history starts when the migration is applied. Drive events reflect stored integration updates, not continuous provider monitoring. Service-client writes can have a null actor; no invented attribution.
- Activity loader adds organization document/file events, stable newest-first ordering, and distinct unavailable/error states. A failed history read no longer prevents the rest of the detail page loading.
- Authenticated refresh action validates IDs, current access/coach scope and project organization ownership. Client polling runs every 30 seconds only while visible, refreshes on focus/manual request, deduplicates in-flight calls and disposes listeners/timers. Failed refresh preserves the last result with a warning; explicit access denial clears it.

Evidence: isolated PostgreSQL trigger/RLS harness, focused loader/authorization/polling/render tests, scoped lint/type/structure/boundary checks. The RLS harness uses the existing activity SELECT policy with a minimal local schema; it does not prove deployed policy state. Test runner is registered in `pnpm test:rls`.

Limitations: migration remains unapplied. Live trigger deployment, actual browser interaction and visual review remain unverified; supported browser runtime is still missing browser-service.mjs. No new images/screenshots or mobile work. Full quality gate not run. Existing unrelated duplicate `vi` imports block TypeScript's global success.

## Deployment/rollback continuation (not executed)

Review and apply the pending migration through the normal authorized migration process before expecting new document/file events. Verify with explicitly authorized test documents; do not create synthetic events in a live organization automatically.

Non-destructive rollback: remove these four new triggers, then the three new functions. Leave expanded enum-like CHECK constraints and already-recorded events intact so historical data is retained. Reverting UI polling does not require deleting history.

```sql
drop trigger if exists record_organization_document_activity on public.organizations;
drop trigger if exists record_organization_library_file_activity on public.organization_document_files;
drop trigger if exists record_organization_external_file_activity on public.organization_external_documents;
drop trigger if exists record_organization_project_file_activity on public.organization_project_assets;
drop function if exists public.record_organization_document_activity();
drop function if exists public.record_organization_file_activity();
drop function if exists public.organization_activity_document_entries(jsonb);
```

Final batch evidence: 23 focused acceptance tests passed; final loader rerun (4 tests) and `pnpm test:rls:document-activity` passed. Scoped lint, structure, boundaries, React Grab, storage boundary and diff checks passed. Graphify AST refresh session 1015 pending. Continue with desktop review and migration rollout only when authorized.
