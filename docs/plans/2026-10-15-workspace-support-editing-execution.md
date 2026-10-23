# Workspace support editing — worker execution contract

**Status: execution authorized; in progress.** Caleb explicitly instructed ‘get to work’ after reviewing this plan. This file is the ordered implementation checklist; [the design](2026-10-15-workspace-support-editing-design.md) supplies the product rationale and UI contract. Read both. Neither historical test counts nor a merged incident PR completes this plan.

## A. Assignment and completion boundary

Build one reliable, coherent support-editing workflow. Caleb, Joel, Paula and the existing fs@coachhouse account must be able to select any organization they are authorized to support, open its native roadmap documents, edit them, save, and reopen the persisted result. This applies to free and paid target organizations and all three existing entrypoints:

1. Workspace → Accelerator → Strategic Roadmap → Origin and other roadmap sections.
2. Standalone workspace roadmap document URL.
3. Admin organization → assets/core-document dialog.

Preserve actual actor identity, grant revocation, explicit organization scope, customer content, versions, formatting, collaboration and existing ordinary-member restrictions. No impersonation, permanent membership insertion or subscription upgrade is needed for support editing. No new billing/ownership/platform permissions are included.

Search, switch, open, save, presence, offline recovery and error presentation are part of this assignment. A drawer permission override alone is incomplete. A timeout with Retry alone is incomplete. Rendering an enabled toolbar without proving text entry and persistence is incomplete.

Deliverable: one integrated, reviewed-local-code PR with evidence and any explicitly unresolved external conditions. Caleb owns hosted checks/review, merge, deployment and production verification. Do not poll CI, merge, deploy, activate flags or alter live grants/data unless separately instructed. Do not interpret that division of work as permission to omit local integration tests.

## B. Required reading and preserved state

### B1. Read in this order

Reuse already-read context within the same uninterrupted session; a new worker must read these sources.

1. `AGENTS.md` in the actual implementation checkout.
2. `docs/RUNLOG.md`, latest entries in its current linked monthly log, then `docs/agent/open-work-index.md`.
3. Original-plan root selected by `AGENTS.md`: `WORKSTREAMS.md`, complete `04-workspace-documents-integrations.md`, complete `04a-coach-admin-coediting.md`, and `SHIP.md`.
4. `docs/SHIP.md` and its referenced current shared claim. Preserve the recorded SHIP40 ownership discrepancy; do not seize or rewrite historical claims to start an unrelated release.
5. `docs/agent/workflow-quality.md`, `docs/agent/code-structure.md`, `docs/agent/architecture-security.md`.
6. `docs/design.md`, `docs/agent/ui-rubric.md`, `docs/agent/react-grab-execution-contract.md`, `docs/agent/workspace-presentation-runbook.md`.
7. `docs/agent/graphify.md` and applicable installed Graphify instructions. Query the existing graph before broad source exploration; update after runtime changes.
8. `docs/plans/2026-10-14-workspace-support-overlay-and-roadmap-error.md` for incident facts, then the design and this execution plan.
9. `src/features/organization-workspace-support/README.md` and `src/features/organization-document-collaboration/README.md`. Treat their implementation descriptions as historical until verified; update them at closeout.

### B2. Starting checkout

Recorded implementation checkout:

`/Users/calebhamernick/Development/coach-house-platform-tiptap-hotfix-20261015`

Recorded branch: `fix/support-roadmap-edit-access-20261015`; recorded base: `0fd6b05d`.

The root `/Users/calebhamernick/Development/coach-house-platform` is a separate preservation checkout. Do not edit/reset/clean it or alter shared `.env.local`/dependency symlink targets. Ports and `.next` directories are checkout-owned, not isolated merely by port number.

At plan creation, uncommitted runtime evidence exists:

- Modified workspace roadmap panel adds the local support-mode override.
- `tests/acceptance/workspace-roadmap-support-editing.test.ts` is new.
- `tests/acceptance/organization-document-collaboration-access.test.ts` has two additional access cases.
- `tests/acceptance/projects.json` includes the new test.
- Planning/runlog/index files are modified/untracked.

The panel regression failed three cases before the override and the five-file focused run passed45cases after it. These are scoped facts, not proof of a complete working feature. Preserve them; incorporate or supersede the override deliberately under the shared capability model.

PR315 search transport is already on the recorded main at `27309aa7`; PR314 switching is already at `9784757b`. Inspect fresh main before changing those features; do not replay either patch.

### B3. Startup procedure

1. Run `git status --short --branch`, inspect this branch's upstream, recent commits and relevant worktrees. Avoid dumping every historical branch.
2. Inspect listeners and process cwd for this checkout before using/stopping a server. Preserve unrelated servers.
3. Record the exact baseline SHA, dirty files and active server ownership in the execution evidence document below.
4. Fetch normally, compare main changes, and reconcile only this task's relevant differences. Never reset away uncommitted changes or stash unrelated files silently.
5. Continue this isolated lane if still available and owned. If unavailable, report the condition and select an isolated replacement under the repository branch protocol; preserve the old lane first.
6. Use Node22. On this machine the known binary directory is `/Users/calebhamernick/.nvm/versions/node/v22.13.0/bin`; verify `node --version` and package requirements. Do not use Node26 by accident.
7. Do not reinstall dependencies or duplicate the repository unless required by an actual missing dependency or isolation problem.

## C. File map — verified existing paths

Paths in this table are existing source owners, not a license to edit every file. Keep a changed-file inventory tied to the numbered steps.

