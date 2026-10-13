# Homepage product journey — implementation checklist

> October 12 ownership correction: user explicitly requested removal now, without waiting for the replacement branch. Removed this lane's new profile route/feature, paid Workspace helper, profile-only editor mode, free navigation/onboarding exception and related test; restored 13 tracked files to HEAD and deleted 13 untracked files. These historical implementation notes are no longer the active source state. Fiscal signup/verified profile import remains here and must be reconciled with the other branch before release. Its final `/organization/profile` destination is currently unresolved after removal.

Status: guest application, verification, corrections, optional profile import and submitted-application recovery now pass a connected handler/PostgreSQL journey (2026-10-11). Delivery reconciliation and additional project/file restrictions are implemented locally. Public submission stays disabled. Actual email/Google/browser verification, free-tier and remaining access audits, product review and eventual database rollout remain unfinished. Owner: `feat/frontpage-20261007`, preview http://localhost:3000. Local only; no release requested.

**Current user direction — 2026-10-10:** Finish all workstreams in this plan before aiming to release anything. Checkpoints are development progress, not release candidates. Keep implementing and validating locally; do not stage an early fiscal-only release, apply production migrations/configuration, or deploy portions merely because their individual checks pass. Earlier references to separate release slices are superseded. Other chats' workstreams remain separately owned.

## Consolidated progress — 2026-10-10

This is the current checklist for this chat's work. Older checkpoint sections record previous implementations, not additional parallel plans. In particular, account-first application instructions and the old home explorer/left-rail layout are superseded.

| Workstream | Implemented locally | Remaining |
| --- | --- | --- |
| Homepage and navigation | Collect/Build story, compact copy, sticky header, legal footer, links to Resources and public Documentation; direct `/pricing` with matching public layout and signup links (2026-10-11) | Final desktop/mobile/keyboard appearance review and affected visual references |
| Resources and profiles | Full explorer at `/resources`, unified listing presentation, collection dock, profile presentation and public links | End-to-end search/collect/history checks and resolve existing source-contract failures before release |
| Homepage resource preview | Searchable paginated list, collection menu, inline auth/recovery, qualifying-organization badge | Controlled email/Google confirmation, saved-item persistence and multi-tab review |
| Documentation | Public fiscal route, legacy redirect, navigation/banner/search, compact scrolling rail, shared artwork header with immediate preview | Final responsive/keyboard review; preserve public access |
| Fiscal application | Guest-first preview; shared policy; atomic handoff, protected API, reviewers, receipt worker, drafts; submission/receipt UI, explicit email proof, optional signup/verified selective profile import, applicant status/requested corrections and event-based follow-up notifications behind disabled flags | Actual email/Google and enabled-browser testing; remaining elevated-access audit. Connected handler/storage journey and delivery reconciliation now pass locally (checkpoint 10) |
| Free organization tier | Profile-only surface, navigation and several server access guards; narrow fiscal attachment policies | Direct-table RLS and private document/tool/learning entitlement audit, preserving existing paid users; reconcile existing pricing feature copy with the approved profile-only free tier |
| Integration and release | Fresh fetch confirms `origin/main` `0819df5f` is included: 3 commits ahead, 0 behind | Dirty changes remain uncommitted; focused regression fixes, review, required CI, migration/configuration activation and controlled production verification |

Local verification is not production activation. No fiscal migrations, schedules or email sends have been performed in this workstream. Public submission remains disabled. The current server returns HTTP 200; the image-blocked light-mode header check passed. Earlier blanket statements that browser tooling is unavailable are historical: authenticated and full responsive flows still need review, but focused Playwright checks are now available.

### Next implementation sequence

1. Connected handlers and migrated storage now pass draft save/resume, submission retry, proof, correction, selective profile import and fresh-browser-capability recovery. Complete the actual browser/provider journey when the intended backend is configured; current localhost still points at production, with intake flags off.
2. Submitted-application recovery now passes connected storage with captured email; actual inbox confirmation and cross-device recovery of an unsubmitted draft remain separate. Applicant status/return and correction resubmission are implemented locally; opening a link must never consume it. Local tests must not send real messages.
3. Verify the connected optional signup/claim/profile import with controlled email/Google confirmation. Validate the implemented applicant status/needs-info/resubmission journey and finish staff notification delivery reconciliation.
4. Finish elevated project/attachment authorization and free-tier audits. Verify the already prepared ownership, reviewer and outbox pieces end to end.
5. Complete remaining homepage, Resources, collection/auth, Documentation and responsive/keyboard checks in the table. Resolve regressions and maintain current-main compatibility.
6. Only after all planned work is complete: final review, required current-revision CI, coordinated migration/configuration and deployment preparation. No early partial releases.

The user confirmed Coach House as the temporary internal owner on 2026-10-10. Read-only provider checks resolved Coach House Solutions Group and both named coach accounts. Keep incoming projects private and distinct from its public profile. Decoupling staff projects from a mandatory organization is a separate architecture follow-up, not a prerequisite to this intake release. Parallel IRS acquisition, internal Workspace and Particle System lanes remain separately owned; this checklist does not claim their current completion status.


## Current fiscal sponsorship plan — guest-first intake and internal review (2026-10-10)

**Authoritative fiscal direction.** This section supersedes earlier account-required fiscal entry steps, the proposed sign-in gate in the application panel, and the owner-account-only intake architecture. Earlier implementation/checkpoint entries remain historical evidence, not current acceptance criteria. The component-led layout and free profile/application-only tier remain desired. Do not deploy the pending account-only migration as completion of this flow. Implementation is underway; the staged checklist below remains the completion record.

### Latest appearance checkpoint — application first (2026-10-10)

- [x] Place the actual editable application directly beneath a compact, centered homepage-style introduction; supporting explanation follows the form.
- [x] Remove account loading, signup, login, and organization creation gates from public entry. Reuse existing application fields with blank guest defaults; no fabricated project or applicant account.
- [x] Preserve the existing authenticated editor. Guest budgets accept manual rows or CSV import; account-only attachment uploads and program synchronization copy stay out of the guest surface.
- [x] Keep the page in one scroll flow, use neutral rounded surfaces without shadows, and keep the title/subtitle gap at 8px. Collapsed fields are inert to keyboard focus.
- [x] Clearly label the current application as a preview; submission is disabled, with no fake receipt or claim that answers are saved remotely. Answers remain in component state; warn on reload/close after edits. No unscoped PII browser persistence.
- [ ] Connect the guest submission service and durable draft storage. Replace the preview state only after actual persistence, abuse protection, and delivery behavior are ready.
- [ ] Show optional signup and verified profile import only after a successful submission. The placement/explanation is present; auth and import are not yet wired. Skipping must leave the submitted application valid.
- [ ] User appearance review: http://localhost:3000/documentation/fiscal-sponsorship#application. Browser tools expose no browser, so visual behavior remains unverified.

