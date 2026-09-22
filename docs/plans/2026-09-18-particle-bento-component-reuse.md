# Particle catalog bento and component reuse plan

Date: 2026-09-18

Status: Batches 0–7 implemented locally; Batch 8 read-only review recorded below. See Context dump 10 for current evidence and remaining canaries. Earlier planning/current-state sections are historical.

## Product direction

The Particles drawer should be a compact, responsive bento catalog of useful previews.

- Keep every standard particle ultra minimal.
- Put the Add/Show action in the upper-right corner.
- Remove the description below each preview.
- Keep document and preview text left-aligned.
- Preserve the established Organization and Activity card designs instead of inventing replacements.
- Preserve the established Calendar component design. Only its catalog footprint should change.
- Make Calendar the larger bento item.
- Preserve drag, drop, reveal, keyboard, mobile, read-only, and canvas persistence behavior.

## Current state

The durable GitHub checkpoint is commit `f971843e`. It contains the last reviewed compact catalog.

The active root has additional uncommitted work from the interrupted implementation:

- `ParticleTile` removes the description, reduces the tile height, left-aligns preview content, and starts moving Add/Show into the header.
- The catalog grid starts using fixed bento rows and dense placement.
- Calendar starts spanning two rows and two columns on wider screens.
- An unrequested custom Calendar preview and Calendar data plumbing were added. These must be removed before further design work.
- Organization and Activity received speculative miniature redesigns. These must be removed before deciding how to reuse their established components.
- Validation was interrupted. None of the current uncommitted bento work is approved or ready to push.

## Audit findings

The review covered both the durable `f971843e` pass and the interrupted root changes.

### Last pushed pass

- Organization and Activity previews are new approximations in `particle-preview.tsx`; they do not reuse the established canvas components the user referenced.
- Calendar falls through to the generic roadmap text preview instead of using the established Calendar presentation.
- Drive still renders a file icon and filename even though the Documents surface already exposes authenticated thumbnail and text-preview infrastructure. This does not satisfy the earlier request to show the document itself.
- The catalog test asserts that media and text exist, but it does not assert reuse of the established designs, proportional sizing, top alignment, or responsive behavior.
- Inner tile elements have no particle-specific React Grab ownership. Selecting the action, title, description, or preview often reports only `WorkspaceParticlesPanel / sources-grid`, which made the latest feedback ambiguous and encouraged incorrect guesses.
- The density plan says to validate light mode and narrow widths. The recorded browser evidence proves the final dark desktop state and scroll behavior; it does not prove a completed visual review of the final light and mobile states. The prior final report overstated that evidence.
- The four design-craft files preserve actionable summaries and source links, but not all of the supplied explanations, demos, examples, and resource links. That is incomplete relative to the request to save the provided information.

### Interrupted root changes

- A second custom Organization and Activity redesign was started instead of first mapping reusable components.
- A custom Calendar grid and new Calendar data model were introduced even though the request was only to enlarge the established Calendar design in the bento catalog.
- Calendar data was threaded through feature and dashboard layers before a reuse boundary was planned.
- The dedicated visible drag grip was removed without confirming that its affordance should disappear.
- `auto-fit` with flexible tracks can stretch a small filtered result set across the drawer, recreating the disproportionate spacing problem.
- Fixed 8rem rows were chosen before measuring the established component proportions and can crop or distort previews.
- The first browser check showed the Add/Show action on a second header row. `CardAction` was then added, but final placement was not verified before implementation stopped.

These findings are acceptance blockers. Do not push the interrupted root state.

## Working protocol

Each batch is a separate unit. Before editing a batch, append a short `Batch plan` entry to this document containing:

1. Exact outcome.
2. Files allowed to change.
3. Existing component or contract being reused.
4. Acceptance checks.
5. Rollback point.

After the batch, append a `Context dump` entry containing:

1. What changed.
2. What was deliberately preserved.
3. Files changed.
4. Browser evidence and measurements.
5. Tests and guardrails run.
6. Remaining uncertainties.
7. Git branch, commit, upstream, and push state.

The next batch starts only after its new batch plan is written. Do not carry undocumented assumptions between batches.

## Batch 0: Remove speculative work

### Batch plan

Outcome: return to the reviewed `f971843e` preview behavior while retaining no unreviewed Calendar, Organization, or Activity redesign.

Allowed files:

- `src/features/workspace-particles/components/particle-preview.tsx`
- `src/features/workspace-particles/components/particle-tile.tsx`
- `src/features/workspace-particles/components/workspace-particles-panel.tsx`
- `src/features/workspace-particles/types.ts`
- `src/features/workspace-particles/lib/particle-sources.ts`
- `src/features/workspace-particles/hooks/use-particle-sources.ts`
- `src/features/workspace-particles/hooks/use-workspace-particles-controller.ts`
- `src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/use-workspace-particle-sources.ts`
- `src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-particles-surface.tsx`

Preserve the reviewed implementation from `f971843e`. Remove only the interrupted speculative preview and Calendar-data changes.

Acceptance:

- No `ParticleCalendar` type or Calendar data plumbing remains.
- The tile shell and source grid match `f971843e`; later batches own their redesign.
- `ParticlePreview` uses the reviewed Organization, Activity, and roadmap preview implementations.
- Focused formatting and TypeScript checks reach the same known baseline as `f971843e`.

Rollback point: durable checkpoint `f971843e`.

## Batch 1: Restore granular ownership and identify targets

### Planned outcome

Give the tile, title, action, preview, and optional supporting copy their own semantic React Grab slots under the `workspace:particles` owner before making another visual inference.

Primary files:

- `src/features/workspace-particles/components/particle-tile.tsx`
- `src/features/workspace-particles/components/workspace-particles-panel.tsx`
- A small shared ownership helper inside `src/features/workspace-particles/components/` if required.

Acceptance:

- Selecting the Add/Show action reports `particle-action`.
- Selecting the title reports `particle-title`.
- Selecting the preview reports `particle-preview` and the source kind/id.
- No selection inside a tile falls back to `sources-grid` or an ownerless `Card` primitive.
- No appearance or behavior changes in this batch.

## Batch 2: Ultra-minimal shared tile shell

### Planned outcome

Change only the catalog shell around each existing preview:

- Title at upper-left.
- Add/Show action at upper-right using `CardAction`.
- No description block.
- One draggable preview surface.
- Left-aligned preview text.
- Concentric outer and inner radii.
- Instant hover response.

Do not change Organization, Activity, Calendar, roadmap, Drive, image, or objective preview internals in this batch.

Primary files:

- `src/features/workspace-particles/components/particle-tile.tsx`
- `src/features/workspace-particles/components/workspace-particles-panel.tsx`
- Focused acceptance tests only when behavior needs coverage.

Acceptance:

- Add/Show is visibly in the upper-right, not a second row.
- Descriptions are absent.
- Drag and keyboard-add remain available.
- Standard tiles retain one consistent proportion at desktop and mobile widths.

Do not remove the visible drag grip until its role is explicitly resolved during this batch. The full preview may remain draggable, but removing the only drag affordance requires evidence that the resulting interaction is still clear.

## Batch 3: Map established Organization and Activity designs

### Planned outcome

Identify and reuse the existing visual and data contracts before changing either catalog preview.

Organization source:

- Canvas shell: `WorkspaceBoardNodeCardShell` and `WorkspaceBoardOrganizationCardShell`.
- Content: `OrganizationOverviewCard`.
- Preserve banner, logo, title, subtitle, and stat hierarchy.

Activity source:

- Confirm the intended established card. The current source reveals the `programs` canvas node while its drawer data is a recent activity feed.
- Resolve that mismatch before implementation.
- Reuse or extract a shared presentational component; do not make a second approximate design.

Architecture rule:

- `src/features/**` must not import from `src/app/**`.
- If direct reuse crosses that boundary, extract the smallest presentational primitive to a shared component location and have both surfaces consume it.

Acceptance:

- Organization and Activity are recognizable miniatures of their actual canvas cards.
- No duplicate design implementation remains when a shared primitive is viable.
- Drawer previews stay read-only and keep drag as the primary interaction.

## Batch 4: Responsive bento layout

### Planned outcome

Introduce bento sizing without redesigning preview content.

- Standard particles occupy one bounded grid unit and do not stretch when a filter returns only one or two items.
- Calendar occupies two rows and, when space permits, two columns.
- Calendar remains one column wide on narrow screens while retaining extra height.
- Dense placement fills gaps around the larger Calendar tile.
- The catalog remains independently scrollable with its existing content-aware bottom fade.

Primary files:

- `src/features/workspace-particles/components/workspace-particles-panel.tsx`
- `src/features/workspace-particles/components/particle-tile.tsx`

Acceptance:

- No horizontal overflow at 390px.
- Calendar is larger without forcing every tile to grow.
- Desktop proportions remain compact.
- Filter and search changes do not leave broken grid gaps.
- A single filtered item retains the same width and proportion as it has in the full catalog.

## Batch 5: Reuse the established Calendar design

### Planned outcome

Use the existing Calendar presentation inside the larger tile. Do not author a new Calendar component.

Candidate existing contracts to inspect before editing:

- `WorkspaceBoardCalendarCard`
- `renderCalendarCanvasPreviewCard`
- `CalendarDateStripEventsPanel`

If those components cannot be reused because of feature boundaries or interactive dependencies, extract a shared read-only presentation primitive first. The catalog should pass existing data into that primitive.

Acceptance:

- Calendar content matches the established canvas Calendar design.
- No custom calendar grid or competing date-strip design is introduced.
- The drawer version is read-only, compact, and fully visible within its bento footprint.

## Batch 6: Reuse authenticated Drive document previews

### Planned outcome

Use the existing authenticated Drive preview path and shared Documents thumbnail behavior so a linked document displays its first-page image or top-aligned text preview instead of only a file icon.

Existing contracts to inspect before editing:

