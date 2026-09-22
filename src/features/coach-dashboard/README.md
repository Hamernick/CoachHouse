# CoachDashboard Feature

## Ownership

- Domain logic: `src/features/coach-dashboard/lib/**`
- Server actions/queries: `src/features/coach-dashboard/server/**`
- UI components: `src/features/coach-dashboard/components/**`
- Hooks/controllers: `src/features/coach-dashboard/hooks/**`

## Rules

- Keep route files in `src/app/**` as composition-only wrappers over this feature.
- Import other features only through their public entrypoint (`@/features/<name>`).
- Keep `lib/**` pure: no React, no UI imports, no route imports.
- Keep `server/**` free of UI/component imports.
- Keep shared UI in `src/components/ui/**`; avoid one-off primitives here.
- Keep acceptance coverage in `tests/acceptance/coach-dashboard.test.ts`.
- Add acceptance tests for user-visible behavior before merging.

## Dashboard behavior

`/admin/dashboard` is restricted to platform coaches and admins. The Admin label links here; its adjacent chevron independently toggles navigation. Existing `/admin` organization access management is preserved.

The server loader scopes organizations, open projects, and activity to the signed-in coach’s assignments. Personal tasks reuse the authorized Tasks loader. Counts are database totals; lists are bounded. The heatmap shows recorded project activity by UTC day, not login or general platform usage. A capped history is labeled. Unavailable sources surface errors rather than fabricated data.

Calendar and Drive reuse existing workspace connection controls and organization scope. No provider changes occur until a user explicitly operates those controls. Read-only dashboard data refreshes on focus and every minute while visible.
