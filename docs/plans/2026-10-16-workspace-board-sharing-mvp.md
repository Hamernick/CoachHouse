# Workspace board and branded sharing MVP — execution plan

**October19 user correction:** this plan and W1–W8 are background context and paused. Do not execute their next steps automatically. Work only on the user's newly specified changes in this existing lane.

Date: 2026-10-16. Updated October19. Status: all three reviewed sharing migrations applied and independently verified on Production. Share menu/window implementation remains local; preview feature-flag configuration and authenticated/anonymous journey review precede richer share previews, public media grants and forms/Sheets. People expansion stays deferred.

## Priority override — October19: workspace behavior before feature completion

Latest user direction: finish core workspace interaction, layout and functionality before finishing features inside it. This supersedes the previous immediate-next Share/OG sequence without deleting completed work or renumbering S01–S36.

[Desktop resume handoff](</Users/calebhamernick/Desktop/Coach House Workspace MVP - Resume Plan.md>) maps all36 MVP steps to their status and existing plans, preserves deferred work and migration/release facts, and defines the next bounded foundation checkpoint:

1. W1 current behavior baseline; reuse prior audit and representative cards.
2. W2 canvas drag/pan/multiselect/control boundaries.
3. W3 library/Documents Add/drop, identity, immediate placement and retry/remove/re-add.
4. W4 connections and measured/manual/automatic layout.
5. W5 dock/window navigation, responsiveness, focus and drafts.
6. W6 persistence, Undo/Redo and existing collaboration behavior.
7. W7 shared sizing/frame geometry and purposeful reduced-motion-aware transitions.
8. W8 focused user review and measured interaction/performance blockers.

These are verification/narrow-fix outcomes inside approved scope, not permission to rebuild working systems, expand People, redesign individual Particle features or run broad repeated audits. People persistence expansion remains deferred and its browser-local limitation stays visible. Bring forward only relevant S34 measurements; final public/form measurements still follow integration.

After that checkpoint: connected Share review → S23 rich previews → S24 anonymous/revocation → public media/branding → S25–S32 Forms→Sheets → final acceptance/release. Keep36-step IDs and supporting plans for traceability. No application changes, deployment or new migration is authorized by this documentation checkpoint.

## Resume here

- Workstream: **Particle System / Workspace board and branded sharing MVP**.
- Existing checkout: `/Users/calebhamernick/Development/coach-house-platform-particle-system-20261009`.
- Branch: `feat/particle-system-20261009`.
- Recorded HEAD: `86305f24a030a39ecbef9dec69d84d72bb655e54`.
- Preview: `http://localhost:3008/workspace`. Restarted October19 during context recovery; listener PID54213 belongs to this exact checkout, Node22.13.0, exec session68456. Recheck before starting/restarting anything.
- October18 checkpoint inventory: 0 staged, 151 modified, 2 deleted and 188 untracked entries (directories may contain many files). Local tracking ref `origin/main` reports 3 ahead/44 behind. No fetch/merge/reset this slice; existing dirty work is preserved.
- **Open this existing folder. Checking out the branch in a fresh clone does not recover the uncommitted/untracked implementation.** Do not reset, clean, replace, stash indiscriminately, recreate from main, or merge another lane wholesale.
- Plan and current edits are local only. This checkpoint is not a commit, remote backup, CI pass or release.
- Active journey: **Drive → board → branded publishing**. S17/S22 now connects the existing menu/window to saved-page loading, local selection/order, exact public preview and explicit mutations. All three sharing migrations were applied to Production on October19 with exact-source history, function-body, forced-RLS and service-only RPC verification. Connected Google and authenticated/anonymous published-page appearance review remain pending. Defer unfinished S09b2/S09c People wiring; the existing People UI remains browser-local.
- Latest implementation: **Particle menu/right-click → Share page → select/order → Preview → Publish/Update**, plus Save draft, confirmed Copy link and Make Private. Uses the existing header/window, not a new drawer. Ambiguous saves retain their exact operation identity and block replacement until retry resolves. The database dependency is installed; preview feature-flag configuration and the integrated app→linked-DB journey remain unverified. Existing Drive preview behavior remains unchanged.
- Verification: October18 focused Share/editor/writer/card/calendar run passes 72 tests; retained schema/source/public-renderer checks remain valid. Scoped TypeScript/ESLint, boundary, ownership, manifest and diff checks pass. Earlier Drive authorization/preview receipts remain valid for untouched code. Browser, live Google and authenticated→anonymous publication checks remain **unverified**. Exact commands/limits are in the October18 checkpoint below.
- **Next gate: foundation W1–W8 above, core workspace behavior first.** Sharing configuration/review, OG/media and Forms→Sheets resume afterward. The database gate is complete; do not replay migrations or run a broad schema push. See the Desktop handoff for exact statuses/references.
- D1 explicit Publish/Update and D2 unchanged Google permissions remain accepted; D3 pending. S04 multi-source fixture and S02/S03 publication/resource boundaries remain open. S09a/S09b1 code is preserved, not deleted or claimed fully integrated.


Copy into a new chat:

> Resume the Particle System / Workspace board and branded sharing MVP in the EXISTING worktree `/Users/calebhamernick/Development/coach-house-platform-particle-system-20261009`, branch `feat/particle-system-20261009`. Open that folder; do not recreate this branch from main because much of the implementation is uncommitted/untracked. Read AGENTS.md, docs/RUNLOG.md, the current monthly entries, docs/agent/open-work-index.md, and docs/plans/2026-10-16-workspace-board-sharing-mvp.md. Follow the original-workstream reading requirements, including Desktop WORKSTREAMS.md, packet 07 and SHIP.md, but use this newer user-directed MVP scope and checkpoint for execution. Verify branch, dirt and port ownership, preserve all existing work, then continue the next incomplete numbered step. Keep localhost:3008 for this lane. Do not resume deferred document-editor/version-history work merely because an older plan says it is next. Show me key checkpoints. Record outcomes and next step in this plan before stopping.

## Progress reporting — 2026-10-16

The earlier approximately 20% figure was an unweighted estimate, not measured completion. Stop using it as a progress metric. Report working journeys, verified behavior, and missing capabilities. Current priority: Drive to board, branded Publish/Update pages, then Forms to Sheets. Existing canvas/library/source-authorization work is reusable; public publishing and Sheets delivery remain unfinished. User/provider/release evidence stays separate from local tests.

## Product contract

An organization puts people, documents and useful tools on a multiplayer board, arranges/connects them, and publishes selected content as a simple branded page. Public route target: `https://coachhouse.app/{organizationSlug}/{uniqueLink}`. The organization brand is always at the top; selected Particles follow in one ordered column. The public view is not another canvas or a general website builder.

MVP visibility is Private or Public. Public visitors view published content and can submit a published form. Workspace editing continues to use existing organization roles. Particle/context menus expose the relevant actions and permissions; a control is not itself an authorization boundary.

Sources, board placements and public presentation are separate responsibilities, not necessarily three new tables. Removing a card does not delete a file, person, form or remote Google resource. Public serialization is an allowlist, never a dump of board JSON. Responses never belong in board JSON.

Keep established multiplayer, Undo/Redo, revision guards, draft protection, source identity, optimistic placement and the existing React Flow canvas. Reuse working behavior; a numbered verification step does not mean rebuilding it.

### Explicit scope cuts

- Remove Timer, Workflow, Split a bill, Calculate and Checklist from new creation/search/commands. Keep old saved instances readable; do not remove checklist functionality embedded in real activities or change existing domain types destructively.
- Remove the library bottom `Particles on canvas` list (`grid gap-2 sm:grid-cols-2`). Removing a card still makes its available source discoverable again.
- No QR handoff, view/share counters, custom domains, nested groups, public freeform layouts, generative UI, new standalone People/Metric/Finance feature expansion, visible version-history/restore UI, arbitrary spreadsheet mapping, or full Google Docs/Word/Sheets editor replacement.
- Drive files remain in Drive. MVP uses reference, preview, provider-open and bounded refresh. Existing safe editors remain; unfinished write-back/conversion does not block this MVP.
- Preserve already-applied document room/version migrations and security protections. Do not roll them back or enable unfinished writable paths to simplify UI.

### Explicit decision gates (proposals are not accepted decisions)

| Gate | Proposed smallest behavior | Must resolve before | If not accepted |
| --- | --- | --- | --- |
| D1 — Publication updates | Publish/Update snapshots selected saved content. Source edits remain private until Update; no history UI. | S03 contracts and S19 writer locally verified; public reader/UI pending | Public access checks current visibility; caches must never bypass revocation. |
| D2 — Private source publication | Private Drive files remain provider links with their existing Google access. No implicit Google permission change, copied bytes or public proxy. Only expressly supported, authorized public assets render inline. People default to no contact details; fiscal private applications never publish. | S03, S20/S24 asset implementation | Any public copy or Google ACL mutation is separate explicit scope and authorization. Keep unsupported content link-only or block publication with an actionable reason. |
| D3 — Form answer storage/retention | Sheet is the user-facing destination. Coach House retains minimal delivery receipts and bounded pending answer payloads for reliable retry; delivered payloads are removed under a defined retention policy. No response dashboard. | S27 storage migration/S28 delivery | If Drive-only is chosen, specify outage acceptance, retry and unknown-outcome handling without silently storing answers. No timeout counts as agreement. |

Ask each gate only when needed; save exact answer, date and resulting contract. D3 also requires a concrete pending retention period and expiry outcome. Independent board/library work may continue while a gate is pending. Do not describe recommended defaults as user-approved.

### Recorded decisions — 2026-10-16

- **D1 accepted:** user answered “Yes—explicit Publish/Update.” Publish saved, selected content; later source edits remain private until Update. No visible history UI.
- **D2 accepted:** user answered “Yes—keep existing Google permissions.” Private Drive resources remain provider links requiring existing Google access. No implicit ACL mutation, byte copying or authenticated public proxy.
- **D3 pending:** ask before S27; do not introduce retained submission payloads or a retention period by assumption.

## Ownership map — reuse before adding

Paths are relative to this worktree. New feature/table names below are provisional until S01/S02 inspect current-main overlap.

| Owner | Existing implementation / responsibility |
| --- | --- |
| P — Particle domain/UI | `src/features/workspace-particles/{components,hooks,lib}`; `particle-presets.ts`, `particle-library.tsx`, `particle-card.tsx`, schema/registry, existing actions/history/session. |
| W — Workspace composition | `src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components`; dock, content window, flow/drop integration. Route files remain composition-only. |
| C — Shared presentation | `src/components/workspace/workspace-node-frame.tsx`, `workspace-particle-chrome.ts`, header slots; shared UI primitives; `docs/agent/workspace-node-frame-contract.md`, `docs/design/workspace-motion-contract.md`. |
| D — Documents | `src/components/organization/org-profile-card/tabs/documents-tab/**`; existing canonical file/attachment IDs, file routes and `src/features/document-editing/**`. |
| G — Google | `src/features/google-drive/server/{context,service,google-api,file-content,actions}.ts`; existing Tools connection and Picker, attachment authorization. |
| F — Forms | `src/features/organization-forms/**`; schemas, builder, preview and version/answer contracts. `server/actions.ts` currently has no publish/submission implementation. |
| A — People/activity/org | Existing People panel/table, organization profile/header and activity owners. No new competing CRM, brand store or membership system. |
| S — Public sharing (new only if absent) | Discover existing publication/routes first; scaffold a cohesive feature for share contracts, public projections, mutations and page composition. Reuse established DB/auth/jobs. |

Before coding a step, name exact touched files from these owners and its focused tests. Graphify query first for relationships; AST update after code edits. Read installed framework docs when implementing APIs. Do not invent a replacement state store or a new background service for convenience.

## Execution rules and evidence

There are **36 sequential implementation steps in nine stages**. A step is one bounded change/checkpoint, not a calendar estimate or a promise of one tool call. Default dependency: each step follows the previous step; explicit decision gates override that order only for independent work. If a step grows, add lettered substeps with a saved boundary rather than starting a long opaque task.

For every step update its status and evidence: `planned`, `active`, `implemented`, `locally verified`, `user reviewed`, `blocked`, or `released`. Use separate code/test/user/provider/release evidence; do not equate any one with completion of the others. On a failed check, stay on the named step, save the failure and fix only that scope. Do not proceed past its data/security gate.

Review checkpoints: after S08, S12, S16, S24, S32 and S35. Show the working preview and a short set of actions. User owns authenticated appearance review; existing browser restrictions remain. Do not silently substitute broad browser automation. Continue independent work while awaiting review; pause dependent design rework when the direction is unresolved.

Global design invariants: shared minimal frame and compact header/footer, concentric radii from existing tokens, small internal side insets, one window title, actions in header/context menu, no generic Backlog badges or replacement helper copy. Same content components across library/drag/canvas; public uses the same content design without editing chrome. Existing dock stays detached, width-constrained and shadow-free. Motion uses the established interruptible policy, transform/opacity where possible, reduced motion and stable editor identity. No forced focus outline after pointer interactions; visible keyboard focus remains. Preserve useful link previews with bounded work.

## Stage 1 — Baseline and contracts (S01–S04)

### S01 — Reconcile the actual lane and reusable work
- **Change/owner:** P/W/D/G/F. Record branch/dirt/server, current main overlap and current capabilities. In particular inspect the separately shipped document collaboration work noted by SHIP before extending this lane's older editor implementation. Do not merge or replace mixed work automatically.
- **Deliverable:** exact owner/capability matrix: existing and usable, needs a narrow fix, new, or deferred. Identify supported existing person source and event/calendar behavior.
- **Verify:** trace one saved board and document reference with read-only, minimum-data inspection; verify file paths and applied migration receipts. No real data printed into the plan.
- **Failure/next:** unresolved overlapping implementations block changes to those owners; record a reconciliation slice. Otherwise S02.

### S02 — Fix source, placement and page contracts
- **Change/owner:** P/D/A/S. Define stable source references, placement IDs and page membership/order. Document create/remove/re-add/duplicate behavior and allowed public fields for every retained kind. One source can appear on multiple pages; page membership is not a new workspace role. Use existing validated contracts where adequate.
- **Deliverable:** typed contract/mutation map and compatibility strategy; no copying file bytes or contacts into graph state. Resolve whether each create action adds a new source or another placement.
- **Verify:** fixtures for stale/missing/cross-org references, repeated placement and legacy data; removal must preserve the source.
- **Failure/next:** if source identity cannot be resolved, leave it readable but disable new invalid references with a clear reason. S03 after contract is coherent.

### S02a — File placement validation checkpoint (2026-10-16)

- Added `src/features/workspace-particles/server/file-reference-access.ts`; exported through the feature public entrypoint and called by the authenticated `workspace-particle-actions.ts` before the existing conditional board writer commits.
- Local image/document IDs require an undeleted, actor-readable `organization_document_files` row in the active organization, with the same library path rules as the existing file endpoint. Drive IDs reference `organization_external_documents.id`, not provider IDs; require an available organization attachment and its canonical Google URL. No Google ACL or provider mutation.
- Check new references, changed references (including changed Drive URLs), and hidden-to-visible placement. Deduplicate repeated references and bound lookup chunks to 100. Source queries use the authenticated actor client, never the board writer's admin client.
- Existing missing references remain movable, resizable and removable. Confirmed request replay does not recheck or duplicate placement. Ordinary geometry/title/connection changes do not trigger source queries. New placement validation does not replace read-time authorization or establish that Google has not revoked access since its last verification.
- No schema migration, source bytes, background polling, UI layout/motion changes, public projection or publish writer added. Profile upload/policy/roadmap references, lesson notes and People keep their existing owners and still require the S02b audit/checks. Future public serialization must reread authorized canonical content; this guard is not a public-content allowlist.
- Extended existing `workspace-particle-actions.test.ts` for missing/denied paths, query scope/soft-delete predicates, images, deduplicated and bounded batches, re-add/replacement, forged Drive URLs, lookup failure, no-query movement/removal and confirmed replay. Mocked boundary tests do not claim live RLS/provider verification.

### S02b/S03a — Source ownership and public review contracts (2026-10-16)

- Renamed the S02a guard to `server/particle-source-access.ts` / `assertParticleSourceReferenceAccess`; added `server/profile-reference-access.ts`. All continue through the same authenticated mutation callback. Profile upload/policy/roadmap sources resolve once against the actor-readable active organization profile, reusing existing document definitions/roadmap resolution. Validate canonical org/path prefixes; no download/signing. Lesson references use an actor-RLS module-ID query without fetching note bodies. Workspace-note aliases resolve only to canonical workspace notes in the same next graph.
- New/replaced/re-added primary sources are checked. Existing broken references can still move/hide/delete without source lookup. Nested checklist/resource references are not newly authorized by this guard; their S11 resolver remains required. Existing source reads keep their own authorization.
- **People finding:** `use-stored-workspace-person-placements.ts` reads `workspacePersonPlacements` from browser localStorage through workspace-board UI preferences; placement controller filters against the organization profile's supplied people. This is not durable shared board placement. Preserve existing local positions and org_people ownership while moving only placements into the canonical authorized board path in S09–S12. No second people store or broad CRM rebuild.
- Added `lib/particle-public-content.ts`: strict public DTO and pure review projector. Explicit top-level fields: id, title, description, content. Current intrinsic review variants: text summary, workspace-note Markdown, event time/place (no attendees), color, validated form questions. Internal steps/resources, generic status, position, workspace metadata, contact lists and fiscal records are not copied. Lesson notes, unresolved external sources, and unsupported kinds fail closed.
- Public DTO also defines future canonical Drive-link and explicitly granted image/document-asset variants. Projecting a raw document/image Particle is deliberately blocked until S20 resolves its source/grant. No private file IDs, storage paths, tokens, connections, form destinations or answers are fields. Markdown rendering still must use the existing sanitizer. These schemas do not by themselves authorize a source or publish anything.
- Publication-role predicate matches current org-publication owner/admin/staff scope and denies other-org, board/member, anonymous and support contexts. Future server action must supply its own authenticated actor, resolve support restrictions against current main, enforce source access/revision/feature gates and commit only reviewed snapshots. No new paid entitlement policy introduced.
- Tests use existing action/notes suites: profile/missing/path failures, module-read identity without note bodies, workspace-note alias scope, nonmutating preview copies, excluded attendees/operations, invalid forms/URLs/private-field injection and all publication roles. 118 tests across actions/notes/files/history pass. These are local tests, not live DB/RLS/provider/public-page evidence.

### S03 — Resolve publication behavior and permission matrix
- **Change/owner:** S/G/A. Obtain D1/D2 decisions. Map owner/editor/viewer/other-org/anonymous against source read, edit, place, publish, revoke and form submit. Use the existing organization's publication-capable role; if none exists, define it explicitly rather than assuming every editor can publish.
- **Deliverable:** public snapshot/live semantics, source allowlist, publication eligibility and asset-access policy. Public response data is always excluded. People publish only deliberately selected public fields.
- **Verify:** table-driven deny/allow cases; no board-wide serialization, token/path exposure or implicit Google permission escalation.
- **Failure/next:** keep public mutations disabled until decisions are recorded. Independent S05 cleanup may proceed; S04 uses only approved contracts.

### S04 — Establish the representative acceptance fixture
- **Change/owner:** existing test fixtures/P/C. One organization, two authorized users, outsider and anonymous viewer; one linked person, Drive file, image, note/activity and form. Use synthetic/private test data, never production submission fixtures.
- **Deliverable:** baseline source/board fixture and narrow test list mapped to S01–S36, including light/dark, long titles and sparse content.
- **Verify:** current behavior recorded honestly; distinguish already-passing tests from missing features. Set the ordinary laptop/phone benchmark target for later measurement.
- **Failure/next:** record existing failures; do not relabel baseline problems as new code failures or broaden the project. S05.

## Stage 2 — Library reduction (S05–S08)

### S05 — Remove the five creation presets
- **Change/owner:** P registry/presets/gallery/commands. Hide Timer, Workflow, Split a bill, Calculate and Checklist from new creation and search without removing old schemas/renderers.
- **Deliverable:** a smaller creation catalog, no dead shortcuts or unsupported command creation.
- **Verify:** removed presets cannot be created through UI/command paths; existing saved instances deserialize and render; real activity checklists still work.
- **Failure/next:** if a preset identifier also names a retained domain capability, filter the creation entry instead of deleting the domain type. S06.