- `DocumentThumbnail`
- `useDocumentPreviewUrl`
- `/api/integrations/google-drive/documents/[documentId]/preview`
- The Drive fields produced by `documents-library-items.ts`

Acceptance:

- Supported Drive files show their document preview.
- Long documents start at the top rather than centering a cropped middle region.
- Loading, unsupported, inaccessible, and reconnect states remain compact and clear.
- Authentication and organization boundaries remain server-enforced.

## Batch 7: Preserve the supplied design references

### Planned outcome

Expand the four design-craft notes so the repository retains all user-supplied principles, code examples, demo links, and resource links with source attribution. Keep the short implementation rules at the top for agents.

Acceptance:

- Image outlines, optical alignment, nested radii, and hover restraint each retain the supplied practical detail.
- `AGENTS.md` and the UI rubric continue to point to the notes.
- The notes distinguish quoted/source material from repository-specific rules.

## Batch 8: Responsive and interaction verification

### Planned outcome

Verify the actual Workspace drawer rather than a visual fixture.

Checks:

- Desktop dark and light themes.
- 390px mobile width.
- Keyboard focus and Enter-to-add.
- Mouse and touch drag activation.
- Organization and Activity reveal their existing canvas cards rather than creating duplicates.
- Calendar and other roadmap particles keep existing add, size, position, connection, and persistence behavior.
- Scroll fade appears only when more rows remain and clears at the end.
- No parent drawer scrolling hides the Particles header.
- Final light and dark screenshots are both inspected after all visual changes.

## Batch 9: Quality and durable handoff

### Planned outcome

- Run focused tests, scoped lint, formatting, structure, thresholds, boundaries, React Grab, Workspace surfaces, and raw-button checks.
- Run `graphify update .`.
- Append the final context dump to this document and the current monthly runlog.
- Refresh the isolated preservation checkpoint.
- Secret-scan, commit, push, and verify local/remote parity only after the implementation is reviewed.

No merge, deployment, provider mutation, database mutation, or production activation is part of this plan.

## Context dump 0: planning stop

- Implementation stopped after the user rejected the custom Calendar redesign.
- No new bento work has been committed or pushed.
- The live localhost preview may currently reflect the interrupted uncommitted code through hot reload.
- Durable recovery remains `chore/stakeholder-checkpoint-20260916` at `f971843e`.
- Next action is Batch 0 only, after review of this plan.

## Context dump 1: full audit

- Reviewed the current root against checkpoint `f971843e`, the user’s pasted surface targets, and the earlier Drive-preview request.
- Confirmed four pushed design gaps: bespoke Organization/Activity previews, generic Calendar content, icon-only Drive content, and missing granular React Grab ownership.
- Confirmed two documentation/evidence gaps: condensed source notes and an overstated light/mobile verification claim.
- Confirmed six interrupted-work risks: speculative component redesigns, premature Calendar data plumbing, removed drag affordance, stretching `auto-fit` tracks, unmeasured fixed rows, and unverified action placement.
- Added ownership, Drive preview, source-note fidelity, and bounded filtered-tile sizing as mandatory batches.
- No corrective implementation, commit, push, or browser mutation was performed during this audit.

## Context dump 2: Batch 0 complete

- Removed the speculative Calendar type, data plumbing, custom Calendar grid, and second Organization/Activity redesign.
- Restored `particle-preview.tsx`, `particle-tile.tsx`, `workspace-particles-panel.tsx`, particle types/sources/hooks, and both Workspace adapters byte-for-byte to checkpoint `f971843e`.
- Amended Batch 0 after TypeScript exposed a leftover `source.calendar` reference in `ParticleTile`; the final nine-file comparison reports no differences.
- Prettier passes. TypeScript reaches only the pre-existing duplicate `vi` import in `tests/acceptance/account-settings-profile.test.ts`.
- No browser changes, commit, or push occurred.

## Batch 1 execution plan

- Outcome: make React Grab identify the catalog panel, tile, title, grip, preview, action, and description precisely without changing appearance or behavior.
- Files: `particle-surface.ts` (new), `particle-source-handle.tsx`, `particle-tile.tsx`, and `workspace-particles-panel.tsx`.
- Contract: reuse `getReactGrabLinkedSurfaceProps` with canonical owner `workspace:particles` and include the particle source key in tile slots.
- Acceptance: each inner element resolves to its own semantic slot; focused tests, lint, formatting, and React Grab ownership checks pass; the live screenshot is visually unchanged.
- Rollback: Batch 0’s byte-identical `f971843e` source state.

## Context dump 3: Batch 1 complete

- Extracted the shared `workspace:particles` ownership contract to `particle-surface.ts`.
- Added source-keyed semantic surfaces for each tile, title, visible grip, preview frame, draggable preview, Add/Show action, and description.
- Extended `ParticleSourceHandle` with data-only surface props; drag, keyboard, click, and visual behavior are unchanged.
- Live dark desktop screenshot matches the Batch 0 baseline. Prettier, scoped ESLint, React Grab ownership, and 32 focused tests pass.
- No commit or push occurred.

## Batch 2 execution plan

- Outcome: make the standard tile shell ultra minimal without modifying preview internals.
- Files: `particle-source-handle.tsx`, `particle-tile.tsx`, and the Drive loading skeleton in `workspace-particles-panel.tsx`.
- Control decision: merge the visible drag grip and Add/Show action into one source handle at the upper-right. Its icon is Plus or Check; dragging, clicking, and pressing Enter use the same control.
- Visual decision: retain the title at upper-left, remove the description, use a 12px outer radius with an 8px inner radius, reduce the preview to 96px, and inherit left text alignment through the draggable preview.
- Preserve: preview component markup, source data, filters, grid sizing, drag sensors, and canvas behavior.
- Acceptance: one upper-right control, no bottom-right overlay, no description, no centered document text, no lost drag/keyboard behavior, visually compact at desktop width.
- Rollback: Batch 1 ownership state.

## Context dump 4: Batch 2 complete

- Replaced the separate grip and bottom-right Add/Show overlay with one visible upper-right source handle using Plus/Check state.
- The same upper-right control supports drag, click, and Enter. The preview remains mouse/touch draggable but is removed from the keyboard and accessibility order, eliminating duplicate controls.
- Removed the description block, reduced the preview to 96px, applied concentric 12px/8px radii, and made preview text inherit left alignment.
- The live dark desktop drawer shows six compact cards across with the action in the correct corner and no supporting description row.
- Prettier, scoped ESLint, React Grab ownership, and 32 focused tests pass. No commit or push occurred.

## Batch 3 execution plan

- Outcome: make Organization and Activity catalog previews consume the same presentational components and data as their canvas cards.
- Organization files: extract the Organization overview body from `workspace-board-node-static-cards.tsx` into a shared `src/components/workspace/` component with full and compact modes; render that component from both the canvas card and `ParticlePreview`.
- Activity files: pass the current organization programs into particle sources and render the existing shared `ProgramCard` in compact list mode. The recent-activity feed remains only as a no-program fallback during compatibility migration.
- Data files: particle types/source builder/hooks/controller plus the Workspace particle-source adapter and surface.
- ProgramCard constraint: suppress its internal CTA when no CTA is supplied so the drawer does not place an interactive button inside the draggable preview.
- Preserve: `organization-overview` and `programs` canvas-node IDs, reveal/reposition behavior, canvas persistence, and full-size canvas visuals.
- Acceptance: the canvas Organization body renders through the shared component with unchanged full styling; the drawer uses its compact mode; Activity shows the actual current program card; no `src/features/**` import reaches into `src/app/**`; focused tests, boundaries, lint, and browser review pass.
- Rollback: Batch 2 compact shell with the pushed facsimile previews.

## Context dump 5: Batch 3 complete

- Extracted `WorkspaceOrganizationOverviewSummary` with full and compact modes. The existing canvas Organization card and drawer preview now consume the same banner, logo, identity, Objects, People, and Raising presentation.
- Passed current structured programs through the Workspace particle-source adapter, controller, and source model. Activity renders the established `ProgramCard` in list mode; the existing recent-activity presentation remains the empty-program fallback.
- Preserved `organization-overview` and `programs` canvas IDs, reveal/reposition behavior, board persistence, the Batch 2 tile shell, and feature-to-app import boundaries. `ProgramCard` now omits its action area when neither an href nor click handler exists, avoiding nested interaction inside the draggable preview.
- Corrected two review findings before completion: the full Organization title retains its prior two-line clamp, and the drawer's Objects count uses the same current program list as the canvas. Reduced the touched Workspace surface to 449 lines to remain within the structure contract.
- Files changed for this batch: `workspace-organization-overview-summary.tsx`, `program-card.tsx`, `workspace-board-node-static-cards.tsx`, `particle-preview.tsx`, particle types/source/hooks/controller, both Workspace particle adapters, `workspace-canvas-surface-v2.tsx`, and focused acceptance coverage.
- Authenticated localhost dark-desktop review at 1792x1008 verified that the Organization preview exactly matches the visible canvas card data (`Objects 3`, `People 161`, `Raising $100K`), Activity shows the current Youth Stewardship Fellows program, both filtered previews avoid horizontal overflow, Activity contains no nested interactive CTA, and browser error logs are empty. The All filter was restored. Light/mobile verification remains assigned to Batch 8.
- Validation passes: Prettier, scoped ESLint, TypeScript, 40 focused tests across three files, structure, thresholds, boundaries, React Grab ownership, Workspace surfaces, and raw-button checks. The first focused rerun exposed only an incorrect raw-URL assertion for Next's encoded image output; the assertion was corrected and the suite passed. AST-only `graphify update .` completed with 19,905 nodes, 57,283 edges, and zero model/API tokens.
- Branch remains `chore/local-development-20260907` at `b476ada1`. Work is local and uncommitted; no push, merge, deployment, provider/database mutation, or user-data write occurred. Durable recovery remains `f971843e` until a later authorized checkpoint refresh.

## Batch 4 execution plan

