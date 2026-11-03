# Organization closure: isolated restore replay

**Deferred from current MVP — explicit user decision, November3.** This is archived follow-up guidance, not an active continuation task or current release blocker. Preserve its code/evidence; do not provision independent storage, run hosted restore drills or resolve recovery-only operator privileges unless explicitly reopened. Organization closure remains unavailable. Normal live authorization/revocation and AI run/save recovery remain required. [Current scope decision](../plans/2026-10-27-particle-system-execution-spec.md#mvp-scope-decision--recovery-deferred-november-3).

This operator-only procedure qualifies one local recovery mechanic: replay a
supported closing snapshot through existing shutdown triggers while the restored
database cannot accept new connections. It does **not** authorize reopening,
closure activation, deletion, or a production restore.
Managed hosted operator privileges, connection controls and restore behavior
remain unqualified; this procedure assumes actual local PostgreSQL superuser
authority.

## Prerequisites

- The backup contains migration `20261103080000` and its original private
  `organization_restore_identity.source_id`. Older backups require separate
  reconciliation; do not generate a new identity to make evidence match.
- A trusted operator has independently retained and pinned the exact suppression
  manifest bytes and their SHA256. The source identifier must match the backup.
  A digest authenticates neither the supplier nor completeness/freshness.
- Independent durable suppression capture, backup/object-history retention,
  provider credentials, revoked grants and response-deletion history still need
  qualification. A current-closing snapshot alone misses canceled closures and
  deleted responses. An empty or incomplete snapshot cannot clear these gates.
- Use an isolated target and one existing superuser connection. No application,
  worker, provider, replication consumer, or other database session may attach.
  This is an offline operator boundary, not an application privilege.
- Keep `session_replication_role=origin` and all eight canonical closure
  shutdown triggers enabled. Replay rejects missing/disabled hooks rather than
  bypassing them during bulk recovery.

## Procedure

1. Produce a trusted **plain SQL** data/schema dump without `--create`, database
   switching, or reconnection commands. Keep source and target separate. Do not
   dump secrets into task logs.
2. Connect once to the empty isolated target using `psql -X -v ON_ERROR_STOP=1`
   and keep that operator session open. From a separate connection to the
   maintenance database, disable admission to the target **before** importing
   any backup data (PostgreSQL rejects disabling one's own current database):

   ```sql
   -- target_database is the exact isolated target name, supplied by the operator.
   SELECT format('ALTER DATABASE %I ALLOW_CONNECTIONS false', :'target_database') \gexec
   ```

   Independently verify a new connection to that target is denied. Any other
   existing backend or prepared transaction blocks replay; do not reconnect to
   run the import. Do not use `pg_restore -d` after disabling connections.
3. Import the trusted plain SQL dump using `\i /absolute/path/backup.sql` in the
   still-open operator session. Keep connection admission disabled throughout.
4. Load the independently retained manifest into a psql variable and call the
   private function with the independently pinned digest. Quote the psql value
   as a SQL literal; do not interpolate JSON into SQL syntax:

   ```sql
   -- suppression_manifest and pinned_sha256 are supplied by the trusted operator.
   SELECT public.replay_organization_closure_suppression(
     :'suppression_manifest', :'pinned_sha256');
   SELECT datallowconn FROM pg_database WHERE datname=current_database();
   ```

5. Independently inspect the restored closure deadlines and applicable public
   admission/grant/queued-work state, plus preservation of other organizations
   and shared identities. Keep this evidence with the backup and manifest.
   Do not include raw answers or credentials in the receipt.
6. Leave the target quarantined. Success returns `quarantined: true` and
   `releaseQualified: false`; it provides **no** reopening command or authority.
   After operator disconnection, ordinary connections remain denied.

## Manifest and supported outcome

The UTF-8 manifest is at most 1 MiB and contains 1–1000 unique organizations:

```json
{
  "format": "coach-house-closure-suppression-v1",
  "sourceId": "original-backup-lineage-uuid",
  "closures": [{
    "organizationId": "organization-uuid",
    "requestId": "original-closure-request-uuid",
    "revision": 1,
    "requestedAt": "2026-11-02T12:00:00Z",
    "exportUntil": "2026-12-02T12:00:00Z"
  }]
}
```

Replace example UUID placeholders with actual opaque identifiers. No additional
fields or answer content are accepted. UTC timestamps retain the original
720-hour deadline; replay never creates a fresh export window. A backup with no
closure history for the supplied organization receives that closing state and
its request receipt. Existing canonical triggers withdraw publication, grants
and queued effects; external files and shared identities remain untouched.

An exact existing closure is a no-op for shutdown triggers, not evidence that
missing or corrupted revocations have been repaired. Conflicting/canceled
history, unknown organizations, wrong source/digest, malformed entries, other
sessions and an open target are rejected. A failed statement rolls back all
replay changes; connection quarantine remains. Unsupported history and omitted
deletions remain unresolved even if supported entries replay successfully.

## Local suppression capture rehearsal

Migration `20261103090000` captures new canonical closure requests,
cancellations and explicit native response deletions in the same transaction as
their operation receipts. Events contain opaque IDs, revisions and timestamps;
never answers, actor identities or credentials. They have no cascading content
foreign keys and reject modification/truncation. Cancellation retains the prior
request event and its original deadline. This is capture, not history replay.

The counter and event commit together. Contention returns retryable `40001`
without a partial operation; retry the entire canonical operation with its
original operation ID. The private exporter returns the complete committed set,
at most 1,000 events/1 MiB, and rejects busy capture, missing hooks or gaps.
Overflow fails closed; this rehearsal does not implement an unbounded service.
Capture starts at installation. `historyRequiresReconciliation` always remains
true; existing receipts are not silently reconstructed as complete history.

The adjacent [operator collector](organization-suppression-capture.py) copies
that bounded set to a private SQLite file outside the source database backup.
It uses only Python's standard library and `psql`, supports password-free local
PostgreSQL URLs, and never changes the source. Supply the independently checked
source UUID and an absolute journal path inside an operator-owned directory
with mode `0700`; the journal itself must be mode `0600`:

```sh
python3 docs/agent/organization-suppression-capture.py \
  --source 'postgresql://127.0.0.1:55439/explicit_source_database' \
  --journal '/absolute/private-directory/suppression.sqlite' \
  --expected-source-id 'independently-checked-source-uuid'
```

Replace placeholders; do not use a restored database as a new authority or
silently replace its journal. The sink pins source/capture lineage, compares the
entire existing event prefix, and atomically appends exact new events using
SQLite `synchronous=FULL` and `fullfsync`, then closes and reopens for readback.
Exact retry is safe. Missing prior events, changed payloads, wrong source or a
changed capture boundary fail without removing retained history. After an
ambiguous reply, retry against the same journal. Do not delete it to bypass a
conflict. Output contains counts and a digest, not event payloads.

The file survives a source-only SQL restore, but shares the local machine's
failure domain. It is **not** independently hosted durable capture. There is no
background collector, freshness/completeness attestation, outage admission gate
or protected remote retention configured. Deletion after the last successful
capture can still be lost if the source is lost. Independent grant revocations
and historical cancellations/deletions are not reconstructed. Both
`captureComplete` and `releaseQualified` remain false. Keep the journal private
and retained; this slice grants no expiry, physical purge, replay, reopening or
closure activation authority.

## Replay a retained captured history under quarantine

This bounded procedure requires the source backup to contain migration
`20261103100000`, the original capture lineage and a supported event prefix.
It extends the local snapshot mechanic to captured requests, cancellations and
response deletions. It does not qualify missing historical/independent grant
revocations or authorize reopening.

1. Preserve the SHA256 from a successful capture receipt independently of the
   SQLite journal. Export that exact retained capture without contacting the
   source database:

   ```sh
   python3 docs/agent/organization-suppression-capture.py \
     --journal '/absolute/private-directory/suppression.sqlite' \
     --expected-source-id 'independently-checked-source-uuid' \
     --expected-sha256 'independently-pinned-capture-sha256' \
     --export '/absolute/private-directory/captured-history.json'
   ```

   The journal is read in one read-only transaction. Identity, complete bounded
   sequence, per-event digests and the independently pinned whole-capture digest
   must match. The latter detects truncation even when all remaining event
   digests are valid. Export atomically creates a private file and refuses to
   overwrite any existing path. It prints only count/digest and false
   qualification flags. If collection advanced, use the corresponding newer
   independently retained receipt; never invent a digest to bypass a mismatch.

2. Follow the quarantine-before-import procedure above: retain one operator
   session, disable target database admission from the maintenance connection,
   independently verify connection denial, then import the trusted plain dump.
   Do not connect the collector, an app or a worker to the target.
3. Through that retained session, supply the exact exported bytes and pinned
   digest as quoted psql values:

   ```sql
   SELECT public.replay_organization_suppression_history(
     :'captured_history', :'pinned_sha256');
   SELECT datallowconn FROM pg_database WHERE datname=current_database();
   ```

4. Independently inspect response/correction absence, deletion tombstones,
   lifecycle state, original deadlines, scoped withdrawal and preservation of
   other organizations/shared identities. Keep the target quarantined.

Replay requires exact source/capture lineage and event-prefix agreement. Missing
events use the original IDs/times and enabled canonical shutdown/capture hooks;
requests preserve their original export window and cancellation restores no
publication or grants. Supported deletion removes the restored response and
corrections and retains an answer-free tombstone. Unknown/missing source owners,
conflicting or unsupported history and invalid evidence reject atomically.
The whole captured stream must agree after replay; retries do not create another
event stream. Successful replay remains `releaseQualified:false`.

Exact captured history is not a guarantee that every revocation in the restored
database is intact. Uncaptured grants, older deletion/cancellation history,
collector outages and hosted recovery controls remain separate gates. Replay
cannot reconstruct a deleted response's actor identity: new deletion tombstones
use NULL attribution and grant no response access. The canonical actor check on
a manager's deletion retry remains unchanged; operator replay idempotency does
not imply restoration of that actor-specific receipt. No physical purge,
retention expiry, provider action or connection reopening is authorized.

## Exact form invitation revocation recovery

Migration `20261103110000` extends the same bounded capture/export/replay
procedure with `form_invitation_revoked`. Use a backup containing this migration
when the retained stream includes these events; older replay implementations
must reject the unknown kind rather than omit it.

From installation onward, live-to-revoked invitation changes and live invitation
deletion, including cascades, capture an immutable event for the exact grant ID.
The event contains organization/form/invitation IDs, the parent invitation ID,
manager revision, permission and original creation/revocation timestamps. It
contains no email, actor identity, invite secret or response content. Repeated
suppression of the same ID does not manufacture another grant generation.

Replay revokes a matching invitation or retains suppression when the exact row
is absent; it never deletes invitation rows or follows a deletion cascade.
Identity conflicts fail under quarantine. Distinct replacement IDs remain
independent, while reinsertion or unrevocation of the suppressed ID is denied.
Existing parent-chain checks still determine dependent authority; recorded child
revocations remain separate exact events. No organization owner gains response
access, and no manager, editor or viewer grant is inferred from the journal.

This is access suppression, not account or personal-data erasure. A revoked row
restored from a backup can still contain its original email/actor attribution;
this procedure does not remove that data or delete a shared identity. Revocations
before capture installation, manager-revision or membership invalidations that
did not stamp these invitation rows, and other grant domains still need separate
qualification. Keep `historyRequiresReconciliation:true`, both qualification
flags false and all closure/reopening controls disabled.

## Exact member reviewer grant recovery

Migrations `20261103120000` and `20261103130000` extend capture and quarantined
replay with `form_reviewer_revoked`. Backups used with that event kind must
contain both migrations and the original private reviewer grant IDs.
An installation identifier (`reviewer.generationId`) is retained in the backup
and every reviewer event. Installing these migrations into an older backup
creates a different identifier and must fail replay. Copying that identifier
alone does not reconstruct the original grant IDs and is not a recovery step.

Member reviewer rows now have an opaque `grant_id` identifying one authority
generation. Canonical changes to role, grantor or manager revision rotate it;
same-authority upserts and exact command retries retain it. DELETE and
authority-changing UPDATE atomically capture the OLD generation, including
membership cleanup. The journal contains only form/grant IDs, permission,
manager revision, installation identifier and creation/revocation times; no member/grantor identity,
email or answers. Inserts and rotations share the capture-state lock boundary
to prevent reuse after a concurrent deletion.

Replay removes only an exact old generation, or records suppression if that
generation is absent. It neither sweeps rows by member identity nor recreates
any grant, membership or actor. A newer generation already in the restored
backup survives. Canonical removal of dependent grants is captured as separate
events; replay does not invent a delegation cascade from missing actor data.
Same-generation reuse, mismatched evidence and inconsistent restored outcomes
fail; the original quarantine, pinned export and false qualification flags apply.

An older backup may contain a former Edit/Manage grant but lack the replacement
View grant created after a downgrade. Replay suppresses the former grant and
leaves access absent; the missing legitimate replacement requires independent
reconciliation. Do not infer the new grant from an old member key, an owner
role or a revocation event. Historical unstamped invalidations, other access
domains, independently durable capture/freshness, retention and hosted recovery
remain unqualified. This is access suppression, not account/PII erasure or
permission to reopen.

## Manager-transition dependent grant recovery

Migration `20261103140000` materializes dependent grant retirement when a form's
primary manager or manager revision actually changes. The same transaction
revokes affected live invitations and deletes affected reviewer generations;
the existing exact invitation/reviewer hooks record each retirement. Unchanged
manager values and ordinary access-revision updates do not retire grants.
There is no new event kind or historical backfill.

The exporter and replay require the enabled canonical transition and membership
hooks. Capture failure rolls back the manager transition, including dependent
changes. Existing primary-manager membership loss already retires dependent
grants; removing an external recipient's optional organization membership does
not revoke a valid independent invitation. New grants issued after the
transition remain independent and survive exact-generation replay.

This covers dependent grants only. An older backup can still contain the former
primary manager and membership: replay does not rewrite that identity, invent a
replacement manager or qualify the restored database for reopening. Primary
manager authority suppression is a separate remaining boundary. Pre-installation
unstamped transitions and missing replacement grants require reconciliation.
Keep the database quarantined, `historyRequiresReconciliation:true`,
`captureComplete:false`, `releaseQualified:false` and closure controls disabled.

## Exact primary-manager authority recovery

Migrations `20261103150000` and `20261103160000` extend capture and quarantined
replay with `form_primary_manager_revoked`. Both migrations are required:
export/replay refuse a partial installation without the authority fence.
Backups must retain the original primary grant IDs and private installation
identifier; upgrading a pre-installation backup cannot recreate that lineage.

Each form now retains an opaque primary authority generation and its allocation
time. Actual manager or manager-revision changes rotate that generation; eligible
membership loss retires it, including when the form has no dependent grants.
Re-adding membership does not reactivate a retired generation. The existing
explicit owner recovery remains revision-checked behind the closure guard;
ownership alone still grants no response access. Capture failure rolls back the
whole change. Unchanged manager values and ordinary metadata do not retire it.

The event contains only form/grant IDs, installation identifier, manager revision
and allocation/retirement times. Replay stamps only the matching generation or
records its absence, preserving newer authority and unrelated organizations.
It neither changes the manager identity nor creates a replacement. Shared access
helpers and primary-only publication, deletion, delegation and permission flags
honor retirement; a separate reviewer grant cannot restore primary-only powers.
Existing exact collaborator retirement and closure wrappers remain in force.

Historical unstamped transitions, missing replacement managers/grants and missing
source-form history require reconciliation. This is access suppression, not
account/PII erasure. Other sharing domains, independently durable/fresh capture,
verified retention/purge and hosted recovery remain open. Keep restored targets
quarantined, `historyRequiresReconciliation:true`, `captureComplete:false`,
`releaseQualified:false` and closure/refund/provider activation disabled.

## Exact page guest-invitation recovery

Migration `20261103170000` extends the same bounded capture, retained journal and
quarantined replay with `workspace_page_invitation_revoked`. Its `pageInvitation`
payload contains only page/invitation/parent IDs, permission and original creation
time; the event's revision is always `1`. No email, principal or page content is
captured. Stable invitation IDs already exist; the migration derives immutable
organization identity from each page so later page, parent or Auth cascades can
capture the OLD grant without looking up a removed parent.

Live revocation and deletion record exact suppression atomically. Invitation
identity, expiry and accepted identity cannot be reassigned; original acceptance
remains supported. Revocation is sticky, and capture serialization prevents a
concurrent delete/reinsert from reviving the same ID. Export and replay require
the enabled capture and identity guard hooks.

Replay revokes only the matching restored invitation or retains suppression for
an absent grant/page. It never reconstructs a page, principal or replacement
grant. Distinct later grants remain independent, and existing parent-authority
checks continue to govern guest read, edit and delegation. Page publication,
private files, other organizations and shared identities are not restored or
removed by this event.

This is page invitation access suppression, not account/PII erasure. Historical
unstamped revocations, note source-scope and publication/asset withdrawals,
other access domains, independent durability/freshness and retention/purge still
require qualification. Reuse the pinned journal and offline procedure above;
keep targets quarantined and every completeness/release flag false. Closure
controls, transition grants and provider/refund activation remain disabled.


## Exact page note-source scope recovery

Migration `20261103180000` extends the bounded journal and quarantined replay with
`workspace_page_note_scope_revoked`. Each explicit note-edit consent has an opaque
`grant_id` and server `granted_at`; a separate installation nonce must survive in
the original backup. Applying the migration anew cannot reconstruct that lineage.
The `pageNoteScope` payload contains only page/particle/canvas IDs, source creation
time, installation/grant IDs and grant time. Revision is `1`; operation ID equals
grant ID. No actor, email, source text or response content is retained. Source
creation time is a finite UTC identity field, not a trusted server-clock deadline.

Disabling, live deletion, source/selection removal and page cascades capture the
exact old consent. Re-enabling or changing the enabled source/grantor creates a
new generation; unchanged consent, metadata and command retries preserve identity.
Repeated disable preserves the original retirement stamp. Auth deletion that only
clears attribution does not withdraw independent consent. Allocation and capture
serialize with the existing SHARE/UPDATE NOWAIT fence, so failed capture rolls
back the entire canonical command and an old grant ID cannot be reused.

Replay disables only an exact matching generation or records its absence. A later
explicit consent survives; no page, source, identity or missing grant is rebuilt.
Revoking source editing does not itself withdraw the guest's separate page access.
Original source/page/board data and private files remain untouched by scope replay.
Exporter/replay require the exact enabled scope capture/guard and source/selection
invalidation hooks. Existing pinned-prefix, sole-operator and quarantine rules
remain unchanged.

The existing store guard now permits only an exact monotonic scope retirement
under the organization lock during closure. This allows snapshot withdrawal to
retire enabled note scopes without permitting enablement, content writes or receipt
mutation. Cancellation keeps scopes and sharing withdrawn. No closure control or
transition RPC is exposed.

Historical unstamped removals, missing replacement/source history, other sharing
revocations, independent capture durability/freshness and verified retention/purge
remain unqualified. This suppresses access; it does not erase account/PII history.
Keep `historyRequiresReconciliation:true`, `captureComplete:false`,
`releaseQualified:false` and restored targets quarantined. Local database proof is
not hosted/release acceptance. The authoritative S08 checkpoint owns the next slice.


## Bounded capture admission (migration 20261103190000)

Every event insertion now checks the same complete UTC JSON envelope used by the
exporter. The 1,000-event and 1,048,576-byte limits are transactional: overflow
raises `54000` and rolls back the entire canonical operation, including earlier
shutdown changes, operation receipts and the sequence counter. A rejected
withdrawal has **not** revoked access. Exact successful operation retries do not
consume another slot. Do not clear the journal, reset its counter or drop events
to recover capacity; this bounded rehearsal needs a separately qualified capacity
solution before activation. Installation rejects existing oversized/inconsistent
history without changing it. Export/replay also reject a missing, disabled or
narrowed capacity hook. Private helper privileges remain unavailable to API roles.

## Frozen remaining access domains (C1)

This inventory is fixed at the November 2 continuation checkpoint. It replaces
open-ended “other grants” discovery; it does not certify current authority.
Existing exact form invitation/reviewer/primary manager, page invitation and
note-source consent recovery remains unchanged.

| Domain | Restore disposition and source owner |
| --- | --- |
| Page public/guest/link and native intake selection | Independent publication consent generations in `organization_workspace_pages`; native intake follows the current selected page snapshot. Draft revision alone is not consent. |
| Copied page image/document access | Exact IDs in `workspace_page_image_grants` and `workspace_page_document_grants`; source files and copied Storage objects are preserved. Editor access is distinct from public access. |
| Legacy public flags | Reconcile current consent for `organizations.is_public/is_public_roadmap` and organization-owned `programs.is_public`; an old true flag is insufficient. Preserve unrelated personal programs. |
| Calendar authority | Reconcile/retire restored public/internal feed and event authority (`roadmap_calendar_*_feeds`, `roadmap_calendar_public_events`, `organization_calendar_publication_revocations`). Never journal bearer tokens. |
| Organization admission | Reconcile memberships/roles, invites, access requests and invite settings. Form-dependent suppression does not prove workspace membership authority. Preserve other organizations and shared Auth users. |
| Staff/support/fiscal authority | Independently reconcile staff/support grants, Auth restrictions, fiscal reviewers/applicants and session credentials. Preserve separately owned financial/security records; do not sweep global roles on behalf of one organization. |
| Connector consent | Keep restored credentials and workers inactive until current provider/scoped consent is verified. Shared Google identity and externally owned files are preserved. |
| Runtime/environment admission | Reconcile canceled/pending AI and delivery work, effect/settlement receipts, Auth sessions, service keys and operator privileges before any application/worker connection. Restored queued rows are not execution authorization. |

The last six domains remain under verified database quarantine, with explicit
`requires_current_authority_reconciliation` status. An offline connection-denial
receipt proves no restored database admission at that moment; it does not prove
historical authorities are correct or that a managed hosted environment has the
same controls. Keep one operator during replay and zero sessions after exit.
There is no reopening operation in this procedure. C2 owns actual hosted isolation;
C3/C5 own retained content, connector effects and financial/runtime reconciliation.
Historical/pre-installation histories, missing later grants and missing source
records require reconciliation across all eight domains. Direct public Storage
URLs and already delivered bytes remain C3 retention/retirement obligations.

### Domains3–5 local reconciliation rehearsal

The November2 synthetic rehearsal used a current authority source changed after a
pinned backup, then reconciled exact scoped rows in a separate offline target.
Eight publication/calendar/admission retirements preserved independent current
consent, genuinely later same-identity consent, other organizations, shared Auth,
owner bindings, responses, AI and files. Missing current disposition stayed
unresolved. All five disposable databases ended offline with zero sessions and
prepared transactions. This is local manual-mechanics proof, not actual hosted or
historical authority qualification. Do not reuse synthetic IDs or decisions on real
data. The exact private operator steps and evidence are in
`.tmp/ch-c1-reconciliation-20261103/README.md`; receipt
`/tmp/ch-c1-local-reconciliation-proof.json` is pinned in the authoritative plan.

## C2 hosted qualification inputs and exact failure drill

Local SQLite evidence remains reusable. It does not establish source-and-host
loss survival; no remote retention destination, scheduler or authenticated remote
acknowledgement is configured by these migrations.

Before a hosted drill, retain these concrete inputs in the existing checkpoint
without copying credentials into logs:

- Exact source project/database, original source/capture identifiers and domain
  installation generations, candidate migration revision and actual collector role.
- Independent retention account/project, container/key prefix, region/failure
  domain and collector identity. Source/collector credentials must not erase or
  overwrite acknowledged versions; retain actual retention-setting permissions.
- Verified database/PITR/manual-export/object/log horizons from C3. Remote
  suppression retention must cover every restorable history; no horizon is
  assumed from the 30-day user export window.
- Scheduler owner and approved transport, authenticated append/readback/receipt
  protocol, collection interval and outage admission policy. Bind acknowledged
  source/capture ID, high-water, digest/chain and remote immutable version. A local
  heartbeat or freshness lease cannot prove an uncaptured suffix never existed.
- Exact isolated recovery project/operator and maintenance admission controls.
  The current replay requires actual `rolsuper`, `ALLOW_CONNECTIONS=false`, sole
  session and no prepared transactions. If hosted privileges cannot provide this,
  qualify an equivalent procedure; never weaken checks to manufacture a pass.
- Backup inventory/install boundaries and a reconciliation or authorized retirement
  disposition for each unsupported history. Installing new generation IDs into an
  older backup does not recover its original lineage.
- Scoped authority for the named nonproduction source/target/sink failure drill.
  Local implementation authorization does not authorize remote configuration,
  permanent retention changes, deletion, deployment or reopening.

With those inputs, recover pinned retained bytes without source/collector-host
access; compare lineage, sequence and digest independently. Prove coverage of the
latest required committed withdrawals. Exercise missing/stale/regressed/forked
receipts, collector outage, source loss, tampered/truncated payload, remote
rewrite/delete denial and count/byte boundaries. Any unproven suffix keeps the
target quarantined. Under actual hosted privileges prove denial **before import**,
replay exact history, inspect canonical withdrawals and preserved identities,
then disconnect the sole operator and verify zero sessions/admission still denied.
Keep `captureComplete:false` and `releaseQualified:false` until all corresponding
qualification gates are actually satisfied; this checklist is not their receipt.


## Exact publication and copied-asset recovery (migration 20261103210000)

Require migration `20261103190000` and the original private
`page_access_generation_id` from installation. Public and guest snapshots have
independent opaque consent generations. Draft-only/no-op changes preserve them;
withdrawal, content replacement, link rotation and deletion retire the affected
old generation. Copied image/document grants retain their exact ID; their identity
and contents cannot be changed in place. Issue a new reviewed grant instead.
Deletion records suppression, including cascades. No source file or Storage object
is deleted by access replay. The reviewed primary logo uses the existing image
grant table and the same exact retirement boundary.

The existing bounded journal adds `workspace_page_access_revoked` with only
opaque organization/page/grant/installation IDs, domain (`public`, `guest`, `image`
or `document`), original allocation time and revision. It contains no snapshot,
actor, token, storage path or source content. The collector's strict parser and
the exporter/replay require the new kind, exact payload and enabled hooks. An old
collector must reject it rather than silently omit it.

Quarantined replay withdraws only the matching public/guest channel or copied
grant, or records its already-absent identity. Newer independent consent survives;
missing replacement grants are never invented. A public withdrawal alone does
not erase a separate guest snapshot or editor asset entitlement. Exact asset
retirement denies all its audience readers while preserving the copied bytes for
separate retention/cleanup ownership. Cancellation restores none of these grants.

The resulting receipt explicitly lists the six frozen non-exact reconciliation
domains above. Keep the database offline and verify zero sessions after operator
exit. This is local restoration mechanics, not hosted admission, complete current
authority reconciliation, personal-data erasure or permission to reopen.


## Private expired-closure source cleanup (C3)

Migrations300000 and310000 add source-specific operator commands only:
`purge_expired_organization_form_responses` and
`purge_expired_organization_research_drafts`. Each takes the exact organization,
closure request, expected revision and operation UUID. Actual session/current
superuser identity, READ COMMITTED/origin triggers, organization-first locking and
the unchanged720-hour deadline are mandatory. API roles have no EXECUTE or receipt
table privileges. Hosted equivalents of these operator privileges remain
unqualified; these are not production execution instructions.

Each command handles at most50 source rows and commits an immutable exact retry
receipt. Retry an uncertain result with the identical identities; a new operation
advances the next batch. Failure rolls back the batch. Counts/remaining flags refer
only to that source, never whole-organization erasure. Native response cleanup
requires intact capture/lineage/capacity and preserves the existing answer-free
deletions. Replay accepts those deletions during closing only when their actual
capture time is at/after the captured fixed deadline. Earlier events still fail.
Research cleanup retains AI runs, effects and all accounting; restored drafts stay
inaccessible under pinned closure replay/quarantine until private repurge.

The current checkpoint pins combined migration and concurrency/replay evidence.
Do not infer independent durability, historical/current authority, hosted
retention, physical Storage deletion, early deletion or user-facing activation.
Other controlled stores remain required C3 work. Keep closure controls and the
transition RPC unavailable until their full shutdown/recovery boundaries qualify.


### Private library-file and copied-byte cleanup

Migration320000 adds exact expired-closure document reserve/finish entrypoints over
the existing file-purge owner. Active and trashed otherwise-qualified library
files use the fixed closure deadline; no second trash-age delay is imposed.
Canonical paths are rederived before promoting any old reservation. Current,
historical, staged and original bytes must all be absent before finalization;
partial/ambiguous effects retain history and the same operation for retry.
Ordinary APIs retain their authority/trash checks. Unknown legacy/core/shared
ownership or public buckets remain blocked.

The source-specific [local operator](organization-document-closure-cleanup.py)
refuses original/remote endpoints, uses private environment credentials, disables
HTTP proxies/redirects and pins actual libpq loopback routing. Actual local
postgres nonsuperuser refusal and supabase_admin success are verified. Managed
hosting may not expose that identity; no hosted worker authority is established.
The nil-UUID actor sentinel is explicitly operator cleanup, with actual database
session identity retained privately; it is not an owner/user action.

Reviewed image/document copies are separately owned in workspace-page-assets,
with no source-file FK. Original deletion preserves their grants/bytes. Existing
closure withdraws closing-organization grants and captures suppression; the
existing orphan worker then removes eligible old ungranted copies. Actual
Next/Storage/backend-byte proof passes locally without a new330000 migration.
Hosted scheduling, backup/PITR/public-object/log retention and full organization
cleanup remain separate. Current exact receipts and installed-clone/owned-stack
scope are in the authoritative checkpoint; do not infer full erasure.


### Private workspace/form/page content retirement

Migration340000 requires the native-response stage first and refuses live
publication/grants. It removes complete root/named workspace boards and owned
data tables/views, empties page snapshots/form-version content and scrubs
content-bearing data-view receipts. Minimal form/page/version IDs, existing UUID
particle membership, hash-only operations and response suppression/tombstones
remain for replay. Private immutable transaction-bound receipts admit only exact
projections; ordinary API execution and forged markers remain denied.

After restoring a preclosure backup, apply the independently pinned suppression
history while quarantined, then rerun the same exact expired-closure source stage.
Local full-schema proof verifies replay, rollback, concurrency and preserved other
organizations. This stage does not retire core documents, projects, AI parent
content or physical objects and does not signal whole-organization completion.


### Private core, operating and project content retirement

Stages350000/360000/370000 retire known core/history/session content, operating
payloads and project/task/program content plus direct copies. Each requires the
actual private operator, exact current expired closure and immutable operation
identity. Pending effects, unknown ownership and cross-organization references
remain explicit refusals. Preserve financial/signing facts and replay identities;
physical bindings stay with their separate byte owner. Run core cleanup before
retrying library files blocked solely by those retired references. Actual
source-stage receipts and scoped proof live in the authoritative checkpoint.

Calendar390000 separately fences export admission and canonical selection, then
withdraws only matching organization export pointers/leases on closure. Cancel
never restores them. Personal credentials/caches and destination effect evidence
remain; an already admitted provider request is not proven canceled. Reconcile
actual provider effects before retiring destination evidence or qualifying
shutdown. Only the export-admission RPC is granted to service_role, never the
closure transition. Historical no-privileges test dumps do not prove deployed
ACLs; use an ACL-correct predecessor and verify the canonical transition revoke.


### Private settled AI content retirement

Run310000 recovery-draft cleanup before380000 parent-content cleanup. Only
terminal, measured, settled runs qualify; the real accounting-policy row must
exist and lock successfully. Pending provider/refill effects and unqualified
manual evidence block. Raw run/result/application content retires while true
numeric usage/pricing, ledger/settlement and effect identities remain. Exact late
retries compare retained hashes and return no deleted content; permanent fences
prevent resurrection. This stage does not settle unknown costs, authorize paid
runs or qualify provider-side retention.


### Modern object, Drive-reference and profile cleanup

400000 extends the existing local operator with exact `--storage-object` mode for
proven modern media/tracked-document/policy objects and reuses320000 for qualified
core-library paths. Preserve actual financial/shared/foreign-domain bindings.
Frozen object identity and same-path writer locks precede Storage deletion;
canonical binding/quota removal follows independently confirmed absence. Existing
file mode remains supported. Current native/Storage/backend/public-URL proof and
exact owned-stack installation chain are pinned in the authoritative checkpoint.

410000 retires organization Drive references/intents and direct source-tagged
activity payloads, never user-global credentials or provider files. Intent
creation/consumption is independently closure-fenced; already consumed provider
exchanges require reconciliation.420000 removes known profile metadata/derived
coordinates, preserving unresolved physical/malformed/unknown values. Unknown-key
diagnostics are bounded digests, not copies of user-controlled key text.

450000 extends the same physical operator to exact modern project-assets paths,
canonical project/asset IDs and real FK/JSON/path reference fences. Fiscal,
signing, shared and unresolved legacy sources remain protected. External-link
bindings retire without provider HTTP. Historical file/document title and
metadata copies retire only after the relevant canonical source permits it.
The authoritative checkpoint pins actual Storage/API/backend absence, exact retry
and independent-copy/other-organization preservation evidence.

### Private cleanup lifecycle and project-file integration

430000 provides private claim/run/finish/status functions. A claim pins the actual
operator, current request/revision and a fixed five-minute lease; it never extends
the lifecycle deadline.460000 integrates450000 as the tenth fixed SQL source and
includes project-assets and unretired activity payloads in canonical remaining
counts. Per-source savepoints retain successful progress when another source
fails. Fixed failure codes exclude raw errors; finished results and exact retries
are immutable. A new attempt advances additional bounded batches after repair.

Run physical deletion through the existing exact source reservation/operator
before reporting its outcome. Ambiguous Storage results remain failed and retain
the reservation for explicit retry. `batch_complete` describes one invocation,
not source exhaustion. Current canonical remaining counts, unresolved ownership
and external qualification stay visible; an empty SQL pass cannot report whole
organization completion. All lifecycle/early-intent/cleanup RPCs remain private.

### Captured earlier deletion

440000 records an immutable current request/revision, confirmation identity and
versioned owner-consequences attestation. This is a private operator rehearsal,
not a hosted owner consent channel. It ends new authorized reads/export/link
issuance without changing the original720-hour deadline or revision; cancellation
cannot restore access. Mandatory capture/capacity/advisory hooks and strict event
shape validation apply. Old-backup replay uses the captured confirmation time,
never the restore clock, and remains quarantined. READ ONLY access and confirmation
serialize through the existing advisory boundary. Already issued URLs and admitted
HTTP cannot be recalled by this flag; physical/CDN/provider retirement is separate.

The next dependent implementation requires a selected independent retention
destination, acknowledged append/readback transport and collector-outage admission
policy, followed by hosted recovery qualification. Owner request/export/cancel/
status/early-delete interaction remains unavailable until required shutdown and
recovery boundaries qualify. Actual retained-store horizons, unknown/shared
ownership, financial disposition and provider effects are not resolved by these
local source receipts.
