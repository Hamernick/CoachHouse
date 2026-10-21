# Shapeshift adaptation for the workspace dock

Status: native Particle adapters implemented; incomplete upstream parity. See the 2026-10-13 audit below.

## Finding

[Shapeshift registry source](https://lab.anishfn.ink/r/shapeshift.json), retrieved 2026-10-12, packages a 693-line composer plus 907 lines of example shapes. It uses `motion/react`, already installed here. The repository uses pnpm, so any eventual registry CLI import should use `pnpm dlx shadcn@latest add https://lab.anishfn.ink/r/shapeshift.json`, after reviewing the destination/dependency diff. Bun is unnecessary.

The useful abstraction is a stable composer with registered contextual tools: rest, suggestions, and an active tool. A shape has matching rules, a parser, and a renderer; optional classification selects a registered shape. It is not an arbitrary UI generator, workflow executor, or complete drawer/window system.

### Reuse conceptually

- A persistent input and presentation surface instead of collapsing and rebuilding the whole interface on each tool change.
- Destination-width content measurement to reduce text rewrapping during a shell transition.
- Stable tool identity and the last valid parse while a person edits an incomplete command.
- Explicit tool selection, keyboard suggestions, and cancellable optional classification.
- A single measured content region rather than nested competing expand/collapse animations.

### Adapt before production use

- Upstream submission calls callbacks synchronously and clears immediately. Our action adapter must await the existing save receipt, retain the draft on failure, and prevent duplicate submission.
- Upstream outside press and Escape clear input, and keyed tool bodies unmount on replacement. Preserve our retained editors, dirty-navigation guards, focus return, selection and media handling. Outside press must not silently discard work.
- Upstream animates CSS width and measured height, includes blur transitions, rotating placeholders and a shadow token. Keep our shadow-free appearance, compact fixed bounds, multiline composer, existing motion policy and reduced-motion behavior. Evaluate projection for shell changes instead of adopting per-frame layout animation for large editors.
- Upstream erases shape generics with a double assertion. Use our discriminated Particle/action contracts and runtime validation at the action boundary; do not add a competing generic data store.
- Upstream local parsers and optional model classification are suggestions, not authorization to mutate data. Unknown/ambiguous input offers choices or validation; it never creates an arbitrary Particle.

## Integration boundaries

- `particle-composer.tsx`: persistent input, draft, suggestions and explicit action preview.
- Existing Particle registry/command parser/session: available actions, validated payloads and confirmed save results.
- `use-workspace-drawer-navigation.ts` / `use-workspace-content-window.ts`: accepted navigation and close/minimize/maximize ownership remain unchanged.
- `workspace-content-window-motion.ts`: shared physical/fade policy; use the same policy for contextual composer transitions.
- `workspace-content-window.tsx` and its presentation hook: retain desktop editor identity. Vaul retains mobile drag/detent ownership. Never apply two animation engines to the same transform.

## Sequence and review points

1. Build one reviewable vertical slice: explicit Add Activity selection opens an editable preview above the existing composer. Keep navigation tabs, dock width and detached content window unchanged. Reuse the existing Activity factory and session write path. No additional model integration.
2. Unify measured preview transitions and the existing desktop-window policy. Open, switch, close and immediate reversal must use the latest accepted intent. Do not imply that the dock and detached window are one shared element while both remain visible.
3. Verify save failure, pending submission, rapid tool switching, Escape/outside press, dirty navigation and reduced motion. Then have the user review motion on localhost:3008 before extending to other tools or updating visual baselines.
4. Extend the same adapter to other real Particle actions only after the first slice is accepted. Add classification later through the existing AI infrastructure if needed; it may propose validated registered actions only.

## Acceptance for the first slice

The user can select Add Activity, edit a preview, submit once and see the saved Particle. Input clears only after confirmation. Failure retains input. Switching/minimizing retains or explicitly guards edits. Rapid reversal cannot hide a reopened view. Keyboard focus, mobile scrolling, native canvas gestures and live reduced-motion changes remain correct. No remounted organization editors, added drop shadow, dock width changes, or global dependency/runtime migration.

## Evidence and limitations

Downloaded registry SHA-256: `56e682633495cbb418ed1d5da649247b3ea436a6d753a0b499b4737718f49003`.

Compared source against the existing workspace motion contract, Motion driver, retained-window/navigation ownership and Particle composer. No browser execution, package installation, runtime smoothness claim, or production change. License/provenance must be checked before copying upstream implementation into the project.


## Implemented checkpoint — slash catalog and confirmed placement

User clarified the flow: `/commands` opens the existing Particle drawer; all presets use our card gallery styling; selecting a preset opens a draft editor; its top-right plus confirms placement.

- `/`, `/commands`, `/particles`, and the composer plus open the existing Particles tab. `/timer` and similar text filter the same catalog. Existing create commands continue to work.
- The catalog contains the eight domain Particle types plus Event, Say hi, Checklist, Timer, Split a bill, Poll, Color and Calculate. Preset tiles use actual ParticleCard previews and keyboard-accessible selection overlays. Existing organization/activity/fiscal cards and saved Particle placement/drag behavior remain unchanged; placed instances remain dashed entries at the bottom.
- Selecting a preset creates no persisted record. The draft editor owns a stable UUID, editable title/description/configuration, inert live preview and a 44px top-right Add to canvas button. Back guards edited drafts; tab switching/minimizing retain the existing library subtree. Confirmation uses the existing scoped Particle operation/receipt API. Submission is guarded and failures retain the draft; retry reuses the pending operation and final UUID.
- Event/Timer/Split/Color/Calculate are Activity configurations with a defined optional discriminated `data.widget` schema. Say hi becomes an unsent Content Calendar email draft, Checklist a Workflow, and Poll a Decision with declared outcomes. Poll is not a public voting integration. Event stores UTC timing; timer stores duration/end time with derived local countdown; calculations use a restricted arithmetic parser, never eval. No table migration or new persistence store.
- Desktop-window and draft-preview opacity timing now share `src/lib/workspace-canvas/surface-motion.ts`. Existing spring behavior, Vaul ownership, shadows, dock widths and retained editors are preserved. The upstream component and sample implementation were not installed/copied wholesale; these are native Coach House adapters for the reviewed preset categories.
- Source boundary files: `particle-presets.ts`, `particle-widget-schema.ts`, `particle-calculation.ts`; presentation files: preset gallery/editor and widget preview; existing composer/library/session/flow and dock adapter integrate them.

Verification: 172 tests across eight focused suites pass, scoped TypeScript passes. Includes all sixteen factories, slash parsing/filtering, safe calculation errors, real domain payloads, replay-safe persistence and SSR editor/gallery previews. The existing handle renderer test was converted from JSX to createElement in a `.test.ts` file so the repository's manifest generator includes it; no test infrastructure was added. Final lint/guardrails and renderer rerun recorded in the runlog.

Review at localhost:3008/workspace: type `/commands`, select Timer, change minutes, press the top-right plus, then Start the canvas timer; repeat with Say hi and Checklist. Verify Back, minimized draft recovery and a rejected save. Browser permission remains denied, so actual layout, focus, animation feel and authenticated reload still require user review before visual baselines change. This checkpoint does not complete the full Particle PRD.


## 2026-10-13 — Registry completeness audit and usability correction

Re-fetched the exact registry URL. SHA-256 remains `56e682633495cbb418ed1d5da649247b3ea436a6d753a0b499b4737718f49003`: two source files, 693-line composer and 907-line example shapes; dependency `motion`, registry dependency `utils`, and a popover shadow token. Motion/utils already exist. No missing third-party icon package: the source defines its own 18px SVG components.

The prior work implemented the eight categories as Coach House domain adapters. It did **not** install the upstream composer, parsers, interactive shape components, icons, or shadow token. The draft preview was explicitly inert; canvas widgets were simplified. This was not full component parity.

Corrections:
- Removed inert/pointer blocking from the preset editor preview; it now updates its local draft and passes that draft to the explicit Add action. Gallery previews remain inert so selection/dragging work. Non-submit controls use button semantics, and nonfunctional preview footer actions are omitted.
- Imported the actual source SVG geometry into `shapeshift-icons.tsx`, with provenance. Widget/domain renderers choose matching Event, Message, Checklist, Timer, Split, Poll, Color and Calculate icons.
- Timer has ring, start/pause/resume/reset, wall-clock derivation, and optional persisted `remainingSeconds` compatible with existing timer records. This is validated JSON payload evolution, not a table migration.
- Split has bounded person controls; Color has a picker; Event/Split/Color/Calculate have clipboard actions that announce success only after the clipboard promise succeeds.
- Placed widgets have inspector configuration fields. Calculations recompute and validate their result; malformed expressions cannot save. Selecting an already-selected outcome clears that selection.

Remaining differences requiring separate work:
- Upstream sentence matching/readers and automatic composer morphing are not installed; `/commands` remains the explicit native catalog/editor flow.
- Event people/location metadata/calendar export, the richer message form, and Color RGB/HSL/shade tools are not yet at upstream parity.
- Sending and public voting are not provider integrations in either this native adapter or the standalone example. Coach House retains email drafts and decision choices.
- Do not replace retained-window state, scoped saves, error handling or reviewed shadow-free motion with upstream demo-local state/clear-on-submit behavior.

Verification: 128 focused tests passed, including timer lifecycle/schema persistence, one explicit Add submit, real SVG presentation, inspector configuration and calculation validation. Browser/visual review remains with the user.
