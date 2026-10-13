# Rapid UI consolidated local review

**Closed by Caleb on October 12, 2026.** Remaining follow-ups are tracked in his separate to-do list; its location was not supplied. PR [#288](https://github.com/Hamernick/CoachHouse/pull/288) merged as `73dd8d15`; the canonical `coachhouse` Vercel deployment reports success. Migration `20261012163000` was applied and verified. This closes this workstream, not every verification gap: final PR visual/quality checks failed, the secondary Vercel project failed, and authenticated signup/payment/unlock verification remains unconfirmed. Do not resume historical tasks below without a new request. The connected planner remains abandoned.

The remainder of this document is historical evidence, not an active task queue.

Review target: the internal rapid-UI worktree on localhost:3001. This is a local product-review checklist, not a deployment receipt. User review follows implementation and focused automated verification; production changes and worktree retirement are separate.

## Latest onboarding correction

Fresh signup now starts with Organization/Activity side by side and Accelerator/Roadmap below. Fiscal sponsorship stays hidden, including through the legacy tutorial-completion path. Replaying the guide on a configured organization preserves its saved arrangement and visible cards; it is not a fresh-signup simulation. Guide title/body spacing is tighter. Review both cases without resetting a real organization's saved board.

The original static guide failed user review. The revised walkthrough now changes canvas/drawer context across seven stops, uses a compact gradient header without an orb or displayed step counts, anchors guidance beside actual controls, and keeps a compact Next control during hands-on use. Review this revision at `/workspace?guide=1&guideStep=welcome`; the earlier onboarding readiness statement is superseded. Visual approval remains open.

## Latest continuation checks

- Saved-step resume now restores the actual drawer, Activity tab and checklist focus; existing viewer/organization remounting preserves progress isolation.
- Public organization visibility saves immediately expire public-map/profile caches, matching program visibility behavior. Failed saves do not invalidate caches.
- 175 unique focused tests across 15 suites and changed-file lint pass. These are local automated results, not authenticated browser or production evidence. No browser is currently connected; user-confirmed appearance corrections remain valid and do not need wholesale retesting.

## Publication follow-up

- Public program switches still allow withdrawal when sharing is disabled; new publication attempts return a server error instead of silently changing visibility.
- Profile publication prevents duplicate submissions, clears stale error text on reload and resets feedback when switching organizations.
- 90 unique focused tests across six suites and changed-file lint pass, covering failed/missing writes, public cache invalidation, selected-program preview revisions and exclusion of private builder fields.
- The earlier full TypeScript run failed in test fixtures. See [type-check follow-up](typecheck-followup.md); the guide test typing was corrected locally, remaining diagnostics require final verification.
- Per user direction, fresh-signup and the full interactive sweep are deferred until the end. This follow-up does not publish any live record.

## Review journeys

| Area | Start | What to review |
| --- | --- | --- |
| Organization profile | Workspace → Organization drawer | Logo/title spacing, full rounded border, actions above banner, Donate placement, compact colored social icons, copyable text, tabs aligned to separator, mobile tabs |
| Sidebar/header | Workspace, expanded and collapsed sidebar | Organization switcher/toggle alignment, symmetric rail spacing, team-access/search separation, collapsed Admin dropdown, no Find on desktop/mobile |
| People | Workspace → People drawer | Desktop and mobile toolbar; search/filter/Add/Columns remain reachable with no results; opaque pinned cells; frozen titles; drawer menus cannot click nodes behind them |
| People placement | Drag a person from the table onto a visible canvas point | Exact position; double-click/tap the handle adds or reveals and focuses; already-placed handle says On workspace; ordinary checkbox selection remains separate |
| Accelerator overview | `/workspace?drawer=accelerator&focus=organization-launch` | Full-height reload; equal banner gaps; dismiss/recover; wide banner spans launch/lessons columns; mobile stack; actual front-page map in 16:9; truthful Public/Private; no 501c3 tag |
| Editor navigation | Open a checklist action or roadmap document/lesson | Full-height editor, breadcrumb/deep link, unsaved-change protection, successful save and Back return to originating context |
| Entry onboarding | `/onboarding`, with a new/incomplete account | Current copy and required fields; keyboard/scrolling; drafts survive recovery; free/paid/invited paths preserve their rules; no duplicate organization |
| Guided onboarding | Workspace setup guide | Consistent compact guide styling, real profile/program actions, saved completion, skip/resume/reopen, readonly alternatives, reduced motion, organization isolation |
| Public review | `/workspace/profile-preview` | Exact public-safe fields and published programs; no private documents/contact fields; intentional publish/unpublish; error recovery; location status separate from visibility |
| Theme/runtime | Reload then switch light/dark/system | No React script warning; no stale/half-height drawer; no blank state masking an error |

## Scope boundaries

- No publication is performed automatically. A local preview may connect to the existing configured backend; this checklist does not authorize test data creation or publication by an agent.
- This lane excludes the wrong-chat IRS consolidation, public-home search relocation, Hairline Exploded experiment, public-map redesign and unrelated Marketplace/Drive CI cleanup.
- Changes already shipped elsewhere are reconciled only where this local work depends on them. Do not replay unrelated worktree history.
- The full public redesign and optional AI planner are not part of this implementation.

## Implementation status across this chat

| Request group | Status at this handoff | Remaining |
| --- | --- | --- |
| Profile border/header/actions/links/tabs, activity sharing | Implemented; selected initial fixes already merged in PR #276, later refinements remain local | Consolidated appearance review, release diff reconciliation |
| Sidebar Find hiding, collapsed Admin menu, shell alignment | Implemented locally; merged mobile Find removal reconciled | Mobile/collapsed/expanded review |
| People controls/mobile layout, opaque pinned cells/sticky titles, drawer event isolation | Implemented locally; handle extracted to satisfy component-size contract | Touch, scrolling, selection and drawer interaction review |
| Exact person placement, double-tap focus, On workspace handle | Implemented locally | Drag/drop and focus review at actual zoom levels |
| Roadmap menu, launch card, real map, banner layout/copy/dismissal | Implemented locally; launch card retained, only 501c3 tag removed | Map/rendering, responsive layout and dismiss/resume review |
| Deep links, editor breadcrumb/return flow, full-height drawer reload | Implemented locally, including guide/editor return context | Save/cancel/history/refresh review |
| Theme script warning | Local fix and regression tests present | Theme switch/reload review |
| Signup/organization entry and contextual setup guide | Entry/recovery implemented; contextual walkthrough reworked after rejected static guide | Revised appearance, sequencing and interaction review |
| Public map-profile review, publication and programs | P1–P5 implemented locally | P6 authorized publish/unpublish, anonymous readback and release checks |
| Connected planner | Abandoned at user request; local additions removed | Do not resume |
| Local server/cache | Fresh isolated localhost:3001 process; cache cleared and compile blocker corrected | Authenticated page review; monitor actual working-set/load behavior |
| Extensive plans and task inventory | Master and two active detailed plans updated, this complete review packet added | Incorporate review findings |
| Release/worktree closure | Not performed | Current-head quality/visuals, branch protection, explicit release stage and production readback |

The separate connected planner and its proposed extensions are abandoned. The public-page redesign and unrelated Marketplace/Drive work remain outside this lane.

## Historical automated evidence — October 10

The consolidated counts below predate planner removal; they are historical evidence, not the current release gate. See the latest runlog for removal checks.

- Final consolidated run: **33 suites, 262 tests passed** across onboarding/recovery/guide, publication/location/programs, planner, profile/sidebar/header, People placement/table, drawer, navigation and theme.
- Application-source TypeScript passed using the repository configuration plus its root declarations, excluding the already-known unrelated test-fixture errors. This does not claim a clean repository-wide test typecheck.
- Scoped ESLint and `git diff --check` passed.
- Twelve repository guardrails passed: structure, routes, features, feature scaffold, thresholds, import boundaries, workspace storage, interaction locks, React Grab, workspace surfaces, raw buttons and acceptance manifest.
- Next SWC server-action transforms passed after correcting a pure re-export facade incorrectly marked `use server`; the dev compiler exposed that error despite TypeScript passing.
- Zero-row configured-backend reads returned HTTP 200 for objectives, objective steps and links with required columns. These reads created or modified no data and do not substitute for authenticated mutation/RLS review.
- localhost:3001 listener belongs to the rapid-UI worktree. Fresh Webpack dev process uses a process-local sharing flag; no shared environment file or production setting changed. Protected Workspace and profile-preview checks return the expected HTTP 307 sign-in redirects in about half a second once compilation settled. This is availability evidence, not authenticated rendering proof.
- User appearance/interaction review and affected visual baselines remain pending. Hosted quality, merge, deployment, production configuration and live verification are later release gates.

## Review entry links

1. [Accelerator overview](http://localhost:3001/workspace?drawer=accelerator&focus=organization-launch).
2. [Setup guide](http://localhost:3001/workspace?guide=1&guideStep=welcome).
3. [Public profile review](http://localhost:3001/workspace/profile-preview).
4. [Entry onboarding](http://localhost:3001/onboarding) for an incomplete/new account; complete accounts retain the existing redirect policy.

Start with the guide → profile editor → public preview → return journey, then the existing profile/People/sidebar refinements. Use the same journeys on mobile, both themes and reduced motion. Record actual findings before updating visual baselines or preparing a release.
