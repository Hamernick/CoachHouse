# Remove automatic workspace previews — October20

## Scope and current state

User authorized: “clear out those dummy tasks/projects and make sure those dont keep getting added.” New isolated `fix/remove-workspace-preview-seeds-20261020` from current main22b1ccf6 (merged Tasks PR343). Existing Tasks checkout retains its two local receipt/diagnosis commits; servers3127/3140 and other worktrees are untouched. Continuation of original04 internal Tasks follow-up, without reopening connector/import work or changing shared SHIP40 ownership.

**Production correction is applied and independently verified.** Removed102default preview tasks,36preview projects,102dependent assignments and22default-text overview documents. No real tasks/projects/assignments changed. Preserved the separate fiscal case-study project, its6tasks and all notes/assets/fiscal records exactly. Existing activity history remains; normal deletion events were recorded. No mail/provider changes.

## Cause and application correction

Projects, Tasks and project-detail page loads called initializer functions that inserted persisted preview projects/tasks and assigned them to the triggering editor. They were not render-only examples. The template and initialization predated PR343; latest affected production task creation wasOctober19, before the Tasks migration.

Removed those loader calls, their unused persistence helpers and the unused reset/restore action/exports. Existing real creation/editing, fiscal work, personal scope, the existing clear action and lab fixtures remain intact. Empty organization loads stay empty across repeated visits. No UI styling change or visual baseline update.

## Database guard and reviewed cleanup

Applied only `supabase/migrations/20261021020000_disable_workspace_preview_seeds.sql`, creating an invoker trigger function with empty search path plus BEFORE INSERT triggers on projects/tasks. Incoming starter_seed rows returnNULL, so older loader upserts safely return no inserted rows. User/system inserts and edits to retained records remain allowed; RLS unchanged. This blocks recreation immediately without waiting for web deployment.

The migration and narrowly scoped cleanup ran in one transaction with5s lock/20s statement deadlines. Selected exact reviewed IDs only, checked complete rows/dependents against a private backup under locks, and aborted on any change. Preview fields matched the known template, with no real-content dependencies. Task completion changes were allowed because the tasks retained exact dummy titles/content. Every non-target project/task/assignment was compared before/after inside the transaction. Independent reads confirm zero targeted records, exact migration SQL/function body, both enabled triggers, preservedRLS and byte-equivalent case-study data. The initial post-write case-study comparison used two different timestamp serialization formats; normalized readback resolved that verifier mismatch without retrying the write.

Migration SHA256: `6c6ab257160550f92a0ff8fb151017228e2438c06589cd17af60255b2075b07c`. Private evidence: `~/.local/share/coach-house/tasks/2026-10-20-preview-cleanup/receipt.json`, exact guarded SQL, reviewed-backup.json, dependency snapshots and independent-readback.json. Do not replay the migration or cleanup.

Rollback: the application removal can be reverted independently while the guard remains active. If explicitly authorized, remove the two `suppress_workspace_preview_seed_insert` triggers and then `public.suppress_workspace_preview_seed_insert()` to restore old insert behavior. Restoring deleted demo rows is a separate reviewed operation from the private backup, accounting for assignment notifications and retained audit history; do not automatically restore/reseed.

## Validation

-27focused loader/action/deletion cases pass, including repeated Projects/Tasks/missing-detail loads by an editor with writes forbidden. Real creation/deletion contracts remain covered. Acceptance manifest updated after removing two obsolete seed-helper tests.
-Disposable PostgreSQL recurrence/task-planning suite passes with new preview guard checks: repeated authenticated inserts and conflicting upserts produce no rows, service writes also cannot seed, existing edited rows remain intact, real task creation/editRPCs and system inserts work, direct unauthorized writes stay denied, assignments/notifications andRLS remain intact. Initial test assumptions about direct task writes were corrected to use the existing service-onlyRPC contracts; no application rights were widened.
-Scoped ESLint, structure, import boundaries, acceptance manifest, staged secret scan and diff checks pass. Graphify refreshed once after the cohesive code slice:21,738nodes/62,366edges. Application TypeScript/push results follow in the final handoff.

Application changes await open-PR review/merge/deployment. The production cleanup and recreation prevention are already active; authenticated UI acceptance remains with Caleb.
