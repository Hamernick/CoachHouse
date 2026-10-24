# WorkspaceManagement Feature

## Ownership
- Domain logic: `src/features/workspace-management/lib/**`
- Server actions/queries: `src/features/workspace-management/server/**`
- UI components: `src/features/workspace-management/components/**`
- Hooks/controllers: `src/features/workspace-management/hooks/**`

## Rules
- Keep route files in `src/app/**` as composition-only wrappers over this feature.
- Import other features only through their public entrypoint (`@/features/<name>`).
- Keep `lib/**` pure: no React, no UI imports, no route imports.
- Keep `server/**` free of UI/component imports.
- Keep shared UI in `src/components/ui/**`; avoid one-off primitives here.
- Keep acceptance coverage in `tests/acceptance/workspace-management.test.ts`.
- Add acceptance tests for user-visible behavior before merging.

## Named canvas behavior

Workspace's sidebar action creates a named canvas inside the active organization.
Names are trimmed, 1–80 characters, rendered as text, and editable with the
sidebar options menu. Named canvases can be deleted after confirmation; the main
canvas remains attached to the organization. No public-sharing flow is introduced.

The existing default board remains in `organization_workspace_boards.state`.
Additional canvases live in its versioned `workspaceCatalog` collection with
independent board state. The existing table's organization RLS applies; create
and rename additionally require the server-resolved owner/admin/staff or platform
admin role and matching active organization. The named-canvas calendar guard migration
`20261019200000` must be installed before creation or renaming is enabled. It extends
the existing calendar permission/revision trigger without moving source data.
Every board writer merges only its selected canvas and preserves the catalog,
using the row's updated_at compare-and-swap. Creation uses a client-generated
stable UUID for idempotent retries; rename checks the previous name. Unknown IDs
never fall back to the main board. Existing data is never moved during creation.

`?workspace=<uuid>` selects a canvas. Default routes stay unchanged. Canvas keys,
viewport preferences and cursor rooms include the selected ID; Particle graph
workspaceId remains the organization/source authorization boundary. Notes and
Calendar read all organization canvases; note edits resolve the saved canvas and
calendar links retain its ID. Navigation uses client transitions and retains the shell-owned catalog while the
canvas changes. A cancelable beforeunload probe reuses mounted editor draft guards
and opens the app discard dialog before switching. Modified clicks retain normal
new-tab behavior. Leaving the workspace route clears the retained catalog.

Validation: workspace-management.test.ts covers permissions, naming, idempotency,
rename conflicts, original/sibling preservation and concurrent board writes.

The three-dot menu opens Edit, Invite people and Delete. Delete is a server-authorized
CAS catalog update, rejects stale names, preserves siblings and rejects stale writes
to a deleted canvas. The confirmation explains the permanent canvas deletion.
Invite reuses the existing organization team/collaboration flow and entitlement
checks. Access remains organization-wide and the panel says so; no per-canvas
privacy or membership enforcement is claimed.
