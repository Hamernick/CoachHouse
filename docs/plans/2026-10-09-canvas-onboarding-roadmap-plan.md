# Canvas onboarding, organization launch, and roadmap experience

**Closed by Caleb on October 12, 2026.** Remaining follow-ups are tracked in his separate to-do list; its location was not supplied. PR [#288](https://github.com/Hamernick/CoachHouse/pull/288) merged as `73dd8d15`; the canonical `coachhouse` Vercel deployment reports success. Migration `20261012163000` was applied and verified. This closes this workstream, not every verification gap: final PR visual/quality checks failed, the secondary Vercel project failed, and authenticated signup/payment/unlock verification remains unconfirmed. Do not resume historical tasks below without a new request. The connected planner remains abandoned.

The remainder of this document is historical evidence, not an active task queue.

Created October 9, 2026; updated October 10, 2026. Status: onboarding and publication remain under local review; the separate connected planner is abandoned; production release is not complete. No release is established by this document.

## Current continuation index — October 10

**Scope correction:** The user rejected and abandoned the separate connected planner. Its local code and navigation have been removed. Any older planner/AI expansion language below is historical and must not be treated as authorized future work. Original prompt and seven references: `~/Desktop/Onboarding references - original prompt/`.

This is the master plan for this chat. The following two active implementation plans expand the remaining work; they are coordinated parts of this plan, not unrelated redesigns.

| Area | Detailed plan | Current local status | Next gate |
| --- | --- | --- | --- |
| Account/organization entry and guided canvas onboarding | [Onboarding implementation](2026-10-10-organization-onboarding-implementation.md) | O1–O5 implemented: entry, recovery, contextual real-action guide and resume | O6: user review and release verification |
| Public-profile preview, publishing and location status | [Publication implementation](2026-10-10-organization-publication-implementation.md) | P1–P5 implemented: shared map preview, intentional publishing, programs and truthful location status | P6: user review and release verification |

Each detailed plan includes source owners, user journeys, states, failure/recovery behavior, dependencies, bounded implementation slices, testing, acceptance checklists and release/rollback rules. These are implementation plans, not evidence that their unchecked work has shipped.

### User review correction — October 10

The first static onboarding guide did not meet the brief. Its completion claim was premature. The replacement local walkthrough uses sequential contextual canvas/drawer guidance, a compact gradient header (no orb), actual People/roadmap/launch interactions, and a saved-state ending. Review remains open; see the updated onboarding plan.

### Latest decisions and implemented foundation

- The card stays. Its title is **Build your nfp**; only the **501c3** tag was removed. React Grab had identified the parent card when the user intended that tag.
- The dismissible banner spans both columns on wide drawers. Below it: launch card on the left; Accelerator progress/lessons on the right. Narrow screens stack. Keep equal 24px space above/below the banner.
- Keep the front-page map renderer in a minimal 16:9 preview. Public/Private is a saved visibility indicator, not proof of a particular map pin. The full checklist remains after publication; the completed publish badge says Published.
- Menu hover/navigation, banner recovery, the launch foundation, editor breadcrumbs/deep links and full-height profile-edit return flow exist locally. The launch return URL now preserves focus and full-height geometry on reload; scrolling is constrained to drawer content.
- The October 10 closeout adds scoped failed-save recovery and a contextual guide and exact map-profile review with explicit publishing. These are implemented locally, with human appearance and authenticated workflow review still pending.
- Selected merged PR #276 fixes were reconciled locally. Current-main release reconciliation, appearance/interaction review, required hosted checks, merge, configuration, deployment and production verification remain separate completion gates. Preserve unrelated rapid-UI edits and keep unrelated Marketplace/Drive failures outside this scope.

The current continuation index and linked implementation plans supersede older recommendations below where the user subsequently changed the design. Historical checkpoints remain labeled as such to avoid restarting completed work.

## Consolidated review

[Review packet and task inventory](../qa/rapid-ui-local-review-20261010/README.md) covers all still-local changes in this chat, including profile/sidebar/People/drawer fixes outside these three plans. No production mutation or worktree retirement is included. Connected-planner extensions are abandoned, not deferred.

## 1. Recommendation

Make the Workspace a place where people build their organization through real actions, with the Accelerator supplying guidance when needed. The first useful milestone is a public organization profile. A separate connected planner was an incorrect expansion of the reference and has been removed.

Use three coordinated surfaces:

1. **Roadmap navigator:** a compact, clearly interactive menu for moving between existing strategic sections.
2. **Organization launch card:** a persistent, truthful progress card inspired by Image 1, below a smaller Accelerator overview banner; a linked canvas representation remains planned.
3. **Canvas guide:** a short, custom introduction that uses the agreed compact gradient presentation, then helps users complete actual work. Image 7 remains a visual reference, not a separate feature specification.

These surfaces share underlying records and progress definitions. They are not three independent checklists.

**Recommended sequence:** improve the navigator and banner first; establish the launch milestone and persistence contract; replace the outdated tutorial with the working guided journey; review and ship those improvements. Do not hold the useful initial improvements for an AI planner or public-map redesign.

### Alternatives considered

| Approach | Benefit | Tradeoff |
| --- | --- | --- |
| Only restyle the dropdown | Fast, low risk, immediately clearer navigation | Leaves onboarding and publication fragmented; useful first increment, insufficient destination. |
| Replace everything with the full connected canvas now | Closest to Image 7 immediately | Too many simultaneous changes to persistence, onboarding, navigation, and public visibility; harder to understand or ship safely. |
| **Layered journey: navigator → launch card → connected objectives** | Delivers useful changes early and grows from real saved work | Requires an explicit shared progress contract so surfaces stay consistent. Recommended. |

## 2. Scope and evidence

The original design pass followed a planning-only request; the user then authorized implementation and later requested these extensive continuation plans. The prior Hairline `Exploded` request is excluded. All seven images below are intentional references for this plan.

Inspected source: `feat/rapid-ui-ux-20261007`, worktree `coach-house-platform-rapid-ui-ux-20261007`, HEAD `c1cf32d3`, with existing uncommitted UI work preserved. Its locally recorded upstream comparison is ahead 1 / behind 13; remote main and production were not refreshed. Findings describe this checkout, not a verified production reproduction. No browser session, account mutation, server restart, or deployment was performed.

The user's report that onboarding feels outdated/broken is the product problem. Source inspection identifies likely mismatches, but does not establish every runtime failure. Before implementation, reconcile recent onboarding fixes and the public-page workstream against current main; do not replay or undo fixes already shipped elsewhere.

### Original findings before the October 9 implementation

This table records the initial audit. Use the current continuation index above for implemented banner/card/navigation behavior.

| Current surface | Verified source behavior | Design consequence |
| --- | --- | --- |
| Roadmap dropdown | Flattens existing groups into rows with child indentation, status dots, completion checks, and a total. Shared menu items use focus styling; the local menu uses a muted background. | Preserve destinations and status logic initially. Give highlighted rows explicit contrast and stronger grouping; verify the perceived missing hover state rather than assuming Radix has none. |
| Accelerator drawer banner | `showBanner = !requestedModuleId && !isModuleViewerOpen`; banner is already excluded from explicit lesson views. The banner itself has no dismissal. | Preserve lesson exclusion, reduce overview prominence, and add durable dismissal. Investigate any remaining repeat appearances within overview/class changes. |
| Separate Accelerator welcome banner | A separate component already has versioned, per-user local dismissal. | Borrow the behavior, not the unrelated full-page composition. Avoid two competing welcome experiences. |
| Canvas tutorial | Uses a blue `Dithering` sphere. Sequence describes Organization, Map, drawer, Accelerator/classes/lessons, Calendar, Programs, roadmap, and collaboration. Copy mentions Finance and “nine strategic lessons.” | This is the spinning-ball surface to retain. Audit copy and target availability against current controls and entitlements; replace the feature tour with meaningful actions. |
| Account setup | Builder constants include intent, pricing, organization, account, and community; actual visible steps vary by mode. Non-builder routes differ. | Do not redesign this as a single universal five-step flow. Keep essential account setup separate from organization launch and optional education. |
| Readiness | Accelerator readiness combines profile, formation lessons, roadmap, funding goal, team, and uploaded documents into “fundable/verified” signals. | This score is not a public-profile publishing checklist or independent verification. Do not reuse it as either. |
| Public profile/location | Public settings explicitly allow publication without an address, while warning there will be no map marker. Online-only organizations clear coordinates in the save action. | Separate public profile, directory visibility, and map pin states. Never claim a pin exists merely because a profile is public. |
| Objectives | A normalized objectives domain and server actions exist; its component entrypoint is empty in this checkout. | Reuse and audit the domain before adding UI. Image 7 is not already an implemented planner. |

## 3. Reference interpretation

The links below point to the supplied local images; they are reference material, not production assets or portable repository attachments.

### Image 1 — Organization builder / map progress card

[Open reference](</Users/calebhamernick/Downloads/440a3fe8-1f57-4df3-a98f-2f472fc3e0a8.png>)

**Take:** a restrained rounded boundary, strong title, quiet progress summary, compact map preview, aligned checklist, obvious current task, and a useful footer. It makes a multi-step process feel finite and tangible.

**Translate:** use the user-selected title **“Build your nfp”**, real saved completion, and a single “Continue setup” or “Review profile” action. Keep the wider organization-building journey available after publication. The original “Get your organization public” title proposal was superseded.

**Avoid:** copying “6 of 8” when the rows disagree; a completion check next to an unfinished program; unexplained region counts, latency metrics, invented durations, or “filed” based on watching a lesson. Filing for tax exemption is not automatically a prerequisite for a public listing. A generic globe is decorative until real public location data exists.

### Image 2 — Contextual introduction with an image cap

[Open reference](</Users/calebhamernick/Downloads/Screenshot 2026-10-09 at 11.40.43 AM.png>)

**Take:** a compact, contextual explanation near the relevant feature; one headline, one short paragraph, one primary action and an optional secondary action. The image cap establishes character without competing with the task.

**Apply:** first-use Accelerator introduction or a “What happens when I publish?” explanation at the point of review. Use an explicit trigger for interactive content, with focus and dismissal support. Do not require hovering to discover an essential instruction.

### Image 3 — Soft blue/cyan visual atmosphere

[Open reference](</Users/calebhamernick/Downloads/Screenshot 2026-09-05 at 6.22.49 PM.png>)

**Take:** soft blue, cyan, and periwinkle fields; quiet depth and low visual noise.

**Apply:** a small introductory art panel or the backdrop behind the existing sphere. Keep forms, statuses, and controls on legible solid surfaces. Do not fill every canvas card with a gradient or continuously animate multiple backgrounds.

### Image 4 — Strong brand expression

[Open reference](</Users/calebhamernick/Downloads/b44a4413-852a-4e55-99c7-f8a40ff993ca.png>)

**Take:** confident typography and a recognizable blue/violet palette. It supplies the brand energy missing from a generic onboarding template.

**Apply:** one welcome moment with concise, product-specific language, for example **“Build your organization. Share your work.”** Copy is a proposal, not a new brand decision. Do not inherit “Collect NFP’s” as onboarding copy or crowd compact workflow cards with poster-scale type.

### Image 5 — Feature introduction / completion moment

[Open reference](</Users/calebhamernick/Downloads/Screenshot 2026-09-09 at 11.08.10 PM.png>)

**Take:** a few visual artifacts explaining the outcome, short centered copy, one action, and an obvious close control.

**Apply:** a one-time welcome showing the user's future profile, program, and roadmap; or a restrained publication success moment showing the actual saved profile. Prefer an inline canvas card. Reserve a modal for a deliberate, focused interaction; no recurring announcement gate.

### Image 6 — Focused task and recovery hierarchy

[Open reference](</Users/calebhamernick/Downloads/Screenshot 2026-09-12 at 1.26.37 AM.png>)

**Take:** clear title → instructions → main task → fallback → completion action. Recovery is present without dominating the screen.

**Apply:** publication review, failed save recovery, and location-resolution guidance. Show the exact next action and a safe way to continue privately. This reference does not request identity verification, a QR flow, email handoff, or a Google integration. Do not reuse its QR code or identity-related copy.

### Image 7 — Primary long-term product direction

[Open reference](</Users/calebhamernick/Downloads/Screenshot 2026-09-16 at 1.35.20 AM.png>)

**Take:** a dark dotted workspace; a selected objective connected to ordered steps; adjacent tasks, useful relationships, and communication destinations. The connections explain how work produces outcomes.

**Apply:** the first objective can be **“Publish our organization.”** Selecting it reveals only the relevant work, using the same editors and records as the rest of the app. Later objectives can connect programs, people, tasks, documents, and resources.

**Avoid:** shipping the whole graph at once, decorative connector webs, empty statistics, fabricated resource recommendations, or treating AI suggestions as approved work. “Social,” “Money in,” and “Money out” require real definitions and authorized data. Image 7 establishes a destination, not permission to launch finance, integrations, or an autonomous AI planner.

## 4. Product model: name the different kinds of progress

| User question | Visible label | Source of truth |
| --- | --- | --- |
| Can I enter the app? | Account setup | Required account/organization access fields and server onboarding rules |
| What have I learned? | Accelerator progress | Persisted lesson/module completion |
| Have I written my strategy? | Strategic roadmap | Existing roadmap sections and their saved status |
| Can people see my organization? | Public profile | Publication eligibility, saved visibility, public data projection |
| Can people find a location? | Map location | Public location choice and resolved coordinates, separately from listing/search inclusion |
| What are we working toward? | Objectives | Objective/task records and explicit relationships |

The same saved mission or program can satisfy more than one relevant requirement. Do not duplicate its editor or store a second “completed” boolean that drifts from the real record.

“Next” means move through guidance. “Saved” means persistence succeeded. “Complete” means the underlying requirement is satisfied. Merely visiting a screen or finishing the tour does not complete the organization.

## 5. First improvement: a better roadmap navigator

Keep this as a navigator. Do not place the whole map and onboarding wizard inside a narrow dropdown.

Proposed layout:

```text
Strategic roadmap                       3 / 8
---------------------------------------------
Foundations
  [check] Organization story
  [ring]  Mission, vision, and values   Current
  [open]  Community need
Programs
  [open]  Program plan
---------------------------------------------
Open roadmap
```

Labels and counts above are illustrative, not a replacement for the existing section taxonomy.

- Give every enabled row a full-width rounded hover/highlight fill with clear text contrast; use Radix highlighted state for pointer and keyboard consistency.
- Current destination has a persistent, quieter treatment; hover must not look like completion or selection. A completed item gets a check plus an accessible status label.
- Preserve logical group headings and child indentation. Avoid double-counting a group heading as a task when it is only an aggregate; audit the existing group/section model before changing totals.
- Keep titles readable: allow two lines for long names; align status and navigation affordances consistently. Desktop rows can be compact; touch targets remain at least 44px.
- Prefer a stable menu width around 320–360px if it fits; clamp to viewport width with side gutters. Keep the list scrollable and current item discoverable without trapping the whole page.
- Preserve arrow navigation, typeahead, Enter/Space, Escape, focus return, and drawer-aware routing. Use real navigation links where destinations support opening separately; retain explicit actions for in-place drawer commands.
- Scope styling to the semantic roadmap owner. Do not change the shared Button or all dropdown menus for this fix.

**Done when:** users can distinguish hover, keyboard focus, current destination, and completion in both themes; long titles work on mobile; every row reaches the correct section; counts remain truthful.

## 6. Accelerator overview and organization launch card

### Placement and banner

Current requested overview order on wide drawers:

```text
[Compact Accelerator introduction spanning both columns             ×]

[Build your nfp                 ]  [Accelerator progress / class picker]
[16:9 public map preview       ]  [Existing class and lesson content  ]
[Saved setup checklist        ]
[Private/Public + next action ]
```

On mobile, banner, launch card and Accelerator content stack. The preview and checklist stay inside the card. Keep the next action usable without a large illustration dominating the screen. A future canvas summary node should open/focus this same experience rather than mounting a duplicate editable checklist.

The banner becomes one short heading, one supporting line, a restrained sphere/art treatment, and a close action. It appears only on the overview until dismissed, never in a lesson, assignment, profile editor, or publication review. Persist dismissal per user and organization through the established workspace preference mechanism where available; make it recoverable from Help. A content version can support later explicit reintroduction, but navigation must not reset dismissal.

### Proposed launch checklist

Treat these as candidate requirements to validate against server contracts, not new prerequisites silently imposed on users:

| Step | Intended saved outcome | Requirement |
| --- | --- | --- |
| Organization basics | Organization name and valid public URL | Required for publication |
| Explain your work | A concise public description/mission | Recommended minimum; confirm existing validation before enforcing |
| Choose how people reach you | Online destination or public location/contact choice | Conditional on organization/service type; private addresses remain private |
| Add a program or activity | Real saved program, with its own visibility choice | Recommended, skippable; not an automatic publication gate |
| Preview and publish | Review exactly the public projection, then explicitly publish | Required consent/action; never automatic |

Logo, banner, donation link, newsletter, social links, full strategic plan, legal formation curriculum, and team invitations can improve the profile without becoming arbitrary access gates. Existing policy and entitlement requirements must be reconciled before promising any new access level.

Show required completion separately from optional enrichment: “3 of 4 essentials ready” plus an optional “Add a program.” No misleading 100% for an unpublished profile. Do not estimate time until measured; use a concrete next action instead.

### State and publication behavior

| State | User sees | Action |
| --- | --- | --- |
| Empty/partial | “Private draft,” missing essentials, one recommended next step | Continue setup |
| Essentials ready | Preview of the public fields; visibility still private | Review profile |
| Saving/publishing | Immediate pending feedback, preserved inputs | Prevent duplicate writes; retry on failure |
| Published, no pin | “Public profile”; explain online-only or unresolved/missing location as applicable | View profile; optionally configure location |
| Published with verified placement | Real public marker preview and profile link | View on map |
| Publication unavailable | Specific permission, entitlement, service, or configuration reason | Useful recovery; do not show a mystery disabled switch |

A publication preview excludes private people data, internal notes, private programs/documents, and private contact/location fields. Publication should use an allowlisted public projection, explicit authorization, and current server validation. Reuse existing program-level visibility controls, private by default. The public-page redesign must consume the same records and contract rather than a parallel format.

Successful publication ends with the real profile and “View profile,” with “Keep building” secondary. Public search indexing or map refresh may lag; distinguish a saved public flag from confirmed discoverability. Unpublishing must retain the user's work and allow later republishing.

## 7. Custom onboarding: do useful work on the canvas

### Keep the sphere; replace the tour script

The current sphere is in `workspace-canvas-tutorial-panel.tsx`, not the account form. Retain its recognizable visual identity, but make the surrounding content specific to the current product. Do not confuse it with the public-map spinning globe.

Suggested journey:

1. **Minimal entry:** authenticate and collect only the fields needed for a valid account/workspace. Preserve existing billing, consent, invitation, and role handling. Reuse known information rather than asking again.
2. **Welcome on the canvas:** “Let’s make your organization ready to share.” Primary action: “Set up profile.” Secondary: “Explore workspace.” Briefly explain that drafts are private.
3. **Build the profile:** open the real Organization editor, with one contextual instruction and saved progress in the launch card.
4. **Describe a program:** offer the actual program editor when relevant, with an explicit skip. Explain its separate public visibility choice.
5. **Preview and publish:** use the real public projection and location rules. This is a user decision, not a tour step advancing automatically.
6. **Continue building:** reveal relevant Accelerator lessons and the next meaningful objective; suggest team invitation only when it helps.

The persistent launch card remains available after skipping the guide. New guides must not force existing users through account setup again or erase completed curriculum. Returning users resume useful unfinished work; invited members join their existing organization rather than creating a duplicate. Read-only roles receive a relevant tour and an explanation of who can edit/publish.

### Interaction rules

- Teaching should follow a real action: “Add your mission,” then save into the canonical profile. Avoid thirteen “Continue” screens explaining controls that may be hidden or unavailable.
- Show only the next relevant branch of the canvas. Preserve user node positions; no global rearrangement or repeated automatic zooming. Focus a relevant node when the user requests the next task, accounting for drawer occlusion.
- Allow Back, Skip, Resume, and Help. Persist stable step identifiers/version, organization scope, and dismissal separately from business completion.
- Do not advance on a failed save, missing callback, unavailable target, or unresolved conflict. Keep the current editor open with recoverable inputs and an actionable error.
- Make guide target resolution conditional on current permissions, entitlements, visible controls, and feature flags. Hidden Finance/Programs/Map shortcuts must not strand the user or reappear just for a tutorial.
- Retain text selection, normal form interaction, keyboard access, and drawer/canvas event isolation. Guide overlays cannot intercept the editor or pass clicks through to underlying nodes.
- Pause decorative motion when offscreen/hidden; offer a static sphere for reduced motion and a rendering fallback if the shader cannot run. Do not delay interaction until an animation finishes.
- On mobile, present the same actions in an ordered, full-width panel/list with normal vertical scrolling. The user should never need precise panning or drag gestures to finish onboarding.

## 8. Connected planner — abandoned

This feature was an incorrect interpretation of Image 7. The user cancelled it on October 10; implementation was removed. Do not rebuild it or schedule its extensions.

## 9. Visual and interaction system

Use existing shadcn primitives, shared workspace typography, and theme tokens. Prefer solid card surfaces, thin borders, restrained shadows, consistent radii, and deliberate spacing over layers of translucent boxes. Gradients belong to welcome/art moments; status remains readable in light and dark mode.

Use one primary action per task, quiet secondary actions, and consistent controls. Hover adds a subtle surface fill and stronger contrast, not layout movement or oversized borders. Completion, current task, hover, focus, and selected node are different states with different cues.

Loading skeletons should match final geometry. Feedback begins immediately; slow requests retain their label and explain the pending action. Saved progress and counts update only from confirmed data. Keep WebGL/map previews out of the critical form path; a static preview or placeholder is enough until location is useful.

## 10. Applying the 21 UX laws

These are design heuristics supplied by the user, not guarantees or a reason to impose arbitrary limits.

| Principle | Concrete application |
| --- | --- |
| Fitts | Whole roadmap rows and generous touch actions; next action near the task. |
| Hick | One recommended next step; reveal optional choices progressively. |
| Jakob | Familiar menu, checklist, editor, preview, and publish behavior. |
| Miller | Group related work; avoid asking users to remember a long tour. No arbitrary seven-item rule. |
| Tesler | Keep necessary publication/privacy complexity, handled by sensible defaults and conditional fields. |
| Doherty | Immediate input feedback; explicit pending/saved/error states. Measure response times rather than inventing a universal threshold. |
| Aesthetic-usability | Cohesive sphere, typography, spacing, and restrained art; aesthetics never excuse broken actions. |
| Goal-gradient | Show accurate remaining essentials and the approaching publication outcome. |
| Peak-end | Make the first saved artifact and successful publication satisfying and useful. |
| Von Restorff | Distinguish the next action; avoid making every row or badge an accent. |
| Zeigarnik | Provide a resumable next task, without guilt, nagging, or false urgency. |
| Serial position | Put the current objective first and the next action at the natural end. |
| Proximity | Keep a status/error beside its field or task. |
| Similarity | Same row anatomy and status vocabulary across navigator, checklist, and canvas. |
| Common region | Clear card boundaries separate profile launch, learning, and strategic work. |
| Prägnanz | A few understandable nodes and clear grouping before expanding the graph. |
| Uniform connectedness | Draw connections only when they explain a real relationship. |
| Occam | Improve existing components and domain models before inventing a new workflow engine. |
| Pareto | Deliver the menu, next action, save/resume, and publication preview before sophisticated graph/AI work. |
| Postel | Accept sensible input variations; normalize and validate on the server. Never relax auth, URL safety, or consent. |
| Parkinson | Bound each delivery by a small reviewable outcome; do not bundle the entire platform redesign. |

## 11. Technical ownership and data contracts

Paths are relative to repository root. Reconcile them with current main before implementation.

| Area | Starting owners |
| --- | --- |
| Navigator | `src/components/roadmap/roadmap-navigator-dropdown.tsx`; `roadmap-editor/helpers.ts`; `roadmap-navigator-section.tsx` |
| Drawer composition | `src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-overlay-accelerator-panel.tsx` |
| Accelerator feature | `src/features/workspace-accelerator-card/components/workspace-accelerator-banner.tsx`, `workspace-accelerator-card-panel-support.tsx`, progress/checklist components |
| Canvas guide | `src/features/workspace-canvas-tutorial/components/workspace-canvas-tutorial-panel.tsx`, `lib/index.ts`, controller/types; workspace onboarding scene configuration |
| Account entry | `src/components/onboarding/onboarding-flow.tsx`; onboarding constants/derived step filtering; `src/app/(dashboard)/onboarding/page.tsx` and actions |
| Profile writes | `src/lib/onboarding/organization-profile-write.ts`; `src/actions/organization.ts` |
| Existing progress | `src/lib/accelerator/progress.ts`; `readiness.ts`; `use-workspace-accelerator-completion.ts` |
| Publication UI | `src/components/organization/org-profile-card/tabs/company-tab/edit-sections/public-page-settings.tsx`; programs tab and public profile consumers |
| Objectives | `src/features/workspace-objectives/**`; existing board objective persistence and layout adapters |

New domain logic belongs in `src/features/**`, scaffolded if a new feature is necessary; route files remain composition-only. Prefer a small organization-launch feature or an existing owning feature after boundary review. It should expose one computed readiness result used by the card, guide, and publish review.

Proposed readiness contract: stable requirement ID, label, required/optional/conditional classification, saved status, reason when blocked, and a destination/action. Include separate publication and location states. Derive eligibility server-side; UI completeness is not authorization.

Preserve existing public slugs on organization renames, saved data over stale browser drafts, completed-onboarding metadata on revisits, and concurrency/conflict handling. Tutorial completion must never mark lessons complete. Curriculum completion must await its canonical save callback. Store durable preferences through the existing scoped preference contract rather than introducing ad hoc localStorage keys throughout components.

Do not couple this work to the frontpage visual redesign. Agree on public program fields, visibility, ordering, and empty states so both current and redesigned public pages can render the same data. Audit global sharing flags separately: enabling a flag that also exposes Community or public roadmaps is a release decision, not an incidental UI fix.

## 12. Delivery plan and review gates

| Phase | Reviewable outcome | Exit criteria |
| --- | --- | --- |
| 0. Reconcile and specify | Current entry-path inventory and a clickable/static layout proposal for menu, overview, guide, and public review | Confirm correct branch/server, recent fixes, sphere owner, real targets, roles/plans, publication rules, and dependency ownership. Reproduce reported breaks where possible. |
| 1. Navigator and banner | Clear menu interaction; compact dismissible overview introduction | Pointer/keyboard/touch states and both themes reviewed; existing routes and progress preserved; no repeated lesson banner. Independently shippable. |
| 2. Organization launch | Real checklist, next action, preview, explicit publish, distinct map-location status | Save/reload/resume and failures work; optional programs stay optional; private data excluded; permissions and actual public visibility verified. Public-page redesign not required. |
| 3. Guided canvas onboarding | Custom contextual introduction and real action-based setup | Current controls only; new/returning/invited/read-only users handled; skip/resume/back reliable; no forced tutorial reset or duplicate organization. |

Phase 3 can be designed alongside Phase 2, but must use its stable save/readiness semantics. The previously proposed connected-planning and assistance phases are cancelled. No calendar estimates are asserted until current-main reconciliation and access-policy decisions are complete.

### Focused validation for implementation

- **Navigation:** highlighted/current/completed states, group totals, long labels, keyboard/typeahead/Escape/focus return, correct drawer/deep-link destination.
- **Persistence:** save failure/retry, conflict handling, back/reload/resume, organization switch, existing slug/name preservation, duplicate-submit protection.
- **Publication:** anonymous view contains only public fields/programs; unauthorized roles cannot publish; online/no-address/geocode-failure states do not promise a pin; unpublish/republish retain work.
- **Onboarding:** returning completion survives version changes, hidden targets are skipped safely, invited members avoid organization creation, entitlement and checkout-return behavior remain intact.
- **Canvas:** overlays never leak pointer events, editors remain selectable/interactive, new nodes appear in the visible region, focus respects the drawer, no automatic rearrangement of existing work.
- **Appearance/accessibility:** user review of the affected desktop and mobile surfaces in both themes; visible focus, touch targets, zoom, reduced motion, empty/error/loading states. Capture only evidence needed for unresolved questions.
- **Release:** focused tests during development; required current-revision hosted quality and branch protection before merge. Update affected visual baselines after appearance approval in the repository's supported environment. Report local, CI, merge, deployment, and live verification separately.

### Success signals

Measure guide start → first saved profile → preview → successful publication, time to first saved artifact, abandonment by task, recovery from failed saves, and resume success. Measure map visibility separately. Track lesson progress separately. Avoid sending profile text, private addresses, or other sensitive values to analytics. Establish a baseline before setting conversion or timing targets.

## 13. Decisions to settle before dependent implementation

1. **Publication eligibility:** recommended minimum is a useful public identity and explicit visibility consent, not completion of the Accelerator or legal formation. Confirm server policy, plan eligibility, and moderation requirements.
2. **Public location:** retain valid public profiles without pins; online-only organizations should have an online destination. A service-area option needs its own privacy and map behavior specification.
3. **Launch card prominence:** resolved through user iteration: banner spans the overview; launch card remains left of lessons on wide drawers and retains the full checklist after publication. A compact canvas representation is still future work.
4. **Banner/guide persistence:** recommend per-user, per-organization dismissal/resume with a recoverable Help entry; preserve returning users' completion across rollout.
5. **Scope of account setup refresh:** audit copy and broken entry behavior now; do not change plan pricing, entitlements, consent, or checkout as a side effect of the canvas redesign.

These are bounded product decisions for the relevant phase, not reasons to delay the initial menu/banner improvements.

## 14. Implementation handoff

Resume from O1/P1/C1 in the linked detailed plans; do not replay the already-implemented menu/banner/card foundation. Preserve all unrelated rapid-UI edits. Do not implement the supplied reference images as literal screens, install Hairline, introduce mock completion data, restart servers, or merge work from the public-map lane without a scoped implementation task.

The intended result is one coherent journey: **enter the workspace → build something real → choose what to share → publish → keep building through connected work.**

## 15. Historical first-increment checkpoint — October 9

The following checkpoint describes the first increment before subsequent user corrections. The current continuation index and detailed plans above are authoritative for remaining work.

- Phase 1 implemented locally: roadmap menu has a progress header, step markers, full-row hover/highlight, current-destination state and wrapping titles. Accelerator overview introduction is compact, dismissible per organization/viewer through the existing preference contract, and recoverable through About Accelerator. Keyboard focus follows dismissal/reopening. Lesson-view exclusion remains.
- Phase 2 foundation implemented: scaffolded `src/features/organization-launch`, deriving a checklist from saved profile data. Optional programs/location do not block the next suggested task. Actions reach the existing editor and public settings; a new `public-page` focus target identifies those settings. Read-only members receive no editor actions. Paid lesson access is unchanged, and the setup card remains visible outside that paywall. Saved public profiles get a compact status/link.
- This foundation does not add a separate publish mutation, a map preview/pin, an exact anonymous-public preview, new server eligibility rules, or a canvas objective node. Those remain later Phase 2 work. The custom tutorial replacement and connected objectives are not implemented yet.
- Preview: `http://localhost:3001/workspace`, rapid-UI worktree. Source ownership of the port confirmed. Unauthenticated request returned HTTP 307 in 1.33 seconds; this is a server response check, not authenticated UI verification. User appearance review requested; no browser automation or visual baseline replacement.
- Fresh `origin/main` comparison found one relevant onboarding change beyond the local base: `0819df5f`, inline onboarding scroll restoration. No checkout merge/pull occurred; preserve that fix when preparing the later onboarding implementation/release.
- Focused validation: 45 distinct checks across launch behavior, UI preferences, banner, existing Accelerator panel/picker and the scoped drawer contract passed. Changed-file lint, workspace storage, feature/scaffold, ownership, workspace surface, import boundary and threshold checks passed. Full TypeScript remains blocked by existing unrelated acceptance-test diagnostics; no diagnostics name changed implementation files.
- The generated acceptance manifest also reconciles two pre-existing classification drifts (accelerator timeline and canvas viewport tests). No unrelated test implementation was changed for these moves.
- Next: incorporate overview/menu appearance feedback, complete actual public projection review/location status, then replace the old canvas tour with real setup actions. Do not mistake the current checklist links for the completed guided onboarding design.

### Visual correction after reference review

The first wide setup-panel treatment did not match the requested visual direction. Replace it with a 420px maximum-width card, a cropped dotted globe, compact checklist rows, green completion checks/pills, a subdued current-step row, and a slim footer. Keep progress derived from saved data and retain optional-step semantics. The checklist now remains visible after publication, superseding the compact published-only state above. The globe is decorative; organization map positioning and publication projection remain separate unfinished work.


### Live map and visibility follow-up

The launch card now uses a minimal 16:9 live preview of the public map instead of the decorative dotted SVG. Its header reports saved Public/Private visibility separately from checklist progress. The preview uses published map features only; it does not geocode private profile data or infer an organization pin. Organization-specific location readiness and the full publishing-review journey remain future work. The Accelerator overview scroll mask was removed to keep the introduction banner crisp.
