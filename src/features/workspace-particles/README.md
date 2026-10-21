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

Application returns inverse operations for history. Applying an inverse is a new revision-checked batch; its inverse supplies redo. The session controller owns bounded local history (50 entries / 2 MB of inverse operations), not a whole-board snapshot rollback. Canvas help and scoped keyboard shortcuts expose Undo/Redo; refresh or external graph revisions clear the local stack. Entity conflicts prevent undo from overwriting a collaborator. Server-owned timestamps/revisions advance on undo; restored content/geometry does not falsify audit time.

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

Routes are derived, never a second persistence store. ELK routes remain cached for their exact scene; reload/manual movement/resize recomputes routes around measured obstacles without running layout. React Flow supplies attached fallback paths during motion. Layout participates in the shared session Undo/Redo history through confirmed inverse receipts and exact-revision safeguards.

Remaining limits: fixed constraints can make a selected layout impossible; legacy tools are obstacles rather than movable domain Particles; label collision handling, maximum-size performance, native browser worker behavior, visual motion and authenticated save/reload still need review. Routes for overlapping manual cards can fall back to React Flow paths until space is available.

## Connection editing

`connection-editing.ts` validates visible endpoints, handles, outcome semantics, duplicate links and hierarchy cycles. Native handle drags create dependencies or labeled decision outcomes. The existing inspector provides keyboard-accessible relationship selection, incoming/outgoing links, disconnect and Insert Activity. Hover/focus/touch reveal compact handles with expanded hit areas; no dock or gallery redesign.

`use-particle-connections.ts` flushes manual moves and sends exact-revision atomic batches through the existing session. Splitting a hierarchy edge preserves its ID, source/outcome and incoming semantics, inserts one Activity, then adds its onward dependency/sequence. Existing card positions remain unchanged; initial placement is local and does not guarantee clearance from every other card. Auto-layout remains deliberate.

Disconnect and insertion check the displayed edge revision. Unsaved inspector drafts block graph changes. Shared Undo/Redo uses confirmed inverse receipts, preserving revision checks and retry identity. The route adapter preserves legacy-to-legacy handling. Organization, Activities and Fiscal Sponsorship can be linked to a Particle in either direction as a related resource. Those connections reference allowlisted singleton tool IDs on the same authorized board, reuse measured React Flow handles, and never create duplicate Particle records. Hidden tools retain their saved links, which return on placement. Other mixed endpoints are rejected. Resource bridges use React Flow routing; ELK still treats the existing tools as fixed obstacles, not new hierarchy steps. Feedback/resource links can be created or disconnected but cannot receive inserted hierarchy steps. No workflow is automatically executed.

A validated connection appears immediately with its final UUID while the authorized save runs. Rendering deduplicates the confirmed record against that temporary preview, so confirmation does not remove/recreate the edge. Failure removes the preview with explicit save feedback; it never becomes a second persistence source. Drag previews and saved edges use the same rounded orthogonal style. Newly connected manual links retain that path during background routing; deliberate Auto-layout enrolls them in ELK routing. Reloaded existing links can use measured obstacle routes. Native edge hit areas are 28px; right-click opens a keyboard-accessible, collision-aware shadcn menu with the clicked link first and individual related links below it. Removal still uses displayed revisions and the existing inverse receipt.

Shared workspace connection handles show 12px dots with roughly 32px hit areas and snapping distance. Only compatible endpoints show a clipped, softly blurred 64px halo behind the card; hovering a valid endpoint strengthens it. The effect uses semantic colors, opacity-only transitions and reduced-motion support. Endpoint compatibility is memoized across pointer frames; native React Flow remains responsible for connecting and hit testing.

Manual dragging uses the whole noninteractive card surface. Position persistence serializes saves while retaining newer gestures and advances their expected revisions only after our preceding save confirms. The canvas stays movable during its own position save; other mutations remain gated. Geometry routing observes gesture boundaries rather than forcing parent updates on every pointer frame.

