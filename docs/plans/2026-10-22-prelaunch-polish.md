# B115 prelaunch polish — October 22

## Current release status — October 22

Merged and deployed in the production release confirmed by Caleb at PR351 / `4ca66f42`. [Authoritative release receipt and source-list count](2026-10-22-retire-public-prototypes.md#current-status--october-22-merged-and-deployed). Earlier handoff and failed-deployment notes below are historical; do not reopen completed work.

## Scope and recovery

Original packet: `02-security-infrastructure-launch.md`, stage 5 (launch hygiene), bounded by the user's attached five-item goal. Implement default/status metadata, branded social sharing, custom 404 recovery, `/build` sitemap coverage, and preview noindex only.

- Branch: `fix/prelaunch-polish-20261022`
- Worktree: `/Users/calebhamernick/Development/coach-house-platform-prelaunch-polish-20261022`
- Base: `40a1cf92` from freshly fetched `origin/main`
- Preview: `http://localhost:3142`; Node 22 / Turbopack; task-local locked dependencies and `.next`, existing environment symlinked. Initial root dependency link lacked `lenis`; replaced only this lane link with `pnpm install --frozen-lockfile --prefer-offline` (no lockfile change).
- Root's three modified files and untracked Calendar plan remain untouched. Other lanes/listeners preserved.
- Shared SHIP revision40 remains the unrelated owner/host hold. User explicitly selected this independent PR preparation; no shared record mutation or release claim.
- Three agents own metadata/sharing, missing-page recovery, and discovery controls. Coordinator owns integration, runtime validation, manifest and handoff.

## Required evidence

| Item | Evidence required | Status |
| --- | --- | --- |
| Default/status metadata | Rendered description/title, no starter copy | Passed locally; evidence below |
| Social sharing | Absolute canonical URLs, PNG dimensions/type, appearance, profile override regression | Passed locally; evidence below |
| Custom 404 | HTTP 404, both recovery links, keyboard focus, mobile/desktop/light/dark | Passed locally; evidence below |
| Build sitemap | Public200, canonical, exactly one XML entry, existing profile filtering | Passed: public 200/canonical and exactly one XML entry |
| Preview indexing | Rendered noindex on HomeCanvas and visual pages; access guards retained | Passed: rendered directives and preserved guarded content |

Focused checks and browser evidence are local only. Default handoff is an open PR; hosted CI/review, merge/deployment and production acceptance remain Caleb-owned. Do not poll them or mark this patch deployed.

## Local verification

- 31 focused passing cases: `public-site-origin.test.ts` (12), `prelaunch-social-metadata.test.ts` (3), `public-profile-sitemap.test.ts` and `nonprofit-documentation-sitemap.test.ts` (16). New resolver test runs Next under React server conditions and production/preview environment, preserving canonical image and profile-specific avatar/card/copy. Final CLI-project invocation passes; manifest refreshed after subprocess-test classification.
- Actual HTTP: `/status` 200 and correct leaf title/description, final OG/Twitter image `https://coachhouse.app/opengraph-image`; `/build` 200 and canonical; `/sitemap.xml` 200, `/build` exactly once, zero preview entries; `/opengraph-image` 200 PNG 1200x630,47,775bytes, visually inspected.
- Unknown nested path and unknown public handle each return HTTP 404, correct title and noindex. Chromium verified Home/Resources navigation (both200), ordered keyboard focus/rings, mobile 390px no overflow and 44px targets, desktop 1280px light/dark/system. [Review artifacts](../qa/prelaunch-2026-10-22/README.md).
- `/home-canvas` 200/noindex,nofollow. Gated visual page with authorized development header renders noindex,nofollow. Without header, existing guard renders not-found/noindex (framework streams HTTP 200 on that pre-existing gated route); no guard or authentication changes.
- Focused ESLint, structure/routes/features/boundaries/thresholds/React Grab/raw-button checks and diff hygiene pass. New 404 has no existing stored visual baseline; review captures are macOS evidence. User appearance approval and hosted Linux visual/quality gates remain separate; no baseline replacement.
- Scoped TypeScript (16 roots including declaration files; 3,226 files) reports 83 diagnostics in six unchanged public-map canvas modules, none in changed source. Full typecheck success is NOT claimed. Initial incomplete compiler invocation omitted ambient declarations; corrected invocation above is authoritative.
- Existing Documentation routes defining their own Open Graph objects retain their prior shallow-merge override behavior. This patch supplies defaults; it does not rewrite all per-route sharing declarations.
- Private command output/runtime evidence: `/tmp/coach-house-prelaunch-20261022/`. Browser uses the actual app; no provider configuration or schema changes were made.

## Handoff

Open [PR348](https://github.com/Hamernick/CoachHouse/pull/348), source commit `cc4475a393873a3f1c5bc94866fcd3d407d8a681`, pushed and independently matched with GitHub. Staged secret scan passed; normal Node 22 pre-push passed in 4.06s. Final Graphify refresh completed successfully: 21,918 nodes / 62,940 edges; log `/tmp/coach-house-prelaunch-20261022/graphify-final.log`. Required hosted CI/review, merge/deployment and production acceptance belong to Caleb; do not poll or bypass those gates.
