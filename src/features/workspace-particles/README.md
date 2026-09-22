# WorkspaceParticles Feature

Linked roadmap sections, Google Drive references, and private images on the workspace canvas. Catalog tiles and roadmap grips support drag-to-add; selected cards offer Icon, Mini, and Large views. Layout and connections persist with the organization board; original content stays in its source.

See [behavior, limits, and release checks](../../../docs/workspace-particles.md). The `client` entrypoint exposes canvas UI, the controller, and pure state helpers; the root entrypoint exposes server image handlers through the actions facade. Google Picker is injected by route composition.

## Ownership

- Domain logic: `src/features/workspace-particles/lib/**`
- Server actions/queries: `src/features/workspace-particles/server/**`
- UI components: `src/features/workspace-particles/components/**`
- Hooks/controllers: `src/features/workspace-particles/hooks/**`

## Rules

- Keep route files in `src/app/**` as composition-only wrappers over this feature.
- Import other features only through their public entrypoint (`@/features/<name>`).
- Keep `lib/**` pure: no React, no UI imports, no route imports.
- Keep `server/**` free of UI/component imports.
- Keep shared UI in `src/components/ui/**`; avoid one-off primitives here.
- Keep acceptance coverage in `tests/acceptance/workspace-particles.test.ts`.
- Add acceptance tests for user-visible behavior before merging.