- Outcome: introduce responsive bento sizing without changing any preview content.
- Files: `workspace-particles-panel.tsx`, `particle-tile.tsx`, and focused Particles acceptance coverage.
- Layout contract: use fixed 10rem tracks below `sm` and fixed 11rem tracks at `sm` and above so sparse results retain full-catalog proportions; keep 9rem rows, dense placement, independent scrolling, and the existing content-aware fade.
- Calendar contract: identify the established `board_calendar` roadmap source, span two rows at every width, and span two columns only at `sm` and above. Its preview frame fills the larger footprint; standard preview frames remain 96px tall.
- Acceptance: no horizontal overflow at 390px; a single standard result does not stretch; Calendar grows without changing standard tiles; filter/search reflow leaves no artificial gaps; desktop remains compact; focused tests, lint, formatting, structure, boundaries, React Grab, Workspace surface, raw-button, TypeScript, and authenticated browser checks pass.
- Rollback: Batch 3 shared Organization and Activity state.

## Context dump 6: Batch 4 complete

- Replaced fractional auto-fill tracks with fixed 10rem mobile and 11rem desktop tracks, 9rem rows, start alignment, and dense placement. Sparse standard results now retain the same dimensions as the full catalog.
- The established `board_calendar` roadmap source alone spans two rows and fills its larger preview frame. It spans two columns at `sm` and above, then returns to one column below `sm`; no preview content changed.
- Preserved the compact tile shell, source actions, drag and keyboard behavior, every existing preview, filters, search, independent catalog scrolling, and the shared content-aware bottom fade. Drive loading skeletons now use the same bounded grid contract.
- Files changed for this batch: `workspace-particles-panel.tsx`, `particle-tile.tsx`, focused coverage in `workspace-particles.test.ts`, this execution record, and the current monthly runlog.
- Authenticated localhost dark-desktop review measured six 176px tracks; standard tiles are 176x144, filtered Budget remains 176x144, and Calendar is 362x298. At a 390px viewport the grid uses two 160px tracks, Calendar is 160x298, the document and Particles section remain exactly 390px wide, and dense placement puts Handbook and Next Actions in the two right-side row gaps beside Calendar. The scroll viewport remains independently scrollable with its active bottom fade. Search was cleared, the desktop viewport was restored, and browser errors were empty.
- Prettier, scoped ESLint, 41 focused tests across three files, structure, thresholds, boundaries, React Grab ownership, Workspace surfaces, raw-button checks, and `git diff --check` pass. Repository-wide TypeScript is blocked outside this batch by the concurrently reintroduced duplicate `vi` import at lines 1 and 8 of `tests/acceptance/account-settings-profile.test.ts`; that unrelated file was preserved. AST-only `graphify update .` completed with 19,905 nodes and 57,288 edges.
- Branch remains `chore/local-development-20260907` at `b476ada1` with no upstream. Work is local and uncommitted; no push, merge, deployment, provider/database mutation, or user-data write occurred. Durable recovery remains `f971843e`.

## Batch 5 execution plan

- Outcome: replace Calendar's generic roadmap text with the established five-day date-strip and event-row presentation, without introducing a competing calendar design.
- Shared-component contract: extract the existing Calendar date-tile and event-row visuals into `src/components/workspace/`, keep the canvas card's buttons, date navigation, event sheet, and edit controls in its app-owned component, and compose the same primitives into a read-only catalog preview with no nested controls.
- Data contract: define the smallest feature-owned Calendar event shape, map real `seed.calendar.upcomingEvents` through the existing particle-source adapter/controller path, and attach those events only to the `board_calendar` roadmap source. Do not persist duplicate event content in particle placements.
- Primary files: the new shared Calendar preview/primitives, `workspace-board-calendar-card-strip-panel.tsx`, particle types/source builder/controller/preview, both Workspace particle adapters, and focused acceptance coverage.
- Preserve: Batch 4 sizing and dense layout, the canvas Calendar's existing behavior and appearance, all other roadmap previews, source references, drag/add behavior, feature import boundaries, and current persistence format.
- Acceptance: Calendar visibly matches the canvas strip/event language; real events reach the preview; the catalog version contains no button, link, or event-details interaction; empty data remains legible; focused tests, formatting, lint, structure, thresholds, boundaries, React Grab, Workspace surfaces, raw buttons, and authenticated browser review pass. Full TypeScript may report only the documented unrelated duplicate-`vi` worktree blocker.
- Rollback: Batch 4 responsive bento state.

## Context dump 7: Batch 5 complete

- Extracted the established Calendar date-tile classes/content, event-row classes/content, and role accent mapping into `WorkspaceCalendarDateStripPreview`. The existing canvas `CalendarDateStripEventsPanel` keeps its buttons, navigation, selection, details sheet, and behavior while consuming those same visual primitives.
- Added the smallest runtime-only `ParticleCalendarEvent` shape. The Workspace adapter maps real `seed.calendar.upcomingEvents`; the particle source builder attaches them only to `board_calendar`; persisted particle placements remain reference-only.
- `ParticlePreview` now renders the shared read-only date strip for `board_calendar`. Other roadmap sections retain their existing roadmap preview. The catalog Calendar contains no button, link, form control, or event-details interaction inside its preview; the outer tile drag/add surface remains unchanged.
- Files changed for this batch: the new shared Calendar preview, the existing Calendar strip panel/data helper, particle types/source builder/hooks/controller/preview, both Workspace particle adapters, focused acceptance coverage, this plan, and the current monthly runlog.
- Authenticated localhost dark-desktop review showed Sep 18-22 with real `Reporting deadline` and `Key milestone` rows and admin invitations inside the 362x298 tile. At 390px the tile remained 160x298, its 150x252 preview had equal client/scroll dimensions, the document stayed 390px wide, and the preview had zero nested interactive elements. Search and the desktop viewport were restored; browser errors were empty.
- Prettier, scoped ESLint, 42 focused tests across three files, structure, thresholds, boundaries, React Grab ownership, Workspace surfaces, raw-button checks, and diff checks pass. A standalone TypeScript run passed immediately after implementation, then the concurrent unrelated duplicate `vi` import at lines 1 and 8 of `tests/acceptance/account-settings-profile.test.ts` reappeared and blocked the final combined run; that file was preserved. AST-only `graphify update .` completed with 19,919 nodes and 57,324 edges.
- Branch remains `chore/local-development-20260907` at `b476ada1` with no upstream. Work is local and uncommitted; no push, merge, deployment, provider/database mutation, or user-data write occurred. Durable recovery remains `f971843e`.

## Batch 6 execution plan

- Outcome: replace the Drive file-icon preview with the existing Documents thumbnail behavior backed by the authenticated Drive preview endpoint.
- Reuse contract: render `DocumentThumbnail` with the same minimal `LibraryItem` shape and `/api/integrations/google-drive/documents/[documentId]/preview` path produced by `documents-library-items.ts`; export and reuse its existing MIME-to-library-type resolver instead of duplicating that mapping.
- Security contract: add no client-provided organization identifiers and no new route. The existing route continues to resolve the active organization, constrain the external-document row by `documentId + orgId + provider`, require an available document and connected owner connection, and stream private bytes with `private` caching.
- UI contract: available supported files show the authenticated thumbnail; loading and unsupported responses retain the shared file-type fallback; trashed, inaccessible, and reconnect states use compact explicit copy and do not attempt a preview fetch. The tile header remains the file name and the preview stays top-aligned within its frame.
- Primary files: `documents-library-items.ts`, `particle-preview.tsx`, focused Particles acceptance coverage, this plan, and the current monthly runlog.
- Preserve: Drive attachment ID versus provider file ID separation, current source availability and drag behavior, the existing canvas large-preview behavior, Batch 4 sizing, and all server-side authentication/organization boundaries.
- Acceptance: browser confirms a real linked Drive thumbnail request succeeds through the authenticated endpoint; unavailable states remain legible; no new nested interaction appears; focused tests, formatting, lint, structure, thresholds, boundaries, React Grab, Workspace surfaces, raw buttons, TypeScript subject to the documented concurrent blocker, and diff checks pass.
- Rollback: Batch 5 shared Calendar state.

## Batch 6 recovery checkpoint: implementation verified, closure pending

- Implemented direct `DocumentThumbnail` reuse in `particle-preview.tsx`; `documents-library-items.ts` now exports its existing MIME resolver so Particles does not duplicate file-type logic.
- `buildDrivePreviewItem` uses the external-document attachment UUID in `/api/integrations/google-drive/documents/[documentId]/preview` and never the provider file ID. Optional `webViewLink` and `modifiedAt` metadata were added only to the runtime Drive source type; persistence remains reference-only.
- Available documents use the authenticated thumbnail and shared type-icon loading/error fallback. Trashed, inaccessible, and reconnect sources render compact explicit states and do not construct preview markup.
- Added focused coverage for attachment/provider ID separation, Documents type resolution, read-only preview markup, and reconnect behavior. Prettier, scoped ESLint, TypeScript, 84 focused Particles/Drive tests across five files, structure, thresholds, boundaries, React Grab, Workspace surfaces, and raw-button checks pass.
- Authenticated browser review found zero linked Drive documents in the current organization. The Drive empty state is correct, All was restored, and browser errors were empty. A live thumbnail canary remains unavailable without changing the user's Drive attachments; do not attach a file merely for verification.
- If interrupted here: run `git diff --check`, `graphify update .`, append the final Batch 6 context dump and monthly runlog entry, then begin Batch 7 only after writing its execution note. Do not redo Batches 0-6, touch `tests/acceptance/account-settings-profile.test.ts`, or commit/push without authorization.

## Context dump 8: Batch 6 complete

