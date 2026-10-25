# Particle editor prototype — Rhea preset reference

## Scope and approach

User requested a design prototype of Particle editor interiors using shadcn preset `b27GcrRo`. Continue the existing Particle lane and localhost:3008. Preserve all real data, save/concurrency/retry behavior, workspace header slots, shared window motion and canvas/drag renderers.

The official CLI resolved the preset in a disposable reference project: **radix-rhea**, neutral palette, Inter, Lucide, default menu color and subtle menu accents. CLI-generated fields/inputs use filled rounded geometry and compact controls. The application already has a similar semantic neutral palette and its own customized Radix primitives and focus policy.

Options considered: a scoped editor prototype (selected for this pass); app-wide theme/config merge with component-by-component review; full primitive reinstall. Only the first is being implemented. No global preset switch, font replacement or component reinstall is authorized by this prototype decision. The shared Field primitive receives additive slot metadata only; its global appearance and API remain intact.

## Sequential implementation

1. Inspect the preset through `pnpm dlx shadcn@latest init --preset b27GcrRo --template next` in a temporary existing Next project. Read generated config/theme/controls and compare local owners. Completed; scratch CSS/fonts/components remain outside the application.
2. Introduce one feature-scoped editor stylesheet. Compact 12px labels, clear field spacing, 32px desktop filled controls, 44px touch targets and 16px mobile input text. Preserve native keyboard focus/error states, larger Notes bodies and native date/time/color inputs.
3. Refine the metadata inspector: one scroll region, larger description, inline Status property, grouped type-specific details, nonshrinking Save footer inside the original disabled fieldset/form. Keep header actions in their existing portal and preserve document-editor delegation. Pending state adds a spinner without changing the action label; neutral feedback no longer looks like an error.
4. Refine preset configuration: smaller header, one add action, window-width container queries for the field/preview split. Keep preview cards outside all field selectors so they continue to share the exact canvas renderer. Match nested decision row/control radii without changing any decision logic.
5. Run focused editor/preset/history/Notes/calendar/decision regression suites, scoped TypeScript, changed-file lint and boundaries. Record source checks separately from user-owned responsive/light/dark visual review. Refresh the local Graphify AST once the code is settled.

## Ownership

- Semantic form owner: ParticleMetadataInspector / ParticlePresetEditor; shared FieldLabel is reused elsewhere and is not the global visual-change target.
- Assembly/token owner: `src/features/workspace-particles/components/particle-editor.module.css`; theme colors remain `src/app/globals.css` semantic tokens.
- Linked surfaces: Select popovers and workspace window header portals retain existing shared styling/owners; descendant form styling deliberately excludes them.
- Canvas shell and React Flow behavior: unchanged.

## Review checkpoints

Review an Objective, Notes, Event and Decision inspector in the existing workspace. Check labels, description room, short-window Save visibility, narrow window stacking, touch targets and keyboard focus. Review a configured preset at narrow/wide window sizes; its preview should keep canvas proportions and must not inherit form styles. No authenticated visual approval is claimed from static render tests.

## Applying the complete preset later

For a new project, the template argument is `next`. For this existing application, a complete preset change should use the CLI merge workflow, reviewing config/CSS/fonts and smart-merging customized components. Do not run a forced reinstall over the current controls. No global command was executed in this lane during this pass.

References: [shadcn CLI](https://ui.shadcn.com/docs/cli), [Field composition](https://ui.shadcn.com/docs/components/radix/field). Existing `docs/design.md` governs semantic colors, compact hierarchy, focus visibility and restrained motion; this prototype retains the established rounded Particle/window geometry explicitly requested by the user.
