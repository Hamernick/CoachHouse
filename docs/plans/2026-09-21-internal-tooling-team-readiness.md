# Internal tooling: shared team access readiness

Target: team members sign in themselves on September 21, 2026. Localhost is not a shared release.

## Release state

- Working branch: `chore/local-development-20260907`, HEAD `b476ada1`; no upstream. Current work remains uncommitted.
- Preserve the full existing dirty worktree. It includes unrelated Workspace, Documents, Calendar, public-site and admin changes; do not commit or deploy it wholesale without reviewing the candidate.
- Linked Vercel project: `coachhouse`. Latest GitHub-reported deployment inspected September 20: successful Preview at commit `1708b0d7caec9ac1e66099e7ccddd0bdb5ae43c9`, created September 18. This does not contain or certify the current local changes.
- No commits, pushes, deployments, live database writes, invitations, or provider changes were performed during this readiness pass.

## Batch 1: build and architecture

Plan: resolve the reported Client/Server Action boundary; remove feature-layer violations and verify compiler contracts.

Changes: explicit client entrypoint for dashboard revenue; feature action entrypoint for project workflow actions; shared document types/definitions moved to the library layer; activity result type moved out of server ownership; contribution calendar calculations separated from the UI. Kept existing action authorization. Removed duplicate test import. Updated stale source-contract tests to check current owners and the requested fiscal/tab/scroll behavior.

Evidence: full acceptance union passed 463 files, 2,855 tests (one skipped); static quality profile passed all 16 stages. Standalone TypeScript passed. Final build and visual results below are authoritative over intermediate results.

## Batch 2: authenticated rehearsal and corrections

Plan: inspect actual signed-in pages with current accessibility targets, without saving records.

- Admin Dashboard: profile, real revenue dropdowns and actual connected Calendar/Drive states load. Default remains assigned organizations; platform developers can explicitly select all organizations. Coaches cannot widen their scope using the query parameter (regression tested).
- Dashboard project count now excludes starter projects, matching Projects. Actual admin all-org view showed 61 organizations, 5 open projects, 5 personal open tasks and 9 recorded personal events. These are point-in-time observations, not release metrics.
- Projects: four workstream columns load; open Legal Check-up Clinics shows persisted overview, assigned coaches, schedule, workstream, activity empty state and real document controls.
- Assets & Files: editable roadmap documents and uploaded core-file slots load; signed fiscal files are excluded from the generic project-file list to avoid duplicates.
- Tasks: one personal list includes organization labels. Fixed UTC-midnight calendar dates displaying one day early; local date selection saves a calendar date rather than converting through UTC. Project card due dates now agree with the timeline. Regression checks cover New York, Honolulu and Tokyo.
- Guided setup: completed the unsaved four-step rehearsal through Review with a real organization, owner and September 21–30 dates. Files step offers the existing Google Drive picker; no provider action or project submission was performed. Removed confirmed fixture staff from person pickers, preserved email fallbacks for blank names, and replaced the missing-owner UUID error with an actionable message.
- Mobile 390px: Tasks and Dashboard document widths match viewport; dashboard Find-only bottom navigation absent. Desktop viewport restored afterward.

Limitations: this is one authenticated developer session. Other coaches' sign-in, cross-account writes, concurrent edits, live save/reload and provider OAuth flows were not exercised. Existing test/fixture records remain visible in parts of the dataset; do not remove records based on name matching.

## Batch 3: database safety

Evidence: all nine isolated PostgreSQL suites pass: signup consent, final fiscal role matrix, finance/storage, page-health bounds, public claims, public profiles, Google Drive, organization files/quota, and document activity. Guided-project and shared-option migrations additionally pass isolated atomic-create, retry idempotency, child/task/file persistence, rollback, permission denial and shared rename/delete/color/stale-version checks (`/tmp/team-ready-db.log`).

Live schema and shared-option read RPC were checked read-only. No claim that live grants or the full production write path have passed acceptance.

The final `supabase/tests/rls.test.mjs` loads `.env.local` and creates users/records remotely. It was intentionally not run under the no-live-mutations instruction. The local suites do not replace that end-to-end gate.

## Required before teammates use it

