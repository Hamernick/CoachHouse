# Workspace objective planner

Objectives, a binary decision and action branches, shared steps, completion, tools
and social cards on the existing particle canvas. State persists through the
authorized board save; AI suggestions are explicit drafts with no tool execution.

See [behavior, limits and AI release boundary](../../../docs/plans/2026-09-16-workspace-objective-planner.md).

## Ownership

- Domain logic: `src/features/workspace-objective-planner/lib/**`
- Server actions/queries: `src/features/workspace-objective-planner/server/**`
- UI components: `src/features/workspace-objective-planner/components/**`
- Hooks/controllers: `src/features/workspace-objective-planner/hooks/**`

## Rules

- Keep route files in `src/app/**` as composition-only wrappers over this feature.
- Import other features only through their public entrypoint (`@/features/<name>`).
- Keep `lib/**` pure: no React, no UI imports, no route imports.
- Keep `server/**` free of UI/component imports.
- Keep shared UI in `src/components/ui/**`; avoid one-off primitives here.
- Keep acceptance coverage in `tests/acceptance/workspace-objective-planner.test.ts`.
- Add acceptance tests for user-visible behavior before merging.
