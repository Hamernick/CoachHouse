# Public-map canvas TypeScript repair — October 22, 2026

## Current release status — October 22

Merged and deployed in the production release confirmed by Caleb at PR351 / `4ca66f42`. [Authoritative release receipt and source-list count](2026-10-22-retire-public-prototypes.md#current-status--october-22-merged-and-deployed). Earlier handoff and failed-deployment notes below are historical; do not reopen completed work.

## Scope and ownership

Original workstream 01 narrow defect repair, explicitly selected by Caleb. PR348 is merged/closed. Fresh base `c63052e5`, isolated branch `fix/map-canvas-types-20261022`, worktree `/Users/calebhamernick/Development/coach-house-platform-map-canvas-types-20261022`. Shared SHIP40 ownership and unrelated dirty root/worktrees/listeners preserved. No new app server, dependencies, configuration, provider, data, migration, publication, clustering, or visual changes.

Two parallel dedicated-goal agents had exclusive ownership: canvas_repair owned six runtime callsites plus the helper; canvas_verification owned the new acceptance test. Coordinator owns integration, evidence, Graphify, documentation, and PR. Runtime implementation and independent verification are complete; final delivery receipt follows below.

## Diagnosis and repair

An isolated six-file program did not reproduce the failure (0 diagnostics). The same broader application roots used for the preceding report, repository tsconfig, ambient declarations, and generated Next types reproduce **83 diagnostics in six canvas modules**. Fresh checkout required `pnpm exec next typegen`; the earlier missing-image ambient diagnostics were a setup artifact and are excluded from the authoritative baseline.

TypeScript 5.9.3 resolves the union receiver's overloaded `getContext("2d")` too broadly in this application compilation context, including `RenderingContext`. Compiler inspection found DOM library declarations, not an external WebGPU augmentation. Narrowing the receiver before overload resolution avoids that ambiguity. The shared helper discriminates OffscreenCanvas through `convertToBlob` and preserves the explicit 2D-or-null return type without assertions, suppression, global-constructor requirements, or weaker compiler options.

Each existing module changes only its import and one context-acquisition call. Drawing, colors, dimensions, scale, smoothing, selection, cache ownership, browser fallback, and null paths remain intact.

## Verification

- Node 22.13.0; installed frozen-lockfile dependencies reused through an existing node_modules symlink without mutation.
- Identical application compilation roots/configuration: **16 roots / 3,226 files / 83 diagnostics before; 16 roots / 3,227 files / 0 diagnostics after**. One added source file is the helper. [Raw before/after output](../qa/map-canvas-types-2026-10-22/).
- Adding the new acceptance test as a seventeenth root also passes: 3,277 files / 0 diagnostics.
- Four focused Vitest suites: **73 tests passed before and after**. New 11-case suite covers DOM/offscreen contexts, absent document, null/unavailable contexts, dimensions, colors, drawing/scaling, static registration, cache hits, bitmap cropping/normalization and closing ownership. Existing marker fallback, pin marker and WebGL data regressions also pass.
- Native Chromium: **60 pixel-identical, nonblank before/after cases**. [Screenshot, case results, harness and scope](../qa/map-canvas-types-2026-10-22/README.md).
- Scoped ESLint on all seven source files and the new test passes. Structure, boundaries, thresholds, acceptance-project manifest, and diff hygiene pass; existing structure warnings remain unchanged.
- Acceptance manifest regenerated: behavior197 / contract62 / cli11 / integration282 =552.
- `graphify update .` completed once after the cohesive source slice: 21,926 nodes / 62,978 edges / 1,204 communities. No semantic-label refresh needed for this code-only repair.

These checks establish the scoped repair, not a whole-repository typecheck, full Mapbox journey, hosted CI, deployment, or production acceptance. Required hosted quality and branch protection remain Caleb-owned.

## Reproduction commands

```sh
export PATH=/Users/calebhamernick/.nvm/versions/node/v22.13.0/bin:$PATH
pnpm exec next typegen
pnpm exec vitest run --config vitest.config.ts tests/acceptance/public-map-canvas-contexts.test.ts tests/acceptance/public-map-marker-fallbacks.test.ts tests/acceptance/public-map-pin-markers.test.ts tests/acceptance/public-map-webgl-data.test.ts
pnpm exec eslint src/lib/public-map/public-map-canvas-context.ts src/lib/public-map/public-map-marker-bitmap-cache.ts src/lib/public-map/public-map-marker-canvas.ts src/lib/public-map/public-map-pin-marker-canvas.ts src/lib/public-map/public-map-special-marker-canvas.ts src/lib/public-map/public-map-marker-static-images.ts src/lib/public-map/public-map-cluster-sprite-renderer.ts tests/acceptance/public-map-canvas-contexts.test.ts
pnpm check:structure
pnpm check:boundaries
pnpm check:thresholds
pnpm check:acceptance-projects
git diff --check
```

Run this exact compiler program from the repository root using Node on base and repaired source (same generated ambient files); do not pre-query checker types before collecting diagnostics:

```js
const ts=require('typescript'); const fs=require('fs');
const config=ts.readConfigFile('tsconfig.json',ts.sys.readFile);const parsed=ts.parseJsonConfigFileContent(config.config,ts.sys,process.cwd());
const roots=['src/app/layout.tsx','src/app/not-found.tsx','src/app/opengraph-image.tsx','src/app/(public)/status/page.tsx','src/app/(public)/home-canvas/page.tsx','src/app/(public)/visual-regression/layout.tsx','src/app/sitemap.ts','src/lib/public-site-origin.ts','src/components/public/public-not-found.tsx'];
roots.push(...parsed.fileNames.filter(name=>name.endsWith('.d.ts'))); const program=ts.createProgram(roots,{...parsed.options,incremental:false,noEmit:true});const diagnostics=ts.getPreEmitDiagnostics(program);console.log(ts.formatDiagnosticsWithColorAndContext(diagnostics,{getCanonicalFileName:x=>x,getCurrentDirectory:()=>process.cwd(),getNewLine:()=> '\n'}));console.log(JSON.stringify({roots:roots.length,files:program.getSourceFiles().length,diagnostics:diagnostics.length}));process.exit(diagnostics.length?1:0);

```

## Delivery receipt

Open [PR349](https://github.com/Hamernick/CoachHouse/pull/349), source commit `de0905d581692a7a2a9885db806ad457490bd2f8`, pushed and independently matched with `git ls-remote origin refs/heads/fix/map-canvas-types-20261022`. Normal Node22 pre-push passed in 5.64s (supply chain, large files, all eight changed source/test files linted). Staged binary diff secret scan: 519,736 bytes, zero findings. Final documentation receipt is committed separately; implementation evidence remains unchanged.

Completion audit: all six requested modules repaired through one explicit helper; same-config compiler baseline/current output retained; both canvas implementations and unavailable/null/cache paths covered; existing regressions and native browser pixels verified; scoped guards, lint, secret scan and pre-push passed; one Graphify refresh complete; source branch/remote match and open PR delivered. No known remaining diagnostics in either checked program. Whole-repository types and full hosted gates were not asserted. Caleb owns current-head hosted quality/branch protection, review, merge, deployment and live acceptance. No CI polling or release action performed.
