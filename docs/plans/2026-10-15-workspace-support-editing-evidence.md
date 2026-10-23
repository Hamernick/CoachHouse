# Workspace support editing — execution evidence

Delivery boundary: local implementation and PR; Caleb owns hosted checks, merge, deployment and production verification. No production writes or provider changes authorized by tests.

## Baseline

- Lane: `fix/support-roadmap-edit-access-20261015`, checkout `coach-house-platform-tiptap-hotfix-20261015`; HEAD `0fd6b05d3c1c833bc9105d1de515ef29ee90c791`.
- Rebased onto main `c77b219d` (PR317 resource tracing and PR318 sitemap deadline). Preserved both unrelated runlog additions; no runtime overlap. Baseline before implementation remains `0fd6b05d`.
- Existing drawer override and two access regressions retained. Inherited evidence: three failing drawer cases before repair, 45 passing cases across five focused files afterward. Not integrated proof.
- Owned dev listener: PID11639, port3128, cwd verified as this checkout; inherited production env symlink and shared dependency symlink left unchanged. No fixture writes against that environment.
- SHIP shared revision40 retains historical SHIP000 claim; unchanged under the explicit incident priority.

| Step | Status | Evidence | Remaining work |
| --- | --- | --- | --- |
| 00 | passed | Git status/base/fetch, listener cwd, dependency/env links inspected | Main documentation reconciled without dropping either lane |
| 01 | blocked | `supabase status`: Docker daemon unavailable; Docker/Colima executables absent from inspected locations | Actual authenticated app acceptance needs disposable local Auth/PostgREST stack. Independent unit/SQL work continues. |
| 02 | passed | `server/diagnostics.ts`, typed failure policy; safe stage/request-ID/commit evidence tests | Production stage remains unknown; no production request inspected |
| 03 | in progress | Shared `document-capabilities.ts`, standalone/drawer/asset consumers, explicit-target fetch allowlist and asset document loader; access and panel tests pass | Authenticated three-entrypoint matrix authored but unrun |
| 04 | passed | Native text/metadata/delete/hero/inline-image/history operations retain live auth + target + audit; both document SQL suites pass | No migration or global heartbeat-policy relaxation; broader workspace writes retain existing policy |
| 05 | passed | Durable orchestration extracted to `server/sync-document.ts`; CAS retries, duplicate delivery, conflicts, presence isolation and cache-after-commit failure tested | Existing bounded client bootstrap retained; no unsupported HTML conversion |
| 06 | passed | Workspace/document presence use separate five-second HTTP channels, single-flight/backoff/cleanup; transport timeout/cancellation tests pass | Optional errors sampled; history remains user-triggered action |
| 07 | in progress | Versioned per-actor/org/section/tab recovery, acknowledgment-only cleanup, scope abort/stale guards, revocation lock | Component lifecycle checked separately; authenticated multi-session/fault matrix still blocked |
| 08 | in progress | Removed raw sidebar paragraph/participant roster/duplicate save label; reserved document status, contextual retry/download/recovery | Actual app light/dark/narrow review and visual baseline approval not performed |
| 09 | blocked | Disposable loopback-only Auth fixture and 29 actual-route cases authored; focused and SQL proof available | Docker/Auth/PostgREST unavailable; browser matrix is not reported as passed |
| 10 | blocked | Critical path no longer includes presence; safe stage timings available | No production-mode p50/p95 samples; latency targets unverified |
| 11 | in progress | 114 focused tests / 16 files and both document SQL suites pass; feature/route/storage/UI guards checked | Changed-file ESLint clean; all listed guards pass after scaffold-race reruns; Graphify updated. Commit/prepush/PR pending. |


## External unknowns

- Current state of four real support grants is unknown: previous bounded read timed out. Historical provisioning receipt is not a fresh verification.
- Production timeout stage unknown; source inspection establishes critical-path coupling but does not establish the live timeout cause.
- Production verification belongs to Caleb.

## Decisions

