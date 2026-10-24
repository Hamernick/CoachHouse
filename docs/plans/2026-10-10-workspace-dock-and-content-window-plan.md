# Workspace dock and responsive content window — implementation plan

Date: 2026-10-10  
Status: user accepted motion for now; slice 5 draft/media hardening implemented; 84 focused tests and scoped checks pass; targeted user interaction review pending  
Lane: `feat/particle-system-20261009`  
Worktree: `/Users/calebhamernick/Development/coach-house-platform-particle-system-20261009`  
Preview: `http://localhost:3008/workspace`

## 1. Intended result and terminology

The **workspace dock** is the compact, persistent navigation and composer surface near the bottom of the canvas. The **content window** is the wider, rounded surface that opens above it on sufficiently large canvases. On smaller canvases, the same content uses the existing **drawer** interaction. A **Particle inspector** is a content mode within that system, not a second competing window.

The dock and content window share navigation/selection state, but they do not share a width constraint. One active content window is supported in this iteration. The canvas remains mounted and interactive outside these surfaces.

User requirements carried forward:

- Remove the obsolete outer outline/frame shown in the latest screenshot.
- Keep the dock detached from the canvas bottom, with rounded corners and no drop shadow.
- Compact, content-sized tab labels; no clipped words, forced equal widths, or excessive gaps.
- Restore a functional Particles destination.
- On large screens, open the active tab in its own wider rounded container.
- Put close, minimize, and maximize/restore controls at the upper left, with a title.
- Animate opening/closing and size changes with a coherent relationship to the dock.
- Preserve accessible keyboard focus, readable states, touch targets, and reduced motion.
- Deliver this in bounded stages and stop for product review at meaningful checkpoints.

This plan supplements the Particle System PRD and supersedes the flush-bottom sheet geometry in the supplied Apple Maps reference. Existing instructions to preserve data, authorization, workspace features, and collaboration still apply.

## 2. What the audit confirms—and what it does not

### Confirmed in this worktree

| Area | Current ownership / behavior | Consequence |
| --- | --- | --- |
| Shell | `workspace-canvas-overlay-drawer.tsx` combines Vaul, saved detents, navigation requests, content, inspector and composer | Extract cohesive presentation responsibilities before adding desktop behavior; do not continue enlarging this component |
| Visible dock | An inner rounded panel sits inside a tall transparent `DrawerContent` | Host geometry and visible chrome must be audited separately |
| Focus | Expand control now sits in the tab row; its own pointer/keyboard ring treatment is scoped | The screenshot's remaining outer rectangle must not be treated as proof that this button still owns it |
| Tabs and panels | `workspace-canvas-overlay-drawer-tabs-view.tsx` renders both navigation and all active panels | Separation must preserve tab context, panel identity and panel-specific behavior |
| Tab indicator | Existing hook measures visible trigger bounds, clips the underline to the scroll viewport, and reveals active tabs on change/resize | Reuse this behavior; verify actual label widths and flex rules |
| Routes/preferences | `src/lib/workspace/routes.ts` owns tab identifiers; scoped board preferences normalize through that contract | Particles must enter the canonical contract, not a local string cast |
| Accelerator | Its panel receives a local lesson-slot element for portal content | Moving a panel can invalidate its portal target; test this explicitly |
| Particle data | `useParticleFlow` / `useParticleSession` own the current graph adapter, selection, mutation and retry behavior | The restored library must consume these, not introduce another store |
| Dirty edits | Particle selection currently uses a dirty ref and a confirmation, and returns `void` when canceled | Window transitions need an explicit accepted/canceled result before changing visible state |
| Composer | Focus currently requests the full Vaul detent; Escape restores the previous detent | Desktop must stop treating composer focus as a request to maximize the content window |
| Motion | Both `framer-motion` and `motion` are installed; existing workspace components use `framer-motion` | Reuse the established import and reduced-motion conventions; install nothing |
| Older library | Preserved commit `8eabd28e` has a Particles source library with its own context, source references, Drive picker and uploads | Review useful UI and contracts, but do not copy that context/persistence wholesale |

### Still to establish in the first slice

The screenshot shows a taller, older-shaped outline around the rounded visible dock. Possible owners include the transparent Vaul host, host focus styling, remaining border/chrome, or a development inspection overlay. The source audit alone does **not** establish which rendered rule creates it.

Record the exact element, focused element, border/outline/box-shadow/pseudo-element rules, bounding rectangle, and interaction that makes it appear. Fix the actual owner. Do not globally remove focus styles or keep layering speculative `outline-none` overrides.

Browser access was previously explicitly denied. Do not bypass that with another browser, Playwright, CDP, or HTTP inspection. Use the user's screenshots/manual checks until access is explicitly reauthorized. This limitation must remain visible in checkpoint reports.

## 3. Scope boundaries

### Included in this delivery

1. Correct dock frame, focus ownership, spacing and tab sizing.
2. One responsive content presenter serving existing tab panels and the Particle inspector.
3. Desktop content window with functional close/minimize/maximize/restore controls.
4. Mobile/narrow-canvas drawer behavior using the installed Vaul primitive.
5. Restored Particles navigation, usable library, creation/open actions and honest empty/error/read-only states.
6. Window/drawer state transitions, draft safeguards, focus restoration and responsive resizing.
7. Purposeful motion and focused regression/manual checks.

### Separate follow-up work

- Multiple simultaneous windows, z-order management, tiling or a desktop operating-system imitation.
- User-dragged window positions and arbitrary resize handles. This first version resizes to available space and provides maximize/restore; add manual movement only after reviewing this simpler model.
- React Flow v12 migration, ELK execution/layout UI, connection editing, graph undo/redo, sharing, AI generation, or full eight-type editing completion.
- New database tables, schema changes, new collaboration sources of truth, or new motion/window libraries.
- Activating the currently gated Finance destination.
- Restoring historical Drive/image integrations by appearance alone. Their authorization, storage and source-reference contracts need a separate compatibility review.

These exclusions bound this presentation feature. They do not remove requirements from the overall Particle System roadmap.

