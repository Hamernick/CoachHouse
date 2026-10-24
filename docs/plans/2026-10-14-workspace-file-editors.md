# Workspace file editors — implementation plan

> **MVP continuation — 2026-10-16:** Follow the [consolidated 36-step workspace board and sharing plan](2026-10-16-workspace-board-sharing-mvp.md) for current scope, decisions and resume instructions. This document is retained as historical/technical reference; its older next-step order does not override the new plan.

Date: 2026-10-14
Lane: `feat/particle-system-20261009`
Preview: `http://localhost:3008/workspace`
Status: room/versioning/metadata-notification migrations applied and schema-verified. Complete Markdown windows now retain existing shared rooms read-only, with saved-file fallback. Shared-session lifecycle, fixed-prefix Save/restore backend, verified peer advancement and retained Save command/control are implemented and locally tested. Recovery discovery/choice, writable integration, version UI, version-aware purge, browser canary and provider write-back remain pending.

## Requested outcome

Opening Edit on a Markdown, Word or CSV Particle opens the complete file in the existing workspace content window. Documents opens the same editor. Reuse the strategic roadmap rich-text editor and its tools; use Tiptap tables for editable CSV content. Preserve compact window chrome, keyboard accessibility, dark/light tokens, smooth transitions and the canvas underneath.

Confirmed save preference: update the existing Documents file and retain a recoverable previous version. Canvas Particles remain references to that file. For Drive-linked files, Google Drive remains the canonical storage provider; edits from either product must be reflected in the other. Saving content must preserve their IDs, positions, sizes and connections.

## Scope assessment

The shared editing UI is a small extension. Reliable Markdown/CSV editing plus versioned saving is a medium feature spanning frontend, file conversion, API and persistence. Word import/export is a larger additional slice, particularly legacy `.doc` and complex formatting. Deliver in reviewable stages; avoid a large one-shot change or a calendar promise before conversion fixtures pass.

The first usable milestone is the real full-content editor for Markdown with safe persistence, followed by CSV. Drive is a first-class storage adapter in the foundation, with uploaded-file write-back and external-change refresh delivered as their own checkpoint. Word is part of the plan, with explicit conversion coverage rather than a plain-text substitute advertised as Word editing. Huge spreadsheets, exact Word page layout, formulas, tracked changes and generative UI are outside the first release.

## Audited reusable infrastructure

| Existing owner | Reuse / required change |
| --- | --- |
| `src/components/rich-text-editor.tsx` | Tiptap lifecycle, editor UI, image hooks, toolbar portal, readonly mode and hydration boundary. Extend through opt-in format capabilities; keep roadmap behavior stable. |
| `src/components/rich-text-editor/extensions.ts` | Existing headings, lists, marks, links, alignment, tables, underline, sub/superscript and images. Add only missing format support proven necessary. |
| `src/components/rich-text-editor/components/rich-text-toolbar.tsx` | Existing formatting, table row/column controls, images, Undo/Redo. Compact responsive grouping rather than a second toolbar. |
| `src/components/roadmap/roadmap-editor/hooks/**` | Dirty-state, save feedback and draft recovery patterns. Their section-specific writer is not an uploaded-file writer. |
| `src/features/workspace-particles/components/particle-inspector.tsx` | Dispatch file references to the file editor before the generic Particle form. |
| `src/features/workspace-particles/components/particle-widget-fields.tsx` | Replace the read-only file notice only when a real editor/save adapter is available. |
| `src/features/workspace-particles/lib/particle-library-document.ts` | Existing uploaded, roadmap, policy and Drive references; retain canonical ownership. |
| `WorkspaceContentWindow`, header portals, `useWorkspaceEditorStatus` | Filename once, shared save/dirty indicator, close/minimize/maximize and unsaved-change handling. |
| `src/app/api/account/organization-document-files/route.ts` | Authenticated file listing/download/upload/trash/restore. PATCH currently changes trash state, not file contents. Extend its existing access and storage rules. |
| `src/features/google-drive/server/**` | Existing OAuth/refresh tokens, selected-file access, attachment metadata, thumbnail proxy and bounded content download. Extend this feature with provider writes and change tracking; it currently has neither. |
| `organization_external_documents` | Existing org-scoped attachment UUID mapped server-side to provider file ID and connection; retain this identity. |
| `organization_document_files` | Canonical file ID, organization, private storage path, MIME, size and timestamps. Current schema has no revision/history fields. |
| `src/lib/markdown/sanitize.ts` | Existing rich HTML sanitizer; verify imported nodes/attributes against it. |
| Existing Mammoth, Papa Parse and worker dependencies | DOCX conversion and CSV parsing. Avoid another table/editor library. |

The current preview worker truncates text to 100,000 characters, CSV to 1,000 rows/50 columns/2,000 characters per cell, skips empty lines and reads DOCX as raw text. Those choices are appropriate only for a bounded preview. Editor loading and saving require separate complete-content contracts.

The existing lightweight regex Markdown converters do not provide adequate rich-document round trips. The installed editor has table support already. Tiptap Markdown is not currently a direct dependency; compatibility and serialization need a small fixture-backed probe.

## Product and window behavior

- Edit opens the existing floating content window with the actual filename and compact save actions in its header. Remove the generic status/description form for file-content editing; no repeated filename inside the body.
- Load the complete authorized source before enabling editing. Mirror the final editor layout with a skeleton and show an inline retry error on failure.
- Reuse the roadmap toolbar, grouped by function with overflow menus on narrow windows. Keep tools reachable through keyboard and touch.
- Give prose a readable content width; give tables more horizontal space. Use content-window sizing hints, not a wider dock. Provisional widths: roughly 800–960px prose, 1,000–1,200px tables, constrained by the canvas/viewport.
- Maximize occupies the workspace canvas area. Preserve the current editor instance, draft, selection and local history while changing window size. Restore the prior floating size on exit.
- Use the established Motion window transitions, reduced-motion variant and loading fade. Keep text and caret unscaled while typing; no animated document layout on each keystroke.
- Editing content never drags a Particle or pans the canvas. Existing node-control boundaries and window focus guards remain in place.
- Save is explicit initially: button and Cmd/Ctrl+S. Dirty, saving, saved and failed states use the existing window status system. Server autosave is outside the initial scope; adding it later requires measured request/recovery budgets and must not create a revision on every keystroke.
- Closing, switching files/tabs and leaving the page protects unsaved changes. Failed saves retain the draft and offer retry. Never mark Saved before a confirmed committed revision.
- Cmd/Ctrl+Z inside the editor changes file content; canvas Undo/Redo remains graph history. Restoring a file version is an explicit document operation, not a graph rollback.

## Shared architecture

Start implementation with `pnpm scaffold:feature document-editing`. This reusable feature owns format adapters, validated editor sessions and the authorized file-content service. Workspace Particles and Documents compose its public client components; neither owns a second document store.

Suggested cohesive modules, adapted to the scaffold:

- `types.ts` / schemas: source identity, canonical revision, format capabilities, load result, conversion diagnostics, commit request/receipt.
- `lib/format-adapters`: Markdown, CSV and DOCX parsing/serialization, each with explicit supported content and limits.
- `components/document-editor`: window-ready shared rich-text/table composition and load/error states.
- `hooks/use-document-editor-session`: local draft, dirty state, conflict detection and save lifecycle.
- `server/document-content-service`: authorized loads, validation and versioned commits through the existing file table/bucket.

Keep route files composition-only. File adapters do not import Particle components. The Particle inspector maps its persisted reference into the document feature request. Document text and tables never enter `particleGraph`; only a canonical file/source reference lives there.

Generated roadmap references delegate to the existing roadmap editor/writer. Legacy policy/upload attachments need their owner-specific adapters or canonical file-record resolution before enabling content Save. Drive references use a provider-specific editor/load/save adapter described below; unsupported types continue opening the real provider editor until that adapter passes its coverage tests. A filename extension alone must not authorize writing an unsupported source.

## Complete-content format contracts

### Markdown

1. Read original bytes and validate UTF-8, byte limits and a complete parse; do not reuse preview truncation.
2. Preserve original source bytes until the user actually changes content. Opening and closing an untouched file must not rewrite it.
3. Probe Tiptap's version-compatible Markdown adapter against our existing extensions. Use a complete parser/serializer, not the lightweight regex helpers.
4. Support headings, emphasis, nested lists, links, code, blockquotes, rules, images and tables. Current shared code-block configuration is disabled; add it as an opt-in file capability rather than changing every roadmap editor.
5. Audit every roadmap toolbar command against the export format. Preserve richer operations through validated HTML fallback where Markdown permits it; the canvas preview must render that output through the existing sanitizer rather than hide it with `skipHtml`.
6. If a command cannot be represented and rendered faithfully, disclose the format constraint and prevent a lossy save. Do not display working-looking commands whose output is silently discarded.
7. Test source/rich-view switching without losing selection, edits or undo history before exposing that optional control.

