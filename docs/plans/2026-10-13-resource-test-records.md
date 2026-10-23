# LIVE-03 follow-up: leaked RLS test resources

User reported two production RLS Resource Service entries after confirming PR297 merged:
- 8b2441bf-7acc-4219-b108-142167c18252
- ada4ffc9-20ce-42a6-9d92-02e44fe7ed08

Both public API responses identify RLS Resource Org, description "Public approved test service.", source https://example.org/service, fake phone555-0100 and identical New York coordinates, with no street address. These match supabase/tests/resource-map-rls.mjs exactly. The previous conservative place grouping intentionally requires a street address, but these synthetic records must be excluded rather than merged into a public place.

## Scope

Original packet05 B036/LIVE03, reported production follow-up. Branch fix/public-resource-test-records-20261013 reuses the clean map worktree coach-house-platform-live-map-20261013 on basee49a31bd. PR298/banner preview3116 remains separate and awaiting user review. User owns visual checks; no browser sweep or merge re-verification.

Exclude the exact fixture name/organization/reserved-source signature through the shared public-resource visibility predicate used by index/list/detail/saved hydration. Preserve records with only partial matches and keep real-place grouping unchanged. Advance cached index/detail keys so old fixture bodies are not reused after deployment. No database deletion, migration, provider change or Supabase preview. The existing RLS runner already blocks accidental remote execution unless an isolated project is explicitly selected; do not run it against production to reproduce this.

## Evidence and remaining gates

Four regressions failed before correction: both detail IDs, compact catalog and legacy public RPC. All64focused tests pass after correction, including partial-match safety, real-place grouping, saved aliases and antimeridian coverage. Changed-file ESLint and diff checks pass. No new visual baseline is required for synthetic-data exclusion. Current-head CI/review and deployment remain necessary before claiming the records are gone in production. Retain the database records as evidence; this patch removes their app visibility. Graphify refresh started.

Resume this branch for review findings; keep packet03/LIVE04 in PR298 separate. User will confirm the visible result after deployment.