## 4. Surface and layout contract

### Dock

- Retain the current 16px bottom clearance; measure from the canvas boundary to the visible panel, not to an invisible translated host.
- Retain narrow-canvas side gutters of at least 12px.
- Keep the reviewed moderate width direction: roughly 460–520px where the canvas permits, capped by available width. Do not reopen the 440/560px guessing cycle without comparing the actual tab row.
- One outer rounded border, approximately 28px radius. No drop shadow and no second visible rectangular host.
- Grabber, navigation and composer each have explicit spacing tokens. Initial desktop targets: 24px grabber row, 32px navigation, 6–8px separation before the composer, 10–12px outer horizontal gutters. Refine these together, not through unrelated negative margins.
- Measure actual composer height and responsive chrome. Long input/error text must not clip the send control or change the bottom gap.
- Pointer targets may stay compact; coarse-pointer controls remain at least 44px. Do not shrink touch targets to reproduce desktop density.
- The dock remains visible and usable while the desktop window is open or maximized.

### Navigation

Initial visible order preserves the current destinations and adds the restored library: **Organization, People, Documents, Particles, Tools, Accelerator**. Finance remains gated; Roadmap remains reachable through existing routed requests.

- Labels retain their full text and readable type size.
- Triggers use intrinsic width (`flex: none` / no grow). The list may consume the available row width without distributing spare space among triggers.
- Start with 6–8px horizontal label padding and a 2–4px inter-tab gap. Do not increase spacing simply because a media query is wide.
- Reserve a real flex item for the expand control; no absolute positioning across another row.
- If all labels do not fit, scroll the navigation row horizontally. Never truncate or shrink every label to force all six into one small screen.
- Keep the active/focused tab visible for keyboard navigation and programmatic requests. Preserve semantic tab behavior and a single selected indicator.
- Selected-tab styling is persistent selection feedback. A focus outline is separate and visible for keyboard focus; do not remove the selected state while fixing focus.
- No duplicate tab strip inside the desktop window. The window title identifies its content.

### Desktop content window

Use the **available canvas rectangle**, not a viewport breakpoint alone. Initial eligibility target: canvas width at least 900px **and** enough height to show a useful content area above the dock (initial minimum content height 320px). Validate the threshold with the actual shell/sidebar and browser zoom before finalizing it.

Initial geometry:

- Normal width: `min(920px, canvasWidth - 48px)`; this is intentionally wider than the dock.
- Top clearance: at least 16px from the canvas top.
- Bottom clearance: at least 16px above the dock's visible top, including multiline composer growth.
- Maximum usable height: `canvasHeight - dockVisibleHeight - dockBottomGap - windowDockGap - topGap`.
- Normal height targets roughly 65–70% of available canvas height, bounded by that usable region. A short panel need not create a large blank surface.
- Maximized mode fills the usable region with 16px side/top clearances and the dock gap retained. It does not enter browser fullscreen or cover global navigation.
- Rounded, theme-aware border; no shadow. Header stays fixed while content scrolls.
- No full-canvas hit-testing overlay. Canvas outside the window remains interactive.
- Recompute/clamp on shell resize, sidebar changes, zoom and orientation changes. If usable height is insufficient, use drawer presentation rather than an unusable miniature desktop window.

These are initial implementation values, not an approved final visual. Checkpoint 3 is where the user reviews the geometry.

### Narrow canvas / mobile

- Present the same active content through Vaul, keeping the compact dock relationship and current snap interaction.
- Preserve persistent collapsed, half and expanded behavior, adapting to usable height.
- One composer and one content instance; do not render a hidden desktop copy.
- Content scrolls inside its own viewport. Handle gestures resize the drawer; fields, lists and the canvas retain their own interactions.
- Account for mobile keyboard/visual viewport and safe-area changes once, without double bottom padding or offset.
- Browser mode changes must preserve the current destination, selected record and accepted draft state; no canvas remount or viewport reset.

## 5. State ownership and transitions

Use one controller in the existing workspace presentation boundary. Domain records remain in their current owners. The controller models three independent concerns:

1. **Destination:** existing module tab or Particle inspector record.
2. **Visibility:** closed, minimized, or open.
3. **Presentation:** responsive drawer or desktop window; desktop normal/maximized or mobile detent.

Presentation derives from measured available space. Avoid independently writable `open`, `expanded`, `fullscreen`, `windowOpen` and `drawerOpen` flags that can disagree. A small discriminated state/reducer or equivalent typed transition functions are sufficient; no new global store.

| Event | Required outcome |
| --- | --- |
| Click another tab | Run any required draft guard; on acceptance select that destination and show it in the appropriate surface |
| Click the selected tab while minimized/closed | Restore/open its content |
| Click the selected tab while already open | Keep it open; do not unexpectedly toggle or reset it |
| Close | Guard dirty work, end the active inspector/session where appropriate, hide content, return focus to the originating dock control; never delete records |
| Minimize | Hide the content surface but retain the active destination, draft, selection and scroll for restore; no discard prompt merely to minimize |
| Maximize | Save normal presentation bounds and use the available canvas region; preserve content state |
| Restore | Return to the normal window bounds, clamped to the current canvas |
| Select a Particle | Open that inspector in the current responsive presenter; keep the canvas selection and graph data authoritative |
| Request Documents/Accelerator/Roadmap through existing links | Resolve through existing request contracts and open the corresponding content without dropping focus keys or lesson/section identifiers |
| Click the canvas outside content | Keep the nonmodal surface open unless an explicit action changes it; allow canvas pan/selection |
| Press Escape | Close a nested menu/dialog first; otherwise minimize the active content surface and restore focus, preserving drafts |
| Focus composer on desktop | Focus the composer; do not maximize an unrelated window |
| Resize across presentation threshold | Preserve destination/draft/scroll/selection and adapt the shell; do not write domain changes |
| Organization/workspace scope changes | Use the existing navigation/dirty safeguards, then reset transient presentation references; do not reuse another organization's selection |

