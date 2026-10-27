# Google sign-in recovery — October26

Status: locally validated implementation, ready for PR review. The PR body records
the remote handoff. This is a bounded
original01 access/dead-end repair, not the full production-stability packet.

## Recovery and ownership

- Branch: `fix/sign-in-recovery-20261026`, isolated worktree
  `/private/tmp/coach-house-sign-in-recovery-20261026`, base `478d35481`.
- Resume: `cd /private/tmp/coach-house-sign-in-recovery-20261026`.
- Node22.13.0, pnpm10.28.0. Local preview: `http://localhost:3146/login`.
  Preview uses a fictional Google client; the automated tests simulate the SDK.
- Root dirty preservation checkout, other worktrees/listeners and shared SHIP40
  were preserved. No provider settings, roles, database or deployments changed.
- Caleb owns appearance review, hosted quality/review, merge, deployment and live
  acceptance. Opening a PR does not satisfy those gates.

## Incident evidence and limits

The supplied Google screenshot reports `origin_mismatch`; Google requires the
request origin to match the selected OAuth client's authorized JavaScript origins.
The exact failed origin/client request was unavailable. During the earlier live
investigation, canonical production sign-in succeeded and the reported staff
account's saved access was intact. Neither result establishes why the original
attempt failed or proves the reported user journey permanently repaired.

Canonical `https://coachhouse.app` was already on the inspected client's allowlist;
the `www` login redirected to it. Do not add guessed preview origins or change
account permissions to address this error. The local Vercel credentials received
HTTP 403 reading project configuration, so production Skew Protection remains
unverified. No speculative deployment configuration was added.

## Implemented behavior

- Existing Google panel exposes “Trouble signing in?”, an explicit restart and
  “Copy sign-in details.” Email/password remains available.
- Failed or hanging SDK loads can retry after a 15-second timeout without reloading
  the page. Retry invalidates the previous nonce/callback; one credential exchange
  runs at a time. An exchange failure re-arms a fresh button/nonce.
- Copy includes only origin, public client ID, release (when exposed), mode,
  observed stage, last observed failure, timestamp and per-mount support reference.
  It excludes full URLs, tokens, nonces, passwords, email and draft contents.
  Clipboard denial reveals a selectable read-only copy. Browser console receives
  the same allowlisted stages; no central telemetry endpoint was introduced.
- A provider popup can show an error without invoking our callback. Help remains
  accessible; `button_clicked` does not pretend to diagnose Google's error.
- Standalone login on another origin offers the fixed production login link with
  a validated return path. Embedded authentication gets no navigation-away link.
- Existing roadmap/document draft storage and conflict handling remain the source
  of truth. Restart neither clears storage nor reloads editing screens. No new
  autosave layer or blanket refresh was needed for this slice.

## Verification

- 26 focused Vitest cases pass: Google capabilities, recovery/sanitization,
  redirects, existing-session login and document draft storage/isolation.
- 3 Chromium browser journeys pass using simulated Google/Supabase: SDK failure
  and retry retaining form/local/session data; stale/duplicate callbacks rejected,
  matching nonce and retry after expired exchange; successful return navigation
  and clipboard success/denial with secret-free diagnostics.
- Full TypeScript, affected ESLint, feature/structure/import-boundary/raw-button
  and acceptance-manifest checks pass. Structure reports
  pre-existing approaching-budget warnings in unrelated files.
- Browser command:
  `pnpm exec playwright test --config=src/features/google-auth/tests/playwright.config.ts`.
  This is behavioral verification, not a visual-baseline comparison.
- UI review captures: `.tmp/google-auth-browser/mobile-recovery.png` and
  `.tmp/google-auth-browser/desktop-recovery.png`. The Google button is simulated.
  No affected login screenshot baseline exists; no references were replaced.
- First browser attempt used 127.0.0.1, which Next dev blocked for HMR; the fixture
  now uses localhost. Ambiguous alert selectors were scoped to the app message.
  These fixture corrections do not change production configuration.

## Remaining release checks

1. Review the recovery UI and current PR quality checks; merge/deploy normally.
2. Verify the deployed public client/release and Vercel Skew Protection with
   project-authorized credentials. Exercise a stale tab across deployment while
   retaining existing draft recovery; this was not simulated by the local tests.
3. If the original error recurs, collect the copied support details plus Google's
   error-details origin/client, compare exact origin to the matching allowlist,
   then make only the evidenced provider correction. App diagnostics cannot read
   another origin's popup or repair its allowlist.
4. Complete affected users' live acceptance. Original O013-01 and O039-01 remain
   In progress; these focused tests do not close the broader persistence/audit IDs.

Provider references: [Google setup](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid),
[button callbacks](https://developers.google.com/identity/gsi/web/reference/js-reference),
[Vercel Skew Protection](https://vercel.com/docs/skew-protection),
[public release metadata](https://vercel.com/docs/environment-variables/framework-environment-variables).
