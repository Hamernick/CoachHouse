# Brand Identity assessment — September 15, 2026

## Result

Assessment complete. Normal text saving and ZIP generation work. **Storage-failure
handling needs fixes before production.** This is a technical reliability finding;
the existing design and browser-only product direction remain intact.

Actual feature: `http://localhost:3000/documentation/tools/brand-identity#exports`.
The tool includes Foundation, Marks, Palette, Typography, Applications and Export.
There are nine image-upload slots. Text/settings live in localStorage, originals
in IndexedDB. No account/cloud sync or external provider setup is required by the
tool. The normal UI states Private to this browser and No account required.

## Status by boundary

| Boundary | Evidence |
| --- | --- |
| Product | Broader Documentation direction already accepted for eventual release. This assessment preserves its design and makes the local-storage boundary explicit. |
| Code | All 13 focused files match current root and Profile0101122d. Text edit/reload works; storage-error and transaction-acknowledgment defects remain below. |
| GitHub | Brand Identity exists in #229 and the preserved/#238/#239 stack; absent from inspected main. Nine component files differ between #229 and current Profile. The storage hook, storage module, export module and brand model are unchanged between those two versions. |
| Configuration | Browser storage and client-side file generation. No migration, OAuth or provider configuration change is required for this review. |
| Hosted checks | Profile0101122d still passes aggregate quality. Existing Brand Identity checks cover route, tokens/sanitization, ZIP signatures and a desktop screenshot; they do not establish the storage-failure behavior is correct. |
| Live check | Bandto localhost: changed Organization name from Your nonprofit to a temporary review string, reloaded and observed persistence, restored Your nonprofit and reloaded again. Original text value is restored; normal autosave updates its timestamp. Existing assets were empty and untouched. Export-section navigation works. |
| ZIP check | Called the actual package builder with a local 1px PNG fixture. Python zipfile validates the archive CRCs, four expected members, brand JSON, CSS tokens and byte-identical original PNG. No provider or browser account data used. |
| Deployment | Saved on GitHub and present in the held Profile Preview stack/current localhost. Not released to production by this review. |

## Required reliability fixes

1. **Asset-load failures falsely become Saved on this device.**
   `hooks/use-brand-identity-tool.ts:44` sets an unavailable-storage message, but
   the following finally block and text-save effect replace it with success.
   Isolated execution of the actual hook effects with rejected asset storage
   reproduces that exact message sequence. Keep text and asset status separate;
   retain the warning until the failing operation is recovered.
2. **Text-storage failures are uncaught.**
   The initial getItem at line32 and autosave setItem at line59 are outside error
   handling. Probes reproduce an uncaught blocked read (ready remains false) and
   an uncaught quota write while the previous Saved message remains. Catch reads,
   writes and removals, keep unsaved work usable, and provide honest recovery/export
   feedback. Delete/reset failure handling belongs in the same focused repair.
3. **Image writes resolve before transaction completion.**
   `lib/brand-identity-storage.ts:30` resolves on request success; the transaction's
   completion only closes the connection, and no abort handler exists. An isolated
   storage-API probe confirms saveBrandAsset resolves before any completion event.
   A later transaction failure cannot change that resolved result. Resolve after
   successful transaction completion; reject abort/error and close on all paths.
   [MDN transaction completion](https://developer.mozilla.org/en-US/docs/Web/API/IDBTransaction/complete_event)
   defines the successful commit event. This is a commit-acknowledgment requirement,
   not a claim of crash-proof disk durability.
4. **Initial-load/export boundary is unguarded.**
   The root tool does not pass ready or asset-load status to ExportsSection.
   Export starts with an empty asset array and can omit originals while loading or
   after a failed load. This is source-established; no early-download browser canary
   was run. Block an incomplete initial export or clearly identify recoverable,
   incomplete export state. Preserve existing assets and text throughout retries.

These were source/isolated-probe findings, not an observed loss of user assets.
The probes mock React state and browser storage; they are not a full React/browser
failure-injection test. No app source was changed in this inventory assessment.

## Evidence and validation limits

Artifacts: `/var/folders/l2/jpghvb_52t10fnrzxcs0bpd40000gn/T/coach-house-brand-identity-assessment-jUQjgm`

- results.json: normal/error effect outcomes, transaction timing and ZIP readback.
- probe.cjs: runnable source probes; syntax checked. Run from the repository root.
- source-hashes.json: inspected source SHA256 values and Profile commit.
- brand-review-fixture-brand-kit.zip / review-original.png: local ZIP proof.

Browser asset upload, replacement, deletion, reset and print were not exercised.
No existing browser storage was disabled or cleared. No model call, clipboard copy,
new Next server, full local suite/build, Graphify refresh, provider/account/database
change, commit, push, merge or release. Local notes and all existing dirt preserved.

## Next inventory feature

Documentation Marketplace/People. Keep the four Brand Identity reliability fixes
in the pre-release backlog. First-login drawer confirmation remains explicitly
user-deferred; do not reopen it as a prerequisite.


## September15 implementation follow-up

The four storage fixes above are now implemented locally with the user-requested Brand Identity guide/dropzone update. Focused failure/transaction tests pass; see the current monthly log entry “Brand Identity guide layout, examples, and individual dropzones” for scope and evidence. These changes are uncommitted in Profile and mirrored to root localhost, not deployed. Native browser file-picker/drop/reload and failure-injection checks were not performed; the earlier assessment should no longer be read as saying the source fixes are still untouched. Existing saved text is preserved; requested serif typography migrates to System Sans.