## Next slices

UI checkpoint 1 composes these components into the existing canvas/dock using the shared React Flow v12 (`@xyflow/react`) boundary. Objective, Activity, and Workflow can be created and edited through the real authorized operation transport; all types have previews. Appearance, transitions, keyboard/touch interactions and authenticated browser persistence await the user's requested review. The live controller wires Auto-layout, connection editing, atomic Activity insertion and shared multi-step Undo/Redo through the same session. Calendar entries now have a full nested editor and entry-specific canvas selection. No source-record resolution, forms/media, sharing, or generative transport is implied by this checkpoint.

1. Shared Particle actions now use one corner menu: Edit, Duplicate, Size, Lock/Unlock and Remove from canvas. Existing workspace tools reuse the menu shell for supported removal. No extra permanent resize/remove/footer buttons on domain Particles.
2. Individual editor expansion is stopped; People, Metric and Finance editors are skipped by the user. Decision behavior was reported as seemingly fine, but its UI was rejected as oversized.
3. Image cards now support choosing, canvas drop/paste, private storage references, preview and replacement. Remaining media work includes existing-file selection, richer documents and derivatives. Add share projections and unified tools. Forms are prototype UI only for now; no form backend. Generative UI is deferred by the user; resume it only when requested.
4. Add committed-operation collaboration synchronization; current presence/cursors alone do not provide it.
5. Final interaction-review phase is skipped at the user's request. Existing unverified browser/device behavior remains unverified; focused implementation checks continue.

See `docs/plans/2026-10-09-particle-infrastructure-build-plan.md` for current checks and `docs/plans/2026-10-09-workspace-interaction-generative-ui-prd.md` for complete acceptance.


## Preset creation

The composer slash catalog and plus button open the existing Particles drawer. `particle-presets.ts` supplies the eight standard types plus eight contextual preset categories reviewed from Shapeshift. Selection opens a local draft; the top-right plus persists it through the existing session/receipt path. No mutation runs just from matching text or choosing a tile. Message presets remain unsent calendar drafts; polls use Decision outcomes without public voting.

Activity `data.widget` optionally stores validated Event, Timer, Split, Color or Calculate configuration. Existing Activity payloads remain valid. Timer end times are UTC and display is derived without per-second writes. The arithmetic parser accepts numbers/operators/parentheses only. This is a JSONB payload extension, not a new database table. Current server/client schema must ship together; older strict decoders may reject the new optional widget payload rather than discard it.

Event presets use a shared minimal card in the library, drag overlay and canvas. Masonry view exposes a title, date/time chips with native pickers, place and comma-separated attendee names, Escape/clear and one Add event button. Drafts remain local and survive opening another preset. Enter adds from text inputs; portaled pickers do not trigger Add/clear. Dates/times are explicit device-local inputs converted to UTC; invalid dates and normalized DST gaps are rejected. Names are labels, not invitations or contact/provider actions; no natural-language interpretation is implied. Optional `location`/`attendees` extend the existing Event widget without a database migration. New Events use the large family; old Events remain valid. Invalid/cleared Event drafts cannot place via any library view, and retained creation receipts cannot falsely confirm changed Event data. The coarse-pointer drag grip sits at the top right, clear of the footer controls.

## Notes

The Notes preset uses a validated Activity widget. Standalone note titles and text live in the existing organization board's Particle graph; the Documents library projects those same records, including notes removed from the canvas. Opening a note in Documents loads its canonical record; edits use the existing authorized, revision-checked graph writer. Dragging it back uses its existing Particle ID. Notes now open the same two-pane editor from the canvas and Documents. Confirmed autosaves use the revision-checked graph writer and reconcile external changes/reset stale canvas history. Tiptap retains local Undo/Redo while editing a note.

