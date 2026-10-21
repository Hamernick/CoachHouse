# Particle inspection and compact window chrome

Status: implemented locally; 326 focused tests, scoped TypeScript, affected ESLint and five guards passed; user visual review outstanding.
Lane: `feat/particle-system-20261009`, preview port 3008.

## Scope and interpretation

Treat “delete ParticleLibrary on all particles” as removing blanket React Grab ownership that captures inner elements, not deleting the library, previews, search, drag/drop, or saved records. Keep the layout wrapper where it is needed for scrolling and spacing. The shorter header request applies to `WorkspaceContentWindow`; Particle card headers get granular inspection metadata, not traffic-light buttons.

Deliver in reviewable slices: granular inspection, compact chrome, real save-state reporting, close behavior, verification. Preserve the current detached window, dock width/gap, retained editors, motion policy, React Flow interactions, and shadow-free surfaces.

## Findings from the current implementation

- `particle-library.tsx` marks the whole section as `workspace-particle:library`.
- `particle-node.tsx` also declares a whole-card owner. `react-grab-loader-resolution.ts` resolves the nearest ancestor anchor, so removing the library anchor alone cannot fix canvas inspection.
- `particle-library-tile.tsx` uses inert, pointer-disabled previews. `particle-preset-gallery.tsx` adds a full-cover configuration button. These intercept targeting before the resolver sees the rendered inner component.
- `ParticleFrame`, header, status, progress, specialized previews, nested rows, and action buttons need distinct ownership scopes. The Organization, Activities and Fiscal Sponsorship tool previews also need their actual component owners preserved.
- `workspace-content-window.tsx` currently combines a 32px control row with 16px vertical padding and a bottom border (approximately 49px). Coarse-pointer controls are 44px. The window receives no save-state information.
- Inspector, preset draft, organization/profile, program and accelerator editors own separate draft/save lifecycles. A window-level boolean inferred from typing or a global network flag would be incorrect.

## Apple references and interpretation

The desktop reference is AppKit window behavior; Swift is the language, while UIKit supplies relevant iPad/window adaptation. This web surface remains an application content window, not an operating-system window.