- The recovery checkpoint above remains the complete implementation/file map. Final diff checks and AST-only `graphify update .` also pass; Graphify now contains 19,921 nodes and 57,336 edges.
- Browser limitation is explicit, not hidden: the authenticated organization currently has zero linked Drive documents, so no real thumbnail request could be observed without changing user data. The existing Drive empty state was verified, All was restored, and browser errors were empty. Route tests plus shared-component tests cover the protected preview contract; a live canary remains for Batch 8 only if a document already exists then.
- Final Batch 6 validation: Prettier, scoped ESLint, TypeScript, 84 focused tests across five Particles/Drive files, structure, thresholds, boundaries, React Grab ownership, Workspace surfaces, raw buttons, and diff checks pass.
- Branch remains `chore/local-development-20260907` at `b476ada1` with no upstream. Work is local and uncommitted; no commit, push, merge, deployment, provider/database mutation, Drive attachment, or user-data write occurred. Durable recovery remains `f971843e`.
- Seamless next step: Batch 7 only. Read its existing scope at lines 255-265, append a Batch 7 execution note, expand the four existing `docs/agent/design-craft/` notes with the supplied source material, verify their AGENTS/UI-rubric links, then append Context dump 9 and the monthly runlog. Do not reopen Batch 6 unless an already-linked Drive document becomes available for a read-only canary.

## Batch 7 execution plan

- Outcome: make the four design-craft notes durable enough to preserve the supplied explanations, interactive demos, code examples, practical thresholds, examples, and further-reading links without weakening their short agent rules.
- Source contract: use the four cited Gustavo Fior Craft pages as the primary sources; paraphrase explanations, retain small implementation examples, link the interactive source demos and named resources, and keep author/date attribution. Clearly label source-derived guidance versus Coach House repository application.
- Files: `docs/agent/design-craft/README.md`, `image-outlines.md`, `optical-alignment.md`, `nested-border-radius.md`, `hover-restraint.md`, this plan, and the current monthly runlog. `AGENTS.md` and `docs/agent/ui-rubric.md` should remain link-only unless verification finds a broken pointer.
- Acceptance: each topic keeps concise rules first; all source demonstrations and resource links are represented; code examples are usable; repository-specific decisions are separated from source notes; all Markdown links resolve structurally; Prettier and diff checks pass.
- Rollback: Batch 6 complete state with the original short craft summaries.

## Context dump 9: Batch 7 complete

- Expanded all four `docs/agent/design-craft/` notes from brief summaries into durable references. Each now keeps agent rules first, preserves the source explanation and interactive demonstration, includes practical thresholds/examples and usable code where applicable, lists the named further-reading resources, and retains author/date attribution.
- Added explicitly labeled Coach House application guidance so source-derived ideas do not masquerade as repository requirements. The README now documents the two-layer rules/source-note structure and confirms that sources do not override AGENTS, accessibility, the UI rubric, or the design system.
- Primary sources were read directly in an isolated browser tab because the generic web fetcher could not access the Craft pages. The four source pages and their visible resource links were inspected; no forms, downloads, accounts, or external state were changed.
- `AGENTS.md` and `docs/agent/ui-rubric.md` still point to `docs/agent/design-craft/README.md`; no edits to either pointer were needed. Prettier, structural link-presence checks, and diff checks pass. This batch changes documentation only, so no product/browser regression suite or Graphify AST refresh was required.
- Branch remains `chore/local-development-20260907` at `b476ada1`. Work is local and uncommitted; no commit, push, merge, deployment, or external mutation occurred.
- Seamless next step: Batch 8 only. Append its execution note before any action, then verify the actual authenticated drawer in desktop dark/light, 390px, keyboard Enter, mouse/touch drag where safely automatable, Organization/Activity existing-card reveal, Calendar/roadmap add behavior, scroll fade, and persistence. Record any interaction that cannot be safely or reliably automated instead of overstating it. Finish with Context dump 10 and the monthly runlog.

## Batch 8 execution plan

- Outcome: perform final responsive, theme, accessibility, ownership, and interaction verification against the actual authenticated Workspace drawer, then leave it in its original review state.
- Read-only browser checks: desktop dark and light, 390px width, fixed tile proportions, Calendar footprint/content, Organization and Activity parity, Drive empty/preview state, horizontal overflow, independent catalog scroll/fade, semantic ownership, focusability, and browser errors.
- Interaction checks: inspect keyboard and drag contracts in the rendered DOM and run the focused behavior tests. Execute Enter/add/show or pointer/touch drop in the authenticated UI only when it can be proven not to persist or delete user data; otherwise record the exact unperformed canary and rely on the existing controller/acceptance coverage rather than mutate the board.
- Preserve: search cleared, All selected, desktop viewport restored, original theme restored, no new or removed particles, no card repositioning, no hidden-card changes, and no provider/database/user-data mutations.
- Acceptance: evidence distinguishes browser observation from automated test coverage and unperformed destructive/persistent canaries; final focused and guardrail checks pass; Context dump 10 and the monthly runlog provide a complete cross-chat resume/release handoff.
- Rollback: Batch 7 complete state and the browser state recorded at the end of Batch 6.

## Context dump 10: Batch 8 verification checkpoint

- Resumed on 2026-09-18 after the previous chat exhausted its limit. Continue the existing root branch `chore/local-development-20260907` at `b476ada1`, no upstream. Startup inventory: 187 modified files, 144 untracked entries, none staged. Preserve all overlapping/unrelated work. The separate preservation branch remains at `f971843e`; this session made no commit, push, merge, deployment, or product-code change.
- Localhost port 3000 belongs to this root checkout (PID 4179 when inspected). The previous chat owned its original browser tab; verification used a separate authenticated Bandto tab. Intermittent CDP inspection/input deadlines occurred, including actions completing after timeout. Later measurements succeeded. Do not infer a broken browser connection or a proven application performance defect from those timeouts.
- Browser verified dark desktop Organization/Activity previews against matching canvas content, 176×144 standard tiles, 362×298 Calendar, no document horizontal overflow (1792px), and zero nested buttons/links in preview controls. Source actions expose Enter-to-show/add labels. This is rendered-contract evidence, not an executed Enter/add canary.
- At 390×844, Calendar measured 160×298 and document width remained 390px. The existing Details rail initially covered the drawer after breakpoint changes; dismissing it and expanding the drawer exposed legible Calendar dates and real event rows. The collapsed drawer leaves very little catalog height on mobile; review this usability constraint with the user before changing its layout.
- Light desktop screenshot review verified standard tiles and Calendar event rows. Catalog scrolling kept the header/filter/search fixed; the end measurement was scrollTop 121 + clientHeight 639 = scrollHeight 760, with bottom mask size 0px. Drive showed its correct empty state with no linked files; no live authenticated-thumbnail canary was possible.
- Restored All, empty search, dark theme, normal drawer height, and default desktop viewport. Browser error log was empty. No particle add/remove/reposition, hidden-card change, provider attachment, or intentional board-data write was performed. Navigation reloaded existing content but does not prove a new write persisted.
- Fresh checks: all 84 tests in `workspace-particles`, `workspace-particle-images`, `workspace-board-card-frame`, `google-drive`, and `google-drive-routes` passed. Structure, thresholds, boundaries, React Grab, Workspace surfaces, raw buttons, and diff checks passed. This documentation-only continuation did not repeat TypeScript, full lint, visual baselines, Graphify, or `pnpm check:quality`; prior batch evidence remains historical, not a current release gate.
- Remaining explicit canaries: executed keyboard reveal/add, mouse/touch drop, hidden Organization/Activity reveal, new-placement persistence, read-only account interaction, and a real linked Drive thumbnail. They remain unperformed under the existing no-user-data-mutation scope. Use an isolated fixture or expressly scoped disposable board for persistent interaction testing; do not claim full Batch 8/release acceptance.
- Next chat: read this checkpoint and the monthly runlog, preserve the root worktree, and continue UI review with the user. Do not redo Batches 0–7 or touch the unrelated account-settings test. Before any new implementation batch, append its bounded execution note here; append verification and continuation evidence immediately afterward.

## Batch 9 execution plan: mobile catalog space

- User approved continuing the proposed mobile preview-space improvement. At 390×844 the normal 48% drawer leaves roughly 60px of catalog; render its normal position at 68% for Particles below 768px, preserving space above for canvas drops.
- Reuse the existing Vaul snap-point hook and canonical collapsed/default/full preferences. Translate only the rendered mobile Particles default position; store the existing 0.48 value so mobile changes do not alter desktop or other tabs. Preserve manually collapsed/full positions and tile sizes.
- Files: drawer component, its snap-point hook/state helpers, existing drawer acceptance test, this plan, monthly runlog. No new controls, data mutations, or unrelated fixes.
- Verify snap translation and round-trip behavior, mobile/desktop dimensions and other-tab behavior, focused tests, scoped lint/format, targeted guardrails, and AST-only Graphify update. Full release quality remains a separate gate.

## Context dump 11: Batch 9 mobile preview space

- Implemented a presentation-only mapping: mobile Particles renders the canonical 0.48 default snap at 0.68, while callbacks translate 0.68 back to 0.48 before saving. Collapsed/full values, desktop, and other tabs retain their existing positions. The hook remeasures Vaul when the presentation mapping changes. Reuses `useIsMobile` (<768px); adds no controls or board schema.
- Browser at 390×844: catalog viewport increased from approximately 60px to 216px; a full standard row is visible, canvas remains above, and document width is 390px. Switching to Organization restores `calc(48% - 2rem)`; returning to Particles uses 68%. Full-height reaches 100%, restore returns to normal. Desktop restored to 48%, 210px catalog, and 176×144px standard tiles at 1792px width. Browser errors empty; dark, All, empty search, normal height, and default viewport restored.
- Adapt and Design Guidelines informed the larger usable viewport while retaining established controls, tile proportions, and the neutral surfaces/spacing from `docs/design.md`. No preview redesign or header compaction was needed.
- Validation: combined drawer/Particles/card-frame run had 45 passes and one unrelated existing source-contract failure: `workspace-canvas-overlay-drawer.test.ts` expects `allowPeopleCanvasInteraction,` in untouched `workspace-canvas-surface-v2.tsx`. New mobile round-trip and viewport assertions passed. TypeScript reports only the known duplicate `vi` identifiers at lines 1 and 8 of untouched `account-settings-profile.test.ts`. Do not change those files' unrelated behavior to conceal these blockers.
- Scoped ESLint and eight guardrails pass: structure, thresholds, boundaries, workspace storage, interaction locks, React Grab, Workspace surfaces, raw buttons. Diff checks pass. Graphify AST refresh started after verification; record completion separately below. Full quality gate/visual baselines and real-device touch/persistent interaction checks remain outstanding; this is local UI review, not release approval.
- Continue from this batch on `chore/local-development-20260907` at `b476ada1`; no commit/push/deployment. Browser review tab was marked for handoff. Next: user review of the larger mobile opening, then isolated-fixture keyboard/drop/persistence coverage from Context dump 10. Preserve all unrelated root changes.

