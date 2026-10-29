# Roadmap save acknowledgement — October 29

## Scope and evidence

User reports replacement pastes into Vision, Values and Theory of Change disappeared after navigation despite the editor saying Saved. Original04 stage4 /04a LIVE-09 reliability follow-up; preserve the shared SHIP40 record and unrelated lanes. New isolated `fix/roadmap-save-acknowledgement-20261029` at `/private/tmp/coach-house-roadmap-save-20261029`, based on current main `aedbf7e31` (merged PR363).

Read-only production investigation found no current-session replacement content for those three sections in the canonical roadmap, collaboration document JSON or version history. Vision is blank with an older nonempty version in history; Values and Theory of Change retain old text. A separate Mission paste was independently verified saved at17:31:22UTC. No production content was changed or restored. Existing browser recovery storage is implemented, scoped by actor/organization/section/client; this investigation did not inspect the user's browser or establish whether her missing drafts exist there.

Normal paste/save/reopen succeeds locally. The exact production sequence and browser failure remain unconfirmed. Two narrower defects reproduce against unchanged main in the component harness: closing before the debounce leaves the persisted document unchanged, and a mismatched document acknowledgement is treated as Saved and clears the recovery copy. These reproductions do not prove which path caused the reported incident.

## Patch

- Roadmap section selection awaits the live editor's save queue instead of unmounting/canceling queued or in-flight saves. Failures keep the current editor and draft open. Edits made during an in-flight save are drained before navigation.
- Foreground debounce, background polling and navigation share one in-flight request. Existing bounded retries, step batching, actor/organization authorization, atomic database writes and concurrent edit rebasing remain intact.
- Before Saved or recovery deletion, compare the acknowledged version and document against the editor state and require the canonical content to match the session projection. Mismatch or invalid response retains the draft and reports Not saved; it does not overwrite another writer with a client snapshot.
- Recovery availability says Unsaved draft available. The collaboration panel does not reuse a legacy toolbar save indicator.
- No schema, migration, role, account or provider changes. No speculative restoration of old content over current user work.

## Verification

- Node22 frozen offline install, route type generation, full TypeScript and scoped ESLint pass. Boundary and structure checks pass (existing unrelated size warnings only).
- Six Chromium component behavior cases pass: new/existing editing sessions, large formatted replacement pastes, close/reopen and full page reload, immediate navigation, edits during an in-flight save, offline recovery, revoked access, and mismatched acknowledgements. Existing fixture transport models durable server state across reload; this is not authenticated production acceptance.
- Both new failure-mode checks fail against main before the patch. Logs: `/private/tmp/roadmap-save-before-patch.log` and `/private/tmp/roadmap-save-final-browser.log`.
-50 focused acceptance cases pass across panel/recovery status, acknowledgement validation, rebasing, server persistence and authorization. The final acknowledgement helper extraction also passes the targeted Chromium regression; the other five browser cases retain their passing result. No visual appearance/baseline change; browser behavior ran with a temporary non-snapshot config because the screenshot suite correctly requires Ubuntu24.04/Playwright1.58.2.

## Delivery boundary

Prepare one focused PR. Caleb owns current-head hosted quality/review, merge, deployment and real-user paste/save/switch/reload acceptance. Do not claim Karen's exact incident is fully diagnosed or her missing text recovered. No migration needs application. The deployed application does not change until this patch is merged/deployed.
