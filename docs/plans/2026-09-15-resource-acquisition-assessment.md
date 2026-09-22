# Resource acquisition inventory assessment

Date: 2026-09-15
Scope: owned provider crawler, draft PR #231. Assessment complete; live operation and production release remain unapproved.

## What the feature does

Given a bounded plan of candidate provider URLs, the command-line crawler checks robots rules, fetches permitted pages, and saves normalized private evidence with resumable receipts. It does not establish that an organization offers a specific service or publish anything to the map. No new end-user interface is included.

## Status by boundary

| Boundary | Verified status | Remaining work |
| --- | --- | --- |
| Product direction | Implements the September 2 executor design: separate planning, bounded collection, private evidence. | No new product decision is needed for this assessment. Live operation remains a separate decision. |
| Saved work | Draft [#231](https://github.com/Hamernick/coach-house-lms/pull/231), open/mergeable, head ad4c554160a6baba02ee0ca22c8e4fde3f7abe87.13 changed files, stacked on draft #229 at4c42e323. Repair worktree is clean. | Preserve the stack; review #229 before any merge. |
| Code readiness | Same-head [CI34874789612](https://github.com/Hamernick/coach-house-lms/actions/runs/34874789612) passed static, acceptance, RLS, build, visual and aggregate quality. Fresh focused run passed20 tests in3 files. | A separate duplicate run has canceled lanes and a failed aggregate; distinguish it from the successful complete run. This assessment is not an exhaustive security audit. |
| Configuration | Existing schema-v2 fetch plan validates and binds to its matching search plan. No paid search or AI key is required by this executor. | Prepare/review a suitably small current plan before any separately authorized live canary. The saved plan dates from the earlier research package. |
| Deployment | The three executor files are absent from current GitHub main d88a0943 and #229; present in #231 and Profile#239. | No merge, production activation or deployment performed. Preview status does not prove crawler execution. |
| Live verification | Fresh dry run performed0 crawl requests, retained0 bytes and made0 AI/paid calls, database writes, review decisions or publications. No owned-crawler receipt/output directory was found in the inspected canonical private EO state. | Live transport/robots/pacing/resume behavior still needs a bounded canary; real evidence then needs the separate provider verification/review/publication process. |

## Versions and preservation

- Review worktree: /Users/calebhamernick/Development/coach-house-platform-pr231-stack-repair-20260910, branch fix/resource-map-stack-base-20260910, HEAD ad4c5541, clean before/after checks.
- Remote feature branch: feat/resource-map-owned-crawler-20260902; draft #231 is based on feat/development-consolidation-20260902 (#229).
- Profile0b6a3f4a and current root working files contain the same executor behavior. The only difference across the three executor files is40 lines of JSDoc/type annotations added in commit78acce88; preserve those annotations during future integration. CLI, network module and crawler tests match #231. The feature is retained in later work, not superseded by a different crawler.
- No application source or private research state was edited during this review.

## Actual feature check

Ran the #231 CLI against the existing local fetch plan with neither network nor write enabled:

    node scripts/resource-map/run-irs-eo-owned-crawler.mjs --fetch-plan <existing-private-fetch-plan.json>

Result:

| Measure | Value |
| --- | ---: |
| Candidate page requests | 46 |
| Planned requests including robots | 92 |
| Actual crawler network requests | 0 |
| Retained bytes | 0 |
| Paid queries / AI calls / database writes | 0 / 0 / 0 |
| Reviewed / published by this run | 0 / 0 |

Plan hash:69afb4a843c59752c493a53716b62d0082c2c58be3856deb35a3e2638ee612cc. Matching parent-plan validation passed. Plan limits:150 total requests,25,000,000 retained bytes,3 provider requests per exact host,1,000,000 bytes per page,256,000 bytes per robots response,15-second request timeout,3 redirects. These are configured ceilings, not observed live performance.

Private inputs remain under data/resource-map/.engine/eo/owned-discovery-v2/discovery-00001-b375916a767e/ and search-v2/discovery-00001-b375916a767e/. Do not edit their hashes/receipts by hand or expose candidate URLs as public resources.

The older queue report is dated2026-09-01T15:39:19.769Z:824,608 eligible,250 queued,98 completed stage results (38 evidence_fetched,8 website_matched,52 held). These are historical queue states, not counts of field-complete, verified or publishable public services. The full queue was not rescanned.

## Safeguards inspected

Source and targeted tests cover plan/parent hash binding; explicit network/write/hash-confirmation gates; public-address DNS and redirect checks; pinned socket lookup; robots decisions; request/byte limits; private mode0600 writes; hash-chained resumable receipts; and publicationBlocked/publicDisplayEligible flags. SHA-256 hashes provide consistency checks; they are not cryptographic approval signatures or an OS sandbox.

The required next content stages remain provider identity confirmation, evidence-backed service/location/access extraction, independent comparison, administrator review, controlled import/publication, and public API/map verification. IRS identity, filing address and taxonomy alone do not establish an actionable service.

## Assessment outcome

**Saved and tested internal tooling; no live acquisition/publication readiness claim.** No functional difference requiring reimplementation was found between #231 and the later local copy. No live canary was attempted. Next inventory feature: Workspace Documents (#238, with Profile#239 inheritance).
