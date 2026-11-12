# Coach House preview: presentation and tester release

Date: November 8, 2026. Target: a usable hosted preview by tomorrow, subject to the gates below.

**Status: set aside by Caleb on November9; reference only.** The preview deadline and execution instructions below are inactive. Resume the master PRD’s preceding row2 checkpoint: profile/note metadata eviction, then legacy source binding. Retain the separately requested chat-height fix.

Historical proposal: Caleb requested this handoff with roughly 22% of his weekly coding allowance remaining. That is a work-budget constraint, not an authorization to spend provider credits. This document owns the bounded preview delivery; the master PRD still owns full MVP requirements.

## 1. Outcome and relationship to the master plan

A current production user can discover the preview, sign in, enter an isolated workspace, learn the interface, create or refine a plan, add it to the board, assign an eligible teammate, and reopen saved work. Caleb reviews the visual changes before release. No production customer data, billing state or Accelerator progress is silently moved or modified.

Master: `/Users/calebhamernick/Downloads/Coach-House-MVP-PRD-and-Phased-Spec-2.md`.
Repository authority: [Particle execution specification](2026-10-27-particle-system-execution-spec.md), especially “Production scope and execution order — November5” and “Retained AI board origins — November6.”

This is a named limited preview under the master’s existing pilot allowance. It does not declare rows 1–9 finished, erase unfinished permissions work, or turn a simulated prototype into the product. Current row2 work resumes from profile/note metadata and legacy canonical-source binding after this handoff; its evidence remains intact.

### Presentation scope

| Included and must work | Contained until separately qualified |
| --- | --- |
| Real canvas and existing manual creation/edit/save/reopen | Private-folder activation and legacy-source privacy promises |
| Existing real chat, bounded generation, proposal revision, Add to board and reopen | Unqualified connected-data answers, Memory and semantic retrieval |
| Team-only assignment, avatars and compact search | Production organization/team/data import or synchronization |
| A short dismissible feature tour and a compact Getting started entry | Full Accelerator conversion, new curriculum or rewritten progress storage |
| Existing Accelerator access through the same lesson surfaces | Credit sales/refills, Stripe Connect, outreach and unqualified provider mutations |
| Separate preview login, isolated tester workspaces, feedback and return to production | An unrestricted production-wide launch before capacity/access evidence |

AI generation is part of the intended preview. A manual-only fallback may be shown honestly if approved, but does not satisfy the full preview outcome above.

## 2. What is verified now, and what is not

- Source worktree: `/Users/calebhamernick/Development/coach-house-platform-particle-system-20261009`, branch `feat/particle-system-20261009`. HEAD `3957cd0847ad74dc400ee009ffcc90ce5613b26c`, ahead53, plus extensive tracked/untracked changes. HEAD alone is **not** the latest application.
- Existing local app: `http://localhost:3153/workspace?canvasChat=1`. Runtime is `/private/var/folders/l2/jpghvb_52t10fnrzxcs0bpd40000gn/T/ch-hosted-staging-app-duzgv6rw`; `ui-cleanup-source-sync.json` in `.tmp/ch-hosted-staging-20261103/` records source/runtime hashes. Preserve3153 and the independent3008 server.
- Staging origin: `https://staging.coachhouse.app`. Saved November4 deployment receipt says READY; that is historical evidence, not a fresh hosting/authentication check. Current3153 work is newer. Read the live alias, source artifact, environment and flags before deployment.
- Staging database: `coach-house-staging`, project `zsgpmivauqfsnrqbrgqb`; distinct from production. Existing setup was for synthetic qualification accounts, not automatic production-user access.
- Current local permissions slices have focused tests, browser fixtures and runtime sync receipts. Most recent library receipt:112 focused cases,10 browser cases per engine, TypeScript and lint. These do not establish live multi-user preview readiness or complete private folders.
- Real bounded AI plan acceptance exists; the paid test guard is now closed. Historical20-call/$3 or later bounded approvals are not unused tester credit grants. Inspect the latest ledger before proposing a new exact test/tester allowance.
- Read-only remote refs observed: main `730b6cdb190f8e4344ecc4e9d6fc4bcbb9aa754f`; Particle remote `a1bea871e6be482da87258f4f0637827747009bd`. Recheck before creating a release candidate.
- Shared SHIP revision40 has an older claim. Do not steal or edit it; resolve through the supported runner before any release operation requiring ownership. Documentation work does not change that claim.