Close and minimize must have distinct semantics. A canceled dirty guard must cancel **all** associated changes: tab, selection, visibility, animation and focus. Saving already in progress must finish under its existing request identity; closing must not silently retry or cancel a server mutation.

Persist only preferences already supported by the scoped preference layer, plus a narrowly justified normal/maximized preference if needed. Do not persist transient DOM rectangles, animation frames, pointer modality or local draft state into the graph. Existing preference values must normalize safely; adding `particles` must preserve older values.

## 6. Component boundaries and reuse

### Reuse

- Existing canvas container/request context and route-owned server loading.
- Existing tab panels, organization/document authorization, People placement actions, Accelerator portal logic and current Particle session.
- Existing shadcn Button/Toggle/Tabs/Drawer primitives, focus tokens, theme provider and React Grab metadata helpers.
- Existing `framer-motion` usage conventions and reduced-motion detection.
- Existing workspace routes and scoped UI preference normalizers.

### Decompose only along these boundaries

| Responsibility | Proposed owner | Constraint |
| --- | --- | --- |
| Presentation state/transitions | Small `workspace-content-surface-state.ts` and controller hook beside current route-private composition | No data mutations inside geometry or animation functions |
| Compact dock | Existing dock/header/composer modules, with navigation extracted if necessary | Own only navigation/composer chrome; no duplicated module bodies |
| Content dispatch | Extract the panel/body portion of `workspace-canvas-overlay-drawer-tabs-view.tsx` | Preserve canonical tab context and existing panel props |
| Responsive shell | One `workspace-content-surface.tsx` | Select window/drawer presentation; do not clone the panel subtree |
| Window header | Small `workspace-content-window-header.tsx` | Title plus three real accessible actions; no domain fetching |
| Geometry | Focused pure helpers near the shell | Measured canvas bounds and dock height; no ad hoc canvas pan/zoom |
| Particle library | `src/features/workspace-particles/components/particle-library.tsx`, public client export | Consume the current session and typed registry through props/contracts |
| Route adaptation | Existing `workspace-particle-dock-content.tsx` and surface composition | Bridge feature outputs to the workspace presenter |
| Styling | Existing scoped `workspace-dock.module.css`, optionally a surface-specific stylesheet if the responsibility becomes distinct | Avoid global primitive overrides |

Do not create every proposed file automatically. Combine closely related state/geometry helpers when that stays cohesive. Keep the present composition under repository size limits through useful extraction, not formatting tricks or a proliferation of one-line helpers.

### Content mounting decision gate

Before implementing the full desktop shell, prove that the chosen mounting approach preserves a Particle draft, an Organization form, a document preview, an Accelerator lesson portal and panel scroll through minimize/restore and responsive mode changes.

Prefer a stable content mount and stable portal target with responsive shell geometry. React context surviving a portal does **not** prove component state survives changing its portal container or parent tree. Do not introduce conditional duplicate `TabsContent` trees for desktop/mobile.

If the existing primitive combination cannot retain a stable mount, use a narrowly scoped draft/scroll handoff for the affected panels and test it before proceeding. Do not serialize arbitrary React state, invent a general window manager, or silently accept lost input. Record the selected approach and rejected alternative at checkpoint 2.

## 7. Particles restoration contract

The current graph feature and the old source library are different contracts. Restoring the tab must be explicit about what is functional.

### Required in this delivery

- Add `particles` to the canonical route/tab normalizer and preference allowlist through their shared contract.
- Provide a real Particles panel using current graph records: searchable title/type list, status, count, empty state, error/retry and read-only states.
- Opening an existing Particle selects the same canvas record and shows its inspector. No copy of that record is created in the library.
- Preserve current Objective/Activity/Workflow creation actions and their authorized saves. Creation appears in the library as well as existing entry points without duplicating action logic.
- Display existing records of all eight supported types, even where specialized editing is still incomplete. Do not advertise an unimplemented editor or provider action.
- A new Particle follows the existing creation/selection flow and appears immediately after the accepted save. Failed creation must leave a useful error and retry path, not a decorative tile.
- Reopening/minimizing the library retains its search and scroll within the active workspace session.

### Historical functionality compatibility audit

Read the preserved `workspace-particles-panel.tsx`, source handles, source reference contracts and image/Drive authorization boundaries at `8eabd28e`. List which capabilities can be adapted safely to this graph model and which remain part of the broader image/form/integration work. Do not cherry-pick the old context, table assumptions or board writer into this lane.

If the user means exact restoration of the older linked-resource library, surface the specific remaining source-adapter work at checkpoint 2. Do not call a type picker a full restoration of that historical library.

## 8. Window header and accessibility

- Upper-left controls follow familiar close, minimize and maximize/restore ordering, each using real buttons with accessible names and tooltips.
- Use compact restrained circles with clear icons; do not rely on red/yellow/green alone. Do not add large status banners or imitate nonfunctional operating-system controls.
- Center the title within a layout that reserves equal left/right space where feasible; allow wrapping/truncation only for long content titles, with an accessible full name. Tab labels themselves remain untruncated.
- Desktop controls have usable pointer hit areas; coarse-pointer controls are at least 44px.
- Nonmodal window: no blanket focus trap and no inert canvas. Nested true dialogs keep their existing modal semantics.
- Avoid automatic focus theft on routine layout changes. Explicit keyboard opening moves focus predictably into the title/content or first meaningful action; pointer tab changes can retain tab focus.
- Close/minimize restores focus to the initiating tab/control. If the trigger is no longer mounted, use a known dock fallback.
- Inactive/minimized content is noninteractive and removed from keyboard navigation/accessibility exposure while retaining the required state.
- Visible keyboard focus follows the actual element bounds and works in forced colors. Do not suppress focus globally or blur controls merely to hide outlines.
- Nested Escape handling, Tab traversal, IME input and screen-reader titles are acceptance items, not cosmetic polish at the end.

## 9. Motion contract

Implement motion only after static geometry and state transitions work.