- Preserve bounded client bootstrap handshake until server HTML/schema parity is proved; no speculative server conversion.
- Preserve heartbeat-gated permissions outside native document operations. Document mutation owners must use authenticated explicit-target access rather than relaxing the global RLS helper.

## Focused evidence

- `pnpm exec vitest run` over the G1 incident suite plus `document-draft-storage`, `document-presence-transport`, `document-image-support-access`, and `organization-support-document-list`: **114 passed / 16 files** (`/tmp/support-editing-focused-final.log`). These tests cover behavior with isolated dependencies, not live Auth integration.
- `pnpm test:rls:document-activity`: passed actual disposable local PostgreSQL checks for grants/search/selected-tenant RLS/presence/audit/storage/revocation, core-document CAS/history and document activity (`/tmp/support-editing-rls.log`).
- `pnpm test:rls:document-files`: passed tenant, quota, free/paid write and Drive restrictions (`/tmp/support-editing-files-rls.log`).
- `pnpm exec tsc --noEmit --pretty false`: no source-file errors; full result remains failing on56 existing diagnostics across13 acceptance-test files (`/tmp/support-editing-tsc-final.log`). The inherited new drawer fixture's missing request ID was fixed. No broad unrelated test cleanup.
- Guard runs initially raced the scaffold check's temporary directory; rerun affected boundary/storage/lint checks after scaffold cleanup. This was a local check orchestration mistake, not a product failure. Run `check:feature-scaffold` separately from file scanners.
- Browser regression fixture: CUA on own loopback3139 tab verified actual panel/controller/Tiptap opening editable with presence unavailable, typing offline, unmounting/reopening, offering and restoring the exact earlier draft, acknowledging Saved, then locking `contenteditable=false` on revocation while retaining text and offering download. Uses disposable in-memory transport; this is client lifecycle evidence only, never Auth/RLS or production readiness. The authenticated fixture is separate. The matching committed browser spec uses an intercepted loopback origin so localStorage works without contacting a service.

## Authenticated fixture setup and pending execution

Use a dedicated checkout/output directory with a running disposable local Supabase stack and current migrations. Do not run alongside another Next process sharing its `.next`. Never reuse production/fiscal credentials or shared `.env.local` for fixture writes.

Required environment variables (values supplied privately from the local stack):

- `SUPPORT_AUTH_QA_ALLOW_SEED=disposable-local`
- `SUPPORT_AUTH_QA_SUPABASE_URL` and `SUPPORT_AUTH_QA_POSTGRES_URL`: loopback hosts only; helper rejects hosted/unknown targets.
- `SUPPORT_AUTH_QA_ANON_KEY`, `SUPPORT_AUTH_QA_SERVICE_ROLE_KEY`: local stack only.

Run `pnpm exec playwright test --config playwright.workspace-support-auth.config.ts` in an environment authorized for the committed browser runner. The config refuses an existing port3138 server and overrides the application's Auth/database target. Nine synthetic accounts, free/paid orgs, support grants, memberships and coach assignments exist only in that disposable database. Cleanup targets only IDs created by that invocation. Coach assignments permit the existing admin asset page; support mode does not widen private project/billing/fiscal controls.

The authored cases cover four support identities × two plan tiers × three entrypoints, actual typing/save/reopen and saved actor audit, plus presence outage, a lost post-commit response, two staff sessions/undo, cross-tab scope, live revocation with pending work and ordinary-role restrictions. They are **unrun**. Remaining plan matrix: execute all authored cases, then cover all sections/formatted images/budget/history recovery, explicit external-change/journal races, responsive appearance and performance distributions. Existing unit/SQL tests are not substitutes for those journeys.

No visual baseline was changed without user review. No migration, live grant, provider flag, customer document, deployment or hosted check was changed/polled.

- Final lifecycle review corrected status semantics: revocation with no pending edit says View only, not Not saved. Only genuinely unacknowledged work gets Not saved. Covered in failure-policy regression.
