# Build and Collect Navigation

Owns the public Collect/Build navigation, the `/build` landing surface, and the
public marketing home page at `/`. Explore leads to `/resources`, which contains the map,
directory, profiles, guides, and collection/search dock. Home retains the shared
header and small Privacy Policy, Terms, and About controls. Its unframed, server-rendered body introduces Collect NFPs (find, save, and share nonprofits), Workspace, the Accelerator, Executive Coaches, and public documentation with static aspect-ratio media placeholders and the theme-aware Coach House logo above the hero title. The header owns the client-only login/theme interactions.
Legacy `/map` and `/find` links redirect to `/resources` with query parameters.

## Ownership

- Domain logic: `src/features/build-collect-navigation/lib/**`
- Server boundary: `src/features/build-collect-navigation/server/**`
- UI components: `src/features/build-collect-navigation/components/**`

## Rules

- Keep route files in `src/app/**` as composition-only wrappers over this feature.
- Import other features only through their public entrypoint (`@/features/<name>`).
- Keep `lib/**` pure: no React, no UI imports, no route imports.
- Keep shared UI in `src/components/ui/**`; avoid one-off primitives here.
- Keep acceptance coverage in `tests/acceptance/build-collect-navigation.test.ts`.
- Add acceptance tests for user-visible behavior before merging.

## Current homepage checkpoint

Implementation and review checklist: [homepage product journey](../../../docs/plans/2026-10-09-homepage-product-journey.md). The homepage copy and linked public fiscal sponsorship page are local. The Collect media frame now contains a lazy-mounted, list-only resource preview using the existing directory index and nonprofit search. It never mounts Mapbox. The inline dock uses shared search/collection styling. Resource links open existing profile routes. A bounded signup/sign-in panel reuses the existing auth forms and consent flow; a public identifier and query retain the pending collection through confirmation. Saves use the authenticated account preferences endpoint and show success only after persistence. Other media placeholders remain blank. Workspace exploration links to public `/build`; Accelerator options link to `/pricing`; booking explicitly requires sign-in.

## Public Workspace page

`/build` now uses the homepage presentation primitives and server-rendered feature/support sections, with shared pricing near the bottom. The public Build menu targets `#workspace`, `#accelerator`, `#documentation`, and `#pricing`; stable item IDs retain the Hairline figures independently of URLs. Actual Workspace, documentation and application routes remain separate destinations. A small page-scoped client helper coordinates section focus, URL history and reduced-motion-aware scrolling beneath the responsive sticky header. No authenticated Workspace or map preview is loaded by the page.

See [Workspace page plan](../../../docs/plans/2026-10-11-workspace-public-build-page.md). The shared free pricing tier now describes profile/application access only; paid prices retain the existing display values. Provider billing verification and supported-environment visual baselines remain release work.
