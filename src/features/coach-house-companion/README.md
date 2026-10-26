# Coach House Companion sandbox

A private, persistent demonstration of one accelerator lesson. This is not a
production Coach House connection. No database, profile, email, Google Drive, or
Google Calendar writes occur.

## Service contract

- `server/actions.ts`: `executeCompanionTool(principal, name, args)` returns the
  authoritative snapshot and a concise action receipt.
- `createCompanionSession()` returns `{ principal, snapshot }`; credentials last
  24 hours. `revokeCompanionSession(principal)` disconnects a session durably.
- Authentication is the caller's responsibility. The service additionally checks
  the stored session, expiry, revocation, credential equality, and explicit org
  on every call. Session IDs must never enter model-readable content or logs.
- Mutations require a unique `requestId`. Reusing an ID with different arguments
  returns `idempotency_conflict`; retrying an identical request returns current
  state without repeating the change. Sessions permit 256 distinct mutations.
- Draft and submission changes compare the draft `expectedRevision`; document
  saves compare the document revision. Document save, submit, and calendar export
  require `confirmed: true`. Draft saves merge supplied answer fields.
- Draft, saved document, and last submission are independent. Editing after
  submission does not change the last submitted answers or completion result.
- `CompanionError` exposes `code`, `status`, and a safe user-facing `message`.

## Curriculum provenance

The Mission fixture captures all 11 answer-field names, labels and descriptions
from the published Coach House module and class, verified read-only on
`2026-10-26T05:20:40.479Z`. `lib/lesson-data.json` contains only the required
public curriculum fields. The source snapshot SHA256 is
`67545ed47aa45ccd7e5591d5a16a9e4b2bc31eab804193f9d713d4bf46f92571`.
Introductory subtitle fields do not affect completion. The captured
`all_answered` rule and `complete_on_submit: true` are used without modification.
Answers, organization, progress, and documents are sandbox data; this snapshot
is not a live curriculum feed. Completion calls the existing pure
`shouldTreatAssignmentSubmissionAsComplete` function. It never calls the live
submission endpoint, which would also affect organization profiles.

## Persistence and recovery

Set `COMPANION_SANDBOX_DIR` to a private persistent local directory. Default:
`~/.local/share/coach-house/companion-sandbox`. Files use opaque identifiers and
0600 mode; newly created directories use 0700. Atomic rename, file/directory
fsync, and an exclusive per-session mkdir lock serialize separate processes.
No expiry-based lock stealing occurs. A crashed process may leave a `.lock`
directory: stop every writer using that data directory, confirm no writer
remains, then remove only the affected lock. A busy lock fails closed after
1.5 seconds. Never delete an active lock. This is a single-host sandbox store,
not an ephemeral/serverless or distributed deployment store.

Reset by creating a fresh session. Tests should set a unique temporary
`COMPANION_SANDBOX_DIR`; do not reuse a user's directory. Expired files remain
private until explicitly cleaned up; they cannot be read through the service.

## Calendar behavior

`companion_schedule_block` prepares a downloadable RFC 5545 calendar file.
It does not create a provider event, send invites, inspect availability, or
modify the organization's Board calendar. Dates require explicit offsets,
valid IANA timezone, and positive duration up to 24 hours. Export uses UTC
instants, stable UID on idempotent retry, escaped text, and 75-octet folding.

## Ownership
- Domain logic: `src/features/coach-house-companion/lib/**`
- Server actions/queries: `src/features/coach-house-companion/server/**`
- UI components: `src/features/coach-house-companion/components/**`
- Hooks/controllers: `src/features/coach-house-companion/hooks/**`

## Rules
- Keep route files in `src/app/**` as composition-only wrappers over this feature.
- Import other features only through their public entrypoint (`@/features/<name>`).
- Keep `lib/**` pure: no React, no UI imports, no route imports.
- Keep `server/**` free of UI/component imports.
- Keep shared UI in `src/components/ui/**`; avoid one-off primitives here.
- Keep acceptance coverage in `tests/acceptance/coach-house-companion.test.ts`.
- Add acceptance tests for user-visible behavior before merging.
