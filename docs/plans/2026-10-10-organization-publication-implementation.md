# Organization launch, public preview and publishing

**Closed by Caleb on October 12, 2026.** Remaining follow-ups are tracked in his separate to-do list; its location was not supplied. PR [#288](https://github.com/Hamernick/CoachHouse/pull/288) merged as `73dd8d15`; the canonical `coachhouse` Vercel deployment reports success. Migration `20261012163000` was applied and verified. This closes this workstream, not every verification gap: final PR visual/quality checks failed, the secondary Vercel project failed, and authenticated signup/payment/unlock verification remains unconfirmed. Do not resume historical tasks below without a new request. The connected planner remains abandoned.

The remainder of this document is historical evidence, not an active task queue.

Date: October 10, 2026. Status: P1–P5 implemented locally; P6 user review and release verification remain.

Parent: [Master plan](2026-10-09-canvas-onboarding-roadmap-plan.md).
Related: [Onboarding](2026-10-10-organization-onboarding-implementation.md).

## October 10 local implementation closeout

| Slice | Implemented behavior |
| --- | --- |
| P1 | Reconciled merged PR #276 profile safety, mobile Find and private-program defaults into this preview; retained existing sharing policy and server authorization |
| P2 | Saved visibility is separate from absent/online/unresolved/ready public location; changed unresolved addresses clear stale coordinates, visibility-only saves preserve coordinates |
| P3 | `/workspace/profile-preview` uses the actual map detail renderer and shared allowlisted map projection; only explicitly public programs are included |
| P4 | Explicit publish/unpublish, active-organization checks, stale-review revision protection, pending/error recovery, editor and guide return routes |
| P5 | Existing per-program sharing, private defaults and public About → activities ordering retained and tested |

The preview authenticates the actor and requires organization edit permission before loading private review data. Public projection is shared with the map query; arbitrary private profile fields and unknown nested typography keys are excluded. Publication reuses the canonical organization update path with expected organization/version checks. Organization visibility saves now immediately expire both public-map and public-profile caches, matching program visibility saves; failed saves do not invalidate them. Program withdrawal remains available when the sharing flag is disabled; new publish requests explicitly fail without altering saved visibility. Duplicate profile submits are guarded; reload clears stale error feedback and switching organizations resets publication feedback. No organization was published to exercise the interface.

Policy boundary: this preview describes the current **map profile**. The separate older `/[org]` handle-page query has existing staff/board visibility behavior; it was not redesigned or newly exposed here. Do not promise that this preview changes every legacy public surface. Optional consent/people-policy redesign remains separate.

Local sharing is enabled only for the localhost process. Production flag, hosted revision, cache behavior and anonymous live output must be verified during release. Relevant public profile/program, authorization, conflict and geocoding tests pass; visual and authenticated mutation review remain P6. See [the review packet](../qa/rapid-ui-local-review-20261010/README.md).


## 1. Outcome

An authorized organization editor can see what still needs attention, review exactly what anonymous visitors will see, deliberately publish or keep the organization private, and understand whether a public map marker actually exists. Programs can be published independently within the organization's public visibility rules.

Deliver this against the existing public pages before the separate map/profile redesign. Public rendering should consume a stable safe projection so the later redesign can change appearance without duplicating data or visibility policy.

## 2. Current implementation and fixed decisions

Evidence is the local rapid-UI worktree and runlog, not refreshed production/provider state.

| Item | Local state as of October 10 |
| --- | --- |
| Launch card | Exists in `src/features/organization-launch`; title is exactly “Build your nfp” |
| Tag | “501c3” was removed at the user's request; the card itself stays |
| Card contents | Public/Private indicator, real public-map preview, saved-data checklist and editor links |
| Banner | Compact, dismissible and recoverable; explains the Accelerator and how to begin |
| Wide layout | Banner spans both columns; launch card left, Accelerator progress/lessons right |
| Narrow layout | Banner, launch card, progress/lessons stack in reading order |
| Spacing | Banner has 24px above and below; card remains capped at 420px |
| Map | 16:9 preview reuses front-page map options/artwork and a published marker feed |
| Map limitation | Preview is not proof that this particular organization's location is published |
| Completion | Derived from saved organization fields and program count; completed publish row says “Published” |
| Editor entry | Organization edit requests open full height; return links are restricted to supported local destinations |
| Return behavior | Successful profile saves return to checklist; manual Back to checklist remains; program save is separate |
| Reload correction | `focus=organization-launch` survives server/client parsing and opens full height; focus scroll is scoped to drawer content |
| Program visibility | Existing per-program control and public consumers exist; effective deployed sharing configuration still needs verification |

Keep these user decisions. Do not reintroduce the deleted tag, remove the card based on its pasted parent metadata, use an unrelated map renderer, or put the banner beside the card.

The card currently renders a count of all displayed checklist steps plus an optional count, while its suggested next action uses essentials. Evaluate whether this remains clear in the finished flow; if changing it, use explicit “essentials ready” and optional labels rather than silently changing the meaning of progress.

## 3. Scope and definitions

| Concept | Meaning | Evidence required |
| --- | --- | --- |
| Setup readiness | Helpful guidance about saved fields | Canonical profile/program values and current server requirements |
| Permission to publish | Actor may change organization visibility | Server-side organization role and applicable policy |
| Public profile | Organization is explicitly public | Saved visibility plus authorized anonymous projection |
| Discoverability | Public profile is included in the relevant public directory/search | Current public query/index response; not just a successful save |
| Map placement | A public marker is available for the organization | Accepted public location, usable coordinates and public marker inclusion |
| Program visibility | A particular activity may be publicly rendered | Its own saved flag and the parent organization's publication policy |
| Legal/formation status | A separate organization attribute | Existing verified source/policy; never inferred from watching lessons |

No new legal status or Accelerator-completion requirement should be introduced as a publishing prerequisite. Current eligibility and entitlement requirements must be read from the server implementation before promising access. A client checklist is never authorization.

## 4. Target user journey

1. Open Accelerator overview and see current saved setup state.
2. Choose an incomplete row; open the real editor at full height and the relevant field/tab.
3. Save successfully and return to the launch context, or cancel using existing unsaved-change protection.
4. Open “Review profile” when ready; render the same public projection used by anonymous visitors.
5. See a clear explanation of selected programs, public contact/location fields and any remaining issue.
6. Choose Publish or Keep private. Publication requires an explicit authorized action.
7. After confirmed save, show Public and the real public destination. Report map placement separately.
8. Continue with optional profile improvements or Accelerator lessons. Unpublishing keeps all editable work.

The flow must also work by direct URL and after refresh. It cannot depend on having clicked through the guide in this session.

## 5. Review screen and content contract

Use the existing drawer/editor framework and a shared public-profile renderer or adapter. Prefer a compact review header, actual profile content, a short visibility summary, and one deliberate publication control. Do not make the review a screenshot or a second editable organization form.

Proposed review structure:

```text
Back to setup                         Public profile preview
Your profile is private. Only the fields shown here will be shared.

[Public logo/banner/name/description]
[Public website/contact/social/donation links]
[Selected public programs, if any]
[Public location or online destination, if chosen]

[Location status and any concrete publishing issue]
Keep private                                      Publish profile
```

This is a content hierarchy, not a mandate for another large card. Preserve the existing minimal profile style. On mobile, keep readable content and reachable actions without a second nested page-sized scroll area.

| Data | Public preview rule |
| --- | --- |
| Organization name, description, logo/banner | Use exactly the public query's allowed fields and formatting |
| Website/newsletter/social/donation | Safe supported URLs and existing link policy; no auto-loading arbitrary favicon origins |
| Programs | Show only those explicitly public and allowed by organization visibility |
| People/team | Do not infer consent from internal membership or drawer visibility |
| Documents/notes | Excluded unless a separate established public contract explicitly includes them |
| Physical location | Show only the chosen public representation; private addresses must not enter projection or map payload |
| Online location | Show the saved validated destination; do not invent a physical pin |
| Admin/provider data | Excluded, including internal identifiers, raw enrichment links, reviewer notes and private evidence |

Draft preview requires authenticated authorization. It must never create an anonymously accessible preview route that exposes private organization data. If the preview accepts an identifier, resolve access server-side rather than trusting the caller's organization ID.

## 6. Publication and location state model

Derive the following presentation states from existing data where possible. Add stored state only when a demonstrated server workflow needs it; avoid schema work solely to support labels.

| Condition | Suggested label/instruction | Available action |
| --- | --- | --- |
| Incomplete draft | Private; name the next missing essential | Continue setup |
| Ready draft | Ready to review | Review profile |
| Save/publish pending | Publishing… with retained action label/context | Prevent duplicate writes; allow safe failure recovery |
| Published profile, no public location | Public; a pin is optional | View profile; add public location if desired |
| Online-only | Online organization | Open online destination; no pin claim |
| Location resolution pending | Location pending, only if backend evidence establishes a pending job | Keep using profile; check later or edit location |
| Location unresolved | Explain the specific recoverable issue | Edit location; retain public profile where policy permits |
| Public marker confirmed | On the map | View actual marker/profile |
| No edit permission | Explain who can publish | View saved state; use existing access-request flow if available |
| Sharing unavailable | Plain-language availability explanation | Preserve draft; avoid an unexplained disabled switch |
| Unpublished after prior publication | Private | Continue editing; republish deliberately |

Do not show “Location pending” indefinitely just because coordinates are absent. Distinguish no location chosen, online-only, geocoding failure, pending processing and withheld/private location. Indexing lag is not a failed profile save; avoid encouraging duplicate writes as a recovery.

## 7. Programs and public pages

The user wants programs/activities visible on public organization profiles, preferably below About. Preserve that order as the default while coordinating with the public-page redesign.

Use the existing `is_public` activity flag and existing write authorization. Toggling visibility must not create a duplicate program, alter its operational status, or publish the parent organization. A program marked public inside a private organization must still follow the public query's parent visibility rules.

Keep draft programs private by default. Show clear pending/error behavior on the switch and reconcile after failed saves. Verify removal from public response after unpublishing, including cache invalidation; do not validate only that a client card disappeared.

The public-page redesign should consume the same public program projection. It can change layout and presentation independently, but must not query internal tables directly or recreate a different eligibility model.

Earlier in this chat the user selected enabling the existing global sharing flag and keeping unrelated Marketplace/Drive fixes out of the release. That records intent, not evidence the deployed flag is enabled. Before release, verify the target environment and the flag's Community/public-roadmap side effects; do not silently substitute a different scope or claim activation without evidence.

## 8. Data, security and cache behavior

Inspect `src/actions/organization.ts`, public-profile/map queries and program actions together. The canonical organization write already handles visibility, normalized slug, geocoding and view/cache invalidation. Extend this owner if needed rather than adding a parallel client publication store.

Requirements:

- Enforce organization membership/role and relevant server policy on every mutation.
- Derive public responses from an explicit allowlist and sanitize rich text/URLs.
- Reuse existing slug validation and collision handling; keep input on conflict.
- Preserve previous public route/cache invalidation when a slug changes.
- Treat save success, anonymous readability, directory inclusion and map inclusion as separately verifiable outcomes.
- Handle repeated submission idempotently at the domain level; no duplicate program, organization or publish event.
- If role/visibility changes during review, revalidate on submit and show a recoverable result.
- Never persist private field content in logs, analytics or URL query parameters.
- Store timestamps in UTC and use locale-aware display if showing update times.

For concurrent editors, use the existing version/conflict mechanism where present. If absent and required for a new review-save operation, design a minimal server conflict check before implementing it; do not overwrite newer edits using a stale preview snapshot.

## 9. Implementation slices and owners

| Slice | Scope | Owners and completion evidence |
| --- | --- | --- |
| P1: reconcile policy/projection | Read current main, flags, roles and public query rules; record actual prerequisites | Organization actions, feature flags, `src/lib/queries/public-profile.ts`, public-map owners |
| P2: readiness/location presentation | Separate essential/optional readiness from visibility and pin status | `src/features/organization-launch` types/lib/components; pure state tests |
| P3: exact public preview | Authenticated preview using shared safe projection | Public-profile query/renderer owners; private field exclusion tests |
| P4: deliberate publication/recovery | Confirmed write, errors, unpublish, useful ending and return route | Existing public-page settings and organization actions; save/reload tests |
| P5: public programs | Confirm flag/write/query contract and About → programs placement | Programs tab/visibility switch and current public profile renderer |
| P6: end-to-end review/release | Authorized and anonymous reads, stale-cache handling, user appearance review | Focused fixtures and release record with exact revision/environment |

P1–P5 are now implemented locally. P4 should reuse established writes; do not add a publish API merely to rename a button. P5 can ship against existing public pages without waiting for their redesign. Onboarding's publication stage consumes the result of P3/P4.

## 10. Validation matrix

Reuse `organization-launch`, organization-profile persistence, organization-programs-staff, organization-geocoding, public-profiles, public-find-route and relevant RLS tests. Use fixture-based anonymous projections and realistic private fields; do not publish a real organization just to run a visual test.

| Scenario | Required assertion |
| --- | --- |
| Empty or HTML-only description | No false completed narrative requirement |
| Optional location/program absent | Useful next action still available; no invented policy block |
| Viewer or other-organization actor | Write denied server-side; private preview inaccessible |
| Public organization with private program | Private program absent from every anonymous surface |
| Private organization with public-marked program | Parent privacy enforced in public response |
| Slug collision or unsafe URL | Recoverable validation; no lost input or unsafe public link |
| Publish/retry/unpublish | Stable records and truthful saved visibility |
| Online-only or no location | Valid public profile where permitted; no fake map pin |
| Geocoding failure/index lag | Profile and map statuses remain distinct; no endless success spinner |
| Public field removal/slug change | Prior cached representation and route handled according to policy |
| Editor opened from checklist | Full-height drawer, correct tab/field, Back to checklist and save-return |
| Return URL reloaded | Full-height content and drawer agree; canvas ancestors do not scroll |
| Banner dismissed/reopened | Correct layout, focus return and scoped preference persistence |
| Mobile and long content | No overflow, unreachable action or nested-scroll trap |

Acceptance checklist:

- [ ] Public preview and anonymous response agree on fields, programs and visibility.
- [ ] Public/Private and map-placement labels describe independently verified facts.
- [ ] Successful writes update the checklist; failed writes do not advance it.
- [ ] Organization and program visibility can be reversed without deleting records.
- [ ] Real public links work without the editor's session.
- [ ] User reviews both themes and mobile/drawer behavior.
- [ ] Required hosted quality, relevant RLS/security tests and branch protection pass on the release revision.
- [ ] Sharing configuration/deployment and production verification are recorded separately from code validation.

## 11. Release and recovery

Keep this release independent of the front-page redesign and unrelated Marketplace/Drive work. Prepare small changes that can be reviewed against current main; preserve the active rapid-UI worktree until its intended work is safely accounted for.

If a preview UI must be disabled, retain organization drafts and existing public settings. If publication fails, leave the prior saved visibility intact. Do not bulk-unpublish existing organizations as a rollback for a presentation bug. Use an additive migration with a documented reversal only if new storage is actually necessary.

Completion means an authorized editor can review, publish, see the correct anonymous page/programs, understand location status and return to building. A styled card or green test suite alone does not complete this plan.
