# Older Documentation, Workspace, and map work: assessment

**Latest map continuation, September 14:** camera/loading fixes are saved in Mobile draft #235 at3aa31a33; every hosted quality lane passes. The approved fullscreen map/combined navigation is selectively integrated into existing localhost with newer root fixes preserved, and live marker framing/layering checked. See [map camera/loading review](2026-09-14-map-camera-and-loading-review.md) before relying on the historical states below. Next: result cards and guides.

Assessed September 14, 2026. Inventory only; no implementation or release action.

PR #229 is an older bundle, not a reliable list of everything still unfinished.
Its current checks pass, but newer preserved work substantially expands
Documentation, and several items in its description are already on main.

Documentation means the public learning library at `/documentation`.
Documents means the user's files in Workspace. These are separate products,
although their unreleased source currently shares a preserved Git baseline.

## User review checkpoint — September 14, 17:44 EDT

- Documentation: user says the experience seems good for a future release.
  Product/design review can move on. This does not resolve the technical
  separation, quality, or database checks listed below.
- User explicitly clarified: no push now. No merge, deployment, or release
  preparation is authorized by this assessment.
- Current review: unified Profile settings, opened in the Bandto Chrome profile
  at `http://localhost:3000/workspace` through Profile & settings. This running
  checkout's account-settings source matches the preserved baseline exactly.
  Review one feature at a time; await user feedback before advancing.

## Profile review findings — September 14, 17:54 EDT

User found the Username control under Public page; it is present and connected
to the claim/update endpoint. User then noticed the public page's literal
"Person" badge. This is the profile-kind label in
`src/features/public-profiles/components/public-profile-page.tsx:362`, not an
account role or verification status. Record it as redundant copy to remove
from the person page when implementation is authorized.

Code review found the following unfinished behavior. These were traced in
source, not reproduced by changing the user's account:

1. **Account edits and the public page use separate unsynchronized records.**
   Profile Save changes writes `profiles`; the public page reads
   `public_person_profiles`. Photo upload also updates only `profiles`.
   Name/role/photo are copied when visibility changes, but subsequent normal
   edits do not update the public record. About is not passed into the public
   identity save at all. Public bio, website, and location are stored/rendered
   but have no corresponding edit controls in this unified form. Reconcile
   these intentionally, preserving private contact boundaries.
   Sources: `account-settings-dialog-state-helpers.ts:146`,
   `src/app/api/account/avatar/route.ts`,
   `public-profile-identity-settings.tsx:278`,
   `src/lib/queries/public-profile.ts:495`.
2. **Saving one settings section clears unsaved status for other sections.**
   Changing Profile then switching to Communications and saving only runs the
   Communications save, but clears the shared dirty flag. Closing afterward
   can lose the unsaved Profile draft without warning. The reverse applies.
   View profile is also a direct link without the dialog's discard guard.
   Sources: `account-settings-dialog-state.ts:140,208,253,265`,
   `public-profile-identity-settings.tsx:153`.
3. **Visibility can overwrite newer publication settings.** Its save sends
   the full public profile captured when the component loaded. Publishing a
   saved collection sets `show_saved_locations=true` on the server; toggling
   profile visibility in that same mounted form can send the older false
   value back. A visibility-only update would avoid overwriting other fields.
   Sources: `public-profile-identity-settings.tsx:278`,
   `supabase/migrations/20260901014000_add_public_saved_collections.sql:248`.
4. **Identity-loading failures are presented as empty/private state.** The
   username/public-profile loader ignores query errors and falls back to an
   empty handle and Private. It has no explicit error/retry state, unlike the
   organization and collection sections.
   Source: `public-profile-identity-settings.tsx:192`.
5. **Communications delivery remains unverified.** The switches write Auth
   metadata and the UI reads those flags. The source search found no newsletter
   delivery/audience integration consuming them. External mailing configuration
   was not inspected, so actual subscription behavior is not established.

Username availability/claim, publication, organization visibility, saved
collections, avatar upload, password update, and account deletion have actual
API/RPC/Auth handlers. That is wiring evidence, not a successful live canary for
every operation. Email is deliberately read-only here; no change-email flow
was found in this form.