Validation: 15 existing fiscal acceptance tests pass; focused ESLint, scoped fiscal TypeScript, and diff checks pass. Anonymous HTTP 200 HTML includes contact inputs before the overview, no signup gate or account-only upload control, an explicit preview warning, and optional post-submit profile copy. This is a UI checkpoint, not completed guest submission or a release.

### Confirmed recipients

- Karissa: `fs@coachhousesolutions.org`.
- Joel: `joel@coachhousesolutions.org`.
- User explicitly confirmed both addresses. Resolve and verify their actual staff user IDs before configuring assignments; email recipients and authorized project assignees are distinct concerns.

### One public page, end-to-end

1. **Understand.** `/documentation/fiscal-sponsorship` uses the compact introduction, numbered process, responsibility comparison and preparation checklist described below. Clear supporting copy: “Apply without an account.” Preparation is optional; no duplicate screening form or invented eligibility score. Existing qualifications and funding caveat remain visible.
2. **Apply as a guest.** Open the actual application immediately in the page. Reuse the current contact, legal, project, budget and eligibility sections and server validation. No signup wall, paid-plan requirement, checkout, drawer or nested scrolling. Signed-in applicants can also apply, but account access never substitutes for application review.
3. **Save/resume safely.** Keep form state through recoverable errors. If offering cross-session guest drafts, persist them privately behind a scoped guest session/token; use a rate-limited email resume link for another device. Do not store sensitive full applications in localStorage or expose records to anonymous table reads. Resume is optional and does not create an account. Saved labels require confirmed persistence.
4. **Submit.** Validate, apply existing bot protection plus rate/upload limits, and atomically record one submitted application, its internal project, reviewer assignments, audit event and durable notification jobs. A retry of the same submission must not create another project or another set of notification jobs. Reject invalid input without losing the draft. If required reviewer/project provisioning fails, do not claim successful submission; retain the draft and offer retry.
5. **Receipt and confirmation email.** After durable acceptance, show “Application received,” a reference and review expectations without an invented response time. Queue a confirmation to the applicant with the reference and secure return link. Never claim delivered just because queued; expose send failure/retry internally. Email failure must not undo an accepted application or encourage resubmission.
6. **Optional signup after submission.** Offer “Create your organization profile” plus “Not now,” with sign-in available for existing accounts. Email/Google auth reuses existing consent and confirmation handling. Application submission remains complete if declined. No automatic account creation or unsolicited invitation.
7. **Review and reuse information.** After verified account ownership and application claim, show an editable profile preview and explicit Save to profile action. Reuse appropriate organization name, description, contact, website and location fields when present. Keep legal attestations, private mailing addresses, budgets, attachments and review notes out of public profile defaults. Do not overwrite an existing profile automatically; let the user choose changes. Keep profiles private until explicitly published. No paid Workspace or team access is granted.

### Internal project and review experience

- Each successfully submitted application creates one private internal project, named from the submitted project name, with Fiscal Sponsorship enabled and populated from the same application record. Do not copy answers into an unrelated notes blob or maintain competing application versions.
- For guests, provision the project under an explicitly configured Coach House intake organization/security scope; do not invent an applicant auth user, use a reviewer's personal organization implicitly, or make guest projects public. Existing unassigned-project support can hide displayed organization assignment but does not remove the required owning `org_id`.
- Assign both Karissa and Joel as project reviewers using existing project assignment primitives if they support this. If only the current single organization-coach assignment exists, add a scoped multi-reviewer relationship and corresponding authorization rather than replacing an organization's coach. Verify both reviewers can open and act on this specific project.
- Display separate statuses: application review state, applicant account linkage (`Guest` / `Account linked`), and email verification/delivery status. `Account linked` means verified linkage to this application, not merely an email matching a database account. Link the organization profile after optional claim without exposing internal project notes to the applicant or moving staff records into their paid Workspace.
- Submit creates an internal notification and separate email for each reviewer. Include applicant/project summary, reference and an authenticated link directly to the project's Fiscal Sponsorship section. Full private application answers and attachments stay behind authorization. Account claim later updates the linkage indicator without duplicating the project or resetting its review.

### Backend changes required

- Current application/project models assume an authenticated organization owner. Model guest applicant identity, contact email, verification and eventual claimed user/org separately from internal project ownership. Review existing actor, signer, owner and RLS assumptions before extending them; do not weaken the authenticated-only owner RPC to accept arbitrary anonymous org IDs.
- Use a narrowly scoped server-side guest intake endpoint and private draft/submission storage with RLS. Guest access is capability/session scoped to one application, with hashed expiring tokens, rotation/revocation, generic responses and no raw tokens/PII in logs. Confirmation/claim links must not mutate state on GET because email scanners follow links. Exchange a token for a scoped session; require explicit actions and verified ownership for account attachment.
- Restrict claiming to the verified application contact or another explicitly verified ownership path. An email string match alone is never enough, including existing accounts and Google accounts with a different address. Keep staff review history intact and prevent claim replay, double claims and cross-organization linkage.
- Submission writes the application, internal project, assignments and outbox transactionally. Dispatch after commit through the existing email provider with retry/backoff, per-application/event/recipient uniqueness and provider idempotency where supported. Handle delivery/bounce failures and allow staff retry without creating another application. Suppress the old duplicate notification path for this event.
- Review retention/deletion for abandoned guest drafts, uploaded-file limits/authorization and secret/token handling. Preserve current authenticated application save/submit behavior and existing paid/staff access during migration. Add schema changes in a new reviewed migration sequence; reassess the undeployed account-only migration rather than silently treating it as guest-ready.

### Staged execution checklist

- [ ] A. Review guest ownership, project scope, two-reviewer authorization and current migrations. Define field mapping and configured intake organization; verify the two staff identities. Produce the exact schema/transition design before implementation.
- [ ] B. Build and show the component-led public layout with the actual guest form. Remove the mandatory authentication gate; include loading, failure and received states. Appearance checkpoint with the user.
- [ ] C. Implement private guest draft/submission, atomic project creation/assignments, real Fiscal Sponsorship data and internal account-linkage indicator. Prove anonymous isolation and retry/concurrency safety in database tests.
- [ ] D. Implement applicant confirmation and both reviewer emails with durable outbox, delivery tracking, safe links and retry tests. Use designated test recipients before production sends.
- [ ] E. Implement optional post-submit auth, verified claim and editable profile import. Preserve answers through email/Google return; confirm Not now leaves a valid application; prove no unintended public publishing or paid access.
- [ ] F. Review mobile, keyboard, light/dark, expired links, existing-account/organization cases, email failure and needs-info/resubmission. Run focused authorization, RLS, notification and regression checks; finish remaining free-tier audit.
- [ ] G. After appearance review and required CI/security checks, apply the reviewed migration/configuration and release through the existing approved process. Verify one controlled guest submission creates one project, both staff assignments, three expected emails and an optional profile claim. Production remains unmodified until then.

