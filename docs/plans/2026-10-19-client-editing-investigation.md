# Preserve completed onboarding — October 19, 2026

## Current scope

Prevent completed accounts from being redirected back through onboarding solely because organization name or URL is missing. The user requested a population audit and a durable correction after a client editing report. The exact original browser symptom remains unconfirmed; the account-state redirect is independently reproduced.

Branch `fix/client-editing-investigation-20261019`, isolated worktree `/Users/calebhamernick/Development/coach-house-platform-client-editing-20261019`, base `9567a085`. Original01 stage1–2, limited to this defect. Other worktrees/servers and shared SHIP revision40 remain unchanged.

## Design and behavior

`onboarding_completed === true` remains completed even when organization details are absent. Profile completeness is reported separately by the existing helper. Returning owners can edit missing details through the existing organization editor. No new prompt, guessed name/URL, account metadata rewrite or public publication is introduced.

Fresh accounts, including access-selected but unfinished builders, still require onboarding. Existing signup name/URL validation, plan checks, ownership, memberships, staff exemptions, RLS and mutation authorization remain unchanged. This routing decision is not authorization and grants no paid or cross-organization capabilities.

The alternative of manually repairing every account would unblock individual users but allow recurrence. Automatically inventing names/URLs would change customer data and was rejected. Existing users should retain access while completing profile details.

## Implementation and evidence

- `src/lib/onboarding/requirements.ts`: separate completed-account routing from organization profile completeness.
- `tests/acceptance/onboarding-requirements.test.ts`: protect missing/null/blank profile fields, saved work, strict completion values, fresh accounts and existing exemptions.
- `tests/acceptance/onboarding.test.ts`: execute the real onboarding page with the actual requirements result, proving completed accounts return to `/workspace` without a reciprocal AppShell redirect or billing lookup.
- Node22.13.0 / locked dependencies: eight cases fail before the source fix, then 78 cases pass across onboarding requirements, page, redirect, actions and draft recovery.
- Command: `pnpm exec vitest run --config vitest.config.ts tests/acceptance/onboarding-requirements.test.ts tests/acceptance/onboarding.test.ts tests/acceptance/app-shell-onboarding-redirect.test.ts tests/acceptance/onboarding-actions.test.ts tests/acceptance/onboarding-recovery.test.ts`.
- Scoped ESLint, acceptance manifest and diff hygiene pass. Manifest unchanged. No appearance changes or visual-baseline update; no full local quality run.
- Actual client session and deployed behavior remain unverified. Current passing local evidence does not claim production repair.

## Account audit and privacy

Read-only production audit and private CSV were delivered to the user. Candidate status means the account matches the deterministic redirect condition, not a confirmed user incident. Explicit testers and users whose other memberships make selected workspace ambiguous are identified separately. No customer identity, organization name, document text or raw audit roster is committed to this public repository.

Private receipts/roster/archive live under `~/.local/share/coach-house/account-access/` with the 2026-10-19 prefix. Existing client manual profile edits were verified separately; Codex made no production data changes. The user retains responsibility for chosen organization identities/URLs when doing manual support corrections.

## Delivery and remaining gates

No migration, provider setting, billing change or deployment is needed to implement the code correction. Release still requires current-head hosted quality, required review, merge and deployment. After deployment, a completed owner with missing basics should enter `/workspace`; a fresh signup should still complete setup. Users may need to refresh an old tab after preserving unsaved text.

Graphify refresh completed (21,552 nodes / 61,937 edges). Focused TypeScript check passed with zero diagnostics across 568 loaded files; boundaries check passed. Normal Node22 pre-push passed. [PR338](https://github.com/Hamernick/CoachHouse/pull/338) is open with implementation `e93b55aa`; no merge or deployment. Final documentation receipt is on the same branch. Hosted quality/review/release and real client acceptance remain user-owned. Do not broaden this into unrelated production or onboarding redesign work.
