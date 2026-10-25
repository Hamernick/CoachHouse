# WorkspaceBrandKit Feature

## Ownership
- Domain logic: `src/features/workspace-brand-kit/lib/**`
- Server actions/queries: `src/features/workspace-brand-kit/server/**`
- UI components: `src/features/workspace-brand-kit/components/**`
- Hooks/controllers: `src/features/workspace-brand-kit/hooks/**`

## Rules
- Keep route files in `src/app/**` as composition-only wrappers over this feature.
- Import other features only through their public entrypoint (`@/features/<name>`).
- Keep `lib/**` pure: no React, no UI imports, no route imports.
- Keep `server/**` free of UI/component imports.
- Keep shared UI in `src/components/ui/**`; avoid one-off primitives here.
- Keep acceptance coverage in `tests/acceptance/workspace-brand-kit.test.ts`.
- Add acceptance tests for user-visible behavior before merging.

## Internal Brand Identity editor

The profile editor reuses the Documentation Brand Identity sections. Its controlled draft participates in organization Save/Cancel; private original files use the existing Documents library. The complete kit lives in `organization_brand_kits` under RLS, with an atomic profile/kit save and revision checks. Do not put kit drafts, private file metadata, or signed URLs into the publicly readable organization profile. Apply `20261021200000_private_organization_brand_kits.sql` before enabling saves. Existing public brand fields retain their established behavior.