Acceptance: a person with no account can submit successfully; applicant, Karissa and Joel receive their intended emails; both reviewers can open the populated internal project; account linkage is accurate; optional signup reuses selected data without duplicate projects, privacy loss or entitlement escalation.


## Scope and style contract

Preserve the existing Dots-inspired homepage composition: centered compact hero, a Collect feature row, a separate Build hero with full-width media followed by Accelerator/coaching rows, three supporting columns, closing actions, sticky translucent header, small legal footer. The separate Build section follows the latest user direction. Maintain existing type sizes, spacing, semantic colors, rounded media frames and mobile stacking. Hero title/subtitle gap stays 8px. Do not restore the former main canvas or sidebar. `/resources` owns full discovery; the later approved homepage preview contains only a compact searchable list and collection/auth flow.

Earlier screenshots of search docks, profile drawers, social buttons and resource lists explain existing product decisions, not a request to transplant those interfaces into the marketing homepage. Keep those components intact. Blank aspect-ratio media placeholders stay blank except the later approved live resource-list preview and the Coach House logo in the small hero square, replacing the orb per the latest follow-up. No invented art, decorative animation, glow, autoplay map or AI-chat framing.

## Running checklist

- [x] Reconcile original product brief, visual references and previous corrections.
- [x] Verify frontpage worktree/3000 ownership; preserve other worktrees and ports.
- [x] Fetch main and verify all current main commits are included (3 local commits ahead, 0 behind).
- [x] Implement hero and four main feature copy blocks; preserve visual structure.
- [x] Explain Collect NFPs immediately as finding, saving and sharing nonprofits.
- [x] Cover Workspace, team/board collaboration, documents, tools, Accelerator and 1:1 Executive Coaches.
- [x] Label calendar sync and AI-assisted decision planning as coming soon.
- [x] Verify destinations; use public Build/Pricing explanations before app access.
- [x] Add concrete public documentation examples: mission, budget, board responsibilities.
- [ ] User review: first copy checkpoint on desktop/mobile.
- [x] Superseded by the approved compact list-only resource preview below; do not reopen the blocked static-map asset task.
- [x] Checked licensing: no project/directory license found. Omitted the open-source claim; public/free does not establish an open-source license.
- [x] Replace the duplicate resource supporting column with Fund your first project and fiscal sponsorship copy once its destination exists.
- [x] Create public `/fiscalsponsorship` in the existing fiscal-sponsorship feature; thin route, public metadata, sitemap and reserved slug.
- [x] Explain sponsorship, responsibilities, supported projects and exclusions using current policy.
- [x] Trace and connect Apply to the existing application with correct authentication return and intent.
- [x] Verify existing application draft/submission transitions with focused tests and source review; readiness is not approval or funding. Live authenticated submission remains untested and was not performed.
- [x] Public route/link checks and structural accessibility: HTTP 200, one h1/main/header, valid skip and requirements anchors.
- [x] Existing search URL state, selection, saved preferences and auth callback tests pass; profile history/focus restoration reviewed in source.
- [ ] Mobile appearance, keyboard interaction and actual browser Back/scroll restoration review; browser control unavailable.
- [ ] User final appearance review, then affected visual references and required release gates if shipping is requested.

## Visitor paths and UI states

1. Home hero: “The platform for nonprofits.” Supporting copy is now “Find or build resources in your area.” per the user’s follow-up. Solid Start building → `/sign-up?intent=build`; outlined Collect NFPs → public `/resources`. Closing repeats these actions with plain-language context.
2. Collect row: public directory → search/category → results → profile → collect/share. Preserve the existing map/search shell, profile-only presentation, count feedback and Back restoration. These are verification requirements, not authorization for a new explorer redesign. Preserve selected resource through authentication when collecting requires it.
3. Workspace row: Explore Workspace → public `/build`. Existing `/workspace` is an application destination, so it should not be mislabeled as a public overview.
4. Accelerator row: View Accelerator options → public `/pricing`. `/accelerator` redirects into the workspace; avoid that surprise from a marketing overview link.
5. Coaching row: Sign in to book → `/coaching`, whose existing auth return targets coaching. No implied free entitlement or invented booking availability.
6. Documentation: public `/documentation`, no account required. Concrete examples rather than vague learning claims.
7. Funding: Fund your first project → `/documentation/fiscal-sponsorship` (legacy `/fiscalsponsorship` redirects) → guest application → submit → receipt → optional signup/profile import. Keep eligibility essentials visible. No mandatory account, guaranteed funding or invented decision timeline. Submission is still disabled pending backend completion.

## UX decisions

- Hick: two clear hero choices; one next action per feature.
- Proximity/similarity: retain compact heading-copy groups and consistent action styles.
- Jakob/Fitts: standard links and existing shadcn controls; preserve comfortable touch targets and keyboard focus.
- Doherty: server-rendered copy, static map preview and reserved media dimensions; no new WebGL map on home.
- Goal-gradient: accurate saved progress in the existing application, not a new ornamental progress meter.
- Peak-end: clear submission receipt and next steps, without implying approval.

## Checkpoint policy

Pause after a visible, tested stage and give the user the preview plus a short remaining checklist. Do not call the full plan complete after the copy pass. Do not ship or alter production services. Preserve the shipped Sign up patch and refresh main again before eventual release.

## First checkpoint evidence

Homepage HTTP 200 includes the revised hero, four feature blocks and coming-soon copy. Changed-file ESLint, the existing home/resources route separation assertion, route-entry guard and diff hygiene pass. Browser connector inventory was empty and the in-app browser was unavailable; visual/mobile review is pending with the user at http://localhost:3000. No screenshot or visual approval is claimed. Graphify AST update exceeded its 15-second bound; graph remains incomplete.

## Second checkpoint evidence

- Public `/fiscalsponsorship` is server-rendered with the shared sticky header, compact hero, blank 16:9 asset, program explanation, visible requirements/exclusions, three steps and Apply. Homepage funding column links to it. Canonical URL, sitemap entry and reserved organization slug are registered.
- Copy sources: existing `components/public/fiscal-sponsorship-dialog.tsx`, `features/fiscal-sponsorship/lib/application-data.ts`, and the existing application editor. No new fee, deadline, tax-status determination or approval guarantee. The approved agreement and private application remain unchanged.
- Discovered `intent=fund` means donor audience. Apply uses `intent=build` and an explicit `/workspace?focus=fiscal-sponsorship` return. Existing Workspace code reveals/focuses that card. Existing signup/login code already retains the return; a tentative redundant auth edit was removed. No auth implementation changes remain.
- Public HTTP checks: home funding link and `/fiscalsponsorship` return 200; signed-out signup returns 200 with the correct login return link. Signed-in redirect covered with the existing auth fixture, not a live account. No account, application, signature or payment was created.
- Focused checks cover public entry, signup return, Workspace card and existing draft/submission transitions. ESLint, route/feature/import guards and diff hygiene pass. Visual/mobile/keyboard review remains pending because browser control is unavailable. User continuation authorizes implementation but is not recorded as appearance approval.
- Map preview: existing public token returns HTTP 403 (`Forbidden`) from Mapbox Static Images. No token was printed or committed. Keep the blank asset until a permitted static-image token/source is available. No extra live map, database request, or failing map image was added to the homepage. Static Images does not support the live Mapbox Standard style; use an approved compatible basemap if proceeding. Reference: https://docs.mapbox.com/api/maps/static-images/.

