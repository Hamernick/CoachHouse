# Particle infrastructure — execution plan

> **MVP continuation — 2026-10-16:** Follow the [consolidated 36-step workspace board and sharing plan](2026-10-16-workspace-board-sharing-mvp.md) for current scope, decisions and resume instructions. This document is retained as historical/technical reference; its older next-step order does not override the new plan.

Status: infrastructure implemented; focused checks and code-graph refresh complete. Scope selected by Caleb: build infrastructure before UI.

References: [Particle PRD](2026-10-09-coach-house-particle-system-prd.md), [Workspace Engine PRD](2026-10-09-workspace-interaction-generative-ui-prd.md).

## Step-by-step

1. [x] Inspect current canvas, preserved Particle contracts, board normalization, revision writer, authorization, and test infrastructure.
2. [x] Scaffold `workspace-particles`; define all eight validated domain payloads, registry metadata/default factories, explicit handles, graph validation, and bounded inputs.
3. [x] Build atomic graph operations with entity revisions, safe deletion, group movement, decision/checklist updates through typed replacement, idempotent retries, and inverse operations for conflict-aware undo/redo. Add pure selection helpers.
4. [x] Build a measured ELK adapter with deterministic ordering, orthogonal routes, explicit feedback semantics, cancellation/stale-result checks, and no automatic persistence. Fail explicitly for unsupported constraints rather than moving locked content silently.
5. [x] Integrate graph reads and operations into existing organization board JSONB and authorization. Preserve graph state during ordinary board saves; reject malformed/future graph edits without discarding stored data. Keep route-private persistence behind dependency injection.
6. [x] Add focused schemas/operations/layout/access/persistence tests, run scoped lint/type and structural checks, refresh Graphify, and document evidence and remaining work.

## Architecture and boundaries

- No second canvas, data store, new tables, package migration, public sharing endpoint, or model integration in this infrastructure slice.
- `workspaceId` maps to the existing organization-scoped board identity.
- Store the versioned graph under `organization_workspace_boards.state.particleGraph`. Read it through a strict domain decoder; preserve opaque JSON at the existing board boundary so unsupported versions survive old UI saves.
- Only the dedicated authenticated operation path may change this field. Existing whole-board callers cannot inject, replace, or remove it.
- Keep React Flow v11 unchanged until integration can migrate its full provider boundary coherently. Domain layout output is framework-independent.
- Use record-level expected revisions so unrelated edits can rebase; require exact graph revision for applying layout. Inverse operations are reusable for undo/redo and reject conflicting collaborator changes.
- Idempotency receipts are bounded; record the replay window and reject revisions older than that window instead of treating an old retry as a fresh mutation.
- No form/media/share/generation records are fabricated. This slice establishes the validated extension boundary; those capabilities remain subsequent steps.

## Verification

- Eight type/payload pairings, nested ID uniqueness, malformed values, workspace scope, dangling references, outcome/handle mismatch, cycles, and limits.
- Atomic failure, deletion cleanup, replay collision, replay eviction, unrelated concurrent edits, conflicting same-record edits, locked group movement, inverse/redo behavior, and selection toggling/marquee.
- Real ELK execution with varied measured sizes, branches, convergence, deterministic input ordering, routed segments, stale results, and missing-measurement failure.
- Existing board normalization and saves preserve valid, malformed, and future graph JSON; direct whole-board graph injection is ignored. Dedicated writes enforce actor scope/edit permissions and retain unrelated board content.
- Focused existing board tests and feature/static boundary checks. No whole local quality suite unless needed for a concrete failure.

## Completion boundary

This slice is complete when the reusable infrastructure and authenticated persistence path pass their focused tests. It does not complete the PRDs or claim a new visible Particle UI, provider readiness, database deployment, or release. Continue with the existing-canvas adapter and user-facing controls next.

## Implementation record

