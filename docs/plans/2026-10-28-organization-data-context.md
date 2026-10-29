# Selected organization learning context

## Scope and status

Original01 stages2/3/6; O013-01/O039-01 remain In progress. User authorized fixing admin organization switching across Accelerator, Documents and People. Isolated `fix/organization-data-context-20261028` from `origin/main` at `1da38be94`; root dirty checkout and PR363 remain preserved. Shared SHIP40 and release ownership are unchanged.

Live read-only diagnosis established that the reported placeholder notes and accepted empty assignments belong to the signed-in staff seed account. The sampled organization owners do not have those placeholders. No live records, provider settings or deployments changed. Customer identities and answers are excluded from this public checkpoint.

## Implementation

- Verified support sessions resolve learning records to the selected organization's owner. Ordinary learners retain personal progress; organization membership alone does not grant access to someone else's answers.
- Workspace timelines, module pages, class navigation, progress, assignment reads/writes, note reads/writes and Documents note indexes use that same resolved identity. Actual actor identity remains intact for notifications, journey events and audit.
- Existing organization files, roadmap, People, programs and taxonomy already use the selected organization; retained their authorization paths.
- Organization/account changes remount workspace state. Assignment drafts, lesson navigation and completion indicators have organization/account namespaces. Old unscoped drafts remain stored but are not silently imported into another account.
- Completion hydrates from authoritative module/submission statuses, not old shared-board completion snapshots. Resume position remains; non-durable step-only completion is not promoted to a completed lesson.
- Notes cleanup carries the original organization and rejects a mismatched target. Initial note loading cannot autosave a stale empty debounce value over loaded text; failed reads remain unsavable.
- Migration `20261028233000_workspace_support_learning.sql` adds selected-owner reads and presence-checked insert/update policies to the two learning tables, with the existing actual-actor audit trigger. No DELETE privilege, account seeding, role changes or progress backfill.

## Verification

- 54 existing focused cases across progress, assignment recovery, workspace hydration, organization switching/support, People access/read safety and document upload access pass.
- Nine new behavioral cases pass (including selected-owner Documents note search/preview and revoked preview access): A/B/A reads, correct-target note/answer/completion writes and readback, personal-seed preservation, stale keepalive rejection, revoked support denial, ordinary learner isolation, draft namespace isolation and board snapshot correction (combined cases).
- Disposable PostgreSQL document/support suite passes, including new learning-table read/write/denial/audit assertions. The initial fixture failure came from a deliberately deleted staff grant cascading; restored the exact isolated grant before testing. No production SQL applied.
- Seven native Chromium checks with actual scope provider and draft/notes hooks pass: read-only note hydration, pending autosave cancellation on switch, empty target stays empty, selected-target answers/notes saves, A-only draft recovery, account isolation, reload ignoring legacy dummy drafts. Server boundaries are mocked in this browser harness and independently exercised above; this is not live application acceptance.
- Fresh worktree Next type generation, scoped ESLint and structure/routes/features/thresholds/boundaries/workspace-storage/interaction-locks/react-grab/workspace-surfaces checks pass. The expanded focused run passed 66 cases; after adding Documents coverage the new suite passed nine cases, and workspace activity passed five cases including selected learner/default viewer queries. These runs overlap and are not additive. Full application TypeScript passes after the final activity correction. Staged diff hygiene and redacted secret scan pass. Normal Node22 prepush passes (7.76s); implementation `79fc18dfd0841e881507f0f0a8adb80b80296150` was independently matched to the remote branch. Graphify AST plus two-document semantic maintenance completed: 22,835 nodes, 65,071 edges, 1,250 communities; final source hashes verified and unrelated nodes preserved. Two inherited self-loops and the unrelated Companion parser warning remain unchanged; zero new structural defects. Receipt: `graphify-out/.organization-context-maintenance-receipt.json`.
- Browser-generated temporary TSX is archived as `entry.tsx.evidence` so evidence is not accidentally included in the application compiler scope.
- Local evidence: `test-results/org-context/browser.mjs`, `browser-result.json`; `/private/tmp/coach-house-org-context-{focused,new-tests,rls,browser,types,lint}.log`.

## Release and recovery

Migration `20261028233000` was applied to production with explicit user authorization and independently verified at 2026-10-29 01:51:18 UTC. Older clients retain their existing behavior until deployment of the matching app. Current-revision hosted quality, review, merge, deployment and authenticated admin/owner acceptance remain Caleb-owned. Tori's separate report of missing work is not proven resolved by this admin-view correction.

Rollback: revert this app revision; drop only `workspace_support_learning_read`, `workspace_support_learning_insert`, `workspace_support_learning_update` policies and `workspace_support_learning_audit` trigger from `module_progress` and `assignment_submissions`. Preserve learner records, audit history and existing policies. The schema migration is now applied; use this rollback only if explicitly directed during release recovery.

Resume: `cd /private/tmp/coach-house-org-context-20261028`; inspect status and this checkpoint. Do not delete staff seed data or rewrite customer completion based on appearance in an admin session.

## PR handoff

Open [PR364](https://github.com/Hamernick/CoachHouse/pull/364). The implementation is pushed; no hosted CI polling, merge, migration or deployment performed. Original01 Desktop packet links its new continuation pointer. The final documentation-only handoff commit records graph completion and uses normal prepush again.

## Authorized production migration — 2026-10-29 01:51 UTC

User explicitly requested applying the required migration. Verified the configured app and linked Supabase project resolve to Coach House and the migration was absent. Required helper functions existed and matched the support/presence/audit contract. Applied only the exact committed migration and its migration-ledger entry in one transaction with lock/statement timeouts; no broad migration push, learner-row mutation, role change or app deployment.

Independent API readback verified the ledger SQL exactly matches the file, six new SELECT/INSERT/UPDATE policies, two enabled audit triggers, all existing policies preserved, and RLS still enabled on both tables. Private receipt: `/private/tmp/coach-house-learning-migration-verified.json`. Current application deployment and authenticated UI acceptance remain unverified; this completes only the authorized schema step.