In masonry view, Notes can be typed into before placement. The text area has extra top clearance inside the rounded body; it is not behind the inert preview/configure overlay. Inputs retain text selection while the header/card chrome remains draggable. Add and drag preparation use the same local draft; no graph or Documents write runs while typing. Configuring another preset hides rather than unmounts the gallery, preserving its text and placement cache. Read-only access disables draft editing. Unknown earlier placement receipts cannot confirm a newer body: retry the original request explicitly while retaining the edited draft in the library.

Lesson Notes Particles store only a module reference in the shared graph. Their text remains in the signed-in user's existing `module_progress.notes` record. The lesson rail, canvas and Documents editor use the same personal notes records. The combined editor adds compare-and-set personal writes and deletes only the notes field; completion and answers remain untouched. Another workspace member sees their own notes for that lesson, never the author's private text. Personal text saves retain the existing autosave semantics and are outside graph Undo/Redo. Failed loads disable editing; failed saves retain the draft and expose Retry. Navigation flushing is best effort.

The combined editor stores sanitized optional HTML alongside the existing plain-text content, and uses a content-specific UTC edit timestamp (legacy records fall back to their existing timestamp). Moving a note freezes its legacy timestamp rather than changing its edit date. First/second content lines supply the list title/preview. The scrollable list requests 30-item cursor pages, virtualizes rows, and searches full note bodies before pagination. Save failures retain drafts; switching/closing first flushes saves, with shadcn confirmations for discard and deletion. Documents lists both sources through an authenticated, uncached notes endpoint. It refreshes on confirmed saves, reactivation and window focus; no additional table, uploaded Markdown copy or competing persistence store is created. The lesson rail supports the existing drag overlay and plus placement control. Visual and authenticated interaction review remain user-owned.

## Calendar editing

Canvas rows open a specific entry in the retained inspector. The editor owns one parent Particle draft; switching nested entries preserves unsaved changes. Planning order is editable independently of the chronological canvas preview. Entries support channels, type, delivery, local schedule converted to UTC, content, CTA, status, actual publication time, URL and a validated Activity reference. Removal has a local restore action; saved changes use the same revision-checked batch/history path. Eight-entry pages and a four-entry canvas preview bound visible collections. No provider sends or publishes content from this editor.

## Decision editing

The existing inspector edits criterion titles/status/order and outcome labels/order, adds/removes records, and selects or clears a result. Criteria use eight-row pages and a four-row interactive canvas preview. Existing criterion resource references are preserved; this editor does not create or change those bindings. Outcome IDs stay stable when labels change, keeping saved handles and rails intact. Connected outcomes cannot be removed until their branches are disconnected; graph validation also rejects a concurrent connection race. Removing an unconnected selected outcome clears the result atomically. Save uses the existing Particle draft, revision checks and shared Undo/Redo receipts. Choosing a result highlights its branch without completing criteria or running work. Visual and authenticated browser review remain pending.

## Image cards

An Activity image widget stores an organization document file UUID, intrinsic dimensions and alt text. The card displays a rounded image and slim title only; the shared menu provides full preview and existing card actions. The library exposes one reusable Image tool; uploaded photos and empty instances are excluded from its record list. The tool adds a blank card without opening the inspector. Dropping one image into that card (or using its file chooser) fills the same ID, position and size through the existing upload/history path. Canvas drop/paste continues to create separate cards. Both use the existing private organization-document upload endpoint. Batches are limited to eight supported images and the existing 15 MB file limit; images must decode within dimension/pixel bounds. Signed read URLs are resolved lazily into transient state, never persisted. Removing or copying the Particle retains the underlying document reference. Failed graph saves retain uploaded references for reconciliation/retry; an interrupted upload itself may leave a file in Documents. Image replacement is staged in the existing inspector draft. No new database tables or public media exposure. Older strict widget decoders require the matching code update before reading this payload.

### Private file cards