## Third checkpoint evidence

- 29 additional tests pass across six existing acceptance files: filter URL state, actions/selections, saved preferences, Find performance contract, member onboarding and public auth callback. No resource explorer code was changed.
- Anonymous HTTP checks confirm `/`, `/fiscalsponsorship`, `/build`, `/pricing`, and `/documentation` return 200 at their own destination. The two marketing pages each render exactly one h1, main and header, with valid fragment targets. These checks do not establish rendered contrast, responsive appearance or actual keyboard behavior.
- Reviewed existing profile navigation: native history updates retain search parameters; popstate restores selected profile; the embedded profile restores previous scroll/focus on exit. This is source evidence, not a live Back-button test.
- No separate server Mapbox token is configured. The existing public token's Static Images request returns a JSON 403 through CloudFront. The exact account/token restriction is not established. User asked to check permitted Static Images access; no credentials requested in chat and no settings changed. Avoid repeated retries until that external state changes.
- No browser is available through the provided browser connector. Remaining visual/mobile/keyboard review must wait for access or the user's review. No visual baselines updated or appearance approval inferred from “continue.”


## Fourth checkpoint — Documentation and free applicant scope

User confirmed: free organizations get an organization profile and fiscal sponsorship applications only. No Workspace, invitations, paid organization tools, or Accelerator. Public documentation and its existing public learning tools remain public. Existing paid-organization collaborators and staff must retain their authorized access.

### Running list for the added scope

- [x] Confirm profile-and-applications-only free tier.
- [x] Trace the current application: real editor, persisted drafts, revision checks, submit transitions and project dependency. The prototype panel is not an intake backend.
- [x] Restyle Documentation rail from the supplied reference: small colored section icons, indented muted links, text/dot active state, separated groups, light/dark colors, retained keyboard focus and 44px mobile targets.
- [x] Add Fund your project below Best practices, per the user’s follow-up, and a compact home banner. Mark fiscal sponsorship and Brand identity as New, per the user’s follow-up. Link to the existing live overview during this checkpoint; no dead application link or claim that the new flow is ready.
- [x] Correct the Documentation Map destination to `/resources` following the earlier route move.
- [ ] User appearance review of Documentation rail/banner at http://localhost:3000/documentation.
- [x] Move fiscal sponsorship into one Documentation page, with the old `/fiscalsponsorship` path preserving incoming links. Register the canonical page in Documentation search, metadata and sitemap.
- [x] Implemented locally; live auth review pending: public visitor reads requirements, sees the application outline, signs up/signs in using existing auth, and returns to that same application. Preserve consent, OAuth/email return state and recovery.
- [x] Implemented and isolated-DB tested; migration not deployed: resolve/create the applicant's organization profile and fiscal project server-side without granting general project/Workspace creation. Never create organization/project records on GET/render. Make repeated starts safe and org-scoped.
- [x] Wired locally; live persistence review pending migration: reuse the real inline application editor with owner-scoped drafts, save/error states, concurrency protection, validation and submission receipt. Do not expose staff review, approval or signing administration.
- [x] Add `/organization/profile` for authenticated free organizations using the existing profile editor; exclude Programs, People and Supporters tools. Add profile/application navigation and route unpaid Workspace visits to the profile.
- [x] Gate Workspace layout/invite, objective and communication actors using the selected organization's subscription; membership alone and a personal subscription do not unlock a free organization. Preserve existing organization authorization and staff access.
- [x] Extend isolated database tests with the real paid-project policies. Scope free fiscal project/attachment access to the applicant's intake project; attachment changes require a draft or needs-info application. Submitted attachments remain readable and locked.
- [ ] Audit and enforce free-tier boundaries at routes/actions/RLS as applicable: profile/application allowed; Workspace, invitations, paid tools and Accelerator denied. Cover another organization's data, unauthenticated requests, paid organizations and staff. Do not rely on hiding navigation.
- [ ] Review the end-to-end flow on mobile and keyboard; run focused auth, entitlement, draft, submission and RLS checks. No real account/application submission without an explicit test target.

### Technical continuation

- `features/fiscal-sponsorship/server/actions.ts` loads/saves by project and checks active organization/editor role. `workflow-actions.ts` owns actual submission. Reuse these gates.
- `features/member-workspace/server/project-actions.ts` and `project-fiscal-sponsorship-actions.ts` enforce Workspace feature access; do not weaken those generic endpoints to admit free applicants. A narrowly scoped fiscal intake entry is needed.
- `lib/billing/plan-tier.ts` already has a free plan; no new Stripe product is needed merely to represent this tier.
- `components/app-shell/dashboard-layout-state.ts` distinguishes own-organization access from invited collaborators. Preserve paid-organization collaboration; inspect organization-level entitlement rather than blindly checking each member's personal subscription.
- Current Apply points to `/documentation/fiscal-sponsorship#application`; the former `/fiscalsponsorship` URL redirects there. Public intake is locally implemented, but migration deployment and full free-tier authorization review remain release blockers.

Validation: 50 existing Documentation navigation/search/sitemap tests pass; changed-component ESLint and diff hygiene pass. Browser appearance review remains with the user; no new screenshots or visual baselines claimed. This is a requested staged checkpoint, not completion of the new intake scope.

## Build section follow-up

Workspace now introduces the Build side with its own centered hero, compact title/copy spacing, Explore Workspace action, coming-soon note and full-width blank 16:9 media frame. Accelerator and coaching remain alternating supporting rows below it. Collect has its own preceding section and resource-focused introduction. Focused lint and rendered HTML hierarchy/order checks pass; browser appearance review remains pending.


## Collect preview checkpoint

- [x] Replace only the Collect media placeholder with compact real search/results; keep all other media and the Build hero.
- [x] Reuse cached, paginated curated and nonprofit directory search, plus a compact projection of cached public platform profiles. Lazy-mount the client near the viewport; no map instance, tiles, or viewport requests.
- [x] Inline search/collection dock; bounded results, explicit Show more, native full-profile links, loading/empty/retry states.
- [x] In-frame signup/sign-in using existing email/Google auth and consent. Preserve pending public resource identity/query through confirmation; retain results and restore focus. Authenticated saves confirm persistence; failures retain a retry action.
- [x] Focused recovery, collection capacity/idempotency, auth, preferences authorization and navigation checks: 32 tests passed. Scoped TypeScript, changed-file lint, import boundaries and diff hygiene pass.
- [ ] User visual/mobile review at `http://localhost:3000/#home-resource-preview`.
- [ ] Controlled Google/email confirmation and multi-tab review with a designated test account. No real account or save was created during automated checks.

