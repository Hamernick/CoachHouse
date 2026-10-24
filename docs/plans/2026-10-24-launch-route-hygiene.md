# Launch Route Hygiene — O123, O173, O176, O133, O127

Branch: `fix/launch-route-hygiene-20261024`.
Worktree: `/Users/calebhamernick/Development/coach-house-platform-launch-route-hygiene-20261024`.
Base: current main `6e940b13` plus backlog documentation PR #358 (`8d2ed049`).
The implementation PR is stacked on #358 while that documentation PR remains open.

## Approved Order and Checkpoint

1. O123-01 — metadata: development complete; inventory covers every page, excluding breadcrumb slots and explicit redirect/404 aliases. Documentation home inherits its own layout; visual fixtures inherit preview metadata. Added route-specific titles/descriptions to rendering account, workspace, staff and public roadmap pages, completed fiscal/auth descriptions, and blank dynamic-profile/resource fallbacks.
2. O173-01 — sitemap: in progress; add missing status, published resource and public roadmap coverage with bounded pagination.
3. O176-01 — crawler access: pending.
4. O133-01 — broken links: pending.
5. O127-01 — image alternatives: pending.

Each task advances only after focused verification. Development completion is separate from hosted CI, review, merge, deployment and live acceptance. No provider writes or shared SHIP changes are authorized by this lane.

## Verification

O123: `pnpm exec vitest run tests/acceptance/prelaunch-social-metadata.test.ts` — 154 passed. Changed source/test ESLint passed. Route contract passed (existing organization details page now 271/280 lines). Anonymous Googlebot HTML requests to login, signup, password reset, Documentation home, fiscal email verification and status returned 200 with expected titles/descriptions. Local evidence: `/private/tmp/launch-metadata-http.json`. Next webpack server runs on port 3162; log `/private/tmp/launch-route-hygiene-next.log`. No hosted or live acceptance claimed.
