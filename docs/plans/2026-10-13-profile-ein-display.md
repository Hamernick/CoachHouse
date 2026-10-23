# Run 05A — Public profile EIN display

Requirement U20261013-02; original Desktop packet `05a-profile-ein-display.md`, parent packet05. User started sequential implementation on October13 and requested an isolated branch/new localhost.

## Scope and implementation

Show each public organization's existing valid EIN once as `XX-XXXXXXX`. Preserve leading zeroes; omit missing/malformed values. IRS directory EIN moves from Record details to the identity section. Platform profiles project the canonical organizations.ein column. Curated resource details retrieve only id/ein by exact organization ID after public visibility checks, retaining published/reviewed/approved/not-hidden/not-suppressed/not-deleted gates. No name matching, private profile dump or new data collection. Refresh affected profile/detail cache versions.

Shared identity components cover standalone profiles and detail panels. Individual-person profiles are unchanged. No addresses, geocoding, database writes/migrations or Supabase preview branches. User subsequently approved EIN placement and explicitly requested the blue EIN check in this component; that scoped05B presentation is included in this PR. Coordinate run05C remains separate.

## Lane and review

- Branch: `feat/profile-ein-display-20261013`; base `f54a5fe05d92536aaf13a67b0fe9436e279baa0b`.
- Worktree: `/Users/calebhamernick/Development/coach-house-platform-profile-ein-20261013`.
- Localhost: http://localhost:3121/visual-regression/profile-ein (guarded development preview using actual public records and the actual shared identity components).
- Full profiles: http://localhost:3121/coachhousesolutionsgroup and http://localhost:3121/find/resources/146024895.
- Node22; isolated .next. Shared env is read-only; raw resource preview/discovery explicitly disabled at launch.
- User approved EIN placement/formatting, then requested a blue check immediately left of the centered EIN. The inline badge/text group inherits the existing alignment. Badge hover/keyboard-focus explanation: “EIN on file”; it confers no tax-status, formation, access or service-verification status. User approved the final centered badge and requested public release. No visual baselines changed. No broad browser/screenshot sweep.

## Validation

70 tests pass across public-profile-ein, public-map-index-query, resource-map-public-items-query, resource-map-test-fixture-visibility and public-profiles. Covers formatting, canonical identity mapping, publication gates, missing values and no duplicate EIN rendering. Changed-file lint, boundaries, structure, features, routes, thresholds and diff hygiene pass. Acceptance manifest updated; Graphify AST update complete.

Actual preview rendered both EINs; both full profiles returned200 with their respective formatted EIN. Initial full-route requests timed out during compilation; subsequent compiled requests succeeded.

Full TypeScript check remains failed:54 errors in11 unchanged acceptance test files (map fixtures, mission/vision and quality-runner fixtures); no diagnostics in changed source/new test. This is not a clean full quality result. Required hosted quality, code-owner review and branch protection remain release gates. Merge, deployment and production verification are not performed or inferred.

## SHIP and stop boundary

Canonical shared claim remains revision40 with an old-host ownership mismatch (`Calebs-MacBook-Pro-2.local` versus `Calebs-MBP-2`). Do not edit canonical state or bypass ownership guards. Local implementation is explicitly user-authorized; shared runner reconciliation remains required before recording a new release claim. Preserve released SHIP000 history, PR299 coordinate-repair hold and historical PR300 quality/review gaps.

Stop at the user-requested EIN/check review and handoff. Coordinate coverage and broader formation/access policy changes remain separate.

## Release preparation follow-up

User approved final appearance and public release. PR301 head0dabc8ac passed hosted static/RLS/build; acceptance failed only an unchanged curation contract expecting old cachev8 instead of intentionalv9. Updated that expectation;20 focused EIN/curation tests pass. Final-head hosted quality and required code-owner review remain mandatory. Shared SHIP revision40 ownership blocker is unchanged. No merge/deployment is claimed.
