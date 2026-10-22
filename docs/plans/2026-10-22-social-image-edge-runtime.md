# Social image Edge deployment repair — October 22, 2026

## Scope and cause

Caleb supplied failed Vercel logs for merged PR348 and the following PR349 deployment. The first identifies main `c63052e`: compilation, TypeScript and static generation pass, but deployment rejects the `accelerator` Edge function for `node:fs/promises` and `node:path`. Root `opengraph-image.tsx` imported those Node APIs to load the logo, and Next includes root image metadata in Edge page bundles. The prior local development and scoped tests did not exercise this production boundary. The map typing patch does not cause or repair this import defect.

Fresh isolated `fix/social-image-edge-runtime-20261022`, base current main `443a6576` (merged349), checkout `/Users/calebhamernick/Development/coach-house-platform-social-image-edge-20261022`. Original01 bounded production-defect repair; reused startup/workstream context and queried Graphify. Root dirt, prior worktrees/listeners, and SHIP40 preserved. No provider, database, runtime setting, dependency, or environment-value change.

## Repair

Replace the dynamic image generator with the exact already-rendered branded PNG using Next's supported static metadata convention. `src/app/opengraph-image.png` is byte-identical to the reviewed1200x630social image; `opengraph-image.alt.txt` preserves alt text. Explicit root sharing metadata points to `/opengraph-image.png`, and resolver tests use that URL. No runtime logo reads, remote fetch dependency, or ImageResponse code is needed. Individual profile metadata and Edge route configurations remain unchanged.

Source: https://nextjs.org/docs/app/api-reference/file-conventions/metadata/opengraph-image

Image SHA256: `eb07b39782e9244e90760e5695177716e675d95c530728f866d0ec16df09ee29`. Image visually inspected; no appearance change or visual baseline update.

## Evidence and recovery

- 31 focused origin, sharing inheritance/profile overrides and sitemap tests pass. Scoped ESLint, route and import-boundary guards pass.
- Initial local production attempt rejected a node_modules symlink outside Turbopack's root. Replaced only the new task lane's symlink with `pnpm install --frozen-lockfile --prefer-offline` (19.9s), no manifest/lockfile changes. Other dependency directories untouched.
- Full `pnpm exec next build` exits0: compilation60s, TypeScript2.2min,198/198static pages. No image-related Edge warnings; inherited presenter-audio NFT tracing warning remains.
- All generated files in the three Edge function manifests checked: accelerator49/home43/legacy-home46files; no `node:fs/promises` or `node:path` references. Production HTTP returns the exact47,775bytePNG,1200x630with correct content type and canonical status metadata. Home/legacy-home200; accelerator307to workspace as before. Temporary3143server stopped. [Artifacts and reproducible audit](../qa/social-image-edge-2026-10-22/README.md).
- Graphify refreshed once after the cohesive source slice:21,921nodes/62,974edges/1,194communities. No duplicate refresh.
- Secret scan, normal pre-push and final PR receipt follow below.
- Private logs: `/tmp/coach-house-social-edge-20261022/`.

Commands:

```sh
export PATH=/Users/calebhamernick/.nvm/versions/node/v22.13.0/bin:$PATH
pnpm exec next build
pnpm exec vitest run --config vitest.config.ts tests/acceptance/public-site-origin.test.ts tests/acceptance/prelaunch-social-metadata.test.ts tests/acceptance/public-profile-sitemap.test.ts tests/acceptance/nonprofit-documentation-sitemap.test.ts
pnpm exec eslint src/app/layout.tsx tests/acceptance/prelaunch-social-metadata.test.ts
pnpm check:routes
pnpm check:boundaries
git diff --check
```

Caleb owns hosted quality/review/merge, Vercel deployment and live acceptance. No deployment or production verification is authorized by this local repair.
