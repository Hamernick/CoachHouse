# New-organization onboarding and guided canvas setup

**Closed by Caleb on October 12, 2026.** Remaining follow-ups are tracked in his separate to-do list; its location was not supplied. PR [#288](https://github.com/Hamernick/CoachHouse/pull/288) merged as `73dd8d15`; the canonical `coachhouse` Vercel deployment reports success. Migration `20261012163000` was applied and verified. This closes this workstream, not every verification gap: final PR visual/quality checks failed, the secondary Vercel project failed, and authenticated signup/payment/unlock verification remains unconfirmed. Do not resume historical tasks below without a new request. The connected planner remains abandoned.

The remainder of this document is historical evidence, not an active task queue.

Date: October 10, 2026. Status: implemented locally with user-directed corrections; end-to-end authenticated verification and release remain open.

Parent: [Canvas onboarding and roadmap master plan](2026-10-09-canvas-onboarding-roadmap-plan.md).
Related: [Public-profile launch](2026-10-10-organization-publication-implementation.md).

## October 10 review correction: contextual canvas walkthrough

### Fresh canvas and typography correction

Latest user direction: remove the custom orb entirely. The welcome now retains only its gradient banner and overlaid close control. Earlier shader/SVG implementation notes below are historical, not the current artwork specification.

Historical artwork iteration: a shader was replaced with an inline SVG, then the user explicitly removed the orb entirely. Neither implementation remains in the guide.

Welcome visual correction after direct screenshot comparison: a single shallow 5:2 gradient artwork region, close control over its top-right corner, centered title and short description, and one compact Get started action. Removed floating side icons, the redundant welcome eyebrow, Skip tour, divider, resume note and progress dots from the introduction. The close control still pauses; resume remains in the account menu. Sequential guide controls appear only after starting. No orb or custom sphere remains.

Small-screen correction: the introduction, contextual steps and minimized controls share a subtle32px visible circular close control within a44px touch target (translucent dark/white over artwork, theme-aware muted fill elsewhere). Guide placement uses visualViewport width, height and offsets plus safe-area padding. Resize and visual viewport scroll events update placement above keyboards and after orientation changes. Mobile guidance prefers space above/below its highlighted control. Available height limits the artwork/panel; content scrolls separately from the header/actions, with whole-card overflow as a fallback on very short viewports. Primary labels wrap instead of widening the panel; Back/Next/Close retain touch-sized targets. Automated geometry covers 320px phones, portrait/landscape, tablet, keyboard offsets and notches. Real-device visual/touch verification remains open.

Fresh signup and replaying the guide on an existing organization are different review cases. Replay retains saved card coordinates, visibility and organization data; it must not reset a real workspace to simulate signup. New boards now start with Organization and Activity side by side, Accelerator and Roadmap below, and Calendar beneath Accelerator. Placement uses the existing card dimensions and 72px gutters instead of a long horizontal chain. Explicit auto-layout commands retain their existing behavior. Saved coordinates are not migrated to the new arrangement.

Fiscal sponsorship is optional and hidden on new boards. An older tutorial-completion helper omitted it from the hidden list; this path now retains the hidden state through completion/restart while preserving an existing board's visible fiscal card. Guide headings use tight line height, with a 4px title/body gap and 20px body line height instead of 8px/24px. Fresh signup, replay, actual content height and narrow-screen framing remain separate visual review cases; no existing organization was reset for this change.

The user rejected the first fixed-position six-stage card. The earlier “complete” claim covered implementation mechanics, not the requested onboarding experience; it was overstated. The orb on every step and an “Explore workspace” action that simply dismissed the guide did not meet the brief.

The revised local experience uses seven sequential stops: welcome → organization → People → programs → roadmap → publication checklist → next steps. Previously saved fields do not skip teaching users where the controls are. Every expanded step uses the same compact gradient-header card, with an ending showing actual saved-state rows, reflecting the supplied references without adding unrelated Google integrations/security settings.

Canvas focus moves to Organization for identity and Activity for programs without changing saved node positions. People opens at partial height for actual drag/drop. Programs opens Organization → Activity at full height and scrolls to the activity section; roadmap and launch checklist also open full height. The guide follows target geometry and scrolls the relevant Organization or Accelerator viewport. The publication highlight is on the outer Build your nfp card, matching its radius. “Try it” reduces the guide to a persistent Next control. Roadmap opens the actual menu and preserves the guide return destination. Editing/public preview uses the real existing routes. Tour-only steps use native history and local drawer state instead of repeated server page requests.

Skip/Pause are labeled honestly and preserve the current workspace context. Back, resume, earlier progress migration, read-only/free alternatives, keyboard Escape and narrow-screen placement are retained. This revision still needs user visual/interaction review; automated checks do not establish that it now meets the visual brief.

## October 10 local implementation closeout

O1–O5 are implemented in the rapid-UI worktree. This is a local implementation checkpoint, not signup-through-production verification.

| Slice | Implemented behavior | Review evidence still needed |
| --- | --- | --- |
| O1 | Current entry labels, required/optional field inventory, free/paid/member/invited entry contracts preserved | User walks the relevant real entry paths |
| O2 | Stable step IDs; user/organization/flow-scoped seven-day drafts; failed-save retention; intentional blank edits restored; safe storage fallback; cropped avatar restored as an upload file; duplicate submit protection | Authenticated refresh, failed save/retry and final server handoff |
| O3 | Seven contextual stops with a shared compact gradient card, no sphere or displayed step counts, pause/resume and real next actions | Appearance on mobile and desktop, light/dark/system |
| O4 | Real Organization/Programs editors and exact public preview, server-derived readiness, role-aware actions, full-height editor and return to visible guide | Actual editor save/cancel/Back and keyboard focus |
| O5 | Versioned user/organization-scoped per-device progress; existing organizations are not forced through onboarding; account-menu resume; existing canvas layout preserved | Organization switching, resume after reload, reduced motion |

Implementation owners include the onboarding draft/submission helpers and `workspace-canvas-tutorial` setup-guide component/hook/pure model. The original tour machinery remains for compatibility; the active workspace presentation uses the new guide. Guide preferences are device-local; canonical organization work remains server-owned. Storage failure is surfaced without blocking use.

Review starts at `/workspace?guide=1&guideStep=welcome`; new/incomplete accounts use `/onboarding`. Welcome opens with the drawer collapsed. Resuming a saved step restores its matching drawer, Activity tab or checklist focus, including from the account-menu link without a step parameter. Public review returns to the exact guide stage.

The detailed acceptance checklist below remains unchecked where it requires human/authenticated/production evidence. Automated evidence and the consolidated review matrix are in [the review packet](../qa/rapid-ui-local-review-20261010/README.md). O6 follows user review; no remote deployment occurred.


## Historical first October 10 checkpoint: entry audit and presentation pass

Implemented O1 source inventory/copy and part of O2 locally. Required fields, billing order, consent, authorization and server destinations are preserved. The custom sphere-led journey has not been replaced yet.

| Entry/state | Source-backed route and sequence | Save/handoff and recovery |
| --- | --- | --- |
| Anonymous builder | `sign-up-form.tsx` sends builders to `/onboarding?source=signup` after authentication; `onboarding/page.tsx` redirects missing sessions to login | Existing authentication/consent handlers remain; no new organization creation path |
| Authenticated builder without selected access | `resolveOnboardingRequirements` chooses `post_signup_access`; `resolveOnboardingModeVisibleStepIds` exposes intent and pricing | Free selection enters `/workspace?source=onboarding_setup`; paid selection requires server-verified active entitlement |
| Builder with selected access or legacy completion but missing required organization data | Requirements choose `workspace_setup`; visible steps are organization, account and optional community | Organization name, slug and formation status stay required; action resolves active organization and checks edit permission |
| Completed builder with saved required profile | `/onboarding` redirects to `/workspace` | No forced replay or profile reset |
| Non-builder find/fund/support | Signup targets the member onboarding surface; member sequence is intent, account and community | Existing member completion targets Find; this does not expose the hidden internal Find navigation |
| Invited member with a different active organization | Requirements exempt `organizationId !== userId` from owner setup | This verifies the setup exemption, not a live invitation-acceptance test; invite delivery/acceptance is unchanged |
| Platform staff | Requirements exempt staff | Existing staff access preserved |
| Paid checkout return | Onboarding page refreshes entitlements for the pricing return; pricing helpers choose the appropriate screen | Server action still checks entitlement; a query-string success is not payment proof |
| Interrupted setup within a filtered sequence | New drafts store `stepId` alongside legacy numeric `step` | Reopens that actual visible screen; a stage absent from the new flow starts at its first relevant screen; numeric-only drafts retain compatibility |
| Multiple organizations / failed final submission | Existing active-org server authorization remains | Full draft scoping and failure recovery are still O2 work, as detailed below |

Current owners: `src/components/auth/sign-up-form.tsx`; `src/app/(dashboard)/onboarding/page.tsx` and `actions.ts`; `src/lib/onboarding/requirements.ts`; `src/components/onboarding/onboarding-flow-support.ts`; `src/components/onboarding/onboarding-dialog/{draft-writer,step-position}.ts` and draft/derived-state hooks. This is source/acceptance evidence, not a claim that a fresh signup or invitation was manually completed.

Presentation changes: shorter current-product headings, nonprofit examples instead of Acme, a compact optional photo row, named optional contact fields, aligned header/form/footer widths, an accessible progress rail, 44px navigation targets, visible pending feedback and an explicit Open workspace final builder action. The current step is no longer counted as complete before saving. Reconciled the exact inline-versus-dialog scroll behavior already present at locally available main commit `0819df5f`; did not merge unrelated newer main changes or modify signup consent.

Validation: 63 focused tests cover step identity/legacy resume, write-and-read filtered draft restoration, progress, organization/pricing rendering, checkout return, carried fields, requirements and server actions. Changed-source lint, import boundaries and thresholds pass. Full TypeScript checking reports errors in 34 test files outside this increment, with none in application source or the changed onboarding test; it is not a clean full typecheck. Port 3001 belongs to this worktree; unauthenticated `/onboarding` responds with its expected 307 redirect. Appearance, mobile keyboard/scrolling and a real authenticated save/reload remain for user review; no visual baselines or deployment.

Next O2 work: existing `buildOnboardingFormHandlers` clears the global `onboardingDraftV2` before the server confirms success, and the storage key is not user/organization scoped. Define a scoped success/failure handoff before changing that cleanup; retain input on rejected saves, clear only confirmed completed drafts, and prevent another account/organization from inheriting a draft. These are existing findings, not fixed by the new step identity. Then continue O3 sphere-led welcome and O4 real-action guide. Do not claim all onboarding is complete from this entry pass.

## 1. Outcome and boundaries

A new organization should enter a working private workspace, understand what Coach House helps it do, and complete a useful first action without sitting through a tour of outdated controls. Keep the recognizable spinning sphere. Replace generic instructions with current product language and real organization work.

This has two separate deliverables: account/organization entry and the guide shown after entry. Updating the Accelerator banner is not completion of either deliverable. Account access, curriculum progress, guide progress, profile completeness, publication, and map placement remain distinct states.

In scope: entry-path audit, updated setup copy and composition, conditional steps, draft continuity, custom welcome, action-based guidance, skip/resume/back behavior, role-aware targets, responsive presentation, and recovery.

Outside this increment: changing prices or entitlements, new identity checks, finance activation, mandatory community membership, new authentication providers, public-page redesign, a new curriculum, and the connected objective editor. Do not automatically publish during onboarding.

## 2. Verified starting point

Evidence is the rapid-UI worktree and October runlog, not a current production audit. Reconcile changes already shipped from other worktrees before implementation.

| Area | Current local state | Remaining work |
| --- | --- | --- |
| Account setup | Builder constants include intent, pricing, organization, account, community; effective steps vary by flow | Inventory actual entry modes and replace stale presentation without imposing a universal step sequence |
| Member setup | Separate member path exists | Preserve invitations, existing membership, and non-builder entry |
| Canvas guide | Existing sphere, scene controller, step IDs, targets and acknowledgement state | Replace feature-tour sequence with saved actions and reliable recovery |
| Accelerator overview | New banner, launch card, links, return navigation and responsive layout exist locally | Use these as destinations; do not rebuild them as duplicate onboarding records |
| Organization editing | Checklist opens full-height editor; successful profile saves return to checklist | Verify guide-owned return behavior and program-save continuation |
| Public publishing | Existing settings and per-program visibility | Integrate the review flow specified in the publication plan |
| Recent fixes | Inline onboarding scroll restoration was identified on a newer main revision in earlier work | Reconcile current main and preserve the shipped scroll/consent fixes; historical SHA is not proof of current deployment |

## 3. Entry-path inventory before editing

Record the route, authentication state, intended organization, effective steps, canonical action, destination, and recovery for each case. Use the current helpers as the source of truth; route names in this table describe journeys rather than introduce new routes.

| Journey | Expected behavior | Must not happen |
| --- | --- | --- |
| Anonymous builder signup | Authenticate, preserve intent/draft, create or resolve authorized workspace once | Duplicate organization after callback, payment return or refresh |
| Authenticated user creating their first organization | Reuse known account fields; collect only missing organization requirements | Asking for account creation again |
| Existing owner returning with incomplete setup | Resume from saved state with a useful next action | Resetting their organization, curriculum or guide automatically |
| Invited member | Accept the existing membership and land in that organization | Creating an unrelated organization or forcing owner setup |
| Viewer/read-only member | Show relevant orientation and explain available actions | Editable setup controls followed by authorization errors |
| Free builder | Enter the permitted workspace; show paid education only when relevant | A cosmetic redesign removing valid free access |
| Paid checkout return | Reconcile verified entitlement and resume the existing draft | Treating query-string success as payment proof or retrying creation blindly |
| Find/fund/support intent | Preserve the appropriate existing member path | Sending every user into organization-building onboarding |
| User with several organizations | Bind progress and actions to the selected organization | Leaking drafts, names or guide state across organizations |
| Interrupted signup or stale session | Preserve safe recoverable input and offer authentication/retry | An endless spinner or lost input without explanation |

Deliverable: a compact route/state matrix attached to this plan with verified source owners and reported runtime failures. Do not spend this step auditing unrelated products.

## 4. Account and organization setup design

Use the existing setup shell and shadcn controls. Retain only required steps for the user's entry mode. Reflect the actual visible sequence in progress indicators; do not show a five-step total when only two steps apply.

Recommended content, subject to the existing server requirements:

| Screen | Purpose and proposed copy | Behavior |
| --- | --- | --- |
| Intent, when unknown | “What would you like to do?” | Respect a valid intent already supplied by the entry route; avoid repeating the question |
| Account, when required | “Set up your account” | Reuse authenticated identity; preserve consent and provider-specific handling |
| Organization | “Name your organization” / “You can update this later.” | Show only required identity fields; carry the saved name into the workspace immediately |
| Plan selection, when applicable | Explain current access using verified product terms | Preserve current prices, checkout, entitlement checks and free path |
| Optional community | A secondary invitation after essential setup | Skipping must not block workspace entry |
| Final transition | “Your workspace is ready” / “Open workspace” | Navigate only after the server confirms the required records and membership |

These are content proposals, not permission to reorder billing/authentication dependencies. Choose the exact sequence after the entry inventory. Never expose internal identifiers, feature-flag names or implementation details as onboarding instructions.

Keep labels visible, mobile input text at least 16px, primary touch targets at least 44px, and error text adjacent to the field. Preserve paste, password-manager behavior, browser zoom and ordinary text selection. Inline setup must allow page scroll chaining; dialogs retain scroll containment. Loading states retain the action label and prevent duplicate submission without blanking the form.

## 5. Custom canvas journey

The guide begins after valid workspace access. It helps with real records; it does not pretend that clicking Next completes the organization.

| Guide stage | User-facing intention | Real action and completion evidence | Exit or alternative |
| --- | --- | --- | --- |
| Welcome | “Let’s set up your organization.” | Show the sphere and one short explanation of the private workspace | “Set up profile” or “Explore workspace” |
| Organization identity | “Add the basics people should know.” | Open existing organization editor; advance after confirmed save, or skip an already-satisfied requirement | Back to setup; keep editing on validation failure |
| Story | “Tell people what your organization does.” | Focus the existing description/mission field; use saved canonical content | Keep draft; return without falsely completing |
| Optional program | “Show an example of your work.” | Open actual program editor; an existing program can satisfy the suggestion | Explicit Skip; publication remains a separate choice |
| Public review | “Choose what people can see.” | Open the publication plan's exact public preview | Publish explicitly or “Keep private” |
| Next useful work | “Keep building.” | Offer a relevant accessible lesson or organization task | Finish guide; reopen it from Help |

Proposed copy should be tested in the real small surface. Use a short heading, a single instruction, one primary action and a clear secondary exit. Do not introduce fixed time estimates until observed. Do not describe hidden Finance, Find, Programs or Data shortcuts as available targets.

## 6. Guide state and persistence

Use stable stage identifiers and an explicit guide version. Resolve the exact storage owner during implementation; reuse the existing scoped workspace preference/progress mechanisms where suitable. Local presentation preferences may remain device-local, but the UI must not promise cross-device resume until server persistence exists.

Proposed presentation states: not introduced, active stage, editing a target, save pending, paused, finished. Business completion is computed independently from saved profile/program/publication data.

| Event | Required result |
| --- | --- |
| Start | Select first relevant unfinished action based on saved data and permission |
| Open editor | Record a validated return destination; open the drawer fully; reveal the requested field |
| Successful save | Refresh canonical data and return to the guide/checklist context; offer the next relevant action |
| Failed save | Stay in editor with values and actionable error; do not advance |
| Cancel/back | Use existing unsaved-change guards; restore guide context without marking completion |
| Skip | Pause or bypass an optional guide stage; do not fabricate saved business data |
| Reload | Restore the organization, stable stage, correct drawer height and useful scroll target |
| Browser Back/Forward | Restore the URL destination without duplicate records or unexpected guide reset |
| Finish | Mark the guide acknowledged; retain unresolved organization tasks in the launch card |
| Organization switch/sign-out | Dispose subscriptions and clear in-memory scope; reload only the target user's authorized state |
| New guide version | Migrate compatible progress; offer new guidance without forcibly replaying completed account setup |

Avoid parallel “completed” booleans for mission, program or publication. Existing tutorial acknowledgements mean the user saw guidance; they cannot establish legal formation, eligibility, public visibility or lesson completion.

## 7. Canvas, drawer and mobile behavior

Retain the sphere's identity and blue/cyan visual atmosphere from references 2–5. Keep fields and reading surfaces solid and legible. Use the sphere once per relevant moment, not as a repeated loading gate.

On desktop, focus a relevant node only after an explicit guide action. Preserve user-authored positions, pan/zoom and unrelated selections. Account for an open drawer when centering the target. Do not zoom again after every keystroke or server refresh.

On mobile, expose the same stages and actions as an ordered panel with normal vertical scrolling. No required dragging, precision panning, hover-only instruction or simultaneous tiny split view. Keyboard appearance must not hide errors or the primary action.

Drawer/editor interaction must remain isolated from the canvas: clicks, double clicks, drag gestures, selection and portaled menus cannot activate nodes behind it. A return URL restores both the drawer's snap and its content height. Scroll only the intended content viewport; avoid ancestor-wide scrollIntoView on transformed canvas descendants.

Resolve guide targets from the current rendered controls and permissions. If a target is unavailable, explain the available alternative or skip the irrelevant instruction. Never trap the user behind a missing element. Focus returns to a useful control when a drawer or guide stage closes.

Respect reduced motion with a static sphere and instant or reduced camera movement. Pause shader/animation work while hidden; provide a non-WebGL fallback. Loading the decorative sphere must not delay form interaction.

## 8. Implementation owners and slices

| Slice | Starting owners | Deliverable |
| --- | --- | --- |
| O1: entry audit and copy | `src/components/onboarding/onboarding-flow.tsx`, `onboarding-dialog/constants.ts`, derived step hooks | Verified entry matrix, current labels, no broken or hidden targets |
| O2: entry layout and recovery | `onboarding-dialog/components/**`, draft/state hooks; `src/app/(dashboard)/onboarding/actions.ts` | Required steps, safe draft carry-forward, server-confirmed workspace handoff |
| O3: sphere-led welcome | `src/features/workspace-canvas-tutorial/components/workspace-canvas-tutorial-panel.tsx` and panel layout/motion owners | Custom welcome and accessible skip/reopen behavior |
| O4: action-based guide | Tutorial types, controller and `lib/index.ts`; workspace drawer composition | Real editor actions, saved progress, role-aware branching and return navigation |
| O5: migrate/resume | Existing scoped preference/progress writers | Stable stage/version handling for new and returning organizations |
| O6: release review | Existing onboarding, workspace and visual fixtures | Reviewed signup-through-first-action journey; scoped release evidence |

Keep feature internals inside their owning feature and import other features through public entrypoints. Route files remain server-first composition. Do not expand the already-large Accelerator panel to hold onboarding state; extract an owned controller/component when needed.

O1–O3 can proceed while publication preview work is underway. O4's publish stage depends on the publication plan's preview/visibility contract. Connected objectives are not a prerequisite for shipping the new welcome or account setup.

## 9. Validation and acceptance

Reuse existing acceptance suites: onboarding steps/actions/requirements/defaults/carry-forward/pricing-return, app-shell onboarding redirects, workspace-board onboarding flow and workspace canvas tutorial tests. Add behavioral tests where a changed transition has no coverage; do not substitute source-string checks for persistence or access tests.

Acceptance checklist:

- [ ] Anonymous and authenticated builders each reach exactly one correct organization.
- [ ] Invitees join the intended organization; viewers receive no privileged controls.
- [ ] Free and paid paths retain server-enforced access; checkout cancellation/retry is recoverable.
- [ ] Saved account fields and organization name survive refresh and redirect.
- [ ] Guide completion is distinct from lesson, profile and publication completion.
- [ ] Back, Skip, Resume, reload and browser history preserve meaningful context.
- [ ] Failed save or expired session retains appropriate input and never advances silently.
- [ ] Missing/hidden targets produce a usable alternative; no reference to removed shortcuts.
- [ ] Existing organizations are not reset or forced through setup again.
- [ ] Mobile keyboard, scrolling, selection, drawer snapping and canvas event isolation work.
- [ ] Both themes, system theme and reduced motion are usable.
- [ ] First useful action and ending provide a real saved artifact or clear next step.

User appearance review is the primary product check. Use browser automation only to answer specific remaining questions when authorized. After appearance approval, update affected visual baselines in the repository's supported environment. Required hosted quality, security/RLS checks where affected and branch protection remain release gates; local tests alone do not establish release readiness.

## 10. Decisions, risks and rollout

Implementation decisions to resolve from evidence: actual required entry fields per mode; stable tutorial-progress storage owner; migration mapping for old step IDs; target fallback for unavailable paid lessons; organization-switch behavior; relevant entry mode for users who already completed onboarding elsewhere.

The default is to preserve existing access/payment/consent policy and keep optional education and publication optional. Ask the user only when the intended product behavior cannot be determined from those contracts. No additional product approval is needed for ordinary implementation within these bounds.

Release in bounded increments: entry copy/recovery first, custom welcome next, action-based setup and migration afterward. For risky guide migration, use an existing rollout mechanism or add a narrowly scoped reversible gate. Disabling a guide version must preserve all canonical organization work and existing valid workspace access.

Measure setup failure/retry, successful workspace entry, first saved profile action and guide resume/skip in aggregate if the current analytics contract supports them. Do not log free-form organization descriptions, private addresses or tokens. Establish a baseline before setting conversion or speed targets.

Next continuation: conduct O6 using the consolidated review packet. Resolve review findings before release; preserve all existing organization work.

### Latest review correction — consistent contextual steps (2026-10-10)

Welcome and later expanded steps now use one shared presentation: gradient header with overlaid close, centered compact text and one primary pill. Contextual steps retain a secondary Back / step count / Next row; the old toolbar, icon strip and dots are superseded. Desktop width stays consistent at 440px and remains bounded by the mobile viewport. No replacement orb. Focused checks pass; browser/device appearance and visual baseline review remain open.

Latest sizing correction: shared guide cards are now 380px wide with a shallow 5:2 gradient header capped at 152px, tighter padding and 18px headings. Removed all displayed step counts, including minimized mode. Back/Next and mobile touch targets remain. This supersedes the 440px sizing above.