## Batch 10 execution plan: exact Calendar month-grid reuse

- User corrected the Calendar source: use the month grid from `RoadmapCalendarMonthAgendaPanel`, not the five-day canvas agenda. Keep the standard Calendar title and upper-right plus action.
- Ownership: Particles panel owns the catalog; `particle-tile.tsx` composes its Card/header/preview. `ui/card.tsx` assembles shared chrome. The supplied month-grid surface is assembled in the roadmap panel using `ui/calendar.tsx` and `RoadmapCalendarDayWithEventDots`; no portal is involved. Preserve shared theme tokens and original interactive Calendar behavior.
- Extract that exact Calendar grid into a shared component consumed by the existing panel and a read-only particle preview. Share day/event-dot markup; omit date/navigation actions in the preview. Keep the existing tile footprint and title/action shell initially; verify fit before changing sizing. No new agenda, Google controls, fetch, or calendar write.
- Files: roadmap month panel, shared month-grid/day components, particle preview, focused acceptance test, this plan/runlog. Verify rendered month/weekdays/date cells, no nested controls, existing panel contracts, desktop/mobile fit, scoped lint and guardrails; record any unrelated test blocker separately.

### Batch 10 user additions

- Remove the Particles footer hint entirely; retain the section's existing return-target behavior.
- Give Organization the same two-row/responsive two-column footprint and growing preview frame as Calendar. Preserve its established summary component and existing-card Show behavior.
- Fix scroll-edge fades at their shared owner. Diagnosis: `ScrollFadeEffect` adds variant-prefixed utility classes, but the managed-state selectors in `globals.css` require the literal `.scroll-fade-effect-y`/`-x` classes. Consequently JS edge states do not control the masks. Use the direct orientation-specific classes in the shared component; retain the existing hook and CSS mask tokens. Verify actual computed masks at top, middle, bottom, and no-overflow states.
- Expanded file scope: `particle-tile.tsx`, `workspace-particles-panel.tsx`, and shared `scroll-fade-effect.tsx`. This is the user's explicitly requested correction, not a new design batch.
- Browser fit review found the month dates cramped in the 160px mobile column. Both large tiles now span two fixed columns from 360px upward (330px combined on mobile), with a single-column fallback below that width. Desktop sizing remains 362×298. This follows the user's larger-preview intent without changing standard tile sizes.

## Context dump 12: Batch 10 user corrections complete locally

- Calendar now consumes `RoadmapCalendarMonthGrid`, extracted directly from the requested `RoadmapCalendarMonthAgendaPanel`. The original panel also consumes it and retains its full interactive header, event actions, personal-calendar modifiers, and agenda. Preview dates use shared `RoadmapCalendarDayWithEventDots` markup as noninteractive spans; navigation is omitted. Calendar title and the upper-right Add/Show action remain in the normal tile header. No five-day agenda remains in the particle preview. Existing source start dates produce neutral event dots; the limited particle source does not supply recurrence/type/personal-event details.
- Organization and Calendar both use the large footprint: 362×298 desktop, 330×298 at 390px, one-column fallback below 360px. Organization retains `WorkspaceOrganizationOverviewSummary`; no duplicate canvas card or new card action was introduced.
- Removed `footer-hint` markup only. The Particles section still owns the return target, so return-to-drawer behavior remains available.
- Fixed the shared fade selector mismatch by emitting literal `scroll-fade-effect-x`/`scroll-fade-effect-y` classes in `ScrollFadeEffect`. Its existing hook's managed-state attributes now match the CSS overrides and disable scroll-timeline animation. Browser measurements: top = hidden/visible, mask heights 0/32px; middle = visible/visible, 32/32px; bottom = visible/hidden, 32/0px; no overflow = hidden/hidden and `mask-image: none`. This corrects the earlier Batch 8 inference based on incomplete CSS-state evidence.
- Browser reviewed the actual month grid and enlarged Organization in dark/light, verified 390px month-grid fit with no horizontal overflow, and found zero nested preview buttons. Restored dark/default desktop, All, empty search, and normal drawer height. No intentional particle/board/provider mutation. UI preference changes were used only for review/restoration.
- Validation: 60 focused tests across Particles, roadmap month agenda, card frame, and particle images pass. Updated existing source assertions to follow the extracted grid. Scoped ESLint, formatting, structure, thresholds, boundaries, React Grab, Workspace surfaces, raw buttons, and diff checks pass. TypeScript still reports only duplicate `vi` imports in untouched `account-settings-profile.test.ts`; the separate pre-existing drawer assertion from Batch 9 remains unresolved. Full quality gate/visual baselines and persistent interaction canaries are not claimed.
- Graphify refresh completed for Batch 9 at 19,935 nodes/57,363 edges, then for the Calendar/fade changes at 19,940 nodes/57,374 edges. Both were AST-only, no model/API labeling; community-name refresh suggestions do not require paid work. Final CSS-class-only refinements do not add graph relationships.
- Current branch remains `chore/local-development-20260907` at `b476ada1`, no upstream; all changes are local/uncommitted. Do not push/merge/deploy. Next: continue user-led UI review from these four corrections, preserving all unrelated root changes. Persistent keyboard/drop/reveal/persistence checks still need an isolated fixture or expressly scoped disposable board.

## Batch 11 correction plan: complete source surfaces and natural proportions

- User rejected Batch 10's partial Calendar extraction and stretched compact Organization summary. The exact `month-grid` surface includes the date grid, Google Calendar controls, separator, and selected-day agenda/empty/loading states. Render it through the existing `RoadmapCalendar` data flow with only its outer month header hidden; do not substitute reduced particle event data.
- Organization must use the full `WorkspaceOrganizationOverviewSummary` and shared original card chrome at a natural source width, not the compact variant or percentage-height banner. Trace resolved the ambiguous pasted Card to `WorkspaceBoardNodeCardShell`; share its shell chrome across source and preview.
- Scale complete natural-size surfaces uniformly inside the existing large tile frame using one measured fit component. Keep the title/plus header. Put inert visual content beside the tile's drag overlay so original controls remain visible without nested actionable controls or mutation paths.
- Files: roadmap calendar/panel surface-only option, shared workspace card shell, existing canvas shell consumer, measured particle preview wrapper, Calendar/Organization previews, tile overlay, focused tests, plan/runlog. Preserve Batch 9 mobile opening, footer removal, fade fix, and all board/provider data. Verify complete content and proportions in the browser before claiming completion.
- User additionally requested deleting the entire Particles `header` surface. Remove its title, description, Add image control, and associated hidden input/ref; retain catalog filters/search and existing source actions. No uploaded images or stored data are deleted.

## Batch 12: bento correction execution plan

- User screenshot rejects center grips, identical large-tile proportions, holes, clipped Activity, and repeated borders. Use a modular dense grid rather than masonry: 128px base rows, Organization two rows/two columns, Calendar three rows/two columns, Activity one row/two columns. Keep bounded column widths and single-column narrow fallback.
- Put Organization and Calendar anchors first in both DOM and visual order; dense-pack remaining sources. Retain original relative order within other sources and unchanged source IDs/actions.
- Render all previews as inert siblings of an explicitly iconless drag overlay. Keep the named keyboard-accessible header action. Remove the extra preview outline/background and let source surfaces own their chrome.
- Verify current localhost process (PID 28327) belongs to this root. Files already lack the header despite stale browser content; reload before diagnosing more changes. No server restart, board mutation, commit, push, or deployment.
- Scope: panel grid/order, tile sizing/overlay, source handle explicit iconless mode, focused acceptance tests, this plan and monthly log. Verify browser dimensions/content/mobile/focus/fades; record any remaining checks honestly.
- User scope correction: desktop only for this pass. Restored desktop viewport and reverted newly introduced mobile-specific column/target overrides. Defer mobile review and design; shared component changes still apply at all widths.

## Context dump 13: desktop bento corrections

- Batch 11 uses the full `RoadmapCalendar` month-grid including Google controls/selected-day agenda, and full Organization summary with shared canvas chrome. Both retain undistorted source proportions. Refreshing root-owned localhost resolved stale header/grip content.
- Batch 12 desktop measurements: Organization 362×266, Calendar 362×404, Activity 362×128, standard tiles 176×128. Organization/Calendar lead the dense grid and DOM. Observed six-column composition packs without internal holes; different source counts can leave a partial final row.
- Explicit `showGrip={false}` suppresses the transparent overlay's fallback icon. All previews are inert siblings, not button descendants. Browser found zero grips/nested buttons. Named header actions remain; no persistent add/drop/Enter canary performed.
- Removed extra preview outlines/background. Shared ProgramCard gained opt-in compact list density; existing consumers retain defaults. Desktop screenshot confirms Activity title/location/one-line description fit. Requested header/footer remain absent.
- 61 focused tests, scoped lint, formatting, six targeted guardrails, and diff checks pass. TypeScript still reports only unrelated duplicate `vi` imports in account-settings-profile.test.ts. Full quality gate/visual baselines remain pending, not release-ready.
- AST graph reached 19,945 nodes/57,389 edges; final refresh started after ProgramCard/test changes. No paid semantic labeling. Mobile scope explicitly deferred; temporary viewport restored and new mobile-specific overrides reverted.
- Continue user-led desktop review here. Preserve branch `chore/local-development-20260907` at `b476ada1` and unrelated dirt. No commit/push/deploy/provider or board-data writes.

