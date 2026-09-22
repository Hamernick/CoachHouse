# Drawer, AI authorization, and next Workspace review

September 14, 2026 continuation. No release authorization.

## Verified starting state

Main cb9287b1; Profile 8673bcff, clean and synced before this session.
All seven open PR heads/check conclusions match the prior handoff. #235/#236/
#229 quality passes; #237/#238/#239 visual/quality fails. #231 retains a passing
complete run alongside canceled duplicate results. Failure counts were not
recomputed. Earlier #233/#234 privacy releases remain part of history.

Root's initial 10 modified/10 untracked files, including the handoff, were
preserved. Inventory inspected 43 accessible worktrees and retained eight
unavailable registrations. Other existing dirty work remains in Documents/
Calendar integration (9 paths), Calendar (55), Drive UI (17), launch-clean
(104, including one deleted path), and temporary PR231 QA (27 staged paths).
None of those changes, stashes, archives or preservation branches was moved,
removed, reset, committed or merged by this session.

## 1. Drawer: concrete geometry fix, original symptom still unverified

Profile worktree:
`/Users/calebhamernick/Development/coach-house-platform-profile-settings-fix-20260914`
Branch: `fix/profile-settings-completion-20260914`, updated to `1e85031f`.

A fresh authenticated Bandto Preview tab rendered correctly after settling:
878px canvas, 810px translation, 68px visible, 36px inner viewport. Immediate
inspection after navigation timed out; this was not first-paint capture.
Sampled browser error/warning logs were empty.

An isolated 259KB React/Vaul fixture showed:

- Delayed portal mounting alone works: no source patch justified by that theory.
- Container growth from 220 to 320px without window resize leaves stale snap
  offsets: baseline exposes 168px instead of 68px with both immediate/late portals.
- New drawer-owned ResizeObserver hook refreshes Vaul's snap points: both fixed
  cases expose 68px; middle/full/collapse transitions measure 153.6/320/68px.

The source patch fixes this demonstrated container-resize defect. It does not
prove resizing caused the user's first authenticated-load failure. Hosted
cold-load verification of the patched app remains necessary before closure.
Targeted ESLint and all 11 existing drawer tests pass. Fixture and detailed
reproduction live in that worktree's `docs/qa/workspace-drawer/`.

Patch committed/pushed as `1e85031f` to the existing authorized Profile Preview
branch. Both Vercel Previews succeeded (primary GitHub deployment 6449519028,
production_environment=false). Static, acceptance, RLS and build lanes pass;
visual tests are still running at the latest checkpoint. No design,
provider, migration or account data change. The temporary loopback static fixture
server was stopped; no Next server/full build/suite or Graphify refresh ran.

## 2. Separate AI authorization patch prepared

Worktree: `/Users/calebhamernick/Development/coach-house-platform-ai-auth-fix-20260914`.
Branch: `fix/management-developer-authorization-20260914`, based on main cb9287b1,
no upstream or remote counterpart.

The shared management guard now requires current developer staff membership.
Coach/missing/invalid rows deny with 403; staff lookup errors/rejections deny
with 500. No legacy profile-role fallback. AI generation and all six proxy
methods check it before provider calls; current developers remain allowed.

Before patch: 63/87 new tests failed. After patch: 95/95 new/adjacent tests pass;
targeted ESLint passes. The security fix skill required one independent boundary
investigator and one independent candidate reviewer; the latter found no
concrete authorization bypass/regression and independently passed all 87 tests.

No real provider/model calls, account demotion, database mutation, migration or
credential change. Full hosted quality remains pending. Patch/test/plan/log are
local and uncommitted; no PR or Preview created for this branch. Detailed evidence:
that worktree's `docs/plans/2026-09-14-management-developer-authorization.md`.
Proxy path normalization and server-enforced read-only SQL execution remain
separate unfinished reviews. No production compromise is established.

## 3. One existing feature opened: Workspace layout/progress

The Bandto Preview is left on Organization. It shows the existing centered,
narrower content column and the Core Documents progress ring (89% complete).
Source confirms the narrower panel and ring are present in #229 and Profile,
absent from main, mobile #235 and Calendar #237. They are not superseded simply
because newer branches omit them.

| Dimension | Current evidence |
| --- | --- |
| Product approval | Accepted September 14 after clarification: user likes the existing visuals and requested About us-only rich-text pill tabs. Production release remains held. |
| Code readiness | Implemented and saved on GitHub; #229 quality passes for the bundle. Current Profile stack still fails aggregate quality. |
| Configuration | The inspected width/progress display adds no new provider setup. |
| Deployment | Visible in hosted Profile Preview; not present in inspected main source. No production release this session. |
| Live verification | Existing organization content and 89% indicator rendered. No edit/save/reload canary or recalculation audit in this pass. |

Next: address one visible element at a time, preserve these changes during
mobile/Calendar integration, and validate the patched drawer on a hosted cold
load. The release hold and shared-production-database boundary remain active.

## Hosted drawer follow-up at 1e85031f

Primary Preview deployment:
https://coachhouse-acm6ukfhg-calebs-projects-58ab1538.vercel.app

A fresh Bandto tab rendered the persisted full-height Documents panel. Selecting
Accelerator displayed its content. Collapse set 810px translation in the 878px
canvas. After reload, screenshot confirmed the collapsed Accelerator strip;
clicking Accelerator showed its content again. DOM calls after reload timed out
repeatedly, while screenshot/pointer APIs remained usable; this is a browser
measurement limitation, not proof that the application hung. No frame-by-frame
first-authenticated-load proof or confirmed explanation of the original incident.
The fixed container-resize regression remains supported by the isolated fixture.

New source/fixture code is saved on GitHub. Root follow-up notes, local runlog
updates (including a timestamp correction), and the separate AI patch remain
uncommitted. No production release or feature activation occurred.

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
