# Workspace for nonprofits — public /build page

Status: implemented locally on 2026-10-12; user appearance review and release checks remain.
Lane: feat/frontpage-20261007, localhost:3000. Part of the existing homepage/product journey, not a separate release.

## Purpose and scope

Make /build the public explanation of Workspace for nonprofits: understand the product, see its core features and support, compare plans, then sign up. Match the current homepage's visual language and concise writing. Keep /workspace as the authenticated product.

Current inspection: /build still renders the older BuildPublicLanding with a mock Workspace preview, capability cards, and destination cards. It was not emptied in this checkout. Replace that composition; do not add another landing page or wrap it in the retired home-canvas shell.

Recommended approach: one public story with anchored sections and pricing near the bottom. A /workspace redirect would hide the product behind authentication; separate marketing pages for each menu item would fragment this journey. Keep existing product/documentation routes working as destinations from the relevant sections.

## Navigation and visitor journey

1. The homepage's Explore Workspace action opens /build#workspace. The page remains fully readable without an account.
2. The four public Build menu items become section links:

| Menu label | Public destination |
| --- | --- |
| Workspace | /build#workspace |
| Accelerator | /build#accelerator |
| Documentation | /build#documentation |
| Pricing | /build#pricing |

Order these like the page: Workspace, Accelerator, Documentation, Pricing. Preserve existing Hairline icons and hover-only animation. Change icon lookup from href keys to a stable item identifier before changing destinations so the figures do not disappear.

3. On /build, the same links scroll to their section and close the menu. Elsewhere they navigate directly to the section. Preserve URL hashes, browser back behavior and reduced-motion preferences. Section headings must remain below the sticky header and be reachable by keyboard.
4. Product-entry actions remain explicit: Sign in goes to the existing login/product flow; signup preserves intent=build and the selected plan. Public marketing links must not unexpectedly open the authenticated dashboard.
5. Section actions still reach the actual tools: Documentation opens /documentation; fiscal sponsorship opens /documentation/fiscal-sponsorship#application; Accelerator has its existing enrollment/access destination. This change concerns the public Build menu, not every internal navigation link. Collect and /resources keep their current roles.

## Page order and proposed copy

### 1. Hero / #workspace

H1: **Workspace for nonprofits.**

Subtitle: **Bring your team, board, documents, and plans together.**

Primary action: **See plans** → #pricing.
Secondary action: **Sign in** → existing login route.

A wide 16:9 product-media placeholder follows. Use a real, reviewed Workspace capture when available; no fabricated dashboard, invented data, or live authenticated app embedded in this marketing page.

### 2. Core features / #features

Heading: **One place to build your organization.**

Introduction: **Keep the work connected, from your first plan to your next board meeting.**

Use three homepage-style media-and-copy rows. Each description has at most two short sentences, and separate paragraphs when the thoughts change. Avoid a wall of feature cards.

| Group and headline | Draft copy | Features to substantiate before implementation |
| --- | --- | --- |
| Planning — **Make the next step clear.** | Organize projects, tasks, and milestones around the work you need to do. Give each next step an owner. | Projects, task ownership, milestones, program planning; confirm actual supported workflow and plan access. |
| People — **Bring your board into the work.** | Invite staff and board members into a shared Workspace. Keep responsibilities and updates close to the work. | Invitations, member roles, board participation, shared updates; do not imply everyone has identical permissions. |
| Tools — **Keep your tools close.** | Keep documents and calendar events alongside your plans. Connect the tools your team already uses. | Document storage/Drive and Calendar integration; verify supported actions, connection requirements and release status before claiming sync. |

A compact organization-profile note can sit with these rows: **Give your organization a home.** “Share your mission, vision, values, and ways to get involved.” Explain that public visibility is optional. Profile creation is available free; it does not unlock Workspace.

Keep the exhaustive feature inventory in this plan/content model, not as an oversized grid on the page. Do not market unfinished communications, financial tools, AI decision trees, or automatic decision-making as available. Omit future AI from the first version; a later explicitly labeled Coming soon section can be added after its scope is approved.

### 3. Accelerator / #accelerator

Heading: **Build a strong foundation.**

Copy: **Work through guided training and setup for your nonprofit. Define your mission, plan your programs, and cover the essentials of running an organization.**

Action: **Explore Accelerator access** → #pricing, with the applicable plan clearly identified. A separate signed-in Continue learning action may retain the existing Accelerator route if supported.

Use one media-and-copy row with a real lesson/setup capture later, otherwise an aspect-ratio placeholder.

### 4. Coaching and operations

Heading: **Get support as you build.**

Copy: **Work with an Executive Coach on your organization's questions and next steps. Explore operations support when you need more hands on the work.**

Action: **Compare support options** → #pricing. Explain actual coaching inclusion only after verifying plan terms.

A short fiscal sponsorship block: **Fund your first project.** “Explore fiscal sponsorship for your charitable project. Review the requirements and apply without an account.” Action: **Explore fiscal sponsorship** → public application page. Applying is not a paid-plan benefit or a guarantee of funding/approval. Paid operations assistance is a separate offering.

### 5. Documentation / #documentation

Heading: **A practical place to start.**

Copy: **Read free guidance on writing your mission, planning a budget, and understanding your board's responsibilities. No account needed.**

Action: **Read the documentation** → /documentation.

Use a compact row, optionally with three real document links after verifying their routes. Preserve public access and fast navigation.

### 6. Pricing / #pricing

Heading: **Choose how you build.**

Subtitle: **Start free, upgrade to build your organization in one place.**

Reuse the existing pricing section and shared data, constrained to max-w-6xl. Three cards on sufficiently wide screens, one column on mobile. Show the price, billing interval, a short description, a concise inclusion list and one clear CTA per plan. Keep the detailed comparison on /pricing with a View full comparison link; do not duplicate a second pricing configuration.

