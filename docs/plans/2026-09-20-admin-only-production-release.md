# Admin/coach-only production release

## Approved scope

User explicitly requested production admin/coach tools only, preserving production public pages. Start from production/main `d88a09431d474c8b4b13eeb102a63fba209546f9` in isolated `feat/admin-tools-production-20260920`. Preserve dirty development and rejected release worktrees. PR #241 remains draft and must not merge: its broad development baseline contained unapproved public changes.

## Implementation

Port the reviewed internal dashboard, Organizations/Projects/Tasks, guided project creation, shared project options, assignment filtering, revenue/coaching statistics, document editing/activity, and required Calendar/Drive services. Keep the client-only dashboard import boundary. Retain scoped database authorization and developer-only management authorization.

Adapt existing shared avatars with optional data/overflow props, preserving default rendering. Add Calendar branding without changing existing Tools catalog. Hide the mobile navigation only on `/admin/dashboard`. Navigation changes expose staff-only dashboard grouping; retain production public resource links.

No changes to public routes, public assets, global styles, shared UI primitives, dependency lockfile, or public screenshot baselines. No Marketplace, Documentation, Particles, Brand Identity, or general mobile-navigation redesign. Node 22 is consistent across package metadata and CI. Add isolated RLS suites for document files/activity and Calendar.

## Validation and continuation

Full quality gate running; candidate is uncommitted and not deployed. Record final checks and public-boundary evidence here before publishing. Production/main still at d88a0943. Shared team access must be verified on this narrow candidate; earlier broad-candidate checks are supporting evidence only. Do not send invitations. Code-owner review and all required checks remain mandatory.

## Checkpoint: scoped validation

- 237 selected files, about 14,600 insertions, versus 1,000 files / 84,811 insertions in rejected PR #241. All public routes, assets, UI primitives, global CSS, public visual tests/baselines, Next config and lockfile have zero diff against production d88a0943.
- Static checks and snapshots passed. Targeted 286 internal checks pass after a custom-avatar fallback adaptation. Full acceptance first pass: 2,526 passed, one outdated fiscal-tab contract failed; corrected to assert the requested dedicated tab and real schedule component, then its three tests passed. The complete union is rerunning.
- All isolated and live RLS suites passed; standalone production build passed. No TypeScript application errors. Full quality run continues.
- Graphify extraction/clustering finished: 17,665 nodes, 50,498 edges, 970 communities.
- The feature contract now recognizes explicit `/client` entrypoints, preserving the fix for the reported inline Server Action import failure. Public document-screen tests from the broad candidate were not adopted; only relevant file API/quota/retention assertions were retained. No existing production test was removed.

## Release-candidate verification

- Replacement draft PR #242: https://github.com/Hamernick/coach-house-lms/pull/242. First head e9f4ce20 passed local/hosted static, acceptance, RLS, build compilation and all 45 production visual cases; no baselines changed. The performance check alone failed: admin shell 1001 KB against the unchanged 1000 KB limit (public shell 1825.5/1975 KB; community 607.4/900 KB).
- Follow-up loads the staff-only navigation group separately with React lazy/Suspense; ordinary public navigation retains its synchronous production rendering. Streaming SSR navigation test retains all active-link/accessibility assertions; 17 navigation checks pass. Full gate is rerunning for the final bundle measurement. No budget relaxation.
- Production-mode local browser rehearsal: assigned coach sees one assigned organization, one standard project and one personal task; completion persisted after full reload. Workstream shows the five-day Sep 21–25 task. Mission edited/saved/reloaded and exact content retained. 390px Dashboard has 390px document width and no mobile Find bar. Existing signed-in admin dashboard read-only also loaded.
- Temporary-file API canary passed upload/list/download/trash/restore/permanent removal; storage cleanup verified. Disposable owner/coach and organization/project/tasks removed afterwards. No real organization changes, invitations or Google authorization/activation. Google Calendar is unavailable in local environment; new OAuth consent/provider synchronization remains unverified.
- Graphify update completed 18,044 nodes / 50,815 edges / 1,039 communities. Production remains d88a0943; required code-owner approval still applies.


## Final verified release handoff

- Active release: `feat/admin-tools-production-20260920`, clean and pushed at `ea87f4649979f92090037445e9603d7c40fa5c2d`, worktree `/Users/calebhamernick/Development/coach-house-platform-admin-release-20260920`. PR #242 is ready for review: https://github.com/Hamernick/coach-house-lms/pull/242. PR #241 is closed as superseded; its worktree/branch remain preserved.
- Full local `PLAYWRIGHT_PORT=3005 pnpm check:quality` passes all 21 stages in 425.25 seconds. 2,527 acceptance passes/one existing skip; 45 visual passes; static/snapshots/RLS/build/performance pass. Hosted aggregate quality also passes at the exact head, CI run 35545290183. Admin 998.7/1000 KB; public shell local 1823.2/1975 KB and hosted 1822.5/1975 KB; community 607.4/900 KB. No budget or baseline relaxation.
- Public routes/assets/global CSS/UI primitives/public feature files/visual tests/Next config/lockfile have zero diff against production d88a0943. Final optimized staff navigation also verified in the production-mode browser.
- Cleanup independently verified: zero disposable auth accounts/orgs/projects/tasks/document files; uploaded storage object removed. Temporary servers 3005/3006 stopped; original localhost:3000 PID63902 preserved. Graphify final update completed: 18,045 nodes, 50,816 edges, 1,028 communities.
- **Production not released:** main remains d88a09431d474c8b4b13eeb102a63fba209546f9. GitHub reports REVIEW_REQUIRED/BLOCKED; branch protection requires one code-owner approval, and `.github/CODEOWNERS` names @calebhamernick. No bypass. After that review, recheck the exact approved head and required checks, merge normally, verify the production deployment and authenticated admin routes, and confirm public preservation. Release authorization already exists.
- New Google OAuth consent/provider synchronization remains unverified; no providers activated or invitation emails sent. Do not invite Frank; the user will share signup. Original dirty root/public designs remain untouched except these additive handoff notes.
