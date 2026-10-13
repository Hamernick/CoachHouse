# Nonprofit search repair — 2026-10-07

Status: applied and live-verified after the user authorized a scoped quality-gate exception conditional on security and breaking-change screening. Screening passed.

## Verified cause before repair

The front-page localhost and deployed code use Supabase project `vswzhuwjtgzrkxknrmxu`. Anonymous `search_nonprofit_directory_v2` returns PGRST202. A read-only catalog query confirms that the function, its three category tables, and migration-history version `20261007070000` are absent. The v1 search function and all migration dependencies exist; v1 anonymous text search succeeds.

This is not a browser, Next.js, or PostgREST cache-only problem.

## Exact applied operation

Apply only `supabase/migrations/20261007070000_nonprofit_categories.sql`, already shipped in main `072b34d71c5a38ab611e0482bb5d8188e3a1a8b3`.

SHA-256: `ab63acb170fc32b54e6a5bec7d2f30ce3d4812d06ddfa7fe345b50c09160e098`

Target: shared production Supabase project `vswzhuwjtgzrkxknrmxu`.

The migration creates:

- Three initially empty tables: `nonprofit_category_sets`, `nonprofit_directory_categories`, `nonprofit_category_chunks`; indexed category/EIN lookup.
- Forced RLS and service-role-only table access.
- Service-only category preflight function.
- Anonymous/authenticated read-only `search_nonprofit_directory_v2` with a fixed public response, bounded results and existing suppression/ownership rules. Unfiltered category requests delegate to the existing v1 search.

Apply in one transaction with short lock/statement limits, validate expected absence and existing prerequisites again, record only this migration in `supabase_migrations.schema_migrations`, and notify PostgREST to reload its schema after commit. Never run a broad `db push` or apply other pending migrations. Verify anonymous RPC/API search, cursor pagination, invalid requests and denied direct table access afterward.

No records, category assignments, publication switches, account settings, paid capacity or unrelated schema will be changed. Category-filtered nonprofit results will remain empty until the separate audited category publication lane populates assignments. Existing curated service results are separate.

## Evidence and deployment gate

- `pnpm test:rls:nonprofit-directory` passes in disposable local PostgreSQL, covering access, search, atomic replay, owner precedence, suppressed listings, exact topic/service separation and revision-safe rollback.
- PR #273 merged, and Production deployment reports success, but its final hosted `visual` and aggregate `quality` failed; required review is not satisfied according to the PR API. Static, acceptance, RLS and build passed. Run: https://github.com/Hamernick/coach-house-lms/actions/runs/37624801663
- `AGENTS.md` requires: “Ship only after the required GitHub `quality` check passes for the current PR revision with branch-protection requirements satisfied.” The category release instructions also require current-revision quality/protection before applying migrations.

The user explicitly authorized this scoped exception only after security and breaking-change screening. That screening passed before application. The unrelated release-wide quality/review failures are not being represented as resolved.

## Recovery

If the transaction fails, all DDL/history changes roll back together. After a successful commit, retain the additive schema and v1 compatibility; prefer a reviewed forward correction to dropping data-bearing tables. Do not rerun CREATE statements after an ambiguous response: first reconcile the migration history and actual function/table catalog.

## Security and breaking-change screening

Scope: exact SHA-256-pinned migration 20261007070000, its v1 search/public-projection/hold dependencies, and the current bounded API/cursor contract. This is a scoped migration review, not a whole-application security audit.

- Threat boundary: untrusted anonymous/authenticated RPC callers versus security-definer reads and service-only private category metadata. No dynamic SQL or client-selected table/column names. Fully qualified relations/helpers and pinned empty search paths prevent schema shadowing.
- Permissions: all seven direct table privileges denied for both public client roles; forced RLS enabled on each new table; private preflight cannot be called by those roles. Only the bounded, fixed-projection search RPC is granted. Existing suppression and curated-duplicate predicates remain in the public view.
- Compatibility: additive function/tables only; v1 definition remains byte-identical in disposable testing. No existing object is dropped/replaced, no identity rows updated, no publication enabled, no category backfill/publisher installed. Text/state/EIN/cursor behavior and response allowlist remain compatible; specific-service categories do not inherit broad topic matches.
- Operations: indexes are built on empty new tables, not the populated identity table. Foreign-key DDL can briefly lock the referenced identity table, so use a two-second lock timeout, bounded transaction and abort on concurrent/partial migration state. A failure rolls back DDL/history together. Reconcile before retrying an ambiguous result.
- Validation: original disposable PostgreSQL access/replay/ownership/rollback suite passed; extra checks injected into that same disposable harness at the exact one-migration boundary passed (RLS, seven privileges per role/table, function grants, pinned search path/time limit, unchanged v1 hash, malformed limits/query/state/category/cursor, empty categories). All eight existing nonprofit API tests passed. No production test fixtures or test writes.
- Accepted limits: categories remain empty until audited assignments are published separately; the endpoint remains a public search surface with its existing bounded-page/timeout protections. No broader abuse/load audit or unrelated release validation is claimed.

No blocking security or compatibility finding identified within this scope.

## Live execution and verification

Applied migration 20261007070000 in a guarded transaction (lock timeout 2s; statement timeout 20s), recorded its exact reviewed SQL in migration history, and requested the documented [PostgREST schema reload](https://supabase.com/docs/guides/troubleshooting/refresh-postgrest-schema). Management API returned 201 and the expected function signature. No retries or unrelated migrations were applied.

- Anonymous v2 text search returned the same three records as v1.
- Localhost:3000 and coachhouse.app search both returned 200; next pages returned distinct records; invalid limits returned 400. Category search returned 200 with zero rows, consistent with zero published category assignments.
- Each new private table rejected direct anonymous access with 42501. Catalog verification confirms forced RLS and no table privileges for either anon/authenticated. Private preflight is not executable by either; public search is. Both functions pin search_path and configured timeouts; owner is postgres.
- Existing v1 definition hash, public-view definition hash and publication settings match the preflight snapshot. Only version 20261007070000 was installed; 070100/070200 remain pending for their owning release lane.
- Evidence: [before](nonprofit-search-repair-20261007/before.json), [apply receipt](nonprofit-search-repair-20261007/apply-receipt.json), [after](nonprofit-search-repair-20261007/after.json). No credentials or raw nonprofit records are included.

The schema repair restores search for every environment targeting this shared Supabase project, including the other chat's localhost. No code synchronization or server restart is required for this database change. Category enrichment/publication is not part of this repair.
