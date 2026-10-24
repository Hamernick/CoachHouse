# Launch Route Hygiene — O123, O173, O176, O133, O127

Branch: `fix/launch-route-hygiene-20261024`.
Worktree: `/Users/calebhamernick/Development/coach-house-platform-launch-route-hygiene-20261024`.
Base: current main `6e940b13` plus backlog documentation PR #358 (`8d2ed049`).
The implementation PR is stacked on #358 while that documentation PR remains open.

## Approved Order and Checkpoint

1. O123-01 — metadata: development complete; inventory covers every page, excluding breadcrumb slots and explicit redirect/404 aliases. Documentation home inherits its own layout; visual fixtures inherit preview metadata. Added route-specific titles/descriptions to rendering account, workspace, staff and public roadmap pages, completed fiscal/auth descriptions, and blank dynamic-profile/resource fallbacks.
2. O173-01 — sitemap: development complete; status plus published profiles/resources/roadmaps enumerated through a sitemap index. Static sitemap stays database-independent.
3. O176-01 — crawler access: in progress.
4. O133-01 — broken links: pending.
5. O127-01 — image alternatives: pending.

Each task advances only after focused verification. Development completion is separate from hosted CI, review, merge, deployment and live acceptance. No provider writes or shared SHIP changes are authorized by this lane.

## Verification

O123: `pnpm exec vitest run tests/acceptance/prelaunch-social-metadata.test.ts` — 154 passed. Changed source/test ESLint passed. Route contract passed (existing organization details page now 271/280 lines). Anonymous Googlebot HTML requests to login, signup, password reset, Documentation home, fiscal email verification and status returned 200 with expected titles/descriptions. Local evidence: `/private/tmp/launch-metadata-http.json`. Next webpack server runs on port 3162; log `/private/tmp/launch-route-hygiene-next.log`. No hosted or live acceptance claimed.


### O173 Evidence and Catalog Decision

45 focused sitemap/origin/community tests passed; affected lint passed. TypeScript check started before the final key-range adjustment passed; final changed-code type check remains at handoff. Local HTTP: static sitemap 200 with 62 URLs; index 200 with 20,002 child sitemaps (1,689,152 bytes); published profile page 200 with 24 URLs; nonprofit key ranges 0 and 19,000 returned 2 and 4 published URLs. Resource/roadmap sharing flags are disabled in this local environment; their enabled behavior is covered by focused tests, not claimed as live acceptance.

An exact count on the nonprofit visibility view exceeded the request deadline. Use 20,000 fixed numeric EIN ranges, each containing at most 50,000 possible URLs, and keyset batches of 500 within each range. This deliberately includes empty ranges, avoids full-table counts/deep offsets, and cannot silently truncate a growing catalog. No migration or provider mutation. Profile/resource/roadmap catalogs use bounded 500-row pages. Roadmap enumeration uses the same explicit `is_public_roadmap` flag as its page. Database failures return uncached 503; robots advertises the independent static sitemap as well as the index. Published projections and existing visibility filters exclude suppressed/claimed directory identities, private profiles, Wikidata and known fixtures.
