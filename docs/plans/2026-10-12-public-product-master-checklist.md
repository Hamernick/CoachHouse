# Public product work — consolidated running checklist

Updated October 12, 2026. Covers this conversation; latest decisions replace earlier layout experiments. This is the current cross-plan inventory, alongside the [release checklist](2026-10-12-presentation-release.md). Public deployment was verified at `408b36c6`; main subsequently advanced to `73dd8d15` with onboarding PR #288. That newer deployment and its authenticated behavior are not established by the earlier verification.

## Completed implementation and public release

- [x] Homepage: product-story layout replacing the old home canvas/rail, distinct Collect and Build sections, compact copy and spacing, orb, resource-count animation, pill actions, responsive layout, legal footer.
- [x] Navigation: sticky blurred header, responsive consistency, logo fixes, requested Hairline figures with hover animation, Explore to Resources, public Documentation, Build section links.
- [x] Homepage resource preview: compact searchable results, collected menu, responsive layout, organization links, inline authentication and pending-save handling. Real provider roundtrip remains a verification item below.
- [x] Qualification badge: organizations meeting the configured mission/vision/values, 501(c)(3) and paid-platform conditions. This is not an independent legal-verification claim.
- [x] Resources: dedicated `/resources` experience; unified directory results, categories/nearby discovery, map and location controls, nfp's count/mix, responsive result layout and incremental loading.
- [x] Resources layout: map compaction on scroll, layered floating search/collection dock, compact animated collection count, account/legal menu, loading and error states, claim-your-organization action. Final visual polish remains optional.
- [x] Organization/resource profiles: shareable routes, in-shell profile transitions/back navigation, compact identity/social/contact/donate actions, brand-kit section, About metadata and imported-source notice.
- [x] Public Documentation: logged-out access, routing/redirects, grouped responsive/scrollable rail, hover states, wrapping labels, New tags, fiscal section/banner and page header/artwork loading treatment.
- [x] Build: `/build` Workspace product page, core-feature sections and navigation anchors, shared pricing near the bottom.
- [x] Pricing: standalone public layout without the former map canvas, narrower cards, updated free-start copy and fiscal sponsorship at Operations level.
- [x] Fiscal public page: Documentation home, application toward the top, guest-first form and optional account-saving concept after submission. The page is live; submission is disabled.
- [x] Main synchronization/public releases: #286 and #287 merged; public routes and real resource search/profile navigation verified at the deployed revision.
- [x] Security alert #2: confirmed synthetic signing fixture, current literal removed, alert resolved as used in tests; real production Stripe secret was different.

## Fiscal implementation completed, activation still pending

These are implemented and tested capabilities, not claims of successful production intake or delivered mail.

- [x] Shared application fields: simplified anticipated fundraising amount and Monthly/Annually/Total period; currency indication; removed short public description and investor-return question.
- [x] Shared eligibility behavior: lobbying/outside-US answers require explanation instead of automatically stopping an application.
- [x] Form design/behavior: formation radios, compact section headers/badges, white light-mode inputs without shadows, aligned shadcn date pickers/unknown end date, validation and submission-payload fixes.
- [x] Secure guest sessions, draft persistence, CAPTCHA/origin/rate-limit boundaries and idempotent submission.
- [x] Private internal project creation under the temporary Coach House host, Fiscal Sponsorship details and Overview summary, Karissa/Joel assignment, applicant account-status indication and initial in-app notifications.
- [x] Applicant receipt and reviewer email jobs/retries; staff lifecycle updates; needs-information/correction/resubmission handling without duplicate projects.
- [x] Explicit email verification, private application status and submitted-application recovery.
- [x] Delivery-event verification/reconciliation and staff status implementation; provider activation remains separate.
- [x] Connected database and authorization tests, scoped private-project access and duplicate/concurrency protections.
- [x] Thirteen MVP migrations applied in production, RLS verified, host/reviewers configured, secrets and schedules staged.
- [ ] Enable intake/UI and guest/staff email flags, redeploy and verify real session/draft/CAPTCHA behavior after release requirements.
- [ ] Submit one controlled live application: exactly one project, populated Fiscal/Overview sections, both assigned reviewers and both in-app notifications.
- [ ] Confirm applicant receipt plus emails to `fs@coachhousesolutions.org` and `joel@coachhousesolutions.org`; verify retry causes no duplicates. Provider acceptance and actual inbox delivery are separate checks.
- [ ] Exercise a staff status change/needs-information request and applicant correction through the real deployed flow.
- [ ] Configure the delivery-webhook signing secret/provider endpoint and enable tracking; verify signed delivery events. Sending and delivery tracking have separate flags.

No real guest submission or outbound application email has been claimed. Intake, submission UI, both senders, optional profile import and delivery tracking were last verified disabled. Retention was enabled. Fiscal activation was not changed by this inventory.

## Still needing development/integration

- [ ] Connect optional post-submission signup/profile saving to the new onboarding owner. Preserve verified applicant identity and selected organization data through email confirmation; support existing-account and Google/email return paths without requiring signup to apply.
- [ ] Reconcile and apply the separately gated profile-import migration only after that integration is ready; keep sensitive application data out of the public profile and do not auto-publish.
- [ ] Cross-device recovery for an **unsubmitted draft**, if retained as a desired optional feature. Recovery of an already submitted application is implemented.
- [ ] Decouple internal staff projects from a mandatory public organization owner. Coach House remains the explicitly accepted temporary host.

## Implemented but still requiring real integration verification

- [ ] Homepage/Resources save intent across real email/Google signup, return navigation, collect/uncollect persistence and multiple tabs.
- [ ] Fiscal optional organization import with the merged onboarding flow, including skipped signup and field-selection/privacy boundaries.
- [ ] Confirm marketing pricing/features match the merged free-workspace access contract. Public pricing implementation does not establish successful payment/unlock behavior.
- [ ] Authenticated upgrade/payment/access verification remains owned with onboarding/billing; coordinate rather than duplicate its implementation.

## Ownership and release cleanup

- [x] Removed this branch's competing free-tier/profile-only implementation, tutorial/routing exceptions and related gating files as requested.
- [x] Separate onboarding/free-workspace PR #288 is now merged at `73dd8d15`. Its implementation owns onboarding, tutorial, upgrades and free access; the old profile-only proposal is superseded.
- [x] Public browser contract/reference corrections completed; 59 scoped cases passed before main reconciliation. PR #288 incorporated most of them.
- [x] PR #289 changed from draft to ready for review; reconciled conflicts with main while preserving both workstreams. Remaining diff is six reviewed Documentation references and tracking documents.
- [ ] PR #289 current-revision CI and independent review/merge. Visual failures are deferred by the user; do not label the required aggregate gate passed or bypass protection.
- [ ] Verify the eventual deployed revision and clean up only this task's branches/worktree after preserving its local evidence/server requirements.

## Deferred polish and future product

- [ ] Final homepage/Build media assets and copy refinement, as explicitly deferred for launch.
- [ ] Remaining responsive/motion/accessibility/performance polish driven by concrete review findings; do not reopen every superseded design experiment.
- Future decision-tree/AI planning is upcoming product work, not a completed capability from this chat.
- Resource data enrichment/geocoding/publication remains another workstream; directory UI completion does not mean every record has verified services or a map pin.
- The early homepage map/left rail/canvas experiments, custom icons, account-first fiscal gate and duplicate profile-only free tier are intentionally superseded, not unfinished tasks.