## Batch 13: bounded desktop interaction check

- Read-only browser verification: filtered tile dimensions, Tab focus on named header actions, and actual top/bottom/no-overflow fade states. Use fresh accessibility targets rather than guessed role selectors. Restore All/search/expanded state afterward; no Enter/add/drop/provider mutation.
- Fix only reproduced problems. Desktop only; no viewport changes. Final Batch 12 graph refresh completed at 19,945 nodes/57,390 edges, AST-only.

## Context dump 14: desktop interaction check passed

- Filtered Calendar remains 362×404; filtered Need remains 176×128. Neither stretches to fill the catalog.
- Actual Tab from search reaches each filtered tile's named header action, not the inert preview/overlay. Calendar action computed focus ring is 3px. No Enter/add/drop used.
- Normal-height All catalog: scrollTop 0 has start hidden/end visible, mask sizes 0/32px. Scrolling to exact bottom (407/407px) gives 32/0px. Filtered non-overflow states have mask-image none.
- No defects reproduced and no product edits needed. Zero browser action failures in this batch. Restored desktop expanded drawer, All, empty search. Mobile untouched. Next: user review or isolated persistent interaction/visual-baseline work; full quality gate remains unclaimed.

## Batch 14: in-memory controller regression checks

- Existing tests cover pure canvas move/reveal helpers and normalization. Add missing real controller-callback coverage for add then duplicate activation, explicit drop coordinates, existing-card reveal, and read-only/disabled rejection.
- Mount the hook through static React rendering, capture its callbacks and provide fake canvas/flow refs. Exercise synchronous commit/ref behavior only; do not claim mounted effects, browser sensor, or backend persistence coverage. No new fixture route or provider calls needed.
- Scope: existing Particles acceptance file plus plan/runlog. No product changes unless a test reproduces a defect.

## Context dump 15: controller regression batch complete

- Added six regressions in the existing acceptance file: immediate duplicate activation creates one placement and focuses it; explicit drop coordinates center correctly; Activity reveals its existing card without a particle commit; read-only and disabled modes reject add/remove/resize writes; view-only tiles render no drag buttons.
- Harness executes real controller callbacks with fake flow/canvas refs after static React rendering. This verifies synchronous guards/ref updates, not browser drag sensors, mounted effects, or backend persistence. Existing pure move/reveal tests remain.
- 67 tests pass across Particles, images, card frame, and roadmap month agenda. No product defect reproduced; no product files changed. Formatting/scoped lint checked; diff check passes. No browser/mobile/provider/board changes.
- AST refresh started in session 6424; poll its completion on continuation. Next bounded batch: isolated browser drag-sensor smoke test only if requested; do not confuse this callback coverage with end-to-end drag or persisted reload proof. Existing unrelated TypeScript blocker/full-quality limitations remain.

## Batch 15: user-directed header controls and Presentation preview

- Reduce desktop header controls to 24px targets/14px icons. Use a regular add/show button followed immediately by a dedicated drag grip. Remove full-preview drag overlays so grips have one clear location; preserve keyboard activation through add/show.
- Remove only the text preview of roadmap source `fundraising_presentation`, preserving its title, source document, tile identity and actions. No unrequested mobile changes or new tile sizing scheme.
- Owners: panel workspace:particles; tile header/frame assembly in particle-tile.tsx; drag behavior in particle-source-handle.tsx; text rendering in particle-preview.tsx; shared Button/Card primitives unchanged. No linked portal involved.

## Context dump 16: compact header controls

- Tile header now has ordinary named Add/Show button followed by a drag-only grip. Both measured 24×24px, with a 2px gap; icons 14px. Removed full-preview drag overlays. Grip clicks do not add; keyboard users retain the ordinary action. Shared handle default behavior remains unchanged for other consumers.
- Removed preview text only for `fundraising_presentation`; title/actions and source content remain intact. Blank preview area retains the existing grid footprint rather than inventing another layout during this narrow correction.
- Browser verified order/dimensions/text absence, then restored All/empty search at the user's normal desktop drawer height. No add/drop/provider/board mutation and no mobile work. Updated acceptance expectations for header order/no overlay and Presentation-only suppression. AST refresh started after edits.
- Next user review: broader proportions remain a design concern; this batch only resolves explicit button/grip/text changes. Do not claim all proportions approved or persistent drag tested.

## Batch 16: desktop Organization and Calendar proportions

- Plan: preserve current branch and all dirt; adjust only desktop catalog packing/tile footprints and restore Calendar month heading/navigation with the existing complete RoadmapCalendar surface. Keep uniform preview scaling, 24px actions and adjacent grips, and Presentation suppression.
- Initial evidence: fresh expanded 1784×952 desktop screenshot; Organization source 552×310 renders 352×198 inside a 352×218 frame. Calendar source 520×463 renders 352×314 inside a 352×356 frame, and `monthGridOnly` omits heading/navigation. Current localhost PID 28327 belongs to this root. Previous Graphify artifacts updated 14:53, 19,947 nodes; no refresh process remains.
- Checkpoint: branch `chore/local-development-20260907`, HEAD `b476ada1`, no upstream; 0 staged, 194 unstaged tracked files, 146 untracked entries. Antigravity and stakeholder checkpoint worktrees remain separate and untouched. No remote/release status refresh needed for this local-only batch.
- Owners: workspace:particles catalog grid, ParticleTile footprints, ParticleCalendarPreview composition. Shared Calendar and Organization primitives retain their existing implementations. Desktop finer rows allow content-fitting footprints and dense surrounding packing; full Calendar controls remain inert in the preview.
- Validation and continuation evidence to follow before user review. No mobile work, board/provider mutations, commits, pushes, or deployments.

## Context dump 17: desktop proportions ready for review

- Organization tile is now 362×248; its complete 352×197.94 preview fits a 352×200 frame, leaving approximately 2px below. Calendar is 548×584 with its full 520×533.48 surface at scale 1 inside a 538×536 frame. Month heading, navigation/add controls, Google Calendar controls, and selected-day agenda are visible.
- Desktop-only grid overrides use 8px rows/vertical gaps: standard tiles span 9 rows (136px), Organization 16 (248px), Calendar 37 (584px), with Calendar spanning 3 columns. Dense packing places Activity below Organization and smaller tiles beside/below Calendar. Existing uniform natural-preview scaling remains unchanged; filtered Calendar retains the same dimensions.
- Fresh browser evidence: 1784×952 dark desktop, expanded drawer, All selected, search empty. Live screenshots verified current rendering; no stale screenshots used. Calendar filtering/restoration used current AX targets. No add/show, drag/drop, Calendar control, or provider action was invoked.
- 35 Particles tests pass, including restored month-navigation assertions. Scoped ESLint/Prettier, six guardrails (structure, thresholds, boundaries, React Grab, Workspace surfaces, raw buttons), and diff check pass. Structure reports existing near-limit warnings.
- Limitations: this is a bounded desktop visual correction, not release validation. Full quality/visual baselines, other desktop widths/themes, persistent drag/reload, and mobile remain unverified. Calendar composition reuses shared controls; its restored content also renders at other widths, but sizing overrides are desktop-only. Prior unrelated TypeScript blocker was not rerun.
- Stop here for user review before further product changes. Current browser stays expanded to show the complete Calendar. Local/uncommitted only; all prior dirt preserved. AST refresh completion recorded below.
- Final AST-only `graphify update .` completed successfully: no code-graph topology changes, outputs intentionally left untouched. No model/API labeling. No refresh remains pending.

## Batch 17: reduce oversized Calendar after user review

- User rejected Batch 16 Calendar dominance and catalog proportions. Plan: return Calendar to two columns (matching Organization/Activity width), reduce desktop height from 584px to 408px, and retain complete controls/agenda with uniform scaling. Preserve fitted Organization and current panel width; dense grid repacks surrounding tiles.
- Ownership trace: semantic owner workspace:particles in WorkspaceParticlesPanel; tile span classes assembled in ParticleTile; panel root/grid classes assembled in WorkspaceParticlesPanel; shared Card owns base border/color chrome. No linked portal applies. Only the tile's desktop footprint needs changing; no shared Card edits.
- Fresh current desktop screenshot confirms oversized 3-column Calendar before edit. Desktop only; all existing changes preserved, no commits/pushes/deployments or board/provider mutations.

## Context dump 18: reduced Calendar ready for review

- Calendar reduced from 548×584 to 362×408, restoring two-column width alongside Organization and Activity. Complete month heading/navigation, Google controls, and agenda remain visible at uniform approximately 0.675 scale. Organization remains 362×248. Dense packing now restores the compact three-anchor desktop composition without changing panel width or shared Card chrome.
- Fresh expanded dark desktop screenshot/DOM geometry verified at 1784×952; All selected, empty search. User's React Grab inspection overlay remains active. No browser actions or persisted data changes in this batch.
- 35 Particles tests and scoped ESLint/Prettier/diff checks pass. Full quality/visual baselines, other widths/themes, and mobile remain unverified. No additional tests added for the one-class footprint correction.
- Stop for user visual review. AST-only Graphify refresh launched in session 48390; completion follows or must be checked next turn. No commits, pushes, deployments, board/provider writes; previous dirt preserved.

## Batch 18 / Context dump 19: Vision preview text removed

- Plan/ownership: user selected roadmap:vision preview frame; workspace:particles owns the tile, CardContent assembles shared frame chrome, and RoadmapPreview in particle-preview.tsx owns its text. No portal involved. Suppress Vision's text only; preserve its artwork if supplied, title/actions, sizing, and original document. Existing Presentation suppression remains.
- Evidence: current desktop DOM reports Vision tile text as only `Vision`. 35 Particles tests, scoped lint, formatting, and diff checks pass. No browser mutation, mobile work, commit/push/deploy, or board/provider write.
- Previous Calendar Graphify refresh completed successfully, no topology changes. Started a new AST-only refresh after this edit; check its completion next turn. Full quality/visual baselines remain pending. Continue user-led desktop review; other roadmap previews intentionally unchanged.

