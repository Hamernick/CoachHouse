# Invitation workspace recovery

Status: locally qualified; release authorized if required hosted checks and code-owner review pass. Production unchanged. This is the authoritative patch checkpoint. No Desktop file was created.

## Outcome and scope

Accepting an organization invitation must open the invited organization automatically. Invitees must not complete owner/workspace creation merely to reach their pending access request. Preserve existing workspaces, content, memberships and authorization. No schema, billing, account migration, new organization-selection UI or global fetch-scoping change.

## Verified incident evidence

Read-only production inspection on November 20 found a staff membership in the inviter’s organization, an accepted organization_access_requests record, and a separate invitee-owned organization. This was the existing-account access-request path, not the token invitation path. Eastern timestamps:

- 11:25:55: access request created.
- 11:40:55: invitee-owned organization created.
- 11:41:33: request accepted and staff membership created.
- 11:58:27: workspace telemetry still recorded the invitee-owned organization.

The data establishes the mismatch, not the exact browser navigation/header sequence. No live cookies, network capture, customer impersonation or account mutations were used. Recheck current state before advising customer-specific recovery.

## Cause and implementation

1. AppShell previously redirected every onboarding-locked dashboard page except onboarding itself to owner setup. This included /access-requests. Add an exact exemption for /access-requests; this page still authenticates and returns only requests for the current user. Other routes retain their setup gates. Existing member onboarding requirements already exempt the joined organization.
2. Acceptance already saves the invited organization cookie. The access-request panel then used router.push, which can pass through the existing tab’s organization-scoped fetch wrapper. That wrapper intentionally pins the old organization, and server resolution prioritizes the explicit header over the cookie. Replace this transition with window.location.assign after successful acceptance, matching the existing organization-switch strategy. A new document reads the saved selection and leaves the old scope behind. Do not weaken scope protection for existing tabs or mutations.

Files:
- src/components/app-shell/onboarding-redirect.ts
- src/features/organization-access/components/organization-access-requests-panel.tsx
- tests/acceptance/app-shell-onboarding-redirect.test.ts
- tests/acceptance/organization-access-requests-panel.test.ts
- tests/acceptance/projects.json

The token-based join action already selects the organization and server-redirects; it is unchanged. Declines and rejected requests do not navigate. The patch does not erase or merge accidentally created workspaces, and does not force existing members away from a deliberately selected organization on every login.

## Local recovery and evidence

- Worktree: /Users/calebhamernick/Development/coach-house-platform-invite-recovery-20261120
- Branch: fix/invitation-workspace-recovery-20261120
- Base: GitHub main 730b6cdb190f8e4344ecc4e9d6fc4bcbb9aa754f, independently checked via GitHub API. Production deployment equivalence remains unverified.
- Root preservation checkout and other lanes untouched. Historical SHIP revision 40 preserved. No agents launched.
- Runtime: Node 22.13.0. node_modules links to the existing root installation; no dependencies or production environment files were changed/copied.
- Both regressions failed before the source changes: onboarding redirected the access-request page; acceptance used client routing instead of document navigation.
- Focused acceptance: 74 tests / 8 files passed (AppShell redirect, request panel/action/page, onboarding requirements, workspace scope, org switching). Separate existing token-join/invite acceptance coverage: 27 tests / 2 files passed.
- Changed-source/tests ESLint and git diff --check passed.
- Browser fixture: actual request panel, redirect helper and scoped-fetch helper at widths 1280 and 390. Fictional HTTP acceptance writes an HttpOnly invited-org cookie; initial load carries the personal-org cookie, acceptance fetch carries old scope, resulting document navigation carries the invited cookie without an old scope header, and reload remains invited. Fixture server/browser closed.
- Browser receipt and reproducible local harness: .tmp/invite-recovery/browser-receipt.json and browser.mjs. This is component/boundary proof with synthetic HTTP responses, not full Next/Supabase end-to-end acceptance or a customer-session reproduction.
- Acceptance manifest and import-boundary checks passed. Manifest generator placed the new component test in integration; only that single manifest entry changed. Structure check passed with existing size warnings.
- Full-project `tsc --noEmit --incremental false --pretty false` exited 2: 124 diagnostics in the reused dependency environment, including missing lenis, hairline, MCP packages and Next experimental-config incompatibility. One new test callback annotation diagnostic was corrected; its 3 tests and lint were rerun and passed. No full-project type pass or clean baseline comparison is claimed. Diagnostic log: .tmp/invite-recovery/types.log. Affected-root type check passed with the repository’s existing ambient declarations: 4 changed TS/TSX roots, 1,029 source/declaration files, 0 diagnostics. Local AST update completed: 23,087 nodes / 77,190 edges / 808 communities. No provider/model calls. Source hashes are recorded in .tmp/invite-recovery/source-hashes.json.

