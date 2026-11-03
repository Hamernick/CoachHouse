# Document editing

## Ownership

- `lib/**`: validated source/snapshot contracts, bounded complete UTF-8 decoding, the Markdown adapter and a Yjs replica with an acknowledged outbox.
- `server/**`: explicitly requested, authenticated canonical-file reads. Existing organization access and private storage remain authoritative.
- `components/**`: complete-content read surface reusing the roadmap rich-text editor. Consumer lazy loading and active-window state are required.
- Public imports use `@/features/document-editing` or `/client`. Route files remain composition only.

## Current checkpoint

Uploaded `.md`/`.markdown` Particles preview the complete canonical source before explicit Edit. Current direct file permissions and the faithful Markdown adapter determine whether Edit appears. The existing durable native session now connects Save/Retry, version history, confirmed Restore and explicit local recovery choices. Other formats, unsupported Markdown and provider files remain read-only through their existing owners. No PDF/Word conversion, provider writes or per-plan source copies are introduced. This is local qualification; hosted rollout still requires the authoritative Particle execution checkpoint and release gates.

Uploaded Markdown is loaded completely up to 1 MiB; oversized/invalid UTF-8 files are rejected rather than truncated. Bytes, BOM and original source remain available. Markdown parsing runs in a cancellable worker (15-second timeout, provisional 5,000-node rich-view budget). Simple Markdown parsing covers headings, lists, links, images, code and tables. HTML/task lists/footnotes require the source/HTML adapter; unsupported input falls back to complete source display. A semantic parse/serialize check rejects loss of unsupported nodes, marks or attributes. CSV/Word/Drive adapters remain pending.

## Editor and cost boundaries

The shared editor's opt-in session mode keeps the native document authoritative and invokes a native transaction callback without full HTML serialization per keystroke. Existing controlled roadmap consumers retain their behavior. Formatting/history controls subscribe narrowly; counters/link discovery run after a 300ms pause and stop when inactive. Local history is disabled when a supplied collaboration extension owns undo; a collaborative session without that extension is rejected.

Link cards remain. File-session metadata requests use an instance-local queue: at most three concurrent requests, 64 attempts per mounted session, 10-second timeout, no automatic retry timer. Unchanged URLs are deduplicated, hidden views abort work, and a 410 response stops further requests. The existing link-preview endpoint currently returns 410; restoring safe metadata fetching is tracked in the plan, not silently replaced with an arbitrary URL scraper. Roadmap request behavior is unchanged.

## Verification

Acceptance coverage includes document editing/access, writable owner, native session, canonical versions, recovery storage and Realtime transport suites. The isolated authenticated Next canary covers two different authorized users, live native delivery, a fixed Save prefix with later edits preserved, canonical Save/reopen, exact original-byte Restore, retained offline edits, previous-generation Markdown export and account-change locking. Existing database permission/concurrency evidence remains separate from hosted or production acceptance.

The CRDT foundation merges concurrent updates idempotently, suppresses remote echo and retains outgoing updates until durable acknowledgement. The authorized checkpoint seeds the collaborative editor once. Realtime bytea is normalized from bounded bare hexadecimal into the same strict representation used by PostgREST reads; identity, sequence, byte limits and native validation remain unchanged. Both document updates and version INSERTs must belong to the configured Realtime publication.

## Durable uploaded-Markdown rooms

`20261014213000_add_document_collaboration_rooms.sql` adds a canonical-file-linked room and update ledger. Canonical file RLS controls reads; current paid owner/admin/staff/developer access controls writes. Canvas invitations do not broaden file permissions. Bootstrap and compaction are service-only; ordinary clients cannot modify the tables directly or supply an actor ID for append. Existing coach proxy scopes need explicit SQL/direct-session parity before those users are enabled; do not assume service-role reads grant a browser realtime access.

Server open/compaction actions verify current file access. A new source is parsed and seeded once into a Yjs fragment; existing rooms avoid downloading/parsing the canonical file again. Generation and source metadata guard stale writes; archived hashes preserve bounded retry receipts. Compaction only commits a verified complete prefix through sequence CAS. `canonical_sequence` remains unchanged by draft persistence/compaction; working drafts are not labeled as canonical Saved files.

