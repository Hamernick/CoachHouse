# Free organization tier — handoff to onboarding owner

> October 12 ownership correction: user explicitly requested removal now, without waiting for the replacement branch. Removed this lane's new profile route/feature, paid Workspace helper, profile-only editor mode, free navigation/onboarding exception and related test; restored 13 tracked files to HEAD and deleted 13 untracked files. These historical implementation notes are no longer the active source state. Fiscal signup/verified profile import remains here and must be reconciled with the other branch before release. Its final `/organization/profile` destination is currently unresolved after removal.

User direction, October 12: the other chat/branch owns building the free tier and onboarding. This frontpage lane must stop developing a competing implementation and remove its duplicate changes after replacement/dependency reconciliation. This is a source inventory, not a completed entitlement audit.

Source checkout: `/Users/calebhamernick/Development/coach-house-platform-frontpage-20261007`, branch `feat/frontpage-20261007`. Changes below are uncommitted. Do not cherry-pick the whole branch or overwrite the recipient's dirty files.

## Implemented access restrictions

1. `src/lib/workspace/organization-workspace-access.ts`: cached `hasOrganizationWorkspaceAccess(context)` checks the **selected organization's** subscription via `resolvePaidTeamAccessForOrgSubscription`. Requires `hasPaidTeamAccess === true`; error-shaped results deny access. Admin/platform staff pass the feature check, but callers must still retain organization authorization. Membership alone or a personal paid plan must not unlock another free organization. Thrown infrastructure errors are not converted to success.
2. `src/components/app-shell/dashboard-layout-state.ts`: `showMemberWorkspace` uses this helper instead of treating any joined organization as paid. Existing learning entitlements remain separate; this is not a newly completed Accelerator restriction.
3. `src/app/(dashboard)/my-organization/_lib/workspace-actions-support.ts`: `resolveActor` authenticates, checks the selected org's paid access, then returns the normal scoped actor. Consumers include saving board state/node positions, completing/resetting the Workspace tutorial and creating/revoking Workspace collaboration invitations. This does not prove every invitation endpoint is gated.
4. `src/app/(dashboard)/my-organization/_lib/workspace-objectives-actions-helpers.ts` and `src/features/workspace-objectives/server/actions.ts`: both objective entry-point families deny unpaid actors before loading/changing objectives, groups, statuses and related assignments/details. Existing role checks remain downstream.
5. `src/app/(dashboard)/my-organization/_lib/workspace-communications-actions.ts` and `workspace-communications-channel-connections-actions.ts`: communication actor loaders require paid org access before posts/channel-connection operations. Existing editing roles remain enforced.
6. `src/app/(dashboard)/workspace/page.tsx`: locally redirects signed-in non-admin users without Workspace access to `/organization/profile`. **Revisit during onboarding integration:** this condition is broad and may also catch collector/member intents; it is not a signed-off universal redirect.

Denial copy for these action guards: `Workspace requires a paid organization plan.`

## Implemented free navigation

- `src/components/app-sidebar/nav-data.ts`: optional `showFreeOrganization` adds Organization profile and Applications.
- `src/components/app-sidebar.tsx`: enables those items for signed-in non-platform users without Workspace access; allows this navigation during locked onboarding. Review collector/member intent here too.
- `src/components/app-shell/onboarding-redirect.ts`: exempts exactly `/organization/profile` from the onboarding redirect. It does not unlock other routes or complete onboarding.

## Profile screen that exists

- Route: `src/app/(dashboard)/organization/profile/page.tsx` composes `src/features/organization-profile/organization-profile-page.tsx`.
- Loader: `src/features/organization-profile/server/actions.ts` requires authenticated app context, reads the selected org's `ein, profile, public_slug, is_public` through the session client, sanitizes existing HTML and uses `canEditOrganization(activeOrg.role)`. No paid-plan requirement. Query failures produce an error, not an empty editable profile. Opening does not create or publish an org.
- UI: `components/organization-profile-panel.tsx` is a simple max-w-3xl single-column screen. Heading Organization profile; subtitle Create and publish your page. Free, with no paid plan required. Top-right Applications link points to `/documentation/fiscal-sponsorship#application`.
- Reuses `OrgProfileCard` with `profileOnly`. This forces the Company tab and hides tab navigation, Programs, People, Supporters and the program-edit wizard. Existing editing/saving and public visibility controls are reused.
- Existing Company content includes identity/formation/EIN, contact/address, narrative, brand and social/presence fields. This is not a newly designed simplified free dashboard. Any paid capabilities embedded inside Company/editor modals still require audit; hiding sibling tabs is insufficient security.
- No implemented free-specific welcome, upgrade CTA, application-status dashboard, or final first-run journey. These were proposals only.
- Shared changes: `src/components/organization/org-profile-card/org-profile-card.tsx`, `types.ts`; extracted model `src/lib/organization/profile-types.ts`; extracted mapping `src/lib/organization/initial-profile.ts`; old `src/app/(dashboard)/my-organization/_lib/helpers.ts` re-exports mapping. Extracted helpers/types were structural reuse, not access control.
- Feature includes index/lib/component exports, types and README; copy or replace the whole feature boundary consistently.

## Test evidence to preserve/rebuild

`tests/acceptance/organization-profile.test.ts` covers unauthenticated redirect, selected-org profile query, owner vs board editing permission, failed reads, free owner/joined-free-org denial, paid-org member access, error-shaped billing denial, staff feature access, representative direct-action denial before data queries, and narrowly exempted profile onboarding route. Manifest entry is in `tests/acceptance/projects.json`.

Still required: all paid tools/invite/learning endpoints, direct-table RLS and storage checks; actual signup/refresh/resume/upgrade/cancel; collector intent, multiple orgs, paid collaborators and staff regression coverage. Do not label this a complete security boundary.

## Fiscal dependencies — retain in this lane

- `src/features/fiscal-sponsorship/components/fiscal-optional-profile.tsx` navigates to `/organization/profile` after verified explicit selection.
- `src/features/fiscal-sponsorship/server/guest-profile.ts` returns that same destination after scoped open-profile processing.
- The other branch must supply that route or agree a replacement destination before this lane's route is removed from an integrated build.
- Keep guest proof/claim/import authorization, private defaults, intake/project ownership and assignment rules, fiscal document/storage policies, paid general-project protections and fiscal migrations. They are not redundant free-tier UI changes.
- Keep public pricing's approved free profile/application-only copy. Product copy belongs to the public lane; reconcile wording with the implementation owner. Do not revert it to the old free Workspace promises.

## Removal/integration checklist

- [ ] Recipient confirms branch and takes ownership of the inventory above.
- [ ] Implement/reuse the guards and desired profile-first flow there; share exact replacement commit(s) and any changed destination.
- [ ] Preserve the current local implementation as a scoped recoverable patch/commit before removal. This handoff document is not a source backup.
- [ ] Remove this lane's new profile route/feature/helper/test and reverse only the listed guard/navigation/profileOnly hunks after dependency reconciliation. Restore extracted mapping/types only if no retained consumers need them. Remove only the matching manifest entry.
- [ ] Keep fiscal changes and approved pricing copy; resolve fiscal profile-return links against replacement.
- [ ] Integrate the replacement with the public/fiscal work and rerun access/profile/fiscal-return tests. Do not ship a transient build with the removed guards and no replacement.

No application code removed during this handoff. Duplicate implementation is frozen here pending replacement; no production behavior changed. The other chat can use this inventory now without waiting for another design pass.
