# TypeScript follow-up before release

The full October10 TypeScript run failed: 128 diagnostics across 35 test files; no `src/` diagnostics were emitted. This is not a passing type-check.

The guide test loop and viewport optional-value types were corrected during the publication follow-up. A full rerun and the remaining fixture/type repairs are deferred to the final verification pass; do not describe these remaining errors as proven unrelated or pre-existing without comparing the release base. No source type contract was weakened to make test fixtures pass.

Affected files from that run:

- `tests/acceptance/acceptance-test-projects.test.ts`
- `tests/acceptance/billing-checkout-button.test.ts`
- `tests/acceptance/documents-index-row-sorting.test.ts`
- `tests/acceptance/fiscal-sponsorship-w9.test.ts`
- `tests/acceptance/mission-vision-values-unification.test.ts`
- `tests/acceptance/nonprofit-documentation-sitemap.test.ts`
- `tests/acceptance/onboarding-pricing-step.test.ts`
- `tests/acceptance/public-map-actions.test.ts`
- `tests/acceptance/public-map-cluster-runtime.test.ts`
- `tests/acceptance/public-map-index-helpers.test.ts`
- `tests/acceptance/public-map-index-map-view-helpers.test.ts`
- `tests/acceptance/public-map-marker-fallbacks.test.ts`
- `tests/acceptance/public-map-organization-detail-helpers.test.ts`
- `tests/acceptance/public-map-organization-detail-sections.test.ts`
- `tests/acceptance/public-map-organization-list-react-grab.test.ts`
- `tests/acceptance/public-map-resource-items-client.test.ts`
- `tests/acceptance/public-map-resource-links.test.ts`
- `tests/acceptance/public-map-resource-map-items.test.ts`
- `tests/acceptance/public-map-search-index.test.ts`
- `tests/acceptance/public-map-sidebar-layout.test.ts`
- `tests/acceptance/public-map-webgl-data.test.ts`
- `tests/acceptance/quality-gate-runner.test.ts`
- `tests/acceptance/resource-map-brooklyn-nonprofit-directory.test.ts`
- `tests/acceptance/resource-map-cook-county-immigrant-resources.test.ts`
- `tests/acceptance/resource-map-data-engine.test.ts`
- `tests/acceptance/resource-map-feeding-illinois.test.ts`
- `tests/acceptance/resource-map-metro-chicago-shelters.test.ts`
- `tests/acceptance/resource-map-public-items-query.test.ts`
- `tests/acceptance/workspace-accelerator-card-panel.test.ts`
- `tests/acceptance/workspace-accelerator-runtime-snapshot.test.ts`
- `tests/acceptance/workspace-accelerator-step-node-card.test.ts`
- `tests/acceptance/workspace-board-card-frame.test.ts`
- `tests/acceptance/workspace-board-node-card-accelerator-support.test.ts`
- `tests/acceptance/workspace-canvas-card-readiness.test.ts`
- `tests/acceptance/workspace-setup-guide.test.ts`