Profile remains **needs fixes before release**. Suggested implementation order:
save/draft boundaries, intentional public-field editing and synchronization,
visibility-only updates, load-error recovery, then the redundant badge and
communications integration verification. No application changes made.

## Product inventory

| Work | What exists | Assessment and remaining decision |
| --- | --- | --- |
| 1. Documentation library and search | Public Quickstart, concepts, Best Practices, Tools, shared navigation, original artwork, and library-wide search. Latest source is in the preserved baseline and #238's base. | **Implemented; older version superseded.** #229 contains an earlier, smaller library. Use the latest version for product review. It still needs an independent change against main, resolution of current visual failures, and database route-reservation verification. Search is implemented; older notes calling it missing are stale. |
| 2. Interactive planners and Brand Identity | Fourteen guided planners with decision canvases, editable steps, local drafts and exports, plus the Brand Identity asset/ZIP workflow. Latest source is preserved with Documentation. | **Implemented; needs acceptance review.** Confirm the planner experience and whether browser-local storage meets the intended product scope. These tools do not provide account/cloud draft sync. Their visual review belongs with Documentation. |
| 3. Documentation Marketplace and People | Resource discovery, detail guides, local shortlists, CSV export, Ad Grants campaign starters, curated coaches, and opted-in public member profiles. Latest source is in the preserved baseline. | **Implemented; public content and live behavior need review.** Confirm the resources and coach destinations; verify published-member rendering with configured data. This is separate from the map's public resource inventory. |
| 4. Unified Profile settings | One Profile flow replaces separate Profile/Public profile destinations. It includes identity, avatar, handle, publication, organizations, saved collections, and protection for unsaved edits. | **Distinct pending feature.** Main has the public-profile foundation but not this unified editor. Preserved baseline and #238 retain the same editor. Review the complete save/publish/visibility journey separately from Documentation. |
| 5. Workspace layout and progress | Narrower embedded organization/accelerator panels, a centered banner, Core Documents completion percentage, and proportional progress-rail sizing. Present in #229 and the preserved baseline. | **Visual direction accepted September 14.** Preserve the centered/narrower layout and completion ring. User requested About us-only rich-text pill tabs; implemented on Profile draft #239. Mobile/Calendar integration and full quality remain open; these width/progress changes are absent from those newer PRs. |
| 6. Older Calendar presentation | Compact month/agenda sizing, header/day controls, and Workspace tutorial presentation changes in #229. | **Overlapping.** Compare with mobile #235 and Calendar #237. Shared component conflicts mean the old presentation cannot be treated as an independent approved design. Preserve the user's latest mobile navigation and Calendar choices. |
| 7. Map camera and loading fixes | #229 accounts for an open drawer when framing selected markers and handles map recreation/reduced motion. The preserved baseline adds isolated loading placeholders for marker detail panels and shared-menu loading fixes. #229 also corrects the option that excludes private preview data from public fetches. | **Potential focused fixes.** These are distinct from map styling. Review camera behavior alongside the combined mobile drawer in #235; verify cold marker opening and preview isolation. The dedicated camera/loading helpers are absent from #235 and #237. |
| 8. Map result cards and resource guides | #229 changes compact result rows to larger image cards with richer descriptions and fallbacks. It adds essentials, transportation, documents/ID, and digital-access guide definitions. | **Design/content decision required.** The larger cards are a real redesign, not just a camera fix. Compare them with the current mobile drawer before choosing. Assess guide content separately from card geometry. |
| 9. Resource research and enrichment | Private IRS candidate intake, website resolution, evidence/research workflows, and draft work packages in #229. The additional owned crawler is separate PR #231, stacked on #229. | **Separate internal workstream.** Review the acquisition pipeline and publication gates independently. Code and passing tests do not establish that new verified resources are published on the map. |
| 10. Workspace Documents library | Preserved library layout, file tracking, storage usage, policy-document accounting, and Drive-related foundation. #238 adds subsequent connected-document and recovery work. | **Already belongs to the Documents assessment.** Do not create another duplicate backlog item here. Reconcile its baseline and current visual failures within #238. |

## Already on main: remove from this unfinished-work count

