# Reliable workspace support editing

Status: execution authorized by Caleb's explicit ‘get to work’; implementation in progress. This replaces the incident's patch-by-patch approach. It does not certify production behavior.

Worker instructions: follow the [detailed execution contract](2026-10-15-workspace-support-editing-execution.md) in order. It defines exact source owners, planned files, STEP00–11, test commands, evidence requirements and stop conditions. This design remains the product/architecture reference; the execution contract is the implementation checklist.

Original scope: Desktop workstream `04-workspace-documents-integrations.md` and `04a-coach-admin-coediting.md`, especially organization switching and shared document editing. Preserve the earlier requests: default switcher list stays small, no permanent membership creation, no support/session text banner or staff roster inserted into navigation, and customer content/history remains intact. Incident evidence: [prior assessment](2026-10-14-workspace-support-overlay-and-roadmap-error.md).

## 1. Required outcome

Caleb, Joel, Paula and the existing fs@coachhouse account can find and enter any supported organization, open Accelerator → Strategic Roadmap → Origin (and every other native roadmap document), type, save, reopen and see the saved result. It works on free and paid organizations, through the workspace drawer, standalone roadmap route and admin organization asset dialog. Two authorized staff/customer sessions can edit safely without losing each other's work.

Use the existing operator-managed grants and verified account IDs; do not hard-code names/emails into runtime permission checks. Verify the four exact current identities/grants before claiming their access is operational. The previous fresh read timed out; historical grant receipts are not current proof. Ordinary members keep their existing permissions. Document assistance does not grant unrelated billing, ownership-transfer or platform-administration rights.

The UI remains usable during slow requests. Background presence/cursor failures do not put raw error paragraphs under the organization switcher, resize navigation or masquerade as document save failures. No indefinite loading, automatic destructive reload or false Saved status.

## 2. Findings and unresolved evidence

Confirmed in source and focused reproduction:

- The roadmap drawer computes editability from `canEdit && hasPaidTeamAccess`, ignoring verified support mode. Three new component cases reproduce this; the local override passes them, but is not an integrated repair.
- Permissions are calculated separately by active-org resolution, support grants, billing/access loading, editor props and document server authorization. They can disagree.
- Search and switching now use bounded JSON requests, but workspace presence still polls through an unbounded server action once per second.
- A document open can require both a read and a client bootstrap request. Each sync also waits on actor metadata, document presence write/read and cleanup. These can delay or fail a successful document operation.
- Some ordinary support-content RLS writes require workspace presence newer than 15 seconds. The document collaboration server already has a different verified-support write path. Treat these as distinct authorization and presence mechanisms; simply suppressing an error or dropping an RLS condition is not a fix.
- The reported document message is the client's 15-second timeout. Download my current copy appears on every error, including when no editor copy exists.
- Current catches hide underlying presence failures; the document endpoint lacks operation-stage timing/error evidence.

Unresolved: exact production slow/failing stage, current state of all four grants, and whether any reported save reached persistence before its response failed. Do not label these a database outage, a permission failure or document corruption without evidence.

## 3. Approach and boundaries

Recommended: consolidate the existing feature around one access contract, a small durable document path and independent presence. Retain Tiptap/ProseMirror, existing documents/history, concurrent-step merging and compare-and-swap persistence. This addresses the connected behavior without a data-format/provider rewrite.

Rejected alternatives:

- Continue separate UI overrides and longer timeouts: smallest diff, but leaves divergent permissions and hidden failure dependencies.
- Replace the collaboration engine/provider now: much larger migration and content-integrity risk without evidence that the engine is the bottleneck.

One coherent implementation branch and reviewable PR after integrated acceptance. Internal commits can follow the stages below; do not release the isolated drawer override as proof of completion. If the complete patch exceeds repository size/decomposition limits, split dependency-ordered PRs and explicitly keep the feature incomplete until all required slices pass.

## 4. Access and organization scope

Create a server-derived document access result shared by drawer, standalone page, asset dialog and document operations: actor, target organization, view/edit/history capabilities and a bounded reason code when editing is unavailable. Represent support authorization separately from subscriptions. Avoid inventing paid entitlements to make controls editable.

- Authenticate the actor and validate the live support grant for the explicit target. Preserve active staff status, revocation and organization-existence checks.
- The UI uses that result; writes independently recheck authorization. A client support flag or cached capability never authorizes a mutation.
- Bind each operation and local draft to actor + organization + document. Switching tabs/cookies cannot retarget an in-flight save or draft.
- Reuse audited organization entry. Duplicate clicks and stale search results cannot cause duplicate switches. An unsuccessful switch keeps the prior workspace.
- A member's paid-plan/team-management lookup must not delay or deny a verified support editor. Keep those billing checks for their actual member/invitation purposes.
- Audit every affected RLS/write path before changing presence dependencies. Where cursor heartbeat currently acts as authorization, replace it only with an explicitly tested server-validated support-session/activity mechanism backed by the live grant and target scope. Preserve revocation, actor attribution and fail-closed behavior. Document and test any migration/rollback separately; no production grant/policy changes during planning.

