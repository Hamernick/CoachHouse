# Free workspace access and queued guide follow-ups

## Confirmed product contract

The latest user direction supersedes the older profile-only Free plan: free users enter the workspace after onboarding. The workspace, organization profile/program editing, People/contact organization, and tool connections remain available.

Documents, Accelerator, and team access remain visible and are introduced with an Upgrade action opening the existing full-screen pricing overlay. Closing pricing returns to the same workspace without reloading.

- Existing Coach House documents remain readable, including saved roadmap content and policy summaries/attachments.
- Creating, editing, uploading, deleting, or restoring native Coach House documents requires the selected organization's active paid subscription. Native strategic-roadmap editing is included in this restriction, explicitly confirmed by the user.
- Free users may connect Google Drive, link their own files, open/edit them in Google, replace Drive links, and unlink those links. Linking or unlinking must preserve any prior native document body.
- Native organization-profile editing stays free; the document gate must not block normal profile saves or empty normalized document fields.
- Regular and temporary team invitations require paid access. Existing access may still be revoked after downgrade. Existing team workspace access continues through the paid membership access guard.
- Accelerator retains its existing entitlement enforcement and legitimate prior purchase access. The Build your nfp card is a read-only preview on Free; its inline setup forms require Accelerator access (latest user direction). Organization profile editing elsewhere remains available.
- A fresh free account has zero complimentary coaching credits. Existing purchased/manual grants are not erased.

## Local implementation and validation

Implemented shared server entitlement checks for native document APIs and roadmap actions, free/read-only document UI, visible upgrade notices, temporary invitation enforcement, and corrected pricing feature copy. Added a database migration restricting hosted storage/library writes and protecting native document bodies in organizations.profile while preserving profile and Drive metadata updates.

Validation: scoped TypeScript and ESLint passed; 81 focused tests passed, including selected-org entitlements, active/trialing/canceled/free states, fail-closed billing errors, direct native-write rejection, verified Drive linking, preserved native bodies, Google Drive routes, team access, and zero free coaching credits. Isolated PostgreSQL tests cover RLS restrictions, existing reads, profile updates, Drive metadata, paid writes, cross-org isolation, canceled/stub subscriptions, and revocation after downgrade.

Migration: `supabase/migrations/20261012163000_gate_free_workspace_document_writes.sql`. Tested against an isolated temporary PostgreSQL instance only. Applying it to the connected database, hosted CI, production deployment, and user visual review are outstanding release gates. No connected database mutation or deployment has occurred. Browser review is deferred under the existing automatic approval restriction.

## Guided workspace tour refinement — implemented locally, visual review pending

Access controls were completed first. The queued tour requests below are now implemented locally; the user should review their appearance and movement:

1. Smooth the transition from `guideStep=welcome` to `guideStep=identity`. Reuse the installed animation tooling where appropriate; avoid sudden card reflow/repositioning and respect reduced motion.
2. Center the welcome card within the workspace canvas/container, not the full browser viewport including the sidebar.
3. Split identity into smaller guided explanations: highlight the organization card's Edit button; explain the Organization drawer tab as another route to the same details; open the drawer during the tour in view mode, without entering editing mode.
4. Keep this tour observational. Prevent off-course drawer navigation/editing during the active guide, with reliable restoration on close. The pasted trigger identifies the drawer tabs; verify the exact composition rather than changing the shared Tabs primitive.
5. On the People step, keep the tutorial card above the drawer/centered in available canvas space so it does not cover the People tab or target being introduced. Preserve usability on small screens.
6. Highlight the target with a correctly sized/radiused border and draw a colorful animated dashed connector from the guide card to the target, inspired by existing ontology rails. Keep the connector noninteractive and provide reduced-motion behavior.
7. Remove the “Try it on the canvas” action. Retain clear Back/Next/Close navigation without opening editing flows.
8. Review welcome → identity substeps → People, closing/restarting the guide, pricing overlay return, and narrow-screen placement. User remains primary appearance tester; use only focused checks needed for regressions.

### Tour implementation evidence

- Reused installed Motion (`motion/react`) with a persistent artwork/card shell, transform-based positioning, size layout animation, and a short copy reveal. Reduced-motion preferences disable movement and the animated dashed rail. Reference: https://motion.dev/docs/react-layout-animations.
- Added `identity-edit` and `identity-drawer` stops. Identity drawer opens at the middle snap in company/view mode, ignoring stale edit requests. Welcome/identity canvas stops discard stale explicit drawer destinations.
- Canvas container is measured separately from the sidebar/browser viewport. People and identity-drawer placement reserves space around the introduced tab; short screens scroll the guide itself rather than covering the target.
- A scoped inert canvas makes the tour observational for pointer, keyboard, and drag interactions. The guide stays outside it in its existing body portal, and cleanup restores prior inert/focus state. Sidebar/pricing remain reachable.
- All intermediate editor/Try-it actions were removed; Back/Next/Close remain. Finishing explicitly returns to the checklist for normal interaction.
- Validation: 60 focused guide/drawer/onboarding tests, scoped TypeScript and ESLint, diff hygiene passed. User visual review remains pending; no browser inspection was attempted under the previous automatic approval restriction. No deployment/server restart.