The canvas drop and paste path accepts images, PDF, Markdown, DOCX, legacy DOC, CSV and TXT. Uploaded document Activity widgets persist the existing Documents file ID, format, original name and size. Organization storage permissions, upload limit and graph history apply unchanged. Storage URLs remain private; previews reuse existing renderers.

The single top-right action menu opens **Full screen**, a Motion/Radix viewer bounded to the canvas with focus restoration and reduced-motion support. PDF previews reuse DocumentPdfViewer at 640px raster on cards / 1600px expanded, retaining the selected page. Text/CSV/DOCX parse in a cancellable, timed worker. DOCX previews text only; legacy DOC offers the original and conversion guidance. CSV previews at most 1,000 rows/50 columns with at most 40 rows mounted; text previews cap at 100,000 characters. Truncation is visible. Markdown skips HTML and external image fetching. Preview payloads and signed URLs never enter persisted graph state.

### Size families

New Particles use `size` from the domain registry's supported families and default. Canvas dimensions derive from `particle-size.ts`: 192px grid cell and 16px gap. Old records without `size` preserve their optional legacy width and content-driven height. The existing `type` field remains authoritative; React Flow receives the complete record under `data.particle`.

The selected editable Particle exposes one bottom-right native NodeResizeControl. Resize dimensions stay transient; release chooses a supported family with normalized distance after a minimum 24-unit gesture. The existing card action commits one revision-checked operation and history entry. Cancellation, concurrent revision changes and failed saves restore persisted dimensions. A keyboard-accessible Size menu uses the same operation. Presentation/read-only mode hides editing controls while file previews remain available.

Shared container-query styling fills fixed frames and scrolls long bodies. Small cards emphasize primary progress/value; medium cards show short summaries; large and extra-large previews expose more real records. Documents fill the chosen family. Photos use width presets with intrinsic aspect-ratio heights; empty Image tools use a 16:9 preview until filled. Zoom never chooses a family. Neighbors remain unchanged, and measured geometry continues to drive explicit ELK auto-layout.


## Library placement motion

Organization, Activities and Fiscal Sponsorship reuse compact WorkspaceNodeFrame anatomy and `components/workspace/workspace-particle-chrome.ts` spacing with ordinary Particles: a 2px outer rim, 32px desktop header, 12px readable body inset and 8px vertical footer padding. Touch targets expand for coarse pointers. Activities uses ProgramCard's workspace surface without changing public card defaults. Tool masonry previews expose a corner Add control instead of duplicate external title/subtitle rows; placed tools retain dashed library placeholders. The source preview, drag overlay and canvas continue to use the same renderer. Width policies, stored positions and connection behavior are unchanged.

`ParticleLibraryDragProvider` owns one transient preview; `ParticleLibraryDragSource` supplies the existing card renderer and a typed placement request. Pointer movement updates Motion values directly, with no React graph updates or intermediate persistence. Presets use repeatable default factories and stable draft IDs; placements use the current workspace mutation/history path. The source slot remains in place. Validated optimistic placement settles/crossfades into the actual React Flow node immediately while the save runs in the background. The session keeps confirmed state separate, records history only on receipt, and restores the prior graph with visible feedback on failure.

The provider lives inside the existing workspace canvas context boundary. File uploads and People native drops retain their existing handlers. Touch uses a 44px grip so the rest of the library can scroll; plus controls retain keyboard placement. Escape, pointer cancellation, blur and failed confirmations restore the source. Reduced motion disables lift/tilt and transition durations. Motion tokens live in `lib/particle-drag-gesture.ts`. Device frame-rate and visual verification remain separate from unit/source checks.


### Documents library placement

DocumentsLibraryCard uses the same Motion drag provider in both grid/list views. The original card is the drag preview; ordinary open, selection and menu clicks remain separate. A focused keyboard Add to canvas control and the existing 44px touch grip provide placement alternatives. This is active only inside an editable workspace; standalone Documents remain unchanged.

