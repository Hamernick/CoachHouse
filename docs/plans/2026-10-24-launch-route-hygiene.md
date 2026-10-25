# Launch Route Hygiene — O123, O173, O176, O133, O127

Branch: `fix/launch-route-hygiene-20261024`.
Worktree: `/Users/calebhamernick/Development/coach-house-platform-launch-route-hygiene-20261024`.
Base: current main `6e940b13` plus backlog documentation PR #358 (`8d2ed049`).
The implementation PR is stacked on #358 while that documentation PR remains open.

## Approved Order and Checkpoint

1. O123-01 — metadata: development complete; inventory covers every page, excluding breadcrumb slots and explicit redirect/404 aliases. Documentation home inherits its own layout; visual fixtures inherit preview metadata. Added route-specific titles/descriptions to rendering account, workspace, staff and public roadmap pages, completed fiscal/auth descriptions, and blank dynamic-profile/resource fallbacks.
2. O173-01 — sitemap: development complete; status plus published profiles/resources/roadmaps enumerated through a sitemap index. Static sitemap stays database-independent.
3. O176-01 — crawler access: development complete.
4. O133-01 — broken links: development complete.
5. O127-01 — image alternatives: development complete.

Each task advances only after focused verification. Development completion is separate from hosted CI, review, merge, deployment and live acceptance. No provider writes or shared SHIP changes are authorized by this lane.

## Verification

O123: `pnpm exec vitest run tests/acceptance/prelaunch-social-metadata.test.ts` — 154 passed. Changed source/test ESLint passed. Route contract passed (existing organization details page now 271/280 lines). Anonymous Googlebot HTML requests to login, signup, password reset, Documentation home, fiscal email verification and status returned 200 with expected titles/descriptions. Local evidence: `/private/tmp/launch-metadata-http.json`. Next webpack server runs on port 3162; log `/private/tmp/launch-route-hygiene-next.log`. No hosted or live acceptance claimed.


### O173 Evidence and Catalog Decision

45 focused sitemap/origin/community tests passed; affected lint passed. TypeScript check started before the final key-range adjustment passed; final changed-code type check remains at handoff. Local HTTP: static sitemap 200 with 62 URLs; index 200 with 20,002 child sitemaps (1,689,152 bytes); published profile page 200 with 24 URLs; nonprofit key ranges 0 and 19,000 returned 2 and 4 published URLs. Resource/roadmap sharing flags are disabled in this local environment; their enabled behavior is covered by focused tests, not claimed as live acceptance.

An exact count on the nonprofit visibility view exceeded the request deadline. Use 20,000 fixed numeric EIN ranges, each containing at most 50,000 possible URLs, and keyset batches of 500 within each range. This deliberately includes empty ranges, avoids full-table counts/deep offsets, and cannot silently truncate a growing catalog. No migration or provider mutation. Profile/resource/roadmap catalogs use bounded 500-row pages. Roadmap enumeration uses the same explicit `is_public_roadmap` flag as its page. Database failures return uncached 503; robots advertises the independent static sitemap as well as the index. Published projections and existing visibility filters exclude suppressed/claimed directory identities, private profiles, Wikidata and known fixtures.


### O176 Evidence

Fixed proxy prefix collisions: a public handle such as `/classical-foundation` no longer inherits `/class` authentication. Whole path segments still protect all private descendants. Added inherited noindex to account/staff/dashboard layouts and explicit noindex to confirmation, checkout return and email preferences.

255 focused cases passed (89 proxy, 163 metadata, 3 community); affected ESLint passed. [Anonymous HTML receipt](2026-10-24-launch-route-hygiene-crawl.csv): all 62 static sitemap URLs and two published dynamic profiles returned indexable HTML with content, without cookies or JavaScript. Four private routes redirected to noindex sign-in; Documentation search returned noindex/follow. Initial two-worker cold compilation timed out on Resources/Pricing; a one-worker rerun completed all69 requests with zero errors. This verifies local application behavior, not production crawler acceptance. Full local crawl data retained at `/private/tmp/launch-crawl.json` for link/image checks.


### O133 Evidence

Replaced three confirmed dead external destinations (TechSoup assessment host, USAID PDF host, CDC community-engagement PDF) with verified official resources; all three replacements returned HTTP200. Removed three placeholder help links in staff settings and corrected the invalid workspace/programs fixture route. TechSoup copy now describes the provider overview and availability check accurately.