| Area | Existing files | Read/change purpose |
| --- | --- | --- |
| Support grants/scope | `src/lib/organization/support-access.ts`; `src/lib/organization/active-org.ts`; `src/server/organization/request-scope.ts`; `src/lib/supabase/server.ts` | Live grant and selected-org checks; session client request scope. |
| Layout-provided scope | `src/app/(dashboard)/layout.tsx`; `src/components/app-shell/dashboard-layout-state.ts`; `src/components/app-shell/dashboard-layout-state-types.ts` | Server-derived actor/org scope and provider placement. Keep routes composition-only. |
| Scope wrapper | `src/features/organization-workspace-support/components/workspace-organization-scope.tsx`; `src/features/organization-workspace-support/lib/index.ts` | Current global fetch wrapper and support-mode context; cross-tab and explicit-document targeting. |
| Search | `src/features/organization-workspace-support/hooks/use-workspace-support-search.ts`; `lib/search-transport.ts`; `routes.ts`; `server/actions.ts` under that feature | Existing bounded search; preserve debounce, pagination, identities and stale-result suppression. |
| Switch | `src/features/member-workspace/components/shell/member-workspace-org-switcher.tsx`; `member-workspace-org-switcher-list.tsx`; `member-workspace-sidebar-header.tsx`; `src/features/member-workspace/lib/switch-organization.ts`; `server/organization-switch.ts`; `server/actions.ts` | Pending UI, target authorization, audit/cookies and navigation/unsaved guard. |
| Workspace presence | `src/features/organization-workspace-support/hooks/use-organization-workspace-support-controller.ts`; `server/actions.ts`; `components/organization-workspace-support-panel.tsx`; `types.ts` | Existing unbounded heartbeat and raw sidebar error. |
| Document access | `src/lib/organization/document-access.ts`; `src/lib/organization/document-storage-access.ts`; `src/features/organization-document-collaboration/server/context.ts` | Shared access policy and authenticated write validation. |
| Document transport | `src/app/api/account/document-collaboration/route.ts`; `src/features/organization-document-collaboration/{index.ts,client.ts,routes.ts,types.ts}`; `server/route.ts`; `lib/transport.ts` | Composition, JSON boundary, typed outcomes, aborts and request scope. |
| Document persistence | `src/features/organization-document-collaboration/server/actions.ts`; `lib/index.ts`; `lib/schema.ts`; `lib/serialization.ts` | Current sync action, step application, bootstrap/schema and plain JSON. |
| Editor lifecycle | `src/features/organization-document-collaboration/hooks/use-organization-document-collaboration-controller.ts`; `components/organization-document-collaboration-panel.tsx`; `components/document-draft-recovery.tsx`; `components/document-version-history.tsx` | Open/init/poll/save/retry, visible state, pending changes and recovery. |
| Tiptap | `src/components/rich-text-editor.tsx`; `src/components/rich-text-editor/extensions.ts` | Actual contenteditable behavior, onReady, schema compatibility and formatting. |
| Standalone editor | `src/components/roadmap/strategic-roadmap-editor-page.tsx`; `src/components/roadmap/roadmap-shell.tsx`; `src/app/(dashboard)/workspace/roadmap/[slug]/page.tsx` | Same capability contract outside the drawer. |
| Shared roadmap editor | `src/components/roadmap/roadmap-editor.tsx`; `roadmap-editor/hooks/use-roadmap-editor-state.ts`; `use-roadmap-editor-draft-persistence.ts`; `roadmap-editor/components/roadmap-editor-shell.tsx`; `src/components/roadmap/core-document-source/use-core-document-source.ts` | Legacy autosave/metadata/Drive and draft interactions with collaboration. |
| Workspace drawer | `src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-overlay-roadmap-panel.tsx`; `workspace-canvas-overlay-drawer-tabs-view.tsx` in that directory | Remove contradictory billing-derived editability; pass target capability. |
| Workspace data | `src/app/(dashboard)/my-organization/_lib/my-organization-page-content.tsx`; `src/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-organization-access-state.ts` | Server capability seed versus unrelated team-management loading. |
| Admin asset dialog | `src/features/member-workspace/components/projects/organization-core-document-editor.tsx`; `organization-documents-panel.tsx`; `member-workspace-project-detail-page.tsx`; `src/features/member-workspace/server/organization-documents.ts`; `src/app/(dashboard)/organizations/[id]/page.tsx` | Explicit target outside the active workspace; shared access/close/save UX. |
| Legacy save actions | `src/actions/roadmap.ts` and its current imports discovered from that file | Preserve authorization and conflict checks for metadata/non-collaborative operations. |
| Diagnostics | `src/lib/logger.ts`; `src/lib/performance/server-timing.ts` | Structured errors and timings; current timing helper requires explicit production enablement. |
| Database contract | `supabase/migrations/20261014160000_core_document_collaboration.sql`; `20261014190000_workspace_support_access.sql`; `20261014203000_workspace_support_search_identity.sql` | Read originals; add new migration if needed, never edit applied history. |
| SQL checks | `supabase/tests/organization-document-activity.test.mjs`; `core-document-collaboration.assertions.sql`; `workspace-support.assertions.sql`; `workspace-support-search.assertions.sql`; associated bootstrap files | Existing ephemeral Postgres runner and access/CAS invariants. |

Relative file names in an area continue the directory explicitly named in that row. Verify an owner before creating a similarly named parallel implementation.

### C1. Planned new files — create only when that step needs them

These do not exist at plan creation. Names are proposed ownership, not claims of completed implementation.

- `src/lib/organization/document-capabilities.ts`: authenticated server capability resolver.
- `src/lib/organization/document-capability-types.ts`: framework-free serializable capability/reason types.
- `src/features/organization-document-collaboration/server/sync-document.ts`: extracted durable orchestration, leaving server actions as wrappers.
- `src/features/organization-document-collaboration/server/presence.ts`: document participant read/update separate from commit response.
- `src/features/organization-document-collaboration/server/diagnostics.ts`: sanitized stage/error tracing.
- `src/features/organization-document-collaboration/lib/editor-state.ts`: typed state transitions/selectors, no React or server imports.
- `src/features/organization-document-collaboration/lib/draft-storage.ts`: versioned, actor/org/document-scoped recovery data.
- `src/features/organization-document-collaboration/components/document-connection-status.tsx`: one shared status/error owner.
- `src/features/organization-workspace-support/lib/presence-transport.ts`: bounded heartbeat transport.
- `src/app/api/account/workspace-support-presence/route.ts` and `src/app/api/account/document-presence/route.ts`: composition-only routes, exported through each feature's allowed public facade.
- `docs/plans/2026-10-15-workspace-support-editing-evidence.md`: concise evidence ledger, no credentials/customer content.
- New tests named in each step below.

If an equivalent existing owner is discovered, reuse it and record the path change in the ledger before implementing. Do not add unused abstractions or a new feature scaffold for this repair of existing features.