## 3. Access decision: make the preview usable without connecting it to production data

### Recommended first release

**Separate staging authentication, real people, isolated preview organizations.** Let current production users opt in using their own email, with a clear one-time preview sign-in. Production passwords/cookies are not assumed to work across Supabase projects. The production navigation item is a link, not proof of authorization.

1. Inspect the existing staging sign-in/signup and callback flow, hosting protection, email delivery configuration and rate limits. Choose an existing supported verified-email flow; do not invent a second auth framework.
2. Configure exact staging callback origins and safe relative return destinations. Reject external redirect targets. Do not weaken protection for the production host or expose a Vercel bypass secret in the button/link.
3. Provision preview identity and organization through existing authenticated onboarding. One person gets one initial isolated preview organization; retries must reuse it. No shared writable demo account, default shared organization or automatic membership based only on an email string/domain.
4. Keep the existing owner/admin/member authorization model. A production teammate is not automatically a staging teammate. Collaboration requires an explicit staging invite and accepted membership. Assignments use that current eligible roster, including legitimate board/team roles—not every contact.
5. Start with an empty workspace or a separate synthetic starter board per organization. If seeded, create it once using existing writers; never seed into another tester’s board or duplicate it on login. Keep the internal qualification workspace out of public links.
6. State once at entry: “Preview workspace. Changes here won’t affect your live workspace.” Avoid persistent explanatory clutter. Provide an existing-menu route back to production and feedback.
7. Preserve saved preview work across sessions. Decide and disclose retention/reset policy before admission; never promise migration to production. No surprise nightly reset or silent promotion of preview data.
8. Verify the whole flow as a normal user without staff permissions, Vercel team membership, a preloaded cookie or internal account credentials.

For tomorrow’s first cohort, use a small named audience, then expand admission after the same route passes. The eventual button may be visible to all signed-in production users once self-service admission, capacity and spend caps are proven. Do not describe a manually provisioned cohort as universal access.

### Alternatives and trade-offs

| Option | Benefit | Cost / decision |
| --- | --- | --- |
| Separate verified preview login — recommended | Uses existing isolation and auth; low coupling; real users can test | One extra sign-in, fresh preview data; confirm this experience with Caleb |
| Production-authenticated one-time handoff | Smooth entry and provable existing-user eligibility | Requires a reviewed short-lived, single-use, audience-bound server exchange, replay protection and explicit identity linking; do not put bearer sessions or PII in URLs. Separate implementation if seamless entry is required |
| Preview app reading/writing production backend | Existing data and login can be reused | Exposes real users/data to unfinished schema/features; reject for this tomorrow preview |

If eligibility must be strictly restricted to existing production users, public staging signup alone is insufficient. Use a reviewed cohort admission process first, or implement the handoff. Do not silently weaken that requirement or store production credentials in staging.

**Decision before access implementation:** confirm separate login/fresh preview data versus strict seamless production eligibility. Complete candidate inventory and UI preparation while this is pending.

## 4. Production entry button: small independent release

Proposed label: **Preview new features**. Place it immediately below the current Coach House/Workspace item in the far-left app sidebar, using its existing row/icon/text sizing. Optional tooltip: “Coach House is getting updated.” No new promotional panel or automatic redirect.

- Target the validated staging entry route, not a hard-coded internal workspace ID. Preserve a route back to production. New-tab behavior is proposed so current work stays open; use the existing external-link convention and an accessible name.
- Put exposure behind a server-controlled rollout flag; initially off. If cohort-limited, enforce eligibility on the staging side too—hiding a link is not authorization.
- Implement this small production navigation patch from current main in its own isolated worktree after rechecking current navigation. Do not merge the entire Particle branch into production just to add a link.
- Staging acceptance precedes production link enablement. If production review cannot finish by tomorrow, share the authenticated staging URL directly with the initial cohort. That is a presentation fallback; the production button remains pending.
- Kill switch: disable the link/admission separately from preserving existing tester data. A hidden button does not terminate existing staging access.

