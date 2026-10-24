# WorkspaceSharing Feature

Branded pages made from explicitly selected saved Particles. The authoritative
execution checkpoint is `docs/plans/2026-10-16-workspace-board-sharing-mvp.md`.

S18 introduces the private membership table and strict draft/public snapshot
contracts. Membership order is independent of canvas geometry. Published content
and brand remain a separate snapshot until explicit Publish/Update. Removing a
page never removes a source or placement. There is no public table read, client
write, polling, version-history interface or Google permission change.

S19 adds server actions in `server/actions.ts`: review saved content, save a
private draft, explicitly Publish/Update, or make Private. The service constructs
the snapshot; request payloads cannot provide actors, organizations or public
JSON. One service-only RPC locks current membership, page and saved graph,
checks revisions, and records one latest-operation receipt for safe retries.
Ordinary canvas movement does not invalidate unchanged public content; the final
commit still compares the freshly read graph. Revocation needs no source fetch.
Replays repair cache invalidation without publishing twice. Work happens only
on explicit actions, never per keystroke or from a subscription/polling loop.

Drive attachments and Core Documents resolve through their existing canonical
owners. The actor's RLS client batches attachment metadata; the final RPC locks
and compares those rows, and profile-owned links require the exact saved profile.
Only normalized Google links (including a valid optional resource key) publish;
no OAuth tokens, account hints, provider calls or permission changes.

The dynamic `/[org]/[uniqueLink]` route renders a branded column through shared
frame primitives, with safe Markdown/tables and provider links. A pre-stream
layout gate returns HTTP404 for missing/private pages. Public reads return only
the snapshot and publication timestamp, with current visibility and claimed,
unreserved organization-handle checks. Request-local deduplication serves
layout, metadata and page; no cross-request snapshot/visibility cache. Basic
OG/Twitter fields use committed data and do not opt the page into indexing.
No canvas/editor/Drive SDK is imported by the public renderer. Uploads stay
blocked; brand marks currently use initials; Form definitions are preview-only
until the response pipeline is connected. Browser/visual/bundle QA remains open.

The existing Particle action menu opens Share in the current workspace window.
Right-click uses that same menu. A new page starts with the clicked Particle or
current multiselection; existing pages retain their saved order. Titles,
introductions, selection and drag/keyboard ordering stay local until Save draft
or explicit Preview → Publish/Update. Preview reuses the exact public renderer;
no second drawer/store or per-keystroke server action. Copy link/Make Private
require confirmed publication. Unconfirmed writes lock the draft and retain the
exact operation for Retry; definite conflicts keep local changes and offer a
guarded reload. New Share navigation/discard uses application UI, not native
confirm. All three sharing migrations were applied and independently verified on Production
October19. The local-preview flag and connected app/database journey still need
verification; this is not a production application deployment.
Publication and reading retain the existing public-sharing feature flag.

Validation:
- `pnpm exec vitest run tests/acceptance/workspace-sharing.test.ts`
- `supabase/tests/workspace-sharing.test.sql`, in a disposable database named
  `workspace_sharing_fixture_*` with the explicit session marker in that file.
- Rollback: `supabase/rollbacks/20261016183000_workspace_page_membership.sql`.
- Writer: `20261016190000_workspace_page_commit.sql`, matching rollback;
  reverting the writer preserves saved pages and publication content.
- `tests/acceptance/workspace-sharing-writer.test.ts` tests server action flows.
- Source/reader: `workspace-sharing-sources.test.ts`; rendering/metadata:
  `workspace-sharing-page.test.ts`; SQL: `workspace-sharing-public-read.test.sql`.
- Reader migration/rollback: `20261018120000_workspace_page_public_read.sql`.
  Renamed before application because production already uses `20261016200000`
  for fiscal review/tasks/CC. Do not replay or overwrite that production record.
  The writer migration was extended before its October19 application with canonical
  Drive/profile/claimed-handle checks; provision the current fixtures together.
- Provision `supabase/tests/workspace-sharing-commit-fixture.sql` only in a
  fresh marked local `workspace_sharing_fixture_*` database, then run
  `supabase/tests/workspace-sharing-commit.test.sql`. For independent-session
  concurrency tests set `WORKSPACE_SHARING_TEST_DATABASE_URL` explicitly and run
  `tests/acceptance/workspace-sharing-database.test.ts`. These tests never read
  application database credentials and reject remote or credentialed URLs.

## Ownership
- Domain logic: `src/features/workspace-sharing/lib/**`
- Server actions/queries: `src/features/workspace-sharing/server/**`
- UI components: `src/features/workspace-sharing/components/**`
- Hooks/controllers: `src/features/workspace-sharing/hooks/**`

## Rules
- Keep route files in `src/app/**` as composition-only wrappers over this feature.
- Import other features only through their public entrypoint (`@/features/<name>`).
- Keep `lib/**` pure: no React, no UI imports, no route imports.
- Keep `server/**` free of UI/component imports.
- Keep shared UI in `src/components/ui/**`; avoid one-off primitives here.
- Keep acceptance coverage in `tests/acceptance/workspace-sharing.test.ts`.
- Add acceptance tests for user-visible behavior before merging.

Editor checks: `workspace-sharing-editor.test.ts` and
`workspace-sharing-editor-data.test.ts`; commands and receipts:
`workspace-sharing-writer.test.ts`. The portable `page-draft.ts` contract and
type-only editor DTO imports keep server projection code out of the editor hook.