- New feature: `src/features/workspace-particles` with strict schemas, typed domain registry, operation reducer/inverses, selection helpers, and measured ELK/orthogonal routing.
- Persistence adapter: `src/app/(dashboard)/my-organization/_lib/workspace-particle-actions.ts`; existing board normalization/type/writer/reconciliation extended narrowly.
- Historical `state.particles` is preserved read-only alongside the new `state.particleGraph`. No automatic conversion or existing attachment deletion.
- The operation API protects unrelated concurrent edits, rejects stale same-entity edits, and refuses batches whose inverse exceeds the same request budget.
- Real ELK fixture exercises 30 mixed-size Particles, all eight domain types, two decision splits, convergence, feedback and disconnected work. Locked layouts fail explicitly; scoped fixed-obstacle layout is not yet implemented.
- Layout runner cancellation fences stale output. Real browser worker wiring, label collision handling, renderers, UI history, collaboration operation broadcast, media/forms/sharing, and generative tools remain later slices.
- No UI/style changes: no new visual baselines. Existing design guidance was read; implementation remains framework-independent infrastructure.
- ELK options follow the [official layered algorithm reference](https://eclipse.dev/elk/reference/algorithms/org-eclipse-elk-layered.html). The planned React Flow migration is tracked against the [official migration guide](https://reactflow.dev/learn/troubleshooting/migrate-to-v12); no package upgrade has occurred.

## Validation receipt

- 109 unique focused tests passed across the five Particle suites and four existing board suites. The last operations-only rerun passed all 16 cases after the final lock/selection correction; the preceding full focused run passed 108 cases before that additional regression was added.
- Scoped TypeScript passes with the feature, new action, modified persistence, new tests, their transitive dependencies, and repository ambient declarations. The first broad repository check reported existing typing errors in unchanged tests (including missing Vitest globals); it is not claimed as passing. Temporary scoped config: `/tmp/particle-infrastructure-tsconfig.json`.
- Scoped ESLint passes; feature contract, import boundaries, workspace storage boundary, structure, threshold regression, and diff hygiene checks pass. Existing structure warnings remain unchanged.
- Port 3008 listener cwd still matches this worktree. Anonymous `/workspace` returns the expected 307 sign-in redirect. No authenticated data mutation or browser UI acceptance is claimed.
- Graphify refresh completed: 20,025 nodes, 57,572 edges, 1,074 communities; ignored local graph artifacts updated.
- No database migration, package/lockfile change, full local quality run, visual baseline update, push, PR, merge, or deployment.

## Next bounded step

Design is included in every UI step, following [Workspace Engine PRD section 18](2026-10-09-workspace-interaction-generative-ui-prd.md#18-design-motion-and-usability-contract): all 21 requested usability principles, shared visual hierarchy, interaction timing, interruptible transitions, screen-sized targets, and reduced motion.

1. Establish shared visual and motion tokens using existing theme/components; review the common frame, contextual controls, and dock before expanding types.
2. Wire existing-canvas adapters and measured geometry; implement selection/history with immediate feedback and consistent keyboard/touch behavior.
3. Integrate the worker and explicit layout transitions with synchronized edges, stale-result handling, and reduced-motion alternatives.
4. Build one complete Particle-to-inspector flow, including saving/error/undo states and interruptible dock transitions; verify both themes and mobile.
5. Extend the approved shared patterns across the remaining types, then content, sharing, tools, and generation; retain per-slice visual and interaction evidence.

Wire the existing canvas to these contracts: coordinated `@xyflow/react` migration, typed adapters and rendering registry, actual measured-port reporting, real browser layout worker, selection/history controller, and one Particle inspector. Keep the current board and source records. Add fixed-obstacle scoped layout before presenting lock-aware auto-layout as complete. Then build the remaining renderers and content/tool/share/generation slices from the PRDs.

## UI checkpoint 1 — manual review requested

Caleb requested pauses at key points. Stop after this checkpoint for appearance/interaction feedback before continuing selection/layout or complete editors.

- Implemented in the existing React Flow surface and existing Vaul dock, using `WorkspaceNodeFrame` and shadcn primitives. No second canvas, provider, board, or fixture data store.
- Shared compact frame, eight data-backed preview renderers, restrained hover/focus corner menu, lock/unlock, contextual open action, and explicit handles. Persisted connections render through React Flow; interactive connection editing is still next.
- Creation deliberately offers Objective, Activity, and Workflow because those have the first type-specific editors. The composer accepts only declared creation commands. Unknown freeform text creates nothing.
- Inspector supports title, description, status, objective target/current/unit, and activity/workflow checklist editing. Checklist toggles derive progress from records. Copy, dirty-draft protection, stale-draft warnings, saving/error/retry, and keyboard open/focus behavior are included.
- Existing organization-scoped server actions save creation, details, status/checklists, locks, and dragged positions. Retry retains the batch identity on uncertain failures; definite conflicts require refreshing before another edit.
- One centered dock, maximum 650 px, with composer retained through collapsed/half/full states. Existing navigation panels remain available. Added 240 ms transform transitions and reduced-motion override; hover reveal uses 100 ms opacity. These are implementation values, not measured interaction results.
- React Flow remains v11 at this review boundary. Coordinated v12 migration, Shift/marquee refinement, worker/layout UI, history UI, and full specialized editors remain subsequent checkpoints. Existing Finance release gating and viewport controls are unchanged for now.
- 52 focused tests pass across Particle UI/action/persistence/operation and existing drawer/canvas configuration suites. Scoped TypeScript, changed-file ESLint, feature/import/raw-button/storage checks and diff hygiene pass. SSR checks prove rendering contracts, not browser interactions.
- Graphify update is running in the background (`/tmp/particle-ui-graphify.log`); AST extraction reached 100%. At continuation, finish/reconcile it and refresh the final small edits made after that scan began. Do not report the current UI graph refresh complete yet.
- Browser attempt: IAB unavailable; opening localhost:3008 in Chrome was then explicitly denied by browser security policy because permission was declined. No alternate browser/Playwright/CDP workaround. User appearance review, authenticated reload testing, and visual baselines remain pending. Baselines follow user appearance review under the current AGENTS contract.

Review at `http://localhost:3008/workspace`: use **+** to add an Objective or Activity; open/edit/save it; add checklist rows; toggle a row; hover/focus the corner menu; drag the card; expand/collapse the dock. Check both themes. These create actual organization-scoped workspace records, not demo-only entries.


## Dock review revision — 2026-10-10

1. Read supplied Apple Maps sheet spec and trace the pasted controls — complete.
2. Simplify composer to the screenshot's rounded input and circular controls — implemented, appearance review pending.
3. Put shared Particle creation in the indicated canvas help menu — implemented; three editable types remain available through both menu entry points.
4. Refine detents and motion — measured collapsed geometry, native Vaul transition ownership, focus expansion/Escape restoration, reduced motion; device verification pending.
5. Focused validation — 27 tests, scoped types/lint and ownership/boundary checks pass. Stop for user review before layout/selection work.

No current browser verification: prior explicit access denial remains in effect. User review should cover the composer, plus/help creation menus, multiline text and errors, the three detents, and light/dark appearance. Actual iOS keyboard/viewport behavior remains a follow-up; the reference spec is not proof of device compatibility. The next graph/layout implementation checkpoint remains unchanged.


### Floating dock correction

User review supersedes the supplied sheet spec's edge-attached design: keep a 16px gap beneath the panel, rounded bottom corners, maximum width 560px, and approximately 116px collapsed height. Vaul still owns translation; its full-canvas offsets are accounted for by a transparent shell and a content-sized inner panel. The gap stays interactive. Focused geometry tests cover every detent; appearance review pending.


### Responsive dock revision

The 440px cap was rejected as too narrow. Current width is fluid from 460–520px when the canvas permits, bounded by 12px side gutters on smaller canvases. Container queries adapt tab spacing; labels stay readable and the row scrolls rather than shrinking text or wrapping navigation. Touch uses 44px targets, with measured chrome included in saved-detent presentation. Keep the 16px bottom gap and no shadow. 22 scoped tests pass; browser/device appearance remains for user review.


## Next presentation work — staged plan

The 2026-10-10 screenshot and desktop-window request supersede continuing narrow dock style patches. Follow [Workspace dock and content window plan](2026-10-10-workspace-dock-and-content-window-plan.md): establish the obsolete frame owner, clean dock/tabs, restore Particles and separate content, review static desktop geometry, then add motion and complete regression checks. Stop after the dock correction before implementing the window. Planning only in this pass.


## Canvas integration — staged continuation (2026-10-10)

1. Selection checkpoint: let React Flow own marquee and additive selection. Mouse drag selects; Shift/Command/Control-click toggles. Space or middle/right drag pans. Touch-capable devices retain drag-to-pan; Shift-drag remains available with a keyboard. Keep inspector identity separate from canvas selection, preserve drafts, and make Escape clear the selection before closing content.
2. Position checkpoint (same slice): capture native keyboard and group-drag changes through one debounced, revision-aware position writer. Preserve transient coordinates during ordinary selection updates, leave locked records fixed, and restore confirmed coordinates after failed writes. Keep existing legacy movement handlers and authorization. Verify the adapter and persistence behavior before user review.
3. Provider migration: inventory and migrate the complete shared React Flow provider/type/CSS boundary to v12; no mixed providers. Validate existing people, ontology, tutorials, legacy cards and Particle renderers.
4. Layout checkpoint: use actual measured geometry/ports, a real ELK worker, explicit Auto-layout, exact-revision commits, stale/canceled-result fencing, synchronized routed edges and reduced motion. Keep manual positions until requested; lock-aware scoped layout remains required.
5. History/connections: expose existing inverse operations with conflict handling, add validated connect/disconnect and decision outcomes. Then complete specialized editors, content/media/forms, sharing and the generation harness.

This ordering makes each interaction reviewable without coupling the approved dock animation to a package migration. Existing dock size, tab spacing, focus policy and motion remain unchanged. The selection configuration follows React Flow's [design-tool viewport model](https://reactflow.dev/learn/concepts/the-viewport), checked against the installed v11 implementation. Browser access remains denied, so local source/unit checks do not establish rendered interaction acceptance.


### Selection/position checkpoint — implemented, user review pending

- Changed `use-particle-flow.ts` and `workspace-particle-flow-handlers.ts`: modifier clicks retain the existing inspector/draft; ordinary clicks open details without collapsing group selection. Escape first clears canvas selection, then closes the inspector; nested controls/menus retain keyboard ownership.
- Added `use-workspace-canvas-selection.ts`, integrated it into `workspace-canvas-surface-v2-view.tsx`, and updated canvas help. Mouse drag selects, Shift/Command/Control-click toggles, Space/middle/right drag pans. Native touch panning remains on coarse-pointer/hybrid devices; touch-only group-selection controls remain a later addition. Tutorial interaction gating stays intact.
- Added `position-persistence.ts`: one debounced writer for native keyboard moves and group drops, starting entity revisions retained through concurrent updates, transient coordinates protected during selection changes, locked/invalid coordinates excluded, pending timers canceled on teardown, confirmed coordinates restored after unsuccessful saves. Existing session transport owns auth, uncertainty/retry and errors; no second store or database changes. Mixed legacy/Particle drops remain separate existing persistence owners, not a cross-system transaction.
- New `workspace-particle-selection.test.ts` covers keyboard bursts, conflict revisions, drop deduplication, locks, failures/cancellation, modifier selection, legacy routing, nested keyboard controls and Escape ordering. Updated existing help/drawer configuration assertions and acceptance manifest.
- 78 focused tests across five suites pass. Scoped TypeScript, changed-file ESLint, import boundaries, React Grab ownership, interaction-lock boundary and diff hygiene pass. Initial type errors were confined to new test mocks and corrected. Graphify refresh status is recorded in the monthly log. No dependency migration, database migration, external/provider write, Git publication or deployment.
- Review on `http://localhost:3008/workspace`: create two Particles; Shift-click add/remove; drag a marquee/group; move selected Particles with arrow keys; lock one and repeat; press Escape twice; confirm the inspector draft survives group selection. Reload after saving to review positions. Browser access remains denied; these behaviors have adapter/unit coverage, not authenticated rendered acceptance. Approved dock geometry/motion unchanged; visual baselines not regenerated.
- Next: coordinated React Flow v12 migration, then measured-worker Auto-layout. Auto-layout and UI undo/redo are not exposed by this checkpoint; the broader PRDs remain incomplete.


## User-requested widget-library interlude

The 2026-10-10 screenshots add a searchable masonry widget library and reversible canvas placement before the next graph phase. See [Particle widget library](2026-10-10-particle-widget-library.md) for the implementation, exact persistence boundaries, 137-test receipt and user review steps. Resume coordinated React Flow migration and measured worker/Auto-layout after the library appearance/interaction checkpoint. Approved dock/window geometry and animation remain unchanged.

## React Flow v12 checkpoint — execution

1. Inventory every provider, renderer, CSS import, hook, store read and test using v11. Migrate the whole package boundary together, including secondary canvases that share workspace helpers.
2. Replace `reactflow` with pinned `@xyflow/react` 12.12.0. Adapt custom renderer generics to full Node/Edge types, internal-node lookup/absolute positions and renamed viewport helpers.
3. Audit geometry consumers: measured sizes come from `node.measured`; width/height declarations remain intentional layout constraints. Preserve content-driven cards, people routing, camera fit, tutorials, selection and existing persistence.
4. Run focused workspace/secondary-canvas tests, compile all migrated modules and lint changes. Review pan/zoom, card sizing, selection and library placement on port 3008 at this checkpoint. Browser access remains denied.
5. After the provider boundary is stable, continue measured ELK worker/Auto-layout as the next separate checkpoint. Preserve the approved dock/library presentation and motion.

Reference: https://reactflow.dev/learn/troubleshooting/migrate-to-v12 (checked 2026-10-10).

### v12 provider checkpoint — implemented

- Replaced v11 with pinned `@xyflow/react` 12.12.0 in the manifest/lockfile. Migrated all 69 source import/CSS boundaries, including workspace, people/org chart, ontology, tutorial, documentation, atlas, finance prototype and visual fixtures. No mixed provider packages remain.
- Updated custom NodeProps/EdgeProps and node-state generics to full framework element types. Specialized secondary-canvas instances retain their data types. The heterogeneous live workspace keeps its existing generic framework boundary with domain guards.
- Geometry reads prefer `node.measured`; Particle reconciliation retains measured state without converting it into fixed dimensions. Floating people edges use `nodeLookup`/internal absolute positions and measured sizes; camera fitting uses `getNodesBounds`.
- Added `src/lib/workspace-canvas/drag-events.ts` to normalize native node drags and React selection drags without casting events. Added `particle-flow-changes.ts` so v12 replacement events from viewport deselection cannot replace Particle records or bypass position authorization. Domain insertion/removal remains session-owned.
- Verification: 815 tests across 118 focused suites pass; TypeScript across every migrated source module and affected tests passes. Four new behavioral regressions cover replacement deselection/data preservation, dynamic measurements, drag event normalization and measured/internal edge geometry. Existing source assertions were updated for the already-established click adapter and v12's SSR card content. No application behavior was removed to satisfy them.
- No database, persistence schema, dock layout, library click behavior or motion redesign. No browser run under the existing access denial; user appearance and authenticated interaction review remain open on `/workspace` port 3008. Auto-layout, worker integration, history and remaining PRD work are still next, not claimed complete.


## 2026-10-11 — Live Auto-layout checkpoint

Implemented the next bounded step in the existing Particle worktree and canvas. No second canvas, store, database table or automatic layout on ordinary data updates.

1. Capture actual React Flow v12 node and handle measurements. Temporarily mount offscreen cards until geometry is available; restore viewport culling afterward. Keep selection/inspector state separate.
2. Validate the complete domain graph, then arrange only visible unlocked records or the selected subset. ELK owns relative positions; fixed legacy tools, locked and unselected Particles remain obstacles. Preserve left-to-right dependencies across the scope boundary; refuse impossible fixed constraints without saving.
3. Calculate in a cancellable coordinator worker using ELK's supported API/worker boundary. Validate replies, time out at 15 seconds, and compare graph revision plus the entire measured scene before committing.
4. Flush pending manual moves, submit one exact-revision batch through the existing authorized transport, then animate React Flow positions for 240ms using the shared easing policy. Edges remain attached throughout. Reduced motion applies positions immediately. Saving cannot be cancelled after submission; uncertain saves use the existing idempotent retry.
5. Register a stable custom edge renderer for rounded orthogonal routes. Cache ELK routes for the exact scene; recompute routing only after reload/manual moves/resizing. Keep ordinary React Flow paths during transient geometry or impossible manual overlaps.
6. Add Auto-layout, Arrange selection, Cancel layout and one-step Undo layout inside the existing Workspace canvas help action area. No new top toolbar or gallery chrome. Undo uses the actual inverse receipt and expires after another graph edit.

Created: `lib/layout-scene.ts`, `lib/layout-measurements.ts`, `lib/layout-worker-client.ts`, `lib/particle-layout.worker.ts`, `hooks/use-particle-layout.ts`, `components/particle-layout-controls.tsx`, and `components/particle-edge.tsx`, all in `src/features/workspace-particles`.

Modified: existing `graph-layout.ts`, `particle-flow-adapters.ts`, session/flow hooks, client exports; route-owned `workspace-canvas-node-types.tsx`, `workspace-particle-dock-content.tsx`, `workspace-canvas-surface-v2-view.tsx`; shared `src/lib/workspace-canvas/motion-spec.ts`; existing layout/UI acceptance suites. Full focused file inventory: `/tmp/particle-layout-files.json`.

Validation: real ELK fixtures include 30 mixed cards with splits/convergence/feedback, fixed obstacles and scoped external references. New checks cover exact scope/revision/geometry fencing, persistence/inverse restoration, worker cancel/timeout/error/malformed replies, missing measurements, fixed dependency direction and routed-edge attachment. A browser-targeted bundle was exercised off-thread through a Node worker shim; Next's webpack compiler also emitted both worker entries successfully. These are bundling/runtime checks, not a browser acceptance claim. The first smoke exposed ELK's bundled fallback installing a global worker handler; fixed with the supported API/worker constructor. Final results recorded in the monthly log.

Review at `http://localhost:3008/workspace`: open **Workspace canvas help**; try Auto-layout, select several Particles and Arrange selection, Undo layout, then manually reposition and reload. Confirm locked cards and Organization/Activities/Fiscal Sponsorship remain fixed. Review reduced motion, both themes and small screens. Existing browser access denial remains in force; no alternate browser/HTTP probing or visual-baseline update.

Remaining in this area: browser/authenticated reload and motion review; maximum-size benchmarks and label collision; general undo/redo and connection editing. Next implementation slice is compatible handle connection/disconnection and insertion through the same operation API. Full specialized editors, forms/images, sharing, tool registry, generative transport and committed-operation collaboration remain in the wider plan.

## 2026-10-11 — Connection editing checkpoint plan

1. Add typed connection/insertion builders that validate the complete graph, reject missing/hidden endpoints, duplicate links and hierarchy cycles, and preserve decision outcomes when splitting a connection.
2. Integrate native React Flow handles/connection validation through a separate adapter. Keep legacy-to-legacy handling unchanged; reject mixed legacy/domain links. Flush manual moves and use exact-revision atomic batches.
3. Add compact connection controls to the existing Particle inspector: keyboard-accessible linking and relationship selection; named incoming/outgoing records; insert Activity between steps; disconnect with a revision-fenced inverse receipt. Preserve unsaved inspector drafts.
4. Verify graph mutations, decision splits, rollback/undo and legacy dispatch with focused tests. Leave the approved dock/gallery appearance and motion unchanged. Pause for user review before general history and specialized editors.

### Connection checkpoint — implemented

- Created feature-owned `lib/connection-editing.ts`, `hooks/use-particle-connections.ts`, and `components/particle-connections.tsx`; created route-owned `workspace-particle-connection-handlers.ts`.
- Updated Particle node/flow/client exports, dock inspector composition, canvas view/selection adapters, and existing operations/selection/UI acceptance suites. Exact focused inventory: `/tmp/particle-connections-files.json`.
- Native handles now validate domain links and preserve decision outcome labels. Pointer/focus/touch reveal uses small visible handles with larger hit areas and reduced-motion support. Inspector linking supplies a keyboard alternative and all five relationship semantics.
- Insertion preserves the incoming link identity/outcome and adds an Activity plus onward edge in one revision-checked batch. Existing positions remain unchanged. Disconnect and insertion reject stale displayed edges. All changes use the existing authorized board transport; no database migration, parallel store, or workflow execution.
- Undo is one confirmed connection operation, not a general history stack. It expires after another graph mutation. Unsaved inspector drafts block graph changes; pending moves flush before commit. Legacy-domain cross-links remain unsupported and rejected.
- 162 focused tests across 11 suites pass, covering mutation validation, atomic insertion/inverse restoration, stale-batch rejection, ownership dispatch, inspector controls and existing layout/dock behavior. Static-check results are recorded in the monthly runlog.
- Review at `http://localhost:3008/workspace`: add two Particles, drag an output handle to an input, then open a Particle inspector → Connections. Try relationship selection, Insert Activity, Disconnect and Undo connection change. Confirm decision labels survive insertion and saved edits survive reload.
- Browser access remains denied; appearance, handle hit areas, native gesture behavior and authenticated save/reload are unverified. No visual baseline update or release claim. Initial insertion placement may require a manual move or deliberate Auto-layout in a crowded graph.
- Next checkpoint: general undo/redo history, followed by remaining specialized editors. Wider PRD work remains open.


## 2026-10-11 — Dragging and existing-card connection correction

User reported glitchy Particle dragging and missing Organization/Fiscal Sponsorship connections. This supersedes the earlier blanket mixed-link rejection.

1. Trace ParticleNode → flow controller → position writer and native event adapter. Expand the drag handle to the noninteractive card surface, preserve React Flow dragging state during reconciliation, and bypass legacy node updates for Particle-only frames.
2. Serialize position writes while retaining newer gestures during an in-flight save. Keep movement enabled during the Particle's own position save; preserve optimistic positions and advance revisions only following a confirmed write. Failed writes do not silently rebase later gestures. Reduce the geometry observer to gesture-boundary notifications during dragging.
3. Extend existing connection contracts with the three existing workspace-tool IDs and their exact handles. Allow only Particle ↔ tool related-resource links, not copied records, arbitrary endpoints or hierarchy execution. Preserve organization-scoped authorization and the existing JSONB writer. No tables or migration.
4. Render links only when both endpoints are visible; keep hidden tool connections stored. Show actual tool names, disconnect and undo in the inspector. Keep existing tools fixed during ELK layout and use native rounded React Flow routes for their resource links.
5. Verify overlapping saves, failure/conflict handling, link persistence/inverses, invalid handles, tool hide/restore, inspector names and layout compatibility. Focused static checks and current runlog hold results. Browser access remains denied; actual pointer/touch feel and authenticated reload await review on port 3008.

Changed-file inventory: `/tmp/particle-drag-files.json`. New module: `lib/workspace-tool-contract.ts`; changes otherwise stay inside existing Particle persistence/rendering modules, route adapters and existing acceptance suites.


## 2026-10-11 — Connection feedback and targeting

User observed a connection disappear after drop and later reappear with a different style, and requested larger connection controls, right-click disconnection choices and a minimal blurred half-circle target indicator.

1. Keep validated new connections visible immediately with the final operation UUID. Deduplicate preview/receipt rendering and remove failed previews with explicit feedback. Preserve exact-revision writes and undo; do not persist optimistic state separately.
2. Match React Flow's drag preview to saved rounded orthogonal edges; increase visible line weight to 2px and native edge interaction width to 28px. Selected decision branches remain distinct at 2.5px. New manual links retain the native rounded path during background routing; explicit Auto-layout enrolls them in ELK routes. Reloaded existing links may use measured obstacle routes.
3. Replace inspector navigation on Particle-edge right-click with an existing-shadcn menu. List the clicked link first, then named individual connections sharing its endpoints. Keep revision-checked disconnection, saving state, dismissal/keyboard behavior and viewport collision handling. Legacy-to-legacy menus remain with their existing owner.
4. Share a native handle component between Particles and workspace cards: 12px dots, roughly 32px hit targets/snap radius, and a 64px clipped half-circle halo behind compatible endpoints. Use theme colors, a 140ms opacity fade, stronger hover state and reduced-motion support; no pulsing, drop shadow, or independent connector overlay.
5. Verify optimistic confirmation/rollback, duplicate prevention, menu ordering/ownership and existing selection/layout/handle behavior. Browser access remains denied; halo placement/contrast and actual drag/drop latency need review on port 3008. Source and focused-test evidence belongs in the monthly log.

New modules: `src/components/workspace/workspace-connection-handle.tsx` and its CSS module, feature `lib/connection-menu.ts` and `components/particle-connection-menu.tsx`. Changed-file inventory: `/tmp/particle-connection-ux-files.json`.


## 2026-10-11 — Automatic connection sides

1. Preserve saved relationship IDs, outcome ports, and canonical ELK input/output ports.
2. Expose native Particle handles on all four sides; normalize rendering aliases before domain validation. Reuse existing Organization/Activities/Fiscal Sponsorship handles.
3. Subscribe each edge to its two measured React Flow nodes. Select facing sides using relative centers normalized by card dimensions; use actual native handle bounds, including outcome offsets. Switch during dragging without graph writes or worker reruns.
4. Retain existing saved-route staleness guards and native rounded path fallback. Lift compatible targets over overlapping source handles during connection gestures.
5. Verify directional reversal, vertical moves, unequal dimensions, absent measurements, tool links, preserved decision outcomes, and actual renderer integration. Browser drag/reload review remains pending under the existing browser denial.

Implemented in the current isolated lane. No schema migration or new persistence source. Existing legacy-to-legacy automatic side selection is retained.

## 2026-10-13 — General Particle Undo/Redo

The next history milestone is implemented; see [Particle history plan and checkpoint](2026-10-13-particle-history.md). Confirmed graph operations now share one bounded session history, replacing isolated layout/connection undo. Covers creation, saved edits/checklists/decisions, placement, group moves, layout, links and insertion/deletion. Existing inverse receipts, exact revisions and retry IDs remain authoritative. External graph revisions invalidate history; unsaved Particle drafts and active canvas operations block history writes.

Review: use Undo/Redo in Workspace canvas help, or Cmd/Ctrl+Z and Cmd/Ctrl+Shift+Z with canvas focus. Check move → edit → undo twice → redo twice, and a connection change. Native editor undo remains separate. 313 distinct focused tests and scoped static/guard checks pass; authenticated visual/gesture review is still pending. Next core milestone: remaining specialized Particle editors, then image/form/sharing/generative integration work from the broader PRDs. Performance profiling is deferred at the user's request.

## 2026-10-13 — Content Calendar editor

User deferred generative UI. [Calendar editor checkpoint](2026-10-13-particle-calendar-editor.md) adds nested-entry editing and specific-entry canvas selection, chronology/planning-order separation, local-time-to-UTC inputs, channels/content/status/publication fields, Activity links, add/reorder/remove/restore, and existing save/history integration. Existing Objective/checklist fields and selection were extracted into smaller modules without changing their behavior.

326 focused tests and scoped types/lint/guards passed; a final 60-test calendar/UI rerun passed after the focus adjustment. User review requested on port 3008; appearance and authenticated browser round trips remain unverified under the existing browser-access boundary. Next: People, Decision, Metric and Finance editors; image/form/sharing/tool work remains open. Generative UI and the deferred performance measurement plan are not active in this slice.

## 2026-10-13 — Decision editor

[Decision editor checkpoint](2026-10-13-particle-decision-editor.md) adds paginated criteria editing, compact interactive canvas criteria, stable outcome labels/order, explicit result selection/clearing and connected-outcome removal protection. Existing inspector save, graph validation, branch highlighting and general history remain authoritative. No migration or new persistence source. Existing criterion resource bindings are preserved, not edited by this slice.

336 focused regression tests passed; final Decision/UI rerun passed 58 tests with one added control test (337 distinct across runs). Scoped types/lint and relevant guards passed. User visual/authenticated review remains pending at localhost:3008. Next: People, Metric and Finance editors, followed by remaining microcontrols/media/forms/sharing. Generative UI and profiling remain deferred.

## 2026-10-13 — Scope correction and one corner menu

Latest user direction supersedes specialized-editor sequencing above: Decision behavior seems fine, but its UI is rejected as oversized. Skip People/Metric/Finance expansion. Forms are prototype UI only for now; skip the final interaction-review phase. Generative UI and profiling remain deferred.

[Action menu checkpoint](2026-10-13-particle-action-menu.md): one overlapping corner button replaces separate remove, overflow and generic footer actions on domain Particles. Edit, Duplicate, Size, Lock/Unlock and Remove from canvas reuse current persistence/history. Existing workspace tools share the corner shell for their supported return-to-library action. 101 focused tests plus scoped types/lint/guards passed. No new database or source integrations. Next: media/documents, sharing, unified tools and committed-operation collaboration.

## 2026-10-13 — Image cards

[Image checkpoint](2026-10-13-particle-images.md) implements the user's reference: rounded image, title below, no date, shared top-right menu. Choose images from the library, drop files onto the canvas or paste with canvas focus. Existing private Documents upload/read endpoints provide file identity and access; Particle saves/history reuse existing operations. Includes full preview, alt text, replacement, lazy signed URL resolution and prepared-reference retry. Nine new tests; 362 focused tests across 19 suites passed. No new table/backend, public sharing or final interaction review. Further document/media capabilities, sharing, unified tools and committed-operation collaboration remain open; forms are prototype-only and individual editor expansion stays skipped.
