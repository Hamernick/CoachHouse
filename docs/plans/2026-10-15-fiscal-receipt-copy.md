# Fiscal receipt copy and cross-device return

Original workstream03 stages3/6. Continues PR326 on
`feat/fiscal-receipt-copy-20261015`, based on its recorded docs-closeout headc0b4120f.
Parent PR326 is still open; open this follow-up against its branch, not as a
duplicate main diff. Actual localhost3127 and other lanes stay preserved.

## User report and verified state

Caleb confirmed the application email on a phone while applying in laptop
incognito. The laptop then received application403 and optional profile401, plus
a Google Identity origin rejection. Read-only production metadata confirms one
application submitted at19:57:28UTC and email verified at19:58:07UTC, with one
verified browser and no verified grant for the original submission session.
The application is submitted; the403 reflects browser-bound access, not data loss.
Profile401 intentionally opens optional sign-in. No real answers or email/token
material were read, no provider changes or live messages were made.

Caleb requested an emailed copy instead of mandatory viewing/confirmation steps.
Receipt emails will contain the submitted answers directly, with optional secure
links only for later status/corrections/profile setup. Submission needs no account
or email confirmation. Preserve selected-only private profile import and existing
matching confirmed-account checks.

## Implementation

Migration20261015210000 captures an immutable, allowlisted answer snapshot when a
new applicant receipt is queued. It includes fundraising values but excludes
review notes, actor IDs, metadata/snapshots and internal project data. Old jobs
retain old content and provider keys. Legacy workers cannot claim new-copy jobs;
a new service-only v3 claim returns frozen snapshots. New code falls back to the
legacy worker only for a missing-function/schema-cache error, never an uncertain
claim. Recipient mismatch or unknown/private answer fields fail closed. New
receipts use a distinct v3 idempotency key; HTML escapes applicant content and
preserves line breaks. Existing delivered receipts are not automatically resent.

Phone confirmation also grants the original secret submission browser access,
bounded by the original seven-day window. Backfill only recent email-verified
submissions with an existing active verified session. Never replace or renew
existing expired/revoked grants. Unrelated browser replay stays denied; confirmed
matching account identity is still required for profile linking. Copy/Check again
text explains optional access and cross-device return without redesigning UI.

## Validation

51 focused cases across guest mail, email proof, follow-up and profile pass.
The14mail cases were rerun after final HTML changes. Fiscal SQL/RLS matrix and
one connected real-handler/storage journey pass with phone confirmation,
original-browser return, unrelated-browser403/replay400, unauthenticated401,
wrong-email/unconfirmed-account403, correct selected-only linking and recovery.
New SQL checks cover existing-browser backfill, frozen original answers despite
later edits, no internal fields, snapshot immutability, legacy-worker fencing,
service-only access and revoked grants. Lint/features/boundaries/thresholds/diff
pass. No full quality/build/TypeScript or hosted polling. Actual UI/email review
remains Caleb-owned; no visual fixtures or broad browser journey were used.

## Release order and rollback

1. Merge parent PR326 and review this follow-up through required hosted gates.
2. After explicit production authorization, apply only20261015210000 atomically
   with its migration ledger entry. Save before function definitions, ACL/config,
   relevant original-session grants and catalog state privately.
3. Deploy this code. Between migration and deployment, legacy emails continue;
   new-copy receipt jobs wait safely for a v3-capable worker. No new env variables.
4. Caleb selects Check again/Retry in the original laptop browser; no new email
   confirmation is needed for a recent submitted session repaired by backfill.
5. User-led next real receipt checks full answer copy and optional access. No
   synthetic production submission, automatic resend or inbox messaging by Codex.

Prefer forward recovery. If code rolls back, retain the worker fence and frozen
new-copy jobs; never resend them with legacy content under a different provider
key. Do not drop receipt snapshots or broadly delete verified sessions. Reverting
the access policy requires reviewed saved definitions and exact grant changes.
No production migration or release is performed by this PR implementation.

## Google sign-in origin handling

The fiscal optional-profile page used no-referrer, which can prevent Google
Identity from receiving its required origin signal. Change only that page to
strict-origin: the public origin is sent, never the private application path or
query. Shared GoogleAuthPanel and provider settings remain unchanged. A focused
real-localhost browser probe intercepted the Google script request and confirmed
HTTP200, strict-origin metadata and only http://localhost:3127/ as its referrer.
This verifies privacy behavior, not actual Google authentication. If the reported
origin rejection persists, check the matching Web OAuth client:

1. In Vercel Production, identify the configured NEXT_PUBLIC_GOOGLE_CLIENT_ID.
2. Google Cloud Console → Google Auth Platform → Clients. Open that matching Web
   application client, preserving all existing settings.
3. Add https://coachhouse.app to Authorized JavaScript origins and save. Add other
   origins only if actually used; this field has scheme/host/port, no path.
4. Retest the optional Google signup from the exact production origin. A wrong
   deployed client ID instead requires correcting that variable and rebuilding.

[Official Google setup](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid).
Actual Google sign-in remains unverified; provider origin configuration may still
need correction. Receipt copies and account-free submission do not depend on it. Keep Calendar/formation queue
and shared SHIP40 hold unchanged.

PR327: https://github.com/Hamernick/CoachHouse/pull/327, stacked on PR326.


## Production migration and build follow-up

Caleb authorized migration20261015210000. It was applied atomically in production and independently verified: exact ledger/content hash, immutable receipt column/constraint/trigger, service-only v3 claim, unchanged existing function permissions/table RLS, and one original-browser grant repaired. Private before/apply/verified/recovery receipts remain in ~/.local/share/coach-house/fiscal-completion/2026-10-15/receipt-copy-*. No resend or synthetic application. Do not reapply it.

Vercel main db768a1b compiled successfully but failed TypeScript because PublicFunctions omitted claim_fiscal_guest_emails_v3. New fix/fiscal-mail-rpc-type-20261015 reuses the actual fiscal checkout/3127 from that main revision. Add only the zero-argument JSON-returning RPC declaration beside its legacy equivalent; no cast, runtime fallback, migration or UI change. Verify the complete TypeScript program and existing guest-mail tests before PR handoff. The presenter-audio tracing warning is nonfatal and remains separate. Caleb owns hosted review/merge/deployment and actual UI/mail testing.

Validation: exact installed Next.js production type checker passes (3,922 input/10,410 total files, zero warnings), plus14guest-mail cases, focused ESLint and diff hygiene. Raw tsc exposes unrelated test-fixture diagnostics that Next.js excludes; no full tsc success or complete production-build success claimed. Graphify refreshed.