Client reads are scoped to organization/file, one generation and contiguous tail pages of 100, with 15-second timeouts. Binary checkpoints/updates are decoded and validated before applying. The database stores bounded opaque recovery bytes; it is not a ProseMirror schema validator. Full document schema/export validation remains mandatory at canonical Save. If the ledger is malformed, stop/recover visibly rather than dropping a row or committing a damaged file.

The writer coalesces a 750ms pause with a 2-second continuous-edit deadline, permits one in-flight write, suppresses redundant state callbacks, pauses hidden views, retains failed/prepared edits and requires explicit retry after failure. No idle retry loop, no Vercel action per transaction and no provider write until canonical Save. Bounds: 128 KiB/update, 2 MiB/checkpoint, 8 MiB/512 uncheckpointed updates per room, 64 MiB total checkpoint/recovery bytes per org. Compaction retains up to 2,048 covered receipts for up to 72 hours; older pending batches require state reconciliation.

The migration was explicitly authorized, applied and schema-verified on the configured shared Supabase project on 2026-10-14. See the [application receipt](../../../docs/plans/2026-10-14-document-room-migration-receipt.md). Existing profile-backed core-document collaboration has a different owner; these rooms reference uploaded library files, not roadmap sections.

## Live transport and local recovery

`createDocumentRoomSync` subscribes before reading a fixed checkpoint/tail, buffers early INSERTs, deduplicates/reorders receipts, and fills gaps on reconnect. Compacted recovery merges into the same replica, preserving local edits. Reads are document-scoped; source/generation changes fail closed. One fresh-checkpoint retry covers compaction races. No polling interval, idle refresh or public browser broadcast as authoritative content. `createSupabaseDocumentTransport` uses the existing authenticated client, one room-filtered INSERT subscription, current file metadata and edit-permission rechecks. Account changes unsubscribe and lock the session; delivered rows and RPC writes remain subject to current database permissions.

`openDocumentRecoveryStore` verifies the account, locks on auth changes, and stores AES-GCM-encrypted native outbox bytes in IndexedDB. Nonextractable account keys are chosen atomically across tabs; additional authenticated data binds account/org/file/generation/session/revision. Encryption is not an XSS boundary. IndexedDB v2 adds an account/org/file index without changing existing v1 encryption identities. Same-generation recovery requires an explicit choice and retains the previous record until the new journal is durable. Different generations are export-only and never replay automatically. Each generation permits 20 records and each file 40; export preserves records, so reaching the limit requires recovering/removing current records or device-storage management. No automatic draft deletion is introduced.

The local journal coalesces edits after 100ms, with a 250ms maximum wait. It retains the exact prepared retry ID and edits arriving afterward, pauses on quota failures, and refuses close if newer edits are not durable. A crash before its local transaction completes can lose the newest keystrokes; user-initiated close/Save must await the durability barrier. `createRecoverableDocumentRoomWriter` persists that barrier before the server RPC; storage failure sends nothing. Durable acknowledgement releases only the matching prepared prefix and schedules recovery-record cleanup. Remote updates do not restart the local write deadline.

## Window and session lifecycle

The preview owner retains a scoped reader across hide/show and coalesces opens. The server returns the verified viewer with its snapshot; account change/logout clears content and cancels downloads, and late responses are ignored. Explicit Edit creates a separate retained writable owner only after current authenticated authorization. Close awaits the encrypted journal barrier; failed persistence keeps the in-memory draft. Particle navigation receives dirty state through its existing close guard. Strict Mode effect replay does not duplicate or destroy the owner.

`createDocumentEditorSession` owns the replica, encrypted journal and durable writer. The shared editor uses the existing rich-text component and collaboration extension without plain per-client seeding. Minimize pauses active work while preserving the replica. Explicit close awaits durable local recovery and rejects storage failure or edits arriving after the barrier. Account/access lock hides previous content and disables retry into another account. Native transactions publish narrow session status; remote events do not reset local write deadlines. Draft acknowledgements never report canonical Saved.

`allowEditing` still defaults false; only the explicitly authorized writable owner enables it. The editor retains later native edits across ordinary Save. Restore requires a clean durable room, creates a new generation and pauses old sessions. Previous-generation local drafts are offered for download when reopening; complete snapshots export faithful Markdown, or full ProseMirror JSON when Markdown would lose structure. Older records without a snapshot are honestly labeled native recovery data. Each of the batch, tail and optional full snapshot remains bounded to 2 MiB; encrypted records are capped at 9 MiB. Full snapshots are stored only while unsaved edits exist. Metadata, provider, CSV and Word capabilities retain their own boundaries.

