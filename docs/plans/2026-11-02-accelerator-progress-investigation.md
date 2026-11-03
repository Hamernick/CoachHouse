# Accelerator progress reload investigation

## Status and scope

Implementation and deployment authorized November2. The local patch adds durable learner-specific step progress, acknowledgement before advancing, notes read/retry and conflict-safe draft recovery, plus non-destructive legacy-assignment-draft detection. Historical customer-marker recovery remains unapplied pending attribution. Original01 stage3, O100/O102/O105 regression scope. Branch `fix/production-investigation-20261102`, isolated worktree `/Users/calebhamernick/Development/coach-house-platform-production-investigation-20261102`, base `d6982380179e5145303e57c13caaac6fc725d75f`. Preserve original root dirt and unrelated SHIP40 claim. No production mutation, merge or deployment yet.

## Implementation checkpoint — November2

- Migration `20261102220000_durable_learning_progress.sql` adds versioned `module_progress.step_progress` and invoker/RLS RPCs for atomic step union and note-content compare-and-swap. Step writes preserve status, completed_at, notes and the first completion actor/time. Notes writes preserve steps/status. Duplicate note retries are idempotent; stale changes conflict.
- The three live Accelerator inputs bind both module and step writes to the expected organization. Reload seeds read acknowledged learner steps, retaining existing whole-module/assignment rules and filtering to current steps. Failed learner reads throw instead of returning zero progress. Existing board markers are preserved as recovery evidence, not trusted as learner completion.
- Step acknowledgement is required before advancing/counting. Duplicate clicks share requests; a late response cannot affect a changed account or navigate a different selected step. Section Next persists the step marker; existing answer autosave/submission semantics remain unchanged. Review found that forcing a whole-assignment submit on Next would block later required sections, so that draft change was removed before release. A step marker does not assert accepted/complete assignment answers.
- Notes block editing until loaded, retain scoped browser drafts after failures/navigation, retry without empty hydration writes, preserve newer edits after older acknowledgements, and show both versions before resolving conflicts. Existing open clients without a notes baseline retain the previous save behavior for compatibility; refresh clients after deployment to use guarded saves.
- Older unscoped assignment drafts are detected without displaying, uploading or deleting their contents. New scoped envelopes record version/module/scope. The owner-verified recovery procedure below remains required.
- Local proof: Focused acceptance checks cover step writes/hydration, scope changes, notes revisions, legacy drafts, board persistence and runlog structure. Real PostgreSQL support/learning RLS tests and two simultaneous-connection checks passed: both steps survive, only one conflicting note edit wins. Eleven Chromium scenarios exercised actual hooks with synthetic data/mocked server actions; failed-read and conflict UI captures use the actual Notes panel and compiled app CSS.
- Browser proof: private `patch-browser.cjs` / `patch-browser-results.json`, `notes-ui-review.cjs`; review captures under `test-results/accelerator-notes-{error,conflict}.png`. These are local behavior/review evidence, not authenticated production acceptance. No visual baselines changed.
- `next typegen` supplies ignored Next/image declarations in this fresh worktree; the initial raw typecheck failed without those generated declarations. Later typecheck found a test-fixture shape issue, corrected before final verification. Focused lint found two reserved-variable/closure issues, corrected. Structure check passed with existing unrelated warnings.
- Final focused lint, generated Next types/typecheck and Graphify AST update passed (22,486 nodes; existing Companion parser warning). Reviewed the actual Notes panel at mobile width; draft text stays selectable during conflicts. Review artifacts: [load error](../review/accelerator-notes-error.png), [conflict](../review/accelerator-notes-conflict.png).
- Read-only production preflight confirms existing `module_progress.status` defaults to `not_started`, and `step_progress` is absent. Schema migration must precede application deployment. Current branch protection requires `quality` plus one code-owner approval; no bypass is authorized.