## Batch 19 / Context dump 20: remove bottom filler from Activity and text tiles

- Plan/cause: fixed desktop row footprints plus flex-growing preview frames forced empty bottom space. Fit Activity and text-only roadmap cards to natural height, then measure their grid spans so surrounding tiles repack. Preserve Calendar, Organization, image previews, shared chrome, and source documents.
- Ownership: workspace:particles is semantic owner; ParticleTile assembles height/span/frame classes; shared Card/CardContent owns base chrome; ActivityPreview/ProgramCard and RoadmapPreview own visible contents. No linked portal. Changed only ParticleTile, not shared primitives.
- Implementation: desktop h-auto/self-start and non-growing preview frame; ResizeObserver derives spans from natural card height using existing 8px rows/8px gaps. Text-only empty previews collapse naturally. No CSS changes below desktop breakpoint.
- Fresh 1784×952 desktop screenshot/DOM evidence: Activity 120px with 72px frame/content (previously 136px/88px); Mission 128px with 80px frame/content (previously 136px); Vision 48px with zero-height frame. Calendar/Organization retain 408px/248px. Content is no longer stretched; normal 8px internal padding/4px frame margin remains. Grid rounding can leave up to 15px outside a card, never inside it.
- 35 Particles tests and scoped ESLint/format/diff checks pass. Full quality, visual baselines, other themes/widths, mobile, and persistent interactions remain unverified. Expanded current desktop drawer for visual review; no add/show/drop or board/provider writes. Existing dirt preserved; no commit/push/deploy.
- Continue user-led visual review. Graph refresh status follows; previous Vision refresh session 19517 was still completing during this batch.
- React Grab/structure checks also pass (existing size warnings). Prior Vision AST refresh completed: 19,947 nodes/57,400 edges; community labels changed by hub fallback, no paid labeling. Started a fresh AST refresh after content-fitting edits; check completion next turn.

## Batch 20 / Context dump 21: Calendar grip double-click action

- Plan/ownership: remove only Calendar's separate action button selected by React Grab. workspace:particles owns tile assembly in ParticleTile; ParticleSourceHandle owns drag/click behavior; shared Button owns base chrome and remains unchanged. No linked portal. Other tiles keep existing add/show buttons.
- Calendar grip opts into double-click activation through the existing guarded add/reveal controller; ordinary pointer clicks do nothing. Enter/Space activate once, prevent drag-key/default activation conflict, and ignore key-repeat. Drag listeners remain; grip is focusable with explicit accessible/tooltip instructions. Existing handles retain their default behavior.
- Evidence: fresh browser AX shows one Calendar grip (`Drag Calendar to canvas, or double-click or press Enter to show`), tabIndex 0, no separate Calendar action. No live activation performed. Callback harness verifies two pointer clicks do nothing, double-click invokes once, and Enter followed by native click does not duplicate. 36 tests pass.
- Initial test assertion scanned the whole inert Calendar preview and incorrectly rejected its date-button tabindex=-1; scoped the assertion to the grip. Product behavior did not require a second fix. Scoped lint/format/diff checks run; full quality, visual baselines, actual browser double-click/drag persistence, and mobile remain unverified.
- Previous content-fitting Graphify refresh completed at 19,947 nodes/57,400 edges; new AST-only refresh started after this edit. Continue user review; no agent board/provider mutations, commits, pushes, or deployments. Local changes preserved.

## Batch 21 / Context dump 22: align tile title and controls

- Plan/cause: shared CardHeader has two rows and CardAction spans both; title center was 4px above the action. Override only desktop ParticleTile header to one row and its action to one centered row. Semantic owner workspace:particles; final overrides in ParticleTile; shared Card primitives unchanged; no linked portal.
- Fresh desktop DOM: Organization title/action centers both 419.56px after correction, versus 409.56/413.56px before. Header is now 36px. Existing tile content/sizing/actions retained; natural-height tiles remeasure automatically. No mobile edits.
- Scoped lint/format/diff checks pass; no new test for this small CSS correction. Full quality/visual baselines remain pending. Browser initially on Documents, so selected Particles via current AX target before measuring. No board/provider writes by agent.
- Continue user-led review. Local/uncommitted, previous dirt preserved; no commit/push/deploy. Graph refresh status follows.

## Batch 22 / Context dump 23: no roadmap text previews

- User clarified this applies to every roadmap tile, not only Vision/Presentation. Plan/owner: remove text rendering and unused text-extraction helper from RoadmapPreview in particle-preview.tsx; retain image previews, titles/actions, complete Calendar, Organization/Activity, and original documents. Shared CardContent and tile chrome unchanged; no linked portal.
- Fresh desktop DOM verified all 18 non-Calendar roadmap preview frames have empty text, including fundraising_strategy. No-image tiles collapse through existing natural-height layout. Image-only previews fill their existing frame without text filler.
- Updated existing preview assertions across five representative source IDs and image preservation. Scope remains catalog presentation only; source content and canvas document rendering unchanged. No mobile work or agent board/provider mutation; local/uncommitted, no push/deploy.
- Continue user-led desktop review; full quality/visual baselines and other viewport/theme checks remain pending. Prior grip Graphify refresh completed at 19,948 nodes/57,405 edges; header refresh session 91282 is running, followed by refresh for this batch.
- Validation: all 40 Particles tests, scoped ESLint/formatting, and diff checks pass.

## Batch 23 / Context dump 24: complete tile while dragging

- Plan/cause: WorkspaceParticlesProvider's body-portaled DragOverlay rendered a separate w-56 icon/title badge. Replace it with the full currently rendered source tile, preserving exact dimensions, artwork, Calendar surface, and pointer-to-grip offset. This changes the drag visual, not board placements or destination rendering.
- Ownership: workspace:particles semantic owner in WorkspaceParticlesPanel; handle/trigger assembled in ParticleTile/ParticleSourceHandle; portal assembled in particle-context.tsx, now linked through ParticleDragPreview's owner metadata. Shared Button/Card chrome unchanged.
- Added particle-drag-preview.tsx: capture a deep DOM clone at drag start; preserve rendered component content/inline scaling; set explicit dimensions and translate relative to the handle. Disable overlay scaling. The inert/aria-hidden clone has no copied React listeners and mounts no component/provider effects. Namespace cloned IDs and rewrite SVG paint/label references; remove duplicate React Grab metadata, with one linked overlay root. Cancel/end unmount the snapshot. Existing add/drop authorization and trailing-click guards unchanged.
- Validation: 41 Particles tests pass, including full-size/handle-offset snapshot regression, inert treatment and SVG/label reference preservation. Scoped ESLint/Prettier/diff checks, React Grab, structure, and boundaries pass; structure has existing near-limit warnings. DOM helper test uses element doubles; it is not live drag-sensor proof.
- Browser limitation: newly available Chrome skill was read; supported Node browser setup fails before connection with missing `openai-bundled/browser/26.911.61220/scripts/browser-service.mjs` dependency. No real drag/drop attempted, screenshot or live visual canary claimed. Desktop-only request; mobile untouched. Full quality/visual baselines remain pending.
- Prior all-roadmap-text AST refresh completed: 19,947 nodes/57,403 edges. New AST-only refresh started after this code; check completion on continuation. No model/API labeling, commits, pushes, deployments, or agent board/provider mutations. Next: cancel-only live drag check once browser tooling works; user review of full tile appearance.
- Full TypeScript reports only the existing duplicate `vi` imports at tests/acceptance/account-settings-profile.test.ts:1 and :8. No new TypeScript errors reported. AST session 99477 remains pending.

## Batch 24 / Context dump 25: remove filter-row separator

- Plan/owner: remove only border-b/border color from WorkspaceParticlesPanel's filter-row class assembly; no shared token or portal involved. Active-tab indicator and spacing retained.
- Scoped ESLint/format/diff checks pass. Browser verification remains blocked by the plugin dependency failure recorded in Context dump 24; no new test for this class-only edit. No mobile work, agent board/provider writes, commits/pushes/deployments. Continue user review. AST refresh queued after prior session 99477.

## Batch 25 / Context dump 26: drag performance and motion

- Plan: preserve desktop layout/full drag tile; reduce proven unnecessary drag/camera work and duplicate persistence, then add restrained lift, release/cancel, and placement feedback. Keep pointer motion immediate and honor reduced motion. No mobile redesign or live board/provider writes.
- Code evidence/baseline: WorkspaceParticleNode subscribed to full viewport changes through useViewport, even for unselected particles. Snapshot capture rewrote unchanged attributes (11 writes in the representative ID/SVG fixture). Both React Flow settled-position changes and drag-stop callbacks could commit the same normalized position twice.
- Changes: subscribe only to the selected toolbar's top/bottom threshold boolean via useStore; preserve regular dragging transforms. Snapshot capture now only writes changed references/IDs (6 writes for the same fixture, 45% fewer; this is operation count, not a browser FPS benchmark). Position guards compare normalized/clamped coordinates; both callback orders now persist once. Use a Map for settled-position lookup instead of repeated find scans.
- Motion: 100ms opacity lift, 140ms in-place accepted-drop fade, 180ms canceled return/fade, and 180ms new-node opacity/0.98-scale entrance. DragOverlay stays full-size and tracks pointer without transitions. Reduced motion disables these effects and camera reveal animation. No new animation library. Shared Workspace/Card/Button layout remains unchanged.
- Ownership: workspace:particles portal/provider owns release feedback, ParticleDragPreview owns lift, WorkspaceParticleNode owns node entrance/toolbar subscription, controller owns persistence deduplication. New focused particle-motion and particle-position-changes helpers avoid exceeding function-size limits. Initial lint identified controller >350 lines; extracted shared guard and replaced repeated searches, then lint passed.
- Validation: 43 Particles tests pass, including duplicate callback order/rounded coordinates, accepted vs canceled motion, reduced-motion skip, and unchanged-attribute write counts. Scoped lint/format/diff checks and structure/boundaries/storage/interaction guards pass. TypeScript had only existing duplicate vi errors; final post-extraction TypeScript/remaining guard output follows.
- Live limitation: retried supported Chrome setup after resetting its failed session; it still cannot load browser/26.911.61220/scripts/browser-service.mjs. No live FPS, smoothness, screenshot, or cancel-only drag proof claimed. Full quality/visual baselines and mobile remain unverified. Unit animation doubles are not browser rendering evidence.
- Prior separator AST refresh completed with no topology changes. Final AST-only refresh starts after this batch at lower process priority. Stop for user desktop review; next step is live before/after drag profiling when browser tools recover. Existing dirt preserved, local/uncommitted, no commit/push/deploy or agent board/provider mutation.
- Final checks: React Grab, Workspace surfaces, thresholds, and diff pass. TypeScript again reports only pre-existing duplicate `vi` imports in account-settings-profile.test.ts:1/:8. AST-only refresh session 94665 is running at reduced process priority; check completion next turn.