- Existing Google Drive connection and Workspace Tools center. Their feature
  trees are identical between main and #229. Later Drive import/edit/recovery
  changes in #238 remain separate pending work.
- Existing map weather/cooling feature. Its `src/features/find-map` tree is
  identical on main, #229, and the reviewed newer branches. This does not cover
  the distinct camera, card, or guide changes listed above.
- The Find-to-homepage route transition and Build/Collect navigation foundations.
  Earlier homepage design variants remain a separate assessment; branding #236
  is only the small About/Google section in the map drawer.
- Public-profile activation and Workspace access-management foundations.
  Their presence on main does not include the pending unified Profile editor.

## Where the latest work is saved

| Reference | Head inspected | Meaning |
| --- | --- | --- |
| `origin/main` | `cb9287b1` | Comparison baseline; no changes made. |
| #229: `feat/development-consolidation-20260902` | `4c42e323` | Older main-based bundle; current quality checks pass. |
| `chore/local-feature-baseline-20260914` | `be09d23a` | GitHub preservation of later combined work; not a release branch. |
| #238: `feat/documents-review-20260914` | `702b2a8d` | Based on that preservation branch; includes later Documents work and current main reconciliation. Visual/quality checks fail. |
| #235: `feat/mobile-experience-20260912` | `7401b83a` | Newer mobile/map presentation to preserve during reconciliation. |
| #237: `feat/google-calendar-review-20260914` | `31b317b7` | Newer Calendar implementation to compare with old presentation. |
| #231: `feat/resource-map-owned-crawler-20260902` | `ad4c5541` | Additional crawler, based on #229. |

The 238-file Documentation feature and 14-file decision-canvas feature are
byte-identical between the preserved baseline and #238. They are saved on
GitHub but sit in #238's base, so they are not presented as new work in that
PR's normal diff. There is no independent main-based PR for their latest version.

The preserved baseline also predates newer privacy/consent/account-deletion
fixes on main. Do not merge or copy that baseline wholesale. #238 contains a
later main reconciliation; source must be compared by feature, not branch age.

## Preserved worktrees and cleanup

These six inspected worktrees are clean and point to the same combined commit,
`bb262360`. Their names do not represent six different current implementations:

- `coach-house-platform-documentation-20260831`
- `coach-house-platform-find-map-camera-polish-20260828`
- `coach-house-platform-find-weather-cooling-20260828`
- `coach-house-platform-local-catchup-20260904`
- `coach-house-platform-unified-profile-settings-20260903`
- `coach-house-platform-workspace-ui-polish-20260828`

They are potential duplicate-checkout cleanup candidates only after a separate
authorization and fresh recovery check. Nothing was removed or moved.
The older `launch-clean` worktree has 104 dirty paths at this checkpoint and
remains outside this feature assessment. Its current contents must not be
assumed identical to the earlier private recovery snapshot.

## Remaining assessment order

1. Review the latest Documentation experience: library/search, planners,
   Marketplace/People. Decide what belongs in its first public version.
2. Review unified Profile settings as its own feature.
3. Compare the older Workspace width/progress changes and Calendar presentation
   with the newer mobile/Calendar work.
4. Compare map result cards and guides; assess camera/loading/preview fixes
   separately from the chosen appearance.
5. Review the resource enrichment/#231 pipeline independently, then return to
   #238 with its inherited dependencies clearly identified.

These are review steps, not merge or deployment instructions. No item is newly
declared production-ready by this assessment.

## Evidence and limits

- Compared current Git trees, component diffs, feature contracts, plans,
  worktree status, and GitHub check metadata. Used direct two-tree comparisons
  where repaired and preserved histories have multiple merge bases.
- #229 differs from main in 202 files. Its current required quality lanes pass.
  Those checks validate that bundle, not an extracted feature or a combination
  with #235/#237. Existing conflict evidence identifies shared map/Calendar
  components and tests.
- #238's current visual and aggregate quality checks fail. The preceding CI
  assessment identified 17 visual cases; static, acceptance, RLS and build pass.
  Documentation visual changes are inherited, so these are not all newly
  introduced Documents regressions. Failures were not repaired or rerun here.
