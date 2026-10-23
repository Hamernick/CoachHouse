# Run 05C — Existing-coordinate coverage

## Scope and decision

Continue LIVE03/B036 and the original private packet05/05c. User started this run October14 and explicitly requested individual pins revealed progressively as users zoom in, with **no numbered geographic clusters**. Preserve existing pin artwork, same-address choices, deduplication aliases and unframed Resources layout. No new geocoding, address display, IRS bulk publication, Supabase preview branch or Calendar work.

Isolated branch `fix/existing-coordinate-map-coverage-20261014`, base `af110563`, worktree `coach-house-platform-map-coverage-20261014`, localhost3123. The base contains the previous shared-frame/mobile repair. The rejected local numbered-cluster experiment was fully removed. The subsequent reported loading stall has a scoped overview-query/count-retry repair; see the latest checkpoint below.

## Source-to-map evidence — October14

Read-only source audit and live world-map API comparison:

| Stage | Count |
| --- | ---: |
| Published external resource rows / corresponding location rows | 877 / 877 |
| Excluded synthetic fixture rows | 2 |
| Legitimate service records | 875 |
| Distinct curated places after four known duplicate pairs | 871 |
| Curated places with usable coordinates | 854 |
| Live world API pages | 500 + 354 |
| Public platform organizations / with usable coordinates | 23 / 16 |
| Combined coordinate-eligible listings | 870 |
| Combined marker features / shared-location markers | 826 / 33 |

All854 expected curated IDs equal the live paginated API IDs exactly. The actual local GeoJSON source held826 features. Existing relevance logic keeps all source features and progressively admits11/12/96/826 features at zoom1.5/7/10/15 for this snapshot. Those are relevance-eligible counts across the entire snapshot, **not simultaneous onscreen counts**; viewport, globe occlusion and symbol collision still apply. Geographic numbered clusters are not introduced. Exact-address shared-location selection remains separate and opens choices first.

Seventeen curated places lack usable coordinates: four prepared contact-location corrections; two confidential shelter/admin-office cases; six online/service-area/no-street cases; four zero-coordinate placeholders; one multiple-location record. Seven platform organizations without coordinates explicitly declare online locations. IRS directory records remain search-only because their adapter has no coordinates. This is coordinate coverage, not a new claim that all catalog fields or service evidence have been reverified.

## Four bounded data corrections

The existing October13 coordinate evidence targets Casa Esperanza Project, MYSI Corporation, La Casa Norte and Fellowship Housing. Revalidated exact location/service IDs, public status, physical/primary flags, unchanged street addresses, null coordinates/city and unknown accuracy. Current provider contact sources:

- <https://casaesperanzachicago.org/contact/> (direct authoritative response returned HTTP200 and confirmed8801 S Saginaw Avenue, Chicago, IL60617-2427 on2026-10-14; prior search-only verification is superseded).
- <https://www.myschicago.org/programs/>
- <https://www.lacasanorte.org/contact>
- <https://www.fhcmoms.org/how-it-works>

These are public contact locations, not assertions of walk-in or residential availability. Reused previously recorded coordinates; no fresh geocoding.

[Forward SQL](../shipping/data-repairs/2026-10-14-existing-coordinate-coverage.sql) and [exact rollback](../shipping/data-repairs/2026-10-14-existing-coordinate-coverage-rollback.sql) both end in ROLLBACK by default. Exact four-row guards abort partial/stale matches. Rollback requires unchanged repaired values. Forward and reverse were rehearsed within one transaction and returned all four original null-coordinate rows before final rollback. **No production changes committed.** Applying the four corrections would raise eligible curated listings from854 to858 if the source remains unchanged; recount grouped markers after application.

## Validation and evidence

- 58 focused pagination, bounds, deduplication and shared-location tests passed.
- 26 existing pin/relevance/fallback tests passed; the snapshot comparison additionally checks all826 features remain eligible at detail zoom with unchanged coordinates.
- Live source/API audit passed again at2026-10-14T15:23:46Z.
- Four-row forward/rollback rehearsal passed with exact before-state recovery.
- Full typecheck was interrupted after disk exhaustion; no typecheck pass is claimed. Removed only this run's generated webpack cache to recover space.
- Private receipts and checksums: `~/Desktop/Coach House Map Audit/2026-10-14-run05c/`. Full organization profile exports are not committed.

## Remaining gates and stop

User reviews progressive pins at `/resources` on localhost3123. No appearance redesign or visual-baseline update occurred. Review the exact data SQL and authorize its production application before switching the final statement to COMMIT; preserve returned rows, then verify858 eligible curated IDs after public cache refresh. Required current-head quality/code-owner gates remain separate from local checks.

Canonical SHIP revision40 remains blocked by recorded-host ownership; do not bypass ownership, alter the released head or claim this run is canonically released. Desktop packets and this lane carry the continuation evidence. Stop after the bounded data release and user map check, or report the remaining gate. No next workstream starts automatically.

Local preview checkpoint: localhost3123 is stopped after repeated ENOSPC during rebuild. Removed only task-local generated `.next`. Restore sufficient disk capacity before restarting and validating the route; no working preview is currently asserted.


### 2026-10-14T19:54:11+00:00 — Run05C resumed before Calendar

