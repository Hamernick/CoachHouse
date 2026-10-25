# Workspace motion contract

Reviewed: 2026-10-10. Scope: workspace dock, desktop content window, responsive drawer, and retained content. Status: user accepted current motion for now on 2026-10-10; runtime performance and detailed accessibility review pending.

## Purpose and authority

Motion explains where content belongs and lets people keep working. Product state determines the destination; animation must never decide whether navigation, editing, or saving succeeded.

This contract supplements [the staged dock/window plan](../plans/2026-10-10-workspace-dock-and-content-window-plan.md). Existing requirements remain: compact dock, detached bottom gap, no drop shadow, rounded surfaces, intrinsic tabs, real keyboard focus, and preserved drafts. Apple sources inform the design; this web application does not run SwiftUI, UIKit, or AppKit.

## What Apple actually specifies

| Source | Classification | Applicable evidence |
| --- | --- | --- |
| [Motion HIG](https://developer.apple.com/design/human-interface-guidelines/motion) | Design guidance | Keep feedback purposeful, brief, consistent with the gesture, and interruptible. Standard motion adapts to input and accessibility preferences. |
| [SwiftUI custom Liquid Glass](https://developer.apple.com/documentation/swiftui/applying-liquid-glass-to-custom-views) | Native API behavior | Shared containers coordinate effects; unique IDs within a namespace preserve shape identity. Container spacing governs proximity. Nearby effects use matched geometry; separate effects can materialize. These modifiers act during transitions/animations. |
| [UIKit fluid transitions](https://developer.apple.com/documentation/uikit/enhancing-your-app-with-fluid-transitions) | Native API behavior and implementation guidance | Resolve the source through stable identity. Allow new navigation during a transition, minimize temporary state, and make lifecycle callbacks safe to repeat. A canceled pop and an interrupted push have different native lifecycle semantics; do not copy them blindly into React. |
| [AppKit glass containers](https://developer.apple.com/documentation/appkit/nsglasseffectcontainerview) and [spacing](https://developer.apple.com/documentation/appkit/nsglasseffectcontainerview/spacing) | Native API behavior | Similar descendant effects can be processed together. Spacing controls merging; zero supports batching without proximity distortion. A shared design does not require every surface to merge. |
| [Adopting Liquid Glass](https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass) | Design and adoption guidance | Prefer existing system components; keep effects concentrated in functional navigation/controls. Test reduced motion/transparency and appearance variants. Avoid excessive effects that distract from content. |
| [Live Activities HIG](https://developer.apple.com/design/human-interface-guidelines/live-activities) | Platform-specific constraint and guidance | Preserve existing elements across layout changes and avoid collisions. Live Activity content animations have a two-second maximum and do not animate on reduced-luminance Always-On displays. These are Live Activity rules, not recommended website timing values. |
| [Design principles](https://developer.apple.com/design/human-interface-guidelines/design-principles/) | Design guidance, updated June 2026 | Preserve context across configurations; consistency, agency, and careful iteration matter more than decorative effects. |

The reviewed public sources do not provide a universal Dynamic Island spring, duration, or browser refraction recipe. Numerical settings below are Coach House choices. Our restrained separate-surface reveal borrows the continuity principle; it is not Apple's native `materialize` implementation.

## Composable ownership

| Layer | Existing owner | Firm boundary |
| --- | --- | --- |
| Intent and navigation | `use-workspace-drawer-navigation.ts`, `use-workspace-content-window.ts` | Own accepted navigation, dirty guards, close/minimize/maximize, and focus return. Never wait for animation completion to accept input. |
| Responsive geometry | `workspace-content-window-geometry.ts` | Pure bounds calculation from measured canvas/dock dimensions. No spring settings, content state, or per-frame layout reads. |
| Motion policy and driver | `workspace-content-window-motion.ts` | One named policy for physical response, visibility timing, and bounded travel. Revision guards reject obsolete completions. No domain mutations. |
| React presentation adapter | `use-workspace-content-window-motion.ts` | Connect intent to Motion, retain exit geometry, track live reduced-motion preference, and cancel on teardown/mode changes. |
| Surface and rendering | `workspace-content-window.tsx`, `workspace-dock.module.css` | One persistent content tree, accessible controls, theme tokens, radius, clipping, and layout correction. Desktop movement belongs to Motion; mobile movement belongs to Vaul. |
| Data and drafts | Existing module/Particle state and retained panels | Persist independently of presentation. Never duplicate records or remount an editor solely to animate it. |

Keep these modules route-private until another real consumer needs them. Tuning the policy requires no persistence or navigation changes. Replacing the animation engine should affect the driver/presentation adapter, not introduce a second store or generic plugin framework.

## Required behavior

1. **Immediate intent:** open content is interactive while entering. Close/minimize makes it inert immediately even if its last frame remains painted during exit. Saving and network requests never wait for motion.
2. **Reversible motion:** new intent retargets the running animation. Do not hard-stop/reset transforms on every reversal, queue user actions, or use a timer to guess completion. Only the latest completion can hide the surface.
3. **Stable origin:** resolve the current tab by its existing DOM identity at a settled boundary. Freeze origin during interruption; measuring a partially transformed rectangle would shift the apparent source. Missing source falls back to bottom-center.
4. **One surface:** maximize/restore changes bounds of the existing window. Do not crossfade duplicate editors, iframes, or portal targets. Child layout correction keeps text from stretching with the projected shell.
5. **Separate surfaces:** the dock remains available while the larger window opens above it. Do not shrink a whole editor into a tiny tab or imply that two simultaneously visible surfaces are the same shared element. Organization is the October21 user-approved exception: its persistent shell grows from the measured profile-button bounds to the left sidebar. The trigger is hidden/non-interactive while expanded, so identity appears once in the retained profile. Other destinations remain separate from their dock tabs.
6. **Same route back:** dismissal contracts toward the same dock region. No independent sideways drift, bounce flourish, blur animation, or delayed cascade of controls.
7. **Mode handoff:** when desktop eligibility changes, cancel desktop presence movement, reset its transform, and let the existing Vaul drawer own mobile gestures. Preserve content and portal identity. Keep the existing CSS projection override as a responsive/reduced-motion guard.
8. **Accessibility:** subscribe to preference changes while mounted, including during animation. Reduced motion settles immediately; SSR starts conservatively. Preserve focus semantics, keyboard rings, Escape handling, and forced-colors support. Do not infer disability or remove focus globally.
9. **Errors and drafts:** navigation rejection leaves both presentation and selection unchanged. Minimize retains drafts. Animation completion never clears an editor, changes a Particle, or publishes content.

## Current policy and tuning boundaries

`WORKSPACE_WINDOW_MOTION` centralizes this revision:

| Concern | Initial web policy | Rationale |
| --- | --- | --- |
| Position, scale, projected resize | Physics spring: stiffness 600, damping 50, mass 1 | Slightly overdamped response from rest; accepts existing velocity. No intentional bounce. |
| Opacity | 160 ms enter, 120 ms exit, ease-out | Visibility is brief and independent of physical settling. |
| Entry/exit contraction | Scale 0.985; 12 CSS px vertical travel; no x translation | Small spatial cue with readable content and limited displacement. |
| Transform origin | Bottom edge; horizontal origin follows the tab, bounded to 8–92% | Retains source relationship without pulling the window across the canvas. |
| Reduced motion / narrow handoff | Immediate reset | No mandatory motion to access content. |

Physics-based springs use current velocity, unlike duration-based spring approximations. See [Motion transition documentation](https://motion.dev/docs/react-transitions). A damped spring can still reflect incoming velocity during a reversal; the from-rest test does not prove every interrupted path is monotonic.

These values are provisional product tuning, not Apple constants or proof of frame-rate performance. Tune the shared policy after reviewing open, close, and resize together. Do not add independent easing literals inside module panels. Keep hover feedback separate from window movement.

## Performance and materials

- Read anchor geometry at transition boundaries, not each frame. Use Motion transforms/layout projection and opacity; do not animate layout with repeated React state updates.
- The adapter requests a transform compositor hint only while presence or layout motion is active, releasing it when both finish or presentation resets. Never blanket the canvas with persistent promoted layers; verify the actual rendering benefit during runtime review.
- Retained panels preserve drafts but must not continue unnecessary media/work while hidden. Native media and YouTube/Vimeo pause through the retained activity context; unsupported/blocked players unload and require explicit loading on restore. Provider runtime review remains pending.
- Keep glass/material styling independent of motion. No refraction shaders, duplicated backdrop layers, permanent `will-change`, new shadows, or extra animation library in this revision.
- The current semantic background remains readable without transparency. Any future translucent material must include reduced-transparency/contrast fallbacks and a separate rendering-cost review. Native Apple adaptations do not automatically apply on the web.

## Verification and review gates

Automated checks cover stale completion after reopening, close/open/close ordering, explicit reset/unmount cancellation, separate fade/physical policy, sampled spring response from rest, bounded origin/travel, live preference subscription, existing geometry/actions, and server-rendered retained content.

Manual review remains required for:

- Open/close from each tab, immediate reversal, and close while resizing.
- Rapid maximize/restore, small and large content, and text/radius stability.
- Desktop/mobile handoff during a transition, keyboard navigation, and preference changes mid-animation.
- Draft, scroll, portal, selection, and media preservation.
- Light/dark appearance, coarse-pointer targets, and actual frame pacing on a representative device.

Source tests and sampled curves cannot establish visible smoothness, compositor behavior, or authenticated persistence. Record route, canvas size, input mode, preference, and observed defect before revising settings. Update visual baselines only after review in the repository's supported environment.

## Tooling status and maintenance

Motion AI Kit 14.1.0 is installed for this worktree/Codex. The user-authorized retry on 2026-10-10 again returned Cloudflare 403/error 1010 with a non-retryable signature denial. No bypass was attempted. The bundled Motion guidance and public first-party documentation remain available; live MCP tools, Motion+ editor, and audits were not used.

Recheck authoritative sources when changing the supported runtime or interaction model; date changes to this contract. Keep policy changes small and reviewable. Browser review is pending because the earlier denial has not been explicitly reversed. Neither this document nor passing tests constitutes visual approval or a release.


## October 21 — Organization button/sidebar morph

The organization sidebar starts at the same8px canvas top/left inset as its trigger and grows/shrinks with Motion layout projection and the existing spring. A ResizeObserver measures the trigger; no per-frame geometry reads or React animation updates. The retained shell stays mounted at the button size when collapsed, with its content inert/hidden; direct child layout correction keeps text from stretching. The visible button covers the compact shell and disappears while expanded. No editor remounts or duplicated profile content.

Organization presence no longer adds the independent slide/scale animation. Live reduced motion disables layout projection. Keyboard focus transfers from the hidden trigger to Close after expansion begins and returns on dismissal. Normal windows retain their existing presence driver.

Installed Motion skill best practices and public `https://motion.dev/docs/react-layout-animations` used; Motion MCP remains unavailable. Authenticated browser observed intermediate expansion/contraction transforms, matching compact/trigger rectangles, full-height final sidebar, and focus round trip. This is functional evidence, not frame-rate or user appearance approval.