The free fiscal application work above remains pending; this preview does not grant organization access or change entitlements.

## Public intake checkpoint — 2026-10-10

- Canonical Documentation page, home/rail/banner links, authored search entry, sitemap, and permanent legacy redirect are implemented. Public overview and inline email/Google entry remain on the same page. No new modal or nested application scroll region.
- Explicit Start/resume calls the applicant-session `start_public_fiscal_intake` RPC. No owner/project/role argument is accepted. It creates a private owner organization if needed, preserves an existing profile, serializes starts with an organization row lock, and reuses the existing unique organization/seed-key constraint. It grants no Workspace, team, billing, or learning entitlement. Visiting the page only reads account state.
- Existing draft/save/submit editor and authorization remain in use. Controls are disabled until the draft loads; errors retain data. Fixed revision state after a successful save followed by submission-validation failure. Existing shared action buttons now serve both surfaces. Submission status returns a receipt instead of an editable form.
- Validation: 84 focused acceptance tests pass; isolated PostgreSQL fiscal RLS role matrix and public-intake denial/isolation/idempotency/profile-preservation assertions pass. Scoped TypeScript, focused ESLint, route and import boundary checks pass. New page HTTP 200; legacy path contains Next's permanent redirect instruction. No real application/account created and no production migration applied.
- Browser connector still exposes no browser, so responsive appearance, actual keyboard behavior, and OAuth/email confirmation remain unverified.

### Historical account-first next steps — superseded by guest-first sequence above

1. Complete free organization profile navigation and server-side access audit: deny unpaid Workspace, invitations, paid tools, Accelerator; retain paid-org collaborators and staff. Include fiscal document uploads, which reuse project assets, in the free-applicant audit.
2. Review and deploy migration `20261010090000_public_fiscal_intake.sql` through the approved release process. Until applied to the app's database, Start/resume cannot persist a new intake. Isolated tests do not activate the running app's database.
3. Controlled browser test of signup → draft → resume → submit with a designated test account, then homepage/mobile/auth review and release gates. Do not claim a completed live application flow yet.

## Free profile and fiscal access checkpoint — 2026-10-10

Implemented a dedicated free profile surface and server-side Workspace entry/action restrictions. Shared profile mapping/types now live outside UI modules; the existing editor preserves profile validation, roles, public visibility controls and saving. Public intake uses explicit async action wrappers; server composition stays outside component layers.

Focused checks: 54 tests across 11 files pass after correcting the action facade and aligning the Workspace denial message. The isolated PostgreSQL suite now applies the actual paid-project migration before intake policies; it verifies owner isolation, idempotent starts, private profile preservation, denied general project creation, owned draft attachment writes, unrelated-path denial and locked submitted attachments. Feature, route, boundary and scaffold checks pass. No production migration, release, real account creation or application submission.

Still open: legacy direct database access for Workspace boards/objectives/communications and private document/tool routes. Do not label the overall free-tier access audit complete. Existing purchased learning access must be preserved while checking Accelerator gates. Browser connector reports no surfaces; authenticated visual/mobile review and real signup/draft/resume/submission remain unverified.

Additional checkpoint verification: scoped TypeScript and focused ESLint pass. Signed-out `/organization/profile` returns a streamed login redirect preserving its return URL after cold compilation. Localhost:3000 still serves the frontpage checkout. Graphify refresh timed out at its 15-second bound; graph is not current.

## Historical refinement plan — account gate and page order superseded above

User direction: redesign the information layout, not just the Apply button. Use the homepage's working resource-preview pattern and Quick Start's numbered rows/checklist surfaces. Remain in `/documentation/fiscal-sponsorship` and the existing Documentation shell. This is a design plan only; it does not mark implementation or backend release gates complete.

### Page and journey, in order

1. **Compact introduction.** Breadcrumb, Fiscal sponsorship eyebrow, “Fund your first project.” title and one sentence explaining the service. Tight 8px title/body gap; 28–32px heading, 14–16px supporting copy. One Start application link jumps to the real panel. Keep the funding/review caveat visible, concise and adjacent. Returning drafts use Continue application only once authenticated read-only status is known; never create records to choose a CTA label.
2. **How it works.** One bordered, rounded surface with three numbered stages: Prepare, Apply, Review. Short title plus one sentence per stage. Three columns on roomy screens, stacked rows on mobile. These describe the process, not a claim of approval or an invented processing timeline. Condense existing Model C explanation into a brief You / Coach House responsibility comparison. Reuse existing source copy; legal detail remains accessible below.
3. **Before you start.** Compact four-row preparation checklist: contact/legal details, project/public benefit, budget/funding plan, supporting information. Optional local checklist for preparation only, with accessible checkbox labels. Never gate entry, announce eligibility, or duplicate application questions. No sensitive pre-auth answers or new persistence. No artificial readiness score.
4. **Your application.** A real usable component with a restrained bordered frame and title/status/action header. Native page scrolling; no sheet, nested scroll area, code tab, decorative dashboard or pretend preview. Signed-out state explains the free profile/application tier and offers Create free account and Sign in. Existing Google/email forms open inside this panel; consent, confirmation return, field recovery and focus management remain intact. Signed-in users start/resume their own organization's application explicitly.
5. **Fill, save, review.** Reuse the existing five editor sections: Contact, Legal, Project, Budget, Eligibility. Compact clickable section navigation/completion indicators where useful, derived from actual fields. Distinguish section completeness from eligibility or approval. Existing incomplete drafts remain savable; validation and first-error focus apply to final submission. Save/retry states must retain entered data; saved copy appears only after persistence succeeds. Do not add a second form model or validation source. Actions live in the panel and never obscure content on mobile.
6. **Submitted state and details.** Replace editable controls with the persisted status and a calm receipt. Use real next-step/status information; no promised response time or funding guarantee. Put secondary explanations in accessible accordions: sponsorship model, funding/review expectations, and saving/returning. Keep essential qualifications, funding caveat and required attestations visible in their relevant sections rather than hiding them in accordions. Needs-info returns to the editable application according to existing server rules.

### Visual constraints

- Single-column reading flow, max width about 56rem; readable text lines about 60–70 characters. Only process/preparation groups may use small responsive grids.
- Reuse Documentation primitives, spacing and neutral light/dark tokens. 16px outer panel corners, 12px inner controls, 16–24px panel padding, 24–32px section gaps. Match nested radii and hover regions.
- Small existing Lucide icons where informative; no custom illustrations, shadows, glow, autoplay or large empty assets. Primary action receives the strongest contrast.
- 44px mobile controls, visible keyboard focus, descriptive labels. Page remains useful before client loading. Skeleton mirrors only the interactive panel; status changes use polite announcements. Restrained opacity transitions, disabled for reduced motion.

