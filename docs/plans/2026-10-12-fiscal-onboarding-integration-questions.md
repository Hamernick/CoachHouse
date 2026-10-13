# Prompt for the onboarding implementation owner

We have parallel branches. The frontpage/fiscal-sponsorship branch has removed its duplicate free-tier profile screen, Workspace gating, sidebar and onboarding-redirect changes. Your branch owns free-tier access, organization profile, tutorial, routing and upgrades. Do not rebuild the deleted implementation from the earlier handoff.

The fiscal branch retains guest application submission, email verification, optional email/Google signup, selective profile import and staff review. Application submission must remain account-free; signup afterward is optional and must not require payment or affect review.

Please inspect your actual implementation and return a concise integration handoff. Do not merge, overwrite the other checkout or change production:

1. Exact worktree, branch, base/main revision, relevant commits and uncommitted files.
2. Canonical routes for signup, onboarding, free organization profile, paid Workspace, upgrades and existing-user return. Which routes bypass mandatory onboarding, and under what conditions?
3. Auth component/API contracts: do SignUpForm and LoginForm support `redirectTo` and `onAuthenticated`, does signup support `lockedIntentFocus`, and does Google auth support `onSuccess`/`redirectOnSuccess`? How are return destinations preserved through email confirmation, OAuth, refresh and existing-account login?
4. When/how is an organization created, how is the active organization selected, what identifies it, and which helper/action is authoritative? What prevents duplicate organizations when signup/onboarding and a fiscal profile import both run? How do existing owners and invited members behave?
5. Free/paid entitlement source, server guards and publication behavior. Saving fiscal answers must not complete a tutorial, publish a page or unlock paid access. Existing paid users and invited collaborators must retain authorized access.
6. Recommended integration for this journey: submitted guest application -> explicit email proof -> optional signup/login -> return to selective import -> save only chosen fields -> open your canonical profile screen. State any required onboarding step and how it resumes without losing the application context.
7. Exact files shared with the fiscal branch, tests already passing, remaining gaps and merge order. Identify compatibility wrappers or shared adapters only if actually needed.

Current fiscal contracts to reconcile:

- Optional signup/login returns to `/documentation/fiscal-sponsorship/profile?application=<reference>` via `guestProfileHref`.
- FiscalOptionalProfileAuth uses SignUpForm with `lockedIntentFocus="build"`, `redirectTo`, `onAuthenticated`, `onSignIn`; LoginForm uses `redirectTo`, `onAuthenticated`, `onSignUp`.
- Server revalidates confirmed account email matching the application plus a verified application/browser capability. Reference or email alone never grants access.
- Profile import supports name, description, email and phone, each explicitly selected; new profiles remain private, existing unselected fields survive, already-public profiles are not overwritten. Legal answers, budget, mailing address and staff notes are not imported.
- Pending fiscal SQL currently finds/creates `organizations.user_id = authenticated user ID`, records that ID as the claimed organization and explicitly selects it when opening the profile. Confirm whether your organization model still matches; this must be reconciled before rollout.
- Both `src/features/fiscal-sponsorship/server/guest-profile.ts` and `components/fiscal-optional-profile.tsx` still target `/organization/profile`. That destination was removed from this branch and must be supplied or replaced by your canonical route during integration.
- Fiscal flags remain disabled; no assumption of production activation. Preserve fiscal migrations, private internal projects, reviewer assignments and notification security.

Source checkout: `/Users/calebhamernick/Development/coach-house-platform-frontpage-20261007`.