- Dock stays anchored. Window opens from a measured origin near the selected dock tab/expand control, grows into its content bounds, and settles without overshoot.
- Use opacity plus small transform/scale for the shell; do not scale form text from a tiny unreadable rectangle for the whole transition. A short content fade can separate shell geometry from readable content.
- Closing/minimizing reverses the spatial relationship toward the dock. Normal/maximized changes animate the existing shell rather than remounting its contents.
- Initial targets: opening 220–280ms, closing/minimizing 160–220ms, maximize/restore 200–260ms. These are adjustable design targets, not measured performance claims.
- Prefer the already installed Motion layout/animation facilities. Use one engine for a given transform. Vaul owns mobile drag/snap transforms; Motion must not animate the same transform concurrently.
- Rapid repeated input interrupts or retargets animation. No accumulated animation queue, delayed stale destination, or visible duplicate window.
- Reduced motion removes morph/scale movement and makes state changes immediate or a brief fade. Functionality and focus behavior stay identical.
- Do not run ELK or pan/zoom the canvas as a side effect of opening a tab.
- Do not claim a true shared-element morph until reviewed in the running app; a purposeful anchored transition is acceptable if full morphing compromises content state or performance.

## 10. Data, security and performance safeguards

- No schema migration or server authorization change is expected for this presentation work.
- Keep Particle UUIDs, mutation revisions, retry receipts, workspace scope and connection integrity unchanged.
- Read-only users may browse/open content but cannot create/edit through new window controls.
- Close/minimize/maximize are local presentation operations and must not write Particle data.
- Keep the React Flow provider, instance, viewport and graph mounted across all presentation changes.
- Prefer one narrowly scoped ResizeObserver path; batch reads/writes and avoid observer loops. Changes to the active panel should not rerender every Particle.
- Lazy-mount expensive panels on first use. Preserve only the visited state needed for restore; do not keep every heavy chart, PDF or lesson active merely to avoid thinking about drafts.
- Explicitly pause media where appropriate when its window is hidden, without forgetting playback position; preserve existing provider behavior.
- Do not bind new global pointer/keyboard listeners without cleanup. Any document-level listener must justify why local event handling is insufficient.
- Respect existing app overlays and tutorial/presentation modes. Windows must not overtake confirmation dialogs, account menus or tutorial locks.

## 11. Ordered implementation slices and review gates

| Slice | Work and deliverable | Validation / stop condition |
| --- | --- | --- |
| 0 — Evidence and contracts | Identify the actual outer-frame owner; capture current focus/rect rules; inventory mounting/draft/portal owners; finalize width/state invariants | Record confirmed cause separately from hypotheses. No speculative global CSS fix |
| 1 — Dock correction | Remove only the obsolete host chrome; correct intrinsic tab sizing and row gaps; preserve rounded visible panel, shadow-free styling and bottom gap | Pointer + keyboard focus, all labels, narrow scrolling, coarse targets. **Show the dock and pause for review** |
| 2 — Separation and Particles | Separate navigation from one content renderer; add typed presentation transitions and canonical Particles tab/library; prove draft/scroll/portal retention with current shell | Unit transition/normalizer checks; actual create/select/save/read-only behavior; canceling dirty navigation leaves everything unchanged. **Show the restored panel and explain the mounting decision** |
| 3 — Static desktop window | Add adaptive window/drawer presenter, title and working controls; constrain normal/maximized bounds; keep dock/canvas usable | All existing panels open correctly; close vs minimize vs restore verified; narrow-mode handoff preserves data. **Pause for geometry and interaction review before motion** |
| 4 — Motion | Add anchored open/close and maximize/restore transitions; reduced-motion path; interruption handling | No duplicate content, lost focus, transform conflict or stale animations. **Show and pause for motion review** |
| 5 — Regression and handoff | Check affected modules, responsive edges and accessibility; resolve concrete findings; update accepted baselines afterward | Report exact checks and remaining device/provider limitations. Full feature accepted only when every included criterion is met |

Each slice ends in a coherent, reviewable local state. Do not combine dock cleanup, old-library migration, desktop window architecture and animations into one patch. While a visual checkpoint is pending, independent read-only investigation or documentation may continue; do not advance the rejected visual design silently.

## 12. Verification matrix

### Pure/unit tests

- Tab route/preference normalization accepts Particles and preserves legacy values and Finance gating.
- Open, switch, minimize, restore, maximize, close and responsive transitions cannot produce both mobile and desktop active surfaces.
- Dirty-guard cancel leaves destination, visibility, selected Particle and focus-return target unchanged.
- Geometry maintains minimum gutters, dock separation and reachable header controls; cover short canvases, sidebar width changes and enlarged composer content.
- Saved preferences never contain transient rectangles or cross-workspace references.

### Focused component tests

- One active panel instance; no duplicate inputs/IDs for mobile and desktop copies.
- Real window controls invoke distinct actions and expose current maximize/restore labels.
- Particle library reads current records, honors permissions and opens the same record ID.
- Keyboard focus styles remain, pointer styles do not leave a focus outline on the invisible host.
- Minimized content is not keyboard reachable; restored content retains the state promised by its adapter.
- Failures preserve the existing error/retry behavior.

### Purposeful manual/browser checks

Use one representative path for each risk; do not run an undirected full-site sweep.

1. Reproduce the supplied outline screenshot, then verify the actual offending element is fixed.
2. Dock at 320/390px narrow canvas, threshold-adjacent widths, typical laptop canvas and large desktop; resize the app sidebar as well as the browser.
3. Long labels/titles, 200% browser zoom, large text, light/dark/system themes and reduced motion.
4. Organization unsaved form → minimize/restore → attempted close/tab switch; cancel/confirm outcomes.
5. People panel selection/drop onto canvas; toolbar and horizontal scrolling stay functional in the wider surface.
6. Documents preview/upload state; nested popovers/dialogs and authorized actions remain usable.
7. Accelerator lesson selection and portal target; minimize/restore without duplicate player or lost lesson position.
8. Particle create → select → edit → save → minimize/restore → reload; read-only viewing and failed-save retry.
9. Keyboard-only dock tabs, window controls, content and focus return; pointer click does not leave the obsolete outline.
10. Rapid open/minimize/restore/maximize, resize mid-transition and switch content while animation is active.
11. Physical iOS keyboard show/hide, orientation and safe areas when hardware access is available. Label untested device behavior explicitly.

