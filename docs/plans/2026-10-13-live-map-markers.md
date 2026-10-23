# LIVE-03: public resource places and marker bounds

## Boundary

Source: original packet 05, B036/O036-01, stage 3 and scoped stage 6. Caleb explicitly continued from the onboarding repair and identified `/resources`; `/map` and `/find` remain legacy redirects. This slice fixes query bounds and confirmed duplicate places. Separate locations, services, saved links and publication gates must survive. Acquisition, geocoding, data/provider mutations, verification policy, redesign and other priorities are outside this slice.

Branch `fix/live-map-markers-20261013`, base `89c409bcede47421be909cdd85c2936120b2ae30`, worktree `coach-house-platform-live-map-20261013`. Preview: http://localhost:3115/resources?q=Legler. Only this lane's server was started/restarted. It uses published database rows with raw local preview/discovery explicitly disabled; the shared environment file is unchanged.

## Findings and implementation

- Two screen-corner samples can exclude visible geographic extrema, especially on the globe. Observed requests capped north at 35.973, below Chicago. Use Mapbox projection-aware bounds for globe/other projections, all four corners for Mercator, outward rounding and resize updates.
- Legler Regional Library is published separately for library and food assistance at the same address with nearby coordinates. Group only published records with matching normalized names/street/locality/country, compatible provider and verification status, and coordinates within 60m of every member. Units and distinct locations stay separate. Current published snapshot: 877 source entries become 875 place listings; this establishes only two safe consolidations.
- Union categories before search/counts/pagination. Preserve old resource IDs for saved lists/deep links. Detail requests recheck current publication/address membership and retain each service's hours, eligibility and access information. Do not assign one service's hours to the whole place. Catalog failure preserves individual detail access.
- Current browser confirms one Legler place, both service descriptions/schedules, and one normalized phone contact. The similarly named Tucson nonprofit remains separate and has no invented coordinates.

## Evidence and remaining gates

57 focused tests pass across map bounds, grouping, detail behavior and existing index/public-query coverage. Changed-file lint, structure, features, thresholds, boundaries and diff checks pass. Graphify AST update completed. Full `tsc --noEmit` still fails in unchanged generated route/test files; no diagnostics reference changed source or the new tests. No full local quality run was performed.

The local map canvas remains blank blue during normal UI review, so visible marker rendering is **not verified** and LIVE-03 is not complete. Raw browser network diagnostics were denied and were not retried. Continue with permitted normal UI/source investigation; do not infer a provider cause. Screenshot evidence is on Desktop/Coach House Map Review. Service rows use existing layout; no baseline update or appearance approval is asserted. Current-head hosted quality, code-owner review, merge, deployment and live marker verification remain required.

## Previous release reconciliation

PR296 externally merged as base89c409bc. The intended coachhouse Production deployment HruY5bkCQ9FYce2f1hpJ7TAr6KFt is Ready and assigned coachhouse.app. Static/acceptance/RLS/build passed; visual/aggregate quality failed and review remained REVIEW_REQUIRED. This also contains PR295. User's username workaround passed, but fresh validation/checkout-return/menu production checks are not asserted. Historical appearance/Collect/SHIP gates remain open. This map implementation preparation is the next explicitly authorized bounded run; it does not rewrite those releases.

## Antimeridian review correction

Review of23896c39 correctly identified reversed longitude coverage when Mercator corners wrap from179 to-179. Three regressions reproduced the failure, including500off-screen places excluding both visible date-line markers. Unwrap corners around the visible screen center, then serialize the wrapped interval. Using the center also distinguishes a narrow date-line crossing from a genuinely wide340-degree viewport; explicit whole-world coverage is retained. Four added cases cover both sides of the date line, the500-marker limit, wide views and whole-world bounds. All57focused tests and changed-file lint pass. No appearance/provider changes in this correction.

Prior headf3818775 passed static/acceptance/RLS/build but failed visual/aggregate quality and remained REVIEW_REQUIRED. Fresh current-head CI/review is still required after the correction. The pre-existing local blank-map verification gap remains open.

## Review and backup

[PR297](https://github.com/Hamernick/CoachHouse/pull/297) is Ready for review, not merge-ready. Implementation23896c39 was pushed and its remote SHA verified; normal pre-push passed. CI and code-owner review remain pending. The active branch/PR provides the current head; the original SHIP000 released head is unchanged.

## Resume

Inspect branch/status/remote head and this plan, then the Desktop SHIP record and original packet05. Finish the unresolved visible map rendering check, address current-head CI/review findings, and obtain appearance review before replacing visual references. Stop before claiming release until the actual gates pass. Preserve unrelated root/worktrees/servers and the completed roster correction.