1. Complete remaining build/visual/performance checks and review the final candidate diff. No blanket baseline update to hide visual failures.
2. Approve a bounded release branch/commit and shared deployment target. Prefer a protected preview for team acceptance before production; preview must have working sign-in callbacks and appropriate environment configuration. Never copy or expose secret values.
3. Verify each intended teammate already has their own account, correct staff capability and organization assignments. Current roster and read-only auth checks confirmed Caleb (developer), Joel, Paula and FS (coach); all four accounts are email-verified and enabled. A fresh staff query found no Frank account in platform staff; access must be resolved explicitly. Joel, Paula and FS each have 54 assignments; Caleb has zero assignments and developer scope. Do not share Caleb's session or credentials.
4. Explicitly authorize one named acceptance organization and reversible live test records, or provide an isolated Supabase environment. Run coach/admin create → assign → edit → complete → refresh → second-session visibility, unassigned-organization denial, concurrent edit rejection, and document upload/edit/download.
5. Verify Google OAuth using each teammate's own connection only if included in the presentation. Existing connected status is not a completed provider canary. Do not toggle sync or create calendar/Drive data merely for a screenshot.
6. Share the verified URL only after access and persistence acceptance. Invitations/messages require explicit authorization.

## Team walkthrough

1. Sign in through the team login; open `/admin/dashboard`.
2. Review assigned organizations, open projects and personal tasks. Explain that the heatmap counts recorded events by UTC day, not every interaction.
3. Open Organizations, then a real organization; show its assigned coaches and core documents.
4. Open Projects; search, inspect workstream dates and tasks. Create only the approved rehearsal project.
5. Assign a task; verify it appears in that coach's single task list after refresh.
6. Show Tools and personal Calendar/Drive connection controls without changing provider data.

## Rollback and continuation

Keep the previous successful deployment available. Revert the deployment if login, authorization, persistence or document access fails. Do not reverse shared-option data migrations or delete team records as a code rollback. Preserve the exact tested candidate and logs for comparison.

Continuation: finish gates below; prepare the reviewed release candidate; ask for the specific release and live-canary authorization only after the result is concrete. Do not call the system fully operational until shared URL and multi-role save/reload checks pass.

## Final gate evidence

- Final production build passed after the staff picker correction: `/tmp/team-ready-final-build.log`; final TypeScript and 11 person/guided/coach tests also passed.
- Performance budgets passed: `/admin` 999.7 KB after deferring access lists; `/` 1848.7 KB, `/community` 607.5 KB. Actual authenticated access lists verified after the change.
- Full acceptance: 2,855 passed, one skipped. Static gate: all 16 stages passed. Nine isolated PostgreSQL suites passed.
- Complete development visual run: 150 passed, 11 failed. Failures were stale macOS references for previously approved Marketplace/Brand Identity/shared Dialog changes and two pre-hydration keyboard checks. Reviewed actual/diff images; updated only affected references. Targeted rerun passed all ten corrected checks, then the final two Marketplace People references were refreshed after confirming loaded coach photos. Final verification: all 12 targeted cases pass without baseline updates (`/tmp/team-ready-visual-verified.log`). Combined with the 150 passing full-run cases, every one of the 161 visual scenarios has passing evidence; this is not a single clean full rerun. Production intentionally excludes three fixture routes; production-mode failures there are not product route failures.
- Baseline rationale: document-import 390px and four conflict-dialog references follow the existing shared dialog padding/alignment/close-control changes. Six Documentation references reflect approved 34-resource Marketplace/search content and the narrow Brand Identity layout; two People references reflect its approved Marketplace layout. Original Linux references and screenshot tolerances unchanged.
- Full live RLS and multi-account write/reload acceptance remain unrun under the standing no-live-mutations restriction. Shared deployment is not approved or published.


## Final authorization boundary

Local checks are complete, but shared release is not approved. The next bounded action is an isolated release candidate/PR review plus controlled live acceptance, followed by a protected `coachhouse` preview only after required gates pass. Preserve this dirty worktree and exclude unrelated changes during candidate review.

The remaining remote RLS runner creates eight timestamp-suffixed synthetic users, scoped organizations/projects/course records and test storage objects, then deletes its fixtures. An unexpected exception can bypass its normal cleanup; record exact created IDs and verify cleanup explicitly, without deleting older fixtures or real team records. Prefer an isolated Supabase target; otherwise explicit live-test authorization is required. No new paid service is proposed; existing database/hosting usage applies. Do not change Google connections or real team records as part of testing.

Frank's intended email remains unanswered. Caleb, Joel, Paula and FS are existing enabled, verified accounts; that does not establish successful multi-account login/persistence on the new deployment. No team invitation has been sent.

Final Graphify source refresh completed: 20,192 nodes / 58,231 edges (`/tmp/team-ready-graphify-picker.log`). Dashboard desktop evidence is `/tmp/team-ready-dashboard-desktop.png`. Browser restored to the admin dashboard; own test server on 3002 stopped, user's server on 3000 retained.

## September 20 release continuation

Release and disposable live acceptance are now authorized. The active candidate and current evidence are tracked in `2026-09-20-internal-tooling-release.md`; earlier approval and Frank-email blockers above are historical. Frank supplied an email but has no account; invitation email authorization remains separate.