### Implementation and review checklist

- [ ] Replace overview paragraphs with compact introduction, process/responsibility layout and preparation section. Show the working page for appearance review before expanding the editor redesign.
- [ ] Restyle the real application panel and existing signed-out/signed-in/loading/error states. Preserve auth and server actions.
- [ ] Add section orientation, saved/error/submission presentation using existing draft and validation state. Avoid a second eligibility workflow.
- [ ] Check mobile wrapping, keyboard order/focus, light/dark contrast, draft recovery, return from auth and submitted/needs-info states. Use existing tests; add only meaningful coverage for changed behavior.
- [ ] Obtain user appearance review, then update affected visual references. No broad screenshot sweep for the initial layout pass.

Separate release prerequisites remain open: pending fiscal migration, legacy free-tier route/RLS audit, and controlled live auth/application verification. The layout can be reviewed locally without claiming persistence is production-ready. No new eligibility policy, fee, timeline or funding promise is introduced by this redesign.

## Guest-first build checkpoint 1 — 2026-10-10

- [x] Replaced the public page's overview paragraphs with numbered Prepare/Apply/Review stages, two responsibility panels, an optional interactive preparation checklist and an expandable Model C explanation. Existing qualifications remain visible. No approval/readiness score. Public page returns HTTP 200; appearance review pending.
- [x] Prepared service-role-only atomic submission migration `20261010100000_guest_fiscal_submission.sql`. Separate guest identity/claim columns, explicit internal ownership configuration, two verified staff reviewer identities, private reviewer relation, and three durable notification jobs. Preserves application fields and budget rows in the real fiscal application. No fake applicant account; guest actor remains null.
- [x] Isolated database tests use the real fiscal application table migration and verify restricted execute/table privileges, required configuration, populated application/project, both assignments, three queued recipients, idempotent retry, rejected caller ownership and rollback after an outbox failure. Original fiscal RLS tests also pass. Fifteen focused acceptance tests and scoped lint pass.
- [x] Confirm internal owning organization: Coach House Solutions Group, explicitly approved 2026-10-10. Provider identity verified; configuration is still unapplied.
- [ ] Wire public guest request validation, abuse protection, private resume/claim sessions and the real form. Current account-based public editor has not yet been replaced; the new SQL function is not an anonymous endpoint.
- [ ] Add scoped reviewer read/review authorization and the Guest/Account linked indicator to the project UI. Stored reviewer assignments alone do not prove reviewer access.
- [ ] Build leased outbox dispatch/retries, provider delivery tracking, recipient emails and secure return links. Jobs are queued in isolated tests only; no messages were sent.
- [ ] Add optional post-submit verified signup/claim and selective private profile import, then full release/security/visual gates.

Both pending migrations remain unapplied. This checkpoint is foundation plus overview layout, not a working production guest application. Do not skip the remaining endpoint, reviewer authorization, delivery, identity-link and abuse-control work.


## Global application policy checkpoint — 2026-10-10

This team-directed change applies to both the internal editor and public preview.

- [x] Replace budget line items with anticipated fundraising amount and Monthly / Annually / Total; preserve historical expense data and stop implicit program-budget synchronization.
- [x] Remove short public description and investor-return questions; retain historical stored answers.
- [x] Allow outside-U.S. operations and lobbying with an explanation of each Yes answer. Update shared server validation and the unreleased guest transaction.
- [x] Add a transactional staff-event queue and protected worker for Karissa notifications; exclude draft saves, lease/retry safely and avoid duplicate guest submission notices.
- [x] Verify shared UI/source contracts, goal roundtrip, legacy budgets, international readiness, server validation, queue permissions/rollback/retry and scoped TypeScript/lint.
- [ ] Deploy queue migration and worker, activate scheduled dispatch, verify staff project access and approved email delivery. See `docs/operations/fiscal-application-policy-and-notifications-20261010.md`.
- [ ] Complete the guest-intake release gates above. Applicant/Joel dispatch and optional signup remain outstanding; Karissa's new global queue does not complete them.

No production migrations, schedules or email sends were performed. The public page remains explicitly marked as a preview; this checkpoint does not claim a working guest submission flow.


## Guest-first build checkpoint 2 — staff review, 2026-10-10

- [x] Verify temporary Coach House host and Karissa/Joel staff identities (read-only provider checks; configuration still unapplied).
- [x] Implement restrictive guest reviewer scope, assignment revocation, actor binding and normal-project compatibility; isolated PostgreSQL tests pass.
- [x] Add assigned guest projects to the staff Projects directory and route them to a fiscal-only view before any host organization detail loaders run.
- [x] Display submitted answers, Guest/Account linked and email verification indicators. Reuse the fiscal workbench with View action; no host profile prefill or paid-team prompts.
- [x] Prevent guest notifications from reaching host members/coaches. Reject legacy agreement/W-9 identity resolution for guests until verified guest signing exists.
- [ ] Validate both staff accounts through the actual browser, including mobile/light/dark, and update applicable visual baselines.
- [ ] Finish private attachment/storage and general project mutation authorization audit.
- [ ] Build public guest drafts/submission endpoint, abuse protection and safe resume/verification flow.
- [ ] Dispatch applicant/Joel outbox jobs, configure and verify Karissa's event email worker, and support applicant status/needs-info messages.
- [ ] Complete optional signup/verified claim/profile import and free-profile entitlement audit.
- [ ] Complete required CI/review, apply reviewed migrations/configuration, then controlled end-to-end production verification. Homepage remains a separate unfinished release.

This is a local staff-review increment. Public submission is still disabled; no migrations, emails or deployments occurred.


## Guest-first build checkpoint 3 — submission and receipts, 2026-10-10

- [x] Implement server-generated signed/expiring intake capability and strict same-origin submission endpoint; no account requirement or caller-selected ownership.
- [x] Add streaming size limits, hCaptcha verification, durable HMAC risk buckets, strict field mapping and receipt-only idempotent retry responses.
- [x] Add applicant/Joel outbox lease/retry/ack worker. Karissa retains the global event worker. No duplication of the guest submission notice.
- [x] Test malformed inputs, owner/status injection, expiry/tampering, replay, rate denial, captcha failures, provider failures, stale leases, reviewer revocation and unchanged authenticated intake/email behavior.
- [ ] Connect the public form's field adapter/loading/errors/received state after private draft/resume storage and verification are ready. Current public form remains preview-only.
- [ ] Add scanner-safe email proof/return links, applicant status/needs-info/resubmission and optional verified account claim/profile import.
- [ ] Finish attachment/general-project action authorization audit, free-tier boundaries and periodic retention cleanup.
- [ ] Verify provider delivery/bounces and actual applicant/Karissa/Joel inboxes using controlled recipients; review authenticated UI, then complete CI/security/release gates and activate migrations/flags/scheduler.

