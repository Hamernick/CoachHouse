# Find Resource Index Feature

## Ownership

- Domain logic: `src/features/find-resource-index/lib/**`
- Server queries: `src/features/find-resource-index/server/**`
- API route composition: `src/app/api/public/resource-map/index/**`

## Rules

- Keep route files in `src/app/**` as composition-only wrappers over this feature.
- Import other features only through their public entrypoint (`@/features/<name>`).
- Keep `lib/**` pure: no React, no UI imports, no route imports.
- Keep `server/**` free of UI/component imports.
- Keep the index transport compact and public-safe. Detail-only fields belong to
  the separate resource detail contract.
- Bump the response version whenever paging semantics change.
- Legacy v2 pages remain ordered by public item ID. Bounded v3 queries use the
  shared search ranking over the ID-ordered snapshot and return the last item ID
  as a cursor. Clients restart pagination when the snapshot revision changes.
- Share one five-minute server snapshot across page URLs so traversal does not
  repeat the complete public resource query for every page.
- Reuse the existing public full-item sanitizer for detail lookup. Never return
  the cached raw item directly from an API route.
- Cache each sanitized detail response separately; the complete raw dataset is
  larger than Next.js's per-entry data-cache limit.
- Resolve production details by exact ID from the existing anonymous sanitized
  view. Never query raw import or curation tables for this route.
- Keep the existing full-item endpoint unchanged until detail-on-demand is
  available.
- Keep acceptance coverage in `tests/acceptance/find-resource-index.test.ts`.

## Bounded v3 queries

`mode=directory` accepts `q`, `category`, `guide`, `limit` (default 24) and an
optional item-ID `cursor`. `mode=map` additionally requires `bounds=west,south,east,north`
and caps each viewport response at 500 markers; the UI asks users to zoom in when
there are more. Null-coordinate resources remain searchable in the directory.

The server reads only index columns from the sanitized view in cached 500-row
keyset batches. One five-minute in-process compact snapshot supplies filtering,
category counts and guide summaries across requests. This removes full-catalog
client downloads and per-page exact-count queries; it is not a replacement for
a database search/spatial index at national scale. No raw candidate data is used.

Client query caches are bounded, deduplicate concurrent work, revalidate with
ETags, and append pages only after user action. Viewport changes debounce after
moveend; search and viewport requests are independent. Selected/saved resource
details load by ID. Existing map instances are retained across query changes.

## Unified directory presentation

Published nonprofit identities now feed the same bounded list and profile selection
as curated resources through `nonprofit-map-item.ts`. `nonprofit:<EIN>` IDs and an
explicit provenance field distinguish them internally; no filing address becomes a
pin or verified service. The IRS notice lives in the profile, not a separate results
section. One Load more control advances independent bounded cursors.

`/api/public/nonprofits/summary` returns only a cached planned count of the public
projection, explicitly estimated. The Active badge adds platform and curated totals;
searches do not change it. The source import/publication workstream owns record and
category publication; this UI consumes its existing public RPCs without mutations.
