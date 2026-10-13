# Product release reconciliation and onboarding handoff

> October 12 ownership correction: user explicitly requested removal now, without waiting for the replacement branch. Removed this lane's new profile route/feature, paid Workspace helper, profile-only editor mode, free navigation/onboarding exception and related test; restored 13 tracked files to HEAD and deleted 13 untracked files. These historical implementation notes are no longer the active source state. Fiscal signup/verified profile import remains here and must be reconciled with the other branch before release. Its final `/organization/profile` destination is currently unresolved after removal.

Status: proposed plan, October 12, 2026. No release sign-off or deployment authorization inferred. Consolidates existing plans; does not add another product workstream.

## Verified checkout state

- Frontpage: `feat/frontpage-20261007`, HEAD `5ce3a18a`, 3 commits ahead/1 behind freshly fetched main `d159d722`; 150 modified tracked files and 136 untracked files. No staged changes. Missing main commit is authentication performance fix PR #285.
- Internal/onboarding: `feat/rapid-ui-ux-20261007`, HEAD `c1cf32d3`, 1 ahead/14 behind main; dirty. Latest log describes compact intent/organization basics followed by pricing. This checkout was inspected read-only; confirm it is still the other chat's active lane before integration.
- A localhost port does not transfer code. Neither checkout contains the other's uncommitted changes. Preserve both servers and working trees.
- Graphify graph is absent in the frontpage lane; prior bounded updates timed out. Findings below come from source and saved plans.

## Decided product contract

- Free organization: organization profile and fiscal sponsorship applications. No general Workspace, team invitations, paid tools or Accelerator access from the free tier alone. Preserve separately purchased learning access and authorized paid-org collaborators/staff.
- Public profile publishing is explicit; account creation does not publish.
- Guest fiscal application precedes optional signup/profile reuse. Skipping signup does not invalidate submission. Import only approved fields after verified ownership.
- Coach House temporarily hosts private incoming projects; Karissa and Joel review. Notifications go to fs@coachhousesolutions.org and joel@coachhousesolutions.org, plus the applicant receipt.

## Proposed first-run experience — needs product approval

1. Sign up with email or Google; retain intent, consent and return destination.
2. Organization basics: name, public URL and formation status, using the other chat's compact form. Create one private organization safely; retries must not duplicate it.
3. Offer free profile or a paid plan. Free requires no card and no Stripe subscription. Preserve the current selected-plan path for visitors arriving from pricing.
4. Free completion lands at `/organization/profile`: profile editor, public-page preview/publish controls, Applications and a modest Upgrade action. No Workspace walkthrough or locked dashboard full of unavailable cards. Account settings and public resources/docs remain reachable.
5. Upgrade retains the same organization and saved data. Unlock Workspace only after server-confirmed entitlement; then offer the paid Workspace walkthrough. Cancellation returns safely to the free profile.
6. Paid users and invited members enter their authorized organization's existing Workspace. Their access follows the selected organization's entitlement, not a member's personal plan.
7. Guest fiscal receipt offers optional signup and selective private profile import; signed-in return must preserve the application. Do not send guests through paid setup.

Current implementation has the profile editor and Applications link, but not a signed-off complete free landing/upgrade experience. Applications currently links to the public form; do not describe it as a built application-status dashboard. Decide whether a signed-in status list is required for this release or keep the existing verified receipt/status-link journey.

## Sign-off ledger

| Area | Evidence now | Remaining before release sign-off |
| --- | --- | --- |
| Free tier | Dedicated profile route, free navigation, Workspace entry and several action guards; focused local tests recorded | Approve first-run UX; complete routes/actions/direct-table RLS/storage/tool/learning audit; prove paid-user and invited-member regressions absent |
| Onboarding | Other lane has compact first step and organization persistence; 35 focused tests recorded in latest log | Integrate free-tier contract; real email/Google signup, refresh/resume, upgrade/cancel and selected-org review; appearance approval |
| Fiscal sponsorship | Guest submission, internal project/reviewers, outbox, proof, optional profile import, corrections and recovery implemented; connected PostgreSQL journey recorded | Remaining access audit; actual browser/backend/mail/OAuth test; migration/configuration/scheduler/webhook rollout verification. Intake flags remain off per current records; localhost targets production. Do not silently activate or create a new persistent test environment |
| Homepage, Build, pricing | Local pages and navigation built; latest Build pass records 24 focused tests plus mobile/dark checks; free pricing copy corrected | User copy/appearance approval; verify paid display terms against checkout/entitlements; canonical Linux visual references; placeholder media explicitly accepted or replaced |
| Resources and home preview | Search, collection dock, profiles and lazy count/preview implemented | Search/category/scroll/map-collapse/history regression review; email/Google save recovery, persistence and multi-tab checks; distinguish estimated count from exact total |
| Documentation | Public pages, fiscal integration and rail implemented | Responsive/keyboard review, anonymous access, link/search checks |
| Integration | Current main fetched; missing patch identified | Preserve work, scoped commits and ownership review, integrated regression suite, required current-revision hosted quality and review |