### CSV / tables

1. Parse all cells with Papa Parse as strings, with `header:false`, `dynamicTyping:false`, no preview row limit and no skipped blank rows. Preserve duplicate headers, leading zeros, large numeric strings, empty fields, embedded newlines, delimiter, BOM and line-ending metadata.
2. Render a table-specific Tiptap schema: one logical grid, plain-text cells, cell editing, row/column insertion/removal, navigation and paste. Disable merged cells, nested tables and formatting that CSV cannot store.
3. Retain canonical row/cell order and complete values. Do not infer a header destructively or silently turn cell strings into dates/numbers/formulas. Formulas remain literal text.
4. Serialize through Papa's unparse facilities with retained dialect metadata; validate dimensions and reparse before commit. Preserve original bytes for untouched files.
5. Use a measured DOM budget. Start with ordinary editable tables; benchmark 200-row and 1,000-row fixtures. Large-file support needs a paged table projection with complete backing data and one coherent edit history, not thousands of live DOM cells.
6. Never save a truncated preview or only the visible page. If a file exceeds the tested editing budget, leave the original intact, show the complete-file access option and explain the editing limit. Do not advertise unrestricted large-spreadsheet editing.

### Word: `.docx` and legacy `.doc`

1. DOCX import must preserve supported structure using Mammoth HTML conversion or a dedicated Tiptap conversion adapter; raw-text extraction is insufficient. Sanitize before rendering. Preserve/import embedded assets through authorized organization storage.
2. Build a fixture matrix: headings, lists, emphasis, hyperlinks, images, simple/merged tables, page breaks and complex Word structures. Detect unsupported content before enabling an overwrite.
3. Compare local Mammoth plus a DOCX serializer against the official Tiptap conversion tooling. Choose based on fixture coverage, bundle/runtime costs, licensing and deployment fit. No provider subscription or account configuration is part of this planning pass.
4. Export valid DOCX with the advertised content coverage, reopen it and compare structure and content. Keep the original previous version recoverable. Exact original Word styling/page layout is a separate capability, not assumed from successful conversion.
5. `.doc` is a separate binary format. `soffice` exists locally, but there is no verified production conversion service. Define and validate a deployable conversion path before promising legacy `.doc` editing; local success alone does not establish Vercel support.
6. If `.doc` conversion produces DOCX, make that conversion explicit and refresh canonical MIME/extension metadata for every reference. Do not silently save plain text under a Word extension.

## Google Drive storage and two-way synchronization

This scope is included in the feature, rather than a later replacement of the local-storage design. The UI and format adapters are shared; the canonical write target depends on the source.

### Storage and identity

- A Drive-linked file remains in Drive. Store the existing attachment/reference, provider revision metadata, sync status and encrypted connection credentials in Coach House. File bytes/editor content are transient working data and bounded disposable caches, not a second canonical document in Supabase.
- Keep the same Google file ID and Coach House attachment UUID on Save. Distinguish them in contracts: browser requests use the authorized attachment ID; the server resolves the provider ID through the org-scoped attachment record. Existing raw provider references require a validated compatibility adapter.
- Reuse Tools for connection management and Documents/Picker for choosing files. Selected-file access remains the default scope. No automatic Drive-wide import, account migration or relocation of existing Coach House uploads.
- Removing a Particle, detaching a document or disconnecting Drive does not delete the remote file. Explicit user deletion and cleanup of app-created recovery artifacts are separate actions.

### File kinds and provider writes

| Drive source | Coach House editing path | Canonical save path |
| --- | --- | --- |
| Uploaded `.md`, `.csv`, `.txt` | Same complete-content Markdown/table/text adapters as local files | Update media on the same Drive file. |
| Uploaded `.docx` / `.doc` | Same validated Word adapters, with the existing conversion checkpoint | Update the same Drive file in its supported format; never silently convert to a native Google Doc. |
| Native Google Docs | Dedicated structured Docs-to-editor adapter covering supported nodes, styles and document tabs | Google Docs API mutations on the existing document with strict revision control. |
| Native Google Sheets | Separate Sheets adapter and range/cell operations; extend after the CSV foundation | Sheets API writes to edited ranges, preserving untouched formulas, sheets and formatting. |
| Other native files / PDFs | Existing authorized display or provider-open path | No pretend rich-editor write-back. |

Drive media updates, native Docs mutations and Sheets writes are distinct APIs. Uploading a converted blob over a native Google document can replace its complete contents; that is not an acceptable shortcut for preserving unedited structure/comments. Native Docs/Sheets require an explicit capability and fixture matrix.

### Access and capabilities

- The installed connection requests `drive.file`. Google documents the same scope for selected-file updates and Docs batch updates; verify granted scopes, API enablement and per-file `capabilities.canEdit` during the provider checkpoint before expanding scope.
- Require both Coach House organization editing access and an appropriately authorized Google principal for writes. An org role alone does not grant Google file editing permission. Do not use a different member's stored write token to bypass provider permissions.
- Preserve encrypted refresh-token handling and server-side refresh. Content requests resolve provider identities server-side; no long-lived tokens or credential logging.
- Drive-backed content editing follows provider authorization and existing product access rules; it must not accidentally require Coach House upload-storage entitlement merely because the shared editor also supports local files.
- View-only, revoked, disconnected, moved, trashed and inaccessible files expose accurate states and retain any unsaved local draft. Never display Saved when provider access has failed.

### Coach House to Drive

1. Load complete remote content plus MIME, capabilities and an opaque provider revision/base token into the editor session.
2. Keep the draft local while editing. Save serializes the supported format or constructs targeted native document operations.
3. Recheck authorization and obtain a recoverable prior version in Drive before an overwrite. A local-storage version record is not a substitute for Drive revision recovery.
4. For Google Docs, use `documents.batchUpdate` with `requiredRevisionId`; do not silently merge a stale whole-document replacement. Support document-tab IDs and preserve unsupported structures or leave that source readonly.
5. For uploaded files, validate the provider's actual conditional-write behavior with a concurrent-edit canary. A version check followed by an unconditional upload is not an atomic conflict fence. Do not claim safe collision-free saves until this behavior is proven; unsupported cases need an explicit conflict/recovery workflow.
6. After a confirmed provider commit, record the returned revision and update the affected editor, Documents item and canvas references from the commit receipt. Invalidate only this file's stale readers; do not immediately redownload unchanged content or refresh the whole workspace. A successful Google write followed by a failed local metadata update must be reconciled by reading the remote revision, without blindly replaying the write.

### Drive to Coach House

1. Revalidate on explicit open, manual Refresh, or stale active-editor focus/reconnect. Coalesce repeated focus events and deduplicate in-flight requests. No periodic polling by default; closed, hidden or idle views perform no periodic refresh work. Localhost uses these demand-driven checks until a controlled callback environment is available.
2. Add Drive change notifications and incremental change cursors for efficient hosted refresh. Notifications are invalidation signals; fetch authoritative changes/content through authenticated APIs. They are not document edits to apply directly.
3. Store channel/resource IDs, verification tokens, expiry and per-connection cursor state. Validate webhook identity against registered channels, deduplicate signals, renew channels and recover expired/invalid cursors. Register only verified HTTPS callbacks. Reuse existing scheduled-job infrastructure for bounded renewal; no per-file cron or continuously running sync process.
4. Refresh only attached files affected by a change. Coalesce signals, read incremental metadata first and fetch complete bytes only for a changed revision needed by an active view. Isolate state by org/connection/file identity. Avoid one watcher per canvas Particle, Drive-wide downloads and full workspace refreshes. Webhook delivery still incurs incoming requests; deduplication bounds downstream work, not the incoming invocation count.
5. Replace a clean open editor with the new remote revision while preserving sensible selection/scroll. For a dirty editor, preserve the draft and show Changed in Drive with reload/compare/recovery options. Do not overwrite or silently merge it.
6. Prevent echo loops: recognize the revision produced by our own Save. An external refresh never automatically writes the old local content back to Drive.

This delivers bidirectional synchronization of committed changes with eventual refresh. Without hosted notifications, external changes appear at the next demand-driven check; display the last-checked state accurately. Optional active-editor polling is disabled by default and may be considered only after a measured need, with a hard frequency limit, idle cutoff and bounded retries. Keystroke-level collaboration across Google Docs and Tiptap is a separate model and is not implicitly provided by change notifications.