Pending backend migration is 20261010150000. No production writes, provider configuration, real emails or homepage deployment. See the operations document for exact API contracts, flags, retry limits and rollout dependencies.

## Guest-first build checkpoint 4 — private draft recovery, 2026-10-10

- [x] Add service-only, RLS-protected browser drafts with a fixed seven-day session deadline; keep unfinished values intact and exclude internal IDs/status/profile data.
- [x] Add bounded same-origin draft read/save API using the signed HttpOnly session. No private answers in URLs or browser localStorage.
- [x] Reject stale-tab overwrites with version checks; recognize a retried latest write without incrementing the version again. Changed payloads cannot reuse a write ID.
- [x] Serialize drafts with submission, remove draft answers atomically at handoff, and return only the submission reference afterward.
- [x] Add authenticated, independently enabled retention endpoint with bounded expiry cleanup. Intake/email flags can be off while cleanup continues.
- [x] Verify API/session/field/rate protections, draft expiry/isolation/retry/conflict, real submission handoff, cleanup bounds and database permissions.
- [ ] Connect autosave/resume/conflict UI with the public form and finish scanner-safe email verification/return links. Recovery currently supports the original browser capability only; no cross-device email recovery yet.
- [ ] Finish optional verified account claim/selective profile import, applicant status/needs-info/resubmission, attachment/general-project authorization and free-tier audit.
- [ ] Configure retention scheduling and verify its execution/backlog monitoring before enabling draft collection. Complete email delivery reconciliation, controlled inbox tests, authenticated UI review and current-revision CI/security/release gates.

New pending migration: `20261010160000_guest_fiscal_drafts.sql`. Public form remains preview-only; this checkpoint implements the draft backend, not a completed applicant journey. No production migrations, configuration, emails or deployments.

## Guest-first build checkpoint 5 — draft form connection, 2026-10-10

- [x] Connect the existing editor to private draft recovery/autosave behind the existing server enable flag. Preview mode stays memory-only and performs no draft/session requests.
- [x] Debounce edits and serialize writes. Show Saved only after acknowledgement; preserve newer edits while an older request completes. Retry the identical uncertain write before sending newer changes.
- [x] Keep answers during network/rate failures and expired sessions. Reject silent cross-tab replacement; loading a different saved draft requires explicit confirmation.
- [x] Preserve overlong unfinished input and show a save error rather than truncating it. Warn on refresh/close and intercept ordinary navigation links with the existing AlertDialog pattern; cancel preserves input.
- [x] Recognize an already-submitted receipt on recovery without making another submission. Keep submit disabled until the remaining journey is implemented.
- [x] Verify 40 focused tests across controller/API/shared form files, scoped TypeScript/ESLint, and a focused localhost browser check for unsaved navigation, cancellation, disabled submit and no private preview requests.
- [ ] Validate enabled form persistence end to end against isolated migrated storage, including reload and conflict dialog appearance. Controller/API/database layers have separate tests; these are not proof of a fully integrated guest journey.
- [ ] Finish email verification/return, submission validation/captcha/receipt UI, optional claim/profile import and applicant follow-up.
- [ ] Complete the remaining workstreams and audits above before any release. No partial fiscal rollout; user clarified this explicitly during this checkpoint.

No environment flags, production data/configuration, emails, commits or deployment changed. User appearance review and affected visual baselines remain open. Graphify refresh remains subject to the repeated bounded timeout.

## Guest-first build checkpoint 6 — submission UI and email proof, 2026-10-10

- [x] Connect shared client/server validation, accessible field errors, hCaptcha, draft flush and atomic submission to the real form behind a second disabled server flag. Retain answers on rejection; lock uncertain submissions and retry the same payload/reference without duplicate projects or notices.
- [x] Show an actual receipt only after a valid success response. Preserve account-free entry and defer signup/profile import until after submission.
- [x] Prepare private email-proof storage, lease-bound immutable receipt links, seven-day expiry, explicit POST verification, same-browser lost-response recovery and denial of replay in another browser. Verification records email ownership only; it does not claim an account, publish a profile or approve an application.
- [x] Strip link fragments on verification-page mount, exclude that route from Analytics/Speed Insights, use no-referrer/noindex metadata and require an explicit Verify email action. Opening the page alone makes no session/verification request.
- [x] Extend separately enabled retention to expired proofs and verified sessions. Database assertions cover permissions, retry/expiry/replay, unchanged claim fields and cleanup.
- [x] Pass 82 focused tests in seven files, isolated guest PostgreSQL tests, scoped TypeScript/lint and route/import checks. Inspect focused mocked verification browser flow/screenshot; this is not proof of provider delivery or full enabled intake.
- [ ] Finish optional verified signup/claim/selective private profile import, applicant return/status/needs-info/resubmission and email recovery/delivery reconciliation.
- [ ] Validate enabled form against isolated migrated storage and complete staff browser, attachment/general-project authorization, free-tier and other workstream checks. Obtain user appearance review and update affected visual baselines afterward.

Pending migration: `20261010170000_guest_fiscal_email_proof.sql`. No flags, production migrations/configuration, real emails, commit/push or deployment. Graphify again exceeded its bounded refresh. All work remains unreleased until the entire consolidated plan is complete.

## Guest-first build checkpoint 7 — optional account and profile reuse, 2026-10-10

- [x] Add optional profile CTA and Not now after durable submission and explicit email verification. Reuse existing email/Google signup, login, consent and auth return handling. Skipping never changes the submitted application.
- [x] Require server-verified account identity, confirmed account email matching the application contact, and unexpired verified application browser scope. A matching email string or reference number alone cannot claim an application.
- [x] Show editable name, description, contact email and phone selections with every field unchecked initially. Exclude mailing address, budget, legal answers, files and staff notes. No safe website/location value exists in the current intake mapping; do not substitute a private mailing address.
- [x] Link the account and save only chosen fields atomically. Keep new profiles private, preserve unselected existing data, detect stale previews, and keep retries from overwriting later edits. Already-public profiles allow linkage without answer import. Internal projects, review state, reviewers and entitlements remain unchanged.
- [x] Add an explicit Open organization profile action selecting only the verified owner's organization; preview reads never switch the active organization. Guard unsaved selection navigation and preserve exact uncertain-save requests.
- [x] Verify 28 focused API/contract tests, isolated database permissions/claim/replay/conflict/public-profile/rollback assertions, scoped TypeScript/lint and route/import checks. Focused mocked browser test proves opt-in fields, selected-only payload and identical lost-response retry; screenshot inspected.
- [ ] Complete controlled real email/Google confirmation and migrated-storage end-to-end verification. Mocked UI and isolated SQL are not a completed live signup journey. User appearance review/baselines remain open.