Existing focused test results are historical evidence, not tests rerun for this reconciliation. No feature is newly declared production-ready by this document. Other lanes (IRS acquisition, Calendar, Particle System, Marketplace) need their owners' current evidence; old open-work entries are not a reliable current completion count.

## Execution order and exit criteria

- [ ] 1. Approve free first-run destination/visible controls and application-return behavior. Write the same acceptance contract into both owners' plans.
- [ ] 2. Create a file/hunk ownership list for onboarding actions/components, profile editor, auth return, shell redirects/navigation, pricing and access guards. This lane owns profile/entitlements/fiscal; onboarding lane owns signup/setup/walkthrough. Shared files receive one integrated review.
- [ ] 3. Preserve both dirty trees in reviewed local checkpoints after secret scanning. Extract a scoped free-tier foundation commit; exclude marketing/map and unrelated fiscal work. Share its exact commit with the onboarding lane. Do not cherry-pick the entire frontpage branch or overwrite dirty files.
- [ ] 4. Prepare a clean integration branch from freshly fetched main. Bring in scoped dependency-ordered commits: profile/access foundation; onboarding; fiscal; public surfaces. Preserve main's shipped auth/consent/performance patches. Production activation remains separate from integration.
- [ ] 5. Finish entitlement audit and one complete free signup -> profile save -> refresh -> explicit publish -> upgrade -> paid Workspace journey. Also verify checkout cancellation, unpaid direct URLs/actions, paid-org invitee and existing paid accounts. Clear pass/fail receipts, not only hidden menu checks.
- [ ] 6. Complete guest application -> single private project -> both assignments -> applicant/staff mail -> optional verified account/profile -> requested correction/resubmission. Resolve a specific safe backend/recipient target before real writes or email; current disabled production-backed preview cannot prove this flow.
- [ ] 7. Review public pages one route at a time with the user; finish preview save/auth and Resources interactions. Obtain explicit placeholder-media acceptance if assets stay blank.
- [ ] 8. Run focused checks for remaining fixes, then required hosted quality/security/RLS/build and Ubuntu visual gates on the integrated release revision. Review rollback and migration/flag ordering. Do not bypass failing checks or treat old green tests as current release evidence.
- [ ] 9. After all agreed work is signed off, perform the authorized coordinated release and controlled production verification. Keep the user's prior no-partial-release direction until explicitly changed; readiness to plan shipping is not an immediate deploy command.

## Handoff for the onboarding chat

The free organization contract is profile plus fiscal applications only; no Workspace/team/tools/Accelerator entitlement. Frontpage implementation is in the sibling frontpage worktree and is largely uncommitted. Do not assume localhost:3001 has it. Proposed free completion is `/organization/profile`, with Applications and Upgrade; paid completion retains Workspace. Preserve private-by-default creation, existing paid-org collaborators, plan/return intent and optional fiscal profile import. Coordinate a scoped foundation commit and shared-file ownership before merging. Use this document plus the existing parent plans; do not restart completed implementation.

## Source plans

- [Public product journey](2026-10-09-homepage-product-journey.md)
- [Public Workspace page](2026-10-11-workspace-public-build-page.md)
- Other checkout: `coach-house-platform-rapid-ui-ux-20261007/docs/plans/2026-10-10-organization-onboarding-implementation.md` and its canvas/publication parent plans.

This document supersedes stale main-sync status and old unchecked intermediate steps only for reconciliation; it does not erase their historical evidence or mark open gates complete.