## 5. Document load, save and collaboration

Separate capabilities, document synchronization and presence states. A document can be saved while presence is reconnecting; one generic Connecting flag must not represent all three.

- Return canonical saved content, revision and compatible collaboration state through the authenticated document path. Minimize serial requests before readiness; initialize missing sessions from canonical saved data on the server when schema-compatible parsing is proven. If a bounded bootstrap handshake remains necessary, measure and test it explicitly rather than hiding it inside editor callbacks.
- Read independent data concurrently and reuse authenticated actor/access context within the request. Do not fetch the full organization membership/team management model to edit a document.
- Acknowledge durable saves independently of optional participant-list lookup and cursor cleanup. Keep required authorization/audit in the durable transaction; use supported scheduling or a separate endpoint for best-effort work, not unawaited serverless writes.
- Preserve generation/version checks, stale-step rebasing, idempotent retry/duplicate acknowledgment, budget-row conflict handling, sanitization, aligned/link/image content and version history.
- After timeout, reconcile the acknowledged server revision before replaying work. Never overwrite newer content or report failure solely because a response was lost after commit.
- Cancel superseded opens on document/org changes; ignore late responses. One opening/sync operation owns each editor generation. Clean up plugins/listeners on disposal and prevent an old editor from updating a new document.
- Define typed outcomes for loading, ready, saving, confirming a save, offline with a draft, denied/revoked, and a genuine content conflict. Download/recovery is offered only when recoverable content exists. Verify scoped draft persistence before saying work is retained; scope/version-check restoration and clear acknowledged drafts safely.

## 6. Presence and failure presentation

Workspace activity required for authorization and decorative collaborator presence need explicit, separate contracts. Background heartbeats use bounded, cancellable transport, one request in flight, backoff/jitter and visibility-aware polling. They must not occupy the navigation/server-action queue indefinitely. Reconnect automatically; no recurring toast or instruction to reopen the workspace as the normal response to a transient failure.

Use existing shadcn controls and `docs/design.md` tokens: restrained typography, existing spacing/radii, semantic colors, visible focus, accessible status text and actionable copy. Preserve the earlier rejection of support banners/rosters. Error layout is part of acceptance, not cleanup after backend work.

| State | Placement | User-facing behavior |
| --- | --- | --- |
| Search loading/failure | Existing switcher results/footer | Searching → results, or “Couldn’t load organizations.” with Retry Search. Keep input and local matches usable. |
| Switching | Existing switcher trigger/status slot | Immediate target-specific pending indication; prevent duplicate selection; keep old org until confirmed. Failure stays with the switcher and offers Retry Switch. |
| Document opening | Document content area, inside the existing drawer/dialog | Stable skeleton and one loading label. On failure: “Couldn’t open this document.” with Retry Opening. No empty download control. |
| Ready/saving/saved | Reserved compact document toolbar slot | Editing availability and acknowledged save state; no page/sidebar reflow. |
| Presence-only outage | Existing collaborator/status control within the document | Quiet “People status unavailable” detail; background retry. Do not show a save error or disable otherwise authorized editing. If no presence control exists outside the editor, do not add a navigation banner for decorative presence. |
| Save interrupted with local work | Document status slot and, when action is needed, contained editor notice | “Changes haven’t saved. Retrying…” only when unacknowledged work exists. Offer Retry Saving and Download Draft. Keep the editor/draft available. |
| Save acknowledgment uncertain | Document status slot | “Confirming save…” while reconciling revision; avoid a false Saved or failed-save claim. |
| Access expired/revoked | Contained notice in affected document | Stop further writes, explain loss of access, preserve recoverable work; offer appropriate sign-in/return action. |
| Actual revision conflict | Document recovery panel | Explicit saved-versus-local comparison and deliberate recovery choices. No automatic discard, restore or full-page reload. |

Reserve status space; wrap error details inside the document, not the sidebar. Desktop and narrow drawers must retain usable toolbar, editor and close/back actions. Use polite live announcements for meaningful state changes, no announcement on every poll. Critical save/access alerts remain discoverable without relying only on color or hover. Show technical request IDs only in optional diagnostic details.

## 7. Diagnose and measure before optimizing

Add structured stage events and a request/correlation ID for search, support entry, authorization, session load/bootstrap, commit and presence. Record durations, outcome/error codes and safe actor/org/document identifiers; never log document bodies, credentials or raw request dumps. Preserve internal causes while returning concise UI messages. Distinguish timeout, denial, database failure, conflict and post-commit presence failure.

