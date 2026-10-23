# Team invitation signup and acceptance patch

## Scope and recovery

User-requested production support investigation and narrow invite/onboarding repair (original03 guided onboarding/B078). Worktree `/Users/calebhamernick/Development/coach-house-platform-patch-investigation-20261020`, branch `fix/patch-investigation-20261020`, base `1df67d89` from current main. Preserve the dirty root, other worktrees/servers and canonical SHIP revision40 owner/host hold. This is an independent PR preparation; no shared claim mutation or release is inferred.

## Confirmed diagnosis

Read-only production Auth/invitation/membership/organization inspection confirms the reported invitee created and verified an account after the external team invitation. The invitation is pending and unexpired; the invitee has neither an organization membership nor a new organization. Signup metadata records builder intent. Private identities, timestamps and evidence are retained outside Git at `~/.local/share/coach-house/account-access/2026-10-20-team-invite-audit.json`.

Reproduced cause: `/join-organization` sent anonymous visitors to login. Login retained the invitation when switching to the homepage signup panel, but that panel ignored the destination and supplied ordinary onboarding/checkout destinations. The authenticated proxy also replaced invite destinations on `/login` and `/sign-up` with `/workspace`. Acceptance mutated membership and wrote an active-organization cookie during server-page rendering, rather than in a server action.

Production auth configuration readback confirms email verification is required, the confirmation template uses `/auth/confirm`, `TokenHash` and `RedirectTo`, and the production callback is allowlisted. No provider/template change is required.

## Resulting behavior

- Anonymous invite links open the existing signup form, with an existing-account sign-in link. Both retain the invitation through email/password, Google auth and email confirmation.
- Both standalone and homepage invited signup use support intent and the invitation destination, even if a builder pricing parameter is also present. Ordinary signup/pricing remain unchanged.
- Signed-in invitees submit Join organization. Only then does the server validate and persist membership, select the invited workspace cookie and redirect to that workspace. Rendering or prefetching the page does not mutate membership/cookies.
- The current verified Auth email must match the invitation. Wrong accounts can switch locally without losing the invitation. Expired/missing/invalid-role invites fail; reused links require the invitee's current membership and retain its current role. Removed memberships are not restored by replaying a consumed invite.
- Existing organization-membership onboarding exemptions apply; no new organization, personal subscription or global onboarding-completed flag is created by this patch.

Existing shadcn AuthCard/AuthScreenShell/Button patterns and `docs/design.md` typography/spacing are reused. No existing visual reference targets the join/signup routes; user appearance review remains separate.

## Validation

Two new signup cases failed before implementation. Final focused run with dependencies matching the current lockfile: **187 tests across 11 files pass** (signup pages/forms, homepage panel, login/proxy, confirmation, join actions, acceptance/denials, onboarding requirements and Google/existing access-request contracts).

Scoped ESLint, routes, boundaries, structure, acceptance manifest and diff hygiene pass. Targeted TypeScript included 2,807 source/dependency files: 83 diagnostics in six unchanged public-map rendering files; the same check using original base sources produces the same 83 diagnostics, with zero introduced diagnostics. This is not a clean whole-program typecheck/build claim. Initial dependency lookup used an older root installation missing hairline; corrected the task-local symlink to the document-preview installation, whose lockfile matches this checkout, then reran focused tests. No shared dependencies were changed.

Focused Chromium check uses local-only auth settings and intercepts signup requests. It confirms direct invite -> signup, invited-email guidance, retained sign-in return URL, support metadata, legal consent and exact invitation callback. No real account, email, membership or customer content was created. Screenshots and harness are in `/tmp/coach-house-invite-*`; these are private local evidence, not CI visual baselines.

The exact reported mobile path also passes in Chromium: login -> homepage signup -> intercepted verification callback retains the invitation and support intent. Existing signup layouts remain usable at390px. Graphify AST refresh completed:21,570nodes/62,009edges/1,191communities. Feature/raw-button/threshold checks also pass. Secret scan and normal pre-push completion are recorded at handoff below. Full local quality was not requested or run.

## Release and customer recovery

No production mutation, migration, resend, provider configuration or release occurred. Default delivery is an open PR; Caleb owns hosted quality/review, merge, deployment and real acceptance. Existing unrelated type diagnostics remain a recorded limitation, not an authorized adjacent fix.

After deployment, the affected invitee can sign in with the account already created, reopen the original still-valid invitation and choose Join organization. If the password is forgotten, use the existing password-reset flow; no second signup or workspace setup is needed. After expiry, the organization should issue a fresh invitation. Do not manually create an organization or mark onboarding complete to repair this incident.

## PR handoff

[PR340](https://github.com/Hamernick/CoachHouse/pull/340) is open/non-draft, implementation `4cc4e4af`. Staged secret scan and normal Node22 pre-push pass (8.34s). Final documentation is on the same branch/PR; no runtime changes after the187-test/browser/type-comparison evidence. Git remote SHA/clean-state readback follows the final documentation push. Local preview is `http://localhost:3132/join-organization?token=local-invite-review` (fake local auth settings, not a real invite). Do not use it for production authentication. Supabase production was queried read-only only. Caleb owns hosted checks/review/release and customer acceptance.