### Repository checks

Run changed-file lint, scoped TypeScript, relevant existing acceptance/component tests and applicable ownership/feature/import/storage/interaction-lock checks. Add only tests that cover the newly introduced behavior. Update visual references after user appearance approval, as required by AGENTS. Do not run the full local quality suite unless requested or diagnosing a specific CI failure. No merge/release claim without the required current-revision hosted quality gates.

## 13. Specific risks and mitigations

| Risk | Mitigation / evidence required |
| --- | --- |
| Outer rectangle misidentified as button focus | Inspect the actual host/active element and rule; confirm against the screenshot before broad changes |
| State lost by reparenting a panel | Mounting proof in slice 2 with unsaved forms and Accelerator portal; stabilize host or implement explicit narrow handoff |
| Switching a tab while a Particle guard cancels | Transition only after a boolean/result acceptance contract; current `void` callback is insufficient |
| Six labels crowd the dock | Intrinsic triggers plus horizontal overflow and active-tab reveal; do not widen dock indefinitely |
| Mobile and desktop both catch input | One active presenter, explicit inert/visibility semantics, no full-canvas hit-test overlay |
| Window covers the dock or title becomes unreachable | Bound against measured canvas and dock heights; test zoom/sidebar/short-height cases |
| Motion fights Vaul | Separate transform owners and test interruption; disable complex morphing if it breaks state or input |
| Older Particles library introduces another store | Read-only compatibility audit; adapt useful source actions to current contracts individually |
| Minimize behaves like destructive close | Distinct transitions and draft preservation tests |
| New UI exposes gated data/actions | Reuse existing route/session auth; test read-only and current Finance gating |
| Growing composition crosses file/function limits | Cohesive extraction before adding the desktop shell; no formatter-based limit workarounds |

## 14. Acceptance checklist

- [ ] Screenshot's obsolete frame is gone; one rounded dock border remains.
- [ ] Dock has no drop shadow and retains its detached gap.
- [ ] All tab text remains readable; spacing is content-sized; narrow overflow works.
- [ ] Particles is a real destination with records and functional permitted actions.
- [ ] Desktop content is wider than the dock and fits the usable canvas.
- [ ] Window title and top-left close/minimize/maximize controls work and are accessible.
- [ ] Dock and canvas stay usable while the window is open.
- [ ] Mobile uses the drawer with correct scroll, snap and keyboard behavior.
- [ ] Close, minimize, tab switching and responsive changes preserve/guard drafts correctly.
- [ ] Organization, People, Documents, Tools, Accelerator and routed Roadmap behavior remain functional.
- [ ] Particle selection/edit/save/retry and existing graph state remain intact.
- [ ] Keyboard/forced-color focus works; ordinary pointer use does not leave the obsolete outline.
- [ ] Motion is interruptible and reduced-motion compatible.
- [ ] No duplicate panel/provider/store and no unnecessary dependency or database change.
- [ ] Tests and user checkpoints are recorded with exact verification limits.

## 15. Immediate next action

Begin **slice 0, then slice 1 only**: establish the outer frame's actual owner and clean the compact dock/tab layout. Stop and show that result before introducing the wider window. This document is the plan for the larger change; it is not a claim that the window or restored Particles library has been implemented.

## Checkpoint — 2026-10-10, slice 1

- Kept the existing 460–520px responsive dock width, 16px bottom gap, rounded frame and shadow-free presentation.
- Source inspection confirms that the full-height transparent Vaul host has no explicit outline treatment. Scoped its focus outline to the visible inner panel instead: pointer focus does not paint the tall host, while `:focus-visible` on the host paints a 2px inset panel outline, including system Highlight in forced colors. Child-control keyboard outlines remain intact. Added a React Grab owner for the host so future reports distinguish it from the expand control.
- Reduced tab padding from 8/12px to 6/8px, fixed the inter-tab gap at 2px, and reduced navigation side padding from 12px to 8px. Intrinsic tab widths, horizontal scrolling and active-tab reveal remain. Increased the composer top clearance from 4px to 8px; its measured height maintains the bottom gap.
- Focused drawer/Particle UI checks: 22 passed. Scoped TypeScript passed. Changed-file lint and Graphify refresh are recorded in the runlog after completion.
- The screenshot's rendered cause is not conclusively verified without browser inspection. This patch addresses the identified host-focus path; do not describe the rectangle as visually resolved until Caleb reviews it. Prior browser denial remains respected.
- Review at `http://localhost:3008/workspace`: click between tabs and expand/collapse; verify the obsolete outer rectangle is gone and labels/gaps read correctly; use Tab/Shift+Tab to verify visible keyboard focus. Stop here before slice 2 (content separation and Particles restoration).

### Initial-load focus correction

Caleb reported that the rounded dock still displayed a ring immediately on page load. The first slice incorrectly relied on browser `:focus-visible` alone for the passive host: programmatic/restored focus can match that pseudo-class without a keyboard interaction. The host-to-panel ring now also requires an explicit keyboard event within the dock. Pointer interaction or focus leaving the dock clears that marker. The initial markup has no marker. Existing tab, button and input focus indicators are unchanged; no blur, autofocus or global focus overrides were introduced. Exact focus assignment on load remains untraced without browser access; this correction removes the erroneous equivalence between programmatic focus and keyboard intent.

## Checkpoint — 2026-10-10, slice 2

### Delivered

