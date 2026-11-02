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
