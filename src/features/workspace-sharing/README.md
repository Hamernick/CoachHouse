# WorkspaceSharing Feature

Branded pages made from explicitly selected saved Particles. The authoritative
execution checkpoint is S06 in `docs/plans/2026-10-27-particle-system-execution-spec.md`.
The original sharing foundation remains documented in `docs/plans/2026-10-16-workspace-board-sharing-mvp.md`.

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

## Canvas-bound pages (October31, local implementation)

`canvasId` travels from the current board to editor/review/commands. NULL means
the main canvas, preserving legacy pages and omitted request fields. A page's
`canvas_id` is immutable; it cannot be moved by changing a request or replay.
Recent pages and source choices are scoped to that canvas. The locked writer
compares the selected saved graph and preserves the public snapshot until explicit
republish. Revocation does not need the source canvas to survive.

Apply `20261031210000_workspace_page_canvas.sql` before deploying this application;
it replaces the old RPC overload and retains page/link/snapshot identity. No
hosted migration or public feature activation occurred in this checkpoint. Local
proof includes `workspace-sharing-canvas.test.sql`, the existing sharing SQL and
concurrency suites, and `tests/browser/workspace-ai/sharing.spec.ts`. External
guest access and public assets remain separate work.

## Authenticated page guests (October31, local implementation)

Preview → Share privately stores a separate reviewed `guest_snapshot`; it never
publishes or refreshes a public snapshot. People creates email-bound View/Edit/Manage
invitations. Copy the invitation link; the application sends no email. Acceptance
requires the exact verified account, without creating organization membership.
Pending invitations expire after seven days; accepted access lasts until removal.
`/public/pages/[pageId]` is an authenticated-data surface inside the already-reserved
`public` route namespace. Its HTML shell contains no private data.

The strict access command, verified server actor and service-only database function
own reads, acceptance, invitation, revocation and revisioned page-details edits.
View exposes only the reviewed projection. Edit writes page title/introduction only.
Manage can invite View/Edit and remove its delegated invitations. Only actual
organization editors can grant Manage or publish. Revoking a manager also revokes
delegated grants; every read/write/replay rechecks current access. Public links and
independent grants remain separate. No form responses, source/organization queries,
provider credentials or other Particle edits are exposed. Private edits need explicit
organization-editor review before guest refresh or publication.

`20261031220000_workspace_page_guests.sql` must follow the canvas migration before
application deployment. All new tables use RLS with direct API access denied;
operation receipts preserve actor/action/revision/changed-field/time metadata and
exact retry identity. No hosted migration was performed. SQL proof lives in
`workspace-sharing-guests.test.sql`; the existing database suite includes guest
revoke/edit and guest-edit/publication races. Browser interaction fixtures are in
`tests/browser/workspace-ai/guests.spec.ts`. Authenticated Next, hosted and user
appearance acceptance remain open. Guest lookup uses no board/source fetch;
the source-independent recovery directory is implemented locally; authenticated app/hosted qualification remains open.

Guest recovery guards (November1): pending/unconfirmed invitation or revocation
requests lock Share navigation and report through existing window status. The
access hook warns before browser unload and retains the exact explicit retry.
Guest details keep the original draft revision through access-list updates;
only explicit reload or the user's acknowledged edit replaces their draft.
Concurrent edits still conflict through the existing server writer. Browser
fixtures prove these interactions; authenticated app navigation remains separate.

Saved-page recovery (November1): `/workspace/shared-pages` lists thin page metadata
across the active organization, including pages whose canvas was deleted. The
workspace sidebar exposes it even when no workspaces remain. Existing editor
membership/RLS protect every list/detail read; immutable-ID pagination bounds each
page to 25 records without omitting older pages behind a fixed recent limit.
Management reuses exact-retry publication revocation and guest controls. It does
not reload sources, rebind pages, publish, or edit source content. Pending or
uncertain writes lock recovery navigation; public and invited access stay separate.

Public reading parity: event times use stable UTC HTML before hydration, then the
reader's locale/time zone with an explicit label. Stored instants stay unchanged.
Embedded previews avoid duplicate page headings/Particle IDs; standalone anchors
remain. Drive controls wrap at enlarged text. Targeted SSR/hydration/keyboard/mobile
fixtures pass; appearance and hosted qualification remain separate.


S07 image publication: preparation produces bounded static WebP copies with
metadata removed, orientation applied and SHA256 identity. Session-only previews
bind that digest to the selected saved canvas. Publication repeats preparation,
rejects changed review identity and uploads to private `workspace-page-assets`
using fresh paths. Migration `20261101120000_workspace_page_images.sql` wraps the
existing page transaction, checks source metadata/selection and Storage evidence,
and commits page plus revision-scoped grants atomically. Original Documents and
private permissions remain unchanged.

Direct image requests independently check the current public/guest/editor
snapshot, verify committed bytes and recheck access after I/O. Responses bypass
persistent browser/CDN/Next image caches. A published copy does not follow later
source edits; replacement needs review. Make Private disables public images;
independent invited access remains. Downloaded/in-flight bytes cannot be recalled.
Responsive image rendering reserves prepared dimensions and exposes failure text.
TXT/Markdown/CSV documents use complete inert text copies (256KiB/file, eight
distinct files/1MiB per page). PDF/Word remain unavailable. Read document expands
a bounded keyboard-accessible viewer; closing clears text and reopening rechecks
access. Neither Markdown, HTML, links nor formulas execute. The independent
`/api/public/workspace-page-documents/[assetId]` and session-only
`/api/account/workspace-page-document` routes return text/plain, nosniff, restrictive
CSP and no-store. Document grants follow the same current-audience and post-read
checks as images. Deploy `20261101130000_workspace_page_documents.sql` after the
image migration and before this application revision. Its service-only combined
writer commits image/document grants atomically; failed document validation rolls
back preceding image grants as well. The older image-only helper is no longer
service-callable. The orphan worker excludes both committed grant tables.

Upload failures use orphan reconciliation, never eager deletion after an uncertain
commit. The authenticated `/api/internal/cron/workspace-page-images` handler uses
`INTERNAL_CRON_SECRET` or `CRON_SECRET` and removes up to100 unused copies older
than24hours via Storage API. Commits admit copies younger than1hour; active object
locks are skipped. Schedule this handler during deployment and prove actual
Storage upload/read/retry/cleanup behavior before enabling release. Superseded
committed grants are retained; retention/storage accounting remains unqualified.
Local SQL fixtures model provider metadata, not the Storage service itself.