Apple recommends system window chrome for native apps and cautions against imperfect custom replicas. Our proposed web adaptation borrows familiar control order and semantics without claiming native-system equivalence. Window controls must not collide with toolbar content. [Apple HIG: Windows](https://developer.apple.com/design/human-interface-guidelines/windows)

AppKit's `NSWindow.isDocumentEdited` models whether document changes need saving. Use that model for the indicator: edits remain outstanding until persistence confirms them. The inner-dot treatment below is our chosen macOS-inspired visual; the red control remains Close. [Apple: isDocumentEdited](https://developer.apple.com/documentation/appkit/nswindow/isdocumentedited)

Apple recommends comfortable targets, spacing, non-color-only communication, and reduced motion. Our CSS dimensions are web design decisions, not Apple's point measurements. [Apple HIG: Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)

Motion should be brief, purposeful, interruptible and consistent with the initiating gesture. Preserve the existing window transition driver; this revision adds only local control feedback. Apple does not publish a universal Dynamic Island spring or web transition recipe. [Apple HIG: Motion](https://developer.apple.com/design/human-interface-guidelines/motion)

## Slice 1 — Individual React Grab targets

1. Remove the blanket library owner anchor. Retain its accessible section label, search, loading/error states, spacing and canvas event boundaries.
2. Give semantic parts explicit identities through the existing `getReactGrabOwnerProps` / linked-surface helpers: title, type label, status, progress, body, each checklist/calendar/people row, input, chart/image wrapper, contextual action and handle. Do not wrap every text span in a new component.
3. Keep frame inspection available by selecting frame padding; nested owners must win over the frame/node owner. Use IDs scoped by workspace, canvas/library/preset presentation, record/preset ID and part/entry ID. Preset previews currently reuse a deterministic record ID, so that ID alone is insufficient.
4. Point metadata to the actual specialized renderer and token owner, not always `particle-library.tsx`, `particle-node.tsx` or shared `button.tsx`. Link portaled menus/tooltips to their own triggers. Preserve specialized tool-card metadata.
5. Handle preview hit testing explicitly. First inspect the installed React Grab API for inspection activation/element selection hooks. If supported, suspend only preview interception while inspection is active, with capture-phase action cancellation. Otherwise prefer scoped non-interactive preview markup and delegated tile activation over a shared global resolver rewrite. Do not remove `inert` or enable real preview actions without an equivalent interaction/accessibility guard.
6. Preserve ordinary click-to-configure for presets, existing-record drag/drop, inert previews, and keyboard Add/Remove actions. React Grab selection must not configure, mutate, move or add a Particle.

Files: Particle library/tile/gallery/node/card/frame and specialized preview/widget renderers; shared tool-card owners if inspection proves necessary. Inspect React Grab loader/resolution helpers; alter global resolution only if a local fix is insufficient and its regression tests prove other surfaces remain correct.

Checkpoint: user can grab a title, status, checklist row and action separately in both a preset and a live canvas Particle; existing interactions still work.

## Slice 2 — Compact content-window header

- Extract a small `WorkspaceWindowControls` component from `WorkspaceContentWindow`; keep placement, header sizing and control tokens in `workspace-dock.module.css`.
- Desktop target: 36px header, 12px visible circles inside separate non-overlapping 28px hit targets, 12px leading inset. Use minimal vertical padding and no heavy divider. The visible circles, not the hit areas, should read as a tight group.
- Red: close. Yellow: minimize while retaining content. Green: maximize/restore within the canvas, not browser fullscreen. Keep existing callbacks and geometry behavior.
- Show quiet action glyphs on group hover or keyboard focus. Supply labels and tooltips in every state; color alone never identifies an action. Give each control and title its own React Grab owner.
- Keep the title compact and correctly aligned, with overflow truncation and an accessible full name. Reserve space so controls and title cannot overlap.
- Coarse pointer: retain 44px hit targets and a roughly 52px header. Mobile continues using the established sheet/handle controls; do not squeeze three desktop circles into the mobile dock.
- Keep keyboard-only focus indication, forced-colors support, light/dark contrast and existing reduced-motion behavior. Use approximately 100–120ms local opacity/color feedback from shared tokens; no pulsing, bounce, added blur animation or shadow.

Files: `workspace-content-window.tsx`, new local `workspace-window-controls.tsx`, `workspace-dock.module.css`; adjust geometry constants only if actual header budgeting requires it.

Checkpoint: review compact desktop chrome, coarse-pointer spacing, title truncation and all three actions before wiring save status.

## Slice 3 — Report actual edit/persistence state

Add one window-scoped presentation contract, reusing editor-owned state. It is not a second form store or persistence layer. Editors register stable scope IDs and publish status; cleanup removes only that scope. Retained hidden editors keep their registrations until their drafts are saved, explicitly discarded or safely disposed.

| State | Red control indicator | Meaning/action |
| --- | --- | --- |
| Clean/read-only | Plain circle | No known outstanding edits; do not claim an unregistered editor is saved |
| Modified | Small contrasting inner dot | Changes remain unsaved |
| Saving | Inner dot remains | Announce Saving; a request starting is not success |
| Save failed/conflict | Inner dot remains | Accessible failure detail and retry/conflict action in the editor |
| Save acknowledged | Dot clears only for acknowledged revision | New edits made during the request remain unsaved |
| New preset draft | Identified as Draft/not yet added | Never label an uncreated Particle Saved |

Use window-level aggregation for outstanding edits in retained tabs, with status details naming affected sections. Unrelated canvas position saves must not falsely label the active editor as saved or dirty. No persistent Saved badge is required; use concise screen-reader status and tooltip text, with a small visible error message when action is needed.

Adapter inventory before completion: Particle inspector; preset editor; Organization profile; program editor; accelerator lesson/onboarding submissions; Documents/Roadmap editing; People edits where they persist independently. Editors without a safe save API expose that limitation rather than a fabricated Save action. Prefer lifting existing callbacks; introduce a small scoped context only where retained descendants cannot report through existing props without broad plumbing.

Checkpoint: edit, save, failed save, retry, concurrent edit during save, hidden dirty tab, and pristine new draft all report correctly.

## Slice 4 — Safe window dismissal

Red requests Close, never deletes a Particle or its canvas placement. Yellow minimizes and retains draft state without a discard prompt. Green changes geometry only.

Route every dismissal that would destroy a draft through the existing editor's guard. Offer Save/Discard/Cancel only where those actions exist and are meaningful; failed saving keeps the window open. If closing merely hides retained content, retain the draft and its marker on reopen. Do not introduce repeated prompts for that reversible action.

For uncreated presets, the explicit top-right Add to canvas remains the creation confirmation. A generic window Save or Close must not silently create a Particle. Pending creation must retain the same draft ID and retry receipt behavior. Verify tab changes, Escape, red close, browser unload and editor replacement without weakening existing safeguards or remounting retained editors.

Files: `use-workspace-content-window.ts`, drawer/content contracts and adapters, existing editor hooks. No database schema or endpoint changes anticipated.

## Slice 5 — Verification and delivery

- Ownership tests: deepest semantic target, frame-padding fallback, unique presentation IDs, specialized tool owners, linked portals, preview inspection without executing actions.
- State tests: clean/dirty/saving/error/conflict, acknowledgments racing newer edits, independent retained editors, cleanup, retry and explicit draft creation.
- Window tests: close/minimize/maximize semantics, draft retention, rejected close/save, focus return, reduced motion and touch targets.
- Run focused Vitest, affected TypeScript/lint, React Grab/interaction-lock/workspace-surface/boundary guards. Keep inherited unrelated test diagnostics separate.
- User review on localhost:3008: light/dark desktop, touch layout, inner-element grabbing, save marker and draft-safe dismissal. Browser access remains unapproved; no workaround. Update visual references only after approved appearance review and in the supported environment.
- Refresh Graphify after implementation, append runlog evidence, then resume the broader Particle plan.

Done means the actual child component can be grabbed, the header is visibly smaller, and the red control accurately reflects unsaved work without losing drafts. Merely removing the library anchor or painting three circles is insufficient.


## Implementation checkpoint — 2026-10-12

- Removed the library-wide ownership anchor; added granular selection policy through shared React Grab helpers, per-instance frame/header/status/progress/row identities, and inspection-only preview targeting. Normal previews remain inert; inspection blocks click, keyboard and drag actions. Plugin deactivation/unmount clears inspection mode.
- Extracted compact window controls: 36px desktop header, 12px visual dots/28px targets; 44px targets for coarse pointers. Close/minimize/maximize retain existing callbacks. Keyboard focus, accessible labels, forced colors and reduced motion are preserved. No shadow added.
- Added window-scoped edit reporting with editor-owned dirty/pending/error/draft state. Adapters cover Particle inspector/presets, Organization profile, Activities, Roadmap, document policy, People tags, Accelerator homework/completion and organization setup. The provider is presentation state, not a new data store. Unregistered editors do not get a fabricated Saved status.
- Particle save failures retain drafts and show an error. Profile save acknowledgments preserve edits made during the request. Window dismissal continues using existing retained-panel and inspector safeguards; Close does not create a preset or remove a Particle.
- No schema, endpoint, package or motion-driver changes. The broader Particle roadmap remains separate.
- Still requires user review: actual React Grab targeting in both drawer/canvas, preview click suppression, pointer/keyboard behavior, light/dark/touch appearance, save/retry and retained-tab lifecycle. Browser access remains denied; no automated visual or interaction claim.