Placements create validated Activity file widgets referencing the original uploaded file, Core Document upload, policy file, generated roadmap section or Google Drive link. They never upload or copy storage objects, persist signed URLs, or snapshot generated content. Generated sections reload through the existing scoped item endpoint. Images reuse thumbnail dimensions; early drags decode the existing authorized image once before placement. PDF/Markdown/Word/CSV/text retain existing previews and full-screen controls. Drive and unsupported formats offer Open original without claiming an unavailable provider preview. Removing or undoing a canvas card never deletes its Documents source.


### Reusable library card stacks

Masonry preset previews use ParticleLibraryCardStack: one real preview and two empty, inert back cards. The back cards use 12px offsets and 4% scale steps with a bottom origin, preserving visible depth for variable-height previews. Static bottom spacing keeps neighboring masonry items clear. No extra previews, fixed card heights, shadows, autoplay, Next control, or canvas decoration are added. Saved single-instance tools and document cards retain their existing presentation.

The existing drag overlay provides the outgoing card. Optimistic canvas handoff promotes the reusable preview from its first back-card position in 240ms using Motion transforms/opacity only; confirmation cannot trigger a second promotion. If no optimistic handoff occurs, a successful receipt provides the fallback trigger. Failure cancels/restores the local stack, and stale receipts cannot interrupt newer gestures. A new drag settles any unfinished promotion before its source geometry is measured. The real preview stays mounted; no source IDs, records or undo history are created by stack motion. Live reduced-motion preferences cancel animation, and unmount/view changes stop pending animation callbacks.

### Event calendar connection

New Event drafts require explicit date/time. Confirmed scheduled Event Activities appear in the existing internal organization calendar and workspace upcoming preview through a validated read model of the same graph record. No duplicated calendar table record or second write sequence. The source ID is `particle:<UUID>`; calendar selection opens the actual Particle inspector through `/workspace?particle=<UUID>`, including hidden cards without restoring placement. Standard calendar row update/delete actions explicitly reject these identities. Clearing the date unschedules; hiding keeps it scheduled; graph deletion removes it; existing graph Undo/Redo and immutable retry receipts control all of these together. Activities already backed by `calendar_event` sources are excluded to avoid duplicate projection.

Both the server graph action and a database trigger enforce calendar-management rights for semantic schedule changes; positions and hiding require only normal workspace rights. Calendar failure leaves the graph write atomic. Calendar viewers can open the source but retain normal editor permissions. Names are labels, not invitations; projected Events have no assumed end time.

Migration `20261015003000_workspace_particle_calendar_revisions.sql` adds one content-free signal row per organization. RLS-filtered delivery refreshes only mounted calendars after confirmed schedule changes. No polling, intermediate drag messages, typed-draft requests or full-board Realtime payloads. Bursts/focus/visibility are coalesced; reconnect closes the initial-read gap; auth changes and unmount release the subscription. Browser-local notifications are a fallback when the subscription is degraded. Existing workspace graph deliveries also trigger semantic invalidation. Workspace upcoming previews reuse the already loaded board, with no extra database request. Google board export, ICS feeds and invitations are deferred.

### Editor design prototype

`particle-editor.module.css` scopes a Radix Rhea-inspired prototype to metadata/preset form interiors. Neutral semantic tokens, compact 12px labels, 32px filled rounded desktop controls, 44px touch targets/16px mobile input text, a larger description, inline Status property and one scrolling content region with a nonshrinking Save footer. Header actions remain in the existing workspace portal; document-file editor delegation is unchanged. Preset preview columns use the window's container width and keep the shared Particle renderer outside field styling. Nested decision rows use matching inner/outer radii. Shared Field primitives receive only additive slot metadata; global control styling, fonts and project preset remain unchanged. Save validation, concurrency, retries, local drafts, permissions and Undo/Redo remain on their existing owners. No new dependency or database change. [Prototype plan](../../../docs/plans/2026-10-14-particle-editor-prototype.md).