- The earlier Documentation release plan records historical checks, not current
  release approval. Its older missing-search/no-remote-branch notes must not
  override current source and GitHub evidence.
- Pending database checks include the Documentation handle reservation and
  Documents library/storage migrations. Current remote application state was
  not inspected; do not equate a migration file with an applied migration.
- No fresh browser review, builds, tests, provider verification, public-data
  validation, or deployment inspection was performed in this pass. No source,
  PR state, branch, database, provider setting, or release state changed.


## Profile fixes checkpoint - 2026-09-14 18:27 EDT

The profile audit findings now have an uncommitted local implementation in
`coach-house-platform-profile-settings-fix-20260914`, branch
`fix/profile-settings-completion-20260914` (base `702b2a8d`, no upstream).
See that worktree's `docs/plans/2026-09-14-profile-settings-fixes.md` for details.
Static checks, 2,517 acceptance tests, eight isolated SQL suites, four browser
behavior tests, and two updated person-profile screenshots pass. User reported
overheating; remaining TypeScript/Graphify checks and temporary preview were
stopped. The DB migration remains unapplied and connected verification remains
pending. Nothing committed, pushed, merged, or released; this is not production
readiness approval. Earlier audit findings remain above as historical evidence.


## Profile database checkpoint - 2026-09-14 18:47 EDT

User authorized the shared database migration. Applied the documentation-handle
reservation and Profile settings migration; remote history and privileges are
verified, and all 159 existing explicit email preference choices were copied.
Both active checkouts now have complete applied migration history. Application
code remains local/uncommitted; no deployment or Git push. Connected app review
and remaining technical checks are still pending. No heavy processes restarted.


## Profile browser verification - 2026-09-14 19:06 EDT

Attempted updated-branch browser review in Bandto Chrome; local Workspace
compilation exceeded the user's resource tolerance and was stopped. No account
fields changed. Connected UI verification remains pending. A concrete hosted
preview/PR plan is prepared in the Profile worktree, awaiting permission to
commit/push and create a non-production preview. Original review tab restored.


## Profile GitHub checkpoint - 2026-09-14 19:13 EDT