## Isolated SQL verification

Use a dedicated PostgreSQL cluster with `coach_house.document_room_fixture='isolated-test-only'`, the fixture/schema/migration applied, and a nondefault loopback port. `DOCUMENT_ROOM_TEST_PORT=<port> pnpm exec vitest run --config vitest.config.ts tests/acceptance/document-collaboration-database.test.ts` runs the real RLS/receipt/recovery matrix and simultaneous initializer/writer tests. It refuses default port 5432, remote hosts and unmarked databases. Without this explicit port the SQL suite skips; a skip is not RLS evidence. Never load application/provider credentials into this fixture.


## Canonical version Save/restore substrate

The existing version adapter and immutable uploaded-document migrations now serve the authenticated Save action. Version-list actions return only display metadata and version identity, never private Storage paths or request contexts. The application keeps unsupported sources read-only. Canonical metadata notifications use `20261014233000_publish_document_versions.sql`; migrations are not rewritten.

`commitDocumentVersion` verifies the current actor/file rights, reconstructs a fixed durable Yjs prefix, validates schema/URLs/round-trip fidelity and stages immutable UTF-8 bytes. First Save captures an independent original-byte copy. SQL retains prior versions, atomically updates the existing canonical file reference and advances only the selected room prefix. Later native edits and ordinary Save generation remain intact. Restore validates exact historical bytes, refuses unsaved shared work and creates a new generation. Stable request receipts fence retries and preserve the same file UUID.

Private reservations precede Storage IO. Authenticated clients cannot write the reserved directory or operation/history tables. Commit and abandonment share an org lock; cleanup must tombstone an uncommitted operation before service-role deletion. Unknown outcomes retain their request and bytes. Deletion/completion failures retain reserved capacity. Limits: eight unresolved requests/file, 32 MiB unresolved stages/org, 64 MiB history/org, at most 50 history records/file. Ordinary upload quotas include history. Version service requests use the existing admin factory's optional 15-second request budget; other consumers are unchanged.

`readLocalDocumentWithLocation` keeps private paths server-side. The versioned adapter matches the actual canonical path and source timestamp, verifies its hash and returns the recorded opaque revision. Existing read-only loaders do not query the version table.

Version-aware permanent purge and bounded abandoned-stage reconciliation are supplied by `server/file-cleanup.ts` and migration `20261103280000_document_file_version_cleanup.sql`. They preserve the 30-day Recently Deleted window and fence delayed uploads, canonical Save/Restore, immutable originals and referenced history. Cleanup releases reserved capacity only after confirmed Storage removal; unknown outcomes retain bytes. The isolated SQL/concurrency and actual Storage/route proof qualify this dependency locally. Hosted scheduling, deployment and release acceptance remain separate.

The marker-protected SQL fixture models Storage metadata and deliberately permissive legacy object policies to test restrictive history/staging rules. Load the required library, room, version and cleanup migrations into a disposable fixture before running the applicable database suites. They include concurrent Save and commit/cancel races. Do not load application/provider credentials into these fixtures.


## Canonical advancement and retained commands

A transport can opt into document-filtered version INSERT hints. Hints coalesce and trigger an authenticated current receipt read; their payload is never authority. Verified monotonic canonical updates merge into the same replica without replacing native state or the outbox. External changes, mismatched receipts, backwards sequences and restored generations block safely. Legacy transport consumers keep their existing behavior. Large room snapshots remain unpublished.

`openDocumentEditor` verifies actor/file access once and supplies `readGenerationAnchor`: the original sequence-zero source revision for that generation. Local recovery remains scoped to that stable anchor across ordinary Saves; Restore creates a different generation and cannot replay old updates automatically. No re-encryption/rekey on every Save is required.

`createDocumentCanonicalWriter` owns one canonical operation/request at a time. It flushes native/local durability, captures a fixed server prefix, validates receipts, preserves later edits as dirty and retries unknown outcomes exactly. The existing window header owns Save/Retry; version controls require explicit confirmed Restore. Ordinary saves preserve file UUID and shared generation. Restore changes generation and reopens the authoritative source while older local changes remain explicitly exportable.