- User asked to finish PR304 first and identify Calendar folders. Calendar folders are Git worktrees holding previous integration/release work; deleting generated .next does not delete source. No Calendar source/cache cleanup performed. Existing release/provider receipts must be reconciled later; no Calendar implementation in this run.
- Resumed clean fix/existing-coordinate-map-coverage-20261014 and merged current main1aa443c5; resolved only the runlog append conflict by preserving both histories. No application/layout changes. Node22 localhost3123 is restored; /resources returns200, listener cwd verified. About76GB was available before rebuilding. User owns map appearance review; no fixture preview or browser walkthrough.
-55focused map cases pass. Fresh public-source/live API audit again matches854eligible curated IDs exactly across500+354 pages;16platform listings yield826markers/33shared locations. Four-row update/rollback rehearsal returns all four original null-coordinate/city rows with unknown accuracy and ends ROLLBACK. Production data remains unchanged. Provider contact addresses rechecked; Casa direct fetch still times out but official contact search index matches. Immutable resumed receipts: ~/Desktop/Coach House Map Audit/2026-10-14-run05c/resume-20261014/.
- Previous PR304 static/acceptance/RLS/build passed; visual/quality failed on2Resources detail tests and3Tools Drive snapshots. No baseline/tolerance changes. Current-head hosted checks/code-owner, user map check and exact production data approval remain; then apply/recount expected858curated listings. Canonical SHIP ownership blocker remains preserved. Stop after304handoff; Calendar follows separately.


## Casa authoritative-source gate

Before any production application, fetch the current Casa provider contact page successfully and match its published location to the exact saved target address. Search results alone do not satisfy this gate. If the provider cannot be fetched or its address differs, stop the four-row batch; revise/review a three-row batch excluding Casa instead of bypassing the guard. At the current review checkpoint the direct HTTPS contact response returned200 and matched the address. Private response/verification receipt are in the existing resumed audit directory; SHA256`823a2f5b605d02f0aa3a05a3a2741788f0d4f690ef981110dbb69e27b7b3a66e`. No production data was committed.


### 2026-10-14T20:43:00+00:00 — Run05C loading repair and authoritative Casa evidence

- User reported /resources endlessly loading with two markers. Mapbox public token exists, and the actual Standard style returns200 for localhost3123 and coachhouse.app referers. Local directory/map/IRS count/search APIs return200. Browser console access timed out and Bandto browser then disconnected; actual UI verification remains user-owned/pending. No credential/env/provider changes.
- Server/browser logs show rotating globe viewport requests changing everysecond. Each change supersedes all-page loading; requests during cold compilation/proxy delays can finish after the next viewport generation and be discarded. Overview globe now uses stable whole-world bounds below the shared spin threshold5; detail/flat views retain viewport bounds. Mapbox still clips the hemisphere and existing relevance/collision rules progressively reveal individual pins; no numbered clusters/layout/art changes.
- Count fetch had a five-second deadline while local cold compilation took15seconds, then left the count unresolved without retry. Shared count client now performs at most3bounded attempts with backoff, coalesces callers, caches only validated success and clears failed promises for later recovery.42focused tests pass (overview/detail/antimeridian/pagination, count timeout/retry/cache and location behavior), as do changed-file lint, features, boundaries and structure. Graphify AST update started.
- Addressed Codex Casa review with direct successful HTTPS provider-contact fetch, HTTP200 and exact address match. Private HTML/receipt saved; SHA256823a2f5b605d02f0aa3a05a3a2741788f0d4f690ef981110dbb69e27b7b3a66e. Plan/SQL instructions require fresh successful authoritative address verification before applying; search snippets alone are insufficient. Failure stops the four-row batch pending a separately reviewed Casa-excluded batch. No production corrections applied; prior data approval question remains pending.
- CI atba06fedf passes static/acceptance/RLS and compiles/types successfully, but fails /admin performance budget1003.3KB versus1000KB plus visual failures. No budget/baseline weakening or unrelated admin edits in304. Fresh-head quality/code-owner and user actual-map verification remain required. Stop after304; Calendar remains separate.


### 2026-10-14T20:47:44+00:00 — Correct actual-localhost resource configuration

- Found the primary cause of the two-marker localhost view: the shared root env configured a private preview JSONL missing in this worktree, and RESOURCE_MAP_PUBLIC_DB_ENABLED was absent. The index correctly returned an empty resource catalog; two platform markers were independent. Earlier HTTP200 checks did not establish nonempty local resource coverage. The854-ID audit was production-only until this correction.
- Restarted only owned3123 process with RESOURCE_MAP_LOCAL_PREVIEW_FILE='' RESOURCE_MAP_LOCAL_PREVIEW_INCLUDE_DISCOVERY=false RESOURCE_MAP_PUBLIC_DB_ENABLED=true. Shared .env.local, credentials, provider settings and other listeners unchanged. Node22 webpack /resources returned200 after42.5seconds cold compilation. Exact local-vs-production paginated IDs now match:500+354=854eligible curated resources; revisiona0e5f6eec6c57950397d598a. Receipt is in the existing resumed private audit directory/local-published-id-comparison.json. Listener PID17505/cwd is the isolated map-coverage worktree; cache698MB. Actual browser appearance remains user-owned/pending because Bandto control disconnected.
- Keep the separately tested rotating-overview/count-retry repair and direct-authoritative Casa gate at1ed5aa9b.42targeted cases, focused static checks and Graphify passed. Required quality/code-owner, user map confirmation and explicit four-row data approval remain. No production corrections committed.

Correct restart command (process-only configuration):

```sh
PATH=/usr/local/opt/node@22/bin:$PATH RESOURCE_MAP_LOCAL_PREVIEW_FILE='' RESOURCE_MAP_LOCAL_PREVIEW_INCLUDE_DISCOVERY=false RESOURCE_MAP_PUBLIC_DB_ENABLED=true pnpm dev --webpack --hostname 127.0.0.1 --port 3123
```
