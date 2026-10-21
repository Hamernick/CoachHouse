# Compact Organization, Activities and Fiscal Sponsorship Particles

Status: implemented locally; focused checks recorded in the monthly runlog. Visual approval remains pending.
Lane: `feat/particle-system-20261009`; preview: `localhost:3008/workspace`.

## Intended result

Make these three existing workspace tools follow the compact frame rhythm already used by other Particles. Their headers, body surfaces and footers should feel like the same component family. Remove the duplicate title/subtitle/Add row beneath their masonry previews. Keep their actual content, actions and placement behavior.

This is a spacing and presentation change, not a redesign of their underlying features. Do not change the full Organization editor, public activity cards, Fiscal application/workflow drawers, other workspace tools, document/media frames, persistence, or graph semantics.

## Source audit

Paths below the workspace-board directory refer to `src/app/(dashboard)/my-organization/_components/workspace-board/`.

| Surface | Current owner and cause | Planned treatment |
| --- | --- | --- |
| Reference Particle | `src/features/workspace-particles/components/particle-frame.tsx`: 2px horizontal/bottom rim, no top padding, 32px header, 12px body padding | Reuse this rhythm and existing WorkspaceNodeFrame anatomy |
| Organization | `workspace-board-organization-card-shell.tsx` delegates to `workspace-board-node-card-shell.tsx`: 12px shell padding plus 12px inner surface margin; `workspace-board-card-header.tsx` uses an 18px title and separate gutters | Apply compact chrome only to the requested workspace tool; remove cumulative shell/body margins |
| Organization content | `workspace-board-node-static-cards.tsx`, OrganizationOverviewCard: 12px section gaps and a 12px summary divider gutter | Reduce redundant section spacing while preserving identity, description and summary data |
| Activities | `workspace-board-node-card-programs-renderer.tsx`: 2px sides but 12px top/bottom shell padding; separate padded footer | Remove the large top/bottom shell gutters; retain carousel and real actions |
| Activity body | `workspace-board-programs-card.tsx` renders `src/components/programs/program-card.tsx`: 16px horizontal content padding, 12px gaps, 16px bottom gutters | Add/reuse a narrowly scoped workspace presentation option rather than changing public ProgramCard defaults |
| Fiscal Sponsorship | `src/features/fiscal-sponsorship/components/fiscal-sponsorship-workspace-card-surface.tsx`: 12px shell padding, 16px header sides, 12px inner margin, 16px footer top padding; title 18–20px | Compact this workspace surface. Preserve source selection, readiness, workflow rows, Handbook and application action |
| Library row | `src/features/workspace-particles/components/particle-library-tile.tsx`: available tool masonry row `flex items-start justify-between gap-2 px-2 pt-2.5` | Remove the row for all three tools; move Add into the existing corner-overlay pattern first |
| Shared previews | `workspace-canvas-v2/components/workspace-tool-library.tsx` already renders WorkspaceBoardCard for library previews | Keep one renderer for library, lifted drag preview and canvas |

The generic Card primitive does not add a root gap, so avoid a global Card fix. The padding is owned by these workspace shells and their nested content.

## Exact layout baseline

All values are CSS/canvas pixels, not viewport-zoom-dependent measurements.

| Part | Target |
| --- | --- |
| Outer frame | 28px radius, existing semantic surface/border tokens, no new shadow; 2px left/right/bottom rim, 0px top padding; shell gap 0 |
| Header | 32px resting height; single vertically centered row; 10px horizontal inset; 8px icon/title gap; no divider or new subtitle |
| Header typography | 14px semibold title, 20px line height; truncate long titles without displacing actions |
| Header icon | 20px container, 16px glyph where applicable; preserve the Fiscal mark's aspect ratio and meaning |
| Body surface | Near-full-width surface inside the 2px rim; no additional 12px external margin; inner radius 25px |
| Readable content | 12px primary content padding; 8px section/row gaps where appropriate; do not accumulate wrapper and child padding |
| Footer | Only render when it contains a real action/control; 12px horizontal and 8px vertical padding, 8px action gap; remove extra shell-bottom gutter |
| Controls | Use existing small button styles; target 28–32px desktop visuals where appropriate; preserve at least 44px touch targets through existing coarse-pointer treatment |
| Height and width | Content-driven height; preserve current supported width/size policy; no forced uniform height or new minimum-height spacer |

Meaningful content dividers may remain. The rejected decorative header divider does not return. Images retain their existing aspect ratios. Footer controls may wrap when necessary rather than clip.