## Batch 26 / Context dump 27: restore the actual Activity card

- User correction: Activity must show the full shared card, not the compact list rendition. Owner is workspace:particles / ActivityPreview; pasted shell classes resolve to shared WorkspaceCardShell. No global Card primitive changes.
- Replaced ProgramCard list/compact with the same image-led medium variant used by WorkspaceBoardProgramsCard, inside WorkspaceCardShell (rounded 2rem, muted surface, p-3, h-auto). Preserved program image, title, description, chips, and funding progress. Open affordance is inert in the catalog. Removed minimum-height/flex-fill behavior; existing measured grid rows fit actual content without scaling or bottom filler. Retained two-column catalog width.
- Evidence: 43 Particles acceptance tests pass; strengthened existing render coverage for hero image, chips, progress, and absence of list Item. Formatting passes. Scoped lint/diff result recorded below. No new screenshot or live visual approval claimed: supported Chrome runtime remains blocked by missing browser/26.911.61220/scripts/browser-service.mjs dependency. Full quality/visual baselines not run.
- Prior Graphify refresh completed: 19,958 nodes / 57,436 edges. New AST-only refresh session 9362 started at reduced priority; check completion next turn.
- Continuation: show current desktop Activity card once browser tooling works; review proportions before further layout changes. Desktop-only; all existing dirt preserved, no commits/pushes/deployments or live board/provider mutations.
- Scoped ESLint and git diff whitespace checks pass.

## Batch 27 / Context dump 28: remove empty roadmap frame spacing

- Plan/cause: Communications and other non-image roadmap previews return null, but ParticleTile still mounted a CardContent with m-1, leaving a 4px bottom margin after its otherwise symmetric header. Prior h-auto correction did not remove this frame.
- Owner/fix: ParticleTile identifies empty non-Calendar roadmap previews and hides their entire frame at the desktop breakpoint. Header retains equal 6px top/bottom padding; populated artwork and Calendar frames remain. No shared primitive or mobile changes. Measured content rows continue fitting the resulting height; grid gutters are external to the card.
- Evidence/limits: source trace confirms the residual 4px margin. This is a narrow CSS correction; no new implementation-mirroring test. Scoped lint/format/diff checks run below. Browser plugin dependency remains broken; live pixel measurement and screenshot are not claimed. Full quality/visual baselines not run.
- Continuation: verify current desktop header-only tile visually before more layout edits. Graphify session 9362 remains running from previous batch; refresh sequentially after it finishes. Local only, dirty work preserved, no commits/pushes/deployments or board/provider writes.
- Scoped lint, formatting, and diff checks pass. Follow-up AST refresh queued behind PID 47431 to avoid concurrent Graphify work.

## Batch 28 / Context dump 29: one drag/add handle on every tile

- User correction/plan: earlier button removal was incorrectly limited to Calendar. Remove all separate plus/check actions from ParticleTile; every available editable tile uses its existing grip for double-click add/show and keyboard Enter/Space activation. Single clicks remain inert; dragging unchanged. No shared Button changes.
- Evidence: 43 Particles tests pass, including single-click suppression, exactly-once double-click and keyboard callbacks, and non-Calendar tile markup with exactly one accessible grip and no plus/check. Existing controller handles placed-source reveal. No live board writes were used for verification.
- Limits: browser runtime remains unavailable from missing plugin dependency; no live gesture or screenshot proof claimed. No mobile redesign or full quality/visual-baseline run. Local/uncommitted; preserved dirty worktree, no commits/pushes/deployments/provider changes.
- Previous Graphify refresh finished without topology changes. New AST-only refresh started after this change. Continue with current desktop interaction/visual review once tooling works.
- Scoped lint/format/diff checks pass. Graphify session 47132 pending; check completion on continuation.

## Batch 29 / Context dump 30: roadmap documents as file icons

- Plan: apply the user's file-icon request to the roadmap document tiles discussed in this thread. Keep title and single double-click/drag grip; render a centered shared FileText icon instead of document text or cover artwork. Calendar remains its dedicated surface. Source documents unchanged.
- Implementation: RoadmapPreview now renders only the 32px file icon in a 64px content surface. All non-Calendar roadmap tiles use measured content height, including sources with images; no stretched preview body or hidden empty frame. Drive thumbnails, Activity and Organization are outside this batch.
- Evidence: 43 Particles tests pass; roadmap coverage verifies icon output, no document text or image URL, and original source preservation. Formatting passes; scoped lint/diff checked. No current browser screenshot: known plugin dependency remains blocked. No live board/provider mutation, commit, push or deployment; existing dirt preserved. No mobile testing or full quality/visual baseline claim.
- Graphify: previous session 47132 is still finishing clustering/output after AST extraction; queue this batch refresh sequentially. Continue with user desktop review before further layout edits.
- Scoped lint/diff checks passed. Prior Graphify process finished; this batch AST refresh started afterward.

## Batch 30 / Context dump 31: canvas roadmap file-icon representation

- User clarified the target is WorkspaceParticleNode on the canvas, not only catalog tiles. Plan: render non-Calendar roadmap nodes as file icons and omit rich document previews.
- Changed effective display size through particleDisplaySize: existing saved mini/large roadmap placements render at 88x88 icon dimensions without rewriting stored placements, positions, or source documents. WorkspaceParticleNode omits content body and size toggles for these file nodes, retaining title, connections, open-document link and removal control. Roadmap icon uses FileText. New roadmap placements use icon dimensions for drop centering. Other source sizing and Calendar excluded.
- Validation: 44 Particles tests pass, including saved-size presentation mapping and other-kind/Calendar preservation. Scoped formatting/lint/diff checks run. Source document renderer remains available but is not mounted by icon nodes. No live board/provider writes for testing; existing saved board data is untouched by the agent.
- Limits: browser runtime dependency still blocks current screenshot and live React Flow handle/gesture verification. No mobile work/testing, full quality run, or baseline updates. Local changes only; no commit/push/deploy.
- Continuation: verify existing roadmap nodes visually at icon size and open-document affordance when browser works. Graphify prior session 94833 / PID 49313 still finishing; this batch refresh queued sequentially behind it.

## Batch 31 / Context dump 32: TOC-style roadmap file rows

- Plan/reference: inspected RoadmapEditorToc current source. Apply its quiet row treatment to desktop roadmap document ParticleTiles: borderless transparent surface, rounded-md, muted-to-foreground hover, subtle left rail, inline file icon, 13px medium title, 6px vertical padding, right-aligned existing grip.
- Owner/implementation: ParticleTile only; non-Calendar roadmap rows span two desktop grid columns for readable titles and fit their header content height. Hide separate desktop preview frame; inline FileText replaces the large centered icon on desktop. No completion/status indicators invented; file identity, grip double-click/keyboard and drag handlers retained. Calendar/Organization/Activity and canvas node appearance unchanged by this batch. Mobile-specific layout untouched.
- Evidence: 44 Particles tests, scoped ESLint/formatting and diff checks pass. No additional implementation-mirroring CSS test. Current screenshot remains blocked by supported browser plugin dependency; visual match is source-derived, not live measured. Full quality/visual baselines remain pending.
- Prior Graphify session 45796 / PID 49531 is extracting; this batch refresh queued sequentially behind it. Continue with desktop visual review before further changes. Local/uncommitted; existing dirt preserved, no commit/push/deploy or live board/provider mutation.

## Batch 32 / Context dump 33: reuse actual roadmap status indicators

- User correction: matching TOC styling includes status dot, completion check, and completed rail. Prior batch incorrectly omitted these. Replace inline file icon on desktop roadmap rows with actual roadmap status indicators.
- Shared implementation: extracted RoadmapTocStatusDot, RoadmapTocCompletionCheck and RoadmapTocCompletedRailSegment into components/roadmap/roadmap-status-indicators.tsx; both RoadmapEditorToc and ParticleTile now consume those components. Existing editor behavior/classes preserved; rail supports a class override for particle positioning. No action/check button reintroduced.
- Status: use resolveRoadmapSectionDerivedStatus, the same persisted-state resolver used by editor status handling. Complete shows emerald 8px dot, 14px check, foreground text and dark 2px rail; in-progress amber, not-started neutral. Canvas placement state does not determine completion. Editor-local unsaved drafts are not available to the particles source and are not synthesized.
- Evidence: 47 Particles tests pass, including complete/in-progress/not-started indicator checks and rail presence. Scoped source ESLint/formatting pass; boundaries/diff checked. Browser runtime remains blocked by plugin dependency, so no screenshot or pixel-match claim. Full quality/visual baselines pending.
- Prior Graphify refresh completed without topology changes. AST-only refresh session 96455 started after this shared extraction. Continue desktop comparison of actual status dots/checks/rail once browser works. No live board/provider writes, mobile redesign, commits/pushes/deployments; existing uncommitted changes preserved.