387 owned literal href/to/ctaHref destinations resolve against the actual route/asset inventory; all42 Documentation tests pass. Another18 existing navigation/pricing/resource-link cases remain valid. All279 anchors across61 locally rendered pages resolve; affected ESLint and route guard pass. Receipts: `/private/tmp/launch-link-inventory.json`, `/private/tmp/launch-external-links.json`, `/private/tmp/launch-replacement-links.json`, `/private/tmp/launch-anchor-results.json`. No customer-owned/capability-bearing URLs were submitted to the external checker.

Of162 repository-owned external destinations checked,134 succeeded directly; three confirmed dead links were replaced; six FTC apparent404s and14 other blocked destinations were verified through official web content. Five provider URLs block direct automation (two AmeriCorps, three DOL); official indexed content corroborates the AmeriCorps evaluation landing page and three DOL destinations. The AmeriCorps Logic Model Slides PDF remains a provider-blocked live-acceptance check, not a confirmed dead link. These limitations do not claim universal third-party uptime.

Browser navigation confirmed Build → Choose Organization → signup and the expected sign-in checkout-return route. No sign-in, account creation or checkout was submitted. User requires the Bandto Chrome profile for any further account-flow checks. Anonymous HTML/source verification covers the remaining audited destinations; no authenticated end-to-end acceptance is claimed.


### O127 Implementation and Handoff

Inventoried142 JSX image sites, including55 explicit decorative alternatives and two forwarding Avatar primitives; checked the two generated email logo templates separately. Added explicit alternatives to three missing avatar sites (two redundant beside visible names remain decorative), and replaced current-user initials with the available name. Existing descriptive/dynamic alternatives and intentional decorative images are preserved. User-authored image descriptions still require author review; no production content was rewritten or visually guessed.

The existing image editor could edit alt text only while replacing the image. Added a labeled Save alt text action, fresh current-alt initialization on opening, and explicit empty alternatives in both editor and collaboration schemas. Eight collaboration tests pass, including alt-only persistence/reload and HTML escaping. The complete owned JSX inventory guard passes after skipping files without image syntax before AST parsing; no timeout increase. The focused browser save/reload test passed after enabling image support in the test fixture; the existing editability browser case also passed. No product assertion or timeout was weakened.

Final type checking exposed a pre-existing Resources page component type exposing an unsupported embedded prop to Next's route contract. Narrowed it to the existing searchParams field. Full TypeScript now passes with zero diagnostics. Structure, route, boundaries, acceptance manifest and affected lint pass. No visual baseline changed; the image-menu interaction has a browser regression test. All316 image occurrences in the earlier69-page anonymous receipt include an alt attribute.

### Current Handoff

The five selected IDs and the overlapping O126 sitemap/robots requirement are development-complete. The authoritative ledger records46 Done of176 original IDs. O128/O129 and O145-02/O145-03 have verified scoped improvements; their broader requirements remain In progress. These are not deployed/accepted counts.