### S06 — Remove the bottom placed-card grid
- **Change/owner:** `P/components/particle-library.tsx`; remove `aria-label="Particles on canvas"` grid only and adjust empty/search derivation.
- **Deliverable:** no duplicate bottom list or leftover spacing; no deletion of placements/data.
- **Verify:** mixed available/placed, all-placed and filtered states; no false "No Particles" message while valid presets/tools remain.
- **Failure/next:** keep the stored available/placed distinction; fix presentation selectors only. S07.

### S07 — Keep available sources discoverable
- **Change/owner:** P library/D/A source selectors. Retain working organization/activity/fiscal sources, documents, notes, event and form; expose existing person references using the existing People owner rather than a new CRM.
- **Deliverable:** removing a card makes the reusable source available again; uploaded file instances stay in Documents, not duplicated as image-tool presets.
- **Verify:** add/remove/re-add preserves source identity and does not duplicate records; no click-to-edit regression on drag surfaces.
- **Failure/next:** unavailable/deleted sources show a bounded missing-source state rather than a fabricated replacement. S08.

### S08 — Review the reduced library and shared card anatomy
- **Change/owner:** P/C; fix only regressions caused by S05–S07, including masonry/list/icon views and header control placement.
- **Deliverable:** focused user checkpoint on localhost:3008/workspace; library and drag preview share renderers.
- **Verify:** focused preset/library tests, scoped types/lint, keyboard Add and touch targets; user checks appearance.
- **Failure/next:** record unresolved appearance feedback; no broad redesign. After structural pass, S09.

## Stage 3 — Real data to the board (S09–S12)

### S09 — Unify add and drop reference resolution
- **Change/owner:** P drag/optimistic placement, W flow handlers, D/A source actions. Both Add and drop resolve the same authorized source/placement command.
- **Deliverable:** document, image, note, activity and person sources use a consistent placement path; coordinates come from React Flow transformation, not custom pan/zoom.
- **Verify:** toolbar Add, pointer drop at non-100% zoom, keyboard alternative, unsupported payload and cross-workspace denial. Existing uploads reuse their current limits/auth.
- **Failure/next:** reject invalid references without creating orphan records; preserve the user's selected source. S10.

### S09a — Person placement contract checkpoint (2026-10-16)

- Extended the existing People payload with optional `presentation: "person"`, requiring exactly one source UUID. Existing group payloads remain valid. Graph validation allows one such placement per source, including hidden records, so concurrent adds cannot create duplicates.
- `lib/person-placement.ts` supplies one Add/drop planner: visible placement = no-op; hidden placement = reuse ID and relationships; new placement = new UUID, source ID and manual position. No copied name/email/avatar. Use existing graph operations, exact entity revisions, optimistic commit, receipts and history; no second store/table.
- Server source validation now checks newly linked/re-added person IDs against actor-readable active-org `profile.org_people`. Retained references, moves, hide and reference subtraction do not query source records. Mixed document/person requests reuse one profile lookup. Existing unavailable cards remain removable.
- Pure local recovery planner keeps only known, absent people and the first duplicate local position. Existing shared records win even when hidden. It never modifies browser storage, so failed saves leave the original recoverable. Recovery is not enabled by mounting/rendering this module.
- Tests cover schema compatibility, malformed IDs/coordinates/capacity, Add/drop idempotence, hidden re-add/lock/connections, stale concurrent operations, undo/redo, recovery preservation, source failures and active-org query scope. 159 tests across six focused suites pass; mocked authorization is not live RLS evidence.

### S09b1 — Single-session ownership checkpoint (2026-10-16)

- Lifted the existing `useParticleSession` from the child canvas view to `WorkspaceCanvasSurfaceV2Session`; `useParticleFlow` consumes that supplied session and keeps high-frequency node/gesture state in the child. No duplicate transport, history or graph store.
- Workspace/account changes remount the session boundary using organization and viewer IDs; this preserves isolation previously provided by the keyed child.
- Added `usePersonPlacements(session)` with canonical latest-graph Add/remove operations and optimistic confirmation/rollback through the existing session. No-op Add preserves position/history; remove hides the placement without deleting its profile source; retry uses the original batch/placement IDs.
- 66 tests/5 suites pass, including new interleaved person/objective history, duplicate/no-op Add, hide/re-add, failed-save retry and read-only/invalid rejection. Scoped TypeScript, ESLint and boundary checks pass. These hook/contract tests do not establish live collaboration or UI behavior.
- **Next S09b2:** wire the existing compact People renderer and controls, canonical endpoint mapping and unified mixed-selection movement. **Then S09c:** acknowledged local recovery and two-client checks. The current People controls remain local until that integrated switch is safe; this checkpoint deliberately adds no half-migrated rendering mode.

### S09b/S09c — Next bounded integration decisions

1. **One session owner:** lift/reuse the existing Particle session above People placement and canvas flow; do not add a second transport, history or competing optimistic graph. The current session is created in `workspace-canvas-surface-v2-view.tsx`, while People placement runs in its parent.
2. **One renderer:** adapt canonical placement IDs/positions into the current 244×64 People cards and relationship edges. Exclude person variants from the generic Particle rendering path. Resolve contact display from current org_people, including removed-source behavior. Preserve existing generic People groups.
3. **One mutation path:** route existing Add/drop/remove/group movement through the shared operations. Keep React Flow coordinates and transient drag state; commit on completed gestures. Derive editability from canonical layout permission, not the broader People profile-edit permission alone.
4. **Recover once:** integrate local positions only after canonical graph load and authorization. Canonical visible/hidden records win. Persist scoped recovery acknowledgement only after a confirmed batch (or confirmed no-op), preserve original local data, and prevent stale clients/Undo from repeatedly importing removed placements. Do not silently discard invalid/over-capacity recovery; retain it for retry.
5. **Verify before enabling:** no double cards, no generic person editor, stable relationship endpoints, Add/remove/re-add/reload and Undo/Redo. Two-client checks remain distinct from local tests. Until this wiring lands, existing People controls still use localStorage; S09 is not complete.

### S10 — Preserve instant placement with honest persistence
- **Change/owner:** P existing optimistic receipt/session/history. Reuse immediate placement; serialize durable saves, keep local gesture updates and one history action per add.
- **Deliverable:** immediate local card; pending/failure/retry indication through existing compact UI; no false Saved state or duplicate cards on retry.
- **Verify:** delayed save, failed save, unknown response, duplicate retry, drop then move, stale revision and peer update.
- **Failure/next:** retain recoverable pending intent or roll back only the failed placement as dictated by current contract; never erase newer gestures. S11.

### S11 — Attach an existing resource to a Particle
- **Change/owner:** P menu/inspector + D/A authorized picker. Choose a file/person/activity reference with a minimal existing picker; display a compact actionable linked row.
- **Deliverable:** one source can stand alone on the board or be referenced inside a Particle; unlink never deletes the source.
- **Verify:** open link, denied/missing source, retry, deduplication, disconnect, reload and Undo/Redo. Card drag must not capture nested link clicks.
- **Failure/next:** do not show inaccessible source details; provide remove/reselect action only where authorized. S12.

### S12 — Verify board collaboration and arrangement
- **Change/owner:** P/W existing multiplayer, history and measured layout. Repair only failed MVP journeys; do not rewrite working drag/layout systems.
- **Deliverable:** add → move → Shift-select → connect → remove/re-add → reload, preserving manual positions and four-side rails.
- **Verify:** focused concurrency/history tests plus user-owned two-client check; no full-board data overwrite after stale saves; Auto-layout remains explicit.
- **Failure/next:** data-loss/concurrency failures block stage completion; minor appearance notes are bounded. Show checkpoint, then S13.

## Stage 4 — Useful Drive files (S13–S16)

### S13 — Connect and select through existing Google infrastructure
- **Change/owner:** G existing Tools/OAuth/Picker + D attachment owner. Reuse selected-file access and current callback configuration; no Drive-wide import or automatic scope expansion.
- **Deliverable:** disconnected → connect → select file → Documents reference → Add to board. Cancel is harmless.
- **Verify:** connection cancellation, expired tokens, lost access, organization switch and provider-ID versus app attachment-ID resolution.
- **Failure/next:** provider setup errors are explicit; preserve selected intent without exposing credentials. If live provider access is unavailable, record the gate rather than claim success. S14.

### S14 — Complete preview, maximize and provider-open behavior
- **Change/owner:** D/G file readers, existing document window and P file cards. Capability-specific previews for PDF/image/text/Markdown/CSV and existing supported Word previews; Google-native editing opens Google.
- **Deliverable:** full-file access is distinct from bounded preview; PDF page controls, file title once, maximize/restore retains context, unsupported preview offers real source access.
- **Verify:** complete versus truncated content labels, large/empty files, MIME mismatch, denied access, keyboard/touch and window reopening.
- **Failure/next:** never save preview truncation or present unsupported Word editing as working. S15.

### S15 — Refresh only when needed
- **Change/owner:** G/D query/cache owner. Add or reuse bounded open/focus/manual refresh with in-flight deduplication and org/file-scoped cache invalidation; record freshness policy.
- **Deliverable:** Google-side edits become visible after refresh without duplicating the file or changing placements. No provider requests on drag/type/resize/idle.
- **Verify:** repeated opens dedupe, stale response cannot replace newer file/account state, hidden windows stop unnecessary work; request trace records actual counts.
- **Failure/next:** retain last authorized preview with an accurate retry state; revocation must not keep granting access from cache. S16.

### S16 — Review Drive-to-board end to end
- **Change/owner:** D/G/P integration only.
- **Deliverable:** user selects a real authorized test file, places it, edits in Google, refreshes here, removes placement and verifies the Drive original remains.
- **Verify:** provider receipt/read evidence separately from mocked tests; no authenticated provider success inferred from unit tests. Confirm current file editor UI does not accidentally enable deferred writes.
- **Failure/next:** provider failures remain named blockers; continue independent sharing contract work, not unsafe workarounds. Show checkpoint; S17.

## Stage 5 — Access and publication foundation (S17–S20)

### S17 — Consolidate the Particle action menu
- **Status:** Share integrated with existing top-right menu and same-menu right-click (October18). Existing commands preserved; browser focus/touch/drag review and later resource-picker integration remain open.
- **Change/owner:** P existing menu overlay/action controller and W header. Edit/Open source/Link resource/Share/Remove appear only when meaningful; right-click uses the same commands.
- **Deliverable:** one top-right overlay trigger, small predictable menu, no extra permanent badges/buttons. Read-only roles see accurate available actions.
- **Verify:** keyboard/menu focus return, touch, drag boundaries and source-aware edit dispatch; inaccessible actions are also rejected server-side.
- **Failure/next:** no placeholder menu actions. S18.

### S18 — Implement the minimal page membership/access model
- **Status:** locally verified storage/contracts (2026-10-16), now connected to writer/reader/UI. All three reviewed sharing migrations applied/independently verified on Production October19 under explicit user authority; connected browser journey remains open.
- **Change/owner:** S + existing auth/database. Reuse existing public-page owner if found; otherwise scaffold the feature. Persist organization, stable page ID/link, visibility, ordered source/placement references and approved public projection/revision fields.
- **Deliverable:** reviewed additive migration and typed contracts with organization-scoped RLS and clear asset ownership. Page order is separate from canvas coordinates; no new per-person ACL editor.
- **Verify:** owner/editor/viewer/other-org/anonymous cases, duplicate slug/link, missing source, referential cleanup and rollback in isolated DB.
- **Failure/next:** no broad schema push. Live migration requires exact review and explicit authority. S19 can be tested locally first.

### S19 — Publish, update and make private atomically
- **Status:** locally verified server actions/atomic writer, connected to public reader and Share UI; linked-project migration verified October19; live journey remains pending. See October19 checkpoint below.
- **Change/owner:** S server mutations and approved D1 semantics. Validate selected saved sources/permissions, build allowlisted public payload and commit visibility/revision with stale-write checks.
- **Deliverable:** stable public link; Update preserves identity/order; make Private denies subsequent content reads. New draft content cannot leak through failed publication.
- **Verify:** simultaneous publish/revoke, role removal, stale update, repeated requests, missing source and malicious payload. Cache invalidation tied to committed changes.
- **Failure/next:** retain draft selections and prior confirmed publication; display failure without claiming new state. S20.

### S20 — Enforce public asset and linked-resource boundaries
- **Status:** supported intrinsic/Drive-link boundary and public reader locally verified (2026-10-16). Upload assets fail closed; no public asset grant/proxy was added. See capability matrix/checkpoint below.
- **Change/owner:** S/G/D/A, approved D2. Explicit field projection for each supported public kind. Keep private Drive links subject to Google access; no access-token proxy. Public image/file delivery checks current publication or uses an expressly authorized public-asset contract.
- **Deliverable:** source-type capability matrix and safe content rendering, including sanitized notes, contact field omissions and fiscal private-data exclusions.
- **Verify:** anonymous requests cannot enumerate board/files/contacts/responses; revoke blocks newly requested protected assets; linked assets cannot bypass parent publication.
- **Failure/next:** blocked inline item is link-only or excluded with a specific reason. Do not silently mutate Google ACLs. S21.

## Stage 6 — Branded pages and share preview (S21–S24)

### S21 — Compose the public route and branded column
- **Status:** route/renderer, basic metadata, loading/error states and actual invalid-link HTTP404 locally verified (2026-10-16). Published-page browser review, brand logos/public-media grants and final bundle/visual verification remain open.
- **Change/owner:** S public renderer, A existing brand/header, thin App Router composition. Audit `/{organizationSlug}/{uniqueLink}` conflicts/reserved names and canonical organization slug handling before adding routes.
- **Deliverable:** brand always above optional page title/intro and one ordered column; no canvas runtime/editor chrome in anonymous bundle.
- **Verify:** mobile/desktop readable layouts, long names, missing logo, images with known ratios, accessible headings and no private properties in HTML/metadata.
- **Failure/next:** unavailable page reveals no private title/details; route collision gets a bounded design decision, not an unannounced URL change. S22.

### S22 — Add the compact sharing panel and ordering
- **Status:** implemented and interaction-tested locally (October18), including current multiselection and Motion drag/keyboard ordering. Linked-DB migrations verified October19; preview flag plus browser/visual review still required; not released.
- **Change/owner:** P Share menu + S editor in existing window. Select existing page or create one, choose content, reorder with drag and keyboard alternatives, Preview, Publish/Update, Copy link, Private/Public.
- **Deliverable:** selection can begin from one card or current multiselection; page edits never move canvas cards. Actual editing roles remain inherited and explained in the menu.
- **Verify:** 3-of-10 publication, cancellation, failed save, keyboard reorder, duplicate membership, source removed from board and no dirty-draft leak.
- **Failure/next:** draft retained on failed publish; Copy public link only follows a confirmed page identity/state. S23.

### S23 — Add rich link metadata with bounded generation
- **Change/owner:** S/Next metadata. Page-specific title/description/canonical URL and branded OG image from committed public content only; cache image by public revision and reuse brand assets.
- **Deliverable:** crawler-readable metadata, absolute image URL and useful preview. No browser screenshot service or image generation on every visitor request.
- **Verify:** HTML and image routes as anonymous crawler, correct content-type/dimensions, stale revision handling, no private draft text and no per-visit provider reads.
- **Failure/next:** cached safe brand fallback if OG rendering fails; external unfurl cache cannot be forcibly erased on revoke, so never include sensitive preview content. S24.

### S24 — Review anonymous sharing and revocation
- **Change/owner:** S integration; focused user review.
- **Deliverable:** actual permitted sample page opened on mobile/desktop and pasted into a messaging service; Private state produces a minimal unavailable page with a home route.
- **Verify:** anonymous and outsider see exactly selected content, published Update changes intended content, revoke invalidates app content/asset caches; external old unfurl limitations recorded honestly.
- **Failure/next:** privacy failures block public rollout. User reviews brand/spacing/column; no custom layout expansion. S25.

## Stage 7 — Form destination and delivery infrastructure (S25–S28)

### S25 — Finish the minimal form draft journey
- **Change/owner:** F/P existing builder/preview. Blank name with `Name this form...`, existing six field types, question order, Required, header Edit/Preview and published-snapshot validation.
- **Deliverable:** draft → try answers → return to Edit → save, without rehearsal answers entering board state. Reuse current visuals; no redesign pass.
- **Verify:** incomplete draft save versus publication validation, unknown choice IDs, empty form, long fields, dirty close, reload and Undo/Redo. Existing tests may satisfy unchanged behavior.
- **Failure/next:** focus actual invalid field, keep typed input, no generic status clutter. S26.

### S26 — Connect an existing or new Google spreadsheet
- **Change/owner:** G/F existing connection owner; Sheets adapter only for missing capability. Connect Google → choose existing spreadsheet/create new → confirm destination. Dedicated response tab for existing spreadsheet; no overwrite of existing tabs.
- **Deliverable:** persisted org-scoped destination reference, explicit title and Open Sheet action. Record file ID, sheet/tab ID and question-column mapping server-side.
- **Verify:** create/select cancellation, no write permission, wrong-account destination, creation retry/reconciliation, renamed file/tab and no duplicate orphan creation on unknown outcome.
- **Failure/next:** preserve form draft and retry/change destination; publishing requires a verified writable destination for MVP forms. S27.

### S27 — Resolve storage and implement receipts/schema protections
- **Change/owner:** F/G/database. Obtain D3 answer plus concrete retention/expiry policy before creating payload storage. Keep immutable published question IDs/version mapping, scoped submission UUID/receipt and delivery state outside board JSON.
- **Deliverable:** exact additive migration/RLS contract; accepted-versus-delivered language, revocation race behavior and pending-expiry behavior. No visible version browser or full response dashboard.
- **Verify:** anonymous cannot read responses; other org cannot read destination/receipts; duplicate submission resolves same receipt; role/revocation fences and deletion/retention behavior in isolated DB.
- **Failure/next:** no inferred consent to temporary answer storage. If Drive-only is selected, revise this step and S28 acceptance rules explicitly. S28 after decision and tests.

### S28 — Deliver to Sheets without silent loss or duplication
- **Change/owner:** F/G; reuse existing bounded job/retry infrastructure if available. Server-validate answers, use literal/RAW values and stable mapping. A naive append retry is not sufficient for ambiguous timeouts.
- **Deliverable:** choose and test a deterministic write strategy (for example reserved response rows in the dedicated tab with stable submission IDs); bounded reconciliation verifies uncertain writes before retry. Pending payload retention follows D3; no continuous polling.
- **Verify:** timeout after successful write, duplicate request, concurrent submissions, token expiry, 429/backoff, edited/reordered/deleted sheet rows and mismatched headers. A receipt alone must not be claimed to make Google append idempotent.
- **Failure/next:** when destination structure no longer matches, stop writes and request reconnect/repair; never overwrite unrelated cells or scan an unbounded sheet. S29.

## Stage 8 — Public form completion (S29–S32)

### S29 — Publish the form as a page Particle
- **Change/owner:** F/S; bind immutable form version and destination configuration to publication without exposing tokens/Sheet write capabilities.
- **Deliverable:** public form inside the same branded column; definition updates use the approved Publish/Update contract and preserve old response meanings. New versions use explicit compatible columns or a new dedicated tab; no silent column reinterpretation.
- **Verify:** draft edits remain private, stale submission version handling, field reorder/rename/type changes, revoke during submit and missing destination.
- **Failure/next:** invalid/unconnected form blocks its publication with an actionable error; other page content is not silently dropped. S30.

### S30 — Implement the public submission journey
- **Change/owner:** F public renderer/server endpoint/S page. Accessible six-type fields, inline errors, sending/pending/success/failure states; bounded request size, existing rate-limit/anti-abuse infrastructure and idempotent receipt handling.
- **Deliverable:** anonymous visitor submits without receiving workspace edit or response-read permissions. Exact success language distinguishes durable acceptance from confirmed Sheet delivery according to D3.
- **Verify:** forged fields, oversized inputs, repeat click/reload/retry, revoked form, invalid options, first-error focus and accessible status feedback.
- **Failure/next:** retain answers after transient error; unknown outcome retries same request ID. No success before the agreed acceptance boundary. S31.