### Previous versions and recovery in Drive

- Uploaded binary files use Drive revision retention where supported; pin the relevant prior revision and manage retention limits without touching unrelated history.
- Native Google Docs/Sheets have different revision APIs and retention behavior. Validate the recovery path explicitly. Where API revision recovery is insufficient, retain the previous supported content as an app-managed recovery copy in Drive, with private access and recorded provenance, before enabling overwrite.
- Recovery copies and their contents stay in Drive; Coach House stores only the pointers and recovery metadata. Show the storage/recovery behavior clearly. Restore uses the same authorization/conflict checks and keeps the primary file identity.
- Treat restore as a new remote change and invalidate all linked views. Do not promise programmatic restoration of every native Google revision without a verified API path.

### Additional database and test scope

Extend existing external-document/connection metadata only as needed for capabilities, provider revisions, pending/confirmed receipts, recovery pointers, change cursors and watch-channel lifecycle. Apply RLS and current org/user scoping. The private local-file version table below applies to Coach House-managed uploads, not remote file bodies.

The controlled provider checkpoint must demonstrate: edit here/read in Drive; edit in Drive/read here; same IDs; prior-version recovery; concurrent native/provider edits; view-only access; token expiry/revocation; duplicate/out-of-order notifications; lost Save responses; rate limiting; channel renewal; reconnect; Shared Drive behavior; and removing a Particle without deleting the remote file. Mocked API tests do not establish live provider sync.

## Coach House-managed file saving and proposed database changes

For Coach House-managed uploads, confirmed behavior requires a content replacement API, stable file identity and a recoverable previous version. The current upload-only API cannot provide that contract by itself.

Proposed minimum schema slice, subject to a targeted migration audit:

- Monotonic revision on the existing canonical file record, with a safe default for existing uploads.
- A private previous-version record keyed to the canonical file ID, storing previous storage path, MIME, byte count and revision metadata. Retain at least the last committed version; avoid building a full history product in this slice.
- Idempotent save receipt/token sufficient to resolve retries after a lost response.
- RLS, organization edit authorization and quota accounting for retained bytes. Existing uploads and references remain valid; no recreation of the file ID.

Commit protocol:

1. Authenticate and authorize the canonical file/org on the server; apply existing storage entitlement and quotas.
2. Validate the complete editor content, format, limits and expected revision. Sanitize rich output and serialize a supported file.
3. Stage new bytes at a unique private object path. Never overwrite the current object before the commit succeeds.
4. In a database transaction, recheck revision/deletion state, record the previous version, update the canonical pointer/size/MIME/revision and establish the receipt. One caller wins; a stale editor receives a conflict.
5. Only after commit invalidate affected Documents/canvas reads and confirm Saved. Refresh signed URLs and preview metadata by canonical file ID/revision; keep graph references and layout unchanged.
6. On failure, retain the client draft, clean up unreferenced staged bytes and preserve the prior file. Storage and Postgres cannot be one atomic transaction, so cleanup/recovery must be explicit and retry-safe.
7. Restore a previous version through the same authorized revision-checked operation. Update size/quota metadata and all visible references consistently.
8. When old retained versions are rotated or a file is permanently deleted, clean up only verified unreferenced objects. Account for retained versions in storage usage and cleanup tests.

## Performance constraints

- Dynamically import the editor and relevant format adapter only on Edit. Canvas cards stay lightweight previews.
- Keep one mounted editor for the active file; clean up workers, fetches and listeners on close/file switch. Ignore late results from a prior source/revision.
- Keep live Tiptap transactions local. Avoid serializing full HTML/JSON into canvas state on every keypress. Add opt-in shared-editor support for deferred counters/link extraction and save-time serialization while preserving existing roadmap consumers.
- Preserve link previews. In file-editing mode, discover links after a short typing pause, retain unchanged metadata, deduplicate in-flight URL requests and bound concurrency. Suspend pending discovery/provider work in inactive views. Keep roadmap behavior stable. Do not equate avoiding full HTML serialization per keystroke with disabling live editing, formatting, history or collaboration.
- Parse and convert off the main thread where feasible, with cancellation, time and decompressed-content limits. Apply limits visibly; do not drop data to hit a budget.
- Benchmark ordinary and stress fixtures before choosing editable row/node caps. Do not promise a device-independent FPS guarantee.
- Reuse theme tokens, existing window motion and reduced-motion behavior. Editor/table scroll stays local; canvas remains mounted and responsive.

## Cost and request budgets

These are implementation requirements, not a claim of measured savings or zero cost.

### Multiplayer requirements

- Audit found current workspace presence/cursors, but no committed Particle-operation subscription or rich-text CRDT transport. Preserve those existing surfaces; presence alone must not be advertised as synchronized document content.
- Shared document editing requires an authorized document room, operation-based merging, collaborator awareness and durable recovery before enabling concurrent content writes. Reuse the existing Supabase client/auth infrastructure; prove private-room permissions, member/invite revocation, reconnect convergence and bounded operation persistence before exposing this capability.
- Keep the editor's native document as its live working representation. Shared operations may be sent directly over the authenticated realtime transport in bounded batches; they are not whole-file uploads or Vercel actions on every keystroke. Account for realtime message/fan-out costs separately. Persist acknowledged operations/checkpoints with bounded batching, rather than treating ephemeral broadcast as durable storage.
- Save commits a coherent shared checkpoint to the canonical file provider. Coordinate commits per document, protect expected provider revisions, reconcile uncertain receipts and preserve edits arriving during Save. Editor Undo/Redo must undo the user's edits without rolling back another participant's work.
- Realtime document working-state recovery is bounded pending-edit state, not a competing permanent copy of a Drive file. Define retention/cleanup and recovery receipts explicitly. Drive changes cannot reset a dirty shared room; coordinate conflict resolution for all participants.
- No single-user whole-file overwrite, polling or last-write-wins replacement as a substitute for simultaneous editing. Readonly/degraded access must be accurate when room authorization or durability is unavailable. A locally editable foundation is not evidence of live multiplayer completion.

| Trigger | Allowed work |
| --- | --- |
| Typing | Local editor transactions and bounded authenticated collaboration deltas; zero whole-file uploads, provider writes, graph writes or Vercel actions per keystroke. Batched durable collaboration work and paused link discovery have their own budgets. |
| Caret movement, scrolling, canvas dragging, theme/window changes or unrelated renders | Local presentation and throttled collaborator awareness where needed; zero document-load/save requests or repeated conversions. |
| Open supported file | One deduplicated logical load; reuse an authorized fresh session/cache. Count auth, metadata and media requests separately. |
| Save changed file | One serialized logical commit and one recoverable prior version, with bounded provider/auth/recovery requests and a retry-safe receipt. |
| Save unchanged file | No mutation, new version or recovery copy. |
| Focus/reconnect/manual Refresh | One coalesced freshness check when needed; no complete-content fetch for an unchanged revision. |
| Verified external change | Coalesced metadata/revision work for relevant attachments; full content only when needed by an active reader. |
| Closed/hidden/idle editor | No periodic document requests. Shared hosted notifications may mark metadata stale without downloading content. |

- Keep drafts and editor transactions local. Subscribe to narrow editor state; unrelated Particles must not rerender per keystroke. Do not run serialization, conversion or fetch effects merely because a component rendered.
- Use bounded, disposable caches keyed by authorized principal, organization, connection, file and revision. Deduplicate concurrent loads/token refreshes without sharing authorization results across users. Recheck permission at write boundaries; changed/revoked access cannot be bypassed through cached content.
- Return committed content/revision metadata with Save and update the existing session/cache directly. Invalidate only affected file readers. No global `router.refresh()`, unrelated Documents/People/Finance reloads or canvas graph persistence for document typing.
- Lazy-load only the active editor/adapter. Prefer browser workers for supported parsing/export; perform conversion once per relevant source revision or explicit export/save, with cancellation and byte/time limits. Production-only legacy Word conversion needs its own measured deployment budget.
- Keep provider proxies scoped and bounded in memory, transfer size and execution time. Avoid broad Drive listing, eager downloads of canvas references and duplicate permanent copies of Drive files. Direct provider access is an option only if current authentication/CORS permits it safely; never expose another user's token to avoid proxy costs.
- Reuse existing jobs for channel renewal/recovery, batch due work and impose bounded retry/backoff. A notification storm must not spawn unbounded content fetches. Instrument queue/request pressure and provide an operational switch to suspend automatic sync while preserving manual Refresh, drafts and committed files.
- Before enabling a sync/conversion slice, record its numeric limits for load/save calls, refresh minimum interval, cache entries/bytes/TTL, import/export limits, retry count and background-job work. Derive them from representative fixtures and the existing deployment limits; do not invent universal device or monthly cost guarantees.

