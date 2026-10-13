# Workspace Particles infrastructure

This feature owns validated Particle data and graph operations. It extends the existing organization workspace; it does not render a second canvas or store a parallel board.

## Public contracts

- `@/features/workspace-particles`: eight payload schemas, registry metadata/defaults, graph decoder, operation preparation/application, inverse operations, selection helpers, and measured layout.
- `@/features/workspace-particles` includes pure mutation preparation after an authenticated route resolves the organization and edit permission. It has no server-only dependencies; the actual authenticated persistence action remains route-owned.
- `@/features/workspace-particles/client`: domain/layout exports plus the Particle renderer, inspector, composer, and canvas/session hooks.
- Route adapter: `workspace-particle-actions.ts` beside existing workspace actions. Reads through the user's Supabase session; writes through the established authorized board writer.
- Opaque storage: `organization_workspace_boards.state.particleGraph`. `workspaceId` is the existing board's organization ID. No schema migration or new table.

## Operations and history

A batch has a UUID, workspace ID, base revision, and typed operations. Entity revisions allow unrelated edits to rebase. Same-entity conflicts fail the whole batch. The original snapshot owns preconditions; graph validity is checked after the complete batch. Each changed entity receives the new graph revision, preventing delete/recreate from resetting its revision to zero.

Supported operations: create/replace Particle, remove Particle, create/replace/remove connection, move a selection, and choose the primary root. Type-specific edits use discriminated replacement payloads; choosing a decision outcome does not change criteria. Source references never mutate underlying source records through this generic graph writer.

Removal cleans incident connections, but rejects stale deletion of connections added after the caller's base revision. Remaining nested references must be explicitly detached in the same batch; validation prevents dangling references. Locks protect position/size, not content editing. Unlock before movement. Auto-layout requires an exact graph revision.

Application returns inverse operations for history. Applying an inverse is a new revision-checked batch; its inverse supplies redo. A future UI controller owns bounded local history, not a whole-board snapshot rollback. Entity conflicts prevent undo from overwriting a collaborator. Server-owned timestamps/revisions advance on undo; restored content/geometry does not falsify audit time.

Receipts store a SHA-256 fingerprint of the parsed request. Replaying the same ID and content returns current graph state without a second graph mutation; reusing an ID for different content fails. Retain 64 receipts. Once an entry is evicted, requests older than `minimumBaseRevision` are rejected and must refresh, including long-lived undo entries. This is a bounded replay guarantee, not permanent event storage.

Limits: 250 Particles, 500 connections, 1,000 operations per batch, 512KB serialized request, 2MB serialized graph; nested collections have separate schema bounds. These are application safety limits, not billing quotas.

## Compatibility and authorization

The board type retains raw JSON. Valid domain reads are strict; malformed and future-version graphs return an error and stay stored. Ordinary whole-board saves retain the persisted graph regardless of client input, including when the client omits it. The historical `state.particles` placement/image payload is also preserved read-only, without silently migrating or reinterpreting it. An ordinary save cannot create a graph by injecting the field.

The dedicated authenticated mutation route resolves active organization and edit access before acquiring the existing elevated persistence client. Mutation callbacks run against each fresh board snapshot on write-conflict retry. A successful graph mutation retains unrelated board fields. No function trusts a client-supplied organization ID as authority.

This protection applies to the updated board writer. Do not activate Particle editing alongside older server deployments that still replace JSONB without preserving this field. A later rollout must retire or guard those writers. Source-record adapters must independently validate source ownership before resolving or editing referenced organization data.

## Layout

Particle edges subscribe to their two React Flow internal nodes and attach to measured native handles on the facing top/right/bottom/left sides. Card dimensions and absolute positions determine the sides during dragging; no layout worker or persistence write is needed to switch sides. Canvas handle aliases normalize to the existing `in`, `out`, and `outcome:*` domain contracts before validation. Existing workspace-tool handles are reused. Stale ELK paths fall back to the live attached path; canonical left/right ports remain available to deliberate Auto-layout.

The ELK adapter consumes current measured dimensions and border-handle positions. Stable ID ordering, explicit root, layered left-to-right layout, and orthogonal routing drive the result. Dependency, sequence, and decision-outcome edges participate in layer assignment. Feedback and resource edges are routed afterward over a measured obstacle grid, so they do not change hierarchy. Returned polylines have a rounded-path adapter for React Flow edges; there is no independent SVG canvas.

Layout results are transient and do not change saved positions. Converting a result to a movement batch requires the same graph revision and measurement key. The coordinator cancels superseded requests and fences late results. Missing geometry, invalid output, body crossings, and overlap return errors rather than silently falling back to invented coordinates.

The live canvas now runs scoped Auto-layout through `use-particle-layout`. React Flow supplies measured card/handle geometry; visible unlocked Particles form the ELK subgraph. Locked/unselected Particles and existing workspace tools are fixed obstacles. Whole-result translation preserves ELK geometry and fixed dependency direction; infeasible constraints return an explicit error. The full graph is validated before selecting layout records, preserving references to records outside the selection.

`particle-layout.worker.ts` coordinates calculation and routing off the UI thread, using ELK's supported API and a dedicated ELK worker. Cancellation, failure and a 15-second deadline terminate the coordinator. Worker replies are runtime validated. A stable scene signature includes graph revision, card positions/dimensions/handles and legacy obstacles. The exact-revision batch is checked again before save. Cards animate through React Flow only after confirmed persistence; reduced motion is immediate. Calculation can be cancelled, while a submitted save must finish or reconcile through the existing retry path.