Profile fixes are backed up in draft [PR #239](https://github.com/Hamernick/coach-house-lms/pull/239),
commit `8673bcff`, based on #238. Worktree is clean and tracks its remote branch.
Database migration is applied. Remote checks and preview builds are running;
connected UI verification remains pending. This remains a draft with no release
approval. Root's duplicate migration file is also preserved in this commit.


## Profile preview results - 2026-09-14 19:21 EDT

[PR #239](https://github.com/Hamernick/coach-house-lms/pull/239) is saved, synced,
and available in a non-production hosted preview. Static, acceptance, RLS, build,
and Profile-specific browser/visual checks pass. The same 17 failed visual tests
as #238 still block aggregate quality; no new failures. User sign-in to the
preview is required before the connected save/reload check. No production release.


## Profile connected verification - 2026-09-14 19:40 EDT

The hosted Profile canary passes. Fixed its missing server credential through
a Preview Secret scoped only to the Profile review branch; Production unchanged.
Authenticated Workspace now loads. In caleb@bandto.com, Profile edits saved
from Communications, survived reload, and synchronized public role/bio while
keeping About private. View profile correctly guards unsaved edits. All test
values were restored and verified after reload; email choices stayed unchanged.

[PR #239](https://github.com/Hamernick/coach-house-lms/pull/239) remains draft and
synced at `8673bcff`. Profile's reviewed behavior is ready for user acceptance;
release remains blocked by the same 17 inherited visual failures and the stacked
branch separation. No production release is authorized or performed.

## 2026-09-14 21:24 EDT - Workspace visual direction accepted; About us correction

User said they like the existing visuals. This supersedes the earlier pending-approval notes for the centered/narrower Organization/Accelerator layout and Core Documents ring. Production release is still held. User clarified the pill-tab request applies only to About us: Origin story, Need, Mission, Vision, Values and Theory of change. Identity, Contact and Social keep their existing presentation.

Profile worktree commit 6d4c782f is pushed to draft #239. It displays one About us section at a time, uses the existing sanitized rich-text renderer for all six fields, and retains the selected tab across view/edit. Hidden editors stay mounted/inert; drafts, keyboard navigation, deep links and validation focus were checked in a small isolated browser fixture. Cancel/in-memory Save checks do not constitute a real database-save canary. 25 focused tests plus targeted lint/structure/boundaries/ownership checks passed. Hosted Preview and new CI run 34917033164 remain in progress at this checkpoint.

Drawer CI at 1e85031f finished: static, acceptance, RLS and build passed, with the same 17 named visual failures as the existing stack. Original first-authenticated-load root cause remains unconfirmed. The separate AI authorization patch remains local, reviewed, and uncommitted. No production release, provider setting change, migration or real account mutation in this About us task.

### 2026-09-14 21:38 EDT - About us Preview verified

- Final Profile source HEAD 559dd008 is pushed to draft #239. Both Vercel Previews are Ready. Primary deployment 6449878846 explicitly has production_environment=false and SHA 559dd0084fd379638c82fa576f0fb1a8d38b85b4; direct URL https://coachhouse-q7kry56vg-calebs-projects-58ab1538.vercel.app.
- Hosted run 34917646107: static, acceptance, RLS and build/performance pass; visual still running. Aggregate quality/release readiness is not claimed.
- Bandto hosted check: six About us pill tabs, one exposed panel, 32px desktop pill height, wrapping inside the existing narrow content column. Existing rich Vision content renders headings and lists. Selecting Vision persists into Edit with only its editor visible; Cancel restores view with Vision selected. No form data was changed or saved. A click timed out after entering Edit; DOM inspection confirmed the transition and Cancel completed successfully.
- Isolated actual-component fixture proves draft retention, in-memory Save/Cancel, keyboard arrows, deep links, repeated validation focus and no focus stealing while correcting or editing other fields. Both static fixture servers are stopped. No full local builds/suites, Graphify refresh, new Next server, provider settings or production release.
- Source is synced; this final runlog evidence remains local/uncommitted. Root handoff/assessment notes are preserved and updated. About us correction is complete; next actual feature is map camera/loading behavior, preserving the approved mobile direction.

### 2026-09-14 21:50 EDT - Localhost synchronized for React Grab review

- User explicitly requires localhost to stay current because React Grab is unavailable to them on Preview. This supersedes the earlier instruction to review only on Profile Preview. Future reviewed UI changes must reach the existing root local checkout as well as any authorized Preview branch.
- Existing listener PID 47084 still serves /Users/calebhamernick/Development/coach-house-platform on port 3000. Root branch chore/local-development-20260907, HEAD b476ada1, existing dirty work preserved. No branch switch, server restart or additional Next server.
- Applied a focused patch from Profile HEAD 559dd008 for the About us tabs and drawer geometry correction: 11 source files, two existing tests and six QA fixture/docs files. All 19 files matched Profile source exactly after application. All 21 pre-existing dirty/untracked files were hash-verified unchanged before this intentional log/handoff update. No wholesale branch merge.
- Recovery copy: /var/folders/l2/jpghvb_52t10fnrzxcs0bpd40000gn/T/coach-house-local-review-sync-aygzr4nh (prior files, tracked patch, protected hashes, applied patch). Keep it.
- 36 focused local tests pass; whitespace check passes. Existing local server compiled the changed modules. Bandto localhost rendered all six pills and one visible narrative; Vision selection persisted into Edit with only its editor visible, and Cancel returned to view. React Grab owner metadata points to profile-field-tabs.tsx. No account values changed or saved.
- Browser connection changed during verification; supported rediscovery reattached Bandto Chrome (new runtime browser ID 1). Localhost tab 1787351845 is left on Origin story and marked deliverable. Do not assume old handles remain valid.
- Profile hosted CI 34917646107 has now finished: static, acceptance, RLS and build pass; the same 17 named visual tests fail (Documentation, Documents list, roadmap recovery), plus one Marketplace guide test passed on retry. No new production release or readiness claim. Map camera/loading assessment remains the next feature; it was paused to synchronize localhost.

### 2026-09-14 21:56 EDT - Map camera/loading source assessment

- Root localhost and Profile share the existing camera/loading corrections. Bottom drawer padding is in #229 and Profile, absent from inspected main and mobile #235. Do not lose it while preserving the user's final mobile visuals.
- Fifteen focused helper tests pass. Latest hosted visual job passed both held-chunk map-detail tests at 1440/390px. Live real-resource marker framing remains unverified because browser control timed out after opening the local map category view. No map source changes or production actions.
- Detailed comparison and next step: docs/plans/2026-09-14-map-camera-and-loading-review.md. Localhost sync/React Grab delivery remains complete for the reviewed About us and drawer changes.


### 2026-09-14 23:19 EDT - Latest map card/guide review

See [map result cards and guides review](2026-09-14-map-result-cards-and-guides-review.md): larger-card preference pending;320/390px checks pass; Transportation content readiness remains open. Saved-guide compatibility correction d553f577 is pushed to draft #235, with hosted validation pending. Root localhost already has the known guide IDs and now shares all five new regression cases; all9 route tests pass. Production remains held.


### 2026-09-14 23:37 EDT - Compact rows selected; localhost current

User chose shorter map result rows. Implemented from existing Mobile design on root/Profile, with larger-card history/backups preserved. Profile draft #239 source25b48860/test follow-up22ff5b30;40 focused tests pass, final hosted checks pending. Live320/390/1440/2560px checks show80px rows without horizontal overflow; details/back work. Mobile saved-guide fix f12fbdc9 now passes every hosted quality lane and both Preview checks. See [current card/guide review](2026-09-14-map-result-cards-and-guides-review.md). Production remains held; guide-content readiness is next.


### 2026-09-14 23:49 EDT - Final compact-row state

Profile22ff5b30: both non-production Previews Ready; static/acceptance/build/RLS pass. Visual131 pass/17 fail, exact failed-name match with the prior run; aggregate quality remains blocked. Compact rows and40 targeted checks are current on localhost. Review: [cards and guides](2026-09-14-map-result-cards-and-guides-review.md). Next: guide-content readiness. No production release.


### 2026-09-15 00:16 EDT - Latest map presentation correction

User reported excessive width and damaged card styling. Profile496ef3cf/root restore image/text presentation at compact dimensions and narrow the populated result column to search width.40 targeted tests/lint pass; hosted checks pending. See [current card/guide review](2026-09-14-map-result-cards-and-guides-review.md). This supersedes the plain icon-row interpretation; production remains held.


### September 15 - Current completion checkpoint

Core objectives: Drawer95% (zero-height blank-content regression reproduced and fixed by the existing hook; original hosted incident still unconfirmed), AI authorization preparation100% (local reviewed patch, no deployment), Workspace/map assessment100% (Basics completed with1,538 external records,0 field-complete/verified/publishable), About us100%. The user has not yet rechecked the original drawer incident.

Cooling presentations now depend only on the existing heat signal. Explicit cooling guides/searches use normal versions below threshold; saved IDs remain preserved. Root localhost remains current. Details: [map assessment](2026-09-14-map-result-cards-and-guides-review.md), [seasonal rule](2026-09-15-resource-seasonal-presentation.md), [drawer regression](../qa/workspace-drawer/README.md).

Latest pre-push hosted audit: Mobile0b92daf0 passes every quality lane; Profile2931f0d3 passes static/acceptance/RLS/build but retains17 named visual failures and failed aggregate quality. Both have successful non-production Previews. The same failed names alone do not prove identical image diffs. Production remains held. AI proxy normalization and client-controlled SQL read-only execution remain separate unfinished security reviews; the prepared authorization fix does not resolve them.

### September 15 — Drawer focus correction and hosted visual review

Profile draft #239 is at0101122d, pushed and synced; only its existing monthly runlog remains dirty. Root localhost3000 includes the same flow-frame correction and reviewed visual references; its existing source/notes remain uncommitted. Mobile draft #235 is ec0b73d4, clean/synced, all hosted quality lanes and both Previews pass.

Authenticated Preview fullscreen/restore exposed a real additional drawer defect: the outer overflow-hidden frame scrolled36px on focus. The one-class overflow-clip correction reproduces correctly in the actual Vaul fixture and localhost: exact48% visible after restore, outer scrollTop0; nested content scrolling still works. Eleven existing acceptance tests and focused lint pass. The tiny3043 fixture server is stopped. Historical first-authenticated blank/full-height cause remains unconfirmed; Drawer95% is retained. See docs/qa/workspace-drawer/README.md.

Profile a1902c12 passed all17 first-pass screenshot comparisons and all nonvisual lanes, exposing20 later screenshot differences in9 tests. All20 expected/actual/diff images were reviewed: text rendering/line wraps, no altered container/control layout. Eleven actual/retry images identical; nine differ1–29 pixels. Added20 Linux counterparts, preserving originals and thresholds, for37 newly reviewed references total. Source0101122d hosted CI34988243268 is running; do not claim quality complete until it finishes. Evidence: docs/qa/profile-visual-reference-review-20260915.md.

AI authorization preparation100% remains local and undeployed. Workspace/map assessment100% and About us100% remain complete within their recorded scope; resource publication blockers remain. No production release, Calendar activation, provider/database mutation, new Next server or Graphify refresh.

### September 15 — Profile hosted quality and drawer canary complete at0101122d

- Profile draft #239 commit0101122dfa3d6d741feaa52fd97c3a6ee7563511: CI34988243268 passes static, acceptance, RLS, build, visual and aggregate quality. Visual147 passed,1 passed on retry. The retry was the paid-account Documentation search-focus assertion, not a screenshot mismatch; recorded as a remaining intermittent test observation. All37 newly reviewed Linux references pass without tolerance changes. Full visual log: /tmp/coach-house-profile-0101122d-visual.log.
- Both Preview deployments are successful and explicitly non-production at that SHA. Primary deployment6462403326: https://coachhouse-dyot3g70d-calebs-projects-58ab1538.vercel.app . Verified through the existing authenticated Bandto branch alias, whose rendered frame now has overflow clip.
- Hosted fullscreen/restore then Organization:589px canvas,306.28px translation,282.72px visible (exact48%), outer scrollTop0. The prior36px unwanted canvas scroll is resolved. Localhost also passed this sequence and nested scrolling; its existing Next process47084/port3000 remains current.
- Fresh authenticated navigation:50 bounded DOM samples, first mount offscreen, then exact48% height. One early sample had0 panel text characters; the sample did not capture skeleton DOM and therefore does not establish a visually blank panel. The source lazy loader provides skeletons. A subsequent31-sample navigation observed483 panel text characters on its first visible sample, correct48% height and no outer scrolling. No full-height/drag-dependent failure occurred. Existing auth/cache retained; no new-login or frame-perfect proof. Original historical incident remains unconfirmed and Drawer95% stays explicit.
- Restored the hosted Organization view. Root localhost is marked deliverable. Both tiny fixture server sessions are stopped; no additional Next server, full local suite/build or Graphify refresh. Profile source is pushed/synced; its preserved monthly runlog stays local. Mobileec0b73d4 remains clean/synced with every quality lane and both Previews successful.
- Core objectives: Drawer95%; AI authorization preparation100% (local, reviewed, undeployed); Workspace/map assessment100% within the recorded reviewed-guide scope (publication blockers remain); About us100%. No production release or Calendar activation. Next: original first-login confirmation, then continue the remaining older-work feature inventory.

### 2026-09-15 12:10 EDT — First-login deferral and next inventory feature

User explicitly deferred first-login confirmation. Drawer95% is deferred, not a prerequisite. Campaign planner assessment is complete: live localhost edit/reload/restoration passed, current hosted export/storage checks pass, and browser-only saving is documented. Source is saved in the preserved Documents/Profile stack; a focused main-based Documentation change remains release work. See [planner assessment](2026-09-15-documentation-planner-assessment.md). Next: Brand Identity asset/ZIP workflow. No release or provider/database change.

### 2026-09-15 12:25 EDT — Brand Identity assessed

Brand Identity assessment100%; implementation needs storage-failure, transaction-completion and initial-export fixes before release. Normal localhost text save/reload and actual ZIP readback pass. Original visible text restored; no existing assets changed. See [Brand Identity assessment](2026-09-15-brand-identity-assessment.md) for precise evidence and limits. No app changes or release. Next: Documentation Marketplace/People. Drawer first-login confirmation remains user-deferred.

### September 15 - Marketplace/People reviewed; requested header implemented

Profile draft #239 f2fe76cf and root localhost share the new Marketplace heading/category/search layout.52 focused tests pass; hosted full checks and intentional visual reference review pending.23 catalog resources,3 coaches,1 locally observed published person. Current Marketplace/People owners are absent main/#229, present preserved/#238/#239. People pagination drops resource filters (source finding; pre-release follow-up). See [assessment](2026-09-15-marketplace-and-people-assessment.md) and [layout](2026-09-15-marketplace-header-layout.md). Brand Identity fixes remain queued; original first-login confirmation remains deferred. Next inventory feature: Calendar.

### September 15 - Calendar assessment complete

[Calendar inventory](2026-09-15-calendar-inventory-assessment.md): #23731b317b7 remains draft with2 mobile screenshot alignment failures;24 focused tests pass. Root contains the integration and later sidebar/close controls; Profile#239 does not contain the Calendar feature. Local sidebar open/close checked without changing sync. Combined mobile integration/full quality and separate production authorization remain required. Next: acquisition#231, then remaining Documents.

### September 15 - Marketplace final quality passes

Profile0b6a3f4a passes all quality lanes in CI35017956570 and both Previews are Ready. Marketplace100%; root localhost synchronized. Calendar assessment complete; its separate integration/visual/release gates remain. Brand Identity reliability and People pagination filter retention remain queued. Next: acquisition#231, then remaining Documents.


### September 15 - Resource acquisition assessment complete

[Acquisition assessment](2026-09-15-resource-acquisition-assessment.md): draft#231 ad4c5541 is preserved on GitHub, stacked on#229; a complete same-head CI run passed and20 focused tests pass now. Existing46-page/92-request plan and parent hash binding validate; dry run performs0 crawler network/AI/paid/database/review/publication activity. Later Profile/root executor differs only by40 lines of type annotations, which should be preserved. No verified live canary or canonical owned-crawl output was found. No source edits, live crawl or release. Next: Workspace Documents#238/#239.


### September 15 - Workspace Documents assessment complete

[Documents assessment](2026-09-15-documents-inventory-assessment.md): #238 implementation remains preserved and unchanged in the compared #239 Documents/import/Drive/roadmap directories.70 focused tests pass. #238's17 screenshot failures are addressed by later reviewed references in #239; exact-head full CI passes. Recovered September11 evidence confirms real Markdown import/edit/save/reload, linked-file persistence and unchanged private Google source. Current Bandto Documents grid/list renders without overflow. No repeat setup, import, source edit or release. Remaining gates: dependency reconciliation, final combined product/quality/release review and non-empty native Google Doc live proof. Next: People pagination filter retention.


### September15 — Marketplace People pagination repaired

Current local Profile/root pagination preserves all five resource filters through page changes and returning to resources. Nine focused tests, scoped lint, feature contract, React Grab ownership and actual Bandto previous-page round trip pass. Details and live forward-page limitation: [Marketplace follow-up](2026-09-15-marketplace-and-people-assessment.md#september15--people-pagination-repair). Later local catalog now34 resources with34 provider logos; these and this repair remain uncommitted and are not covered by the earlier hosted quality run. Next: Calendar/mobile composition and its two visual failures. Production hold remains.


### September15 — Calendar/mobile integration and hosted quality complete

Draft#2376ce80db6 preserves approved mobile sidebar/close controls and shared Dialog/Sheet styling; two reviewed setup references now retain Linux/macOS variants. Full CI35036908856 passes;55 browser cases passed first attempt and one full-page Calendar comparison passed on retry. Both Previews are Ready; localhost is current. Published monthly-log conflict was resolved without a branch merge or lost entries. [Current evidence](2026-09-15-calendar-inventory-assessment.md#final-hosted-quality--6ce80db6). No production release/activation. Next: latest local Marketplace work in Profile#239.