## D. Decisions fixed by this plan

1. Keep the existing Tiptap/ProseMirror and CAS/history model. No provider/data-format replacement.
2. Keep operator-managed support grants. No role-name/email shortcut in the UI or server.
3. One server capability contract supplies UI editability for all entrypoints; each operation reauthorizes independently.
4. Durable document reads/commits must not depend on decorative presence success. Required authorization and durable audit remain in the critical operation.
5. Preserve ordinary membership/billing behavior. Support does not fake a paid subscription.
6. No raw support error paragraph in navigation, and no reintroduced support banner/roster.
7. No automatic full-page reload to recover a document; no automatic discard of local work.
8. Keep prior plain-JSON serialization and explicit Tiptap editable synchronization fixes.
9. A response deadline must have an actual terminal state and cancellation/reconciliation behavior. Increasing the deadline is not the performance fix.
10. Do not copy all application status into one boolean or text label. Access, persistence and presence are distinct states.
11. No production writes from tests, impersonation, new privileged accounts in production, emailed invitations or provider changes.
12. Stop at the PR handoff after local proof; preserve all known release gaps in its description.

## E. Step-by-step implementation

Each step requires: prerequisites read; a small file plan; implementation; named evidence; checkpoint. Use the numbered IDs in commits and the evidence ledger. Do not mark a step done just because its files exist.

### STEP 00 — Preserve work and establish the ledger

**Read:** sections A–D; required repo/original-plan references.

**Files:** new evidence document; existing open-work index and current monthly runlog. No runtime change yet.

1. Perform B3 and record branch/base/main SHAs plus current modified files.
2. Record historical incident fixes already on main and their remaining limitations. Do not redo merged search/switch patches.
3. Identify all running processes in this checkout, its dependency/env symlinks, owned port and `.next` path. Do not print secret values.
4. Create the ledger with columns: step, status (`not started`, `in progress`, `passed`, `blocked`), changed files, exact commands/results, evidence paths, unresolved issue and next action.
5. Record the three failing-before panel cases and45passing focused cases as inherited evidence; retain original logs if available. Do not relabel these as full-flow proof.
6. List external gaps separately: current four-account grant read, production failure stage and production verification. A local environment blocker and a production-only gap are not the same.

**Exit:** work is recoverable, lane ownership is clear, and no unrelated files/processes have changed.

### STEP 01 — Reproduce the chain and establish a safe test environment

**Read:** existing visual fixture/config, SQL runner, support/document READMEs, `playwright.fiscal-auth.config.ts` only as an example of isolated authenticated test configuration.

**Files:** evidence ledger; minimal new test setup/spec as needed. Do not reuse fiscal accounts, database or environment variable names.

1. Recheck exact four-account identity/grant/staff/revocation state with bounded read-only requests when permitted. Use stable account IDs from the private original packet; do not guess the full fs address. Keep identifying receipts private and summarize results in repo docs.
2. Set per-request and overall diagnostic deadlines. On timeout, record unknown; do not loop or silently mutate grants to make a test pass.
3. Create/use an isolated local Auth/PostgREST/Postgres environment capable of exercising the actual app route, session cookies and RLS. The existing ephemeral PostgreSQL runner alone is SQL proof, not authenticated app integration.
4. Use disposable fixture identities representing two granted coaches, a granted platform admin, the fourth support account, an ordinary editor, a viewer and revoked/ungranted staff. Real staff passwords/accounts must never be copied into fixtures.
5. Seed only the explicitly disposable local database: free org A, paid org B, native Origin/Budget documents, an existing collaborative session, an uninitialized document and a Drive-linked document. Use synthetic names/text without customer content.
6. Verify the test target hostname/database allowlist before any seed/cleanup. Reject the known production project and reject inherited production env by default. Unknown target means no fixture write.
7. Reuse the actual application routes. No new product-visible preview route, auth bypass or component-only mock pretending to be the full flow.
8. If no suitable local authenticated stack exists, add the smallest test-only config/seed helper and document its dependencies. Do not install/provision a hosted preview or paid service without explicit direction. If setup remains unavailable, continue independent code/unit/SQL work but keep integrated acceptance blocked.
9. Before repair, reproduce the Origin drawer read-only case in the full path and capture the error/status placement. Separately inject stalled presence and document responses in the disposable test environment. Record distinct outcomes.
10. Create a request-stage map: switch → layout/auth scope → capability → document open → bootstrap → typing → commit → acknowledgment → reopen; show where workspace/document presence currently runs.

**Exit:** reproducible local failures and a real authenticated integration target, or a precise named environment blocker. No claim that the production timeout cause is established solely by source inspection.

### STEP 02 — Add diagnostic and error contracts first

**Read:** document `server/actions.ts`, `server/route.ts`, `server/context.ts`; support `server/actions.ts`; logger/timing helper.

**Change:** feature `types.ts`; proposed document diagnostics helper; the existing server operation boundaries; tests `organization-document-transport.test.ts` and a new `workspace-support-diagnostics.test.ts` if needed.

1. Define stable outcome codes for unauthenticated, denied/revoked, invalid scope/input, timeout/unavailable, revision conflict, expired journal and budget conflict. Include retryability and safe request ID; do not send database stacks to the client.
2. Preserve compatibility with current deployed clients' success/error shapes. Add fields before removing old ones. History and existing sync consumers must still work during deployment skew.
3. Generate/validate a bounded request ID at the server boundary; attach operation name and sanitized target identifiers.
4. Measure auth, grant/scope validation, document/session reads, bootstrap, commit and each presence stage separately. Use monotonic durations.
5. Log underlying safe error codes and stage, including whether a durable commit completed. Do not log document content, steps, JWTs, cookies, connection strings or raw arbitrary error payloads.
6. Log failed stages in production without requiring the optional verbose timing flag. Sample routine timing events; do not log every cursor poll as an error or flood logs.
7. Keep route-level timeout, database timeout and revoked permission distinct. A client abort does not prove the server did not commit.
8. Add injected-stage failure tests: denied before DB write; commit succeeds then presence fails; failed DB read; timed-out response; malformed request. Assert public messages are safe and internal evidence identifies the stage.
9. Re-run the local reproduction and record the observed critical path before optimizing it.

