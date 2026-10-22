# Workspace Objectives Feature

## Ownership
- Domain logic: `src/features/workspace-objectives/lib/**`
- Server actions/queries: `src/features/workspace-objectives/server/**`
- UI components: `src/features/workspace-objectives/components/**`

## Rules
- Keep route files in `src/app/**` as composition-only wrappers over this feature.
- Import other features only through their public entrypoint (`@/features/<name>`).
- Keep `lib/**` pure: no React, no UI imports, no route imports.
- Keep `server/**` free of UI/component imports.
- Keep shared UI in `src/components/ui/**`; avoid one-off primitives here.
- Keep acceptance coverage in `tests/acceptance/workspace-objectives.test.ts`.
- Add acceptance tests for user-visible behavior before merging.

## Scope
- Source objective data from normalized workspace objective tables.
- Fallback read path from legacy `organization_workspace_boards.state.tracker` during migration window.
- Provide server actions for objective load/create/status updates.

## Canvas Objectives island

`@/features/workspace-objectives/client` exposes `ObjectivesIsland`. It receives the
current actor/organization scope and edit permission, and sits at the canvas top
center. Expand to load existing objectives, create a custom objective, edit its
title/details/status, and inspect saved steps. Custom steps can be completed here;
source-managed objectives and steps remain controlled by their lesson/document.

Server actions authenticate the actor and active organization independently of
client scope. Updates constrain organization, custom ownership and expected
`updated_at`; stale edits keep their original baseline instead of silently
rebasing on Refresh. A refresh failure after acknowledgment does not retry a
successful create. Collapsing retains drafts; changing actor/organization resets
the entire boundary. Existing tables and RLS are reused; no new migration is
needed for this initial UI slice.

This is the first visible increment of the objective-led plan in
`docs/plans/2026-10-22-workspace-ai-plan.md`, section5. Multiple editable plans,
branch-aware progress, related-plan links and synchronized canvas trees remain
unfinished. Do not treat the existing linear source steps as completed plan/tree
support. Browser fixture `/?objectives` is fictional and simulates persistence;
server-action tests separately cover scope and optimistic-write constraints.