Verification includes request-count tests proving no file/provider writes per keystroke or document requests during dragging/unrelated renders/hidden idle; unchanged links do not refetch, discovery is deferred, and preview concurrency is bounded. Test deduplicated load/save/focus requests; no content download for unchanged revisions; bounded duplicate-notification work; no-op Save; narrow invalidation and no repeated conversion. Include rate-limit/retry, authorization isolation, simultaneous edits, reconnect convergence, collaborator-local undo, revoked access and durable recovery after all clients disconnect.

Measure function invocations, Active CPU, provisioned-memory duration, transfer bytes and Google API calls/retries over comparable bounded before/after usage windows. React rerenders alone do not establish Vercel cost: provider I/O can still hold billed memory and each incoming function request counts. Local tests establish behavior; only deployment measurements establish usage impact. Do not enable broad background sync before these budgets and observations are available.

## Foundation checkpoint — 2026-10-14

Implemented in `src/features/document-editing`:

- Validated canonical local-file/Drive attachment contracts; complete UTF-8 loading up to 1 MiB, preserving original source/BOM and rejecting oversized input rather than truncating it. Authorized private-storage reader is explicit-open only; no background reads or writes.
- Worker-based Markdown parsing with a 15-second timeout and provisional 5,000-node rich-view limit. Unsupported formats/syntax fall back to complete source display. Initial supported structural fixtures round-trip; nonportable marks/merged tables are rejected until the source/HTML adapter provides faithful export and preview.
- Pinned Markdown and Collaboration extensions to the installed Tiptap 3.17.1 version. Yjs replica core supports idempotent concurrent merge, state-vector reconnect, remote-echo suppression and an acknowledged outbox. Retain failed batches and edits arriving during persistence; only durable acknowledgement releases a batch. A collaborative editor receives its persisted CRDT state, never per-client plain-text reseeding.
- Opt-in shared-editor native session API: native transactions stay live, without full HTML serialization per keystroke; paused counters/link discovery and narrowly subscribed toolbar state. Controlled roadmap consumers keep their update path. Link cards remain, with bounded deduplicated file-session requests and hidden-view cancellation.

This is infrastructure, not a completed editor rollout. The full-content read surface is not yet wired into Documents/Particle navigation. Editing/Save must wait for authorized transport, room durability, version recovery and the remaining format adapters. Do not advertise the existing presence/cursors or CRDT unit tests as a live multiplayer provider.

The existing `/api/link-preview` returns 410, and the release-security runbook explicitly disables caller-selected server-side URL fetching. Preserve cards and document this limitation. Restore metadata through a safe bounded provider path before calling previews complete; do not reinstate an arbitrary-URL server scraper.

## Next implementation sequence — shared document sessions

Continue in the existing Particle lane/port. No separate canvas or app. Start with uploaded Markdown; Drive rooms cannot bypass provider permissions and remain gated until their provider adapter is proven.

1. **Permission and durable-storage foundation (current slice).** Reference the canonical uploaded file from one organization-scoped room. Store an initial Yjs checkpoint plus an ordered update ledger with stable batch receipts. Readers inherit current file access; only owners/admins/staff with the existing storage entitlement may edit. Temporary workspace invitations do not automatically grant document-content rights. Enforce source identity, deleted-file state, roles, entitlement and stale source/generation checks inside database authorization on every operation. Restrict bootstrap and compaction to the server service role. Deliver SQL migration, typed contracts and actual isolated PostgreSQL/RLS tests; do not apply it to a shared provider during development.
2. **Room transport and recovery.** Reuse the authenticated Supabase client. First use durable PostgREST RPC writes plus RLS-filtered Postgres Changes for committed edits; do not trust arbitrary browser broadcasts as authoritative edits. Subscribe before reading the checkpoint/tail, buffer early events and reconcile sequence gaps on reconnect or a verified event, without timer polling. Ack only durable receipts, retain failed batches and edits arriving in flight. An unavailable migration yields an accurate unavailable state. Existing canvas presence/cursors remain intact.
3. **Shared editor integration.** Bootstrap the canonical source once, bind the existing editor to the synced Yjs fragment, add collaborator awareness and user-scoped history. Keep the same editor mounted through maximize/minimize. Preserve dirty pending edits on permission loss or connection failure; stop shared writes and show recovery rather than claiming Saved. Show a two-user checkpoint before integrating formats beyond Markdown.
4. **Canonical Save and recovery.** Serialize a coherent acknowledged room checkpoint, update the same file with an expected provider revision, retain the prior file version, return a retry-safe receipt and update only affected readers. Preserve edits arriving after that checkpoint. Add explicit version restore, conflict handling and staged-object cleanup. Verify document/canvas identities and positions survive; no global workspace refresh.
5. **Source/HTML fidelity, then CSV, Word and Drive.** Complete toolbar export/preview coverage, source recovery and long-document budgets before enabling unsupported Markdown syntax. Extend the same room/format contracts; never treat native Google Docs/Sheets as blob uploads. Prove provider scope, conditional writes, recovery and two-way refresh through controlled canaries.

Initial room budgets, subject to measured refinement:

- Local editor feedback is immediate. Coalesce durable updates after a short pause (initially 750ms), with a 2-second maximum wait during continuous edits. One in-flight write per room/client. No periodic writes for idle/hidden views, and no Vercel invocation per transaction. Flush on explicit Save/recovery/close; do not discard unacknowledged edits.
- Checkpoint up to 2 MiB; one update up to 128 KiB; uncheckpointed recovery data up to 8 MiB/512 updates, and 64 MiB of room checkpoint/recovery bytes per organization. Reject oversize batches without deleting local edits. Larger paste/update support needs a validated chunk protocol before advertising it.
- Bootstrap once per file/generation; ordered ledger receipts deduplicate retries. Compaction requires a verified checkpoint covering a known sequence; compare-and-swap against concurrent changes, retain at most the latest 2,048 covered retry receipts for up to 72 hours, and never prune unseen edits. Outside that receipt window, reconcile shared state before replacing/retrying an old pending batch; do not claim unlimited exactly-once delivery. No per-document cron.
- Read tail pages of at most 100 updates. Fetch only the subscribed document, reconcile missed sequences and require a new checkpoint when the prior tail has compacted. Stop on authorization failure rather than entering a retry loop.
- Private ephemeral awareness is a later layer; Supabase channel authorization is evaluated when joining. Do not promise immediate revocation from join-time policy alone. The initial authoritative content path checks current row permissions for each durable operation and delivered row.

Current storage checkpoint: room/ledger migration, server-only verified bootstrap/compaction, source/generation fences, bounded receipts and recovery bytes, scoped typed client reads/writes, and event-driven batching are implemented. Isolated PostgreSQL tests cover RLS, replay/actor mismatches, source changes, capacity rollback and compaction; race tests confirm one initial room and ordered concurrent writes. The migration is now applied to the configured shared database under explicit user authorization; schema verification does not establish live Realtime delivery or user-visible editing.

Before editor enablement, bind the tested transport/recovery lifecycle into the shared editor and verify coach proxy versus direct-session permission parity. Revalidate metadata-only changes (rename/trash/restore) against canonical content before rebinding the source; never reset the shared draft merely to clear a timestamp conflict. Durable working-state acknowledgements are not canonical Saved indicators.

Required evidence: owners/editors/viewers/outsiders; expired/revoked membership and deleted files; wrong organization/source; no direct anonymous/client bootstrap or compaction; concurrent initializers; repeated receipt with changed bytes/actor rejected; monotonic sequence and rollback on quota/capacity failure; compaction races; two-client concurrent merge; delayed/lost acknowledgements; reconnect; pending-edit recovery; no idle request loops. Separate local SQL tests, live Realtime delivery, user review and deployment measurements.

## Step-by-step delivery and review points

