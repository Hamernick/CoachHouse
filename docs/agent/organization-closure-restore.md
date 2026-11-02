# Organization closure: isolated restore replay

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