- User approved tab spacing and requested continuation. Kept approved dock geometry, gap, radius, focus treatment and shadow-free styling.
- Restored canonical `particles` route/tab/preference handling, including organization/viewer-scoped preference round-trip coverage. Finance remains gated; Roadmap deep links remain supported.
- Added a searchable current-graph library with title/type/status/count, honest empty/unavailable/error states, retry, read-only browsing and existing Objective/Activity/Workflow creation actions. All eight existing Particle types can be listed/opened. No copied records or parallel store.
- Particle selection now returns accepted/canceled. Navigation validates its destination and accepts the dirty guard before changing selection, tab, persisted preferences or detent. Tabs use manual keyboard activation, so arrow-key focus does not unexpectedly discard a draft. Clicking the current tab restores its content. Newly committed creation issues the selection request that opens the inspector; opening a library record selects the same canvas record. Tab navigation avoids stealing focus back to a canvas card.
- Removed the redundant always-true `hasOpened` state. The current shell still owns its detents; this slice introduces no second desktop/mobile visibility state.

### Mounting decision

`WorkspaceDrawerTabs` owns one Tabs provider. `WorkspaceDrawerNavigation` owns the existing strip; `WorkspaceDrawerContent` owns one content tree. `WorkspaceRetainedPanel` mounts a module when first opened, then retains that exact component/DOM instance for the workspace session. Inactive modules are hidden and inert; module viewports cache scroll positions, and native audio/video pauses when hidden. The content tree is keyed by organization and viewer so drafts are not carried between scopes.

The Particle inspector is a sibling of retained module panels rather than a conditional replacement for them. Minimizing leaves its draft mounted. An accepted selection change closes/replaces it through the existing dirty guard. Accelerator's lesson portal target remains in the same retained subtree. Organization, Documents and Roadmap retain their own accepted request identity, so unrelated links no longer change document/editor keys.

For slice 3, alter presentation geometry around this tree. Do not move its portal target, introduce a separate desktop copy or remount it at a breakpoint. Native-media pause is implemented; cross-origin embedded video requires provider-aware pause/resume before this retained presentation can be considered complete. Programmatic same-module deep-link resets retain existing behavior and need explicit dirty-draft review; ordinary tab switches now retain drafts.

### Historical library compatibility

Reviewed preserved source contracts/handles and Drive/image boundaries at `8eabd28e`:

| Historical capability | Current disposition |
| --- | --- |
| Search/type/source grouping | Adapted to current domain records; source filters need real source adapters |
| Click/drag placement of `roadmap`, `drive`, `image`, `plan` references | Different from the eight domain types; retain old data, adapt source references later rather than copying the old context/store |
| Drive picker | Needs the current authorized Documents/provider adapter and availability states; not restored by this tab |
| Image upload/read | Old implementation checks active organization/role, MIME signatures and scoped private media paths; requires a reviewed current media adapter, not a UI-only port |
| Historical objective plans | Needs an explicit mapping to current graph operations and preserved source references; no automatic conversion in this slice |

### Validation and review gate

- 47 distinct focused tests pass across drawer, Particle presentation/library/navigation, routes and UI preferences. Added coverage for denied navigation, invalid destination gating, selected-tab restore, title/type search, all eight existing types, read-only browsing, unavailable/empty distinction, lazy module mounting, and scoped Particles preference restoration.
- Scoped TypeScript, changed-file ESLint, import boundaries, React Grab ownership and diff hygiene pass. Acceptance manifest sync preserves existing entries. No database, dependency, provider or remote Git changes.
- User review remains required for actual save/reload, canceled dirty navigation, Organization draft retention, Documents preview/scroll, Accelerator lesson/portal behavior and keyboard access. Server-rendered/component contracts do not prove these browser interactions. Prior browser denial remains respected; no visual baselines updated.
- Stop here before the wider desktop window. Review `http://localhost:3008/workspace`, then resolve retention/media findings before slice 3 geometry and slice 4 motion.


## Slice 3 checkpoint — desktop geometry and controls (2026-10-10)

### Implemented

1. Measure canvas width and height with the existing ResizeObserver, including shell/sidebar resizing. Enable window presentation only at width 900px or greater and at least 320px usable height after dock and clearance subtraction.
2. Keep the compact dock at its approved width and 16px bottom gap. Open content in a separate rounded, shadow-free surface 16px above the dock. Normal width caps at 920px; maximize uses canvas width minus 32px. Normal height targets 70% of the usable region; maximize keeps 16px top clearance.
3. Add a fixed title/header with close, minimize, maximize/restore. Close runs the existing Particle leave/discard guard before hiding or moving focus. Minimize retains selection and drafts without a discard prompt. Module contents stay retained on close; no domain records are deleted. Return focus to the active visible tab, falling back to the dock expand control for routed destinations without a visible tab.
4. Keep exactly one Tabs/content tree, section wrapper, and Accelerator portal target across window/drawer presentation. Desktop uses absolute geometry within the same dock parent. Vaul remains mounted; desktop explicitly disables its host transform and handle gesture. Narrow canvases retain the existing three detents.
5. Keep desktop composer focus independent from content window size. Escape minimizes the desktop presenter through the existing dismissable layer; nested overlays retain their own Escape handling. Buttons retain keyboard focus styles and 44px coarse-pointer targets.
6. Extract shell styling/ownership and legacy drawer control callbacks to keep the main controller within the repository decomposition limits.

### Ownership

Created route-private modules: `workspace-content-window.tsx`, `workspace-content-window-geometry.ts`, `use-workspace-content-window.ts`, `workspace-drawer-shell.ts`, `use-workspace-drawer-controls.ts`, and `workspace-overlay-drawer-props.ts`.

Modified the existing drawer assembly, canvas measurement hook, shared Tabs presentation contract/wrapper, dock CSS, header, and composer. Added geometry/control/SSR coverage to the existing Particle UI test file; updated existing drawer source contracts to follow extracted ownership. No dependencies, database, authentication, persistence schema, or global primitive changes.

### Review boundary

- This slice is static geometry. Morph/open/close motion remains slice 4, after user geometry review.
- Preview: `http://localhost:3008/workspace?drawer=particles`.
- Review desktop normal/maximized bounds, header placement, gap above the dock, close versus minimize with a dirty Particle, and resize back to the narrower drawer. Verify Documents scroll/drafts and Accelerator portal continuity in the running app.
- Earlier browser denial remains active; source, geometry and SSR tests are not visual or real browser interaction evidence. Do not update visual baselines before appearance approval.
- Earlier provider-iframe pause and same-module deep-link draft handling follow-ups remain open; no new claim that retained media behavior is complete.
- Validation completion is recorded below and in the monthly runlog.