**Exit:** each failure is attributable to a stage; no ambiguous catch-all response is the only available evidence. No sensitive body data appears in logs.

### STEP 03 — Unify document capabilities and verify target scope

**Read:** access/scope/layout files in C; document `server/context.ts`; current drawer, standalone and admin-dialog callers.

**Change:** proposed capability types/resolver; `document-access.ts`/`document-storage-access.ts` only as required; all three entrypoint compositions; document server context; scoped-fetch owner if needed.

1. Define a serializable capability snapshot containing actor ID, target organization ID, canView, canEdit, canReadHistory/canRestore as supported, access basis and denial reason. No tokens or elevated client in the snapshot.
2. Resolver input is an already authenticated actor plus explicit target; verify target existence and current access through existing policy. Distinguish granted support from ordinary member role/subscription and existing assigned-staff access. Preserve current access semantics unless this plan explicitly changes them.
3. A verified support editor receives edit capability without the target's paid subscription. Ordinary viewer/free-member rules remain unchanged.
4. Cache only within the same authenticated request where safe. Do not reuse another actor/organization's result or make a long-lived grant cache that masks revocation.
5. The document server uses the same resolver on every read/write. Client-provided capability/support flags are ignored as authority.
6. Seed/return capability for the drawer and standalone page. Replace the drawer's team-management query as the source of editability; it should not need to list invitations/members to edit a document.
7. Admin asset dialog must request capability for its explicit organization, even when the parent layout's active workspace is the admin's own org. Do not rely on the dialog's current default `canEdit=true`.
8. Audit current global fetch wrapper behavior: it overwrites the organization header for same-origin requests. Define/test which calls are workspace-bound and which intentionally target an explicit document. Preserve stale-tab protection for legacy actions without silently retargeting the admin dialog's explicit document request.
9. At the document API, reconcile authenticated actor, requested document target, header/body scope and session metadata. Reject inconsistent/unauthorized scope rather than falling back to the cookie's organization. An intentional explicit-target admin request must be represented unambiguously and reauthorized.
10. Verify switching/returning leaves ordinary membership identity intact; no organization membership is created. Search result role labels never authorize a write.
11. Replace or fold in the inherited local drawer override. Keep regression coverage but do not leave two competing capability implementations.

**Tests:** expand `organization-document-access.test.ts`, `organization-document-collaboration-access.test.ts`, `organization-workspace-support.test.ts`, `organization-switch.test.ts`, `workspace-roadmap-support-editing.test.ts`; add shared resolver cases if useful.

**Required cases:** free/paid org; all support fixture identities; own workspace; no membership but valid grant; viewer; ordinary editor; ungranted/assigned staff per current policy; revoked/banned/deleted staff; missing org; mismatched target; two tabs with different orgs; explicit admin dialog target different from layout scope.

**Exit:** all entrypoints and server writes agree on editability, and grant revocation prevents the next write. UI flags alone cannot broaden access.

### STEP 04 — Resolve authorization versus presence deliberately

**Read:** entire `20261014190000_workspace_support_access.sql`; current grant/search/collaboration migrations; existing SQL assertions. Enumerate all callers/policies of `workspace_support_can_write`, `workspace_supports_org` and support storage helpers.

**Change:** only proven necessary server authorization/policy code; a new timestamped migration if policy changes are necessary; existing SQL runner/assertions. Never modify applied migrations.

1. Write the allow/deny table before editing SQL. Required authority is authenticated live staff grant + valid target scope + permitted document operation + actor-attributed audit. A decorative cursor heartbeat is not a document entitlement.
2. Record the current difference: collaborative document writes authorize through the server and elevated commit path; some direct workspace/storage writes also require recent workspace presence.
3. Choose the minimum coherent implementation for every document action in scope: open, content/metadata save, budget save, image upload/removal and history restore. Do not fix only text while leaving uploads/restore dependent on a broken heartbeat.
4. Prefer routing privileged document mutations through the shared authenticated server policy. Preserve RLS as defense in depth and existing direct member rules.
5. If a direct document/storage policy must replace the15-second heartbeat prerequisite, document its exact replacement conditions and audit transaction. Maintain live grant/revocation, exact org/path scope and allowed operation restrictions. Do not simply turn the predicate into true, grant public/authenticated raw-table access, or permit any staff role globally.
6. Keep unrelated workspace-write policies unchanged unless required for this document chain. Describe any remaining activity dependency accurately in the UI; do not claim all workspace writes are repaired.
7. Add deny cases before allow cases: wrong org/path, no grant, revoked grant, banned/removed staff, anonymous, forged header, stale/missing required scope, arbitrary file deletion and direct private-session-table access.
8. Add allow cases with valid granted support and no decorative presence: document content/history/asset operations that the plan intends to permit; normal paid editor retains rights; ordinary free/viewer restrictions remain.
9. Apply the new migration only inside the disposable local SQL/app test environments. Extend `organization-document-activity.test.mjs` to execute it after existing history and before new assertions.
10. Write migration prerequisites and rollback behavior. Do not revoke live grants, drop history or delete document/session tables for rollback.

**Commands:** `pnpm test:rls:document-activity`; also `pnpm test:rls:document-files` if storage/file policies change. Run only against the local harness target.

**Exit:** permissions no longer accidentally depend on decorative presence for in-scope document operations, with explicit SQL/service authorization evidence. If the design requires materially broader privileges than above, stop and report that decision instead of improvising it.

### STEP 05 — Isolate the durable load/save path

**Read:** complete sync action, schema, step application, commit RPC and history triggers.

**Change:** proposed `server/sync-document.ts`; server action wrappers/context/route; document types/transport; schema/bootstrap helper only if proven necessary; existing server tests.