PR [#366](https://github.com/Hamernick/CoachHouse/pull/366) is open; initial application revision `062b4120`. Normal pre-push checks and final typecheck passed. Current-head CI is running, independent approval is required. Private `recovery-candidates.json` lists the 11 unverified extra markers across ten modules; no recovery applied.

Review follow-up: automated PR review identified legacy-homework parsing and rejected-draft cleanup edge cases; both corrected with focused regression proof. Hosted CI caught the new monthly runlog heading format, corrected. The same CI run also fails two existing `document-controller-polling.test.ts:104` retry assertions; these reproduce locally, and neither that test nor `src/features/organization-document-collaboration/**` differs from base main. Under workflow-quality's unrelated-failure rule, merge remains blocked; user scope approval was requested asynchronously before investigating/changing that feature. Current main branch protection also still requires an independent code-owner approval.

Next: run hosted required checks on the final revision, obtain required independent approval, apply the exact additive migration with independent readback, then merge/deploy and verify. Historical customer recovery requires separately attributed step candidates; do not claim the reported 27% is restored by this forward fix.

Rollback: revert application code while retaining the additive column and captured progress. Do not drop customer step data. After all new clients are retired, the two new RPCs can be revoked/dropped separately; existing code does not depend on them. Never reset notes/submissions/status as rollback.

## Live incident and migration recovery

After the prior handoff, PR366 was merged externally at 22:53:50 UTC (`9f9afc2f9e7e1546e045c9f20f2446f6d393cdc5`); the intended coachhouse deployment reports success at 22:56:20 UTC. The required database migration had not been applied. The new dashboard query selected absent `module_progress.step_progress` and failed closed, producing the dashboard error boundary. Production page-health records show the affected owner repeatedly encountering `/workspace` errors after deployment, with digest `2247880048`; this client digest alone does not expose the underlying server exception. No evidence links video playback or granting edit access to the schema failure.

Recovery verified by November3 at 00:38 UTC (November2 local). The user explicitly directed applying the migration. Applied the exact merged `20261102220000_durable_learning_progress.sql` to the existing production project in one transaction, with 5-second lock / 30-second statement timeouts, a guarded migration-history insert, and PostgREST schema reload. Existing progress fields were fingerprinted under the table lock and asserted unchanged before commit. Independent readback confirms: column and both invoker/RLS functions present, authenticated execution allowed, anonymous execution denied, migration version recorded, all 200 existing progress records unchanged, and submission count still107. The direct PostgREST column query with the public key and limit0 succeeds; this proves API schema availability, not authenticated dashboard recovery.

Private receipts: `before-required-migration.json`, `migration-application-receipt.json`, `required-migration-readback.json`, `postgrest-schema-readback.json`, and exact `applied-required-migration.sql` in the existing private evidence directory. No customer-history backfill, notes edit, assignment edit, role/access change or account impersonation. Ask the affected users to refresh and confirm dashboard access. The original approximately27% remains unverified and is not restored by inventing history.

This section supersedes earlier pre-deployment status below. No application hotfix was needed to apply the already merged migration. The missing-schema incident is repaired at the database/API level; live acceptance remains pending.

## Verified findings

- Exact Auth email/name resolves to the ordinary member who owns the affected organization. There are three completed module-progress records from October21 and no assignment-submission rows for this identity. Current reads do not establish whether older submissions ever existed.
- The organization's saved board still contains 15 completed step IDs across 13 modules. Eleven step IDs across ten modules lack whole-module completion records. Its latest saved timestamp was November2; it is not a historical snapshot of the reported 27% display.
- PR364, commit `c052d10a`, removed persisted board completion IDs from `hydrateWorkspaceSeedAcceleratorState` in `src/app/(dashboard)/my-organization/_lib/my-organization-page-content-helpers.ts`. It now restores only steps derived from whole-module/submission statuses, including for the ordinary owner. The separate similarly named workspace-seed helper is not the changed function.
- Production deployment7420281941 for the intended `coachhouse` environment records success on October29 at source `d6982380`, which contains that change. This provider receipt does not establish an authenticated browser reproduction or a fresh live alias readback.
- Current curriculum has44 published modules; the existing checklist excludes three elective add-ons, leaving41. Three durable completed lessons yield7%. The prior approximately27% cannot be independently recovered from the available current snapshot.
- The active card also counts its primary visible completed step as a completed checklist lesson. Video/Next steps can update step-only state without completing the whole module. Discarding that state on reload therefore changes the displayed progress. A simple unconditional restoration must not reintroduce the shared-board/staff-context contamination PR364 was intended to prevent.
- Separately observed: fullscreen Accelerator input does not supply `onModuleComplete` or `onProgressChange`, unlike the embedded card. No claim that this separate path caused this report; validate the exact interaction before including a fix.

## Evidence and limits

Private directory: `~/.local/share/coach-house/production-investigation-20261102/`. `identity.json`, `learner-records.json`, `board-and-history.json`, `curriculum.json` contain read-only account/curriculum evidence; never commit these customer files. `read_query.py` uses the existing management credential without printing it, SELECT-only input and API read-only mode. Python requires `SSL_CERT_FILE=/etc/ssl/cert.pem` on this host; initial local certificate errors performed no query or mutation.

`reproduce.cjs` extracts and transpiles the exact current and pre-PR364 hydration functions using the existing TypeScript package. Its minimal timeline uses exact saved step IDs and current durable statuses: old function retains15, current function retains4, discarding11 across ten modules; resume step and input snapshot remain unchanged. Run with `/usr/local/opt/node@22/bin/node ~/.local/share/coach-house/production-investigation-20261102/reproduce.cjs`. Assertions pass; `reproduction.json` is the receipt. This is a function-level reproduction, not an end-to-end browser test or reconstruction of historical27%.

Graphify full-root AST extraction completed:21,968nodes/63,890edges; focused graph query confirmed the active helper and checklist callers. Existing Companion parse warning retained. No code changed, so no broad application tests were needed.

## Repair direction

Prepare an owner/account-scoped step-progress repair that survives reload without promoting unfinished assignments to durable whole-lesson completion or importing another actor's shared-board history. Cover ordinary-owner reload, organization/account switching, support access, and progress-bar consistency. Preserve the private before snapshot before any recovery operation. Any production data correction and release need their own concrete scope and authorization; no percentage backfill is justified from the report alone. The customer can be told that saved step markers still exist and the display restoration is faulty, but not that all historical answers are proven intact or the issue is already fixed.

## Follow-up: other PR364 regressions

User requested a wider assessment of the October28 change. Reviewed its application diff and current call sites; no application or production edits. Two additional behaviors reproduced in native headless Chromium with actual before/current hooks, synthetic data and mocked server actions:

1. **Existing browser-only assignment drafts become invisible.** `getAssignmentDraftStorageKey` changes from `assignment-autosave-<module>` to `assignment-autosave-v2-<org>:<actor>-<module>`. The hook reads only the new key; there is no old-key recovery flow. A valid unsynced draft restores before PR364 and displays blank afterward while the old bytes remain stored. Database-saved answers are separate. Restoring old unscoped drafts blindly would risk importing another account's text; recovery must establish ownership and preserve current server answers.
2. **Notes remain editable after a failed read but subsequent typing cannot save.** `useModuleNotes` now keeps `loaded=false` after a load error, preventing unsafe overwrites. `ModuleNotesPanel` still exposes an enabled textarea; blur, debounce and cleanup return without saving. The test observes a load-error toast, accepts newly typed text, and records zero save requests after blur/debounce. There is no retry or persistent unsaved/read-error UI from this hook. A successful-load control saves normally. Fix should keep failed-read write protection, disable/recover appropriately, and preserve typed text.

The same progress-hydration defect is not customer-specific: other owners with step-only progress can be affected. No customer-wide impact census or evidence of these additional failures in the reported account is claimed.

**Excluded from new-regression attribution:** lesson resume-position storage keys also changed, but the fixture resumes at0 instead of stored3 in both before/current hooks. Initial expectation failed; retained this as a preexisting behavior instead of blaming PR364. Old session completion flags likewise change namespaces; impact on the legacy sidebar is source-reviewed only, not an independently reproduced new failure.

**Do not revert PR364 wholesale.** The successful-read pre-change notes control unexpectedly saves an empty string during hydration before the typed note; current code avoids that overwrite. The change also intentionally isolates organization/account records and preserves support authorization. Repair the regressions without restoring those hazards.

Private reproduction: `review-browser.cjs` and `review-browser-results.json` in the existing evidence directory. Four before/after × failed/successful-read scenarios pass assertions using Node22, existing React/TypeScript tooling and installed JavaScript Playwright (Python Playwright unavailable). Actual hook source is bundled at `c052d10a^` and current `d6982380`; server requests are mocked and all browser records are fictional. Local HTML fixtures are outside the repo. This is a focused hook/browser reproduction, not a complete production journey. No database queries or changes in this follow-up. Source graph remains current because no application code changed.

## Proposed implementation plan — November2

Planning only. Caleb requested a more specific plan; this replaces the earlier high-level sequence. Implement in the existing isolated worktree when requested. Use one PR with separate progress, draft-recovery and notes commits. Migration application, historical data correction, deployment and customer acceptance are distinct gates. The investigation and private evidence above remain authoritative.

### Scope and fixed decisions

- Repair three reproduced outcomes: step progress disappears after reload; old browser-only assignment drafts become invisible; notes accept typing after a failed read but do not save.
- Preserve PR364 account isolation, selected-owner support access, ordinary-member privacy and protection against empty-note overwrites. Do not roll it back wholesale.
- Preserve the existing Accelerator-tab checklist percentage rule in this repair. Its current denominator is41 visible lessons, and its numerator can include lessons whose primary visible step is complete. Step completion and durable whole-module completion remain separate: no new accepted submission, credential/readiness qualification or `status=completed` is inferred from a watched video. This repair does not silently redefine the bar.
- Do not include the preexisting resume-position failure, a new recovery dashboard, bulk account modifications or unrelated layout work.

### Step 1 — Freeze recovery evidence and define affected scope

1. Keep the existing private account snapshot immutable. Before production recovery, fetch a fresh snapshot of only its module-progress rows, assignment metadata and board accelerator state. Compare by IDs/timestamps; preserve both versions if the user has worked since the first capture.
2. Prepare a read-only aggregate impact query: count organizations with valid board step IDs absent from owner module-progress/submission completion. Label these recovery candidates, not proven lost work or proven ownership. Do not enumerate customer identities in public docs. Browser-only draft incidence cannot be measured from Supabase.
3. Turn the three existing reproductions into fictional regression fixtures in the existing acceptance suites. Keep real customer IDs/content outside Git.
4. Preserve legacy board evidence during normal saves: the board save merge must retain the union of existing and incoming legacy completion IDs rather than replace it with the shorter hydrated list. This preserves recovery evidence only; it must not make those IDs trusted learner progress. New explicit completion resets, if later requested, need a separate contract.

Exit: before snapshots and reproducible failing tests exist; no production data was changed.

### Step 2 — Give completed steps a durable learner record

**Storage contract**

Prepare an additive migration for `public.module_progress.step_progress JSONB`, with a versioned empty default. The existing unique `(user_id,module_id)` is the owner of the new field. Proposed value:

```json
{
  "version": 1,
  "completed": {
    "video": { "recordedAt": "UTC timestamp", "actorId": "authenticated actor UUID" },
    "assignment:section-1": { "recordedAt": "UTC timestamp", "actorId": "authenticated actor UUID" }
  }
}
```

The module ID is the row key, so stored step keys are module-relative. Record new timestamps/actors on the server, never from browser claims. The field contains completion metadata, not note or answer text. Existing `status`, `completed_at` and `notes` are not overwritten by a step write. Update `src/lib/supabase/schema/tables/module_progress.ts` and the RPC type declaration.

**Write contract**

Add `saveModuleStepProgressAction({ moduleId, stepId, expectedOrgId })` beside the existing progress action, with a small helper if file-size boundaries require it. Authenticate, resolve the learning target through `resolveOrganizationLearningContext`, reject a changed organization, and validate module/step membership against the current allowed curriculum. Do not accept a target learner from the client.

Use an atomic database merge operation under the authenticated caller and existing RLS. It must create the progress row when absent, merge a new step without removing existing steps, retain the first acknowledged entry on duplicate retries, and return the persisted module/step record. Ordinary users cannot write another learner; support writes retain existing authorization, fresh-presence and audit requirements. Database bounds/type checks protect the JSON shape; app validation checks curriculum step identity. Do not introduce a service-role bypass for normal saves.

**Client interaction contract**

| User action | Required result |
| --- | --- |
| Video completion, Next, or other existing step-completion action | Persist that exact step; advance/count it as saved only after acknowledgement. |
| Explicit Complete lesson | Keep the existing whole-module action and its status rules; step metadata cannot weaken assignment validation. |
| Assignment submit | Preserve canonical submission behavior; add step progress only after the existing save succeeds. |
| Network/save error | Keep the current step and any typed values; display `Progress could not be saved. Retry.` Repeated Retry is idempotent. |
| Refresh or sign in again | Read acknowledged step metadata and whole-module/submission statuses; calculate the same checklist percentage. |
| Two tabs finish different steps | Both survive; last writer cannot erase the other step. |
| Account/org changes while a save is pending | Original scope remains bound; reject a mismatch and never apply an acknowledgement to the new screen. |

Wire the controller's direct step-marking calls, `useWorkspaceAcceleratorCompletion`, and panel Next/assignment transitions to this contract. Navigation alone must not count as completion. The embedded drawer, board card and fullscreen route receive the same save callback; specifically repair the fullscreen input's missing callbacks when wiring the save path.

**Read contract**

Load `step_progress` with the existing learner progress query; pass it through `my-organization-accelerator-timeline.ts` and the active page-content hydration helper. Union acknowledged learner steps with steps implied by already completed modules/submissions, filter to the current visible curriculum, and use the existing checklist calculator. A read error is an unavailable/retry state, not an empty successful progress result. Do not take the maximum of an old percentage and the new one or use all shared-board IDs as a fallback.

Files: `src/app/actions/module-progress.ts`, `src/lib/accelerator/progress.ts`, `src/lib/accelerator/organization-context.ts`, schema/RPC types, the active timeline/page-content helpers, `workspace-board-state-persistence.ts`, `src/features/workspace-accelerator-card/{types,hooks,components}`, and the three card-input callers.

Exit: complete a step in either surface, reload/sign back in, and get the same acknowledged completion and percentage. Existing notes, submission answers and whole-module timestamps are unchanged.

### Step 3 — Handle historical progress and old drafts separately

**Reported account's progress**

Use the saved15 step IDs as candidates, not a target percentage. Validate each candidate against its module and current step definition; distinguish the three durable completed modules from the11 additional markers across ten modules. The board's last updater identifies its last save, not authorship of every marker. Establish ownership through corroborating history or the affected owner's confirmation of the specific completed steps.

Prepare a private before/after candidate table. Any approved recovery adds only verified missing step entries; it does not create assignment answers, accept assignments, change notes or force an overall percent. Record recovery time/source as recovery metadata rather than inventing an original completion time. Use exact account/module guards and fresh-state comparison, merge rather than replace, then independently read back the result. Unknown or disputed candidates stay preserved and unapplied. There is no bulk migration from every organization's shared board.

**Browser-only assignment drafts**

The old `assignment-autosave-<module>` value has `baseSignature`, `updatedAt` and `values`, but no actor/organization identity. Matching a blank base signature is not ownership proof. Supabase cannot retrieve these local drafts; recovery requires the affected user's original browser/device.

1. Extend `assignment-draft.ts` with non-destructive legacy-presence detection. Keep v2 scoped drafts as the only automatic restore source. Do not read legacy text into an active form, display it under a different account, delete it or transmit it during detection.
2. When only an unattributed old candidate exists, display a compact `An older draft is stored on this device. Contact support to recover it.` notice. This is explicitly detection/preservation, not a claim of automatic recovery.
3. Use an owner-verified support procedure on that original browser for legacy text. No new privileged recovery API or general bypass is included. Where attribution cannot be established, leave the candidate untouched and do not import it. Document that this is a limitation of the old storage format.
4. For an attributable recovery, privately compare the candidate with the current server answers and any current v2 draft. If a newer/different answer exists, present both to the owner and require a choice; do not merge free text automatically. Copy confirmed content into the correct scoped draft before normal submission, and retain the legacy original until independent server acknowledgement.
5. Add explicit owner/module/organization/version metadata to newly written scoped draft envelopes without changing their existing v2 key. Existing correctly scoped v2 drafts remain readable. This establishes provenance for future recovery without retroactively assigning owners to unscoped data.

Exit: current v2 drafts still restore, old candidates survive upgrade, switching accounts never exposes another draft, and the support procedure specifies when recovery is possible or must stop. A generic notice alone is not reported as recovered work.

### Step 4 — Repair notes loading, retry and draft preservation

Expose `loadState: loading | ready | error`, `saveState: idle | saving | error`, and `retryLoad`/`retrySave` from `useModuleNotes`. Update the existing `ModuleNotesPanel` in `module-right-rail.tsx`:

| State | UI and persistence behavior |
| --- | --- |
| Initial loading | Disabled textarea, `Loading notes…`; no autosave. |
| Read fails | Disabled textarea, persistent `Couldn't load your saved notes.` and Retry; no writes. |
| Retry succeeds | Show loaded content, enable editing; initial hydration must make zero save requests. |
| User edits | Existing debounce/blur behavior; track the draft against the loaded baseline. |
| Write fails | Keep text visible, show `Notes couldn't be saved.` and Retry; never show Saved. |
| Scope changes or unmounts with unsaved text | Retain a draft under the original actor/org/module scope; never send it to the newly selected organization. |

Use a small browser draft envelope containing scope, value and its loaded base text/revision for unsaved notes; clear only after the exact submitted value is acknowledged. On retry/reopen, load the server first: if it still matches the draft baseline, restore the user's draft; if it changed, retain both and ask which text to use rather than overwrite. Any conditional recovery write must guard that baseline atomically; progress-only row timestamp changes must not be mistaken for note-content conflicts. Reuse existing UI primitives and keep all error/recovery controls in the current notes panel.

Retain the failed-read write guard and original-organization argument in both the server action and keepalive route. Do not restore the pre-change `setLoaded(true)` on read failure. If saving fails after a newer edit, an older acknowledgement must not clear the newer draft.

Exit: the failed-read fixture cannot accept silently unsavable typing; successful loading never writes an empty note; failed writes/retry/reopen preserve typed content and correct ownership.

### Step 5 — Required evidence before opening the PR

Extend existing acceptance files where possible: `accelerator-progress-persistence`, `organization-learning-context`, `workspace-accelerator-card-checklist`, the page-content/seed suites and assignment helpers. Add focused hook/browser cases rather than a new testing framework.

| Case | Must prove |
| --- | --- |
| Existing three completed modules plus additional saved steps | Hydration preserves verified step state; no promotion to accepted assignments or whole-module completion. |
| Duplicate save and two-tab concurrent save | One logical marker per step; both independent steps survive. |
| Save/read failure and retry | No false saved state, no reset-to-zero fallback, no lost typed work. |
| Owner A, ordinary member B, support actor, revoked support | Only the correct authorized learning target can be read or changed. |
| Organization switches during pending response | Original write target and new UI state remain isolated. |
| Embedded drawer and fullscreen | Same save API, completion rules and reload result. |
| Legacy/v2 draft; newer server answer; wrong account; malformed data | Appropriate restore or preservation, no silent overwrite/exposure. |
| Failed notes read, successful retry, subsequent failed write | Correct disabled/error/ready states; retained draft; zero hydration writes. |
| Older note-save response arrives after a newer edit | Newer draft survives. |
| Old client/module-complete/note upsert after schema addition | New step metadata and old notes/status survive omitted fields. |

Run SQL/RLS/concurrency cases in a disposable database, then focused browser cases using synthetic accounts. Preserve commands, revisions and receipts in this checkpoint. Use Node22, changed-source lint/type/structure checks, normal pre-push hooks and one Graphify maintenance pass per cohesive slice. Do not run full local quality or broad screenshot matrices merely for reassurance. Caleb reviews the changed recovery/error affordances before any necessary visual-baseline update.

### Step 6 — Release order and acceptance

1. Open one PR with the three focused commits, exact migration, local evidence, preview links and known recovery limitations. Caleb owns hosted quality/review/merge; do not poll those stages by default.
2. After explicit approval, apply only the additive migration and independently verify schema/RLS/compatibility. Deploy the reviewed application only after required hosted quality and branch-protection gates pass.
3. Apply any separately approved historical recovery using the concrete candidate list and fresh preconditions. This is not implied by approving a schema migration or code deployment.
4. Verify the intended production revision, the affected Accelerator tab and the resulting percentage from actual records. Reopen, refresh and sign in again; it must remain consistent. The expected value is not hardcoded27%.
5. Confirm existing saved notes/answers remained unchanged and record the affected user's acceptance. No customer email or account-wide repair is included without instruction.
6. If the release fails, revert the application while retaining populated new columns and private recovery evidence. Do not drop the new field or undo historical data by overwriting newer customer work; any data rollback requires an exact scoped comparison.

The three fixes are complete only with working UI/save/reload behavior, appropriate local and hosted evidence, and separately recorded production acceptance. Until then, report the exact outstanding gate.


## Platform edge-case audit — November 2 follow-up

User requested a wider bug hunt after migration recovery. Scope: original `01-production-stability.md`, stage 1 diagnosis across dashboard, Accelerator storage/progress, organization invitations, document saves, auth/recovery, billing/webhooks and route aliases. Fetched main `9f9afc2f9e7e1546e045c9f20f2446f6d393cdc5`; `git diff HEAD origin/main --stat` is empty at investigation head `f856359a`. Reused this isolated lane for inspection and ignored reproductions; no application changes, production writes, new release slice or SHIP changes.

### Confirmed findings

| Priority | Trigger and observed behavior | Evidence | Narrow repair |
| --- | --- | --- | --- |
| P1 | Accelerator mounts with browser storage blocked or full: unguarded storage effects throw and reach the React error boundary. Storage is optional because acknowledged learning records are server-owned. | Actual `useWorkspaceAcceleratorCardController` bundled into Chromium: normal storage renders; throwing localStorage getter and quota-exceeded setItem each render the error boundary. Source: controller lines 98, 281–297. | Make optional position/cache reads and writes failure-tolerant; retain server acknowledgement requirements and do not discard recovery drafts. Verify blocked reads, quota errors and ordinary reload. |
| P2 | Dashboard error screen offers Organization as its fallback, but `/organization` redirects to `/workspace`. Persistent workspace failure returns the user to the same failing route. | `src/app/(dashboard)/error.tsx:39`, `organization/page.tsx:12`; real alias behavior passes in `workspace-route-aliases.test.ts`. Progress read failures also reject the workspace-wide Promise.all. | Offer an independently loadable recovery destination; isolate failed Accelerator loading within its surface with retry and saves disabled until a valid read. Never substitute zero progress. |
| P2 | An unconsumed invite can overwrite an existing member's newer role. Membership upsert and marking the invite accepted are separate operations; a partial acceptance or another invitation path can leave the older invite available. | Actual acceptance action, mocked transport: current staff membership plus pending member invite returns success and writes member. `invites-acceptance.ts:84–106`. Production snapshot: one live unconsumed invite, zero targeting an existing member, zero role mismatches. | Atomically consume a valid invite and add membership without overwriting an existing role; cover retries, changed/revoked invite and partial-failure cases. Review equivalent access-request acceptance path. |

These reproduce mechanisms, not evidence that blocked storage or stale invites caused the reported incident. No customer role/data repair was performed.

### Verification and limits

- Existing focused suites: 25 files, 333 cases; 331 pass, two failures at `document-controller-polling.test.ts:104`.
- Those two failures are stale test fixtures: mock editor lacks `doc.eq`/`schema.nodeFromJSON`, and mock session lacks `section_content`. The current acknowledgement guard correctly fails closed. An isolated fixture-only control supplies those acknowledgement members; all six polling tests pass without changing application code. This control is not a real-editor end-to-end test.
- Additional invite reproduction and the fixture control: 28 cases pass, including reused cases; do not add these to the 333 distinct existing-case count.
- Chromium storage audit: normal control passes, both injected storage failures reproduce the crash. Used the webapp-testing skill for native Python Playwright execution against bundled actual hook code with synthetic data; no authenticated customer browser use.
- Production migration history has 285 versions; every migration version in current main is present. This is version parity, not proof of every historical SQL body or every provider contract.
- Read-only page-health query at approximately November 3 01:24 UTC: no recorded events after the recovery. Latest stored incident events remain November 2 23:31 UTC. Absence of telemetry is not affected-user acceptance.
- Other November 2 telemetry leads: one chunk-load failure, one React #310 error, one public-profile React #418 error, two ResizeObserver errors and one generic load rejection. No reproductions or exact causes established; do not combine these with the confirmed findings or infer outage counts from event counts.
- Authenticated production journeys, email delivery, real Stripe checkout, provider integrations and full platform/browser coverage were not exercised. Required hosted quality/review/release gates remain separate.

Private receipts remain under `~/.local/share/coach-house/production-investigation-20261102/`: `audit-schema-inventory.json`, `audit-health-recent.json`, `audit-invite-exposure.json`, `audit-storage-bundle.cjs`, `audit-storage.py`, `audit-storage-results.json`. Ignored `test-results/platform-audit/` contains the fixture control, invite reproduction and explicit Vitest config. Node22 focused runs are recorded above; original tests and application source remain unchanged.

Next repair order: storage crash protection and dashboard recovery, then transactional invite acceptance; correct the two stale polling fixtures without weakening acknowledgement checks. This audit is local documentation/evidence only, with no new PR or deployment. Affected-user authenticated refresh confirmation and separately reviewed historical progress recovery remain open.


## Urgent patch plan and disruption review — November 2

User requested a concrete fix/ship plan, then asked for a zero-disruption check. This is a plan and source-level risk review, not implementation or release acceptance. Zero production risk cannot be guaranteed. Current audited source remains main `9f9afc2f`; re-fetch before implementation. Preserve this lane's uncommitted incident/audit documentation and create the implementation lane from current main; do not reset the dirty root or overwrite other workstreams. Original01 stage1/4 scoped repair; SHIP40 ownership state remains unchanged.

### Release A — smallest urgent application patch

1. In `src/features/workspace-accelerator-card/hooks/use-workspace-accelerator-card-controller.ts`, guard every optional browser-storage read/write/removal, including access to `window.localStorage` itself. Keep existing key names, formats, organization/account scope, step identifiers and server acknowledgement rules. A failed cache write must not block navigation or turn a successful server save into failure. Do not clear storage, migrate draft keys or alter notes/assignment persistence.
2. In `src/app/(dashboard)/error.tsx`, retain Retry and replace the `/organization` loop with an accurately labelled support/recovery destination. Use existing `/status` (outside the dashboard route group) with a full document navigation, and verify its root/header dependencies under an injected workspace failure. The page explicitly says automated status reporting is unavailable; do not label it live health or make a new status system. Preserve existing shared accessible controls; no automatic logout or forced reload while users are working.
3. Correct only missing acknowledgement members in `tests/acceptance/document-controller-polling.test.ts`. Match the actual editor/session contract; retain negative mismatch assertions so the fix cannot weaken false-save protection.
4. Extend existing behavior tests with normal storage, blocked getter/read, quota-exceeded write, failed removal and malformed data. Reuse the actual-hook Chromium reproduction for before/after evidence. Check server-acknowledged progress survives reload, a rejected save cannot advance, duplicate clicks share one request, and changing organization during a pending response cannot update the new context.
5. Exercise the actual dashboard error UI and its destination with workspace failure injected. Check mobile and desktop keyboard behavior, successful Retry after recovery, and unaffected successful dashboard loading. Use synthetic accounts/data; production customer identities are not test fixtures.

Release A changes no database schema, membership role, billing contract, progress calculation, saved notes or assignment format. It leaves broader workspace failure isolation for Release C below. Changes should be one small PR with focused Node22 lint/types/tests, normal pre-push and required current-head hosted quality/review. Review only affected visual baselines if the recovery control intentionally changes them; never weaken thresholds.

### Release B — invitation integrity, separate migration and PR

1. Replace the separate membership upsert/invite-consumption writes in `organization-access/invites-acceptance.ts` with an atomic database operation. Cover the equivalent acceptance path in `organization-access/requests.ts`; otherwise users can reach the same overwrite through in-app requests.
2. In the transaction, lock/revalidate the current invite or request; verify authenticated recipient, confirmation requirements, organization, permitted role, expiration and active state. Insert membership only if absent. Existing membership role and created_at remain authoritative; return the actual current role. Retries must not recreate a revoked member from a consumed invitation. Keep explicit owner role-management actions separate.
3. Coordinate acceptance with existing revoke/update operations using conditional state transitions/locking. Two acceptances, revoke-versus-accept and role-change-versus-accept need deterministic outcomes. Current valid onboarding, active-organization selection, directory entries and notifications must still work after commit; do not send duplicate mail as part of testing.
4. Add an additive migration with narrowly scoped grants and explicit server authorization. Run real disposable-PostgreSQL/RLS tests for wrong recipient, expired/invalid/revoked invite, duplicate acceptance, existing higher/lower role, concurrent accept/revoke, and injected failure between membership and consumption. Verify both committed together or neither did.
5. Prove old deployed application compatibility before applying the migration. Old application callers must continue functioning during rollout; new app deployment waits for independent live function/signature/grant readback. Do not assume migration history alone proves readiness. No bulk membership repair or invite replay is included.

The audit's production snapshot found no current mismatched pending invite/member, so Release B must not delay Release A. No claim that all races or historical memberships are unaffected is supported by that snapshot.

### Release C — isolate Accelerator loading failures

This is a bounded resilience follow-up, not a prerequisite for Release A. Current workspace composition uses progress for metrics, module partitioning, timeline construction and board hydration. Returning empty groups/zero totals would flow through `hydrateWorkspaceSeedAcceleratorState`, replace active/completed display state and could contaminate subsequent board persistence.

Introduce an explicit unavailable state through the existing workspace seed/card boundary. Preserve the last saved board state; do not synthesize zero progress or mount editable lesson controls until a valid read succeeds. Keep independent workspace tools available, show a scoped retry, and prove that any unrelated board save during the outage preserves accelerator state exactly. Tests must cover failed first load, failed refresh after prior success, recovery, support/member scope and concurrent board edits. Do not combine this state-contract change with the emergency storage guard.

### Release checklist and rollback

- Before each PR: record exact source revision, failing-before/passing-after evidence and scoped checks. Reuse the 333-case audit as baseline only where files/contracts remain unchanged; run affected dependent cases after changes. Complete hosted quality and branch-protection/review requirements remain mandatory.
- Validate old open tabs plus a newly loaded tab across the candidate deployment, using controlled test accounts with synthetic drafts. No forced sign-out, cache purge or auto-refresh. A deployment can still affect an in-flight server action; verify recoverable errors retain drafts and do not falsely acknowledge saves.
- Before production promotion: pin the known-good deployed revision as rollback target. Release A has no migration; verify its required existing progress schema/RPCs read-only. For Release B, apply the reviewed additive migration first, then independently read back schema, signatures, grants and representative unchanged membership records before deploying its callers.
- After promotion: verify the intended production project/revision, authenticated owner and invited-member dashboard access, successful progress save/reload, notes retention and recovery navigation with a controlled account. Monitor route errors and failed-save signals; a quiet telemetry stream alone is not acceptance. Obtain affected users' refresh confirmation without editing their records or sending messages unless instructed.
- Roll back the application on new access failures, crashes or save regressions. Preserve all customer data and additive schema. For Release B, rolling back app code restores the previous invitation weakness; stop and assess invite acceptance safely rather than deleting memberships, replaying invitations or dropping schema. Any data repair requires exact reviewed affected records.
- Release completion means required checks/review plus deployment verification and specified live acceptance. Until the patch exists and these checks run, mark disruption risk as assessed, not eliminated, and deployment readiness as unproven.

Current status: plan saved; no patch implementation, database mutation, new PR, deployment or user-disruption guarantee. Existing migration recovery remains intact. Recommended order: Release A immediately after its gates, Release B next, Release C after its explicit state/persistence proof.


## Release A implementation — November 2

Active branch `fix/dashboard-storage-recovery-20261102`, worktree `/Users/calebhamernick/Development/coach-house-platform-dashboard-recovery-20261102`, base main `9f9afc2f`. Earlier investigation checkout and its local incident evidence remain preserved. This section owns the active implementation handoff; earlier audit/plan descriptions are historical states.

Implemented only Release A:

- Optional Accelerator position/completion-cache operations now tolerate blocked storage access, read errors, quota exhaustion and failed removal. Keys, formats, learner/org scoping, server acknowledgement, step/whole-module completion and notes/assignment drafts retain their contracts.
- The dashboard error screen retains Retry and uses a full-document link to the existing public `/status` support page. This exits the failed dashboard route tree. Both controls have minimum44px height, shared Button styles, native semantics and focus behavior consistent with `docs/design.md`. The scoped anchor lint exception documents why this recovery action intentionally uses full navigation.
- Polling tests now use actual ProseMirror document/schema equality plus the session's section_content. Added document/version/content mismatch cases; unsaved state stays protected. No document-controller application code changed.

Validation at this working revision:

- `pnpm exec vitest run tests/acceptance/workspace-accelerator-storage.test.ts tests/acceptance/document-controller-polling.test.ts tests/acceptance/accelerator-progress-persistence.test.ts tests/acceptance/durable-learning-progress.test.ts tests/acceptance/public-status-page.test.ts tests/acceptance/workspace-route-aliases.test.ts tests/acceptance/organization-document-write-safety.test.ts tests/acceptance/organization-document-collaboration.test.ts`:59cases pass.
- Changed-file ESLint, TypeScript `pnpm exec tsc --noEmit`, `pnpm check:structure`, `pnpm check:workspace-storage`, manifest update and diff hygiene pass. Initial fresh-checkout type run preceded Next's generated image declarations; rerun after normal Next generation passes, without app/config/type changes. Structure emits existing near-budget warnings.
- Actual React-hook Chromium run:11save/recovery scenarios pass, including failed saves, reload retention, conflict choices, duplicate step requests and scope switches. Before/after optional-storage harness: blocked getter and full quota previously crashed; all three patched cases (including normal control) render successfully.
- Actual DashboardError component + shared app CSS, injected render failure: keyboard Retry recovers; keyboard Get help performs document navigation to the real local Next `/status`, HTTP200, with workspace requests deliberately blocked. Mobile390px, desktop1440px, wide2560px and mobile dark mode pass touch-target/overflow checks. [Mobile](../review/dashboard-recovery-mobile.png), [dark](../review/dashboard-recovery-mobile-dark.png), [desktop](../review/dashboard-recovery-desktop.png), [wide](../review/dashboard-recovery-wide.png). These are macOS review captures, not Linux visual baselines. No existing dashboard-error visual baseline was identified or replaced; required hosted visual checks remain.
- Preview `http://localhost:3162` serves the actual recovery component with synthetic failure; Retry clears it, Get help navigates to real Next `http://localhost:3161/status`. Local Next uses synthetic non-production Supabase settings; no customer authentication or provider writes. Session87266 owns Next; preview session is recorded in the private execution receipt.
- Browser receipts/scripts live privately under `~/.local/share/coach-house/dashboard-recovery-20261102/`. No customer content or credentials are included in tracked screenshots/tests.

No schema/migration/authorization/billing/data edits. Invitation integrity (Release B), explicit unavailable-state isolation (Release C), authenticated deployed-candidate/open-tab acceptance and affected-user confirmation remain separate. Local evidence is not hosted quality, review or deployment proof. Next: Graphify maintenance, normal pre-push, PR and required current-head release gates; preserve records and the additive migration during any app rollback.