## Release gates and rollout

1. Review the two-source-file patch and exact evidence. Keep this bounded fix separate from document upload recovery and managed-agent work.
2. Confirm deployed application baseline and rebase only if needed; rerun affected checks when the reviewed revision changes.
3. Obtain applicable remote/PR and production approval under this conversation’s separate release gates; required current-head GitHub quality, code-owner review and branch protection must pass before merge. No remote push/PR, merge or deployment has occurred in this lane.
4. After approved deployment, use an authorized test account to accept an invitation while personal setup is incomplete and another with an existing own workspace. Verify intended content and role, refresh, and sign-in again. Verify a separate old tab remains scoped to its original organization until deliberately navigated/reloaded. Do not use a real customer account or send real invitations without authorization.
5. For the affected customer, verify whether refreshing reads the already-saved intended selection; otherwise use the existing authorized organization switch. Do not re-create membership, repurchase access, or delete the extra workspace. Customer-specific resolution is not yet verified.
6. If the change regresses invitation access/navigation, roll back the application revision. No database rollback or membership deletion is required.

## Remaining limits

- No full hosted authentication/onboarding journey or real customer recovery proven.
- This patch does not recover invitation context when a person independently abandons an invite and starts an unrelated homepage signup; existing token preservation is unchanged and covered by its regressions.
- No assertion that every previous invitee experienced this failure, or that all users with separate personal workspaces are erroneous.

## Execution efficiency

Reused existing invitation, membership, cookie and onboarding contracts. Changed two source files; left server authorization and broad routing unchanged. Ran targeted red/green regressions, one combined relevant suite and one full-project type-check attempt plus a corrected affected-root check; did not run the full local quality pipeline or rebuild unrelated features. No measured efficiency improvement claimed.

## Commands to reproduce local checks

Use Node 22.13.0 (PATH=/Users/calebhamernick/.nvm/versions/node/v22.13.0/bin:$PATH) from this worktree.

```sh
pnpm exec vitest run tests/acceptance/app-shell-onboarding-redirect.test.ts tests/acceptance/organization-access-requests-panel.test.ts tests/acceptance/organization-access-request-actions.test.ts tests/acceptance/access-requests-page.test.ts tests/acceptance/onboarding-requirements.test.ts tests/acceptance/organization-workspace-support.test.ts tests/acceptance/org-switching.test.ts tests/acceptance/organization-switch.test.ts tests/acceptance/join-organization.test.ts tests/acceptance/organization-invite-acceptance.test.ts
pnpm exec eslint src/components/app-shell/onboarding-redirect.ts src/features/organization-access/components/organization-access-requests-panel.tsx tests/acceptance/app-shell-onboarding-redirect.test.ts tests/acceptance/organization-access-requests-panel.test.ts
node scripts/sync-acceptance-projects.mjs --check
node scripts/check-import-boundaries.mjs
node scripts/check-structure-conventions.mjs
node .tmp/invite-recovery/browser.mjs
node .tmp/invite-recovery/affected-types.cjs
git diff --check
```

Design: existing shadcn controls/copy/layout retained; the change is navigation behavior only, with a fresh document receiving focus naturally. No new visual baseline required. Browser fixture uses local Playwright JS because Python Playwright is absent.

## November20 deployment authorization and readiness

User: “deploy if ready.” This authorizes the release workflow, conditional on required checks/review; it does not waive branch protection. GitHub confirms main protection requires `quality` and one code-owner approval (`@calebhamernick`). Latest successful coachhouse production deployment record 7509249514 matches base730b6cdb, completed November3; the old plain `production` environment is historical and is not the coachhouse deployment source.

Installed this worktree’s frozen lockfile with pnpm10.28.0 / Node22.13.0, ignore-scripts, using cached packages; replaced only this lane’s node_modules symlink. Parent dependencies were not changed. All101focused tests rerun and pass in the matching installation. Full-project types now PASS after generating standard Next declarations with `next typegen`; no source/dependency manifest changes were needed. Final `tsc --noEmit --incremental false --pretty false` exited0 with no diagnostics. Browser fixture also rerun and passed in the isolated installation. Logs: .tmp/invite-recovery/types-final.log, tests-isolated.log, browser-receipt.json. Next publish the patch and inspect required hosted checks. No customer account/content mutation or manual provider configuration is authorized/needed.