1. Extract orchestration from the monolithic sync action without changing CAS/history behavior. Retain a compatibility wrapper for old server-action clients and preserve the public route facade.
2. Authenticate/authorize once per operation, then share that verified context with dependent reads/commit. Parallelize independent document/session reads.
3. Return persisted content, revision, capability and compatible collaboration session on open. Existing initialized documents should not need a second serial bootstrap request.
4. For uninitialized sessions, evaluate server bootstrap from canonical saved HTML using the same supported schema. Add parity tests for headings, lists, links, alignment, tables, image attributes and legacy sections before using a server parser. Never bootstrap from an arbitrary client body without expected-revision and scope checks.
5. If server parsing is not proven equivalent, keep the existing explicit bootstrap handshake, give it a bounded typed state, and measure it against the open-to-editable budget. Record the exception; do not silently corrupt content to remove a round trip.
6. Make durable commit plus required audit/history the save success boundary. Once committed, optional participant read/upsert/cleanup failure must not replace success with an unsaved error.
7. Move decorative presence out of this response path using STEP06. Do not launch unawaited network writes inside a serverless request and assume they finish.
8. Preserve original compare-and-swap expectations, generation/version validation, retries on unrelated profile changes, duplicate-delivery acknowledgment and budget conflict response. Validate step/request sizes and sanitized output exactly as before.
9. Make timeout recovery reconcile authoritative generation/version/acknowledgment before resubmission. Test a server commit followed by a lost response; replay must not duplicate text or a budget mutation.
10. Limit cache invalidation to required saved-content consumers, preserving public/profile/history correctness. Do not run broad page work while answering a read/presence poll.
11. Keep same-origin request checks, body validation, no-store behavior and safe errors on all new/changed routes.

**Tests:** `organization-document-collaboration-server.test.ts`, `organization-document-collaboration.test.ts`, `organization-document-transport.test.ts`, `roadmap-actions.test.ts`, `free-document-access.test.ts`; SQL CAS/history suite from STEP04.

**Exit:** a document operation can complete successfully when decorative presence is unavailable; persisted state, history and revision are correct after retry and concurrent writes.

### STEP 06 — Bound and separate presence

**Change:** workspace presence hook/actions/transport/types/routes; document presence server/helper/route; collaboration controller integration. Keep UI work in STEP08.

1. Add same-origin no-store JSON presence routes through allowed feature facades. No direct `server/**` export from a feature root. Reuse authenticated target policy; never accept actor/display role from request data.
2. Preserve workspace activity required by the final STEP04 policy separately from decorative cursor/participant status. Name each state explicitly.
3. Implement one in-flight request per scope, cancellation on unmount/target change, bounded requests, exponential backoff with jitter and capped retries. Reset backoff after success; avoid synchronized retry storms across tabs.
4. Choose/document heartbeat interval and expiry together. Hidden tabs reduce decorative traffic; do not accidentally expire an authorization mechanism still needed for writes. Document state must remain recoverable across visibility changes.
5. Cache actor display metadata per authenticated scope where safe rather than reading profile data on every document poll. Never cache grants across revocation checks to achieve this optimization.
6. Remove per-document-sync global presence cleanup. Use a bounded, indexed cleanup strategy in the presence path or an existing supported scheduler; describe cost and deployment needs. No new provider/scheduler configuration is assumed authorized.
7. Presence failures update presence state only. They do not flip document Saved to Not saved or trigger page reloads. Authorization failures still stop unauthorized operations and must not be downgraded to a harmless presence warning.
8. Preserve server-derived identity and same-page cursor coordinate behavior. Don't reintroduce the previously rejected staff roster/banner.
9. Ensure closing a tab does not block on leave; TTL handles missed leave safely. Keep leave authenticated and scope-bound.

**Tests:** new `workspace-support-presence-transport.test.ts` and document presence tests as needed, plus existing support/access tests. Cover cancellation, backoff cap/reset, one in flight, hidden-tab behavior, stale scope, revoked access, cleanup failure and successful document save during presence failure.

**Exit:** stalled heartbeat cannot indefinitely occupy navigation/actions or prevent otherwise authorized document operation. Presence traffic and retry counts are bounded and measured.

### STEP 07 — Make editor lifecycle and recovery explicit

**Change:** collaboration controller, proposed framework-free editor-state/draft-storage modules, panel, draft recovery/history; shared rich-text/roadmap draft owners only where required.

1. Model access, document lifecycle and presence separately. Define transitions/events rather than coordinating `ready`, `blocked`, `dirty`, `loaded` and generic status text ad hoc.
2. Document lifecycle states: opening, initializing, ready, saving, confirming-save, offline-with-draft, conflict and unavailable. Access can be editable/read-only/denied independently; presence can be available/reconnecting/unavailable.
3. Use a stable identity tuple `(actor, organization, section, generation)` and an operation token/abort controller. A response for an old tuple cannot update the current editor.
4. Keep editor read-only until capability and collaboration initialization are valid. Synchronize actual Tiptap `contenteditable` through the established `setEditable(..., false)` mechanism; enabling access must not emit a fake content update.
5. Guard duplicate onReady/bootstrap effects, including repeated mounts and permission transitions. Unregister/reset collaboration/cursor plugins correctly when replacing a generation. Prove a stale editor cannot send steps into a new scope.
6. Maintain one save in flight. New keystrokes remain queued locally; applying remote steps rebases unacknowledged local work. Never clear dirty state based only on starting a request.
7. Only acknowledged revisions clear pending work. A timeout after possible commit enters confirming-save/reconciliation; it does not discard pending steps or blindly reinitialize from the server.
8. Reuse the existing draft infrastructure only after checking it covers live collaborative typing. The current README explicitly says durable offline restoration is not implemented; legacy `RoadmapDraft` persistence is not proof that current live steps are stored.
9. Implement bounded local recovery for live drafts if necessary: schema version, actor/org/section, base generation/revision, document/budget data, saved-at time and size bound. Validate before restore; never merge drafts across identities/organizations.
10. Handle quota/private-storage errors honestly: keep in-memory work and offer an available export; say “kept in this tab” when no durable local persistence exists. Do not claim browser-close recovery without a successful storage write and test.
11. Preserve restore/discard choices and clear only acknowledged or explicitly discarded drafts. On changed server content, compare rather than silently overwrite.
12. Navigation guards inspect real unsaved text/budget/uploads and unresolved save acknowledgment. Read polling/presence alone must not block switching or closing.
13. Download Draft exists only when there is a valid local copy; export current actual editor/budget data. Before initial load, omit the download action rather than leaving a button that does nothing.
14. Permission revocation locks new edits/writes while preserving recoverable work. Reconnection cannot silently restore a revoked capability.