Validation: 37 tests passed across the existing drawer and Particle UI suites (geometry, guarded close/minimize/maximize, one rendered content instance, accessibility labels, and previous contracts). Final scoped TypeScript, changed-file ESLint, React Grab ownership, import boundaries and diff hygiene passed. No new acceptance test files or manifest entries. Graphify refresh is serialized behind the prior update; graph output remains local/ignored. No visual baselines changed before user review.


## Slice 4 checkpoint — anchored motion (2026-10-10)

### Implementation and ownership

- Use the existing `framer-motion` dependency on the persistent `WorkspaceContentWindow` section. Open in 260ms, close/minimize in 180ms, and project normal/maximized layout changes over 240ms, using a non-overshooting ease-out curve.
- Measure the selected dock tab (or expand control fallback) when opening/closing. Use that horizontal origin with at most 24px horizontal and 32px vertical travel and a restrained 0.965 scale. This is an anchored transition, not a claim of a true shared-element morph. The dock itself stays anchored.
- Move static horizontal centering from CSS transform to a geometry-derived margin, giving Motion sole ownership of the desktop window transform. Layout changes use transform projection, with direct header/content children participating to reduce text distortion. Inline radius enables Motion's radius correction.
- Separate logical visibility from temporary exit painting. Immediately mark closing content inert/aria-hidden and disable surface pointer events; retain its existing visual subtree until the exit completes. Native media pauses at logical close. Retain the last visible inspector/title and geometry briefly to avoid replacing the closing Particle with unrelated tab contents.
- A small animation driver replaces the active animation and invalidates previous completion callbacks. Rapid close/open/close, responsive handoff, cleanup, or reduced-motion changes cannot let an old completion hide the reopened window. No timed queues, cloned content trees or domain writes.
- Read reduced motion through a live `useSyncExternalStore` media-query subscription with a safe server snapshot. Local inspection showed the installed Motion `useReducedMotion` implementation captures only its initial value; this feature must also respond to changes while open. Scoped CSS cancels in-flight projection transforms for reduced motion and the mobile handoff frame. Vaul retains mobile drag/snap ownership.
- Added 120ms color-only hover feedback on window controls, disabled for reduced motion. Retained all approved spacing, target sizing, colors, shadows policy and focus behavior.

Created `workspace-content-window-motion.ts` (origin calculation, animation cancellation driver, media preference subscription) and `use-workspace-content-window-motion.ts` (presence lifecycle). Updated the window, tab/content presentation, retained-panel visibility, dock CSS and window controller. Existing acceptance test files cover the new behavior; no dependencies, database, permissions or global primitive changes.

### Verification and next checkpoint

- 42 focused tests passed across existing Particle UI and drawer suites. Added interruption ordering, cancellation, origin bounds and live preference subscription coverage. Scoped TypeScript, changed-file ESLint, React Grab ownership, import boundaries and diff hygiene passed (final completion recorded in runlog).
- Static/SSR tests do not establish animation smoothness, actual focus behavior, portal continuity, or browser performance. Browser access remains unapproved; no automated browser workaround or new visual baselines.
- Review `http://localhost:3008/workspace?drawer=particles`: open/minimize repeatedly, maximize/restore, close a dirty inspector and cancel, resize into the narrow drawer during motion, and enable reduced motion. Verify the window feels connected to the dock without excessive travel or scaling.
- Pause here for motion review. Slice 5 remains targeted regression and the already-recorded retained-media/programmatic-deep-link follow-ups. The broader Particle graph/ELK/editor/sharing roadmap remains separate and incomplete.

