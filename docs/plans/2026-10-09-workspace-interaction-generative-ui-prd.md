# PRD — Coach House Workspace Engine

**Scope:** Layout, direct manipulation, contextual controls, rich content, forms, sharing, tools, and generative UI.  
**Priority:** High.  
**Status:** Proposed implementation contract; not implemented or validated.  
**Date:** 2026-10-09.  
**Lane:** `feat/particle-system-20261009`; localhost port 3008.

## 1. Relationship to the Particle PRD

This extends the [Particle System PRD](2026-10-09-coach-house-particle-system-prd.md). The original eight domain types, data integrity rules, theme requirements, and existing-workspace integration remain required. This document is authoritative for the expanded layout, selection, controls, content, sharing, and generative UI behavior.

The missing product foundation is a real workspace engine: reliable layout and editing tools that work across every Particle. Installing ELK or rendering draggable cards alone does not satisfy this requirement.

Deliver this inside the existing Coach House workspace. Maintain one canvas, one viewport, one authoritative persisted graph, and the existing organization data owners. This request produces the PRD; implementation follows the acceptance gates below.

## 2. Reference and evidence

User-provided reference: [Agent Builder product-discovery route](https://agent-builder-ui-one.vercel.app/#/agents/product-discovery).

**Inspection limitation:** The web reader could not retrieve the app. Browser inspection was then denied by browser security policy. No reference screen, interaction, source bundle, framework, backend, or generative runtime was verified. Do not describe requirements below as observed features of that site. Revisit the reference only after browser access is authorized or the user supplies screenshots/source.

Current Coach House evidence comes from the [initial repository evaluation](2026-10-09-particle-system-initial-evaluation.md):

- React Flow v11 currently renders the workspace; the target PRD requests `@xyflow/react`.
- ELK exists, but the inspected helper consumes predefined connections and card dimensions. It does not establish a measured, editable graph layout engine.
- The existing drawer already has collapsed, half, and full states.
- Board JSONB persistence has revision-checked writes and retries; objectives also have normalized records.
- Presence and cursor broadcasts exist. Shared graph-operation synchronization still requires verification and implementation where missing.
- The previous Particle feature exists in a preserved branch, not the audited main checkout.

The existing Fiscal Sponsorship component is a provisional visual reference. No supplied screenshot has been reviewed.

## 3. Outcome and scope

An organization can build a connected plan, arrange it deliberately, edit real records, display images, collect information through forms, share an appropriate view, and use tools or AI to propose and apply structured changes.

The same operation must behave consistently whether initiated by pointer, keyboard, form, command palette, or AI. Every visible control must have a real action, permission rule, saving behavior, and recoverable failure state.

### Required capabilities

| Foundation | Required result |
| --- | --- |
| Layout | Measured, stable, graph-driven trees with branching, convergence, manual positions, and intentional loop routing |
| Editing | Click and marquee selection, Shift toggling, group movement, alignment, duplication, deletion, and undo/redo |
| Controls | Minimal controls around rounded corners; revealed on hover, focus, or selection |
| Content | Real image display, nested records, editable forms, and reusable content layouts |
| Sharing | Workspace, selected branch, Particle, and form sharing with enforced permissions |
| Tools | Discoverable, typed actions with actual data/provider bindings |
| Generative UI | Validated UI composition and graph operations, previewed and applied through the same action system |

Retain the original Objective, Activity, Calendar, People, Decision, Metric, Workflow, and Finance types. Image and form are reusable content capabilities, not mandatory ninth and tenth domain types. An Activity can contain an image or registration form; a People Particle can contain intake. The registry remains extensible.

## 4. Architecture decision

**Selected approach:** Extend the existing canvas and data layer with a typed operation pipeline, shared rendering registry, and layout service.

Alternatives considered:

- Replace the workspace with a separate builder: simpler isolation, but duplicates routing, authorization, persistence, and user workflows. Reject.
- Allow unrestricted AI-generated components or JavaScript: broad flexibility, but unreliable validation, accessibility, authorization, and persistence. Defer; it is outside this release.

Conceptual pipeline:

```text
Pointer / keyboard / forms / commands / AI proposals
                         |
              Typed workspace operations
                         |
        Validate + authorize + check revision
                         |
          Existing authoritative data owners
                         |
           Domain graph and content records
                         |
          React Flow adapter + UI registry
                         |
      Measure -> layout -> route -> render
```

Transient hover, selection, open menus, and personal viewport state remain local. Persist records, connections, committed positions/sizes, locks, form definitions, and sharing grants. AI drafts are proposals until accepted. Avoid a second competing graph store.

## 5. Layout engine — release-blocking

### Inputs and outputs

Inputs include graph revision, explicit root, ordered Particle IDs, measured bounds, handle locations, typed relationships, locked/manual positions, layout scope, and spacing preferences. Domain and rendering IDs must map explicitly.

Outputs include positions, routed edge sections, bounds, diagnostics, and the revision the result was calculated against. Layout does not mutate records or statuses.

Use ELK layered layout, left to right, with orthogonal routing and rounded corners. Render routed sections inside the existing React Flow edge system. Merely applying ELK node coordinates while ignoring routing output is insufficient.

### Required behavior

1. Start from one explicit primary objective when present. Do not infer roots or dependencies from screen coordinates.
2. Branch parallel work vertically; advance dependencies horizontally; label decision outcomes; support convergence.
3. Use measured dimensions, including image aspect ratios, wrapping, expanded previews, and nested records. Await stable measurements before initial layout.
4. Use deterministic ordering and tie-breaks. The same graph, measurements, and options produce the same positions.
5. Keep handles distinct from corner controls. Route edges around card bodies, labels, fixed obstacles, and other handle hit regions.
6. Reject cycles in dependency/sequence relations. Explicit feedback edges remain valid only under their own semantics; route them separately without changing the dependency hierarchy.
7. Place disconnected work in a clearly separated region with stable ordering. Do not invent connecting edges.
8. Preserve edge attachment while dragging. Recompute affected routes after a committed move without repositioning unrelated Particles.
9. Recalculate after content resize only as needed for affected routes and managed regions. Manual overlaps are allowed with a visible correction action; do not silently move user-positioned content.
10. If constraints make a clean layout impossible, explain the conflicting locked region and offer a scoped correction. Do not silently unlock or overlap nodes while reporting success.

### Layout actions

| Action | Contract |
| --- | --- |
| Auto-layout | Deliberately arrange the current plan; respect locks; record one undoable operation |
| Arrange selection | Arrange selected Particles; treat unselected Particles as fixed obstacles |
| Arrange branch | Use explicit downstream graph traversal; show affected count; leave the rest unchanged |
| Align / distribute | Operate on the selection; preserve relationships and nested record ordering |
| Fit selection / plan | Change personal viewport only |
| Lock position | Prevent movement and layout replacement; keep content editing separately permissioned |

New Particles appear near their parent or insertion point using collision checks. Adding one step must not relayout the entire plan. Initial generation may auto-layout a new graph with no saved positions. Ordinary edits and reloads must never trigger a full reset.

Layout runs asynchronously, preferably in a worker. Cancel superseded jobs. Discard stale output when graph revision or measured geometry changes during calculation. Failure preserves the previous usable layout and offers retry. Undo restores exact prior positions and sizes.

**Proof fixture:** At least 30 Particles spanning all eight types, variable heights, two decision splits, convergence, disconnected work, a feedback edge, and locked obstacles. Automatic layout produces no Particle-body overlap; routed edges avoid unrelated bodies. Test at multiple zoom levels without changing graph coordinates.

## 6. Selection and direct manipulation

Default desktop tool: **Select**. Offer **Pan** through the integrated dock or shortcut; no second pan/zoom implementation.

| Input | Required behavior |
| --- | --- |
| Click unselected Particle | Replace selection with it and open its inspector at half-height |
| Click selected Particle | Retain it; clicking alone does not deselect it |
| Shift-click Particle | Toggle that Particle in/out of selection without changing others |
| Drag empty canvas in Select mode | Draw marquee; select Particles whose visible bounds intersect it |
| Shift-drag empty canvas | Add intersecting Particles to the existing selection |
| Click empty canvas | Clear selection and return a selection inspector to the compact dock |
| Drag unselected Particle shell | Select it and move it |
| Drag selected Particle shell | Move all selected, unlocked Particles together; preserve relative offsets |
| Space-drag or Pan tool | Pan without changing selection; ignore Space shortcuts while typing |
| Click input/button/checklist | Run that interaction without dragging, clearing selection, or triggering marquee |
| Escape | Close active menu or cancel active gesture first; otherwise clear selection |
| Cmd/Ctrl+A | Select all visible eligible Particles when canvas has focus; preserve normal text selection inside editors |
| Arrow keys | Move selected unlocked Particles by 1 canvas unit; Shift+arrow by 10 |
| Delete/Backspace | Remove eligible selected canvas objects; never hijack text editing |
| Cmd/Ctrl+Z; redo shortcut | Undo/redo local committed workspace operations; preserve native field editing history |

Use a small movement threshold to distinguish click from drag. A drag must not open the inspector as an accidental post-drag click. Multi-selection shows a count and compatible batch actions in the same dock, not several inspectors.

Connections are independently selectable. Shift toggles edge selection too. Particle marquee selects Particles, not every crossed edge. Selecting both endpoints does not imply deleting that relationship until a deletion operation requires endpoint cleanup.

Locked Particles can be inspected and selected but do not move. A mixed locked/unlocked group visibly indicates which objects will remain fixed. One group drag is one history entry and one atomic position operation.

Canvas movement, content text selection, nested scrolling, connector dragging, resizing, and form entry must not compete. Apply the framework's `nodrag`, `nopan`, and `nowheel` boundaries appropriately.

### Touch and keyboard equivalence

- Touch defaults to panning the empty canvas. An explicit Select mode enables marquee; a selection-mode tap toggles a Particle.
- A tap reveals the Particle controls and inspector. Do not rely on hover or Shift on touch devices.
- Focused Particles expose the same actions through a contextual menu and shortcuts. Enter selects/opens; Escape exits the current context predictably.
- Selection uses an outline and accessible state, not color alone. Announce selection count and completed batch actions without announcing every pointer movement.

## 7. Minimal corner controls

Rounded Particle shells remain quiet at rest. Reveal a compact, stable control layer on pointer hover, keyboard focus within, selection, or an open associated menu.

Proposed placement:

- Upper-left: move grip, only where the shell is draggable.
- Upper-right: one overflow control for edit, duplicate, lock, share, and removal.
- Lower-right: resize handle on resizable content; omit when unsupported.
- Side midpoint: connection handles; keep them spatially distinct from corner actions.

Do not show every action as a permanent icon. Limit the default hover layer to the grip, overflow, and applicable resize handle. A contextual add control may appear near an active connection handle for inserting a related Particle.

Requirements:

- Position controls outside content flow; appearing controls must not change dimensions, layout, or pointer targets.
- Keep a continuous hover region between the card and its controls. Moving to a corner control must not hide it.
- Keep controls visible while their menu is open or focus remains inside; use brief opacity changes and honor reduced motion.
- Use restrained monochrome icons, semantic tokens, accessible names, and delayed tooltips.
- Keep small visual glyphs but adequate hit areas: target 32px on desktop and 44px on touch, with no overlapping hotspots.
- Hide inaccessible actions or explain a real permission restriction. No inert placeholders.
- Preserve tab order and visible keyboard focus; ordinary pointer clicks must not leave persistent focus decoration.
- Keep essential status and save failures visible independently of hover.

Resizing has minimum/maximum bounds. Images preserve aspect ratio by default; text content reflows. Store explicit width only when the user changes it; ordinary content height remains measured, not fixed.

## 8. Images and reusable content

Image support includes upload, paste, and drag/drop through the established authorized attachment path. Link existing organization attachments by ID rather than duplicating files. External image URLs are accepted only through the existing approved media policy; do not add an unrestricted fetch proxy.

Every image has attachment identity, dimensions/aspect ratio, alt text, optional caption, fit mode, and focal position where cropping is supported. Private storage references stay private; temporary signed URLs are transport details, never durable identity.

Required UI: thumbnail/preview, contain or cover mode, resize, replace, remove from Particle, and full preview. Show uploading, progress, failed/retry, unavailable, and permission-denied states. An absent image must not become an infinite skeleton.

Reserve aspect-ratio space before loading to avoid unexpected movement. Remeasure when committed geometry changes. Lazy-load large/offscreen media, use appropriate derivatives, and avoid rendering full-resolution assets in every canvas card.

Removing an image from a Particle detaches the reference; it does not silently delete a shared source attachment. Duplicating a Particle preserves attachment references unless an explicit copy operation is chosen. Public sharing must use an authorized public derivative or projection, not expose a private storage URL.

Support a typed content registry for existing text, rows, checklist, image, form, metric, chart, and document-reference primitives. Their availability is constrained by the host Particle type. Use established shadcn components and tokens. Avoid turning every content row or media item into a separate Particle.

## 9. Forms with real data bindings

Distinguish two form modes:

1. **Editor forms:** Change Particle configuration or authorized underlying records inside the inspector.
2. **Collection forms:** Collect responses through a published form view, such as event registration or People intake.

Each versioned form definition includes stable field IDs, labels, field types, required/default values, validation, help text, options, ordering, declarative visibility rules, destination binding, and submit behavior. Initial field types: short/long text, email, number, select, multiselect, checkbox, date/time, and authorized attachment upload.

Use registered field components and shared runtime schemas. Conditional fields use a bounded rule language; no executable JavaScript. Detect rule cycles. Validate on the server regardless of client validation.

Show a concise form summary or a small useful subset on the Particle. Full authoring and editing lives in the dock. A collection form gets a responsive standalone shared view, without exposing the private canvas editor.

Rules:

- Preserve dirty input while switching selection; warn before a destructive discard or retain a local draft.
- Inline errors identify fields and preserve entered values; submission has pending, success, and recoverable failure states.
- Treat date/time input in the organization's selected timezone and store UTC with the timezone context needed to display it correctly.
- Required fields hidden by conditions must have explicit validation semantics.
- Make retries idempotent. A double-click or retried network request creates one response.
- Persist the form version with each response; later field edits do not reinterpret historical responses.
- Creating or linking a People/Activity record requires an explicit destination mapping and duplicate-handling policy.
- Submission permission does not grant response-reading permission. Anonymous forms require scoped grants, request limits, spam protections, and the existing consent conventions where applicable.
- AI can draft a form schema but cannot silently publish it or alter its data destination.

## 10. Sharing every eligible surface

Every workspace, selected branch, Particle, and collection form exposes **Share** where the user has authority. Shareability is a consistent capability; it does not mean everything is public by default.

### Sharing modes

| Mode | Behavior |
| --- | --- |
| Internal link | Deep link to workspace/Particle/entry; recipient must already have organization access |
| Invited access | Explicit permitted recipients and view/edit role, constrained by existing organization access rules |
| Public view | Explicitly published, read-only projection of approved fields and assets |
| Public form | Scoped submission view; does not expose responses, connected records, or editor permissions |

The Share interface shows exact scope, audience, access level, and preview before publication. Links can expire where supported, be revoked, and be copied. Anonymous public editing is outside the first release.

### Scope and consistency

- Branch sharing computes an explicit membership set. Adding a private neighbor later does not expand a public share automatically.
- Cross-boundary relationships are omitted or represented without leaking excluded titles, IDs, counts, or private details.
- Default public sharing is a published revision. Subsequent edits require **Update shared view**. Internal links follow live authorized data.
- A published revision can remain content-stable while access remains revocable. Share revocation is checked on every page/data request; protected assets follow the same authorization model.
- Public form definitions are versioned; publishing a new version does not rewrite prior submissions.
- Independent copies and downloads cannot be recalled; communicate that only when the user selects an export/download capability.

Never expose private People fields, finance transactions, draft communications, provider credentials, tool traces, or signed attachment URLs merely because their Particle is shared. Use explicit server-side field projections. Deny access by default when a referenced source cannot be safely projected.

A viewer cannot mutate through hidden buttons, direct API calls, generated actions, or tool invocations. Copying a link does not change permissions. Removing a Particle from a plan does not revoke unrelated legitimate shares or delete its source record.

## 11. Main tools and workspace chrome

Keep the original single floating dock with compact navigation, inspector, and composer. Do not introduce a permanent top toolbar or duplicate sidebar. The plus menu, contextual actions, and searchable command palette expose the tools.

| Tool group | Initial tools |
| --- | --- |
| Create | Add any registered Particle; attach existing data; add image; add form; add connection |
| Arrange | Select/Pan, auto-layout, arrange branch/selection, align, distribute, lock, fit view |
| Edit | Inspect, rename, duplicate, remove from canvas, undo, redo |
| Content | Open source, edit permitted fields, manage nested records, preview image, edit form |
| Share | Internal link, invite where authorized, publish view/form, revoke |
| Generate | Draft plan, extend branch, propose form, propose content, explain selected work |
| Integrations | Discover available organization tools and their connection/access state |

The composer submits explicit commands when AI is unavailable. Unmatched text stays a draft with an explanation and suggested supported actions. Never pretend it was interpreted.

Tool definitions are registered outside rendering and include identifier, label, input/output schemas, permission requirements, effect class, executor, UI renderer, and error mapping. Distinguish read, workspace mutation, external mutation, and publication. A tool is only available when its real implementation and required connection exist.

## 12. Generative UI harness

### Purpose

Provide a reusable runtime that lets AI compose approved UI and propose graph/data operations. Generated results must remain editable, accessible, persistent, and understandable after the conversation ends.

The model does not author unrestricted React code, install packages, choose server permissions, execute database queries, or insert arbitrary HTML. It produces validated declarative structures using registered components, actions, and data bindings.

### Contract

A generation request identifies organization/workspace, selection, user instruction, permitted context, current graph revision, and capability list. The server independently resolves identity and permissions.

A response contains:

- Versioned UI specification: component type, typed properties, children/slots, permitted data bindings, and registered actions.
- Proposed workspace operations with stable IDs and references.
- Assumptions and missing inputs, including whether values are targets, drafts, proposals, or verified observations.
- Validation results and the changes that require user review.
- Run identity and operation identity for traceability and safe retries.

Use discriminated unions per component, operation, and tool. Restrict depth, component count, payload size, references, URLs, and allowed actions. Reject unknown primitives and incompatible bindings instead of improvising arbitrary cards.

### Runtime lifecycle

```text
Draft -> Generating -> Validating -> Preview -> Applying -> Applied
            |              |           |         |
          Cancel         Invalid     Discard    Conflict / Failed
```

- Stream explanation/progress separately from structured UI. Render a component only when its chunk is complete and validated.
- Preview a proposed graph in the existing canvas as clearly marked, nonpersistent draft elements. Keep the saved graph intact until apply.
- Show the affected objects and scope. Users can edit the proposal, remove dependency-safe subsets, apply, retry, or discard. Removing a proposed object must revalidate its references.
- Apply accepted local graph changes atomically through the same operation pipeline as manual edits. A proposal is one undoable unit unless the user deliberately applies separate units.
- Recheck authorization and revision at apply time. Concurrent source edits produce a visible conflict or safe rebase; never overwrite newer edits with an old proposal.
- Cancel stops generation and prevents late responses from being applied. Cancellation after commit does not pretend the commit was undone; offer an explicit undo where supported.
- Persist run status and accepted operations as needed for reload recovery. Never duplicate applied records after reconnect or retry.
- External sends, payments, publication, and provider writes require the application's explicit action flow and an effect preview. Connecting Particles or accepting a layout does not execute them.
- Undo covers reversible workspace mutations. It must not claim to retract an email, payment, downloaded file, or other completed external effect.

Retrieved documents and provider content are data, not instructions or authority. The model cannot escalate its capabilities or use a generated action ID outside the registered allowlist. Tool execution remains server-authorized, organization-scoped, bounded, and logged without exposing secrets.

### Required proof scenario

“Create an event intake plan with a registration form, outreach calendar, readiness decision, and attendance target.”

The harness proposes existing Particle types, a versioned form, nested calendar drafts, explicit labeled relationships, and a coherent measured layout. The user can inspect and edit it before applying. Applying persists one valid graph operation batch. The form is not public, posts are not sent, and the attendance target is not a measured result until the corresponding real actions occur.

Provide a deterministic fake transport for tests, clearly marked test-only. Production generative UI is complete only after a real supported model transport passes the scenario. A command-only fallback is useful but does not satisfy that acceptance criterion.

## 13. Data, persistence, collaboration, and history

Separate these conceptual contracts without assuming each needs a new table:

- Particle identity, domain payload, source binding, and lifecycle.
- Connections with relation, ports, outcome, and feedback semantics.
- Layout positions, user-set size, lock, ordering, and layout revision.
- Content definitions and authorized attachment references.
- Form definitions, versions, and submissions.
- Share grants and published projections.
- Generation runs, proposals, and operation receipts.

Reuse existing source records and storage. New persistence must fit existing authorization and feature boundaries. Feature modules cannot import route-private workspace modules; extract a reusable service at an allowed boundary or inject the adapter through route composition.

Required mutation behavior:

- Server validation and organization-scoped authorization on every mutation.
- Stable UUIDs, idempotency keys, expected revisions, and transactional local batches.
- Optimistic edits with visible saving/error states and rollback or retry.
- Coalesce drag movement; persist committed group positions without one write per pointer frame.
- Distinguish remove-from-canvas from delete-underlying-record. Default removal cleans graph references only.
- Duplicate creates new Particle/nested-record IDs and remaps internal edges; external source references remain references. Do not silently clone real people, payments, or events.
- Undo/redo uses inverse operations and conflict checks. Undoing one user's work must not revert a collaborator's newer changes.
- Broadcast/reconcile committed operations through the existing collaboration infrastructure. Presence alone is not proof of collaborative editing.
- Do not promise offline collaborative editing in this release. Show connection loss and preserve unsaved work without claiming it is synchronized.
- Preserve old board fields and unknown forward-compatible data during migration. Rollout must not expose old clients that erase new graph data on save.

Database schema choices require a separate implementation decision after inspecting current tables and policies. No migration is authorized merely by drafting this PRD.

## 14. Accessibility and performance

Use semantic controls, accessible names, predictable focus restoration, keyboard equivalents, reduced motion, and theme tokens. Hover-only actions must have focus/touch equivalents. Form errors connect to their fields. Charts require text summaries; images require alt text or an explicit decorative designation.

Performance targets are proposed acceptance budgets, not measured results:

- Desktop benchmark: 250 Particles / 400 edges, including images, long calendars, and forms; pan/drag target 50+ FPS on an agreed baseline device.
- Desktop layout: p95 below 2 seconds after measurement for that graph; cancellation remains responsive and no stale result applies.
- Mobile benchmark: 75 Particles / 100 edges; p95 visible response to select/open actions below 100ms after data is loaded.
- No unnecessary whole-graph rerenders on hover or field input. No repeated ELK run on keystrokes or every drag frame.
- Keep expensive charts, images, and full forms out of offscreen or collapsed previews.

Record hardware, browser, dataset, and timing method with results. If budgets fail, profile and adjust implementation; do not present a small fixture as large-graph evidence.

## 15. Delivery sequence

Design and motion are part of each implementation slice. Apply section 18 before building controls; verify appearance and transitions alongside behavior, not in a final decoration pass.

1. **Foundation:** Confirm shared ownership; define operations, registry, source bindings, schema evolution, and conflict semantics. Plan the coordinated React Flow migration.
2. **Layout and editing:** Implement the measured layout engine, edge routing, selection matrix, group movement, history, and minimal corner controls. Prove persistence in the existing canvas.
3. **Content:** Complete all eight renderers, media lifecycle, forms, nested records, and inspector integration.
4. **Sharing and tools:** Implement scoped projections, grants, form publication/submission, contextual tool registry, and command interface.
5. **Generative harness:** Implement declarative UI proposals, real transport, validation, preview/apply, cancellation, recovery, and tool boundaries.
6. **Verification:** Focused automated tests, user appearance review, both themes, touch/keyboard behavior, collaboration conflicts, access checks, performance, and required hosted CI.

Ship reviewable slices behind the established feature-flag mechanism where appropriate. Do not declare the whole system complete after only card rendering, a seeded canvas, or an AI text response.

## 16. Acceptance gates

All original Particle acceptance criteria remain required, plus:

- [ ] Measured layout proof fixture branches and converges without overlapping Particle bodies or crossing unrelated bodies with routed edges.
- [ ] Repeated layout is stable; a new step and content edit preserve unrelated manual positions.
- [ ] Feedback loops, locked obstacles, disconnected work, stale layout results, and failures have tested behavior.
- [ ] Click, Shift-click toggle/deselect, marquee, additive marquee, group drag, edge selection, Escape, and keyboard movement match the interaction matrix.
- [ ] Multi-selection remains intact during group movement; one gesture produces one undoable operation.
- [ ] Nested forms, scrolling, checklists, handles, and resize controls do not accidentally drag/select the canvas.
- [ ] Corner controls appear on hover/focus/selection without layout movement or disappearing during menu use; touch equivalents work.
- [ ] Images upload/paste/drop, display, resize, preview, replace, and detach with tested loading/error/access states.
- [ ] Forms validate, retain drafts, persist versioned responses, and deduplicate retries; submitters cannot read other responses.
- [ ] Internal links respect access; public Particle/branch projections omit private fields and excluded connections.
- [ ] Public shares are explicitly published, revisioned, and revocable; private media and tool data do not leak.
- [ ] Every tool has a real executor or an explicit unavailable state, input/output validation, and enforced permissions.
- [ ] Real generative transport completes the proof scenario with editable validated UI and persisted operations.
- [ ] Invalid/partial generation, stale proposals, cancellation, retry, reload, and double-apply do not corrupt state or duplicate records.
- [ ] AI and manual operations share validation, authorization, persistence, and history behavior.
- [ ] Two sessions can change different Particles without losing either change; same-record conflicts and conflicting undo are surfaced.
- [ ] Existing workspace data, source records, drawer routes, and collaboration remain functional after migration.
- [ ] Light/dark, keyboard/touch, responsive dock, focus handling, and stated performance budgets have recorded evidence.
- [ ] Focused schema/layout/operation tests, component tests, end-to-end persistence/sharing tests, relevant RLS checks, and required current-head hosted quality pass.
- [ ] Section 18's design principles have behavior-level review evidence; motion timing, interruption, reduced motion, target sizes at supported zoom levels, and visual hierarchy pass desktop/mobile review in both themes.

## 17. Open inputs and working defaults

- **Reference access:** Unverified. Do not block architecture or PRD work on it; do not claim visual fidelity.
- **Sharing:** Default private; internal links are live; public views are explicitly published revisions; public forms permit scoped submission only.
- **Generated UI:** Approved declarative components and actions; arbitrary generated executable code is outside scope.
- **Layout:** One primary objective, left-to-right layered arrangement, persistent free manual positioning, explicit scoped arrange actions.
- **Forms/images:** Reusable capabilities hosted by the eight domain types; no extra standalone types until a distinct domain need is established.
- **Deployment:** Local implementation and validation do not establish provider readiness, publication, or production release.

## 18. Design, motion, and usability contract

Added at Caleb's explicit direction. These requirements apply to the actual canvas, controls, inspector, forms, sharing, and generative proposals. They are acceptance requirements, not implemented-feature claims.

### Visual direction

Build a calm, precise workspace for nonprofit operators: compact shadcn rows, the existing typography and semantic theme tokens, rounded Particle shells, restrained borders, and one integrated bottom dock. Retain the original Particle frame and inner-surface hierarchy. Reuse the app's established components and motion primitives. Do not introduce a different visual system for each type.

Use spacing to distinguish relationships: tight spacing within a record, larger separation between groups and graph branches. Keep previews concise and content-driven; show full details in the inspector. Give one contextual primary action emphasis. Selected objects, unresolved errors, and chosen decision branches have distinct, labeled states; ordinary content remains visually quiet. Preserve readability and focus contrast in light, dark, and system themes.

### Required application of the 21 principles

Treat these as design heuristics to test in context, not universal scientific guarantees or arbitrary limits on the number of visible items.

| Principle | Workspace requirement | Review evidence |
| --- | --- | --- |
| Fitts's Law | Keep frequent actions beside their object. Small glyphs receive separate, nonoverlapping hit areas: at least 32 CSS px desktop and 44 CSS px touch at interaction scale. Controls that shrink with canvas zoom need a screen-sized action surface or equivalent dock action. | Hit-area and pointer-travel review at supported zoom levels; touch actions require no precision tapping. |
| Hick's Law | Show one primary action and a short contextual set; reveal advanced tools through overflow or search. | Compare available actions for a single Particle, mixed selection, and empty canvas; remove irrelevant choices. |
| Jakob's Law | Retain familiar selection, Shift toggling, Space-pan, text editing, menu, and undo conventions from section 6 and existing shadcn controls. | Pointer/keyboard flows match the interaction matrix without stealing editor shortcuts. |
| Miller's Law | Chunk records and settings; show bounded previews, selected counts, and visible context instead of requiring users to remember IDs or earlier steps. Do not impose a fixed seven-item rule. | Complete a multi-step edit without memorizing prior values or switching away for context. |
| Tesler's Law | Handle layout, validation, reference cleanup, and save reconciliation in the system. Expose unavoidable decisions such as sharing scope or edit conflicts clearly. | Difficult cases have guided recovery and retain the user's work. |
| Doherty Threshold | Acknowledge input immediately; target visible local feedback within 100 ms after loaded-state input. Longer jobs expose honest pending state, cancellation where supported, and completion. | Measure input-to-feedback separately from network/layout completion on the benchmark devices. |
| Aesthetic-Usability Effect | Apply consistent typography, alignment, spacing, surfaces, and theme contrast to real functional controls. Attractive styling never replaces clear errors or readable content. | Review populated, empty, loading, error, and disabled states in both themes. |
| Goal-Gradient Effect | Derive progress from actual checklist/record states and show the remaining count near the next available action. | Empty, partial, complete, and reopened work display correct progress; no fabricated percentages. |
| Peak-End Rule | Make successful layout/application easy to understand; end edits with accurate saved, pending, or failed feedback and a relevant recovery/undo action. | The user can tell what changed and whether it persisted after success, failure, and undo. |
| Von Restorff Effect | Reserve emphasis for the current selection, primary action, chosen branch, and actionable error. | Accent, weight, and labels distinguish priorities without making every card compete. |
| Zeigarnik Effect | Preserve unfinished drafts and display unresolved work where relevant, with a direct resume path. | Reopen an interrupted edit without loss; avoid nagging badges or artificial urgency. |
| Serial Position Effect | Preserve the prescribed navigation order; place frequent contextual actions first and separate destructive actions at the end. | Menus remain stable across repeated use; no usage-based reshuffling. |
| Law of Proximity | Keep labels, values, errors, and actions near the records they affect; separate unrelated branches consistently. | No ambiguous field errors, detached actions, or misleading visual grouping. |
| Law of Similarity | Share frame anatomy, status semantics, control treatment, and interaction states across all eight types while allowing specialized bodies. | The same status/action looks and behaves consistently across types. |
| Law of Common Region | Use the Particle boundary and inner content surface to group related records; the expanding dock remains one component. | Nested records and inspector content have clear ownership without excessive boxes. |
| Law of Prägnanz | Prefer a legible hierarchy, simple silhouettes, clear labels, and restrained routing. Collapse detail before shrinking essential text. | The primary objective and branches remain understandable at overview scale. |
| Law of Uniform Connectedness | Draw relationships from persisted graph data, with explicit handles and outcome labels. Keep routes synchronized with movement. | Proximity never invents an edge; branch highlighting matches the recorded decision. |
| Occam's Razor | Reuse existing controls, viewport, persistence, and interaction patterns; add a new abstraction only for a demonstrated need. | No duplicate canvas, navigation layer, or competing control for the same action. |
| Pareto Principle | Prioritize selecting, editing, connecting, arranging, and resuming work; keep less frequent tools discoverable through progressive disclosure. | Observe representative operator tasks before asserting that any fixed usage percentage holds. |
| Postel's Law | Accept convenient human input formats where interpretation is unambiguous, then show normalized values. Keep stored and generated contracts strict; reject ambiguous dates, invalid URLs, unknown operations, or unauthorized actions with guidance. | Input convenience never weakens schema validation, permissions, or predictable output. |
| Parkinson's Law | Build bounded vertical slices with explicit acceptance and time-box exploration; communicate realistic processing state without invented countdowns. | Each slice has a reviewable finish; scheduling pressure does not waive correctness or accessibility. |

### Motion specification

The signature transition is the existing dock expanding upward into the selected Particle's inspector while preserving canvas context. Motion explains continuity and confirms actions. No decorative canvas entrance sequence, perpetual edge pulses, confetti, bounce, or elastic overshoot.

The following durations are initial implementation targets, subject to device testing. Reuse shared duration/easing tokens; use a restrained ease-out curve such as `cubic-bezier(0.25, 1, 0.5, 1)`. Exits should be shorter than entrances.

| Interaction | Target behavior | Reduced-motion behavior |
| --- | --- | --- |
| Hover/focus corner controls | 100–140 ms opacity reveal; maintain hit geometry and continuous hover region. Keyboard focus becomes visible immediately. | Immediate reveal. |
| Press, selection, checklist | Immediate state feedback; optional 80–120 ms visual settling. No delayed toggles or shifting click targets. | Immediate final state with the same status text. |
| Dock snap/inspector | 200–280 ms coordinated transition; a direct drag follows the pointer without tween lag. Keep composer/nav stable and inspector focus predictable. | Snap directly; preserve focus and content. |
| Inspector content change | At most 120 ms opacity transition. Replace content promptly and cancel prior transitions on rapid selection. | Immediate replacement. |
| Explicit auto-layout | 240–320 ms transition only after valid measured output; nodes and React Flow routes stay synchronized. Preserve viewport unless fit is explicitly requested. Large graphs may snap if profiling shows motion exceeds the budget. | Apply final positions immediately, with concise completion feedback. |
| Group drag, resize, marquee | Track the pointer immediately; no spring trailing, animated coordinate smoothing, or layout recalculation per frame. Commit once per completed gesture. | Identical direct manipulation. |
| Progress/save/result | 120–180 ms change only when underlying state changes; distinguish optimistic, saved, and failed states. Success does not wait for animation. | Immediate status/progress changes. |

Implementation rules:

- Use transform/opacity where appropriate; avoid `transition: all`, per-frame persistence, and whole-canvas rerenders. Use existing drawer geometry management for actual content layout; any measured resize must not leave invisible hit targets or stale React Flow bounds.
- Support interruption and reversal from the current visible state. Selection changes, a new drag, cancellation, or undo must not let old animation callbacks apply stale state.
- Animate nodes through the existing React Flow coordinate/rendering boundary so handles, edges, selection bounds, and content stay aligned. Do not create an independent pan/zoom or SVG animation layer.
- `prefers-reduced-motion` disables spatial interpolation and decorative motion. State, progress, loading, and error information remain available through text/icons and appropriate live announcements.
- Motion never gates input, stretches an operation artificially, implies an uncommitted save, or hides a failure. Keep focus rings immediate and use focus-visible behavior.
- At low zoom, use appropriately scaled controls or the integrated dock; enlarged transparent targets must not intercept adjacent Particles, connections, or form controls.

### Design verification in every UI slice

1. Review the shared frame, corner controls, dock, and nested rows in light/dark, desktop/mobile, normal/reduced motion.
2. Exercise hover-to-menu travel, touch equivalents, keyboard focus/return, marquee and Shift selection, group drag, nested scrolling, and form editing.
3. Interrupt dock/layout transitions with rapid selection, drag, cancellation, undo, and a simulated save failure. Confirm no stale output, focus loss, duplicate action, or false saved state.
4. Record input response and frame behavior on the defined fixtures; distinguish targets from measured results. Verify no layout shift from controls appearing.
5. Capture visual evidence and update intentional visual baselines using the repository workflow. Passing schema tests alone does not satisfy this design gate.