**Tests:** lifecycle/state transition tests; real Tiptap interaction fixture; scope-switch/late response tests; quota failure and draft restore tests; generation reset; duplicate response; concurrent text and budget operations.

**Exit:** every async branch has a deterministic visible state and recovery action; no infinite Connecting, false Saved, silent draft loss or cross-document response application.

### STEP 08 — Implement the designed status/error surfaces

**Read:** design section6; `docs/design.md`; UI rubric; React Grab ownership contract; actual current sidebar/drawer/dialog composition.

**Change:** `organization-workspace-support-panel.tsx`; proposed document status component; collaboration panel; switcher/list status; existing shadcn primitives only. No new global banner system.

1. Remove the raw `Live support presence is unavailable. Reopen the workspace before editing.` paragraph from sidebar/header and the dashboard fallback. Preserve the necessary controller/provider mount and cursor behavior.
2. Place document state in a reserved compact toolbar/status slot shared by all three editor entrypoints. Reuse current save/status area instead of adding competing indicators.
3. Put search/switch failures inside the switcher popover/trigger feedback; document loading/save/access failures inside the document. Keep the active org name and navigation dimensions stable.
4. Show presence-only degradation in the collaborator/status detail control, low emphasis and nonblocking. Outside a document, do not insert decorative-presence errors into the general workspace navigation.
5. Implement the exact UI state table in the design. Adapt wording only to facts: no unsaved claim without local work, no reload instruction for a transient timeout, no “editing works” statement if authorization is denied.
6. Avoid duplicate error text in toolbar, toast and panel simultaneously. One owner displays the actionable error; details may expose request ID on demand.
7. Keep the last saved content visible when safe during reconnect; clearly distinguish unavailable opening from a loaded document with unsaved work. Do not replace content with an empty editor that looks like data loss.
8. Reserve status height and constrain/wrap detailed notices within the drawer. Keep close/back, formatting tools and primary recovery actions usable at narrow widths.
9. Use existing Button/Popover/Alert equivalents and theme tokens, sentence-case body copy, explicit action labels and meaningful accessible names. No color-only state, tooltip-only critical action or repeating aria-live announcements on every poll.
10. Verify keyboard focus stays in the document during background changes; recovery controls are reachable; closing a notice does not discard a draft; dialogs retain focus trapping.
11. Review both the sidebar-header mount and dashboard fallback mount, plus the full-page and admin dialog layouts. Removing only the visible instance reported by Caleb is insufficient.

**UI cases to capture/review:** opening; ready; saving; presence unavailable while Saved; failed opening without a draft; offline with draft; confirming-save; denied access; actual conflict. Check1440px and390px widths, light/dark themes, normal and long error text. Use the actual app for interactive review. Existing supported Linux visual runner owns baseline updates; do not regenerate Linux baselines on macOS or bypass the environment guard.

**Exit:** no injected sidebar error paragraph/layout shift, no dead recovery controls, no duplicate/conflicting statuses, and actual editing remains available during a decorative-presence outage.

### STEP 09 — Prove the connected workflow, not isolated mocks

**Files:** extend existing acceptance, SQL and rich-text tests. Planned new authenticated application spec/config/helper only if no equivalent exists: `tests/visual/workspace-support-authenticated-routes.visual.spec.ts`, `tests/visual/fixtures/workspace-support-auth.ts`, `playwright.workspace-support-auth.config.ts`. These names are proposed; keep the spec excluded from generic visual discovery unless that runner has the required isolated backend. Do not copy fiscal secrets/config wholesale.

1. Use the actual Next app, normal test Auth sessions, real route handlers and disposable persisted data. No mocked `canEdit=true`, fake save response or in-memory transport in the end-to-end acceptance path.
2. Grant fixtures through the same local database contract; ordinary/denied cases use real restrictions. Keep service credentials solely in test setup/server, never browser payloads.
3. Primary path for each support identity: log in → search target by org/owner identity → select org → confirm target → Accelerator → Strategic Roadmap → Origin → wait for actual editable DOM → type a unique synthetic marker → wait for acknowledged Saved → close/reopen → verify persisted marker.
4. Re-run through standalone URL and admin asset dialog, including an admin dialog whose target differs from the layout's active org.
5. Run free-org and paid-org variants. Assert support sees no upgrade prompt for native editing, ordinary free members retain the existing restriction, viewers never become editable, and granted staff do not become organization members.
6. Enumerate all native roadmap sections from `resolveRoadmapSections` rather than a stale hard-coded list. Verify each opens with correct access; type/save/reopen representative text sections plus Budget, and verify section IDs do not cross-contaminate.
7. Run two authenticated browser sessions editing the same Origin concurrently. Interleave typed content, acknowledge both, reopen both and assert convergence. Verify local undo does not undo the other actor's contribution.
8. Test text formatting/schema fidelity: alignment, link, lists, table, image attributes and budget rows survive serialization/save/reload. Keep the existing real Flight codec regression for legacy action clients.
9. Test presence failure while editing: force only presence transport to fail; assert no sidebar paragraph, editor remains authorized/editable, save/reopen succeeds, and presence UI accurately degrades.
10. Test delayed/failed document opening: loader settles to contained retry; retry loads content; no download button exists before a local copy.
11. Drop a response after the commit in the local test boundary. Verify confirming-save resolves to the committed revision, retry does not duplicate content, and a presence failure cannot change that acknowledgment.
12. Fail before commit: pending data persists locally/in-tab according to tested capability; retry after recovery saves exactly once; reopen verifies text.
13. Revoke the fixture's support grant during editing. Next write fails closed; editor locks and preserves local work. Restoring UI state alone cannot bypass denial.
14. Two tabs: tab A stays on org A, tab B switches to B. Saving in A still targets A; explicit dialog target is also tested. Reject malformed/mismatched requests and stale response overwrites.
15. Test rapid document change, query change, switch clicks and close while pending. Old requests are canceled/ignored; unsaved prompts appear only for actual work, never read/presence polling.
16. Test existing/no session, expired generation/journal, external saved-content replacement, budget conflict and history restore. Verify both saved and local copies remain available when a real conflict requires a choice.
17. Confirm audit/version actor IDs equal the staff fixture that edited, not the customer owner or anonymous/service identity; verify no unwanted public publication.
18. Collect actual evidence: test output, fixture/version IDs, persisted readback assertions, request counts/timings and affected UI artifacts. Redact/remove test credentials from artifacts.