Implementation references: [Motion layout animation](https://motion.dev/docs/react-layout-animations) and [reduced-motion guidance](https://motion.dev/docs/react-use-reduced-motion), checked against the installed package source for actual behavior.


## Motion review correction — Motion AI Kit (2026-10-10)

User clarified that the current animations need work; the previous “great keep going” must not be recorded as acceptance of motion quality. Final regression/media/deep-link work is paused while motion is revisited.

### Setup performed

- Ran the official `npx --yes motion-ai@14.1.0` installer in this worktree, selecting Project and Codex. Package repository verified as `motiondivision/ai-kit` through npm metadata.
- Installed `.agents/skills/motion/` (ten Markdown files) and configured the hosted `motion` and `motion-plus` servers in the ignored project `.codex/config.toml`. `codex mcp get motion --json` confirms the enabled streamable HTTP configuration. No global agent settings, app package manifest, lockfile or database changes.
- Read the installed skill, universal/React best practices, documentation-search workflow, CSS spring guidance and transition-preview guidance. This guidance is available immediately from files.
- Motion tools are not exposed in this already-running agent session. A direct free-server initialization check returned Cloudflare HTTP 403, error 1010 (`browser_signature_banned`, non-retryable). Stopped after reading the denial reason; no user-agent change, alternate client/proxy, or authentication workaround. Configuration is installed, but a working live MCP connection is not established.
- Motion+ visual editor, example source and MotionScore audits require an authenticated Motion+ connection. None was used or claimed. The free bundled guidance remains useful without it.

### Decisions from the kit and current source review

These are source-based hypotheses, not visually verified causes of the user's complaint.

1. The current window applies one duration/ease curve to translation, scaling and opacity. Revise physical window movement toward a non-overshooting spring, with a separately timed opacity transition. The kit specifically favors physics-based springs for interruptible physical motion.
2. Current origin measurement also adds lateral translation while scaling. Reduce that combination so the window has a clear relationship to the dock, without drifting diagonally or making form content feel like it is zooming.
3. Review interrupted maximize/restore separately from open/close. Preserve current geometry, one retained content instance, immediate inert exit state, guarded close, reduced motion and mobile Vaul ownership.
4. Use `motion/react` for revised motion modules as instructed by the kit. Both current package aliases resolve to 12.29.2; an unrelated repository-wide migration is outside this setup pass.
5. Compare the revised transition in the running app before accepting its feel. User was asked which transitions feel wrong and whether localhost browser inspection is now permitted; the prior browser denial remains in force until an explicit answer arrives.

No additional application-animation values were changed during setup. Next step is the focused motion revision/review, not a claim that installation alone improved the app. No MotionScore grade or runtime performance claim.

Sources: [official installer](https://motion.dev/docs/ai-kit-install), installed `.agents/skills/motion/SKILL.md`, `best-practices/index.md`, `best-practices/react.md`, `css-spring/index.md` and `transition-preview/index.md`.


## Apple-informed motion revision — 2026-10-10

- Retried the configured Motion MCP endpoint at the user's request; same Cloudflare 403/error 1010. Stopped without changing identity or bypassing the denial. Local kit remains usable.
- Consulted current Apple SwiftUI, UIKit, AppKit, HIG Motion, Live Activities and design-principles documentation. Added [workspace motion contract](../design/workspace-motion-contract.md) separating native API behavior, guidance, and our web policy. No universal Dynamic Island timing constants were found in the reviewed sources.
- Centralized physical/fade tuning in the existing motion module. Revised only the window's three motion files and focused tests: near-critical physical spring, independent opacity timing, reduced contraction/travel, no lateral drift, source origin stable through reversal, retarget without hard-stop/reset, and explicit unmount/reduced-motion/mobile cancellation. Scoped imports now use existing `motion/react`; no package or lockfile changes.
- Existing navigation, geometry, retained content, shadow-free styling and dock spacing stay owned by their current modules. No additional store, animation framework, shaders, or persistence changes.
- Review open/close reversal and maximize/restore together before proceeding to the paused regression slice. Browser access remains pending; no visual or MotionScore claim. Validation results are recorded in the current monthly runlog.


## Slice 5 checkpoint — retained drafts and media (2026-10-10)

### User review and scope

The user said the motion “looks pretty good for now” and asked to continue the plan. Record this as acceptance of the current appearance/motion for continued work, not as evidence for every keyboard, responsive, persistence or provider case. Existing localhost browser denial remains unchanged. The prior Graphify refresh completed (20,149 nodes).

### Implemented

1. Organization and Documents no longer remount for each drawer request. Organization resets only across organization scope; Documents retains its existing user/organization scope. Existing editor state continues to own profile fields, policy edits, uploads and filters.
2. Explicit navigation request IDs update focus/tab intent and let repeated links target the same field again. Hidden/rejected destinations do not consume new requests until their panel is active. Ordinary links retain profile edits; existing external-navigation/discard guards remain in place.
3. While a program editor is open, hold its request object/initial step. Notify the user when a new destination is pending; apply the latest request after close. This avoids reinitializing a form through changed `initialStep`/program props.
4. The audit found program close canceled the 700ms pending autosave. Close now flushes the current snapshot through the existing save queue before releasing the editor. Failed saves retain the open form. Edits during the save also keep it open; another close saves the newer revision. No parallel persistence layer was added.
5. A small media-activity context follows retained modules and React portals. Native video pauses on hide and rejects hidden playback events. Known YouTube/Vimeo lesson embeds use their official SDKs, loaded once on demand, to pause without recreating the player. Restore never issues play. Late readiness, source changes, teardown and rejected pause calls are handled.
6. Unsupported embeds (including current Loom URLs), blocked SDKs or unavailable control APIs use a load-on-click fallback. Hidden fallback players unmount. Restoring requires “Load video”; playback position may reset. This is an explicit capability limit, not a claim of provider-neutral resume support.

Provider references: [YouTube IFrame API](https://developers.google.com/youtube/iframe_api_reference), [Vimeo Player SDK](https://github.com/vimeo/player.js). SDKs load only for video embeds; no npm/lockfile change, provider credential, API key or database migration. Existing permissions and lesson-completion behavior remain unchanged.

### Ownership and changed files

- `components/media/`: activity context, exact-provider classification and URL parameters, official SDK loader, playback lifecycle, managed embed host. The SDK owns an iframe within its own React host to support cleanup without competing DOM ownership.
- `training/module-detail/video-section.tsx`: managed embed and native-media activity integration.
- Existing retained-panel, drawer-content and organization-panel modules: accepted request identity, organization scope and deferred program destinations.
- Existing Organization editor props/hooks and Documents focus props: navigation ID propagation; no second draft store.
- `program-wizard.tsx` and `program-wizard/save-before-close.ts`: flush before close with failure and concurrent-edit preservation.
- `workspace-retained-content.test.ts`: provider, lifecycle, SDK-loader, retained request, SSR fallback and close-save tests; existing drawer source contracts updated. Acceptance manifest includes the new test.

### Verification

- 84 tests pass across retained-content, Particle UI, drawer, Organization editor layout/deep links and relevant program wizard contracts.
- Scoped TypeScript, changed-file ESLint, React Grab ownership and import boundaries pass. Existing source expectations were adjusted for removal of request remount keys and formatter ordering; two unnecessary regex `s` flags were removed for the repository's TS target.
- No browser/provider playback, authenticated save/reload, mobile hardware, or visual-baseline verification is claimed. Actual provider behavior still needs user review. No remote Git or release work performed.

### Review checkpoint

At `http://localhost:3008/workspace`:

- Edit Organization, follow another Organization link, then minimize/restore: draft should remain. Repeat a field link after navigating within the panel.
- Open a program, edit, request another destination, then close: saving precedes navigation. A failed save keeps the editor open.
- Play an Accelerator lesson, switch tab or minimize, and restore: playback should be paused; YouTube/Vimeo should retain position. Unsupported/blocked embeds offer Load video.
- Documents filters/edit/upload state should remain across another Documents link and a minimize/restore cycle.

Keep the approved dock geometry and motion stable during review. Broader graph selection, React Flow v12 integration, measured ELK auto-layout UI, remaining Particle editors, image/forms/sharing and generative actions remain separate milestones in the infrastructure PRD; this checkpoint does not complete those PRDs.