### Responsive organization and guide framing

- Identity and Edit-button introductions now stack the organization card above the guide and center the combined group within the available canvas, excluding the drawer rail. The Edit-button highlight remains precise while positioning uses the whole organization card.
- Camera zoom reserves guide space before fitting the organization card, caps enlargement, and recalculates when canvas or node dimensions change. Other workspace navigation retains its normal zoom limits. Short landscape screens scroll the guide internally.
- Validation: 54 focused guide geometry/camera tests passed, including narrow phone, tablet, desktop, and short landscape sizes. Scoped ESLint and expanded scoped TypeScript including camera/view integration passed. Appearance and transitions still require user review at `/workspace?guide=1&guideStep=identity`; no direct browser inspection or deployment.

### Accelerator preview during the tour

- Free users now see the shared Accelerator overview, including saved progress, lesson rows, roadmap controls, and organization setup. Paid controls stay inert with an Upgrade notice; the Build your nfp card is now read-only on Free per the later review, with an Upgrade to edit action. Paid lesson requests and completion callbacks are suppressed for Free, and the paid viewer cannot mount in overview-only mode.
- The story stop opens Accelerator halfway, highlights its tab, positions the guide above it, and scrolls the progress/lesson section into view. The setup card remains part of the same normal overview.
- Heading: “Build faster”. Free-user subtitle: “Upgrade to the Accelerator. Go from idea to impact with guided lessons, checklists, and frameworks to help you get on the map and in good standing.”
- Local browser appearance remains pending user review at `/workspace?guide=1&guideStep=story&drawer=accelerator&focus=roadmap-guide`.
- Validation:69 focused tests plus scoped TypeScript, ESLint and diff hygiene passed. Browser review remains pending.

### Natural guide height correction

The stacked guide no longer stretches to its reserved height. It fits its content, and camera framing uses the measured height while retaining a short-screen scroll limit. This supersedes the fixed-height allocation above. 57 focused guide/camera tests, scoped TypeScript and ESLint passed; visual confirmation remains pending.

### Accelerator drawer height revision

Latest user review supersedes the half-height story drawer: it now opens fully, matching the preceding Activity stop. Direct-link and stage-state tests pass; visual confirmation remains pending.

### Tutorial completion destination

The final step now focuses the organization card and keeps the drawer collapsed. Continue building returns to `/workspace` instead of reopening Accelerator. Final focus uses the destination canvas dimensions so the closing drawer animation cannot frame the card into an intermediate height.

### Release and checkout-return audit — 2026-10-12

Not ready to merge/deploy. GitHub has no PR for this lane; main is protected at d159d722. The lane is 14 commits behind main and holds substantial uncommitted work. Integrate into a current-main release lane without overwriting the active preview or dropping main-only migrations. Required hosted quality/branch-protection gates have not run for this patch set.

Pending task migration: `supabase/migrations/20261012163000_gate_free_workspace_document_writes.sql`, previously tested in isolated PostgreSQL only. It adds paid storage/library/collaboration restrictions and native profile-document guards while preserving reads and Drive/profile updates. Remote migration listing failed with “Cannot find project ref”; production application state remains unverified. Do not blindly push all migrations from this old branch.

Checkout happy path: local overlays capture the current workspace URL; Stripe checkout stores selected organization ID, plan and return target; success verifies checkout ownership, upserts subscription for the organization, and returns to the workspace. Fresh page requests resolve access from subscription state; webhooks provide subsequent reconciliation.

Required activation fixes/validation before release:
- `pricing/success/_lib/subscription-persistence.ts` ignores returned Supabase upsert errors and catches thrown errors without propagating failure. Success can be reported without a durable subscription record.
- `pricing/success/page.tsx` can report success with no subscription object; also treats past_due as successful while feature gates require active/trialing. A verified activation/pending state and retry/recovery are needed. Workspace forced Stripe synchronization can help, but is cooldown-limited and does not guarantee activation or refresh all shell consumers in the same request.
- Error redirects from local overlays carry checkout_error but no paywall parameter, while the local overlay resets closed after returning and the global overlay uses paywall to open. Ensure a visible recovery state, preserving the return destination and avoiding a second purchase for an already paid session.
- Verify real Stripe test-mode checkout from a new free organization, return to the same workspace/drawer, paid Documents/Accelerator/team activation, reload persistence, cancellation, delayed webhook/database failures, duplicate processing and downgrade. No real checkout/payment was performed in this audit.

Validation:40 focused checkout, success-return, overlay URL and webhook tests pass. Existing tests explicitly accept success after synchronization failure/missing subscription; passing results do not close those activation gaps. No application code, connected database, Stripe settings, deployment, merge or preview server changes in this audit.