Routes are derived, never a second persistence store. ELK routes remain cached for their exact scene; reload/manual movement/resize recomputes routes around measured obstacles without running layout. React Flow supplies attached fallback paths during motion. One-step Undo layout uses the server's inverse receipt and expires after another graph edit. General undo/redo remains a later slice.

Remaining limits: fixed constraints can make a selected layout impossible; legacy tools are obstacles rather than movable domain Particles; label collision handling, maximum-size performance, native browser worker behavior, visual motion and authenticated save/reload still need review. Routes for overlapping manual cards can fall back to React Flow paths until space is available.

## Connection editing

`connection-editing.ts` validates visible endpoints, handles, outcome semantics, duplicate links and hierarchy cycles. Native handle drags create dependencies or labeled decision outcomes. The existing inspector provides keyboard-accessible relationship selection, incoming/outgoing links, disconnect and Insert Activity. Hover/focus/touch reveal compact handles with expanded hit areas; no dock or gallery redesign.

`use-particle-connections.ts` flushes manual moves and sends exact-revision atomic batches through the existing session. Splitting a hierarchy edge preserves its ID, source/outcome and incoming semantics, inserts one Activity, then adds its onward dependency/sequence. Existing card positions remain unchanged; initial placement is local and does not guarantee clearance from every other card. Auto-layout remains deliberate.

Disconnect and insertion check the displayed edge revision. Unsaved inspector drafts block graph changes. A one-step undo uses the confirmed inverse receipt and expires after another graph mutation. The route adapter preserves legacy-to-legacy handling. Organization, Activities and Fiscal Sponsorship can be linked to a Particle in either direction as a related resource. Those connections reference allowlisted singleton tool IDs on the same authorized board, reuse measured React Flow handles, and never create duplicate Particle records. Hidden tools retain their saved links, which return on placement. Other mixed endpoints are rejected. Resource bridges use React Flow routing; ELK still treats the existing tools as fixed obstacles, not new hierarchy steps. Feedback/resource links can be created or disconnected but cannot receive inserted hierarchy steps. No workflow is automatically executed.

A validated connection appears immediately with its final UUID while the authorized save runs. Rendering deduplicates the confirmed record against that temporary preview, so confirmation does not remove/recreate the edge. Failure removes the preview with explicit save feedback; it never becomes a second persistence source. Drag previews and saved edges use the same rounded orthogonal style. Newly connected manual links retain that path during background routing; deliberate Auto-layout enrolls them in ELK routing. Reloaded existing links can use measured obstacle routes. Native edge hit areas are 28px; right-click opens a keyboard-accessible, collision-aware shadcn menu with the clicked link first and individual related links below it. Removal still uses displayed revisions and the existing inverse receipt.

Shared workspace connection handles show 12px dots with roughly 32px hit areas and snapping distance. Only compatible endpoints show a clipped, softly blurred 64px halo behind the card; hovering a valid endpoint strengthens it. The effect uses semantic colors, opacity-only transitions and reduced-motion support. Endpoint compatibility is memoized across pointer frames; native React Flow remains responsible for connecting and hit testing.

Manual dragging uses the whole noninteractive card surface. Position persistence serializes saves while retaining newer gestures and advances their expected revisions only after our preceding save confirms. The canvas stays movable during its own position save; other mutations remain gated. Geometry routing observes gesture boundaries rather than forcing parent updates on every pointer frame.

## Next slices

UI checkpoint 1 composes these components into the existing canvas/dock using the shared React Flow v12 (`@xyflow/react`) boundary. Objective, Activity, and Workflow can be created and edited through the real authorized operation transport; all types have previews. Appearance, transitions, keyboard/touch interactions and authenticated browser persistence await the user's requested review. The live controller wires Auto-layout and one-step layout undo; connection editing and atomic Activity insertion are now wired through the same session, while general undo/redo remains open. No source-record resolution, forms/media, sharing, or generative transport is implied by this checkpoint.

1. Review the completed React Flow v12, library/selection and live Auto-layout checkpoints.
2. Review connection editing/insertion, implement general history, then complete specialized editors and remaining corner controls.
3. Add real media/form bindings, share projections, tool registry, and validated generative proposals through the same operation API.
4. Add committed-operation collaboration synchronization; current presence/cursors alone do not provide it.

See `docs/plans/2026-10-09-particle-infrastructure-build-plan.md` for current checks and `docs/plans/2026-10-09-workspace-interaction-generative-ui-prd.md` for complete acceptance.


## Preset creation

The composer slash catalog and plus button open the existing Particles drawer. `particle-presets.ts` supplies the eight standard types plus eight contextual preset categories reviewed from Shapeshift. Selection opens a local draft; the top-right plus persists it through the existing session/receipt path. No mutation runs just from matching text or choosing a tile. Message presets remain unsent calendar drafts; polls use Decision outcomes without public voting.

Activity `data.widget` optionally stores validated Event, Timer, Split, Color or Calculate configuration. Existing Activity payloads remain valid. Timer end times are UTC and display is derived without per-second writes. The arithmetic parser accepts numbers/operators/parentheses only. This is a JSONB payload extension, not a new database table. Current server/client schema must ship together; older strict decoders may reject the new optional widget payload rather than discard it.