1. **Format/provider probe and foundation:** scaffold feature, define capabilities/load/save contracts for local and Drive sources, audit attachment IDs/scopes and actual conditional writes, build fixtures, confirm Markdown serializer and DOCX coverage. Review exact toolbar/tool availability and the full-content versus preview boundary.
2. **Shared window + Markdown:** integrate the lazy shared editor, filename/header controls, full-content loading, unsaved guard and maximize/restore. Show a local editable prototype early; Save stays disabled until the writer is real.
3. **Collaboration and versioned persistence:** implement authorized document rooms, shared operation merging, reconnect/awareness and bounded durable recovery; then migration, RLS/quota/revision/receipt protocol, canonical content save and restore. Connect Markdown Save; verify two-client editing, reload and Documents/canvas convergence. This is the first complete usable milestone. Do not enable a single-user writer first and call it multiplayer.
4. **Drive uploaded-file write-back and refresh:** connect the same editor to authorized remote media reads/updates, retain the previous version in Drive, implement revision reconciliation and external-change refresh. Show a controlled two-way edit/recovery canary before calling this complete.
5. **CSV editor:** table-only schema, complete parse/serialization, row/column tools, keyboard/paste, history and measured large-table policy. Review editing and reopening a representative CSV.
6. **DOCX, then legacy DOC:** implement the selected conversion adapter and export/reopen tests. Demonstrate formatting coverage before extending to legacy conversion/deployment. Keep clearly unsupported sources recoverable.
7. **Native Google Docs, then Sheets:** add structured, capability-tested provider adapters and targeted revision/range updates. Add hosted change channels and bounded renewal after demand-driven refresh/reconciliation are proven. Demonstrate bidirectional edits without dropping unsupported content; verify request budgets before enabling automatic sync.
8. **Focused integration verification:** test concurrent edits, failed uploads/commits, retry receipts, restore, source switching, full-screen transitions, entitlement/authz and drag/selection regressions. User reviews actual authenticated edits on localhost:3008. No broad visual/browser matrix unless a specific unresolved issue requires it.

## Acceptance criteria

- Edit opens the full supported source, with toolbar and a single filename in the window header.
- Saved Markdown and CSV retain complete content, including content beyond current preview limits.
- DOCX retains the explicitly supported formatting/structure; `.doc` is enabled only with a verified converter.
- Unsupported conversion cannot silently overwrite the original.
- Same canonical file ID after Save; previous committed version is recoverable in its canonical storage provider.
- Drive files remain stored in Drive, with Coach House references/metadata rather than a durable competing file copy.
- Save here is visible in Drive; external Drive edits refresh clean views and preserve dirty drafts on conflict.
- Native Google Docs/Sheets use their own validated adapters; provider permissions and failed sync states are accurately reflected.
- Removing/detaching a Drive Particle leaves the remote file intact.
- Failed/conflicting saves retain the draft and preserve the canonical file.
- Untouched files are not rewritten; switching files cannot apply a late response to the new editor.
- Editor Undo/Redo, cell navigation and paste work without moving the canvas.
- Documents and all referencing Particles show the committed revision while positions/rails remain intact.
- Maximize/restore preserves the draft, focus and local history.
- No document requests during typing/dragging/unrelated renders or periodic work in hidden views; default refresh is demand-driven, with scoped caches/invalidation and measured sync budgets.
- Theme, touch targets, keyboard focus and reduced-motion behavior meet current workspace conventions.
- Focused format, component, API, migration/RLS/quota and persistence checks pass. Separate source checks from user visual review, CI and release evidence.

## Primary references

