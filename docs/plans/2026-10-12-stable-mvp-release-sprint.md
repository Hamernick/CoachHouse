# Stable MVP release sprint

**Closed by Caleb on October 12, 2026.** Remaining follow-ups are tracked in his separate to-do list; its location was not supplied. PR [#288](https://github.com/Hamernick/CoachHouse/pull/288) merged as `73dd8d15`; the canonical `coachhouse` Vercel deployment reports success. Migration `20261012163000` was applied and verified. This closes this workstream, not every verification gap: final PR visual/quality checks failed, the secondary Vercel project failed, and authenticated signup/payment/unlock verification remains unconfirmed. Do not resume historical tasks below without a new request. The connected planner remains abandoned.

The remainder of this document is historical evidence, not an active task queue.

Status: release integration in progress; not deployed. Scope: all retained work from this internal UI/onboarding conversation. Latest user decisions supersede older design and free-access notes. This plan prioritizes reliable completion and payment over further polish.

## Verified starting point

- Source lane: `feat/rapid-ui-ux-20261007`, localhost:3001. Preserve it and other active checkouts. At inspection:203 tracked changes,62 untracked paths;1 commit ahead/14 behind origin/main. Main was verified at `d159d722`; refresh again before integration. No release PR exists for this lane.
- Supabase link works in `/Users/calebhamernick/Development/coach-house-platform`, project `vswzhuwjtgzrkxknrmxu`; a read-only remote migration list succeeded. The internal source worktree is separately unlinked.
- Remote history has253 migration versions. Our `20261012163000_gate_free_workspace_document_writes.sql` is absent and is the only source-lane migration not recorded remotely. No database changes were performed.
-15 remote migration versions are absent from current origin/main:20260904220000,20260914180000,20261010100000,20261010120000,20261010130000,20261010140000,20261010150000,20261010160000,20261010170000,20261011090000,20261011100000,20261011110000,20261011120000,20261011130000,20261012160000. Reconcile provenance and schema compatibility before using a release migration command; do not reset or rewrite remote history to match an old checkout.
- Existing focused evidence:40 billing tests pass,44 launch/Accelerator tests pass,15 team-access tests pass. Scoped types/lint pass for latest changes. These are not a complete current-main release or end-to-end billing signoff.

## Shipping scope

Carry forward the retained signup/profile/username flow, Google metadata prefill and workspace landing; sidebar/navigation and upgrade overlay; observational responsive guide and completion; organization/activity cards and inline paid launch editor; People table/header/searchable roles/segments/drag-and-drop; drawer layout; Accelerator lesson routing/progress; publication and globe changes; and free/paid access controls.

Keep free workspace/profile/program/People/tool/Drive-link flows working. Native document editing/storage, roadmap editing, team access and Accelerator capabilities use their respective server entitlements. Free users see paid previews; Build your nfp forms stay locked. Existing native documents stay readable; no complimentary credits for new free accounts. Preserve legitimate prior purchases and role limitations.

The abandoned connected planner stays removed. Do not import another chat's canvas-rail features or public-map redesign. Preserve already merged fixes and existing approved UI. Only fix release blockers and concrete regressions; no new designs/features during the sprint.

## Execution order and exit gates

### 1. Preserve and assemble one release candidate

- Create a recoverable snapshot/manifest of tracked and untracked source changes, including assets and migration/test files; exclude credentials, caches and unrelated local files.
- Create an isolated release worktree from refreshed main. Port the full retained conversation scope in reviewable commits, reconciling the ahead commit with already merged PR276 and preserving main's auth, signup, scrolling and map fixes.
- Inventory each changed path as included, already shipped, or unrelated/preserved. Do not bulk-copy the old repository or replay main-only migration deletions.
- Open a draft release PR early. Keep localhost:3001 undisturbed until the candidate is ready for the final review pass.
- Exit: complete scoped diff, no lost work, no accidental unrelated migration/code deletion, one reproducible candidate revision.

### 2. Make paid activation reliable — highest functional priority

Owners: `src/components/paywall/**`, `src/app/api/stripe/checkout/route.ts`, `src/app/(public)/pricing/success/**`, entitlement readers and Stripe webhook persistence.

- Retain the selected organization and exact workspace return URL, including drawer/guide context, across checkout and cancellation.
- Check returned database errors and thrown errors; only claim features are activated after durable subscription state is verified. Existing success-on-sync-failure tests must change.
- For a paid checkout awaiting subscription/webhook persistence, show a clear activation-pending/retry state. Recheck the same owned session; never send the user to pay again just because activation is delayed. Bound retries and provide a recoverable outcome if the provider/database remains unavailable.
- Align active/trialing/past_due/incomplete handling with feature access rules. A success marker alone must never unlock a feature.
- Ensure all workspace/sidebar/server/client consumers resolve the same organization's updated entitlement after return. Reload must retain access. Keep webhook processing idempotent and handle duplicate/delayed events without duplicate benefits.
- Show cancellation/errors visibly after the local pricing overlay unmounts, with a route back to the same workspace and a safe retry.
- Exit: focused regressions prove persistence failure, delayed/missing subscription, wrong session owner, selected-org isolation, canceled/incomplete payment and repeated return behavior; normal paid return unlocks Documents, Accelerator and team access.

### 3. Reconcile and validate the database change

- Identify the15 remote-only migrations and recover their source/provenance without changing unrelated workstreams. Compare relevant live schema/policies/triggers with the candidate to detect overlap with `20261012163000`.
- Link the isolated release worktree to the verified project when needed; linkage is checkout-local. Obtain a migration dry-run that names only approved unapplied changes. No broad push from the old root or UI worktree, no migration repair/reset just to silence mismatch.
- Run the candidate migration and existing RLS fixtures in isolated PostgreSQL. Verify free reads, profile edits and Drive links; blocked native writes; paid writes; cross-org isolation; downgrade and revocation. Test compatibility with the currently deployed app as well as the candidate.
- Prepare explicit forward/rollback SQL and record expected policy names. Retain data and security restrictions during application rollback; do not casually drop paid-access protections.
- Exit: approved migration set and exact ordering documented; no unaccounted schema conflicts. Apply only in the coordinated release window after the candidate gates pass.

### 4. One focused full-flow acceptance pass

Use a fresh free organization and an existing paid organization. Preserve the user's earlier valid reviews; repeat only affected paths.

| Journey | Required result |
| --- | --- |
| Email signup/confirmation and Google entry | Correct compact onboarding, required unique handle, saved profile, correct workspace landing; no internal map detour |
| First workspace load and guide | Sidebar open, drawer closed/Organization default, no fiscal card; guide targets visible, pricing overlay unblocked, finish clears guide URL and recenters |
| Free account | Paid controls stay visible but inaccessible by pointer/keyboard/direct action; native documents readable; profile/People/Drive/tool flows usable; zero free coaching credits |
| Upgrade from workspace | Stripe test-mode payment -> verified activation -> same workspace/context; paid forms, documents, lessons and team actions work; reload retains access |
| Payment recovery | Cancel, failed/incomplete checkout, delayed webhook and database error recover without misleading success or duplicate payment |
| Existing paid account | No reset of organization/layout/progress; lessons open the selected lesson; saved edits, uploads and team roles remain correct |
| People/drawer/publication | Same table on small screens, reachable toolbar, pinned cells and drag/drop; drawer handle reachable; paid publication explicit and saved state truthful |

Run the critical UI pass on desktop and one narrow mobile viewport, with light/dark and keyboard/reduced-motion checks focused on changed controls. User remains the appearance reviewer; direct automated browser access previously encountered a restriction and must be available through an authorized surface before claiming browser evidence. Stripe test mode must be explicitly verified before submitting payment; no real charge as an incidental test.

Exit: all critical journeys pass; no unresolved blank pages, update loops, data loss, unauthorized writes, paid-but-locked states, or inaccessible primary controls. Log nonblocking cosmetic follow-ups separately without reopening approved design.

### 5. Required CI, coordinated release, production smoke

- Run targeted development checks as fixes land. Use the required hosted static, acceptance/snapshot, RLS, build and visual lanes on the final PR revision; aggregate `quality` and branch-protection requirements must pass. Resolve known stale tests/type fixtures; do not waive unrelated required failures. Update only reviewed affected visual baselines.
- Confirm production Stripe prices/mode/webhook configuration and database target without exposing secrets. Record the rollback deployment and migration strategy.
- Choose migration-before-app only if current-app compatibility passes; otherwise stage a compatible rollout. Apply the reviewed migration, verify its remote history and enforcement, then merge/deploy through the normal release process. Do not let automatic deployment outrun the required database step.
- Verify the production deployment serves the merged revision. Smoke-check login/workspace, free restrictions, existing paid access and checkout return configuration; verify provider events/entitlements for an authorized canary. Keep real charges outside incidental smoke testing.
- Exit: merged revision, successful deployment, applied migration receipt, passing critical production checks and rollback reference recorded. Only then call the MVP shipped.

## Immediate next action

Snapshot and assemble the current-main release candidate, then fix activation persistence/recovery first. Work through this sequence without additional design rounds or broad repeated testing. No production migration, payment, merge or deployment was performed while making this plan.

## Release candidate checkpoint

- Release lane: `feat/stable-mvp-release-20261012` at `/Users/calebhamernick/Development/coach-house-platform-mvp-release-20261012`, based on current main `d159d722`. Source localhost:3001 remains untouched.
- Recoverable snapshot: `~/.local/share/coach-house/worktree-backups/mvp-release-20261012T181202Z/` contains tracked binary patches, changed/untracked files and hashes for320 paths.
- Three-way integration resolved10 conflicted files. Retained main onboarding scroll-chain and auth/Find fixes; kept latest workspace-on-Free, inline onboarding, activity targeting and publication-withdrawal behavior. Main-only migrations remain present. All retained source additions were copied without collisions.
- No previously agreed features are excluded by scope freeze. Only the abandoned connected planner and other-chat public-map redesign/canvas-rail work are outside this release.


## Activation and migration checkpoint

- Checkout success now requires a saved active/trialing subscription. Returned database errors and missing subscription expansion show bounded retry/recovery, not a successful unlock. Inactive subscriptions show billing recovery. Checkout creation fails closed when the selected organization cannot be resolved; setup errors reopen pricing with the original return context. Backslash/control-character return paths are rejected.
- Focused billing/return/overlay/webhook checks: 45 passing before the final JSX lint adjustment; focused lint passes after moving recovery rendering outside try/catch. The selected organization is covered separately from the buyer.
- Recovered 15 remote-only migration files directly from linked Supabase history. These represent already-applied schema, not new feature deployment. Linked `db push --dry-run` lists exactly `20261012163000_gate_free_workspace_document_writes.sql`; nothing was applied remotely.
- A migration-fetch command accidentally targeted the root checkout after temporary-folder preparation failed. Fetched content was archived, tracked migration files restored from the index, and only files newly created by that fetch removed using filesystem creation times. Root migration status is clean; source preview was untouched. Recovery archive: `/var/folders/l2/jpghvb_52t10fnrzxcs0bpd40000gn/T/mvp-remote-history-2j63adjp`.
- Full TypeScript check after Next route generation reports 124 diagnostics, mostly stale test fixtures; two application errors identified and corrected (document fixture entitlement, documentation workspace navigation). Remaining type/CI failures are release blockers, not waived. Browser/payment/provider verification remains open.


## Current CI checkpoint

- Release PR #288, candidate `62c017d0`: hosted static and RLS pass. Local document safety28, repaired acceptance96 and billing/return focused cases pass. The webhook test now imports a second application module; regenerated acceptance project classification so the required inventory guard can run the full suite.
- Previous visual run had127 passed/26 failed. Public fixture/selector/reference fixes are being reviewed independently in #289; do not duplicate or revert that lane. This release still needs its internal shell/Tools references and keyboard-focus case reviewed. No screenshot threshold was weakened.
- Public map curation remains available to platform admins; ordinary members still land in Workspace. Original source preview remains untouched. Required quality and browser/payment/rollout gates remain open.

## Coordinated rollout and recovery

1. Require passing `quality` on the reviewed PR head and finish the authenticated Stripe test-mode return/unlock check. Confirm test mode before payment; the locally configured primary key is live. Do not claim a webhook canary without a configured test endpoint/forwarder.
2. Immediately before deployment, rerun `supabase migration list --linked` and `supabase db push --linked --dry-run` from this release checkout. Target must be `vswzhuwjtgzrkxknrmxu`; the only pending migration must be `20261012163000_gate_free_workspace_document_writes.sql`. Stop if either differs.
3. Record the current production deployment ID/SHA as the application rollback target. Apply the reviewed migration in the same release window, then verify its history and the policies/trigger below before releasing application code. Existing rows are retained; no backfill or destructive data change is required.
4. Merge only after required checks and branch protection pass. Verify Vercel is Ready for the actual merged SHA; run free/paid access and checkout-return checks against that deployment.
5. If the application regresses, restore the recorded prior deployment and retain the migration's restrictive policies. Do not drop the paid-access restrictions as a routine rollback. A schema defect needs a separately reviewed forward correction preserving free read access and paid write authorization; keep the application release blocked until corrected.

Read-only migration verification (expected: one history row, eight restrictive policies, one enabled trigger):

```sql
select version from supabase_migrations.schema_migrations
where version = '20261012163000';

select schemaname, tablename, policyname, permissive
from pg_policies
where policyname in (
  'document_storage_paid_insert', 'document_storage_paid_update', 'document_storage_paid_delete',
  'document_library_paid_insert', 'document_library_paid_update', 'document_library_paid_delete',
  'workspace_collaboration_paid_insert', 'workspace_collaboration_paid_update'
)
order by policyname;

select tgname, tgenabled from pg_trigger
where tgrelid = 'public.organizations'::regclass
  and tgfoid = 'public.guard_free_workspace_documents()'::regprocedure
  and not tgisinternal;
```

Current evidence: renewal-date compatibility is covered by49 focused tests; read-only local Stripe configuration checks confirm active Organization/Operations Support prices in live and test modes and an enabled live webhook. These are not a completed checkout canary or verification of Vercel's deployed secrets. No production migration, transaction, merge, or deployment was performed by this release lane.

## Applied migration receipt — 2026-10-12T20:17:53+00:00

The user explicitly authorized applying the access-control migration before remaining visual/browser gates. Production project `vswzhuwjtgzrkxknrmxu` now records `20261012163000_gate_free_workspace_document_writes.sql`. Verified eight restrictive policies, one enabled guard trigger and RLS on all protected tables. Existing data was retained. The two unapplied fiscal migrations (`20261010090000`, `20261010180000`) were excluded using an isolated CLI migration directory and remain outside this application.

PR #288 is ready for review, not draft. It is not merged: visual CI has six failures (three Documentation, three Tools), with146 passing and one flaky mobile test. Acceptance, static, RLS and build pass. Application deployment, authenticated upgrade verification and live production UI verification remain outstanding. Earlier pending-migration statements above are historical checkpoints, superseded by this receipt.
