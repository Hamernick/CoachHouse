# CoachHouseCompanion Feature

## Ownership
- Domain logic: `src/features/coach-house-companion/lib/**`
- Server actions/queries: `src/features/coach-house-companion/server/**`
- UI components: `src/features/coach-house-companion/components/**`
- Hooks/controllers: `src/features/coach-house-companion/hooks/**`

## Rules
- Keep route files in `src/app/**` as composition-only wrappers over this feature.
- Import other features only through their public entrypoint (`@/features/<name>`).
- Keep `lib/**` pure: no React, no UI imports, no route imports.
- Keep `server/**` free of UI/component imports.
- Keep shared UI in `src/components/ui/**`; avoid one-off primitives here.
- Keep acceptance coverage in `tests/acceptance/coach-house-companion.test.ts`.
- Add acceptance tests for user-visible behavior before merging.