**Important distinction:** authored browser test coverage may run through the repository-supported runner; interactive browser work must follow the session's browser tooling rules. Do not use denied raw production network inspection or another automation tool as a workaround. No customer document mutations for proof.

**Exit:** complete path passes against persisted local data, including multi-session and failure cases. A unit/component fixture pass is insufficient. If the integration target is blocked, report it; do not mark this step passed or call the feature ready.

### STEP 10 — Measure and remove actual bottlenecks

**Prerequisite:** diagnostics from STEP02 and connected flow from STEP09. Measure in production-mode build/runtime using the owned isolated checkout; separate cold starts and development compilation.

1. Ensure no dev process is using the same `.next` output before building. Stop only the worker-owned process after verifying ownership; preserve unrelated checkouts. Record launch/build commands and environment assumptions without secrets.
2. Measure at least20warm samples each for search, switch-to-usable workspace, document-open-to-editable and save acknowledgment. Include failed samples in results. Record data sizes, actor role, target plan, browser/network conditions and cold samples separately.
3. Report p50/p95, request counts, slow stage and timeout count. Browser-visible timing is distinct from endpoint application time and from a dev compile duration.
4. Targets: local feedback<=100ms; warm search p95<=1s after debounce; warm switch-to-usable workspace p95<=2s; document-open-to-editable p95<=2s; save acknowledgment p95<=1s after debounce. Track the existing<500ms server-mutation target separately.
5. Optimize measured causes only: duplicate auth/profile reads, serial independent queries, oversized document/profile payloads, unnecessary invalidation, session bootstrap, presence cleanup and polling frequency.
6. Do not skip authorization, sanitization, CAS/audit or tenant checks to meet numbers. Do not change global budgets or unrelated admin routes to make CI green.
7. Repeat only affected measurements after a substantive optimization. Report remaining target misses explicitly; never turn a long timeout into the advertised performance budget.
8. Exercise a slow/network-loss case separately to prove bounded recovery, without mixing it into the healthy-network performance claim.

**Exit:** evidence meets targets or names exact unresolved bottlenecks. No claim of “fast now” from one warm local sample or a server processing number alone.

### STEP 11 — Validation, docs, review and PR handoff

1. Review the final diff against the file map. Remove obsolete duplicate status/access paths and dead imports; retain compatibility wrappers actually used by old clients.
2. Update both feature READMEs with the final authorization, transport, retry, presence and draft guarantees. Replace the explicit “durable offline restoration is not yet implemented” statement only if STEP07/09 proves it.
3. Regenerate and review the acceptance project manifest after any test changes; every file appears once in the appropriate project. Do not recreate the PR311 manifest omission.
4. Run the focused command groups in sectionG for the actual changed areas. Reuse still-valid previous passes; rerun after relevant changes or failures only.
5. Run required local SQL checks for migration/policy changes and actual connected browser acceptance. Do not substitute broad unit counts for a missing integrated result.
6. Check feature/public entrypoints: route handlers export through permitted `routes.ts` facades; client UI imports remain client-safe; feature roots do not directly export server internals. This specifically protects against the PR313 guard failure.
7. Check runtime types with the supported build/typecheck path. Record unchanged baseline test diagnostics separately; a failed full typecheck is not a pass. Fix all introduced errors.
8. Perform a review of permission, cross-org scope, retry/idempotency and draft-discard branches. Check all return/exception paths and async cleanup, not only the happy path.
9. Run `graphify update .` after runtime edits. It stays ignored; do not commit graph output.
10. Update evidence ledger, current monthly runlog and active open-work entry. Record exact base/head, completed/blocked steps, commands, measured results, reviewed UI states and external follow-up.
11. Commit scoped changes with clear present-tense messages and push using normal hooks. Do not skip hooks or force-push over another worker's changes.
12. Open a PR titled `[STEP S04] Restore reliable workspace support editing` (revise to match final actual scope). Describe the user-visible problem/behavior, access boundaries, migrations if any, test evidence, timings, screenshots/visual evidence and known gaps. Link the design, execution plan and evidence document.
13. Report PR URL and concise local evidence to Caleb, then stop. Do not wait/poll for hosted CI or independently merge/deploy/check production.

**Exit:** a reviewable PR with truthful local integration evidence, not a claim that release or four-account production verification is complete.

## F. State-transition and failure assertions

The worker must convert these into tests and visible behavior, not only documentation.

| Trigger | Required state/result | Forbidden behavior |
| --- | --- | --- |
| Support capability confirmed; org is free | Editable after initialization; no paid upgrade gate | Viewer because target lacks paid team plan |
| Open starts | Stable document loading surface; editor cannot send premature steps | Empty editable document or multiple bootstrap loops |
| Open fails before content exists | Contained Retry Opening | Download action with no copy; sidebar error |
| User types | Local draft/pending steps; Saving | Mark Saved before acknowledgment |
| Commit succeeds; presence fails | Saved document + degraded presence | Return save failure or replay duplicate text |
| Commit may have happened; response lost | Confirming save; reconcile revision | Blind overwrite, discard, false Saved |
| Network fails before commit | Preserve available draft; bounded retry | Automatic reload/discard |
| Grant revoked | Lock writes, clear edit capability, keep recovery | Treat as harmless presence-only outage |
| Presence heartbeat fails | Quiet presence state; retry/backoff | Disable valid document edit capability or move sidebar |
| Target/document changes | Cancel/ignore prior operations, correct scoped draft | Old response replaces new target content |
| Another actor edits | Rebase/converge within supported protocol | Last-writer-wins body replacement |
| Genuine external revision conflict | Compare/recover deliberately | Silently restore local body over newer saved content |
| Read poll in progress | Navigation allowed if no local work | Unsaved warning because `busy` is true |
| Local storage write fails | Accurate in-tab recovery/export message | Promise durable recovery after tab close |

## G. Focused command groups and evidence

Run from the isolated checkout with Node22. These are command examples for verified existing test paths; add proposed tests only after creating them. Preserve exit codes/output in ignored/private task evidence; do not dump customer data into logs.

