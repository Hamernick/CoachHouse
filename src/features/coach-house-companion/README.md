# Coach House Companion

Includes an isolated local sandbox and a separately gated connected-account
implementation. The sandbox persists fictional work to local files. Connected
mode uses current published curriculum and authorized native document,
submission and progress records through user-scoped Supabase clients.
Provider configuration and live ChatGPT installation remain unverified; no
production database/provider change has been applied by this implementation.

## Connected mode

`COMPANION_LIVE_ENABLED=1` enables the OAuth broker and live MCP service; enabling
both sandbox and connected modes fails closed. `server/live/config.ts` owns
canonical HTTPS origins and client/callback validation. `oauth-broker.ts`,
`oauth-store.ts` and `oauth-crypto.ts` keep the separate upstream Supabase OAuth
session encrypted while issuing opaque MCP-only credentials. OAuth store RPCs
are service-role-only; native work uses the verified member's RLS context.

`accelerator.ts` serves published lessons, typed questions, video/resource links,
personal drafts, explicit submissions and authoritative completion. Drafts remain
Companion-only until submitted. Production's native trigger merges submitted
answers into the member's own organization profile and may affect its public
profile. The private pilot requires explicit review/approval and blocks submission
to an organization different from the actor. `documents.ts` reviews exact core-document text;
the database constructs only the approved draft-section change and preserves
published content, visibility and unrelated sections. Every call rechecks actor,
organization permissions, entitlement and read/write scopes. Writes use stable
request IDs and compare current revisions, including concurrent native edits.

`components/connected-companion-panel.tsx` uses the existing compact primitives.
It independently reads a saved document before confirming it. Native destinations
follow the server's configured environment. Coaching opens `/coaching`; calendar
output remains ICS export. There is no embedded questionnaire/editor or inline
video player.

See [connected setup](../../../docs/plugins/coach-house-companion/connected-setup.md)
for staging configuration, install/package commands and live acceptance gates.
The contracts below describe the separately preserved sandbox baseline.

## Service contract

- `server/actions.ts`: `executeCompanionTool(principal, name, args)` returns the
  authoritative snapshot and a concise action receipt.
- `companion_review_document` is read-only: it accepts the organization and
  proposed text, then returns a sanitized proposal bound to the current document
  ID and revision. It does not save drafts/documents/submissions, add receipts,
  or record mutation IDs. Saving still requires explicit approval and the
  proposal's expected revision; a concurrent change produces a conflict.
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