### S31 — Expose only necessary destination/recovery controls
- **Change/owner:** F/P header/context menu. Open Sheet, change/reconnect destination, compact pending/failed delivery indication with retry where safe; no analytics or response dashboard.
- **Deliverable:** destination changes are explicit; pending submissions retain their original destination/version association unless an explicit recovery operation says otherwise. No background rerender-driven provider calls.
- **Verify:** lost access, disconnect, deleted tab/file, revoked OAuth, unauthorized retry and mapping mismatch. Confirm temporary delivered payload cleanup and pending expiry match D3.
- **Failure/next:** preserve receipts/drafts; never blind-switch queued answers into a different Sheet. S32.

### S32 — Verify both Sheet paths with provider evidence
- **Change/owner:** F/G/S integration only, authorized test form/destination.
- **Deliverable:** existing-spreadsheet and create-new paths each receive one verified submission; rehearse a failed/uncertain write and safe retry using controlled tooling, not customer data.
- **Verify:** exact row/receipt mapping, no duplicate entries, private responses, Google edit/open works and revoked form no longer accepts new submissions. Separate real provider evidence from mocks.
- **Failure/next:** no claim of working Sheets integration while OAuth/API/test-destination verification is blocked. Show checkpoint; S33.

## Stage 9 — MVP acceptance and delivery (S33–S36)

### S33 — Run the complete representative journey
- **Change/owner:** all existing owners, fixes only within failed MVP behavior.
- **Deliverable:** two authorized users add real permitted sources, arrange/link/reload, publish a subset, anonymous visitor views/submits, Sheet receives response, publisher updates then revokes. Underlying sources and private board remain intact.
- **Verify:** focused integration/RLS and user-owned interactive evidence for the exact journey, including reload/account change and multiuser conflict. Do not introduce a broad new testing framework.
- **Failure/next:** record each broken transition with its owning step; repair there and rerun affected coverage only. S34.

### S34 — Measure the bounded performance/accessibility contract
- **Change/owner:** P/W/S/F measured hotspots only. Baseline one ordinary laptop and phone, representative board (start 25 particles; 100 as stress), public page with representative media and largest supported form.
- **Deliverable:** interaction frame/long-task trace, initial-load and idle/provider-request counts, public bundle inspection, keyboard/touch/reduced-motion check and repeated open/close memory observation.
- **Verify:** target immediate local feedback and 60fps drag on agreed baseline, not every-device guarantee; no continuing idle Google calls; public page excludes canvas/editor bundles. Fix measured blockers, not speculative rewrites.
- **Failure/next:** record device/environment and actual results; tune one identified hotspot. Do not claim "ultra optimal" from unit benchmarks. S35.

### S35 — Final product checkpoint and scoped regression closure
- **Change/owner:** affected UI owners. User reviews the complete narrow journey, not each of the older deferred feature lists. Consolidate a short known-limits list.
- **Deliverable:** reviewed library, board, source window, share panel/page and form flow; no placeholders, fake actions or duplicated titles.
- **Verify:** targeted changed-behavior tests/types/lint, relevant RLS/guards; approved visual changes get affected baselines in the repository-required environment. Prior user-approved unchanged checks are reused.
- **Failure/next:** bounded polish only. Security/data loss blocks delivery; deferred feature requests are separate. S36 after evidence is recorded.

### S36 — Preserve and deliver the release slice explicitly
- **Change/owner:** repository workflow. Inventory changed/untracked files, isolate coherent MVP changes without losing other work, reconcile current main deliberately, scan outgoing content, commit/push through the authorized workflow and verify remote SHA. Do not claim branch-only backup preserves untracked files.
- **Deliverable:** recoverable source checkpoint/PR with exact migrations, flags, provider configuration and user-review evidence. Follow current SHIP instructions and one-release ownership; no blanket migration push.
- **Verify:** required hosted quality/code-owner/branch protection at current revision, explicit exact migration/provider authority where needed, successful deployment and authorized live smoke separately. Full local quality suite only when requested or diagnosing specific CI failure.
- **Failure/next:** remain locally verified/ready for review, not released; record exact failed gate. Mark MVP complete only when the chosen delivery target and end-to-end acceptance are actually satisfied.

## Definition of done and traceability

| User requirement | Steps / proof |
| --- | --- |
| Remove placeholder choices and bottom library list | S05–S08; creation filters, legacy safety, user library review |
| Put real data on the board, or link it to a Particle | S02, S09–S12; source identity, remove/re-add, persisted arrangement, two clients |
| Drive storage with useful in-app display | S13–S16; authorized selected-file flow and provider change/refresh receipt |
| Simple menu-based Private/Public and editing permissions | S03, S17–S20, S22; actual server permission matrix and menu tests |
| Branded shareable one-column mini page | S21–S24; real anonymous page, mobile layout and link preview |
| Existing/new spreadsheet form connection | S25–S32; both destination paths, confirmed submission and retry evidence |
| Beautiful, nimble, smooth existing design | S08/S12/S16/S24/S32 reviews, S34 measurements, S35 acceptance |
| Resume without losing this different-from-main workspace | Resume block and S36; worktree preservation versus remote backup recorded separately |

Do not measure completion by number of new components. The product is complete when one organization can complete the entire journey reliably and another person can consume the result without needing the workspace UI.

## Deferred work and superseded plans

This plan supersedes the execution order and scope of the following documents; retain their historical evidence, applied migrations and useful implementation detail:

- [Original Particle PRD](2026-10-09-coach-house-particle-system-prd.md) and [infrastructure plan](2026-10-09-particle-infrastructure-build-plan.md).
- [File-editor plan](2026-10-14-workspace-file-editors.md): recovery/writable integration, full CSV/Word/native Google editing and version-history UI are deferred. Already-working behavior and applied protections remain.
- [Forms plan](2026-10-14-workspace-framed-editors-and-forms.md): private builder/contracts are reused; response dashboard/general export/bidirectional Sheet editing are deferred. D3 remains explicit.
- [Performance plan](2026-10-13-particle-workspace-performance.md): reuse completed improvements; only measured MVP blockers remain in S34.
- Desktop workstream 07: public freeform layouts, metrics and QR are superseded for this MVP by the user's 2026-10-16 direction. Its original requests remain preserved, not silently declared finished.

