# Consistent organization and Coach House sharing previews

## Current checkpoint

User-requested follow-up to original02 stage5, O124-01/O123-01: white, app-icon-style branding for organization links and a large homepage preview. Local implementation complete on `fix/branded-share-previews-20261023`, originally based on main5d40b7db and now reconciled with maincc3d145a (mergedPR354–355), in `coach-house-platform-branded-share-previews-20261023`. Open [PR356](https://github.com/Hamernick/CoachHouse/pull/356); user review, hosted quality, merge, deployment and iOS acceptance remain pending. This extends the earlier shipped social-image work; it is not another original-requirement completion.

The separate PR354 dependency/type/CI repair and PR355 analytics privacy change are now merged and preserved. Earlier56-error receipts below describe the old base, not a current unresolved count. Shared SHIP40 and unrelated worktrees/providers are unchanged.

## Behavior

- Every public organization now advertises a1200x630 opaque-white PNG with a centered352px rounded tile, subtle border/shadow and uncropped logo fitted within256px. Empty white/transparent padding is removed before fitting; brand artwork and source uploads are preserved.
- A normal Node route, `/<handle>/share-image.png`, serves the image; its renderer and orchestration live in that route's `_lib` directory, outside the framework-neutral library layer. It is outside `/api/` so the existing robots disallow does not block image crawlers. Renderer/Sharp imports never enter metadata modules inherited by Edge routes.
- The existing public profile projection controls eligibility. Missing, unpublished and non-organization profiles receive404/no-store. Unavailable, invalid or oversized logos produce initials in the same frame with a short30s cache instead of a broken image.
- Fetching is restricted to this project's HTTPS public `org-media` storage, with redirects rejected,4s timeout,3MB input cap and16MP decode cap. SVG external-reference patterns are rejected; PNG/JPEG/WebP/SVG are normalized to PNG and stripped of embedded metadata. Sharp0.35.5 is explicitly declared for this conversion; Next/eslint remain at the merged security upgrade16.4.2; the lockfile retains those versions and adds only the directSharp importer/required-dependency classification.
- Organization metadata keeps its canonical title/description and uses `summary_large_image`, explicit PNG dimensions and a image revision derived from both logo URL and display name. Names are included even with a logo because load failures can render initials. Personal profile behavior is preserved.
- Root metadata uses the new static `/brand-share.png` URL, produced with the same renderer. The former `/opengraph-image.png` remains available for existing links. No runtime root image generator or filesystem import is reintroduced.

## User evidence and platform boundary

Caleb supplied iOS share-sheet and Messages screenshots. The existing organization metadata pointed directly to raw, differently sized transparent logos; Mano's PNG was2,272,924bytes. The existing homepage already served correct large-card metadata and an accessible1200x630 PNG, so no missing-tag or404 cause was reproduced for its small iOS card. The new image URL gives the redesign a distinct asset identity; it does not prove the cause of an old client preview.

[Apple's rich-preview guidance](https://developer.apple.com/documentation/technotes/tn3156-create-rich-previews-for-messages) recommends directly available metadata, graphical images at least900px wide and separate titles. The website controls its advertised artwork, not the native share-sheet header or exact layout chosen by each client. No native share-sheet success or real Messages refresh is claimed from local HTTP evidence.

Review links: [Coach House](http://localhost:3157/brand-share.png), [Mano Extendida](http://localhost:3157/manoextendida/share-image.png), [A More Just Chicago](http://localhost:3157/amorejustchicago/share-image.png). The dedicated local production server uses this worktree; do not restart unrelated listeners. After deployment, share fresh homepage and organization links in Messages and compare all three images.

## Verification

All62 focused tests pass. The suites cover public-only eligibility, missing/corrupt/oversized logos, blocked remote URLs and signed/private storage paths, bounded format normalization, padding removal, Next's actual metadata resolver, large-image cards, logo revisions and existing profile behavior:

```sh
pnpm exec vitest run --config vitest.config.ts tests/acceptance/public-share-image.test.ts tests/acceptance/prelaunch-social-metadata.test.ts tests/acceptance/public-profiles.test.ts tests/acceptance/public-site-origin.test.ts
```

Changed-file ESLint, route/import-boundary/structure and acceptance-manifest guards pass; existing near-budget warnings remain. A full `tsc --noEmit --incremental false --pretty false` reports56 errors solely in the13 known acceptance-test files, none in this task's source/tests. This check preceded the final two-stage padding normalization; the final focused suites cover that adjustment. That historical blocker was repaired in mergedPR354; current validation is recorded below.

Production compilation uses `pnpm exec next build --experimental-build-mode compile`: it checks optimized Turbopack bundling and Node/Edge isolation while leaving type validation/prerender release gates separate. The final pass succeeds without Node/Edge errors, retaining only the pre-existing presenter-audio NFT warning. This is not a passing full production build or Vercel deployment claim.

Local production HTTP verification checks `/`, `/manoextendida`, `/amorejustchicago`, each advertised PNG, and a missing profile image. It validates server-delivered metadata,1200x630 dimensions,200/image/png responses, size below250KB and404 for the missing profile. Raw pixel checks confirm every output is opaque with white corners. Final compiled-source checks pass. Assets measure42,464/50,549/27,768bytes respectively; all three pixel checks pass.

The initial development server retained a dependency-symlink path after isolated installation and failed compilation; restarting only its verified listener resolved that environment issue. Cold webpack profile compilation exceeded its HTTP timeout; production-mode HTTP checks replaced that failed attempt. macOS reports duplicate nativelibvips delegates because Next16.2.6 uses0.34.5 while the converter uses0.35.5; rendering/tests succeed. The separately owned Next upgrade converges the versions, but is not included or claimed merged here.

Private reproduction and outputs: `/tmp/coach-house-branded-share-20261023/` (`focused.log`, `types.log`, `build-compile-final.log`, `verify-production.py`, `production-evidence.json`, `pixel-check.cjs`, `pixel-evidence.json`, rendered PNGs). Homepage regeneration uses `render-home-final.cjs`: normalize `public/coach-house-logo-dark.png` on white, trim blank padding, then call `renderBrandShareImage` and write its PNG to `public/brand-share.png`. Keep this shared renderer when regenerating the static asset. No appearance fixtures exercise these social images; no existing visual baselines were changed. Caleb owns actual appearance acceptance.

## Delivery and rollback

Implementation `c6d76527` is pushed in [PR356](https://github.com/Hamernick/CoachHouse/pull/356). Zero-finding secret scan and normal Node22 prepush pass, including full lint (243.80s total). Final62tests, optimized compilation, production HTTP and pixel checks pass. Batched Graphify AST refresh completed:21,956nodes/62,977edges; index semantic maintenance follows the final handoff wording. Original02/master current rows point to this open PR. Do not merge/deploy or poll CI. Rollback reverts this PR's metadata, renderer endpoint and added dependency; existing public pages/uploads/data remain intact. No migration, provider settings, mail or production data changes.

## October23 review and conflict correction

Both bot findings addressed: the React/Next renderer and response orchestration moved under `src/app/[org]/share-image.png/_lib`; framework-neutral metadata URL helpers remain in `src/lib`. Image revisions now include display names unconditionally, including absent/unavailable logos; rename regression cases exercise resolved Open Graph and Twitter metadata.

Merged current maincc3d145a into the existing PR branch, preserving PR354's Next16.4.2, type fixes, performance budget fix, acceptance corrections and reviewed visual changes, plus PR355 analytics privacy. The three conflicts were resolved without changing gates or visual references. PR356's prior run39901704388 failed three stale acceptance assertions, the admin bundle budget and ten existing visual cases; the imported repair passed every hosted lane in run39900737423. That is base evidence, not a green PR356 claim.103focused tests and scoped lint/boundaries/routes/structure/acceptance inventory pass on the combined source.

Preview investigation: verified the owned3157listener, homepage/image HTTP200 and the actual rendered image in Chrome. User's access failure was not reproduced; requested exact failing URL/browser/error. Restarted only this listener after the full build; homepage renders in Chrome at http://localhost:3157/. Dedicated server session46493, PID recorded by lsof if recovery is needed. Original access cause remains unconfirmed.

Current review validation:103focused tests pass (including all three formerly failing acceptance suites), scoped ESLint/import/route/structure/inventory guards pass. Full `pnpm build` on Next16.4.2 passes TypeScript and201static pages; only existing presenter-audio filesystem-tracing warnings remain. `pnpm check:perf` passes: admin939KB under1000KB. Final public HTML/image/pixel checks pass for all three examples. Hosted PR356 checks must run on the new revision; no merge/deployment claim. Review artifacts use the `review-` prefix in the existing private artifact directory.
