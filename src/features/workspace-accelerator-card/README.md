# WorkspaceAcceleratorCard Feature

## Ownership
- Domain logic: `src/features/workspace-accelerator-card/lib/**`
- Server actions/queries: `src/features/workspace-accelerator-card/server/**`
- UI components: `src/features/workspace-accelerator-card/components/**`
- Hooks/controllers: `src/features/workspace-accelerator-card/hooks/**`

## Rules
- Keep route files in `src/app/**` as composition-only wrappers over this feature.
- Import other features only through their public entrypoint (`@/features/<name>`).
- Keep `lib/**` pure: no React, no UI imports, no route imports.
- Keep `server/**` free of UI/component imports.
- Keep shared UI in `src/components/ui/**`; avoid one-off primitives here.
- Keep acceptance coverage in `tests/acceptance/workspace-accelerator-card.test.ts`.
- Add acceptance tests for user-visible behavior before merging.

## Workspace window header

Active drawer lessons place their breadcrumbs and previous/counter/next/Close or Done controls into the existing window header title/actions slots. Accelerator returns to the overview with module checklists collapsed; the module breadcrumb returns with that module expanded. Both use the existing close guard and parent module state, without completing lessons or changing progress. The current step is a noninteractive breadcrumb; generic step titles use the step kind to avoid repeating the module title.

Retained-panel scope gates both slots, so inactive lessons cannot publish header content. Empty title targets keep the normal window title until the portal mounts; actual portal content replaces it without a title-registration effect or another state store. Standalone canvas/fullscreen lessons keep their original inline header through WorkspaceAcceleratorStepInlineHeader. Immersive onboarding retains its header-free presentation. Existing lesson transitions, forms, sidebar, assignment footer and controller remain unchanged.