First use these to reproduce the reported errors and identify the expensive/failing stage. Then optimize the measured path. Do not call a timeout increase a speed improvement.

Proposed acceptance targets in a documented production-mode test environment, excluding dev compilation:

- Immediate local feedback within 100ms of search/switch/open interaction.
- Warm search results p95 <=1s after debounce; warm switch-to-usable workspace p95 <=2s.
- Warm document open-to-editable p95 <=2s; save acknowledgment p95 <=1s after the debounce, with the existing <500ms server-mutation target tracked separately.
- Record cold-start and throttled results separately, with sample counts, fixture sizes and request counts. Use at least20 warm observations per measured path; report failures/timeouts rather than excluding them.
- Every request settles to a defined state; deadlines are recovery bounds, not acceptable normal latency. Measured misses are explicit blockers to a claim that loading is fast, not numbers silently relaxed to fit results.

## 8. Ordered implementation and acceptance

1. **Capture baseline and reproduce.** Resolve exact four-account identities/grants read-only; no impersonation or password reset. Build representative local authenticated fixtures for granted developer/coach/support, ordinary editor/viewer and revoked access, plus free/paid orgs. Reproduce the actual UI path and record baseline stage timings/error placement. If live identity/backend reads are unavailable, record that external gap rather than treating it as passed.
2. **Unify access and scope.** Implement the shared capability contract and consume it across all three entrypoints. Prove free-org support editing, ordinary member restrictions, revocation, explicit-target checks and cross-tab isolation. Audit/validate any authorization-policy change with the existing SQL/RLS harness.
3. **Repair the durable document lifecycle.** Implement bounded opening/bootstrap/save/reconciliation and independent optional presence. Exercise actual route handlers and persistence, not only mocked component props or helper functions.
4. **Design every visible state.** Implement the table above using shared primitives. Review actual drawer/dialog/sidebar at normal and narrow widths in light/dark mode. Inspect loading, offline, save-uncertain, denied and conflict states; update only affected visual baselines after intended presentation is reviewed.
5. **Prove the complete flow.** Extend existing acceptance/SQL/editor fixtures; avoid a separate testing app. Use real Tiptap typing and real local authenticated handlers/storage for switch → Accelerator → Strategic Roadmap → Origin → type → save → close/reopen. Test all roadmap sections, budget rows, images/alignment/links, standalone links and admin asset dialogs. Run a two-session staff/customer editing case and verify both contributions after reload. No production document edits in automated tests.
6. **Fault-test and hand off.** Slow/fail presence while document writes remain authorized; lose a response after a committed save; interrupt the network before commit; revoke support during editing; change org/query/doc during in-flight work; use two tabs with different orgs; open a fresh and existing session; verify draft/conflict recovery. Establish timing results and scoped UI evidence. Run focused checks plus normal pre-push; open the PR with exact results, remaining external gaps and migration/rollback instructions if relevant.

Minimum pass evidence: no sidebar error insertion/layout shift; all entrypoints agree on editability; actual text survives save/reopen; two-session edits converge; no cross-org writes; revoked/viewer access fails closed; presence-only failure does not block permitted document work or mislabel durable saves; no infinite loading; recovery preserves known local work; timing targets met or clearly identified as unresolved.

Caleb owns hosted CI/check review, required review coordination, merge, deployment and production verification. Agent responsibility ends at an honestly described, locally integrated PR; it includes regression evidence before that handoff. Do not poll CI, merge, deploy, activate flags or mutate production grants/data unless explicitly delegated.

## 9. File ownership and continuation

Expected implementation owners:

- `src/features/organization-workspace-support/{server,hooks,components,lib}`: authorized support scope, search/activity/presence and local status behavior.
- `src/lib/organization/{active-org,document-access,document-storage-access}.ts`: shared permission resolution; keep client consumers on allowed public contracts.
- `src/features/member-workspace`: switching and admin core-document dialog integration.
- `src/features/organization-document-collaboration/{server,hooks,components,lib}`: durable document API, lifecycle, recovery and status.
- `src/components/roadmap` plus the workspace roadmap drawer composition: consume the same access/result model.
- `src/app/api/account/**`: composition-only handlers through allowed feature facades; retain current feature/import guards.
- Existing `tests/acceptance`, editor interaction fixtures and `supabase/tests/organization-document-activity.test.mjs`: integrated regression and SQL/RLS evidence.

Preserve uncommitted local drawer fix/tests on `fix/support-roadmap-edit-access-20261015` in `coach-house-platform-tiptap-hotfix-20261015` (base0fd6b05d). They are evidence and a candidate part of stage2, not a finished feature. Do not discard them or create a standalone emergency PR while this design is under review. Keep historical SHIP40 claim evidence and unrelated worktrees/servers intact. This planning turn changes documentation only; implementation resumes after Caleb reviews/directs it.