External implementation references (verify current installed versions before use): [Google Sheets scopes](https://developers.google.com/workspace/sheets/api/scopes), [Sheets append semantics](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets.values/append), [Next metadata/OG images](https://nextjs.org/docs/app/getting-started/metadata-and-og-images).

## S01 audit and S02/S03 working contracts — 2026-10-16

### Verified baseline and overlap boundary

- Existing branch/HEAD unchanged: `feat/particle-system-20261009`, `86305f24`. Fetched origin/main: `82a88202499e60655b5ec89ea844855defce3578`; 3 ahead/39 behind. No merge/reset. Startup dirty inventory: 142 modified, 2 deleted, 163 untracked entries. All pre-existing changes preserved.
- Port 3008 PID 13851 has the Particle checkout as cwd. No restart, authentication bypass or browser journey performed.
- Main's PR305 adds `organization-document-collaboration` for **profile-backed core documents**. This lane's `document-editing` owns **uploaded-file Yjs rooms**. They are different storage owners, not replacements for one another.
- Direct dirty/main intersections include `src/components/rich-text-editor.tsx`, its `types.ts`, roadmap `use-roadmap-editor-state.ts`, and `src/lib/supabase/schema/functions.ts`. Main also adds `organization.supportAccess` denial to Google Drive context. Reconcile these as a deliberate integration slice before editing shared editor/support/Drive authorization. Do not copy main's editor over this lane's file-session extension or add its context property without its actor model.
- Read the existing room/version/calendar migration receipts: `20261014213000`, `20261014223000`, `20261014233000`, `20261015003000`. The earlier `20261014160000` collision was already resolved; do not replay it. This turn checked recorded receipts, not the live database. No provider read/write or migration applied.

### Capability/owner matrix

| Capability | Existing owner/evidence | MVP disposition |
| --- | --- | --- |
| Saved graph | `workspace-particle-actions.ts` loads `organization_workspace_boards.state.particleGraph`; `authorized-mutation.ts` validates active org/role; `workspace-board-state-write.ts` conditionally writes the canonical board | Reuse. Source-level authorization is an additional check, not established merely by valid IDs or graph ownership. |
| Placement/remove/re-add | `particle-placement.ts`, tool placement/visibility reducers; fixture persistence and library tests | Reuse IDs and `canvasHidden`; remove from board is not source deletion. |
| Document/image placement | `particle-document-library-source.tsx` → `createLibraryDocumentParticle`; file source schema and authorized endpoint resolver | Reuse. Files stay canonical; no copied storage object. Drive currently becomes `format: link`; richer preview capability remains S14. |
| Notes in Documents | `server/note-documents.ts`, `particle-notes.ts`, document library source wrapper | Workspace note re-add uses the existing Particle ID; module notes retain module reference. No second note record. |
| People | Existing People table/add/drop callbacks in `workspace-canvas-surface-v2-view.tsx`; existing person IDs | Reuse the People owner. Schema `personIds` alone does not prove a complete new standalone People editor; no such expansion. |
| Organization/Activities/Fiscal | `workspace-tool-contract.ts`: `organization-overview`, `programs`, `fiscal-sponsorship` | Keep existing tool identities/renderers; never clone organization or fiscal application records. |
| Event/calendar | Canonical Event Activity in graph; `workspace-particle-calendar.ts`, calendar revision signal/migration receipt | Reuse; scheduling/authorization tests pass. Canvas visibility does not unschedule an event. Provider invitations/export are not implied. |
| History | Existing graph history/action tests | Preserve confirmed-change Undo/Redo; no replacement store. |
| Public page | Existing organization profile publication and `src/app/[org]/page.tsx`; no selected-Particle page owner found in focused inspection | New selected-content projection needed. Reuse org brand/slug policy, not the entire private profile JSON. |
| Form | Existing private builder/preview/schema; `organization-forms/server/actions.ts` is empty | New publishing, Sheet destination and submission delivery needed; no claim these already work. |
| Full file writeback/version browser | Uploaded room/version implementation and main core-document editor overlap | Deferred expansion; preserve already-working edits and recovery protections. |

### S02 source/placement contract map (prepared; not a new persisted schema yet)

| Source | Existing typed identity | Add/duplicate/remove rule |
| --- | --- | --- |
| Uploaded file/image | `fileId` UUID, scoped through canonical org file access | A new placement can reference the same file. Duplicating a card never duplicates bytes. Hide/remove placement leaves Documents intact. |
| Profile upload/policy/roadmap | Existing `particleDocumentSourceSchema` discriminants: upload `documentKind`, policy `id`, roadmap `sectionId` | Resolve through existing authorized owner. Titles/file extensions are not identity. |
| Google Drive | `source.kind = drive`, local attachment `organization_external_documents.id`, validated Google `webViewLink` | Store reference; canonical bytes/Google ACL stay in Drive. Public projection is link-only under D2. Link validation does not replace server authorization. |
| Workspace note | `source.kind = workspace_note`, existing Particle `id` | Re-add existing note; never call the new-document factory for it. Deliberate Duplicate creates an independent note, not an alias. |
| Lesson note | `source.kind = module_note`, `moduleId` | Keep personal `module_progress(user_id,module_id)` content; the shared card references a lesson, and each viewer reads their own notes. Never publish a lesson-note body or convert it into shared content implicitly. |
| Person | Existing People owner IDs; Particle `personIds`/typed `source` where supported | Resolve org-scoped record server-side; link/place never copies private contacts into public payloads. |
| Workspace tool | `WorkspaceToolId` within active organization | Singleton placement/visibility; underlying source untouched. |
| Intrinsic activity/form/other retained Particle | `Particle.id` plus workspace/revision | New preset creates new domain record; re-add restores same one. Duplicate creates an independent draft and new child IDs. Saved retired kinds remain editable. |
| Shared page membership (new) | Proposed stable page ID + org ID + ordered source/placement references + committed public revision | One source may appear on multiple pages. Membership/order does not change board positions or roles. Server resolves saved sources, validates access, then serializes an explicit allowlist. |

S02 remaining: verify source-level missing/cross-org rejection across every placement/link path; select a concrete page-membership schema with S18 owner rather than adding another generic reference type now. Schema validation and UI-disabled state are not authorization evidence.

### S03 permission matrix (prepared; server/RLS implementation still pending)

The existing organization publication action delegates to `updateOrganizationProfileAction`, which uses `canEditOrganization`: owner/admin/staff. Reuse this publication-role boundary; do not introduce another role. Main support sessions must remain denied public/provider mutations until their explicit support policy is reconciled.

| Actor | Source read/edit | Place/link | Publish/update/private | Public view | Submit form |
| --- | --- | --- | --- | --- | --- |
| Same-org owner/admin/staff | Existing source capability + entitlement checks | Existing workspace edit capability **and** source access | Existing org publication role + source access + revision validation | Published allowlisted content | Published valid form only |
| Same-org board/member/read-only | Existing source read capability; no implied edit | Deny without existing workspace edit capability | Deny | Published allowlisted content | Published valid form only |
| Other organization | Deny private source by default | Deny | Deny | Published allowlisted content only | Published valid form only |
| Anonymous | No private source read/edit | Deny | Deny | Public committed projection only; Private/revoked unavailable | Published form, validated/rate-limited; no response-read rights |
| Temporary support access | Reuse exact support grant restrictions | No inferred expansion | Deny until explicitly covered by support policy | Same public projection | Same public form surface |

No new entitlement/paywall policy is chosen here. Existing roadmap-specific paid publishing checks must not accidentally become a new board-page paywall. Resolve the actual shared-page entitlement requirement before wiring its mutation. Public field allowlists remain to be encoded and tested; no private response, contact detail, fiscal application, signed URL or provider token can be serialized by spreading domain objects.

## Durable checkpoint ledger

Unlisted steps remain **planned**. Prior infrastructure/UI test results are historical evidence, not completion receipts for this new end-to-end sequence.

| Date | Step | Status | Evidence / decision | Next / blocker |
| --- | --- | --- | --- | --- |
| 2026-10-16 | Planning | Saved | Read current plans, source library and form action stub; verified exact worktree/HEAD/dirt and listener cwd. No application edits or provider changes. | Start S01; D1/D2/D3 unresolved. |
| 2026-10-16 | S01 | Locally verified audit | Fetched main, identified core-document versus uploaded-file room owners, traced canonical graph/file/person/event paths, inspected applied migration receipts. 66 source/history/event/action tests pass. No live data validation this turn. | Shared-editor/support integration boundary recorded above; library work independent. |
| 2026-10-16 | S02/S03 | Active; contracts prepared | Source/placement map and role matrix above. User explicitly accepted D1 and D2. Existing fixtures confirm file references/legacy parsing; public schema/allowlist and authorization tests remain. | Finish source validation/contract tests, then S04 fixture. D3 deferred until S27. |
| 2026-10-16 | S05/S06 | Locally verified | Removed Timer/Workflow/Split/Calculate/Checklist creation entries and workflow command/menu. Removed bottom placed grid; available-only search and all-placed states. Saved legacy schemas/renderers and real activity checklists retained. 153 focused tests; scoped tsc and ESLint pass. | User reviews reduced library on port3008; S07/S08 not yet marked reviewed. |
| 2026-10-16 | Preservation | Local only | Four application files and three existing test files changed this slice; plan/index/monthly log updated. No commit/push/merge/restart, migrations, provider mutations, release or visual-baseline update. | Resume this existing dirty worktree. Test logs: `/tmp/particle-mvp-{library-tests,baseline-tests,library-lint,library-types}.log`. Graphify refreshed 22322 nodes/73558 edges; two pre-existing parser warnings (calendar/optimistic-placement tests). |

| 2026-10-16 | S02a | Locally verified | File/image/Drive placement validation; 82 focused tests across action/files/history/library suites. Scoped TypeScript/ESLint and import boundaries pass; Graphify refreshed (two existing test parser warnings). No provider calls or schema changes. | S02b source owners, then S03 allowlist. Logs `/tmp/particle-source-access-{tests,types,lint,boundaries,graphify}.log`; final type/graph completion recorded in monthly log. |

| 2026-10-16 | S02b/S03a | Locally verified contracts | Primary profile/lesson/note sources checked; strict public preview DTO and scoped role predicate; 118 focused tests pass. People local-placement gap recorded. No public writer/route or provider/DB mutation. | S04 representative fixture, then S09 durable authorized People placement. Final validation `/tmp/particle-profile-public-{tests,types,lint,boundaries,graphify}.log`. |

| 2026-10-16 | S09a | Locally verified foundation | Source-authorized person placement commands, single-person variant, duplicate guard and lossless local recovery planner. 159 focused tests, scoped TypeScript/ESLint, boundaries and manifest pass; Graphify 22357 nodes/73724 edges (two existing parser warnings). | S09b single-session UI integration; S09c recovery acknowledgement and two-client checks. Current People UI still local; no migration, browser/provider/release claim. |

At the end of each work session append a row and update the Resume block. Include changed files, tests and results, user review, provider/migration actions, local/remote commit state, unfinished operation or process, and exact next step. If cut off mid-step, the next chat rechecks its affected diff and evidence; it does not assume completion or restart the whole plan.

| 2026-10-16 | S09b1 | Locally verified | Lifted one session to workspace owner; shared People control commands; 66 focused tests, scoped TypeScript/ESLint and boundaries pass. | S09b2 renderer/endpoint/gesture integration, then S09c local recovery. No UI activation, data migration, provider or release claim. |

| 2026-10-16 | S13 entry points | Implemented; 85 local tests pass | Workspace OAuth return and discoverable Add-to-canvas for Documents; existing drag/reference/provider-open reused. | Await connected user review; fix Core Document provider-ID/local-attachment-ID mismatch, then bounded previews. People wiring deferred after user scope correction. |

### 2026-10-16 — S13 Core Document source identity fixed

- `documents-particle-reference.ts` emits a distinct `roadmap_drive` source with section ID, provider file ID and Google URL. The existing document adapter renders a link card/Open original with no byte endpoint. No database migration. Old `drive` attachments and saved graph records remain readable.
- Existing profile-source authorization checks the actor-visible organization, active Core source and exact saved file ID/URL before new placement or re-add. Missing/replaced/disconnected sources fail without committing the graph. Ordinary movement/hiding does not requery the source. No fallback that trusts arbitrary Google links.
- 86 focused tests pass (actions/files); scoped ESLint and diff hygiene pass. Type and graph refresh receipts: October runlog; `/tmp/particle-core-drive-{tests,types,lint,graphify}.log`. No authenticated provider/visual verification or release claim.
- Resume at S14/S15. The prior Core placement identity gap is closed locally; user review of real Google placement remains open.

### 2026-10-16 — S14/S15 on-demand Drive preview

- Decision: use Google’s embedded file viewer on explicit open in `ParticleFileViewer`. This keeps files in Drive and authorization with the viewing Google account. It also avoids new Vercel download/convert functions. No new API, migrations, scopes, storage copies, shared-cache or provider-permission writes. Reference: [Google Workspace Developers embed guidance](https://dev.to/googleworkspace/embed-images-from-google-drive-in-your-website-11k6). Google’s preview styling/format support is provider-owned.
- `particle-drive-preview.ts` derives only allowlisted HTTPS Google preview URLs from canonical source links. Never substitute a local attachment UUID. Core provider IDs must match their link; preserve valid `resourcekey`, discard account/auth/arbitrary parameters. Folder/published/unsupported links remain Open original. This helper does not grant access.
- `ParticleDocumentCard` keeps the title once in its existing caption and offers Preview file/Open original. Explicit preview uses the existing Motion viewer; `ParticleDrivePreview` supplies accessible frame naming, a reduced-motion-compatible loading state and bounded slow/error feedback. Refresh lives in the viewer header. Closing unmounts the frame; reopening mounts anew. No remount caused by ordinary card movement, typing or resize. No new freeform editor.
- Freshness policy: explicit open/reopen or Refresh reloads the provider viewer. There is no app interval, focus listener, server action or byte cache. One frame per open viewer; no app-side duplicate content fetch. Google may make its own requests, and its caching/access controls remain provider-owned. Cross-origin frame load is **not** proof that file access succeeded or content is current. Do not display a fabricated last-synced claim.
- 54 focused file tests passed: supported link identity, malformed hosts/credentials/ports/path rejection, Core identity mismatch, resource keys, no frame or fetch in the canvas card, accessible isolated viewer markup. Scoped ESLint and React Grab ownership pass. Type/graph receipts and job pointers: October runlog; `/tmp/particle-drive-preview-{tests,types,lint,ownership,graphify}.log`.
- Pending: real signed-in Google preview, browser-cookie restrictions, native Docs/Sheets and PDF/image/Office/text format coverage, external edits/Refresh, close/focus return and visual acceptance. No provider/browser/request-trace or 60fps claim from SSR tests. User has been asked to review Preview/Refresh/Open original on port3008. No visual baseline changes before that review.


### 2026-10-16 — S18 private page membership and snapshot boundary

- Reused the existing public Particle DTO; scaffolded `workspace-sharing` for page contracts. Removed its generated placeholder panel/controller/action. Strict draft membership has 1–50 unique Particle IDs in deliberate order; a separately allowlisted brand/content snapshot changes only through future explicit Publish/Update. No board/source copy, per-person ACL or history interface.
- Added `20261016183000_workspace_page_membership.sql`, matching rollback, typed Supabase table and schema registry entry. Forced RLS: owner/admin/staff scoped reads, no platform/support-only bypass, no anonymous table reads or client writes. Source IDs are private membership metadata; public reader/writer remain disabled. Service-role-only DML is reserved for S19's validated writer. No Realtime subscription/polling or provider changes.
- 17 focused contract tests pass. Real PostgreSQL14 fixture passes: ordered/duplicate/invalid membership, uniqueness, private defaults, snapshot/draft independence, owner/admin/staff/member/board/outsider/anonymous access, forged role claim, direct write denial, org cascade, source preservation and rollback. Fixture uses only synthetic data in `workspace_sharing_fixture_20261016`, isolated server `/tmp/coach-house-workspace-sharing-pg-20261016`, port55436. Server stopped cleanly after tests. No linked-project migration applied. S19 still must enforce source existence/authorization, transactional stale-write checks, current role rechecks and idempotence; these are not established by this table alone.
- Scoped TypeScript and ESLint pass; diff hygiene passes. Acceptance manifest synchronized for the new test while preserving existing lane entries. `pnpm check:features` still fails at the pre-existing `workspace-particles/index.ts` server-internal exports; the new feature has no reported contract violation. Do not silently claim a global feature-gate pass or expand this slice to refactor the older Particle API.
- Logs: `/tmp/workspace-sharing-{contracts,database,types,lint,features,graphify}.log`; scoped config `/tmp/workspace-sharing-tsconfig.json`. Prior Drive Graphify job38054 finished (22372 nodes/65791 edges). Code refresh67614 completed successfully: 22411 nodes/65841 edges/1212 communities, with the same two known calendar/optimistic-placement parser warnings. No background job remains.
- Next S19 authorized atomic Publish/Update/Private writer, S20 canonical linked-resource/public asset boundary, then S17/S22 real Share command/window. S18 was taken before exposing Share because it provides the required persisted page identity. User's connected Google review remains pending independently. No UI redesign, browser/visual-baseline claim, live provider/DB write, restart, commit/push/merge or release. Port3008 remains existing PID13851. Work is local/untracked and requires this exact checkout for recovery.

### 2026-10-16 — S19 authorized publication writer

- Extended `workspace-sharing` with strict review/write commands, saved-content projection, authenticated organization context, review tokens, service and callable server actions. Requests cannot supply actor/org IDs, visibility or snapshot JSON. The server rereads saved content; only selected intrinsic supported Particles project. External Drive/uploads, source-backed records, contacts and fiscal content remain blocked until S20. No UI/menu exposed prematurely.
- Added `20261016190000_workspace_page_commit.sql`, rollback, typed RPC and receipt columns. One service-only transaction locks the organization/current membership, page and board; rechecks current owner/admin/staff authorization, page revision, selected source presence, exact freshly read graph and organization freshness. Draft saves preserve publication; explicit Publish/Update commits the reviewed snapshot with stable link identity. Make Private remains possible with missing sources or sharing flag disabled. Reused operation IDs cannot change payload/actor; successful retries return the confirmed result without republishing; older requests cannot resurrect a revoked page. One latest receipt, no history UI/table or polling. Cache invalidation occurs on confirmed actions/replays, never previews or typing; retries can repair interrupted invalidation. A timeout reports an unconfirmed save rather than falsely claiming the database stayed unchanged.
- Preview token binds selected public content/order/page revision, not canvas geometry or unrelated private profile edits. Final RPC still compares the freshly loaded graph under lock, rejecting edits during commit preparation. Source/projection work occurs outside the short database transaction. Public-sharing feature flag remains in force; revocation does not depend on it.
- Files: `workspace-sharing/lib/page-schema.ts` (moved existing schemas), `page-command.ts`, barrel; `server/page-context.ts`, `page-projection.ts`, `page-service.ts`, `actions.ts`; feature README; Supabase page table types/function registry; migration/rollback; `workspace-sharing-writer.test.ts`, `workspace-sharing-database.test.ts`, SQL commit fixture/test and acceptance manifest. No canvas/editor/provider architecture changed.
- Verification: 38 schema/action tests plus six independent-psql-session concurrency tests pass. SQL tests verify service-only execution, owner/admin/staff permissions, board/outsider/removed-role denial, stale graph/page conflicts, identity reuse, missing sources, unchanged publication after draft save, revoke and safe writer rollback. Concurrent sessions prove conflicting Publish/Private, duplicate publication, membership downgrade, board edit and organization edit acquire the intended locks and cannot publish stale state. Scoped TypeScript/ESLint and diff/manifest checks pass. Prior S18 tests remain valid for untouched membership/table policy. Existing global `check:features` failure at `workspace-particles/index.ts` server-internal exports remains unresolved; no broad quality/CI/release pass claimed.
- Reproduction: provision `supabase/tests/workspace-sharing-commit-fixture.sql` only in a marked disposable local database; run `workspace-sharing-commit.test.sql`, then `WORKSPACE_SHARING_TEST_DATABASE_URL=postgresql://127.0.0.1:55436/workspace_sharing_fixture_20261016 pnpm exec vitest run tests/acceptance/workspace-sharing-database.test.ts`. Fixture rejects shared/remote databases; concurrency harness never reads application database credentials. Logs: `/tmp/workspace-sharing-{writer-tests,concurrency-tests,commit-database,types,writer-lint}.log`.
- Linked Supabase migrations remain **unapplied**. This is a locally verified infrastructure slice, not usable public sharing yet. Public reader/revocation-at-read boundary, canonical Drive resolution, protected assets, branded route and Share menu/window remain pending. No browser/visual-baseline/provider verification, server restart, commit/push/merge/deploy or release. Keep existing localhost3008 and this dirty checkout. Next S20 → S21 → S17/S22; no People expansion.
- Maintenance/recovery: scoped TypeScript session58913, ESLint82621 and final six-session concurrency suite74700 completed exit0. Disposable PostgreSQL14 server at `/tmp/coach-house-workspace-sharing-pg-20261016`, port55436, stopped cleanly; synthetic fixture remains only in its local data directory. One Graphify refresh is running as session71999, log `/tmp/workspace-sharing-writer-graphify.log`; reuse/check this job, do not launch another. AST extraction finished with the two existing calendar/optimistic-placement parser warnings. Final graph receipt pending. Port3008 listener checked, no restart.

### 2026-10-16 — S20 canonical Drive/public boundary and S21 branded route

- Finished the next supported source-to-public boundary, then connected a real public route/rendering path. No Share controls were added before their state/persistence connection. Next is S17/S22, not more People or editor expansion.
- New `workspace-sharing/lib/drive-public-link.ts` normalizes only supported HTTPS Google document/file URLs, verifies provider identity, strips account/token/query/fragment data and preserves one valid optional resource key. `server/page-drive-sources.ts` batches only selected attachments through actor RLS and exact organization/provider/available filters; Core Drive references resolve from canonical profile sections. Source queries occur only at review/Publish. No Google calls, ACL changes, copied bytes or background polling. Provider reference: [Google resource keys](https://developers.google.com/workspace/drive/api/guides/resource-keys).
- Extended the **unapplied** S19 RPC/migration before deployment: compare current Drive metadata under stable-order row locks, exact profile for Core Drive sources, and claimed/unreserved organization URL. Added reader migration/rollback `20261016200000_workspace_page_public_read.sql`, RPC type, strict server reader and request-local cache. Each public request checks current visibility and organization-handle ownership/reservation in one bounded lookup. Public output is only `snapshot` + `publishedAt`; no private draft revision or membership. No cross-request content/visibility cache or fallback to stale content. Raw anonymous/authenticated page-table and reader-RPC access remains denied; only the bounded public server reader uses service access.
- New `src/app/[org]/[uniqueLink]/{layout,page,loading,error}.tsx` uses existing `[org]` routing, so it coexists with `[org]/roadmap` and `[org]/program/[programId]`. Existing public-handle reservations cover application names such as workspace; reader/writer enforce the actual organization claim. The pre-stream layout gate fixes a verified streaming soft404: malformed links now return real HTTP404. Layout/metadata/page reuse one request-local lookup.
- New static `PublicWorkspacePage` uses shared `WorkspaceNodeFrame` anatomy, muted rounded outer frame, inset card body, compact header and one column. Organization name/initials appear first; no canvas controls, type/status chrome or editor/provider SDK in the renderer. Safe ReactMarkdown/GFM: raw HTML skipped, unsafe/relative links blocked, external links protected, Markdown images do not fetch private/third-party URLs, wide tables scroll with keyboard focus. Events show locale-aware UTC labels. Loading honors reduced motion; error UI offers real Retry. Static content has no decorative entrance animation. This follows `docs/design.md` restrained surfaces/motion and the user's more specific Particle frame geometry.
- Basic OG/Twitter title/description/canonical metadata uses committed public content only. Reused the existing `publicOrigin()` helper by exporting it; its behavior is unchanged. Private/missing pages have the same non-indexable metadata; individual page sharing does not opt the organization into search indexing. Generated OG images/public logo grants remain S23 work.

Current public capability matrix:

| Content | Current result |
| --- | --- |
| Intrinsic objective/activity text, standalone notes, event time/location, color | Allowlisted published snapshot; no contacts/attendees or private source data |
| Documents attachment / Core Document backed by Drive | Verified normalized provider link; existing Google access remains in effect |
| Uploaded image/PDF/Word/CSV, profile-owned private files | Publication blocked; public reader rejects ungranted asset DTOs; no guessed URL/proxy |
| Lesson notes, People/contact records, unsupported/fiscal sources | Blocked; no private content copied into public data |
| Form definition | Safe definition preview only; responses/Sheets/submission UI remain later steps |
| Brand | Committed name + safe initials; uploaded logo/media grants remain pending |

- Verification: **76 schema/action/source/render/metadata tests + 7 independent-session database concurrency tests pass** for current code. Updated SQL commit + public-reader tests pass: canonical metadata/profile freshness, claimed/reserved handle rules, committed-only output, wrong org/link denial, revocation, raw access denial and rollback. Scoped TypeScript includes repository ambient icon declarations; ESLint, route contract and diff/manifest checks pass. HTTP smoke at existing localhost3008: malformed public link returns404 in ~0.99s (development; not a performance benchmark), no build/module error. Published-content browser/theme/mobile review, actual anonymous app→linked-DB journey, bundle inspection and visual baselines remain unverified. No linked migrations, provider mutation, commit/push/merge/deploy or release.
- Changed files: feature source/reader/renderer/metadata/loading/error modules and public barrels; S19 migration/rollback + new reader migration/rollback; Supabase function types; existing public-origin export; four route wrappers; source/page tests, updated concurrency fixture/test, new reader SQL test and acceptance manifest. Logs `/tmp/workspace-sharing-{public-tests,sources-concurrency,sources-database,public-read-database,page-types,sources-lint,routes}.log`; HTTP body `/tmp/workspace-sharing-public-route.html`.
- Next S17/S22 mappings: `ParticleActionMenu` → existing `ParticleNodeData.onOpen` / `useParticleSelection` → `useParticleFlow.controls` → `WorkspaceParticleInspectorSlot` in `workspace-particle-dock-content.tsx`. Use the existing window/header portal, not a new drawer. Selection currently tracks only calendar-entry requests; add sharing as transient UI state, preserving node identity and dirty/history guards. `useParticleSelection` still has a legacy native confirm: do not introduce that into the new sharing journey; protect dirty same-Particle view changes and use the established application discard UI. Load/create page, select/reorder saved membership, review, explicit Publish/Update, Copy link and Make Private must form one usable interaction before calling S22 complete. Preserve operation IDs after ambiguous save failures.
- Maintenance/recovery: prior Graphify71999 completed (22477 nodes/65992 edges/1204 communities). This slice's single refresh15450 completed exit0; log `/tmp/workspace-sharing-public-graphify.log` (AST code update, same two existing parser warnings; no full semantic-document extraction claimed). No graph job remains. Disposable PostgreSQL14 at `/tmp/coach-house-workspace-sharing-pg-20261016`, port55436, stopped cleanly. Current synthetic fixture database is `workspace_sharing_fixture_20261016_sources`; original earlier fixture remains separately. All data stays local; no application credentials were used by the database concurrency harness. Localhost3008 is still PID13851, no restart. Changes remain uncommitted/untracked in this exact checkout.

### 2026-10-18 — S17/S22 connected Share window; database activation gate

- **Implemented:** existing top-right Particle menu → Share; right-click opens the same commands, preserving native menus in links/inputs/buttons. New page captures one Particle or current multiselection without changing board positions. Existing recent pages are organization-scoped; list queries return only thin summaries, capped at50. Only the selected page loads its full draft/publication. Unsaved/foreign selected IDs fail on the server. No row is created merely by opening Share.
- **Journey:** local title/intro/membership → keyboard or Motion grip reorder → exact embedded public preview → explicit Publish/Update. Save draft never replaces the publication. Copy link/Open public page appear only for a confirmed Public page. Make Private preserves unsaved local draft text. Edit invalidates review; server rechecks canonical content, role, revision and review token. Pending requests cannot double-submit. Ambiguous responses preserve the exact operation UUID/payload for Retry; definite conflicts preserve draft/prior publication and allow review or guarded reload. No optimistic public status or guessed link.
- **UI:** reused existing content window/header portals, compact controls, larger intro field, no generic Backlog selector or second drawer/store. New Share discard/switch UI uses shadcn AlertDialog; dirty cross-view selection is blocked with existing toast. Other legacy Particle confirmation behavior is unchanged. Validation focuses the actual invalid input/selection; status/error feedback and coarse-pointer44px targets are present. Motion reorder uses a dedicated grip and keyboard alternatives; only local order changes during drag. Preview uses150ms opacity with reduced-motion handling; public renderer's embedded mode avoids nested main/full-viewport height. Follows `docs/design.md` restraint and established Particle geometry. Reference: [Motion Reorder](https://motion.dev/docs/react-reorder). Browser motion/focus/touch smoothness is **not established** by SSR tests.
- **Files:** `workspace-sharing/{lib/page-draft,page-editor,page-membership;hooks/use-page-editor;server/page-editor-data,actions,page-service,page-projection;components/workspace-share-panel,share-page-header,share-page-members,public-workspace-page;client}` plus existing schema/barrels. Particle node/action menu/menu overlay/selection/flow and the two existing workspace dock composition modules connect the feature. New editor/data acceptance suites and embedded-preview/writer ambiguity assertions; existing acceptance manifest synchronized. No new application dependency, database schema addition beyond the three already-planned migrations, provider integration or storage copy.
- **Verification:** initial six-suite sharing run94passed; four new multiselect/reorder assertions and one new post-commit invalidation assertion followed. Latest affected editor/data/writer/card/calendar run72passed (`/tmp/workspace-share-interactions-tests.log`); retained contract/source/public-renderer cases remain valid. Scoped TypeScript (including both app composition modules, `next-env.d.ts` and existing ambient icon declarations) passes: `/tmp/workspace-share-ui-final-types.log`. Scoped ESLint plus final panel annotation check, boundaries, React Grab ownership, manifest and diff checks pass. No full quality/CI/release or browser baseline claim. Existing unrelated Particle feature-entrypoint guard failure remains recorded, not repaired here.
- **HTTP/environment:** existing PID13851 still owns this exact checkout/port3008; no restart. Unauthenticated `/workspace` returns307 to authentication, so this is **not** a logged-in Share journey. Invalid public URL returns real404 (~5.35s after development compilation; not a benchmark). No browser restriction bypass. Disposable PostgreSQL remains stopped; prior SQL/concurrency receipts are unchanged because this slice changes no SQL body.
- **Migration collision repaired before application:** reader/rollback renamed from historical `20261016200000_workspace_page_public_read.sql` to `20261018120000_workspace_page_public_read.sql`; fixture/read-test references and active schema/README documentation updated. Historical October16 receipts above retain the old name. Fresh linked history confirms production `20261016200000` belongs to fiscal review/tasks/CC; never replay/replace it.

#### Exact live migration review / next authorization

Target verified read-only: Coach House Production, project `vswzhuwjtgzrkxknrmxu`; this preview's Supabase host matches. Fresh metadata confirms no `organization_workspace_pages`, writer or reader exists; boards, Drive attachments and handle/reservation dependencies do exist. Logs: `/tmp/workspace-share-migration-review.log`, `/tmp/workspace-share-live-preflight.{json,log}`. No real page/application data was read or changed.

Apply **only** these reviewed files, in order, after explicit authorization:

1. [Private membership table/RLS](../../supabase/migrations/20261016183000_workspace_page_membership.sql),64lines: one organization-scoped page table, helper and index; forced RLS, authorized reads, service-only writes, no anonymous table access.
2. [Atomic writer/receipt](../../supabase/migrations/20261016190000_workspace_page_commit.sql),154lines: receipt columns and service-only revision/source/role-checked transaction. No backfill, board change or file/Google ACL mutation.
3. [Public snapshot reader](../../supabase/migrations/20261018120000_workspace_page_public_read.sql),17lines: bounded service-only current-visibility/claimed-handle reader; no private fields or anonymous table/RPC grant.

S18 explicitly requires “Live migration requires exact review and explicit authority.” Earlier document-editor migration approval is not assumed to cover this newer publication table. No broad `db push`, unrelated history repair, production flag enablement, deployment or public page creation is authorized by this checkpoint. The installed CLI supports `supabase db query --linked --file` for exact SQL; use the verified canonical project link, transaction/history recording and independent readback after authorization. Recheck exact schema/version state immediately before applying; do not infer absence solely from migration history or retry after an unknown result without readback.

Matching rollback files are present. Reader/writer rollbacks disable their new functions while retaining saved pages; the membership rollback removes the new page table and its data, so it must not be used on populated pages without preserving them and explicit data-loss approval. Prefer disabling publication/revoking individual pages over destructive rollback after real use.

- **Next:** obtain exact migration authority → apply/verify the three files → user reviews Select3of10/Preview/Publish/Update/Copy/Private, role denial and dirty/conflict paths on localhost3008. Then S23 richer OG previews/S24 anonymous review. Uploaded media grants, brand logos, forms/Sheets and D3 remain later; no People expansion. Current Share app→linked-DB path is not yet usable; do not claim public rollout.
- **Maintenance/recovery:** single Graphify4340 completed exit0 (`/tmp/workspace-share-ui-graphify.log`, AST-only). Three parser warnings: the two existing calendar/optimistic-placement mocks plus the new editor suite's same valid TypeScript mock pattern; TypeScript/Vitest pass. Semantic/community labels are not freshly generated. All test/type/lint/graph/metadata jobs finished. No commit/push/PR/merge/deploy or migration applied; preserve this exact dirty/untracked checkout.


### 2026-10-19 — Production sharing migrations applied and verified

- **Authority/target:** user explicitly said “apply them.” Rechecked canonical linked project `vswzhuwjtgzrkxknrmxu` (Coach House Production), missing page table/helper/writer/reader, absent three migration versions and existing canonical dependencies immediately before mutation.
- **Applied only:** `20261016183000_workspace_page_membership.sql`, `20261016190000_workspace_page_commit.sql`, `20261018120000_workspace_page_public_read.sql`. Exact reviewed bytes executed in one transaction with a migration advisory lock, 5s lock timeout, 30s statement timeout, precondition guard, exact-source history rows and PostgREST schema reload. No broad push, history repair, source/board edits, backfill, Google/asset permissions or application page creation. Existing fiscal `20261016200000` preserved.
- **Independent readback:** all three migration history sources match local files byte-for-byte; all three installed function bodies match their reviewed source; functions are security invoker with empty search path, service-role execution only (anonymous/authenticated false). New table has enabled+forced RLS, the authorized-editor SELECT policy, expected constraints/indexes and no anonymous/client write grants. New page count is zero. Existing service-role default extra privileges remain; no client privileges were added beyond reviewed authenticated SELECT.
- **Receipts:** `/tmp/workspace-sharing-production-20261019-{manifest.json,apply.json,apply.log,verify.json,verify.log,bodies.json,bodies.log}`; exact transaction `/tmp/workspace-sharing-production-20261019.sql`. SHA256: membership `8adb0ecba02a944931ce82ca383359386c996221dbbac5a581ccdbce4f1622db`; writer `7be78ea467d9824fa7759c3c2296717fe3ce59814f5734c9f9ff79748b3cd227`; reader `22bc79384f002825f5fe3682bc3b6728ca82f1e85f3af86f26682135405b60b6`.
- **Next:** local-preview `NEXT_PUBLIC_PUBLIC_SHARING_ENABLED` configuration/verification → connected selection/order/Preview/Publish/Update/Copy/Private review with an explicitly chosen sample → S23 bounded rich link image → S24 anonymous/revocation review → public media grants and Forms→Sheets. This migration authority does not enable the Production flag, deploy source or authorize publishing real organization content. Local implementation remains uncommitted/untracked; no PR/CI/release or browser verification claim. No server restart or application source change; prior focused checks remain valid. Documentation-only checkpoint, no redundant Graphify refresh.


### 2026-10-19 — Desktop handoff and foundation-first scope order

- User requested all chat to-dos/statuses and connected plans in one Desktop Markdown handoff, with core workspace interaction/layout/behavior completed before feature interiors. Saved `/Users/calebhamernick/Desktop/Coach House Workspace MVP - Resume Plan.md`: recovery prompt,8 bounded foundation checkpoints, all36 MVP steps,28 supporting references, prior implementation/deferred boundaries, exact applied migration identities and release limitations.
- The priority override above is authoritative for next execution. Start W1, reuse implemented behavior and narrow fixes; do not resume sharing/forms or People expansion first. Existing36-step numbering/evidence stays intact.
- Documentation only. Verified all local file links and step anchors; diff check passes. No application tests, Graphify refresh, server/provider/database action, commit/push or deployment needed/performed. Desktop document links local originals; it is not a source/remote backup.

### 2026-10-19 11:23 EDT — Context recovery and fresh foundation preview

- Resumed the selected existing branch at `86305f24`; 0 staged,153 unstaged,188 untracked entries,3 ahead/44 behind the existing local `origin/main` ref. No fetch, merge, reset, cleanup or application edits. Existing dirty implementation and unrelated servers preserved.
- Verified old listener13851 belonged to this checkout and Node22 before stopping it. Started Node22.13.0 `node_modules/next/dist/bin/next dev --port 3008`; new listener54213 has this exact cwd, exec session68456. Ready in1232ms; no cache deletion or environment/feature-flag edits. Opened the workspace URL for user review. Unauthenticated `/workspace` returns307 to `/login?redirect=%2Fworkspace`; this is server readiness, not authenticated canvas acceptance.
- Read the required instructions, original07/SHIP references, Desktop handoff and this plan. Graphify/source inspection confirms the existing shared Particle session and flow/layout/history owners; People placement still uses browser UI preferences. Reuse those implementations and prior valid tests. No new test run or graph refresh for this context-only slice.
- Fresh compilation receipt: unauthenticated login destination returns200. Opening the user browser also produced authenticated `GET /workspace 200` (21.5s cold request,13.1s compilation,8.0s application work), with no compilation errors. Server timings flag layout/data loading for later measured review; this is not a steady-state performance benchmark or visual/interaction acceptance. Documentation diff check passes.
- W1 remains next: establish exact current defects using organization/activity/note/image/document cards and focused navigation/window review, distinguishing local state from shared persistence. Then W2–W8 narrow fixes/verification. Public sharing, Forms→Sheets and People expansion stay paused/deferred. No authenticated interaction, provider, CI or release claim; uncommitted source still requires this checkout for recovery.

### 2026-10-19 — User-directed canvas outer inset

- Scope: user requested almost-zero outer canvas gaps with slight nesting; existing plan/W1–W8 remains paused pending user direction. Changed only `src/components/app-shell/app-shell-inner.tsx`: desktop `/workspace` left/right/bottom inset4px; other routes and mobile safe-area/navigation spacing retain their prior rules. Shared rounded frame and Particle menu unchanged. Uses the4px spacing scale from `docs/design.md`.
- Live authenticated preview measured prior right20px/bottom16px, now left/right/bottom4px; canvas grows1530×878 to1542×890 at1792×952, no document horizontal overflow. ESLint and3 existing `app-shell-header-layout` tests pass. User appearance acceptance and affected Linux visual baseline remain pending; no baseline replacement before review.
- Canvas-inset Graphify update8502 completed successfully; log `/tmp/particle-canvas-inset-graphify-20261019.log`. No provider/database/feature-flag/Git release changes.

### 2026-10-19 — User-directed dock and window gaps

- Reduced shared `workspace-dock.module.css` dock bottom inset and window separation from16px to8px. Updated `workspace-content-window-geometry.ts` available-height allowance from48px to32px, preserving16px above maximized windows, and adjusted the existing geometry assertions. Prior dirty changes preserved; no changes to tab/content behavior.
- Authenticated preview with Documents open confirms dock bottom8px, visible window/host separation7px (8px CSS offset minus the panel border), window inside canvas and no document horizontal overflow.67existing UI/host cases, scoped ESLint and diff checks pass. User appearance acceptance/affected Linux baselines remain pending.
- One Graphify refresh running as exec session55690; `/tmp/particle-dock-gap-graphify-20261019.log`. Previous8502 finished exit0. MVP/W1–W8 stays paused; await the user's next specific request. No release/provider/database action.

### 2026-10-19 — Team-access pill left padding

- User-directed narrow spacing change: team-access trigger left padding8px→4px; right8px and height36px retained. Source owner `workspace-board-team-access-header-action.tsx`; shared Button/hover card unchanged. Live computed CSS confirms4px left/8px right/36px height. No new tests; existing team-access suite and scoped lint used.
- Prior dock Graphify55690 is still running; no duplicate launched. This subsequent one-line source edit needs inclusion in the next batched refresh after55690 completes. Paused backlog remains paused.

### 2026-10-19 — Team-access hover card shadow

- User requested removing this popover's drop shadow. Added `shadow-none` only at `workspace-board-team-access-hover-card.tsx`; shared HoverCard default retained for other surfaces. Open live popover has only transparent zero-size shadows; lint/diff pass. No behavioral test added for this reversible class edit. Include this and trigger padding in the next batched Graphify refresh after55690; paused backlog unchanged.

- Maintenance: dock refresh55690 finished exit0. Started one batched refresh covering both team-access style changes; log `/tmp/particle-team-access-graphify-20261019.log`. Reuse this job; no duplicate extraction.

### 2026-10-19 — Shared sidebar horizontal inset

- Reduced the existing `--shell-rail-padding` token from12px to8px in AppShell and the collapsed SidebarProvider override. Header, main groups and footer share the same8px edge; nested Coaching/Resources groups correctly retain0px extra padding inside the padded footer. No duplicated sidebar wrappers or per-button overrides.
- Live expanded and collapsed checks confirm8px section padding, with nested footer groups aligned at the same edge; restored expanded state, no horizontal overflow. Existing sidebar-state/header-layout tests and scoped lint/diff run for this slice. User appearance review/affected Linux baselines remain pending.
- Team-access Graphify17344 still running (`/tmp/particle-team-access-graphify-20261019.log`); include these two token edits in next batched refresh after completion, no duplicate job. Paused backlog remains paused.

### 2026-10-19 — Canvas corner radius

- Reduced only `/workspace` desktop shell radius28px→24px using a scoped shell radius token and existing28px fallback. Live computed styles confirm24px on all four canvas corners; lint/diff pass. Mobile flush frame and other routes retain existing radii. No new test for this style-only edit; user appearance review/affected Linux baseline pending. Batch graph maintenance with preceding sidebar edits after17344 completes; no duplicate extraction. Prior backlog remains paused.

- Maintenance: team-access refresh17344 finished exit0. Started one batched sidebar/canvas-radius refresh; `/tmp/particle-shell-spacing-graphify-20261019.log`. Reuse/check this job before any subsequent graph refresh.


### 2026-10-19 — Light-mode canvas background

- Changed the canvas backing surface from `bg-background` to `bg-zinc-50`; grid styling and `dark:bg-zinc-800` remain unchanged.
- Focused ESLint and diff whitespace checks passed. Authenticated preview confirms the light surface is `lab(98.26 0 0)` with the grid still transparent and its existing pattern color unchanged.
- Prior batched Graphify refresh completed successfully. Background-color refresh is running in session `85102`, log `/tmp/particle-light-canvas-graphify-20261019.log`; check/reuse before another refresh.


### 2026-10-19 — Remove Accelerator banner reopen button

- Removed the About Accelerator button and its empty wrapper from the Accelerator drawer header. Banner dismissal remains persisted; dismissal now returns keyboard focus to the panel.
- Focused ESLint and diff whitespace checks passed. Live authenticated preview confirms the Accelerator panel is mounted and no About Accelerator button remains.
- Light-canvas Graphify refresh finished successfully. Removal refresh running in session `62940`, log `/tmp/particle-accelerator-about-removal-graphify-20261019.log`; reuse/check before another refresh.


### 2026-10-19 — Accelerator picker highlight and pointer isolation

- Class picker now uses the opaque popover surface and explicit Radix highlighted-item colors so active rows contrast with the menu.
- Dock panel and floating window respect Radix's body pointer lock, overriding the animated window's inline pointer-events. Portaled menu remains interactive.
- Focused ESLint and diff whitespace checks passed. Authenticated preview confirms highlighted row versus menu contrast, zero pointer-enabled Accelerator background buttons while open, and restored panel input/trigger focus after Escape. Selection unchanged.
- Prior About-button Graphify refresh completed. Current refresh session `8988`, log `/tmp/particle-picker-hover-graphify-20261019.log`; check/reuse before another refresh.


### 2026-10-19 — Proportionate Accelerator overview layout

- Reduced overview top padding 24px to 8px and section gap 24px to 16px. Replaced the fixed 420px setup column and 900px breakpoint with equal columns at 680px available container width; narrower layouts stack at the same full width.
- Removed competing card/banner/lesson width caps. Lesson header controls respond to their own column width instead of viewport width, preserving usable controls in the compact side-by-side layout.
- ESLint/diff checks passed; existing organization-launch acceptance suite passed 31 tests. Authenticated preview: default 920px window gives two 407px columns; 760px viewport gives two 343px columns; 620px viewport stacks both at 570px. No grid horizontal overflow. Restored original viewport.
- Picker Graphify refresh completed. Layout refresh session `36962`, log `/tmp/particle-accelerator-layout-graphify-20261019.log`; check/reuse before another refresh. User appearance review remains authoritative; no visual baselines updated yet.


### 2026-10-19 — Simplify Tools window header

- Removed redundant Tools intro heading/description and search field. Removed its unused query/filter state and search-only empty state; installed/available service groups remain intact.
- Section headings now start 8px below the content top. Authenticated Tools preview confirms Installed at that inset, no search/intro, and existing Calendar/Drive connection controls present.
- Focused ESLint, diff whitespace, and all four existing workspace-tools tests passed. Accelerator layout Graphify refresh completed; Tools refresh session `41089`, log `/tmp/particle-tools-header-graphify-20261019.log`, running. Reuse/check before another refresh.


### 2026-10-19 — Retire Say hi and Color library presets

- User clarified the shared React Grab references meant Say hi (`message`) and Color (`color`). Retired both from the creation catalog using the existing retirement mechanism; saved-particle schema/rendering compatibility remains intact.
- Updated existing catalog and gallery fixtures to cover the reduced 12-entry catalog and use active presets. Final preset suite passed all 74 tests; lint and diff whitespace checks passed. Live preview has neither Configure/Add Say hi nor Configure/Add Color controls.
- Tools graph refresh completed. Retirement refresh session `45589`, log `/tmp/particle-retire-message-color-graphify-20261019.log`, running. Final test-fixture adjustment followed refresh start; batch into next refresh rather than launching a duplicate.


### 2026-10-19 — Workspace sidebar navigation and left canvas panel

- Moved all six workspace tabs below Workspace and above Admin Dashboard through a shell-owned portal slot. Uses existing shadcn SidebarMenu/SidebarMenuButton and Tabs, including collapsed icon tooltips and vertical keyboard navigation. Content remains in its existing canvas-local retained tree; selection, saved visibility, drafts, editor guards, header slots, and lazy loading remain owned by the existing controller.
- Reanchored the animated content surface to an 8px top/left inset, 760px default width (canvas-bounded), with maximize and composer clearance. The bottom dock now contains only the composer. Left-entry motion retains interruption handling and reduced-motion support. Accelerator equal-column breakpoint reduced to 640px to fit the narrower panel.
- Authenticated preview verified tab placement, selection, no dock tabs, close/reopen and focus return, collapsed 32px icon controls, keyboard ArrowUp/manual Enter activation, mobile 620px canvas bounds, mobile menu selection/dismissal and return focus. Temporary viewport override reset. User subsequently selected Particles; left that selection intact.
- Focused ESLint, diff whitespace, import boundaries, interaction-lock guard passed. Existing affected suites: 97 tests passed (particle UI 66, drawer/header 30, dock host 1). Updated left-panel geometry/motion expectations and stale gallery count from prior Say hi/Color removal. Final TypeScript pass has no src errors; full check remains blocked by 51 errors in unrelated test files, log `/tmp/workspace-sidebar-tsc-final-20261019.log`.
- Graphify refresh session `39487`, log `/tmp/workspace-sidebar-graphify-20261019.log`, running after prior retirement refresh completed. Last motion type annotation and Accelerator breakpoint followed AST extraction; include these in the next cohesive refresh, never start a duplicate job. Visual baselines await user appearance approval; no PR/release work requested.


### 2026-10-19 — Remove redundant composer chrome

- Removed the composer positioning wrapper's background, border, radius, and extra top padding. The input retains its own InputGroup surface and controls; positioning and measured panel clearance remain intact. Live authenticated DOM confirms transparent wrapper, 0px border and 0px top padding; diff whitespace check passed. Reuse in-flight Graphify session `39487`; include this CSS-only follow-up with the next cohesive refresh.


### 2026-10-19 — Remove duplicate Particles rail entry

- Removed Particles from sidebar navigation; the composer plus button continues opening the retained Particles panel. Closing a panel without a visible selected rail tab can return focus to Add Particle. Focused lint/diff checks passed; authenticated preview confirms five rail entries and plus opens Particles. Prior Graphify refresh completed; new refresh logs to `/tmp/workspace-sidebar-particles-nav-graphify-20261019.log`, including the prior motion/breakpoint/composer follow-ups.


### 2026-10-19 — More opaque composer surface

- Changed the input itself from muted/60 to card/95 with backdrop-blur-xl; outer wrapper remains undecorated. Live preview confirms 95% card-color opacity and 24px backdrop blur. Focused lint/diff checks passed. Batch into the next graph refresh after current session `56882`; no duplicate refresh.


### 2026-10-19 — Pan by default, Shift to select

- Empty-canvas drag now pans for mouse/touch/hybrid devices; marquee requires Shift. Existing Shift/Meta/Control multi-card clicks remain intact, and tutorial selection stays disabled. Removed the obsolete pointer-media subscription now that all pointer types share default panning.
- Focused lint/diff and all 32 workspace-particle-selection tests passed. Live plain drag changed viewport by (80,40) without a selection box; inverse drag restored the original viewport. Prior graph refresh completed; current log `/tmp/workspace-shift-selection-graphify-20261019.log` includes the composer opacity follow-up.


### 2026-10-19 — Named workspace creation and sidebar naming

- Scope: user explicitly selected creation/naming, plus action to right of Workspace, no ellipsis. New `workspace-management` feature provides authenticated create/rename dialogs and saved workspace switching. Controls now match current workspace pill buttons, muted fields, subtle borders and shadow-free rounded surfaces after user styling correction. Cancel/escape returns focus to the originating action; authenticated browser check passed.
- Storage: original board stays at the root; versioned `workspaceCatalog` holds independent named canvases. Server actions validate active organization, editor permissions, trimmed names and stable IDs, use bounded CAS retries, and reject conflicting rename replays. All board/particle saves preserve siblings; canvas keys, viewport preferences and cursor rooms include the selected canvas. Notes and Calendar retain canvas routing. Document navigation honors existing beforeunload draft guards. No delete flow or public-sharing expansion.
- Required database dependency: `supabase/migrations/20261019200000_workspace_named_canvas_calendar_guard.sql` extends existing calendar permission/revision projection to named canvases, preserves catalog on older-client root-only updates, and provides authenticated readiness RPC. Reversible SQL at the matching `supabase/rollbacks/` path. Creation/rename fail closed until readiness version1. Read-only Production check confirms existing calendar projection present and readiness absent. No remote migration or user data mutation performed. Exact migration approval requested through async question; awaiting answer.
- Verification: 11 named-workspace tests pass, including authorization, naming, idempotence, sibling preservation, CAS race and readiness gating (`/tmp/workspace-management-named-tests.log`). Notes follow-up39 tests pass; prior affected follow-up5files/107tests pass. Disposable PostgreSQL14 fixture passes calendar semantic revisions, role/RLS enforcement, named event denial, rename stability, older-client preservation and rollback (`/tmp/workspace-management-calendar-sql.log`); isolated server stopped, temp data pointer `/tmp/workspace-management-pg-path`. Focused ESLint, diff, import boundaries, workspace storage and React Grab guards pass. Feature/scaffold checks remain blocked only by pre-existing workspace-particles server export and workspace-sharing component/server import violations. Acceptance manifest refreshed so the new suite is actually included.
- Recovery: Graphify54311 completed exit0 (`/tmp/workspace-management-graphify-20261019.log`); final dialog focus/hook changes occurred during extraction, include in next cohesive update. Final typecheck finished with no source or workspace-management errors; unrelated test errors remain (`/tmp/workspace-management-tsc-complete.log`). Preview stays exact checkout at3008; no restart/reset/commit/push/PR/release. Browser create/save/switch against connected DB remains unverified until migration approval/application; do not claim this is live-ready. Visual baselines remain pending user appearance acceptance/Linux review.

- Follow-up authorization: user explicitly approved applying migration20261019200000. Applied only that exact file to verified Production `vswzhuwjtgzrkxknrmxu` in a transaction with advisory lock, timeouts, prerequisite checks, exact-source history row and schema reload. Independent readback verifies source byte match, both function bodies, active preservation trigger and version1 readiness with authenticated access and anonymous denial. Receipts `/tmp/workspace-management-production-preflight.json`, `/tmp/workspace-management-apply-result.json`, `/tmp/workspace-management-production-verified.json`.
- Live create and rename succeeded for Southside Community Table: `f86d07b5-d6fc-4b96-a240-076950a15ef3`, initially “New workspace”, renamed “Workspace 2”. It is retained for use. Browser exposed account-completion logic adding default cards to newly created canvases; named canvases now bypass automatic tutorial reconstruction unless tutorial explicitly requested. Regression covers server tutorial seeding plus client visibility hydration. Final browser switching check in progress; new Graphify87555 includes late fixes (`/tmp/workspace-management-final-graphify-20261019.log`). No application deployment.

- Final connected UI evidence: “Workspace 2” rename persisted, main workspace switch restored the original Organization/Fiscal Sponsorship/Content Calendar/Activity/Notes cards, switching back produced the intended empty named canvas and active sidebar item. Screenshot `/tmp/workspace-creation-sidebar-20261019.jpg`. Named + page-loading regression16 tests pass; final scoped lint clean. The earlier database-pending limitation is resolved; source remains local-only. No delete support added.

- Final typecheck47900 completed: no source/named-workspace errors;51 pre-existing unrelated test errors. Graph refresh87555 remains running after AST extraction completed; exact recovery log above. Do not duplicate the refresh.


### 2026-10-19 — Workspace options menu

- Replaced per-workspace pencil with shadcn DropdownMenu ellipsis: Edit workspace, Invite people, Delete workspace. Uses current rounded/shadow-free styling; menu stays visible while open/focused. Main row stays listed even after all named canvases are removed.
- Edit reuses persisted rename. Delete uses server-authorized catalog CAS, UUID/name validation, idempotent retries, sibling preservation and stale-save rejection; confirmation defaults focus to Cancel. Original/main workspace deletion is disabled because it remains the organization's legacy canvas. No real workspace was deleted in verification.
- Access clarification was asked (selected members vs organization-wide), with no answer before completing this slice. Stated assumption preserves existing organization-wide access. Invite opens the established entitlement/server-authorized invitation sheet, defaults to existing-teammate temporary editor collaboration, and explicitly labels access as organization-wide. No per-canvas ACL/privacy claim or new migration. No invitations sent or permission changes performed. If user chooses selected-member access, implement actual server/database isolation before presenting it as private; nested JSON alone cannot restrict direct organization-row reads.
- Verified authenticated preview: all menu entries, rename dialog, delete confirmation + Cancel, access sheet with actual org teammate options, Escape/focus restoration and cleared body pointer lock. Screenshot `/tmp/workspace-options-menu-20261019.jpg`. Focused4 suites/30 tests pass; scoped lint, import boundaries, interaction locks and workspace storage guards pass. Typecheck final log `/tmp/workspace-menu-tsc-final.log`; previous51 unrelated test errors remain, no source/named-workspace errors. Graphify49755 running (`/tmp/workspace-options-graphify-20261019.log`); prior87555 finished. Reuse in-flight refresh; no duplicate. Preview3008 preserved; no commit/push/deploy or production write this turn. Visual baselines pending appearance acceptance.


### 2026-10-19 — Workspace home and separate disclosure control

- Workspace root row now follows Admin Dashboard's independent link/chevron structure. Label opens `/workspace` (existing home/default canvas); a separate chevron collapses named-workspace links and panel navigation. Create plus remains a separate, available control even while collapsed. Home active state excludes selected named canvases; native unsaved-change guards preserved when returning home. Existing child Main workspace/options retained.
- Reused shadcn Collapsible, Sidebar and Button; matched Admin Dashboard chevron sizing/rotation/animation with reduced-motion support and reserved space for both actions. Canvas/panel state ownership remains outside the navigation collapse. Exact checkout/server preserved.
- Verified live collapse/reopen leaves8 canvas nodes and URL intact, named workspace leaves home link inactive, and clicking Workspace returns to `/workspace`.18 existing sidebar nav/React Grab tests pass; scoped lint, whitespace, import boundaries and React Grab guards pass. Graphify58685 running (`/tmp/workspace-home-nav-graphify-20261019.log`), prior49755 completed; do not duplicate. No database/schema/provider changes or deployment; baseline acceptance remains user-owned.

### 2026-10-19 — Remove unsolicited workspace-menu copy

- Removed “The main workspace stays with your organization.” from the menu exactly as requested. No behavior changes. Focused whitespace check passed; graph maintenance logs to `/tmp/workspace-menu-copy-graphify-20261019.log`.

### 2026-10-19 — Accelerator sidebar content width

- Removed the Accelerator retained panel's inherited 32px desktop side padding and standardized its inner gutter to 8px (previously 44px total per side on desktop). Cards gain 72px of usable width; existing responsive stacking remains intact.
- Focused ESLint and diff whitespace checks passed. Graphify refresh running as session 72140; log `/tmp/workspace-accelerator-width-graphify-20261019.log`.

### 2026-10-19 — Remaining sidebar panel widths

- Organization, Documents, Roadmap, and Tools now use 8px side gutters without the legacy 32px desktop wrapper inset. Removed their narrow content caps; People already uses the full available width. Vertical spacing and internal card/table padding remain unchanged.
- Focused ESLint and whitespace checks passed. Live browser verification blocked by repeated CDP timeouts. Visual baseline update requires hosted Ubuntu 24.04 x64; local macOS guard blocks it.
- Graphify refresh session 65647; log `/tmp/workspace-sidebar-width-graphify-20261019.log`.

### 2026-10-19 — Content sidebar on the right

- Anchored the shared content window 8px from the canvas right edge; reversed the short entrance/exit translation. Existing widths, maximization, retained panels, composer clearance, reduced-motion behavior, and left navigation remain intact.
- Live DOM confirms right: 8px, width: 760px; screenshot `/tmp/workspace-right-sidebar-20261019.jpg`. All 66 workspace-particle-ui acceptance tests and focused ESLint passed. Visual baseline updates still require hosted Ubuntu per the existing local guard.
- Graphify refresh log `/tmp/workspace-right-sidebar-graphify-20261019.log`; prior sidebar-width refresh completed before this one began.

### 2026-10-19 — Nested Organization tabs stay horizontal

- Root cause: outer vertical workspace Tabs matched shared ancestor group selectors inside nested horizontal Organization Tabs. Shared shadcn wrapper now provides nearest-root orientation on each list/trigger, with self-scoped orientation styles. Organization underline/height overrides use the same self scope.
- Live DOM: workspace rail remains column/vertical; About and Activity are row/horizontal at identical y=536. Screenshot `/tmp/workspace-horizontal-profile-tabs-20261019.jpg`. Two ui-tabs tests pass including nested orientation regression; focused ESLint passes. Baseline updates require hosted Linux as previously recorded.
- Graphify refresh session 27942, log `/tmp/workspace-nested-tabs-graphify-20261019.log`.

### 2026-10-19 — People segments in title row

- Moved segments from the action toolbar to the existing accessory portal beside People. The segment slot expands to the right header edge and retains horizontal overflow; remaining actions occupy the following row. Existing selection/edit/drop state and inactive-panel portal guard remain owned by People. Standalone rendering still keeps segments inline.
- Live geometry: title right 1162px, segments left 1174px/right 1766px, header right 1778px (12px padding). Exactly one segment group. Capture `/tmp/workspace-people-header-segments-20261019.jpg`. All 17 workspace-window-header tests and focused lint passed. Baseline update requires hosted Linux.
- Graphify refresh log `/tmp/workspace-people-header-graphify-20261019.log`; previous nested-tabs refresh completed first.

### 2026-10-19 — Canvas organization avatar navigation

- Removed Organization from the Particle workspace left rail and added a 48px circular canvas-local button, inset 16px at top-left. Reuses shadcn Button/Avatar/Image/Fallback with current organization logo and initials fallback; no new image storage. Existing guarded handleTabChange opens the retained Organization sidebar. Legacy non-Particle nav unchanged.
- Added selected/expanded indication, accessible organization name, setup-guide target, modal pointer lock, and close/minimize focus return to the new button.
- Authenticated preview: Organization absent from rail; avatar 48px at top/left 16px; click opens right-side Organization panel; close returns focus to avatar; reopen succeeds. Current org has initials fallback SC. Capture `/tmp/workspace-organization-avatar-20261019.jpg`. Focused lint/whitespace and 66 workspace-particle-ui tests passed. Hosted Linux remains required for visual baseline updates.
- Graphify session 54653, log `/tmp/workspace-organization-avatar-graphify-20261019.log`; previous People header refresh completed before starting.

### 2026-10-19 — Organization avatar ring

- Removed expanded-state ring from the canvas organization avatar. Keyboard focus-visible ring and aria-expanded semantics remain. Whitespace checked. Existing Graphify session 54653 still running; avoid duplicate refresh.

### 2026-10-19 — Pill-shaped viewport controls

- Changed viewport control shell and all three buttons to rounded-full, preserving hit areas and actions. Whitespace checked. Graphify log `/tmp/workspace-viewport-pill-graphify-20261019.log`. Visual baseline updates remain hosted-Linux only.

### 2026-10-19 — Rounded-square organization avatar

- Matched member workspace switcher rounded-xl Avatar and fallback; outer 48px button uses rounded-2xl for its padded contour. Behavior and keyboard-only focus unchanged. Whitespace checked. Reusing in-flight Graphify session 11994; log `/tmp/workspace-viewport-pill-graphify-20261019.log`.

### 2026-10-19 — Remove organization-switcher subtitle

- Removed the role/organization-count subtitle beneath the active organization name and its unused memo. Switcher options and behavior unchanged. Scoped lint and whitespace verification; reuse in-flight Graphify session 11994.

### 2026-10-19 — Organization switcher alignment

- Removed avatar desktop self-start alignment and used balanced 4px desktop vertical padding. Live DOM confirms 7px above and below the 36px avatar with a two-line name. Whitespace passed. Graphify session 49373, log `/tmp/workspace-switcher-spacing-graphify-20261019.log`.

### 2026-10-19 — Organization switcher inside account menu

- Dashboard/Admin/authenticated Find now pass the existing feature-owned organization switcher through a generic accountMenuContent slot into NavUser, below user identity. Removed its sidebar-header placement. Existing default brand header is revealed; no duplicate switcher.
- Account-menu presentation uses shadcn Collapsible around the existing OrganizationList Command search/list. Server action, auth, cookie, and full reload behavior unchanged. Existing popover/drawer presentation remains available to other callers. Current-org selection returns focus to the switcher.
- Account menu observes its size and clamps position/height to the viewport while the inline picker expands. Live desktop: menu y=234..795.5 within 861px viewport, no horizontal overflow. Search filters options; selecting the already-current org collapses picker without closing account menu and restores focus. No switch to another org was performed.
- Screenshot `/tmp/workspace-account-org-switcher-20261019.jpg`; 9 focused menu/org-switching/header tests, lint, boundaries, and whitespace checks passed. Updated stale org-switching assertion to current org+named-canvas React key. Full tsc pending session 7776/log `/tmp/workspace-account-switcher-tsc-20261019.log`; prior checkout baseline has unrelated test errors. Hosted Linux required for visual baseline update.
- Graphify session 1837/log `/tmp/workspace-account-switcher-graphify-20261019.log`.

### 2026-10-19 — Thin canvas avatar border

- Removed 4px image padding from organization button; image fills the 48px shell inside its existing 1px border. Inner radius 15px matches outer 16px minus border. Whitespace checked. Reuse running Graphify session 1837.

### 2026-10-19 — Circular compact avatar and floating-control insets

- Organization avatar/button/fallback are circular at 32px, matching zoom-button height. Kept image flush with 1px border and expanded mobile hit area. Avatar top/left and viewport top/right insets reduced 16px to 8px. Mobile zoom bottom clearance remains reserved for composer.
- Live DOM verified both button heights 32px and edge offsets 8px; whitespace passed. Graphify session 96783/log `/tmp/workspace-floating-controls-graphify-20261019.log`.

### 2026-10-19 — Match avatar to whole zoom pill

- Corrected avatar height from inner zoom button 32px to entire zoom pill 42px (32px + 8px padding + 2px border). Live DOM confirms both outer controls 42px. Reuse in-flight Graphify session 96783; whitespace passed.

### 2026-10-19 — Workspace section-title styling

- Workspace now presents as muted text without icon or selected/hover background in expanded rail. Chevron follows text; create plus is far right. Existing title home navigation, collapsed-rail icon, guarded named-to-home navigation, disclosure and creation retained. No three-dot header menu added.
- Live verified transparent title, adjacent chevron, right-aligned plus; collapse hides children and reopen restores. Screenshot `/tmp/workspace-section-title-20261019.jpg`. 18 focused sidebar tests, lint and whitespace passed. Graphify log `/tmp/workspace-section-title-graphify-20261019.log`.

### 2026-10-19 — Build starter and zero-workspace state

- New/unsaved organizations begin with exactly one root workspace named Build. Existing saved names preserved. Default workspace now supports deletion with durable defaultDeleted catalog tombstone; clears root-only cards, retains named siblings, rejects stale root saves/renames, omits deleted root from notes/calendar discovery. Creation after zero produces only the new named workspace.
- Sidebar displays No workspaces with plus available. Empty seed does not mount editable canvas; root URL redirects to first surviving named canvas when appropriate. Delete UI uses existing confirmation/auth/CAS path.
- 31 focused lifecycle/calendar tests pass; disposable PostgreSQL14 fixture verifies new Build initialization, existing-name preservation, calendar permission denial, event removal revision, legacy/stale writes cannot resurrect root, and safe rollback. Lint, storage/import boundaries and whitespace pass. SQL log `/tmp/workspace-default-lifecycle-sql-20261019.log`; isolated PG stopped. No real workspace deleted.
- PRODUCTION APPLIED after explicit user approval ("apply migrations"): `20261019223500_workspace_default_canvas_lifecycle.sql` applied transactionally to verified project vswzhuwjtgzrkxknrmxu using `/tmp/workspace-default-lifecycle-apply.sql`. Independent readback confirms storage version2, exactly one migration record matching the tested source, enabled BEFORE INSERT/UPDATE preservation trigger and unchanged enabled calendar revision guard. Anonymous readiness execution denied; authenticated/service_role allowed. No existing workspace rows renamed or deleted. Apply receipt `/tmp/workspace-default-lifecycle-apply-result.json`; verification `/tmp/workspace-default-lifecycle-production-verified.json`. Default deletion gate is now satisfied for the local UI. Client code remains local/unshipped; no production UI deployment or live deletion test performed. Rollback gates new default deletion while retaining tombstone protection.
- Graphify completed successfully; log `/tmp/workspace-build-empty-graphify-20261019.log`. Prior account-menu full tsc completed with 51 existing test errors and no src errors (`/tmp/workspace-account-switcher-tsc-20261019.log`). Hosted Linux visual gate unchanged.

### 2026-10-19 — Four starter workspaces

- New organizations with no saved board now see Build, Board, Communications, Finance in that order. Build retains the existing initial canvas; three named presets start empty and use stable organization-scoped IDs so first-load navigation and concurrent first saves agree. Existing root/named persistence stores the complete catalog on first edit; no additional migration or backfill needed.
- Saved legacy boards (including empty objects), Build-only catalogs, custom catalogs, and deliberately deleted/empty catalogs remain unchanged. Deleting all four stays empty; creating afterward adds only the requested workspace. No existing organization was edited for this task.
- Verification: 21 workspace-management tests plus 13 unchanged calendar tests pass, including the actual first-insert writer path when Board is edited first, ordered/stable IDs, saved data preservation and delete-all/recreate. Focused lint, storage/import boundaries and whitespace pass. No visual component styling changed. Graphify session 48794, log `/tmp/workspace-four-presets-graphify-20261019.log`.
- Production safety check: no new production mutation or UI deployment. Latest GitHub production deployment 7185188373 reports success for SHA 1df67d8991968590b5600d636b605d54a6de910b (2026-10-19 21:15 UTC). Live https://coachhouse.app/ and login redirect return HTTP 200. Vercel API credential returned 403; used GitHub deployment status instead. This establishes public availability, not a full authenticated regression audit. Previously applied lifecycle migration receipt remains authoritative; it had no existing-row backfill/update/delete.

### 2026-10-19 — Canvas top navigation and downward content window

- Moved People/Documents/Tools/Accelerator out of the sidebar portal into a canvas-local centered pill using existing shadcn Tabs and existing guarded handlers. Shared Tabs orientation now horizontal. Organization avatar and composer particle entry remain existing launchers. No extra search action added.
- Retained the one content/window tree, editor guards, lazy panels, focus return, modal interaction locks and reduced-motion support. Content window centers below pill and enters downward from top; normal cap 960x560, maximize uses available canvas with composer clearance. Below 700px canvas width pill occupies a second row below corner controls; window starts at 120px instead of 70px.
- Authenticated preview: all four destinations open, ArrowRight+Enter switches People to Documents, close returns focus to Accelerator, sidebar has zero panel tabs, uncovered canvas hit-tests to draggable React Flow pane. 390px preview has no horizontal page overflow and panel/pill stay within canvas. Viewport restored. Screenshot `/tmp/workspace-top-navigation-20261019.jpg`.
- 84 focused UI/dock/header tests and scoped lint/whitespace pass. Intentional navigation/window layout changes require hosted Linux visual baseline update (existing macOS baseline guard remains). Graphify session 43485/log `/tmp/workspace-top-navigation-graphify-20261019.log`; previous presets refresh completed. Local-only; no production database changes or deployment.

### 2026-10-19 — Tighten top-menu window gap

- Reduced mouse-layout pill-to-window gap from 20px to 8px (window top 58px, narrow 108px). Coarse pointer keeps its existing 8px gap below 44px targets. Height budget still reserves taller touch row for composer clearance. Live DOM confirms 8px; whitespace passed. Screenshot `/tmp/workspace-top-gap-20261019.jpg`. Reusing in-flight Graphify session 43485.

### 2026-10-19 — Per-panel sizing and morph transitions

- Geometry now follows accepted tab: People remains 960x560; Tools cap 560x360; Documents cap 760x560; Accelerator cap 1040x1000 in two columns, 520x1200 when available inner width is below its existing 640px two-column breakpoint. All dimensions clamp to canvas/composer space; maximize bypasses panel caps. Particle inspectors retain existing sizing.
- Added stable Motion LayoutGroup around existing window and removed the layout-dependency gate so shell/header/body projection is coordinated. No keyed remount, duplicate content tree, or layout-property animation. Existing spring, visibility driver, draft/scroll retention and reduced-motion code retained.
- Live DOM sampling verifies intermediate morph sizes from Tools 560x360 through 747x453, 908x534, 947x554 to People 960x560. At 1440x1400 preview Accelerator is 1040x1000 with overview clientHeight=scrollHeight=962 (no scrolling); at 650x1100 it becomes 520px wide with one 502px content column and bounded vertical scrolling. Viewport restored. Screenshot `/tmp/workspace-panel-morph-tools-20261019.jpg`.
- 85 UI/dock/header tests, focused lint and whitespace pass. Browser permission denied raw-CDP reduced-motion emulation; no retry/bypass or browser preference change. Automated reduced-motion checks pass; live emulation unverified. Hosted Linux visual baseline gate remains. Graphify session 20870/log `/tmp/workspace-panel-morph-graphify-20261019.log`. Local-only; no database or deployment change.

### 2026-10-19 — Tab toggle and custom discard confirmation

- Active top tab now toggles its retained window closed/open with pointer or Enter/Space. Switching destinations stays open. Pointer activation occurs once on click so Radix mousedown cannot select a tab then immediately toggle it closed; legacy drawer tabs retain open-only behavior. Retained panel drafts remain mounted when collapsed.
- Added feature-owned shadcn AlertDialog using current rounded-card/pill styles for dirty Particle inspector close and window/tab navigation. Keep editing preserves dirty state; Discard changes clears only the current local draft then resumes the accepted close/destination. Guards reject obsolete selection and preserve existing share-editor restrictions. Header close and inner inspector close both use it. Browser beforeunload warnings remain for refresh/tab closure; unrelated create/select prompts are outside this close-navigation slice.
- Authenticated preview verified click close/reopen, switch to a different tab, Enter toggle, custom dialog from window close, cancel preserves an unsaved test title, accepted navigation goes to Tools and restores focus there. Test draft discarded without Save; no persisted card edits. Screenshot `/tmp/workspace-unsaved-dialog-20261019.jpg`.
- 89 focused UI/header tests pass including toggle, deferred atomic navigation, cancel, discard-once and clean/share guard behavior; focused lint/whitespace pass. Hosted Linux visual baseline gate unchanged. Graphify recovery log `/tmp/workspace-tab-close-graphify-20261019.log`. No deployment or database change.

### 2026-10-19 — Reference-style icon tab pill

- Restyled the four top panel tabs as a compact icon-only pill with shadcn tooltips, accessible names, subtle border, opaque semantic theme surface and circular hover/open states. Existing tab handlers, guarded navigation, 42px desktop height, 44px touch targets and 8px panel gap remain intact. No extra workspace selector or navigation action added.
- Authenticated preview verifies both light/dark palettes, click toggle, Enter toggle and arrow-key focus/tooltip labels. Restored original dark theme. Screenshots `/tmp/workspace-icon-tabs-dark-20261019.jpg` and `/tmp/workspace-icon-tabs-light-20261019.jpg`. 90 focused UI/header/dock tests, focused ESLint and whitespace pass. Hosted Linux visual baseline gate remains; no deployment/database change.
- Graphify refresh session 46002, log `/tmp/workspace-icon-tabs-graphify-20261019.log`; prior tab-close refresh completed successfully.

### 2026-10-19 — Tooltip arrow correction

- Replaced the top-tab tooltip's ineffective hide rule (Radix applies inline display:block) with scoped natural-triangle styling. Removed diamond rotation/translation/background, matched arrow fill to the popover theme token, and placed its positioned wrapper behind tooltip content. Shared/default tooltips remain unchanged.
- Live DOM and screenshots verify exact arrow-fill/content-background match in dark and light; original dark theme restored. Screenshot `/tmp/workspace-tooltip-arrow-dark-20261019.jpg`. CSS-only; whitespace passes, prior 90 behavior tests remain valid. Icon-tab Graphify refresh completed; follow-up CSS refresh log `/tmp/workspace-tooltip-arrow-graphify-20261019.log`. Hosted visual gate remains. Local only.

- Tooltip size follow-up: 26px total height (4px vertical padding, 12px type/16px line height), 10px horizontal padding and full pill radius. Live computed dimensions verified; theme/arrow correction preserved. CSS-only, whitespace passes. Reusing in-flight Graphify session 5135 from arrow repair; no duplicate refresh. Screenshot `/tmp/workspace-compact-tooltip-20261019.jpg`.

- Tools icon follow-up: replaced wrench with existing Lucide plug at the same 20px size; kept Tools label/navigation. Preview DOM verifies plug; focused lint passes. Reusing arrow-repair graph refresh if still running.

### 2026-10-19 — Arrowless top-tab tooltips

- Added optional showArrow to existing shared shadcn TooltipContent (defaults true); top-tab tooltips opt out, removing the arrow DOM entirely. Deleted custom arrow styles and disabled top-tooltip entry/exit transforms to avoid opening jitter. Retains compact 26px pill and theme surface. Offset accounts for toolbar padding: verified 4px between toolbar edge and tooltip.
- Preview verifies zero arrow elements and no animation. Focused lint/whitespace pass. Screenshot `/tmp/workspace-arrowless-tooltip-20261019.jpg`. Previous arrow-repair graph refresh completed; new log `/tmp/workspace-arrowless-tooltip-graphify-20261019.log`. Local only; hosted visual gate unchanged.

### 2026-10-20 — Restore text panel tabs

- Replaced top-navigation icons with People, Documents, Tools and Accelerator labels; removed redundant tooltip wrappers/styles and sized pill buttons to text. Existing activation handlers and touch target height preserved. Particle action menus unchanged.
- Authenticated preview confirms four visible text labels, zero icons and no toolbar overflow; focused ESLint and whitespace checks pass. Hosted visual baseline gate unchanged. Local only, no database/deployment changes. Graphify log: `/tmp/workspace-text-tabs-graphify-20261020.log`.

### 2026-10-20 — Form particle layout and React Grab identity

- Form header now has icon/title/actions on one wrapping row and question count/private-draft metadata below. Removed the narrow-container action-row rule that produced blank space in the library. Added a meaningful empty preview and numbered summaries with answer types for configured forms, reusing the existing node shell.
- Existing form builder now uses numbered question rows, type summaries, bounded rounded sections, an empty state, and a shadcn Edit/Preview toggle. Preview presents the form name/description without edit inputs. Existing controlled draft, question type/options/required/reorder/remove logic, persistence, authorization and local answer validation remain in place. Public form/Drive work remains paused.
- ParticleCard context propagates kind, record ID, title and storage type to shared surfaces; node/gallery boundaries cover raw leaves and compact views. React Grab appends identity to copied notes while retaining selected leaf source/class ownership, including when a debug record supplies notes. Form now reports kind `form` rather than only generic activity/header/frame.
- Verification: 108 focused forms/React Grab/particle UI tests pass; subsequent expanded clipboard-report regression also passes (19 React Grab tests). Focused ESLint, ownership guard and whitespace pass. Authenticated preview: creation draft, multiple-choice options, required validation, successful local answer check, Edit/Preview retention, light/dark styling, and nested input identity. Test draft discarded without Save/Add; original dark theme restored. No production write or deployment.
- Screenshots: `/tmp/workspace-form-particle-20261020.jpg`, `/tmp/workspace-form-builder-20261020.jpg`, `/tmp/workspace-form-builder-light-20261020.jpg`, `/tmp/workspace-form-preview-20261020.jpg`. Hosted Linux visual baseline gate unchanged. Graphify refresh recovery log `/tmp/workspace-form-particle-graphify-20261020.log`.

- Form spacing follow-up: removed 10px top padding, reduced bottom padding to 4px and removed the 8px row gap. Title row retains 32px minimum height and shared icon alignment. Live library header now 58px tall; title/plus centers differ only by the shared frame 1px border. Focused lint and whitespace pass; behavior unchanged. Graphify log `/tmp/workspace-form-spacing-graphify-20261020.log`.

- Library stack compactness: halved back-card offsets from 12/24px to 6/12px and reserved bottom space from 24px to 12px across the library. Live computed transforms/padding and whitespace verified; existing placement/motion logic unchanged. Reusing the in-flight Form-spacing Graphify refresh (PID 17429); no duplicate refresh.

- Library Activity width: traced the second/legacy Activity card to Available Particles using 320px columns (449px actual) while presets used 280px columns (301px actual). Unified both sections on the shared 280px column layout and removed tile-only 4px side padding. Live Form, Objective and both Activity cards now measure 300.664px with no horizontal overflow. 13 library acceptance tests, focused ESLint and whitespace pass; canvas sizing/persisted records unchanged.

- Unified library flow: preset gallery now accepts existing/legacy tile children in the same list, eliminating the separate Available Particles block below presets. Activity and other existing cards participate in the same masonry/list/icon layout, with original identity and add/drag handlers intact. Filtered existing-only results still render. Live DOM confirms one list containing all 16 cards at equal 300.664px width. 88 library/preset tests, focused lint and whitespace pass. Graphify log `/tmp/workspace-library-flow-graphify-20261020.log`; prior width refresh completed. Local only.

- Duplicate Activity cleanup: library suppresses an empty/default/unlocked Activity record when its reusable preset is available. Keeps named/described/populated/locked activities and connected/root records; no saved graph mutation. Verified requested record `ef304f39-1d82-4e29-a8dc-5df15fbc0190` absent from library DOM while Activity preset remains once. 15 library tests, focused lint/whitespace pass. Graphify log `/tmp/workspace-activity-dedupe-graphify-20261020.log`.


### October 20 — Fiscal Sponsorship front door and application setup

- Replaced the activity picker/global readiness percentage/full workflow on the FS card with compact saved-application rows, individual statuses, Handbook, and Start application. Each row resumes its application; the separate progress control opens that application's existing workflow/docs/signing drawer.
- Start opens a separate compact shadcn dialog: New activity (name and optional description) or Use existing. New applications create independent fiscal-enabled organization projects and persist the initial application draft through existing project/draft actions. Existing organization-admin applications remain accessible and are never overwritten when selecting another activity. No migrations or backfill.
- Creation retains existing project entitlement/edit authorization. Server pins creation to the active organization and rejects stale organization context; list reads are organization-scoped and exclude guest-intake projects. Access lookup failures surface errors rather than a false empty state. Partial draft-save failure returns the created project for recovery; uncertain creation refreshes the list rather than blindly retrying. Successful creation resets the starter.
- Prefill reuses organization contact/identity only before applying an explicitly selected activity. New custom activities cannot inherit the old primary program's budget, dates, description, or location. Source identity survives resume through saved application metadata. Existing application revision/discard/submit protections remain in place.
- Verification: 25 new application/front-door tests; 30 existing fiscal tests and 4 public-preview tests pass (59 unique scoped tests). Latest changed behavior/card run: 33 tests, `/tmp/workspace-fiscal-final-behavior-tests.log`. Focused ESLint, import boundaries, React Grab ownership, raw-button and whitespace checks pass. TypeScript reports no fiscal-owned errors; unrelated existing workspace-management/particleGraph/test-fixture errors remain. Broader ontology suite has its existing source-contract failure at `workspace-ontology.test.ts:1052` (`createWorkspaceParticleFlowHandlers`), outside FS.
- Browser: exact authenticated 3008 checkout shows existing Youth Stewardship Fellows as In review, compact 301px library card. Separate temporary development-only fixture exercised actual starter components (custom/existing selection, retained input, Continue validation, light/dark and 390px layout with no horizontal overflow); fixture and tab removed afterward. No fiscal save/submit/project creation against production. Dark theme and original Particles window restored. Screenshots: `/tmp/workspace-fiscal-front-door-20261020.jpg`, `/tmp/workspace-fiscal-starter-20261020.jpg`, `/tmp/workspace-fiscal-starter-light-mobile-20261020.jpg`.
- Local uncommitted slice only; no production migration, email, deployment, branch sync, reset, or cleanup. Hosted Linux visual-baseline/CI/release gates remain unchanged. Final Graphify refresh completed successfully: `/tmp/workspace-fiscal-front-door-final-graphify-20261020.log` (session 99491). Existing three parser warnings are outside this FS slice.

### October 20 — Card-only particle library

- Removed List/App icon renderers, view state/props, public switcher export, and library header switcher. Existing card columns, inline Notes/Event drafts, preset configure/add, drag placement, and editor header controls remain.
- Verification: 172 scoped acceptance tests pass across workspace-particle-library, workspace-particle-presets, workspace-particle-ui, and particle-editor-header (UI suite rerun after removing obsolete switcher-only test). Focused ESLint and whitespace checks pass. Authenticated localhost:3008 preview shows 14 library cards in shared columns and zero display-switcher controls. Screenshot: `/tmp/workspace-particle-card-only-library-20261020.jpg`.
- Local UI-only change; no migration, saved-workspace mutation, or deployment. Linux visual-baseline/CI gates remain unchanged. Graphify refresh completed successfully: `/tmp/workspace-library-card-only-graphify-20261020.log` (session 68492, exit 0); existing three parser warnings remain outside this slice.

### October 20 — Canvas organization name button

- Reused the existing Button/Avatar and organization action; replaced the photo-only circle with a rounded container, 32px rounded photo, and two-line organization name. No switcher icon or switching behavior. Kept 42px control height, 8px edge offsets, keyboard focus, image fallback, and existing panel toggle. Width is bounded to avoid centered navigation and narrow-screen viewport controls.
- Focused ESLint and whitespace checks pass. Authenticated 3008 preview verified 240x42px container, 32px image, actual organization name, and zero switcher icons. Screenshot: `/tmp/workspace-org-name-button-20261020.jpg`. Styling-only; no new behavioral tests or production writes. Graph refresh: `/tmp/workspace-org-name-button-graphify-20261020.log` (session 81000; completed, exit 0).

- Organization button spacing follow-up: content-fit width, single-line truncated name with existing full-name title/accessible label, and 8px right padding replace the wrapped label and excess trailing space. Focused ESLint and live 3008 verification pass; screenshot `/tmp/workspace-org-button-spacing-20261020.jpg`. Graph refresh completed (exit 0): session 23092, `/tmp/workspace-org-button-spacing-graphify-20261020.log`.

### October 20 — Restore bounded organization editor

- Restored the organization panel's `max-w-3xl` (768px) and symmetric responsive padding (`p-2 sm:p-3`). Normal organization window now uses a dedicated 768px width instead of the generic 960px width; narrow canvas clamping and existing maximize/restore behavior remain. Maximizing the window keeps the editor centered at its cap. Other destinations retain their widths.
- Verification: 62 workspace-particle-ui tests pass, including organization geometry and narrow/maximized limits; 10 drawer tests pass, including the restored organization-panel source contract. Four unrelated existing drawer assertions still fail (old snap navigation, tab definitions, people segment source layout, selectionKeyCode source shape). Focused ESLint and whitespace checks pass. Authenticated preview measured normal window 768px, panel 766px with 12px padding; maximized panel capped at 768px, then restored. Screenshot `/tmp/workspace-organization-width-20261020.jpg`.
- Local presentation only; no production data or migrations. Graph refresh completed (exit 0): session 63804, `/tmp/workspace-organization-width-graphify-20261020.log`.

- Organization-button correction: restored two-line wrapping (single-line truncation was not requested), narrowed maximum container width from 240px to 208px, and retained 8px right padding. Live preview shows the full name on two lines; first line 147.875px inside 154px label, removing 32px of trailing space. Lint/whitespace pass. Screenshot `/tmp/workspace-org-wrap-restored-20261020.jpg`. Graph refresh completed (exit 0): session 25569, `/tmp/workspace-org-wrap-restored-graphify-20261020.log`.

### October 20 — Organization link dark mode

- Header link tiles use `dark:bg-muted dark:text-foreground`, retaining existing light-mode colors. X/TikTok/GitHub SVGs inherit light foreground in dark mode; other brand colors stay intact. LinkedIn's inner wrapper becomes transparent in dark mode. No link behavior or asset replacements.
- Focused ESLint, whitespace, and 9 existing organization-story/link safety tests pass. Authenticated dark-mode preview verified all nine tile backgrounds use the dark muted token and monochrome brand fills use the light foreground. Screenshot `/tmp/workspace-org-links-dark-20261020.jpg`.
- Graph refresh completed (exit 0): session 34063, `/tmp/workspace-org-links-dark-graphify-20261020.log`. Local presentation only.

### October 20 — Notes inspector identity fields

- Notes widgets no longer render the generic Title/Description field group in the particle inspector. Other particle types keep those fields. Existing saved title/description stay in the draft/save payload; Notes content, save, permissions, and dirty/stale protections remain unchanged.
- Focused ESLint, whitespace, and all 62 existing workspace-particle-ui tests pass. Live visual verification blocked: Chrome lists the exact 3008 workspace tab but cannot attach its debugger; no browser changes or saved-note writes performed.
- Graph refresh completed (exit 0): session 96365, `/tmp/workspace-notes-fields-graphify-20261020.log`.

### October 20 — Unified Notes editor

- Implemented the approved Apple Notes-inspired layout inside the existing workspace window: 220px scrollable/virtualized list, first-line title and date/second-line preview, centered locale-aware last-edited time, compact shared Tiptap formatting/link/history controls, search, and shadcn delete/discard confirmations. No title/description fields, folders, sharing, or locking controls. Notes inspector width is 960px; container queries switch to list/detail with Back below 640px. Uses existing Geist/semantic theme tokens, rounded controls, window motion, and a lazy-loaded editor.
- Canvas Notes and Documents Notes open the same editor. Existing organization graph notes (including hidden cards and named canvases) and the signed-in user's private Accelerator notes share a 30-item cursor-paginated index. Search filters full content before slicing; the old 120-note truncation is removed. No new note table or duplicate content store.
- Optional sanitized HTML accompanies the existing plain-text projection. Legacy text is escaped and preserves line breaks. Dedicated UTC content timestamps stay stable on canvas moves; older records use their existing timestamp until edited/moved. Workspace autosaves use the authorized graph writer with revision checks and operation-ID retries, then reconcile the canvas/Documents. Personal saves compare row versions and modify only `module_progress.notes`; deletion clears notes without touching completion/answers. Dirty drafts survive failures, switching/closing flushes first, stale conflicts offer copy/reload, and unchanged background refreshes preserve the editor session/undo history. Existing graph note metadata is retained; list titles derive from body text.
- Validation: 181 focused tests pass across Notes (54), particle UI/actions, and document editor session/performance. Tests cover HTML sanitization, legacy lines, content timestamps vs moves, >120-note pagination, full-body search, auth/scope, canonical deletion, stale personal/workspace saves, and idempotent personal retries. Focused ESLint/whitespace, import boundaries, React Grab, workspace surface tokens, and raw-button checks pass. Repository-wide type checking still fails on unrelated existing workspace-management/calendar/ontology/fixture/resource-map errors; final log `/tmp/notes-editor-types-verified-20261020.log` has no Notes/Tiptap errors. Structure check reports existing oversized Documents grid/card header/canvas files and existing CSS naming failures; no new Notes file exceeds its budget.
- Authenticated preview at `http://localhost:3008/workspace` verified workspace + personal notes, switching to an Accelerator note, saved date/content, search finding older notes, and delete-confirmation cancellation. Light/dark screenshots: `/tmp/workspace-notes-editor-light-20261020.jpg`, `/tmp/workspace-notes-editor-dark-20261020.jpg`; original dark theme restored. Browser policy rejected viewport resizing, so narrow-screen visual acceptance remains user-owned. Real saved-note mutation/deletion was not exercised against the connected database. User visual review precedes Linux-only visual baseline updates.
- Preserved the dirty existing checkout/branch and port-3008 server. No production migration, deployment, merge, reset, or note mutation. Main evidence: `/tmp/notes-editor-validation-20261020.log`; latest Notes route recheck `/tmp/notes-editor-final-tests-20261020.log`. Graph refresh final receipt follows below.
- Graph refresh completed, exit 0: session 41821, `/tmp/workspace-notes-editor-graphify-20261020.log` (22,718 nodes). Existing parser warnings reference unrelated calendar/optimistic-placement/sharing tests. Final Notes route recheck: 54/54 passing; final changed-file lint and whitespace checks pass.

### October 20 — Notes search placement

- Moved search before the formatting controls in the shared Notes toolbar; mobile full-width search behavior retained. Focused ESLint passed. Local preview change only.
- Graphify refresh remains running in exec session `5990`; log `/tmp/notes-search-position-graphify-20261020.log`. AST extraction completed with the same three existing test parser warnings; check this job before starting another refresh.

### October 20 — Notes lesson shortcut

- Personal Accelerator notes display the associated lesson name beside their locale-aware edited date, separated by a bullet. Metadata comes from authenticated curriculum reads, including notes without a progress row; saves retain the association. Workspace notes remain date-only.
- Clicking saves/guards drafts, closes Notes, and requests the existing canvas Accelerator window without a page navigation. The request selects the first controller-visible step of the exact module (internal lesson/complete steps are filtered); module-only window URLs resolve the same way. Current canvas URL parameters are preserved. Unresolvable workspace lessons leave Notes open with an error.
- Verified in authenticated localhost preview: Introduction note shortcut opens Introduction video inside the centered canvas window; no note edits/deletions performed. Evidence `/tmp/notes-lesson-link-20261020.jpg` (date/link) and `/tmp/notes-accelerator-window-20261020.jpg` (correct in-canvas destination).
- Notes and drawer-event tests pass (56 Notes plus 11 route/event tests). Broader overlay suite has four pre-existing source-string failures in untouched collapse/tab, People styling, and Shift-selection code; combined result 77 passed / 4 failed. Focused lint and import boundaries pass. Typecheck still reports unrelated existing failures, none in touched files. Logs `/tmp/notes-lesson-window-{tests,types,boundaries}-20261020.log`.
- Previous search-placement Graphify job and intermediate lesson-link/window refreshes completed. Final refresh recorded below. Local only; no migration or deployment.
- Final follow-up validation: 15 Accelerator panel/runtime tests pass; final changed-file lint and whitespace checks pass. Final graph refresh is running in exec session `73294`, log `/tmp/notes-lesson-window-final-graphify-20261020.log`; check completion before another refresh.


### October 21 — Stable workspace sidebar navigation

- Replaced full-document workspace links and create/delete redirects with Next client navigation. The layout-owned catalog stays mounted through canvas loading/remounts; leaving `/workspace` clears it. Active-workspace clicks preserve the open panel. Creating a canvas updates the list before navigation; deleting the default canvas can refresh in place.
- A cancelable probe consults the existing editors' beforeunload guards, then uses the established shadcn discard-dialog style. Cancel preserves drafts and the selected workspace; modified clicks retain normal link behavior. Server authorization and persistence are unchanged.
- Focused workspace-management + shell-navigation suites: 27 passed. Focused ESLint, import boundaries, interaction locks and whitespace pass. Authenticated Finance → Accelerator switch verified selected link, persistent sidebar menu IDs, and all four workspace entries. No test workspaces or saved content were created/deleted. Screenshot: `/tmp/workspace-sidebar-stable-20261021.png`. Raw browser instrumentation was denied by saved policy; verification used ordinary UI navigation only.
- Same development branch and preview3008. Typecheck: `/tmp/workspace-sidebar-types.log`; graph refresh: `/tmp/workspace-sidebar-graphify-20261021.log`. No main merge, deployment, database migration or Drive upload.
- Completion: runtime commit `cf3a2830` pushed and independently matched on GitHub; normal pre-push supply-chain, size and full ESLint passed. Full TypeScript check remains failed in unchanged catalog/calendar and test files, with no diagnostics in this slice's changed files. Graph refresh completed successfully (22,728 nodes), with three existing test-parser warnings. User can review switching/creation at3008; creation against production was not exercised.


### October 21 — Panel tabs above the composer

- Moved the existing People/Documents/Tools/Accelerator pill to bottom center above the composer, using its existing ResizeObserver height and a 6px shell gap. Reserved the navigation footprint in window geometry so expanded windows cannot cover it. Organization trigger, window placement, retained content and tab animation remain unchanged.
- Live preview verified position, Tools opening, and active-tab toggle-close. 63 existing dock/particle UI tests, focused ESLint and whitespace pass. Screenshot `/tmp/workspace-bottom-tabs-20261021.png`; user appearance review remains next, no baseline updates yet. Graph refresh session22891/log `/tmp/workspace-bottom-tabs-graphify-20261021.log` (reuse, do not duplicate). Same development branch; no production data changes or deployment.


### October 21 — Two window controls

- Removed the orange minimize control; retained red Close and green Maximize/Restore. Dots increased from12px to14px, reducing the visible desktop gap from12px to10px while preserving24px button targets and44px touch targets. Existing keyboard/tab collapse behavior remains available.
- Authenticated preview verified exactly two controls and14px dots; screenshot `/tmp/workspace-red-green-controls-20261021.png`. All62particle UI tests, focused lint and whitespace pass. Appearance review remains user-owned; no baseline update. Graph refresh for the prior slice is still session22891; finish it before refreshing these changes, never start a duplicate.


### October 21 — Bottom-anchored content windows

- Content windows now sit8px above the relocated bottom tabs, using shared measured composer/navigation offsets on desktop and touch layouts. Removed the obsolete top-position overrides. Presence motion opens upward from bottom tabs and still supports a top organization trigger; sizing, draft retention, maximize and reduced-motion behavior remain intact.
- All62particle UI/motion tests, focused ESLint and whitespace pass. Live geometry verifies panel bottom805/tab top813 (8px gap). Existing user editor stayed open during inspection. Screenshot `/tmp/workspace-bottom-window-20261021.png`; user appearance review pending. Prior Graphify job16071 remains in flight and must finish before the next update; no duplicates. Development branch only.


### October 21 — Organization profile left sidebar

- Reused the retained drawer/editor and motion surface for organization-only sidebar presentation: 440px wide, 8px from the canvas left edge, below the profile trigger. Other destinations retain bottom-anchored centered windows. Existing close/maximize, draft guards, header actions, reduced motion and canvas interaction remain connected. Narrow/maximized layouts reserve the bottom dock footprint.
- Authenticated preview verified the profile opens at canvas x+8/y+58, 440px wide with no horizontal overflow; screenshot `/tmp/workspace-organization-sidebar-20261021.png`. Dock/particle UI suites: 63 passed; focused lint and whitespace pass. Appearance review remains user-owned; visual baselines await approval. No saved content or database changes.
- Prior Graphify job98580 completed. Current refresh: session49362, `/tmp/workspace-organization-sidebar-graphify-20261021.log`; reuse until completion. Development branch only, no merge/deployment.


### October 21 — Organization trigger/sidebar morph

- Organization now grows from the actual profile-button bounds into the full-height sidebar at canvas top/left8px, then shrinks back. Trigger photo/name are hidden while expanded; the retained profile displays the single visible identity. Existing Motion layout projection/spring handles reversible resizing, with direct-child correction, live reduced-motion handling and focus transfer/return. Editors and draft guards stay mounted.
- Authenticated browser verified matching compact bounds (201.875x42), intermediate grow/shrink transforms, final440x850 sidebar at canvas x+8/y+8, and focus returning to trigger / entering Close. Screenshot `/tmp/workspace-organization-morph-20261021.png`. Focused dock/particle suites:63 passed; scoped lint/whitespace pass. Appearance review pending.
- Prior graph session49362 completed. Current slice refresh log `/tmp/workspace-org-morph-graphify-20261021.log`; finish any running refresh before another. Same development branch; no production data changes/deployment.

- Typecheck still reports the existing workspace catalog/calendar and unrelated test errors, none in this slice (`/tmp/workspace-org-morph-types.log`). Graph refresh session73332 is in flight; reuse it.


### October 21 — Compact logo image action

- Organization logo menu trigger now28px/circular with Lucide ImagePlus, overlaying the image bottom-right by4px. Empty-logo upload uses the same control, accessible label and native file input. Existing replace/remove menu behavior preserved.44px effective pointer target and theme-aware opaque background retained.
- Focused ESLint and whitespace pass; live edit-mode geometry verified28x28 within the96px image. Screenshot `/tmp/workspace-logo-image-button-20261021.png`. No content edits/uploads/deletes. Icon usage: Lucide primary, Phosphor/Tabler/Simple Icons also in source; Iconoir installed but unused in src. Development branch only. Graph refresh log `/tmp/workspace-logo-button-graphify-20261021.log`.


### October 21 — Stable profile view/edit transition

- Removed the edit-only mt-24 override that added 48px between logo and title; both modes now retain mt-12. Banner/logo controls fade in/out over150ms while staying out of layout; hidden controls become inert/aria-hidden immediately. Header actions and company fields fade on mode replacement with reduced-motion overrides. No duplicated forms or delayed edit intent.
- Authenticated edit → view → edit measured identical236px header height, title y290.5 and logo bottom265.5 in both modes. Save was disabled before testing; no draft changes discarded or saved. Screenshot `/tmp/workspace-profile-mode-transition-20261021.png`. Focused lint/whitespace pass; header/story test output `/tmp/workspace-profile-mode-tests.log`. Appearance review pending.
- Graph refresh log `/tmp/workspace-profile-mode-graphify-20261021.log`. Same development branch; no deployment/database changes.


### October 21 — Banner image control alignment

- Banner dimensions hint now sits above its control in a bounded, right-aligned stack (8px gap). Banner upload/actions use the same28px circular ImagePlus style as the logo control, including44px effective touch targets, theme colors and loading/disabled behavior. Shared local style constant avoids divergence. Native file input and existing adjust/replace/remove actions preserved.
- Focused lint/whitespace pass. Live light-mode preview verified hint bottom148/button top156 and28x28 control; screenshot `/tmp/workspace-banner-image-button-20261021.png`. No uploads or data changes. Same development branch. Graph refresh log `/tmp/workspace-banner-button-graphify-20261021.log`.


### October 21 — Profile tabs above banner

- Moved existing profile navigation above the banner by lifting its controlled shadcn Tabs provider to the card root. Kept the same tab IDs, selected state, navigation/dirty guard handler and content; gap0 preserves the banner/header spacing.
- Scoped lint/whitespace pass and authenticated preview confirms horizontal About/Activity tabs at the card top in edit mode. Screenshot `/tmp/workspace-profile-tabs-above-banner-20261021.png`. No saved content changes. Graph log `/tmp/workspace-profile-tabs-graphify-20261021.log`; development branch only.


### October 21 — Centered profile without banner

- Removed the banner display/upload/crop controls from the profile editor header. Centered the existing logo, organization name, tagline, links and donation action in a compact vertical layout; tabs remain above. Logo editing and its fade remain intact; persisted banner data and public profile rendering are untouched. Static canvas cards retain their existing link alignment.
- Scoped ESLint and whitespace checks pass. Authenticated dark-mode preview confirms centered identity without a banner; screenshot `/tmp/workspace-centered-profile-20261021.png`. Graph refresh log `/tmp/workspace-centered-profile-graphify-20261021.log`. Development branch only.


### October 21 — Detached profile pill navigation

- Moved profile card styling onto an inner wrapper so About/Activity sit separately above it, centered with a12px gap. Restyled existing shadcn tabs to match dock pill colors, borders,32px controls and rounded selection/hover states; coarse pointers retain44px controls. Controlled selection, keyboard semantics and dirty guards unchanged.
- Focused ESLint/whitespace and authenticated preview pass. Screenshot `/tmp/workspace-profile-pill-tabs-20261021.png`. Graph refresh `/tmp/workspace-profile-pill-tabs-graphify-20261021.log`. Development branch only; no data changes.


### October 21 — Profile links spacing

Removed the header bottom padding so spacing below the links is24px instead of48px; content section padding still supplies the gap. Focused lint/whitespace and preview verified. Graph refresh follows the existing pill-tabs job; development branch only.


### October 21 — Profile section title spacing

Set shared FormRow vertical title/content gap to8px in stacked and split layouts, preserving desktop column spacing. Focused lint/whitespace pass; browser confirms8px for Identity/Contact/Address/About us. Screenshot `/tmp/workspace-profile-section-spacing-20261021.png`. Development branch only.


### October 21 — Brand kit profile tab

- Added Brand kit beside About/Activity and moved its existing editor/preview out of About. Retains shared company drafts, errors, dirty status, save/autosave handlers and header controls; empty view is explicit. No schema/data changes. Brand-focused editor requests select the new tab; URL tab parsing recognizes it.
- Focused lint/whitespace pass;17 Brand kit/story tests pass (`/tmp/workspace-brand-tab-tests.log`). Typecheck still reports unrelated workspace catalog/calendar and test baseline failures, none in affected files (`/tmp/workspace-brand-tab-types.log`). Browser verified view/edit tab contents; no values changed or saved. Screenshot `/tmp/workspace-profile-brand-kit-tab-20261021.png`.
- Graph refresh `/tmp/workspace-brand-tab-graphify-20261021.log`; previous section-spacing refresh completed. Development branch only.


### October 21 — Text-only organization tabs

Renamed About to Organization and removed tab icons. Existing tab values/handlers retained. Focused lint/whitespace and browser label verification pass. Development branch only.


### October 21 — Public profile link

Renamed the header link to View Public Profile, added a trailing Lucide up-right arrow and target=_blank with noopener/noreferrer plus screen-reader new-tab description. Focused lint/whitespace pass; authenticated DOM confirms target/rel/icon. Screenshot `/tmp/workspace-public-profile-link-20261021.png`. Graph refresh queued in session12114 after job56607 covers these small follow-ups; no duplicate job. Development branch only.


### October 21 — Formation status summary and approved EIN

- Reused OrganizationFormationStatusSummary in identity view; approved EIN appears beneath its title. Edit mode keeps the status select, followed by EIN only for Approved. Hiding EIN retains saved values. Approved saves require9 digits (optional hyphen), with inline error and return to Organization tab when necessary.
- Shared validation also protects the authenticated profile action when formation/EIN is written, using current saved EIN for partial updates. Unrelated partial autosaves remain allowed for legacy approved profiles without EIN. No database migration or data mutation.
-38 focused UI/server tests pass (`/tmp/workspace-formation-final-tests.log`); existing story regression passed in the earlier focused run. Scoped lint/whitespace pass. Typecheck retains unrelated baseline errors in workspace catalog/calendar and tests, none in changed files (`/tmp/workspace-formation-types.log`). Browser verified the saved pre-501 summary; conditional approved layout and rejected saves tested without changing live data. Screenshot `/tmp/workspace-formation-summary-20261021.png`.
- Prior queued graph refresh completed; current log `/tmp/workspace-formation-graphify-20261021.log`. Development branch only.


### October 21 — Profile field layout and shadows

Made Identity an explicit single-column grid and removed the formation group’s two-column span, which was creating an implicit extra column in the narrow panel. Scoped shadow-none to profile inputs/textareas/select triggers, retaining focus rings and global primitives. Focused lint/whitespace and browser computed styles pass; screenshot `/tmp/workspace-profile-input-layout-20261021.png`. Development branch only.


### October 21 — Address helper copy

Removed the state-code/geocoding helper text beneath the state selector. Selection/storage behavior unchanged. Focused lint/whitespace pass; development branch only.


### October 21 — Grouped profile edit forms

- Restyled Organization edit sections to compact rounded groups with inset dividers, inline labels and flat controls. Identity/contact/address/presence/social fields share scoped CSS; multiline description/story fields stack labels over their editors. Public profile controls use matching group styling. Removed redundant section separators/address fieldset nesting; preserved all values, callbacks, status/EIN dependency, URL behavior and save guards. Social rows reuse existing brand icons and now associate labels/errors with input IDs. No new add/remove-contact behavior or schema changes.
- Theme tokens support light/dark; narrow containers stack labels, coarse pointers retain44px controls, focus outlines remain inset. Browser verified grouped Identity and computed social row geometry. Screenshot `/tmp/workspace-grouped-profile-fields-20261021.png`. Lower-section scroll automation did not move the preview; their field mappings/rendering were checked through focused tests and DOM. No user values changed or saved.
-28 focused tests pass across formation, stories, public settings, deep links and field mappings. Scoped lint/whitespace pass. Typecheck retains unrelated baseline errors with none in changed files (`/tmp/workspace-grouped-fields-types.log`). Test logs `/tmp/workspace-grouped-fields-tests.log` and `/tmp/workspace-grouped-field-mappings-tests.log`.
- Graph refresh `/tmp/workspace-grouped-fields-graphify-20261021.log`; development branch only.


### October 21 — Unframed organization profile

Removed the inner profile card border, background, rounding and clipping. Removed redundant 24px horizontal padding from profile tab content, preserving outer sidebar gutters and vertical spacing. Forms gain 50px of usable width (padding plus border). Controlled tabs, editing and saving unchanged. Focused ESLint/whitespace pass; authenticated preview visually verified without modifying data. Screenshot `/tmp/workspace-profile-unframed-20261021.png`. Graph refresh `/tmp/workspace-profile-unframed-graphify-20261021.log`; development branch only.


### October 21 — Remove profile billing notice

Removed the requested billing explanation card and unused info icon from PublicPageSettings. Map visibility controls and billing behavior unchanged. Updated the existing focused rendering regression for the intentional copy removal. Graph refresh log: `/tmp/workspace-profile-notice-graphify-20261021.log`. Development branch only.


### October 21 — Stock React Grab 0.2.0

- User requested removal of all custom React Grab setup after repeated ambiguous selections. Verified npm latest stable is 0.2.0; upgraded package/lockfile from 0.1.47. Root layout now uses upstream's development-only Next Script/beforeInteractive pattern, versioned from the installed package. Removed custom loader, semantic selection/clipboard plugin, debug registry, ownership/linked-surface helpers and annotations, OpenCode injection, URL/local-storage switches and preview inspection hooks. Display-only previews remain inert through a small shared product component. Tutorial settling IDs remain independent of inspection. No database, main or production changes.
- Updated the execution contract and existing check:react-grab gate to protect the stock integration instead of requiring removed custom ownership metadata. Removed obsolete ownership-only tests; retained UI tests using labels/existing product markers. Visual tests use the existing network-blocking helper instead of removed URL flags. No product visual changes or baseline updates intended.
- Fresh authenticated localhost:3008 preview loads exactly react-grab@0.2.0, with zero custom ownership tags. Stock toolbar activated and selecting the Identity heading showed Copied; browser clipboard adapter returned no text, so clipboard payload was not independently inspected. Screenshot `/tmp/react-grab-stock-20261021.png`. Existing user tab/drafts were not refreshed or saved; refresh it after saving edits to unload any old runtime.
- Final focused run: 179 tests pass across 5 suites (`/tmp/react-grab-final-focused-tests.log`); broader affected-suite run passed 320/325 before metadata-test followups. Five unrelated stale assertions remain across accelerator header picker (old widths/breakpoints/colors), workspace window header (old View map profile copy), and roadmap title (old spacing). Verified those expected fragments were already absent at pre-change HEAD. Logs `/tmp/react-grab-baseline-failures.json`, `/tmp/react-grab-owner-tests.log`. Full source/test lint, stock integration guard and acceptance manifest pass. Typecheck baseline/results: `/tmp/react-grab-verified-types.log`. Graph refresh: `/tmp/react-grab-stock-final-graphify-20261021.log`. Final typecheck has only the pre-existing workspace catalog/calendar and test diagnostics; no new source diagnostics.


### October 21 — Single-row organization editor toolbars

Scoped the six organization story/narrative editor toolbars to one row, removed divider/spacer spans, and tightened padding/gaps. Existing controls remain; narrow layouts scroll horizontally and coarse pointers retain 44px targets. Browser DOM verified all six toolbars at 390px wide/40px tall with no overflow and all buttons sharing one row. Focused ESLint passes. No content edited or saved. Graph refresh: `/tmp/profile-toolbar-graphify-20261021.log`. Development branch only.


### October 21 — Hide organization editor counters

Used the existing countClassName override to hide the full word/character-count row in all six organization story/narrative editors. Other editor views unchanged. Browser verified all six count rows display:none with zero height; focused ESLint passes. Reusing in-flight graph refresh session 64618 (`/tmp/profile-toolbar-graphify-20261021.log`); no duplicate graph job. Development branch only.


### October 21 — Remove public settings preview/share actions

Removed the requested Preview map profile and Share buttons and their wrapper from PublicPageSettings. Public URL and map visibility controls remain. Existing focused settings test passes; authenticated browser confirms both actions absent and public URL input present. Reusing in-flight graph job 64618; log `/tmp/profile-toolbar-graphify-20261021.log`. Development branch only.


### October 21 — Remove online resource notice

Removed the highlighted “This will appear as a web resource” notice card and unused Globe icon. Access selector and URL fields unchanged. Focused lint passes; browser confirms notice absent and access selector present. Graph maintenance remains in-flight session 64618, `/tmp/profile-toolbar-graphify-20261021.log`; no duplicate job started. Development branch only.


### October 21 — Remove web resource helper text

Removed the requested helper paragraph beneath Web resource; URL input, validation and persistence unchanged. Whitespace/pre-push checks cover the JSX-only deletion. Existing graph refresh session 64618 remains the maintenance job; no duplicate launched.


### October 21 — Shorten public URL guidance

Removed only “Avoid reserved words like /admin.” from PublicPageSettings helper copy. Retained lowercase/numbers/dashes guidance and all slug validation. Whitespace/pre-push checks cover this copy-only edit.


### October 21 — Remove formation status helper copy

Removed the requested “Used to tailor your formation checklist and map listing steps.” paragraph from IdentitySection. Formation selector and conditional EIN field/validation unchanged. Whitespace/pre-push checks cover this copy-only edit.


### October 21 — Full-width identity name and tagline

Organization name and Tagline now use placeholder labels and occupy the full grouped row. Added opt-in hidden accessible labels to ProfileField; other labels remain unchanged. Scoped grouped-field styles keep validation messages full-width. Browser verified both inputs at 390px within 414px rows, matching accessible label associations, and 1px visually hidden labels. Focused lint passes. Existing graph refresh session 64618 remains in flight; no duplicate job. No user values changed.
