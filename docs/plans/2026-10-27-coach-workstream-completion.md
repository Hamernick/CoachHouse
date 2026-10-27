# Coach card completion — October27

Status: bounded original01/O039 repair, locally reproduced and fixed; PR review
and release remain separate. This continues the reported staff-access incident,
not the completed Google sign-in recovery implementation in PR361.

## Evidence

The user confirmed the staff email is visible in the account menu and clarified
that the action is moving a project card to **Complete**. The same server guard
used for category management also guards this move, explaining the misleading
“Only platform admins can manage workstream categories” error.

Read-only live inspection confirmed the account's existing coach grant is intact
and unchanged since July21. Its current profile-details query succeeds. No role,
account, database, Google or hosting settings were changed.

A reproducible application defect explains how this denial can occur: the app
loads profile details and the authoritative staff grant independently, but a
profile lookup error discarded the successfully verified staff grant. Simulating
a profile timeout with a valid coach grant reproduced the exact reported message
through the real card-move action. This is evidence of a matching failure path,
not proof of the exact database response during the customer's failed request.

## Change and authorization boundary

- Preserve the independently verified staff access when profile details fail.
  Profile display fields still fall back to empty values.
- Keep both audience resolvers consistent. Staff lookup failures still reject;
  absent grants and untrusted profile data never grant staff access.
- Make a denied card move describe moving projects on the board. Category denial
  wording no longer incorrectly says only platform administrators are eligible.
- Existing staff capabilities, owner-scoped categories, project checks, upsert and
  route revalidation remain intact. No migrations or privilege promotions.
- This changes the personal workstream stage; it does not redefine project or
  organization completion elsewhere in the product.

## Validation

Before the source patch, the new coach card-move regression produced the exact
reported permission error; coach/developer audience regressions also failed.
The fourth expected failure was the corrected denial message for a non-staff user.

After the patch, 48 tests pass across:

- `devtools-audience.test.ts`
- `member-workspace-admin-workstreams.test.ts`
- `platform-access.test.ts`
- `server-user-consumers.test.ts`
- `organization-document-access.test.ts`
- `organization-programs-staff.test.ts`

Coverage includes the Complete move and subsequent configuration readback,
owner-scoped persistence, blocked foreign categories, absent staff grants and
failed authoritative permission reads. Tests use simulated database responses;
they do not impersonate or modify the reported customer's live account.

Affected ESLint, full TypeScript, import boundaries and structure checks pass.
The fresh checkout needed `next typegen` before TypeScript could resolve Next's
image declarations; the regenerated-environment check passes. Check/maintenance
receipts are stored under `.tmp/coach-completion/` in the isolated checkout.
There are no layout or visual-baseline changes and no new browser server for
this server-side repair. Staged secret scanning reports zero findings.

## Handoff and recovery

- Branch: `fix/coach-workstream-completion-20261027`, base `8bc2e52e6`.
- Worktree/resume: `cd /private/tmp/coach-house-coach-completion-20261027`.
- Node22.13.0; dependencies installed locally from the frozen offline lockfile.
- PR body records current commit/remote receipt and final checks. Caleb owns
  current-revision hosted quality/review, merge, deployment and live acceptance.
- After deployment, have the affected coach move the same card to Complete and
  reload the board. If it still fails, capture the attempt time and inspect that
  request's authorization result; do not promote the account or guess provider changes.
- O039 remains In progress globally. Root dirty checkout, PR361 worktree, other
  workstreams/listeners and shared SHIP40 remain preserved.