Source map: `src/components/app-sidebar.tsx` and `src/components/app-sidebar/nav-data.ts`. The current local item is titled Workspace; verify production wording and position before editing.

## 5. Assigned-card UI: compact, consistent, unchanged authority

Use the existing assignment rail/popover/roster and save handlers. Match the current compact search/menu treatment; no new assignment model.

- Assigned state: small real profile photos or initials fallback in the existing overlapping avatar treatment. Empty state: plus avatar, white light-mode surface, thin border. Keep titles readable and controls consistently sized.
- Picker: one pill-shaped search input, normal-weight text, close icon/text spacing, left-aligned team rows with avatar/name and selected indication. All eligible members visible before typing. No empty list by default, redundant helper paragraphs or inert Clear selection button.
- Preserve keyboard selection, focus return, accessible labels, touch target size and contrast. Do not add default drop shadows, faded icon backplates or centered oversized rows.
- Preserve particle-versus-plan assignment scope, revision checks, dirty draft protection, permission enforcement, and assignability for documents/other supported particles.
- Confirm whether “assigned cards” also means a separate Tasks/My work surface; no supplied screenshot identifies that additional surface. Until clarified, this proposal targets the already discussed canvas assignment control.

Sources: `src/features/workspace-particles/components/particle-assignment-rail.tsx`, `particle-assignee-avatars.tsx`, `particle-responsibility-fields.tsx`. Caleb reviews one actual card and picker before applying further styling.

## 6. Tutorial and Getting started: reuse existing owners

### Screenshot observations

Reference: `/Users/calebhamernick/.codex/attachments/db25a3f6-fb8d-4513-a64a-dcdc7f5e4a9b/image-1.JPG`.

The screenshot shows a sidebar-sized, lightly bordered rounded card below navigation. “Getting started” and a percentage share a header. A vertical checklist uses leading status marks. One active step expands an illustration/action area inline; other steps remain compact. Completed work has a check and muted/struck text. The example uses a colorful integration illustration and hover label; those integrations and styling are references, not requested capabilities.

Translate the structure into Coach House’s existing tokens: thin border, no added heavy shadow, compact rows and one expanded step. Do not copy the sample’s4%, large spacing, logos, spinning status marks or gradient unless appropriate and reviewed. Loading, incomplete and completed are different states; incomplete rows must not appear perpetually busy.

### Proposed location and interaction

A collapsible **Getting started** card in the far-left app sidebar, below primary navigation and above Recents, preserving chat history. This location needs Caleb’s confirmation before implementation. On narrow/collapsed sidebars use the existing navigation surface, not an overlapping floating widget.

- Header toggles the list, with a clear chevron and progress summary. One active row opens at a time.
- Clicking a step opens the existing real editor, tool, lesson or tutorial target. Clicking never marks work complete.
- Suggested initial steps: organization details; create/open a plan; add a Particle; assign a teammate when eligible; continue Accelerator when entitled. Final copy and membership in the setup percentage follow the existing setup requirements—feature-tour steps do not inflate business setup completion.
- Render setup completion from saved organization state and Accelerator completion from existing server-backed module progress. Keep their denominators separate. Show no invented percentage while data is unavailable; never overwrite saved progress with a failed/empty read.
- “Tour seen,” “dismissed” and “lesson completed” are distinct. Dismiss/collapse state uses the existing scoped preference mechanism; actual completion never lives only in localStorage. Current setup-guide hook stores tour position/status locally, so cross-device tour resume is not yet proven.
- Dismiss pauses the guide; a compact reopen action remains available in the existing Help/setup entry. Resume returns to the same applicable step. Missing/unauthorized targets are skipped or shown unavailable without claiming completion.

### Arrow callout integration