- [Tiptap Markdown](https://tiptap.dev/docs/editor/markdown): bidirectional parser/serializer, currently beta, with representational limits.
- [Tiptap Table](https://tiptap.dev/docs/editor/extensions/nodes/table): table structure and editing commands.
- [Tiptap conversion overview](https://tiptap.dev/docs/conversion/getting-started/overview) and [DOCX demo limitations](https://tiptap.dev/docs/conversion/getting-started/demo): conversion coverage and styling boundaries.
- [Mammoth](https://github.com/mwilliamson/mammoth.js): DOCX HTML conversion, formatting coverage, sanitization and performance considerations.
- [Papa Parse](https://www.papaparse.com/docs): complete CSV parsing, dialect metadata, string typing, streaming and serialization.

- [Drive file updates](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/update), [selected-file scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth), and [upload/conversion behavior](https://developers.google.com/workspace/drive/api/guides/manage-uploads).
- [Google Docs batch updates and write control](https://developers.google.com/workspace/docs/api/reference/rest/v1/documents/batchUpdate), [Sheets range updates](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets.values/batchUpdate).
- [Drive change notifications](https://developers.google.com/workspace/drive/api/guides/push), [incremental changes](https://developers.google.com/workspace/drive/api/guides/manage-changes), and [revision management](https://developers.google.com/workspace/drive/api/guides/manage-revisions).
- [Vercel Functions usage and pricing](https://vercel.com/docs/functions/usage-and-pricing) and [Observability](https://vercel.com/docs/observability): invocation, CPU, memory-duration and usage verification boundaries.

- [Tiptap Collaboration](https://tiptap.dev/docs/editor/extensions/functionality/collaboration) and [Yjs document updates](https://docs.yjs.dev/api/document-updates): shared native documents, history ownership, idempotent updates and state-vector reconciliation.

- [Supabase Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes) and [Realtime authorization](https://supabase.com/docs/guides/realtime/authorization): current row access for database events versus join-time channel authorization.

## Migration and live-recovery checkpoint — 2026-10-14

1. Applied only the authorized uploaded-file room migration; resolved a version collision with existing core-document collaboration before any write. [Receipt](2026-10-14-document-room-migration-receipt.md) records target, exact source digest, atomic history entry and schema verification.
2. Added current-auth Supabase INSERT transport and subscribe-before-read reconciliation. Buffer early rows, deduplicate ordered receipts, recover gaps/compaction on reconnect, preserve the same local replica and lock on account changes. No snapshot-table subscription or idle polling.
3. Added account/generation/revision-scoped encrypted IndexedDB recovery, atomic cross-tab key creation, bounded session records and the exact prepared batch plus later pending updates. Local recovery completes before network commits. Quota/source/account failures retain records and stop writes/close. A crash inside the 100ms local journal window can still lose the latest keystrokes; explicit close awaits durability.
4. Focused regression: 156 tests/14 suites pass, including actual isolated PostgreSQL and two-client convergence. Final journal/error-path adjustments pass 43 tests/4 affected suites. Scoped TypeScript, ESLint, import boundaries and acceptance manifest pass. Existing feature-contract failure remains in `workspace-particles/index.ts` exporting server note internals; unrelated source was preserved.
5. Next: bind the same replica/recovery/writer lifecycle into the existing editor/window, expose recovery choices and reliable close/minimize behavior, and perform a real two-user delivery/revocation checkpoint. Then implement canonical versioned Save/restore, format fidelity and Drive synchronization. No writable single-user shortcut or per-keystroke file serialization.

Actual browser delivery and cost savings remain unmeasured. Preserve the existing localhost:3008 process and user-owned visual/authenticated review boundary.


## Checkpoint — complete Markdown window and shared-session lifecycle

- Canonical uploaded Markdown Particles now lazily open the complete file in the existing content window. Reuse its motion, header portals, minimize/maximize and shared rich-text viewer. Copy preserves original source; Download uses the existing authorized endpoint. Unsupported Markdown remains fully available in source view. Other formats, Drive and roadmap/module notes retain their existing owners.
- The mounted reader coalesces requests, retains one scoped snapshot across hide/show, ignores late responses after close, and clears the file on account change. The server returns its verified viewer ID with the snapshot; the client checks it before display. Strict Mode effect replay retains the same reader without prematurely disposing it. Download is canceled on close/account lock and rechecks identity before navigation.
- Shared editor/session components now own one Yjs replica, encrypted journal and durable writer. Minimize pauses transport/work without reseeding the editor. Close awaits the exact recovery barrier and refuses newer undurable edits or storage failures. Draft acknowledgements never report canonical Saved. Account/access failures lock the retained session. Writable editing defaults off until versioned canonical Save exists; this component is not yet exposed as a writable production editor.
- Verification: 234 focused tests across 15 suites passed, covering lifecycle/retry/close, account switching and late responses, Strict Mode, download, CRDT/recovery, roadmap and Particle/header regressions. Scoped TypeScript, changed-file lint, boundaries and acceptance manifest checks passed. The existing workspace-particles public server export remains a separate feature-contract violation. No complete quality suite, browser/visual review or visual-baseline update was run; authenticated review remains user-owned. No SQL or canonical/provider content changed in this checkpoint. Port 3008 remains in the same lane.
- Graphify updated the full-root raw graph without community clustering: 22,046 nodes / 72,474 edges. Wiki/community reports were not regenerated. Existing test parser warnings remain separate from passing tests/types.

### Next reviewable milestone — canonical versioned Save/restore

1. Preserve the current file UUID and retain a recoverable prior version. Stage immutable storage content and validate current actor, full document schema, source revision and timestamp before an atomic metadata commit. Clean up failed stages and use stable receipts for safe retries.
2. Advance the verified canonical room prefix while preserving edits arriving during Save. Ordinary Save must retain the same Y.Doc/generation and must not reseed or disconnect peers. Draft persistence alone never advances canonical Saved state.
3. Revalidate metadata/source changes with narrow events and explicit actions, without full-room snapshot subscriptions or polling. Rebind recovery revisions only through a verified same-generation canonical receipt; restore/new generations require explicit recovery handling.
4. Add version selection/restore and recovery-choice UI, then enable the existing shared editor only after save, conflict, failure and two-user/revocation checks pass. Browser checks remain separately required before claiming multiplayer completion.
5. Continue source/HTML fidelity, CSV, Word and Drive adapters through their existing staged scopes. Retain safe link cards; the disabled metadata provider still needs its approved replacement.


## Checkpoint — canonical version transaction and verified server export

Implemented locally; the new migration is **prepared, not applied**. Existing Markdown windows remain read-only. No canonical/provider file or production account was changed.

### Data and commit contract

- `20261014223000_version_uploaded_document_saves.sql` introduces `document_file_versions` and private `document_version_operations`. Both force RLS. History reads inherit current canonical-file access; clients cannot write either table or invoke service-only commit/staging functions.
- Each explicit Save exports a fixed, durable Yjs prefix on the server. It validates the ProseMirror schema, 5,000-node/1 MiB budgets, safe link/image addresses and semantic Markdown round trips. No caller-provided whole-file content is accepted. BOM is retained. Unsupported formatting is rejected visibly rather than stripped.
- Save stages new immutable private bytes. First Save also stages a verified copy of the original content; later Saves retain already recorded versions. The existing file UUID/title and canvas references remain unchanged. SQL atomically records history, switches the private object reference, advances only the chosen canonical sequence and returns a stable request receipt. Concurrent later draft updates and the same room generation remain intact.
- Restore verifies the selected version's byte length/hash, retains its exact original bytes, validates its rich-view seed and atomically creates a new generation. It refuses to discard any unsaved shared draft. Retries return the original receipt without another upload or generation reset.
- Reservations bind actor, source revision/timestamp, generation, prefix, content hashes, size and restore identity. Service-only staging prevents client overwrite races. Shared org locking fences commit against cleanup: cancellation tombstones the operation before Storage deletion. A committed operation cannot be abandoned. Lost/unknown outcomes preserve the same request for retry; failed deletion/completion retains its byte reservation.
- Bounds: at most eight unresolved stages/file, 32 MiB unresolved staging/org, 64 MiB version metadata-declared bytes/org, and at most 50 version records/file. Existing ordinary-upload quota now includes retained history. No automatic history deletion, polling, per-keystroke serialization or provider write is added. Save's service-client HTTP requests have a 15-second timeout; ordinary admin clients retain their previous behavior.

### Verification

- 269 tests / 20 focused suites passed, including the real isolated PostgreSQL RLS/receipt/quota/restore matrix and simultaneous Saves. Additional commit-versus-cancel race coverage passed in the four-test SQL suite. SDK-mocked storage tests prove reservation/deletion/completion ordering and failure capacity retention. Source scope, stale metadata, retry identity, exact BOM and unsafe/lossy export checks pass.
- Full migration applies from the marker-protected fixture's fresh schema; both SQL matrices and empty-state rollback pass. `supabase/rollbacks/20261014223000_version_uploaded_document_saves.sql` refuses populated history/reservations. For populated installations, disable the writable rollout and retain schema/data rather than destructively reversing it.
- Evidence: `/tmp/particle-document-version-{regression-final,race-tests,fresh-schema,types-final,lint-final,boundaries,manifest-check}.log`. Local checks do not establish provider deployment or live browser multiplayer behavior. Port 3008 is preserved. Existing workspace-particles server-export guard failure remains outside this slice.

### Next implementation sequence

1. Integrate trusted, monotonic canonical receipt advancement into active peers while retaining the same Y.Doc on Save. Rebind encrypted recovery scope only through a verified same-generation receipt. A restored generation must lock old editors and offer explicit recovery.
2. Add compact Save/status and version-list/Restore controls to the existing window header. Retain drafts, request IDs and errors across hide/show/retry; await native outbox and local durability barriers before choosing a Save prefix. Do not label merely acknowledged draft operations Saved.
3. Complete version-aware permanent file purge and bounded abandoned-stage reconciliation. Current history protections deliberately block the old purge path from destroying recorded bytes. Unknown outcomes must be reconciled under the same reservation fence, never deleted speculatively. Preserve the existing 30-day Recently Deleted behavior.
4. Only then apply the reviewed new migration and enable writable rollout for an authenticated two-user Save/reconnect/revocation/restore canary. The already-applied room migration is separate and remains unchanged.
5. Continue the saved source/HTML, CSV, Word and Drive stages. Safe link metadata and coach/direct-session authorization parity remain explicit prerequisites for their respective rollout scopes.

Engineering references: immutable uploads use the [official Supabase Storage contract](https://supabase.com/docs/guides/storage/uploads/standard-uploads); commit/cancellation coordination follows [PostgreSQL explicit locking](https://www.postgresql.org/docs/current/explicit-locking.html). These references support the mechanism, not a claim that this feature is deployed.


## Checkpoint — applied versioning and canonical peer advancement

- Applied the authorized version migration and a small metadata-notification migration; [receipt](2026-10-14-document-version-migration-receipt.md). Preflight caught and preserved the newer deployed policy-upsert quota fix. Added a real SQL regression at the storage cap, passed a fresh-schema/rollback run, and verified exact-source history, forced RLS, grants, private operation tables and notification publication. No user files or account permissions changed.
- Active peers can now validate a narrowly queried canonical version receipt and merge a new saved revision into the same Y.Doc. Missing/mismatched receipts, backwards sequences, external source changes and restored generations block without dropping local operations. INSERT hints are document-filtered, coalesced, canceled when hidden and never trusted as proof; no full checkpoint subscriptions or idle polling. The transport option remains off for legacy consumers until the new file-window owner opts in.
- `openDocumentEditor` verifies the actor once and returns the original generation revision as the recovery anchor. That source anchor stays fixed across ordinary Saves; Restore changes generation. This intentionally replaces per-Save recovery revision rebinding with a simpler generation-stable scope. Existing encrypted entries and immutable retry IDs need no rewrite merely because the canonical file reference advances. The anchor is read from authenticated sequence-zero history, or the room's original revision before its first Save.
- The retained canonical command flushes local durability/native batches, captures a fixed server prefix, preserves late edits as dirty, enforces one operation in flight and retries unknown results using the exact request ID/prefix. Confirmed failures can start a new request. Restore refuses dirty shared work, validates the new-generation receipt and pauses the old owner for an explicit reopen/recovery step.
- Added an optional compact Save/Retry control to the existing shared editor header, using shadcn Button, inherited focus/target sizing and reduced-motion loading. It reports canonical pending/error state separately from native draft acknowledgements. The current visible file-window loader still opens read-only; no public writer was enabled or fake Save wired into that surface.
- Verification: 285 focused tests / 23 suites passed, including actual PostgreSQL/RLS, concurrent commit/cancel, policy replacement at quota, peer receipt validation, unchanged replica/outbox, exact retry IDs, late edits, stable generation anchors and SDK event coalescing. Scoped TypeScript, changed-file lint, boundaries and acceptance manifest checks passed. Browser appearance/two-user review remains separate. Existing public workspace-particles server export is still an unrelated feature-contract failure.

### Next concrete slice

Connect the retained shared file-window owner to the real canonical command and version picker; complete version-aware permanent purge and abandoned-stage reconciliation; then enable a bounded writable canary and run the user-owned two-user Save/restore/reconnect review. Keep CSV/Word/Drive and safe link metadata in the existing subsequent stages. Applied migration files are immutable; any further schema changes use a new version.

## Next execution plan — small tasks and decision gates

This section supersedes earlier execution ordering, not completed work or migration receipts. User direction: no long-running tasks; build a decision tree for each step. Plan only at this checkpoint.

### Execution rules

- Activate one implementation task at a time. Each task has one deliverable, one focused verification target and a checkpoint. If investigation reveals another dependency, split it into a named prerequisite rather than expanding the task.
- Independent agents may review contracts, tests or failure paths. Assign disjoint edits only when their prerequisites are complete; one owner integrates changes. No speculative parallel feature builds.
- Report the completed task, evidence and next branch. Show meaningful UI changes on localhost:3008 before expanding them. User-owned authenticated/visual review remains distinct from automated source checks.
- Preserve the existing window, full content, link cards, native multiplayer, file IDs and canvas references. Use existing motion/header/editor primitives; no new drawer system.
- Keep public writes disabled until cleanup and lifecycle gates pass. Applied migrations remain immutable. No migration replay, preview restart, provider file mutation or release is implied by this planning checkpoint.

### UI contract — required at every visible checkpoint

Authority: [workspace motion contract](../design/workspace-motion-contract.md), [node frame contract](../agent/workspace-node-frame-contract.md), [UI rubric](../agent/ui-rubric.md), and the user's later refinements in this workstream. Later explicit user direction takes precedence over older PRD examples or generic primitive defaults. These are implementation requirements, not a claim of completed visual verification.

**Particle anatomy and identity**

- Reuse `WorkspaceNodeFrame` and `WORKSPACE_PARTICLE_CHROME` (`src/components/workspace/workspace-particle-chrome.ts`). Current shared values are a 28px outer radius, 25px body radius, 32px compact header, narrow outer side inset and no shadow; these are existing tokens, not a new redesign. Coarse-pointer targets retain their larger accessible size.
- Title once, small unboxed icon, aligned compact header controls; no reintroduced type subtitle, generic Backlog badge or header divider. Keep footers compact and contextual. No duplicate library-tile title or metadata form above a file editor.
- Preserve the existing single top-right action menu on canvas cards. Add/drag/remove behavior stays with its current owner; do not multiply overlay buttons as editor features grow.
- Drawer/library preview, drag preview and canvas rendering reuse the same Particle content/shell. Do not maintain a decorative second implementation. Existing document-specific layouts remain valid: image content follows its intrinsic ratio with title below, no date or forced letterboxing; file previews stay compact and open complete content in the window.
- Canvas size family/container width controls preview information density; viewport zoom does not choose a family. Editor windows use their separate content-width hints. No fixed preview height that silently clips essential information or forces unrelated cards to resize.

**Concentricity and spacing**

- For an evenly inset rounded child following a parent contour, derive its radius from the parent radius minus the actual inset to that contour, accounting for borders. `child <= parent` alone is insufficient. For example, a 28px contour with a 3px inset gives a 25px child contour; this example does not assert that every existing inset is 3px.
- Where header/footer bands interrupt uniform insets, inspect each relevant corner and visible gutter rather than applying one radius subtraction to the entire card. Keep shared tokens as the starting point; any existing geometric mismatch becomes a small shared-owner correction, never a collection of per-file overrides.
- Full-bleed media, hover/selected surfaces and nested backgrounds follow their owning rounded contour without square corners protruding. Keep deliberate breathing room around toolbar buttons; hover fills must not touch the window edge.
- Clip content at the inner surface when needed. Leave connection handles, the action menu and keyboard focus indicators outside clipping. Do not add extra wrapper cards merely to achieve rounding.

**Motion and responsiveness**

- Reuse Motion (`motion/react`) through the existing window adapter and `WORKSPACE_SURFACE_MOTION`/`WORKSPACE_WINDOW_MOTION`. Current shared policy: spring 600/50/1, 160ms entry opacity, 120ms exit opacity, 0.985 closed scale and 12px vertical travel. Do not scatter independent spring/duration values through editors or call these Apple constants.
- Open/close and maximize/restore preserve one editor/session/portal tree. Retarget interrupted transitions; ignore obsolete completions. Accept tab intent immediately and render the selected tab directly, without briefly showing the previously opened tab.
- Use transforms/layout projection and opacity, not per-frame React layout state, animated CSS width/height, `transition-all`, blur animation, new shadows or permanent compositor layers. Correct projected child layout so text/caret do not stretch; do not animate document layout while typing.
- Preserve the existing direct drag handoff and pointer offset; no duplicate scaled card design or network wait before placement feedback. Treat smooth 60fps interaction as a measured target, not a promise for every device.
- Reduced motion settles immediately through the shared policy, including preference changes mid-transition. Hidden views pause unnecessary work. Loading skeletons match the final layout; loading/error/success feedback never remounts the editor or moves controls unnecessarily.
- Floating window stays detached above the content-sized dock; no new bottom attachment, oversized dock, sidebar or second drawer system. Constrain prose/table windows to their content and available canvas bounds; preserve maximize/restore.

**Interaction and review gate**

- Keep focus-visible keyboard indicators; ordinary pointer use must not leave a stuck focus outline. Small visible controls retain accessible hit areas (at least 24px fine pointer, 44px coarse pointer) without increasing the visual chrome unnecessarily.
- Native editing, tables, menus and local scrolling must not drag a Particle or pan/zoom the canvas. Preserve draggable noninteractive card regions and existing connection/selection behavior.
- Every visible task checks only its affected states: geometry/corner fit, spacing, preview identity, appropriate loading/error state, interrupted motion and reduced motion. Check responsive/themed variants relevant to that change; record user review separately from automated checks. Do not postpone these requirements to a final redesign pass or start a long unrelated visual audit.

### Decision tree

```text
0 contract checkpoint → 1 retained owner → 2 recovery discovery → 3 recovery choices → 4 lifecycle
  → 5 gated action → 6 Save header → 7 history → 8 Restore
  → 9 path inventory → 10 cleanup schema → 11 deletion fence
  → 12 purge → 13 stage reconciliation → 14 readiness review
  → 15 restricted two-user writable validation
       ├─ failure: retain drafts, disable rollout, fix only the failed gate
       └─ pass: decide broader activation, then choose one later milestone

At every step:
  prerequisite missing? → create a bounded prerequisite task; do not widen scope
  focused check fails? → fix that task; do not advance
  visible change? → show the checkpoint before expanding the UI
  check passes? → record evidence; next numbered task
```

### 0. Confirm the existing integration contract

- **Deliverable:** a short source-backed map of stable file/session identity, full-file/link fidelity, current authorization and Save versus Restore generation behavior. Reuse the implemented backend.
- **Check:** identify the exact existing owners and action contracts; record only gaps affecting the next task.
- **Branch:** contract mismatch → one bounded prerequisite fix; established contract → 1. No broad architecture rewrite.

### 1. Retain the shared owner in the existing file window

- **Entry:** existing complete read-only reader and shared-session contracts.
- **Deliverable:** one actor/org/file/generation owner for the replica, transport and recovery store. Mount the shared editor read-only; preserve the current full-source fallback. No writable action yet.
- **Check:** hide/show retains the same owner; a late response cannot populate a different file/account.
- **Branch:** unsupported content keeps the complete source view; identity mismatch locks and clears display; success advances to 2.

### 2. Discover recoverable drafts safely

- **Deliverable:** account/file-scoped recovery lookup, separating current-generation records from older generations. Add an IndexedDB upgrade only if the existing index cannot support bounded lookup.
- **Check:** no cross-account enumeration; no silent overwrite; ordinary Saves keep the stable recovery anchor.
- **Branch:** no records → ordinary open; records → 3; corrupt/unreadable records → preserve them and expose a recoverable error.

### 3. Add explicit recovery choices

- **Deliverable:** compact recover/keep/export/discard choices within the existing window. Explain which file/session a draft belongs to without exposing storage paths.
- **Check:** discarded records require deliberate choice; older-generation updates never auto-apply. Prove a supported recovery/export path before offering it.
- **Branch:** recoverable current generation → resume its native draft; stale/incompatible generation → retain/export without merging; unresolved choice blocks editing.
- **Task boundary:** implement the choice shell, export and discard as separate substeps, each verified before the next. Do not batch them into one task.

### 4. Close, minimize and account lifecycle

- **Deliverable:** close awaits exact durable recovery; minimize pauses work and keeps the owner; account/access changes lock the correct session. Retain unknown in-flight request identity through lifecycle changes.
- **Check:** storage failure prevents destructive close; hide/show does not reseed; late Save/Restore results cannot affect another file.
- **Branch:** durability confirmed → close; failure/newer undurable edits → remain open with Retry. Show this lifecycle checkpoint before adding controls.
- **Task boundary:** verify minimize first, explicit close second, account/access lock third. Each is its own checkpoint.

### 5. Expose the gated canonical action

- **Deliverable:** serializable, runtime-validated public action around the existing Save/restore service. Verify current actor, file rights, entitlement and rollout server-side; never accept an SDK instance or caller-authored file bytes.
- **Check:** authorized/unauthorized/revoked/disabled cases; exact retry receipt. Resolve coach-session versus direct-RLS parity for any account included in rollout.
- **Branch:** unsupported authorization mode stays read-only; valid enabled calls use the existing backend; disabled calls fail without changing content.

### 6. Connect compact Save/Retry controls

- **Deliverable:** wire the retained canonical command into existing header slots, title once. Distinguish durable draft sync from canonical Saved; preserve edits arriving after a captured Save prefix.
- **Owner binding:** connect editable capability to the retained shared session only inside the disabled-by-default test scope; local and peer changes use the same native document. Opening the ordinary public window remains read-only until activation.
- **Check:** one operation in flight, exact unknown-outcome retry, no file serialization per keystroke, no idle polling. Keep real writes gated.
- **Branch:** known failure retains draft; unknown outcome retries the same request; success marks only the committed prefix saved. Show header/status UI.
- **Task boundary:** owner/editable-capability binding, Save control and Retry control are separate short substeps.

### 7. Add version listing and viewing

- **Deliverable:** compact Versions control with locale timestamps, current-version identification and complete selected-version viewing. Original source remains downloadable.
- **Check:** current authorization applies to history; selected-version bytes are validated; viewing does not replace the active draft.
- **Branch:** no history → clear empty state; failed read → retry in place; valid selection → preview, then 8.
- **Task boundary:** finish listing before adding full-version viewing.

### 8. Connect explicit Restore

- **Deliverable:** confirmation, existing canonical Restore command and a deliberate new-generation reopen. Peers retain old-generation recovery rather than silently losing work.
- **Check:** dirty shared draft blocks Restore; lost receipts retry exactly; successful Restore does not reapply old native operations.
- **Branch:** pending edits → retain them and explain the block; confirmed Restore → reopen new generation; unknown result → reconcile before another operation. Show Save/history/Restore together, still gated.

### 9. Account for every owned storage object

- **Deliverable:** inventory current bytes, original pre-first-Save path, historical versions and unresolved staged uploads for one canonical file. Identify the exact missing durable path metadata before proposing schema.
- **Check:** first Save, later Save, Restore and failed staging all have a traceable ownership path; unrelated org/file paths are excluded.
- **Branch:** existing metadata sufficient → no schema addition; missing metadata → 10. Do not delete anything during inventory.

### 10. Add only necessary cleanup metadata

- **Deliverable:** additive migration and rollback/disable strategy for missing path accounting and durable cleanup receipts, based on 9. Keep applied migrations untouched.
- **Check:** isolated fresh/upgrade schema, RLS/service grants, retry identity and populated-data rollback protection.
- **Branch:** tests fail → revise locally; pass → review exact target/source before applying the specific migration. No all-pending migration push.

### 11. Fence permanent deletion against editing

- **Deliverable:** authorized, idempotent deletion reservation that prevents Save/Restore or delayed staging from reviving or changing a file while its bytes are being purged.
- **Check:** concurrent Save/Restore versus deletion; lost response; repeated request; committed stages cannot be abandoned.
- **Branch:** active/unknown operation → reconcile without deleting bytes; confirmed deletion ownership → 12.

### 12. Integrate version-aware permanent purge

- **Deliverable:** replace the old current-path-only purge for versioned files. Delete only the exact reserved object set, then complete metadata/quota accounting with durable receipts. Preserve Recently Deleted and its existing 30-day behavior.
- **Check:** partial Storage failure retries safely; retained versions/self-references are handled; current and historical bytes are accounted for before completion.
- **Branch:** partial failure → keep receipt/reservation and retry; complete confirmation → release quota and finalize. Never claim deletion from a metadata-only success.

### 13. Reconcile abandoned stages in bounded batches

- **Deliverable:** resume unresolved staged/abandoned operations using existing reservation fences. Limit work per invocation and retain a continuation receipt. Choose the existing suitable cleanup trigger after inspecting it.
- **Check:** delayed upload, unknown commit, repeated cleanup, deletion failure and operation budgets. No every-open scan or continuous polling.
- **Branch:** committed → preserve object; safely abandoned → remove/confirm; unknown → retain and retry later. Capacity is released only after confirmation.

### 14. Review readiness for one writable Markdown scope

- **Deliverable:** a short evidence checklist for tasks 1–13, exact rollout scope and disable switch. Resolve format/link capability blockers affecting that scope; preserve unsupported files as full read-only sources.
- **Check:** focused auth/lifecycle/Save/recovery/restore/cleanup checks and relevant existing regressions. Separate the existing unrelated feature-export guard failure from this slice.
- **Branch:** any data-loss/access/cleanup blocker → keep read-only and name the next small fix; pass → 15. Local tests are not live multiplayer proof or a release.

### 15. Restricted two-user writable validation, then activation decision

Enable only the explicitly scoped test file/accounts needed for validation; ordinary writable activation remains off. Perform these as separate short checks, not one long browser task:

1. Open one supported test file; edit/Save/reload; verify the same file ID and retained prior version.
2. Two users edit together; verify convergence and edits arriving during Save remain dirty.
3. Disconnect/retry; verify exact receipts and retained draft. Then check minimize/reopen separately.
4. Restore a saved version; verify peers handle the new generation and pending edits are preserved.
5. Check account/access changes and Recently Deleted/purge failure recovery separately.
6. Review affected header/editor states, keyboard access, both themes and reduced motion. Measure actual requests; no unsupported speed/cost claims.

For each: failure disables the affected test scope and creates one focused repair task; pass records the evidence and advances. Only after the two-user checks pass should broader activation be proposed. User owns authenticated/visual review. Any shipping step separately requires current-head CI/review and the repository release gates.

### Later milestones — expand only when selected

Do not start these in parallel with unfinished Markdown integration. Before each milestone, write its own small-task decision tree in this document:

- **Markdown fidelity/link metadata:** round-trip fixtures → explicit format capabilities → safe metadata provider → preserved link previews. Never silently strip unsupported content or reactivate the disabled arbitrary-URL fetcher.
- **CSV:** exact-string/dialect fixtures → complete Tiptap table view → native shared cell edits → versioned Save → user checkpoint. Preserve BOM, quotes, newlines, empty cells and order; no implicit type conversion.
- **DOCX:** representative import/export fixtures → supported-feature contract → complete editor → verified round trip → versioned Save. Unsupported features retain the original; legacy `.doc` needs its own verified conversion decision.
- **Drive stored files:** existing OAuth/ownership audit → revision-aware read → provider conflict contract → binary file write-back → external-change refresh → request-budget review. Drive stays canonical; no duplicate durable file store or periodic hidden-editor work.
- **Native Google Docs/Sheets:** separate structured provider adapters after binary-file synchronization is proven. Never overwrite a native document using an exported snapshot as if it were the original format.

Generative UI and expanded People/Metric/Finance work remain deferred.

## Checkpoint — tasks 0–1: contract and retained read-only shared owner

Verified integration ownership:

| Concern | Existing owner / boundary |
| --- | --- |
| Canonical identity and complete saved bytes | `DocumentSource`/`documentSnapshotSchema`, authorized file loader; stable org/file UUIDs, no graph payload copy |
| Native draft and Save generation | `createDocumentEditorSession`/`createDocumentRoomSync`; ordinary Save retains Y.Doc/generation, Restore requires a new generation |
| Current account | `createAccountScopedFileReader`; verified server viewer must match observed SDK identity before publishing |
| Existing shared-room delivery | `createSupabaseDocumentTransport`; direct session RLS, room-filtered deltas and verified version hints, pause when hidden |
| Complete content, links and unsupported Markdown | Existing rich editor/Markdown worker/source fallback; no new converter, link provider or lossy Save |
| Window presentation | Existing header slots, retained window and shared Motion policy; no duplicate surface or new animation |

Implemented `documentWindowSchema` and `createDocumentWindowOwner`. Explicit open reads the complete saved source and discovers an existing room through the real session client. It never bootstraps a room or elevates coach-scoped saved-file access into direct room access. Missing rooms retain the full saved view. Unavailable/stale rooms are explicitly labeled; initial browser transport failure also falls back to saved content with Retry. Once direct shared access is established, revocation locks both the live view and saved-source actions.

Existing shared rooms use the same read-only session/replica across minimize/reopen and Strict Mode replay. Account changes clear both views; late/mismatched results cannot create a session. Copy explicitly copies the saved source; Download remains the original authorized endpoint. No room initialization, IDB record, recovery replay, canonical/native write, provider mutation or new migration is enabled by this task.

Focused verification: 104 tests / 7 suites pass, covering retained ownership, account/late-result isolation, fallback/retry, established access revocation, existing session/sync behavior and Particle/header regressions. Scoped TypeScript, changed-file ESLint, import boundaries and diff hygiene pass. No browser/visual or live multiplayer approval is implied. Listener 3008 remains the original process in the correct worktree.

Next task is **2: scoped recovery discovery**, then its separate choice/export steps. Full writable close/recovery handling and new-room initialization remain gated; the read-only owner is not a substitute for those tasks.
