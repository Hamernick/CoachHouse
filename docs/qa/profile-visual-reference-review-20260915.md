# Profile visual reference review — September 15, 2026

## Scope and evidence

At Profile51882a89, hosted CI34982678718 passes static, acceptance, RLS and build,
with17 failed visual cases. Mobileec0b73d4 passes aggregate quality in34982708728.
The Profile failures use original platform-neutral reference filenames. Inspected
expected/actual/diff images show Linux text rendering and line-wrap differences
across Documentation, Documents lists and Roadmap conflict dialogs. Root font
configuration is unchanged between these branches. Current Preview CSS uses the
self-hosted Inter family. This is reference alignment, not a product font change.

Actual images were compared with earlier run34937182522 and with current retries.
Twelve of17 current images are byte-identical to their retry. Four more differ by
1–49 raw pixels; normal screenshot antialiasing tolerances remain unchanged. The
remaining mobile dark Decision canvas retry includes React Grab's toolbar, which
is absent in the first attempt. The artifact's DOM context confirms Copy element,
Comment on element, Style element and Collapse toolbar controls.

## Correction

- Preserve all existing reference PNGs; add17 separately named Linux references
  from current hosted artifacts, selecting the uncontaminated first attempts.
- Resolve a Linux reference only when a separately reviewed file exists; otherwise
  retain the original comparison. No screenshot tolerances change.
- Intercept only the React Grab development runtime in these four visual suites.
  Normal localhost React Grab and application source are unchanged.
- Use soft screenshot assertions so one mismatch does not hide later screenshots
  or behavioral assertions. Every mismatch still fails its test and the CI job.
- Targeted ESLint passes; Playwright discovery lists47 tests in the four files
  without starting a browser/server. Full execution stays hosted. No local full
  build, visual suite, baseline rendering or Graphify refresh.

Further screenshots may surface now that tests continue past their first mismatch;
review them before adding references. Quality is not yet passing at this checkpoint.

Artifacts: `/tmp/coach-house-profile-51882a89-visual`,
`/tmp/coach-house-profile-2931f0d3-visual`,
`/tmp/coach-house-profile-visual-repeatability.json`. Recovery and SHA256 manifest:
`/var/folders/l2/jpghvb_52t10fnrzxcs0bpd40000gn/T/coach-house-profile-linux-visual-review-sl4rq2cs`.

Reference: [Playwright visual comparisons](https://playwright.dev/docs/test-snapshots)
explains that OS/font rendering can require separate platform references.

## Workspace mount sampling

Fresh authenticated Bandto navigation to the current Profile alias with
`/workspace?drawer=accelerator`:46 bounded DOM samples over5.8s. First observed
mount at3.803s was fully offscreen (589px canvas/translation,0px visible). At4.035s
content was present while the drawer entered (263.85px visible,483 panel text
characters,56px visible heading). At4.615s it settled at requested48% (282.72px
visible,306.28px translation). No sampled visible blank or full-height state and
no drag. Sampling was about75ms plus browser-call latency; it is not frame-perfect
and does not establish the original incident's cause. Existing authenticated
session/cache were retained. Drawer remains95% pending that original scenario.

Production remains held. Existing Profile runlog and root handoff notes stay local.

## Second hosted pass: later screenshots

Run34986106119 at a1902c12 passes every original17 screenshot comparison and all
static, acceptance, RLS and build lanes. Soft screenshot assertions exposed20
later reference differences across9 tests. All20 expected/actual/diff triples
were reviewed: four Decision editor states, Documentation home/articles/Marketplace
and Brand identity, plus Ad Grants, Campaign and Fundraising planner reviews.
The differences remain text rendering and resulting line wraps. Containers,
controls, images and responsive layout remain intact. Eleven actual images are
byte-identical to retry; the other nine differ by1–29 raw pixels. No React Grab
toolbar appears in these images.

Add20 separately named Linux references, preserving every original. Combined with
the first pass there are37 reviewed Linux references. Thresholds are unchanged.
Artifact: `/tmp/coach-house-profile-a1902c12-visual`. Second-pass SHA256 manifest:
`linux-references-second-pass.json` in the recovery directory above. Hosted quality
must be rerun at the new commit; passing prior comparisons alone is not completion.

## Marketplace layout update

User requested the color-library/coss.com header, category and searchable-filter layout. Profile `f2fe76cf` passes hosted static, acceptance, RLS and build; both Previews are Ready. The new Marketplace interaction regression passes, including combined filters/reload/People switching, multiword typing, literal “all” and empty-state recovery. Visual run35016760566:140 passed,4 passed on retry,5 expected screenshot failures.

Reviewed all five new images: Marketplace desktop and mobile light/dark; People desktop light and mobile dark. The larger shared heading, shorter subtitle, category/filter controls and moved promotion account for the changes. Cards, public shell, coach photos/actions and member projection remain intact. Four first/retry images are byte-identical; desktop Marketplace also matches visually on retry. Update only these five existing Linux references. Original references are backed up with SHA256 manifest under `coach-house-marketplace-layout-fm7gk13v/visual-references` in the session recovery directory. Platform-neutral references and comparison thresholds remain unchanged.

Evidence: `/tmp/coach-house-marketplace-f2fe76cf-visual`; behavior and failure summary: `/tmp/coach-house-marketplace-f2fe76cf-visual.log`. Four passing retries involved article scroll tracking and three existing Roadmap cases; their screenshots were not updated. Full validation after the reference update remains required. Localhost/Bandto responsive and hosted Preview checks also pass; no release.