Mandatory correction before reuse: pricing-surface-data.ts still lists roadmap, formation and document storage on the free tier. That conflicts with the approved free profile/application scope and the paid Workspace access guard.

- Free: organization profile and fiscal sponsorship applications; no Workspace, invitations, tools or Accelerator. CTA: Create free profile.
- Organization: paid Workspace and only verified included team/training capabilities. CTA: Choose Organization.
- Operations Support: verified operations/coaching benefits; mention fiscal sponsorship support without implying purchase controls application eligibility. CTA: Choose Operations Support.

Current local display prices are Free / $20 monthly / $58 monthly. These are inspected copy, not verified billing configuration. Reconcile amounts, billing intervals, seat limits and coaching/Accelerator entitlements with the actual checkout/plan definitions before shipping; do not invent or change commercial terms in this task.

Finish with the same small Privacy Policy / Terms / About footer as the homepage. No second oversized CTA section after pricing.

## Visual and interaction contract

- Use the current homepage as the design reference, not the older /build layout: sticky translucent blurred header; plain page body; no main canvas frame, sidebar or heavy card grid.
- Hero typography: regular weight, text-4xl → text-5xl → text-6xl. Subtitle mt-2, text-base → text-lg → text-xl. Keep heading/subtitle close.
- Reuse homepage content width/gutters and feature-row proportions; text max-w-md, centered introductory copy max-w-2xl. Pricing stays narrower at max-w-6xl.
- Media: 16:9 by default, existing rounded-3xl/sm:rounded-[40px] convention. Blank placeholders until real assets are supplied/reviewed.
- Mobile: one column, content-first reading order, no horizontal scrolling. Desktop feature rows pair media and copy using the current homepage pattern.
- All secondary CTAs retain the pill hover background, arrow-up-right, min 44px hit target and balanced text padding just reviewed. No underline hover or drop shadows.
- Use the existing smooth-scroll behavior once; do not add a second scrolling library. Honor reduced motion. Avoid animated reveals that hide content or delay anchor navigation.
- Render copy and pricing on the server. No map, auth fetch, application editor, dashboard or heavy preview JS on initial load. Reserve media dimensions and lazy-load later interactive media.

## Implementation checkpoints

- [x] Inspect current /build, public menu, homepage styling and free-profile boundary; identify stale pricing promises.
- [ ] Audit the six core feature groups and paid plan inclusions against implementation; mark unavailable items out of public copy.
- [x] Replace BuildPublicLanding with the hero, feature rows and placeholders; reuse small homepage presentation primitives where useful. Keep route composition-only and retain canonical /build metadata.
- [x] Add Accelerator, support/fiscal and Documentation sections with the copy above.
- [x] Correct shared pricing claims and embed the existing pricing cards at #pricing, preserving standalone /pricing and checkout destinations.
- [x] Change public Build-menu links and stable icon mapping; update homepage Explore Workspace. Review other public Build promotions deliberately without rewriting authenticated navigation.
- [ ] Review hero/core rows on localhost before filling the lower sections; then review pricing and navigation as the second checkpoint.
- [ ] Verify anchors from home and /build, menu close/focus, direct hash loads, history, signup intent/plan, mobile width, light/dark and reduced motion. Run focused navigation/pricing contracts and affected lint; update owned visual baselines after appearance review.
- [x] Record final status in the parent product journey. No release until the full agreed workstream is complete and existing release gates pass.

Owners: src/features/build-collect-navigation/components/build-public-landing.tsx; lib/index.ts; components/build-collect-public-header.tsx; components/public-home-story.tsx; src/components/public/pricing-surface-data.ts and pricing-surface-sections; src/app/(public)/build/page.tsx; tests/acceptance/build-collect-navigation.test.ts and pricing contracts.


## Implementation checkpoint — 2026-10-12

- Replaced the old /build composition with the agreed homepage-style hero, four core feature rows, Accelerator, coaching, fiscal sponsorship, Documentation and shared pricing/footer. Extracted media/button primitives without changing homepage styling. All media remains blank aspect-ratio placeholders.
- Public Build menu and home Explore Workspace now target /build anchors. Stable item IDs retain the five existing illustrations. Authenticated product routes and Collect are unchanged.
- Corrected shared free pricing cards/comparison to profile/application-only scope, optional public listing, and no paid Workspace/tools/training. Preserved existing $20/$58 display prices and signup plan parameters. Shortened the Organization card to core capabilities; removed unsupported numeric seat promise from public comparison. Existing detailed paid comparison statements and live Stripe prices still require release review.
- Core copy covers implemented project/task, invitation, document/calendar, profile and paid Accelerator surfaces. It makes no Drive import, calendar-sync, AI, or guaranteed fiscal funding claim. Subscription access checks and guest-first fiscal application eligibility remain unchanged.
- Fixed browser-observed competing focus/hash scroll: one small client helper uses preventScroll focus plus a single scroll; mobile anchors clear the taller two-row header by 128px and desktop by 96px. Normal modifier clicks remain native; menu closes on selection. CSS smooth scrolling was removed after it caused overshoot.
- 24 focused acceptance tests pass, including all rendered menu anchors, signup plan preservation, free-tier boundaries and onboarding pricing. Scoped ESLint, route and feature checks pass. Chrome review covers desktop hero/sections/pricing, mobile 390px width with no overflow, dark pricing, and direct hash loads. User appearance approval is pending.
- Attempted scoped visual baseline update; repository guard requires Ubuntu 24.04 x64 / Playwright 1.58.2 and rejects this macOS environment. Updated affected visual-test expectations; no baselines or thresholds were changed. No deployment, remote billing changes or application activation.