[PR359](https://github.com/Hamernick/CoachHouse/pull/359) is stacked on documentation PR358. The current branch contains the protocol, keyboard-authoring and bounded-preview continuation below. No sign-in, checkout, provider write, shared SHIP change, merge or deployment occurred. Preview3162 is stopped; unrelated processes/worktrees remain untouched.

Current verification:
-52 sitemap/origin/community cases and anonymous root-route/index HTTP checks pass (`/private/tmp/launch-sitemap-location-tests.log`, `/private/tmp/launch-root-sitemap-http.json`).
-20 thumbnail/storage/detail cases pass; original downloads and external/signed/vector URLs are preserved (`/private/tmp/launch-thumbnail-tests.log`).
-All four actual-CSS browser journeys pass together: editor permissions, alt-only save/reload, keyboard caption/menu/dialog/full-width/read-only behavior, and native file selection affecting only the chosen image (`/private/tmp/launch-readiness-browser-verified.log`,18.0s). Dialog screenshot was inspected. The fixture compiles one actual JS/CSS bundle per worker; raw sequential rebuild evidence was642,686bytes then0bytes. No timeout, focus assertion or visual baseline was weakened.
-Full current TypeScript and affected lint pass (`/private/tmp/launch-readiness-types-verified.log`, `/private/tmp/launch-readiness-lint-verified.log`). Route, structure, interaction-lock and acceptance-manifest guards pass. Prior unchanged metadata/crawler/link proofs above remain valid.
-Final Graphify, normal pre-push, secret-scan and remote-head receipts are recorded below.

Hosted quality, independent review, merge/deployment and live acceptance remain user-owned. Provider-blocked external links and author-authored image-description quality retain the explicit limits above.

### Launch Readiness Continuation

User explicitly selected launch readiness, requested separate agent goals and parallel implementation, and asked for an outcome-focused expert approach. Three independent lanes used original packet02 requirements and raw source/runtime evidence. Root owns integration and this checkpoint.

- **Crawler correctness:** independent source/protocol review found the initial catalog shards below `/public-sitemaps/` described URLs outside that directory. Root-level `/public-sitemap.xml?kind=…&page=…` shards now comply with the [sitemap location rules](https://www.sitemaps.org/protocol.html#location). Query validation and XML escaping retained.52 focused cases pass; anonymous HTTP gives24 profile URLs,404 for missingpage, and20,002 root-scoped index entries. Receipt `/private/tmp/launch-root-sitemap-http.json`. O173 was reopened while correcting this, then completed. O126 now also closes against the same complete sitemap/robots evidence; Search Console submission remains O175.
- **Keyboard authoring:** named alignment actions, focus-visible toolbar, caption Enter/Escape behavior and read-only mutation guards. Permission changes publish a no-step/no-history transaction to refresh image controls without editing the document. The image form now uses the existing shadcn dialog because the menu intercepts Tab. Upload, URL and alt controls have names/unique associations. Actual application CSS is compiled into the existing browser fixture; no visual baseline or timeout weakened. All four integrated browser journeys pass; menu-caption focus restoration and full-width sizing after initial read-only loading are included. O145-02/O145-03 remain In progress because this is an image-editor slice.
- **Image transfer:** active public brand-kit raster previews request640×128 contain at quality75 through the existing helper; preserve original downloads, external/signed/vector sources, crop and lazy loading.20 focused tests pass. One anonymous provider sample measured972,373-byte JPEG versus3,392-byte WebP (99.65% lower transfer), bothHTTP200; this is a sample, not whole-page speed. Receipt `/private/tmp/launch-asset-sample-receipt.json`. O128/O129 remain In progress for the remaining upload/asset and representative-page inventory.

The expert approach is to validate completion against the original requested outcome and reopen proven gaps. Raw inputs are original176 requirements, source diffs, generated route behavior, rendered DOM/focus events and response bytes. Methods combine protocol review, accessibility interaction testing, delivery optimization and independent file ownership. Evidence outside the agents' judgment is repeatable Vitest/Playwright output, actual HTTP/XML, measured provider responses and the required hosted quality/review gates.

**Rewritten execution prompt:** Build the next bounded launch-readiness slice in Coach House's existing Next.js/React/shadcn stack. Start from the original requirements and raw code/runtime evidence. Prioritize crawler correctness, keyboard-operable authoring and efficient public image delivery. Define observable pass/fail criteria, implement independent pieces in parallel with one goal and exclusive file ownership per agent, and integrate centrally. Preserve existing design, authentication, persistence and original downloads. Verify with protocol checks, real DOM/keyboard journeys, type/lint checks and response measurements. Keep one evidence-linked backlog, distinguish scoped improvements from globally completed requirements, and deliver a reviewable PR with remaining hosted/provider/live gates explicit.

### Final maintenance — October25

The interrupted AST job completed. Exact hash readback found one omitted final thumbnail source; a targeted AST extraction repaired it without another broad update. All107 included changed code files now match the manifest; the old nested sitemap route is absent and the root route is present. Exact backlog/index semantic extraction and cache readback contain217 nodes/396 edges. Final graph:22,267 nodes/63,542 edges, no missing/dangling endpoints or duplicate edges; two inherited self-loops remain. Receipt: `graphify-out/launch-readiness-refresh-receipt.json`; source audit: `/private/tmp/launch-readiness-ast-hash-readback.json`. No application source changed after the passing checks above.

Publication: implementation `dcdf1c457466ba150054a75615298d7dda14a285` independently matches the remote branch. Normal Node22 pre-push passed in9.96s (including108 changed-file lint targets); outgoing nine-commit secret scan found no leaks. Logs: `/private/tmp/launch-readiness-push.log`, `/private/tmp/launch-readiness-secret-scan.log`. PR359 includes this continuation and remains stacked on358. This final documentation receipt does not change the verified application sources.

Browser reproduction: `pnpm exec playwright test --config=/private/tmp/launch-alt-playwright.config.cjs tests/visual/rich-text-editability.visual.spec.ts`; the local config uses default Chromium/viewport/assertion settings,one worker,a90s test limit,no retries and no server because the fixture renders the real editor bundle in-page. The committed spec also runs through the normal visual configuration. Inspected UI artifact: `/private/tmp/launch-alt-playwright-results/rich-text-editability.visu-d109c-d-and-read-only-transitions/image-edit-dialog.png`.
