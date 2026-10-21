# Uploaded document versions — migration application receipt

- Authorization: user requested “continue. apply the migration.”
- Applied at: 2026-10-14T22:35:38.636422+00:00.
- Target: shared Supabase project `vswzhuwjtgzrkxknrmxu`; preview configuration matches main's linked project reference.
- Migration: `20261014223000_version_uploaded_document_saves.sql`.
- Source SHA-256: `5ebe46142b821fb9d05c7759c0189f5e245ceee458b8aa08716de8e4b46350f9`.
- Applied only this migration plus its exact-source history record in one transaction, with an advisory lock, 5-second lock timeout and 30-second statement timeout. No all-pending push or user-content write.

## Live compatibility adjustment

Preflight found the deployed quota function already excludes an existing document-kind row during policy upsert. Preserved that fix in both the new function and guarded rollback; the prepared earlier version would have regressed it. Added and passed an actual SQL test for policy replacement at the storage cap. The application transaction checked the preflight function hash before changing it.

No migration-version collision, existing version tables or existing reserved-prefix objects were present. The existing uploaded room table had zero rows. Preserved existing core-document/support migrations and all unrelated storage policies.

## Verified after commit

- History stores the exact source hash shown above.
- `document_file_versions` and `document_version_operations` force RLS.
- Authenticated users can read permitted history but cannot write it; operations are service-private.
- Commit/reserve/abandon/cleanup/actor-check functions are SECURITY DEFINER with empty search paths and service-only execution. The storage predicate is also available to authenticated policy evaluation.
- Three restrictive Storage policies protect the reserved prefix and recorded versions.
- The deployed policy-upsert quota fix remains present, alongside retained-history accounting.
- Both new tables remain empty. No files, account permissions, shared drafts or provider content were created or changed for verification.

The fresh isolated schema, actual SQL RLS/transaction/quota matrix and empty-state rollback passed before application. These checks do not establish live browser editing or two-user synchronization. Writable UI remains gated until peer advancement, Save/restore controls and version-aware purge are ready.

Evidence: `/tmp/particle-document-version-preflight.json`, `/tmp/particle-document-version-application.json`, `/tmp/particle-document-version-verification.json`, `/tmp/particle-document-version-fresh-schema.log`. Credentials are excluded.

## Canonical notification follow-up

Also applied `20261014233000_publish_document_versions.sql` to enable the small, RLS-filtered canonical metadata INSERT hints needed by peer editors. Exact-source history was recorded atomically; no existing rows changed. SHA-256: `ca092d931482aa6ec209530c89c812bb8c1c1ac74570e1e2f7092d10cddc76d5`. Verification lists `document_collaboration_updates` and `document_file_versions` in Realtime; large room checkpoints remain unpublished. Both new versioning tables still contain zero rows. Evidence: `/tmp/particle-document-version-notifications-application.json` and `/tmp/particle-document-version-verification.json`.