This completes the local optional-profile implementation increment, not the fiscal workstream or whole plan. **Next remains applicant return/status/needs-info, email recovery/delivery reconciliation, then elevated-access/free-tier audits and the other product checks in the consolidated table.** No new side plan. Pending migration `20261010180000_guest_fiscal_profile_claim.sql`; no production activation, real emails, commit/push or deployment.


## Guest-first build checkpoint 8 — applicant follow-up, 2026-10-11

- [x] Private applicant status page without signup, reached from the receipt and explicit email verification. References alone grant no access; exact-origin requests require an unexpired verified application/browser capability. No-store/no-referrer/noindex and telemetry exclusion.
- [x] Show applicant-facing needs-info/decline notes; expose only allowlisted editable answers when corrections are requested. Internal staff metadata, actor IDs, host ownership and document snapshots never reach this page.
- [x] Reuse the existing application editor with the verified email read-only. Preserve answers through uncertain requests, retry identical request UUID/version/payload, focus field errors and confirm before discarding conflicting edits. Corrections are held in the current tab until submitted; they are not an autosaved correction draft.
- [x] Atomically update the same application/project only from needs-info, preserve prior application/review privately, reject stale versions or changed-email attempts, and avoid duplicated history/events/messages on retries. No account/profile/publishing/paid entitlement mutation.
- [x] Queue applicant messages for requested updates/approval/decline and correction receipt. Queue Joel on corrections; Karissa uses the existing global event queue. Each review round has its own event-keyed outbox record. Follow-up links use frozen lease-bound email proofs and explicit verification; delivery flags remain off.
- [ ] Complete controlled migrated-storage/browser and email/Google verification, self-service expired-link recovery, delivery reconciliation, and remaining elevated-access/free-tier audits.

New pending migrations: `20261011090000_guest_fiscal_followup.sql` and `20261011100000_guest_fiscal_followup_notifications.sql`, after the existing pending guest chain. No production changes or real messages. This closes the local status/correction increment, not the fiscal workstream or consolidated plan.


## Guest-first build checkpoint 9 — timeline and access recovery, 2026-10-11

- [x] Replace native project date inputs with the existing shadcn Calendar/Popover composition in the shared public/internal editor. Equal-width, aligned date fields; compact maximum width; mobile stacking; unknown end-date option below the pair. Date-only serialization preserves the selected calendar day. Ongoing projects keep one start field and concise explanation.
- [x] Add no-account submitted-application recovery at `/documentation/fiscal-sponsorship/recover`, linked from missing/expired verification and application access errors. Require reference, matching contact email, hCaptcha and durable HMAC limits; generic responses do not reveal matches or cooldowns. No access is granted by requesting a link.
- [x] Queue recovery links with stable request IDs, a per-application ten-minute cooldown and frozen retry proof material. Explicit email verification grants only the existing application scope. Requests do not revoke valid sessions, alter the application, create an account, or notify staff unnecessarily. Existing disabled intake/email flags still gate the endpoint.
- [x] Validate 27 focused recovery/email/proof tests, 14 shared application tests, and isolated migrated PostgreSQL assertions for matching, privilege isolation, retry/cooldown, immutable application state, fresh-browser verification and replay denial. Scoped type/lint and route/import contracts pass. Desktop/mobile date interaction checks cover selection, unknown end date, ongoing conversion and focus return.
- [ ] Connected storage/auth/email journey, actual provider delivery/bounce reconciliation and staff access review remain open. Unsubmitted draft cross-device recovery is not supplied by the submitted-application recovery route.

Pending migration: `20261011110000_guest_fiscal_recovery.sql`. No flags, remote migrations, real email/account creation or deployment. Appearance review precedes visual baseline updates.


## Guest-first build checkpoint 10 — connected flow and delivery/access fixes, 2026-10-11

- [x] Exercise real request handlers against the existing disposable migrated PostgreSQL harness: session, draft save/resume, submission and retry, captured receipt/proof, verification, requested corrections, idempotent resubmission, optional selected-only profile import, unchanged internal ownership, and access recovery with a new browser capability. Captcha, Auth identity and outbound email remain simulated provider boundaries, not live confirmation.
- [x] Fix the integration failure this uncovered: `mailingStreetAddress2` must map to `mailing_street_address_2`. Previously the strict database rejected complete editor payloads; separate mocked/API and SQL tests did not catch the mismatch.
- [x] Add signed fiscal delivery receipts to the existing Resend webhook. Private minimal ledger, idempotent events, out-of-order terminal-state handling, early-webhook/late-ack joining, independent tracking switch and bounded orphan cleanup. Retain global bounce/complaint suppression; omit fiscal raw payloads from campaign history.
- [x] Display the latest Applicant/Karissa/Joel email outcome on the authorized fiscal project view. Provider acceptance is not delivery. Correct Karissa's link to `/projects/<id>` and require explicit staff dispatch activation.
- [x] Block general project edits, notes/links, folders/options, asset API and activity refresh from treating a guest application as a normal host workspace project. Keep the existing dedicated assigned-reviewer route intact. Add restrictive policies for related task/asset/note/activity/signing rows and storage paths, and require server transitions for guest record writes.
- [x] Validate focused acceptance suites, the connected PostgreSQL sequence, RLS privilege/revocation/storage tests, scoped TypeScript/lint and route/import contracts. No real account, application, mail or provider setting was changed. Local disk pressure briefly interrupted a test run; its temporary cache self-cleaned and the rerun passed. Other servers and the applicant's existing tab were preserved.
- [ ] Complete actual browser + configured backend + real email/Google verification, remaining general-action/free-tier audit and final product checks. These are still prerequisites to calling the full plan complete.

Pending migrations: `20261011120000_fiscal_email_delivery_tracking.sql` and `20261011130000_guest_fiscal_related_records.sql`, after the existing guest chain. No remote application. Localhost:3000 still uses the production database, whose guest migrations/configuration are not activated; the Submit button remains disabled. A passing automated connected-storage test does not make that live preview operational. Do not introduce another persistent testing environment after the user's rejection, or quietly turn production writes on.

## Public Workspace /build follow-up — 2026-10-11

- [x] Replace the older /build landing with the homepage-style Workspace story, concise core features, Accelerator/Documentation/support sections and shared pricing at the bottom. Public Build menu links become section anchors. See [implementation plan and draft copy](2026-10-11-workspace-public-build-page.md).
- Planning found stale free-tier pricing promises; reconcile with approved profile/application-only access before reusing the pricing section. This is part of the existing unreleased lane, not a new release.

Public Workspace implementation checkpoint (2026-10-12): local /build replacement and public menu section links are built. Shared free-tier pricing claims corrected; user appearance review, billing/configuration confirmation and hosted visual baselines remain open. See the linked Workspace plan for focused test/browser evidence.
