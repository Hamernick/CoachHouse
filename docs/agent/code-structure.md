# Code Structure Contract

## Goals

- Keep module ownership obvious.
- Keep naming consistent and searchable.
- Prevent new monolith components from accumulating.
- Preserve route/API behavior during refactors.

## Ownership Rules

- Put globally reusable UI in `src/components/**`.
- Put route-private UI in route-local `src/app/**/_components/**`.
- Keep data/business logic in `src/lib/**` and server actions in `src/actions/**` or route-local action files.
- Prefer feature folders over catch-all `shared` growth.
- Scaffold new feature slices with `pnpm scaffold:feature <kebab-name>` under `src/features/**` instead of ad hoc folder structures.

## Feature Slice Contract

- Each feature lives at `src/features/<kebab-name>/`.
- Required files/directories:
  - `README.md`
  - `index.ts` (public entrypoint only)
  - `types.ts`
  - `components/index.ts`
  - `lib/index.ts`
  - `server/actions.ts`
  - `tests/acceptance/<feature-name>.test.ts[x]` (feature acceptance baseline)
- A feature may expose `client.ts` as a narrow client-safe public entrypoint when
  its root entrypoint also exports server-only modules.
- A feature may expose `server.ts` as a narrow public entrypoint for server queries
  and server-rendered composition. It must include `import "server-only"`; client
  modules must not import it. This avoids loading unrelated client exports from a
  mixed root barrel while preserving feature boundaries.
- Enforced by `scripts/check-feature-contract.mjs` via `pnpm check:features`.
- Scaffold/contract sync is enforced by `scripts/check-feature-scaffold-sync.mjs` via `pnpm check:feature-scaffold`.
- Cross-feature imports must use public entrypoints only (`@/features/<name>` or
  `@/features/<name>/client` or `@/features/<name>/server`), not deep internals.
- Feature code must not import from `src/app/**` route modules.
- `lib/**` must stay framework-agnostic (no React/UI imports).
- `components/**` cannot import `server/**`; `server/**` cannot import `components/**`.

## Route Entrypoint Contract

- Enforced by `scripts/check-route-entry-contract.mjs` via `pnpm check:routes`.
- Applies to `src/app/**/(page|layout|template|loading|error|not-found).tsx`.
- `page.tsx` and `layout.tsx` are server-first composition wrappers and may not declare `"use client"`.
- Route entrypoints must not import/re-export other route pages directly; shared logic belongs in `src/features/**`, `src/lib/**`, or shared components.
- Route size budget for `page.tsx`/`layout.tsx`: 280 lines.
- Temporary route-size allowlist is locked to max `0` and guarded by threshold checks (no exceptions by default).

## Import Boundaries

- Enforced by `scripts/check-import-boundaries.mjs` via `pnpm check:boundaries`.
- `src/components/ui/**` may only import from:
  - `@/components/ui/**`
  - `@/lib/**`
  - `@/hooks/use-mobile` (current narrow exception)
- `src/lib/**` and `src/actions/**` may not import from:
  - `@/components/**`
  - `@/app/**`
- `src/components/**` (non-`ui`) may not import route modules from `src/app/**` except action modules.
- Route-private modules (`_components`, `_lib`) may not be imported outside `src/app/**`.
- Imports from `src/features/**` must use feature public entrypoints
  (`@/features/<name>`, `@/features/<name>/client`, or the marked
  `@/features/<name>/server` facade) outside feature modules;
  deep imports are disallowed.
- Workspace persistence boundary is table-only; do not reintroduce legacy profile keys (`workspace_board_v1`, `workspace_collaboration_v1`) in runtime source.

## Naming Rules

- Use kebab-case for component and style filenames.
- Use semantic names based on domain/purpose; avoid numeric iteration suffixes (`foo2`, `v3`, `new-*`) in long-lived modules and routes.
- Avoid same-name shim files that only re-export a sibling folder (`foo.tsx` + `foo/` with pure export pass-through). Prefer `foo/index.ts` directly.
- Allowed neutral names:
  - `index.ts` (barrel files)
  - `types.ts` (local type containers)
- Keep route entrypoint conventions unchanged (`page.tsx`, `layout.tsx`, `route.ts`, etc.).

## Size And Decomposition

- Target component file budget: 500 lines max.
- Existing exceptions are temporarily allowlisted only when actively under refactor.
- Any new file crossing the budget must be split in the same PR unless explicitly allowlisted.
- Treat 350+ lines as a decomposition warning threshold (split early, before hard cap pressure).
- The enforcement script (`scripts/check-structure-conventions.mjs`) is the source of truth for temporary allowlist entries.
- The enforcement script also blocks new pure re-export same-name shim files unless explicitly allowlisted.
- Threshold increases are blocked by `scripts/check-threshold-regression.mjs` against `docs/agent/quality-threshold-baseline.json`; lower-only ratcheting is the default direction.
- ESLint complexity gates are hard-enforced for `src/**`:
  - `complexity`: `130`
  - `max-lines-per-function`: `350`
  - `max-lines`: `600`
- These ESLint caps are a high-watermark baseline to prevent regression while active decomposition continues; ratchet downward as hotspots are reduced, never upward without explicit runlog rationale.

## Refactor Safety Rules

- Do not change route paths as part of structural refactors.
- Do not change API response shapes as part of structural refactors.
- Keep temporary compatibility re-exports when moving modules, then remove after all imports migrate.
- Separate move/rename commits from behavior changes where possible.

## Validation

- Required:
  - `pnpm lint`
  - `pnpm test:snapshots`
  - `pnpm test:acceptance`
  - `pnpm test:rls`
- Structural guard:
  - `pnpm check:structure`
  - `pnpm check:routes`
  - `pnpm check:features`
  - `pnpm check:thresholds`
  - `pnpm check:boundaries`
  - `pnpm check:workspace-storage`