Requested registry: [arrow-callout](https://lab.xevrion.dev/r/arrow-callout.json), [component page](https://lab.xevrion.dev/lab/arrow-callout).

Requested installation command:

```sh
npx shadcn@latest add https://lab.xevrion.dev/r/arrow-callout.json
```

Use the repo’s pnpm equivalent during implementation, inspect `--dry-run`/diff first, and never overwrite existing utilities blindly. Planning inspection used `pnpm dlx shadcn@latest view …`; nothing was installed into the app.

Registry inspection found `components/arrow-callout.tsx`, a reduced-motion hook and `lib/preview-play.ts`; dependency `motion`, registry dependency `utils`, marker/shadow CSS variables, Caveat font and demo preview context. The arrow primitive is **not** a complete onboarding system or automatic persistence/placement solution.

Adapt the arrow geometry/drawing to the existing tutorial anchor/connector layer. Remove demo-only context, avoid duplicate animation/reduced-motion dependencies, and scope any marker typography/color to the callout instead of changing global tokens. Do not adopt registry shadow styles throughout the app. Verify license/attribution before distributing adapted source.

One short callout at a time: one action plus dismiss; real semantic buttons, Escape, keyboard focus and reduced-motion support. Decorative arrow must not intercept canvas pointer events. Track the actual target through pan/zoom/resize; hide when offscreen or absent rather than pointing at empty space. Respect document fullscreen and existing overlay ownership. No permanent frame loop when closed; no compulsory blocking tour. Use established tutorial geometry where it already handles these cases.

Existing owner: `src/features/workspace-canvas-tutorial/`, including `use-setup-guide.ts`, `use-setup-guide-anchor.ts`, setup-guide domain/placement and connector components. Its current stage URLs reference older organization/Accelerator placements; verify against today’s combined sidebar rather than assuming those targets still match.

### Accelerator consolidation boundary

For this preview, the card is a launcher/progress summary over the existing Accelerator—not a replacement learning engine. Open the same lesson views, retain entitlement checks, notes, forms, completion records, close guards and saved drafts. Reuse `src/features/workspace-accelerator-card/` and `src/lib/accelerator/progress.ts`.

Only hide the duplicate Accelerator tab after the card provides equivalent discovery, resume and lesson access and Caleb accepts the placement. Until then retain it. Full conversion remains deferred in the master PRD; this proposal does not authorize deleting routes, migrating curriculum or marking lessons complete from a tutorial.

## 7. Execution order and exits

| Step | Work | Observable exit |
| --- | --- | --- |
| 1. Freeze a candidate | Inventory current dirty source/runtime differences and tracked/untracked dependencies; inspect current hosted alias, flags, schema and auth; preserve credentials/private evidence separately | Exact reproducible source manifest and existing artifact rollback pointer; no “HEAD equals latest” assumption |
| 2. Establish access | Resolve login/data decision; configure staging-only admission; make first normal tester’s organization/workspace reusable | Normal user can enter, reload, sign out/in and return to their own board without staff cookies |
| 3. Verify core loop | Use existing real chat/manual paths; fix only blockers to generate → revise → Add → assign → reload | Same plan identities/content retained, no duplicates, results beside chat in open space, useful saved work |
| 4. Directed presentation changes | Compact assignment styling; adapt arrow guide; add reviewed Getting started placement | Caleb approves actual3153 UI; dismiss/resume and keyboard work; existing drafts/progress survive |
| 5. Package and deploy staging | Reconcile required changes with current main without losing lane work; inspect required migrations; run relevant checks and release gates; deploy only staging artifact | Immutable artifact, successful hosted build, correct alias/backend and normal-user acceptance |
| 6. Admit a small cohort | Set explicit spend/admission limits; run two-user access/collaboration checks; provide minimal feedback/return path | Testers can use the intended loop; no cross-org data exposure or uncontrolled spend |
| 7. Production entry | Separate navigation-only PR, required current-head quality/review; enable only after staging accepted | Button below Workspace opens verified preview; production workflows unchanged |

Do not make finishing all row2 infrastructure the critical path for a contained synthetic-data preview. Conversely, isolation does not excuse a failing cross-organization check. If an unfinished path leaks or cannot be gated, fix the demonstrated blocker or exclude that capability explicitly; do not expose private-folder controls or claim private data support.

Allocate remaining effort roughly: first third access/candidate/core loop, middle third reviewed UI and tutorial, final third hosted verification/release contingency. This is a planning allocation, not a measured duration estimate. Stop optional visual polishing before sacrificing the normal-user test or release gates.

If time slips: defer removing the Accelerator tab, elaborate illustrations and seamless login; keep the compact tutorial, real save/reopen and clear sign-in. If hosted gates fail, present the verified direct preview only when safe; otherwise report the exact failing gate. Never silently call localhost a hosted release.

## 8. Spend, safety and release checks

Before enabling tester AI, prepare an exact allowance: cohort size, per-user cap, shared organization/global cap, maximum turn cost, expiry and kill switch. Use existing credits/reservation/run accounting, including concurrency and successful clarification charging rules; do not build payments now. Obtain Caleb’s explicit budget authorization. Enforce limits server-side; disabling a button is not a cap. Exhaustion must preserve drafts and offer concise recovery without a purchase promise.

Keep unqualified Gmail/Calendar sends, live billing and broad provider writes disabled. Verify staging environment variables and scheduled workers cannot call production infrastructure. Inspect schema delta against the actual staging ledger; do not replay every migration or blindly execute deployment scripts with old credentials/targets. Use additive reviewed changes; rollback code must remain schema-compatible.

One focused acceptance pass on the final candidate:

1. Normal production tester reaches preview entry, signs in separately, owns only their preview organization, and returns to production. Existing staging user is reused without duplicate seed data.
2. Real authorized AI turn → revision → Add → assignment → reload; independent saved-state readback. Duplicate submit/retry does not duplicate plan or charge; exhausted cap blocks dispatch and retains draft.
3. Two distinct organizations cannot enumerate/read/mutate each other’s chats, files, sources or boards. An invited teammate gets only current authorized access; revoked member fails on the next protected operation/revalidation. Owner retains access.
4. Setup percentage reflects actual saved state. Tour dismissal/resume is scoped, reduced motion and keyboard work, fullscreen covers canvas chrome, and old Accelerator progress/entitlements remain intact.
5. One relevant desktop/mobile check and light/dark review on changed surfaces; no chat-bar movement, text clipping, impossible hover target or lost editor draft.
6. Fresh hosted login and save/reopen after deploy, correct staging backend/alias, noindex behavior, authorized cohort admission and bounded budget. Local fixture passes do not replace this.
7. Required repository/CI/review/branch-protection gates for the exact release revision. Reuse valid focused results; run broader checks only where candidate integration/release requirements invalidate them. Do not weaken thresholds or mass-update visuals to force green.

Rollback: retain prior immutable staging deployment, source manifest, flag values and schema compatibility notes. Disable new admission/AI immediately for a demonstrated problem; revert only this preview’s app/flags. Preserve user work and evidence. Production navigation can be switched off independently. Do not roll back by wiping staging data.

## 9. Handoff and decisions

**This turn delivered planning only.** No runtime code, registry installation, credentials, database, provider settings, server, deployment or production navigation changed.

Before implementation, resolve only these consequential choices:

- Separate preview sign-in/fresh data (recommended) versus seamless verified production handoff; named initial cohort versus immediate general availability.
- Getting started location: far-left sidebar below primary navigation/above Recents (proposed); keep Accelerator tab until replacement accepted.
- Confirm the assignment surface if Caleb meant more than canvas assignment controls.
- Exact approved tester AI allowance and preview retention/reset policy before admission. Do not reopen closed paid-test budgets.

The next chat should start with candidate/access verification, then expose the app for Caleb’s directed UI review. It should not restart the master plan, continue unrelated row2 work, rewrite auth, build a simulated demo or recreate onboarding from scratch.

Suggested handoff prompt:

> Read AGENTS.md and `docs/plans/2026-11-08-staging-preview-presentation.md` in the existing Particle worktree. This is the bounded tomorrow preview subplan of my Downloads master PRD. Preserve current source, private files and3153/3008. Start with step1 and the access decision; verify actual current staging state. Implement the smallest complete preview journey with our existing UI/AI/tutorial/Accelerator owners. Ask only the unresolved placement/access/budget questions above, keep working on independent preparation, and retain all release gates. Do not treat this plan as deployment or paid-call approval.

Verification for this document: current source/checkpoint and registry inspection, screenshot review, linked local-path checks, mirror equality and diff hygiene. Hosted access, artifact currency and release behavior remain implementation evidence to collect—not claims made by this plan.