## Implementation sequence

### 1. Establish one compact workspace treatment

- Reuse WorkspaceNodeFrame pieces and the existing Particle frame values. Extract a small shared chrome token/helper only if needed to prevent three independent copies of the same values.
- Add a scoped compact treatment to the existing board shell/header, selected explicitly by Organization and Activities. Keep other callers unchanged.
- Use the same treatment in FiscalSponsorshipWorkspaceCardSurface. Do not redirect or rewrite application state/controllers.
- Keep React Grab ownership markers and existing title, body, footer boundaries.

Checkpoint: show the three compact shells together before polishing nested content.

### 2. Remove cumulative internal spacing

- Organization: remove shell-plus-body-margin accumulation; align the header with the shared inset; tighten overview section gaps to 8px. Preserve its summary divider and all displayed fields. Do not invent a footer for this card.
- Activities: remove 12px top/bottom shell padding; make the nested preview reach the 2px frame rim. Scope ProgramCard body/footer spacing to its workspace use. Preserve banners, chips, progress, Open action and carousel controls. Render the carousel footer only when needed; remove empty footer space.
- Fiscal Sponsorship: remove outer body margin, normalize the title/icon and header row, and compact footer spacing. Keep the existing Model C information compact and on one row where it fits. Reduce repeated section/row gutters without altering readiness calculations or removing workflow content.
- Use card/container behavior for narrow layouts; avoid relying on browser-width breakpoints for card internals where the canvas card remains narrow on a large screen.

Checkpoint: inspect empty and populated cards, including a long organization name, multiple activities and fiscal workflow rows.

### 3. Remove the duplicate masonry row safely

- Enable the existing top-right ParticleAddControl overlay for these tool previews, retaining the original onPlace callback and accessibility label.
- Remove only the available-tool masonry metadata/action row identified in the request. Title appears once, in the actual card header; no external subtitle underneath.
- Preserve list/icon-view labels and placement controls.
- Preserve the dashed On canvas placeholders at the bottom of the library and their Remove action. They are a different state from the row being deleted.
- Keep the preview itself inert for normal interaction; neither clicking it nor adding the tool should accidentally open an editor.
- Keep the lifted drag preview identical to the source card. These single-instance tools do not acquire reusable-preset stacks.

Checkpoint: review the Particles masonry view with all three tools available, then with each placed.

### 4. Preserve canvas behavior and motion

- Retain header drag handles and nodrag/nopan classes on buttons, fields and menus.
- Keep connection handles outside clipped surfaces. Let the existing measurement/internals path update after content height changes; do not auto-layout, move saved positions, or change edge semantics.
- Preserve existing selection/action overlays and touch/keyboard access. Keyboard focus remains visible only through the established focus-visible treatment.
- Keep current Motion drag/drop handoff. Do not animate width/height or add React state updates per animation frame for this spacing change. Respect reduced motion.
- Make no database migrations, new stores, record copies, uploads or placement/history changes.

### 5. Validate and report

Run focused existing Particle UI/library, workspace frame, Organization/Activities and Fiscal workspace-card acceptance tests; scoped TypeScript and ESLint; relevant React Grab, workspace-surface and structure guards. Adjust existing source-contract expectations only where intentional chrome changes require it. Add behavior coverage only for a missing Add/remove or preview-inertness guarantee, not padding-mirroring tests.

Refresh Graphify after implementation. Record actual results and changed files in the monthly runlog. Browser and final visual approval remain user-owned in this lane; do not claim source checks establish visual fidelity or measured 60fps.

## Acceptance criteria

- All three tools use compact, aligned headers and the same thin outer rim as ordinary Particles.
- Inner surfaces reach nearly edge to edge; readable content retains deliberate padding.
- No large top/bottom shell gutters, padded empty footers or duplicate preview titles/subtitles remain.
- Add remains accessible in the top-right overlay; placement and return-to-library still work.
- Masonry, list and icon modes remain usable; placed dashed placeholders are preserved.
- Library, drag overlay and canvas share the same renderer and visual geometry.
- Content-driven height, supported widths, manual positions, connections, drag and selection remain functional.
- Light/dark themes, long titles, narrow cards and touch targets remain readable and usable.
- Full editors, public cards and unrelated tools retain their existing presentation.

## Delivery boundaries

Implemented in reviewable stages: shared chrome, nested content, library cleanup, focused verification. Checkpoints were reported during implementation. The Fiscal Model C badge moved into the body summary to keep the compact header clear of the library Add overlay. No commit or deployment is included.