### G1. Existing focused tests

```sh
pnpm exec vitest run --config vitest.config.ts \
  tests/acceptance/organization-workspace-support.test.ts \
  tests/acceptance/workspace-support-search-transport.test.ts \
  tests/acceptance/organization-switch.test.ts \
  tests/acceptance/organization-document-access.test.ts \
  tests/acceptance/organization-document-collaboration-access.test.ts \
  tests/acceptance/organization-document-collaboration-server.test.ts \
  tests/acceptance/organization-document-collaboration.test.ts \
  tests/acceptance/organization-document-transport.test.ts \
  tests/acceptance/free-document-access.test.ts \
  tests/acceptance/workspace-roadmap-support-editing.test.ts \
  tests/acceptance/workspace-canvas-overlay-drawer.test.ts \
  tests/acceptance/roadmap-actions.test.ts
```

Include newly authored capability, presence, lifecycle/draft and diagnostics tests after verifying their names and manifest assignments. Add relevant budget/history/source tests when those paths change.

### G2. Manifest and boundary checks

```sh
pnpm test:acceptance:manifest:update
pnpm check:acceptance-projects
pnpm check:features
pnpm check:boundaries
pnpm check:routes
pnpm check:structure
pnpm check:workspace-storage
pnpm check:interaction-locks
pnpm check:react-grab
pnpm check:workspace-surfaces
pnpm check:raw-buttons
git diff --check
```

Run scoped ESLint on changed source/tests and normal pre-push hooks. Do not run the entire local `pnpm check:quality` suite by default. Required hosted gates remain Caleb's responsibility.

### G3. Database checks, when policy/persistence changes

```sh
pnpm test:rls:document-activity
pnpm test:rls:document-files
```

Read the runners before execution and verify disposable target/config. Extend the migration chain/assertions deliberately; do not test only old migrations while shipping a new one.

### G4. Authenticated app and visual checks

The authenticated support spec/config is planned, not already available. Once created and target guards are verified, record its exact reproducible command, required non-secret environment variable names, fixture lifecycle and output in the ledger. A suggested command is `pnpm exec playwright test --config=playwright.workspace-support-auth.config.ts`, only after the worker has implemented that guarded config and the current session permits that test runner.

Existing rich-text regression on the supported visual environment:

```sh
pnpm exec playwright test --config=playwright.visual.config.ts \
  tests/visual/rich-text-editability.visual.spec.ts
```

This checks actual editor typing/read-only transitions but does not prove app authentication or persistence. Do not bypass Linux baseline guards; separate behavioral local app testing from screenshot-baseline updates. Browser permissions/tool restrictions from the active session still apply.

## H. Evidence ledger template

Start the ledger with this table and add actual facts; do not pre-check stages.

| Step | Status | Files / head | Command or journey | Result / artifact | Remaining issue / next action |
| --- | --- | --- | --- | --- | --- |
| 00 Preservation | Not started | | | | |
| 01 Reproduction/environment | Not started | | | | |
| 02 Diagnostics | Not started | | | | |
| 03 Capabilities/scope | Not started | | | | |
| 04 Authorization/presence boundary | Not started | | | | |
| 05 Durable document path | Not started | | | | |
| 06 Presence transport | Not started | | | | |
| 07 Lifecycle/recovery | Not started | | | | |
| 08 UI states | Not started | | | | |
| 09 Integrated journeys | Not started | | | | |
| 10 Performance | Not started | | | | |
| 11 PR handoff | Not started | | | | |

Also record separately: four-account live grant receipt status; production failure-stage evidence if available; migrations prepared versus locally applied versus production applied; local checks versus hosted checks; UI review versus production verification. Never collapse these into one “verified” checkbox.

## I. Stop conditions and allowed independent progress

- **Plan not approved for execution:** documentation only; preserve runtime work.
- **Missing originals or unclear lane ownership:** follow repository startup rules; do not invent the missing plan or alter another lane.
- **Uncertain database target:** no fixture writes/migrations. Resolve the target first.
- **Live identity reads unavailable:** record unverified four-account state; continue safe fixture-based work. Do not auto-grant by email/role.
- **Actual integration environment unavailable:** continue independent unit/source/SQL work, but do not claim complete acceptance or a ready feature based on mocks.
- **Policy replacement weakens scope/revocation/audit:** stop that change, document the exact gap and obtain direction if the required privilege boundary exceeds this plan.
- **Content/schema parity or conflict recovery fails:** preserve originals/drafts and stop the affected mutation path; do not migrate/rewrite customer documents to make tests pass.
- **Performance targets missed:** report measured blocker; fix the cause before claiming fast behavior. Don't merely raise timeouts/budgets.
- **Unrelated quality failure:** record it; do not expand into unrelated map/fiscal/admin optimization. Caleb handles hosted checks unless he delegates the specific failure.
- **Another user direction pauses work:** stop runtime changes immediately and checkpoint the exact state; do not open a partial patch PR after the pause.

## J. Worker completion checklist

- [ ] Exact intended accounts are resolved or current live verification is explicitly marked unavailable; no guessed identity/grant changes.
- [ ] All three entrypoints consume consistent server-verified document access.
- [ ] Granted support edits free/paid orgs; ordinary restrictions and revocation remain intact.
- [ ] Actual Origin typing persists after close/reopen; all native sections retain correct scope/access.
- [ ] Two authenticated sessions converge without lost text; budget conflicts remain explicit.
- [ ] Durable save success is independent of decorative presence failure.
- [ ] Timeouts reconcile safely, drafts survive according to the stated guarantee, downloads work only when content exists.
- [ ] No raw presence error paragraph or unwanted support banner/roster in navigation.
- [ ] Narrow/full-page/dialog error states are usable, accessible and visually coherent.
- [ ] SQL/RLS, actor audit, cross-tab/explicit-target and malformed-input cases pass.
- [ ] Performance results include warm/cold distinction, sample counts and failures.
- [ ] Feature/import/manifest guards and normal pre-push pass; introduced type errors resolved.
- [ ] Design/execution/evidence/runlog/index and feature READMEs reflect the final implementation.
- [ ] PR is open with honest evidence; Caleb owns all subsequent hosted/release/production stages.
