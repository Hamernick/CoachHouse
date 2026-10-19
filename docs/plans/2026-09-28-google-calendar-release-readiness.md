# Google Calendar release readiness — 2026-09-28

Calendar is the selected next lane. Caleb authorized production shipping after release
gates. Current effective status appears first; older dated checkpoints below are history.

## Current effective status — October16 Calendar activation

**Current selection:** Original04 stage5/LIVE-05 — Calendar event-edit crash. Caleb confirms the activation redeployment and says Calendar mostly works. PR336 is merged as7b3bce1c; Production flagtrue was saved/read back October19 and its five-minute scheduler is deployed. Import plus workspace export are selected. Read-only post-deployment metadata at2026-10-19T15:25:37.837Z shows caleb@bandto.com connected/enabled, two selected calendars,222imported events, one export destination/61tracked active exports; last completed sync15:20:06.481Z, no recorded error or lease. Counts are metadata, not independent Google/UI parity proof. Current code lane: `fix/calendar-event-edit-20261019`, isolated `/Users/calebhamernick/Development/coach-house-platform-calendar-event-edit-20261019`, base7b3bce1c. Reproduced the reported null.value exception in six lifecycle cases: deferred state updaters read React currentTarget after dispatch. Capture primitive values during the handler for title/details/start/end/recurrence-end; retain latest-state merging and existing Save persistence. Focused regression7cases plus58existing Calendar/roadmap cases pass (65distinct cases across8files); scoped lint, acceptance manifest, boundaries/structure/thresholds pass. No appearance/API/schema/provider change. [PR337](https://github.com/Hamernick/CoachHouse/pull/337) is open/non-draft; implementation `a3edd4ba982c7c40bf581a0ba669a356bae16b50` is pushed. Outgoing staged secret scan and normal Node22 prepush pass (7.38s). Affected component/test plus ambient declarations typecheck:6roots/645dependency files/zero errors. Caleb owns hosted checks/review/merge/deployment and real date-edit/save/reopen verification. The org-documents GET route explicitly returns404 for missing/untracked files; the bare preview:1 logs do not identify their full route. They are not the reproduced event-handler crash and no document/provider correction is inferred. Other worktrees, the prior Calendar checkout’s three local operational-doc edits, all servers and SHIP40remain preserved. No new server, live event/database write, cron invocation, credential change or deployment. Private post-deployment receipt: `~/.local/share/coach-house/fiscal-completion/2026-10-15/calendar-post-deployment-20261019.json`.

**Local validation — event-edit correction:** `pnpm exec vitest run` with `roadmap-calendar-event-edit`, `roadmap-calendar-month-agenda`, `google-calendar`, `google-calendar-service`, `google-calendar-cron` (all under `tests/acceptance/*.test.ts`):59cases/5files. Separate `roadmap-calendar-access`, `roadmap-calendar-concurrency`, `roadmap-calendar-board-reminders`:6cases/3files. New regression alone is7/7 after the typed harness correction. No duplicate counts:65distinct cases. Scoped ESLint, `pnpm check:acceptance-projects`, `pnpm check:boundaries`, `pnpm check:structure`, `pnpm check:thresholds`, diff hygiene and normal Node22 push hook pass. TypeScript program rooted at the affected component/test plus existing ambient declarations:6roots/645dependency files/zero errors; no full-build or unrelated-test-typecheck claim. No visual changes/baseline update. Source and new test were secret-scanned before upload.

**Recovery:** PR337 is open/non-draft with pushed implementation `a3edd4ba`. Graphify AST refresh completed21,552nodes/61,933edges; local code graph only, no claim of semantic documentation refresh. Final documentation is on this same PR; no additional deployment. Prior Calendar checkout/root/other lanes remain untouched.

### Historical October16 pre-activation audit

Caleb selected Calendar next under original04 stage5/LIVE-05, taking ownership of remaining fiscal UI/inbox checks. PR334 is merged (`122a386b`); Caleb reports its deployment succeeded, and the existing Vercel production page shows Ready at that commit. Fiscal migration20261016200000 is applied/verified; its preserved receipt documentation is carried into this branch rather than creating a separate deployment.

**Lane:** `fix/google-calendar-activation-20261016`, `/Users/calebhamernick/Development/coach-house-platform-calendar-activation-20261016`, base `122a386b`. Existing Calendar/fiscal/root/other worktrees and SHIP40 are preserved. No preview server is needed for this backend/configuration change; no OAuth port was claimed.

**Current read-only production audit:**

- `coachhouse` Production still has `GOOGLE_CALENDAR_ENABLED=false`. All seven Calendar variables plus `CRON_SECRET` are present. The public callback is `https://coachhouse.app/api/integrations/google-calendar/callback`; secret values were not revealed or changed. Saved CLI auth previously returned403 and was not retried; the signed-in Bandto browser provides read access.
- Vercel schedules only the three fiscal jobs. Supabase has page-health retention and coaching-calendar reconciliation, with no personal Google Calendar job. These are different integrations; do not change the coaching job or add a second personal Calendar scheduler elsewhere.
- Both Calendar migrations are applied. Both private tables retain forced RLS, with no anon/authenticated SELECT privilege.
- Exactly one saved connection belongs to `caleb@bandto.com`: connected/enabled, one selected calendar, workspace export configured, last synced September 12. Credentials are present but were not decrypted/refreshed or verified with Google. No Google event content was read or changed. Private metadata receipt: `~/.local/share/coach-house/fiscal-completion/2026-10-15/calendar-metadata-audit-20261016.json`.

**Narrow launch fix:** The existing route accepted only `GOOGLE_CALENDAR_CRON_SECRET`, while [Vercel sends `CRON_SECRET`](https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs). Accept either configured credential with the existing minimum 32 characters and timing-safe comparison. Keep unauthenticated/forged requests out of database/provider work. Retain the feature/configuration gate, per-user revision leases, ten-account/45-second bounds and privacy/export behavior. Add exactly one `*/5 * * * *` entry for the existing Calendar cron route to `vercel.json`; preserve the fiscal schedules and main-only deployment policy. Five-minute scheduling means288 nominal requests/day; actual freshness depends on due time, workload and hosting capacity. With the global feature off, valid requests retain503/not_configured without sync.

**Evidence:** Two Vercel-auth cases fail before the fix. All 40 focused Calendar cron/service/domain/concurrency cases pass after it; scoped ESLint, acceptance manifest, import boundaries and diff hygiene pass. Static configuration review confirms one new Calendar entry and the three unchanged fiscal jobs. No UI, RLS, database or Google provider behavior was changed. Graphify AST refresh completed21,541nodes/61,907edges. Structure/threshold checks also pass. [PR336](https://github.com/Hamernick/CoachHouse/pull/336) is open, implementation `3f4f0029760177b8a591629746a0f3955e799f96`. Outgoing secret scan and the normal Node22 prepush quality command pass. Git HTTPS push failed at DNS; GitHub’s API published the exact same commit/tree, and the branch SHA was independently matched. Documentation-only handoff follows on the same PR; source checks remain valid. Hosted quality/review, merge/release and the pending canary choice remain Caleb-owned.

**Activation boundary:** The existing connection has real workspace export enabled. A question is pending: import-only first, or retain import plus workspace export. Do not start cron/manual sync or flip the production flag until that side-effect scope is resolved. No live flag/provider/credential/scheduler/calendar changes have been made. Caleb owns current-head hosted quality/review, merge/release and live UI verification. Keep the existing Google approval and keys; no repeat approval or secret regeneration. Then verify import/privacy/pause/resume/reconnect/disconnect, with authorized export testing only if selected.

**Auth copy handoff:** Six numbered Markdown files, each with the exact subject and provider-ready HTML, are created in `/Users/calebhamernick/Desktop/Coach House Auth Emails - 2026-10-16/` and opened through VS Code. The HTML remains byte-identical to the reviewed raw exports, including auth placeholders and corrected recovery-token routing. Caleb will transfer/sync and verify them; no auth settings or emails were changed/sent by this packaging step.

## Historical status — 2026-09-28 02:25 EDT

- Candidate: [PR #257](https://github.com/Hamernick/coach-house-lms/pull/257), branch `feat/google-calendar-release-20260928`; never ship the mixed root. Integration and focused tests are complete.
- Single localhost: `http://localhost:3012/workspace?drawer=tools`, matching the registered callback. Earlier 3011 instructions below are superseded. Chrome awaits user login and appearance review.
- Hosted static, acceptance, RLS and build passed at `f8adcc98`. Current visual fixes retain existing baselines; final-head aggregate quality and required code-owner approval remain gates.
- Edge-case audit reproduced an export defect: timed recurrence end dates used UTC midnight, dropping late local occurrences. End dates now include the entire day in the configured timezone; six cases cover UTC, positive/fractional offsets and both US DST transitions. Five fail before the fix; all 27 Calendar/service cases pass after. All-day end dates remain date-only.
- Read-only live database audit confirms both Calendar migrations applied, both private tables have forced RLS, and anon/authenticated have no SELECT privilege. `pg_cron` is installed but has no job referencing Calendar. One existing enabled connection is overdue; no real sync or event writes were performed.
- Production Vercel access remains unavailable. Verify actual flag/keys/callback and any external scheduler before creating a job or activating. A scoped live canary and user review remain required. Do not repeat prior Google approval work.

## Initial audit (historical)

## Already implemented

- Main contains the Calendar feature, OAuth/API routes, encrypted credentials,
  private event cache, incremental import, optional board export, pause/resume,
  disconnect, authenticated cron handler, migration, and acceptance/RLS coverage.
- `src/features/google-calendar/**` and
  `src/app/api/integrations/google-calendar/**` are byte-identical between main
  and the scoped backup `chore/google-calendar-20260924` (`a1acccad`).
- AppShell/mobile is closed. Compose Calendar with its shipped implementation;
  do not reopen the general mobile lane.
- Google branding/data-access approval was recorded in the September 15 inventory
  assessment as confirmed September 14. Older setup instructions saying approval
  is pending are stale. Provider state was not independently inspected today.

## Remaining work, in order

1. Prepare an isolated release worktree from fresh main. Adapt the owned changes
   from `a1acccad`; do not merge the mixed root or old review branch wholesale.
   The backup patch has 41 files, including docs, fixtures and images, not 41
   unfinished runtime files. No new release worktree was created in this audit.
2. Integrate the missing Workspace Tools Calendar entry/status/switch and roadmap
   personal events/Google controls. Port the saved Calendar overlay lifecycle fix
   (unmount closed overlays, retain selected date/month) and focused regression.
   Preserve current AppShell/mobile behavior and current acceptance-manifest entries.
   Shared schema index changes in the backup are formatting-only; omit that churn.
3. Let Caleb review the working integrated UI: Tools setup and status, personal
   event display, Calendar settings, and close/reopen behavior on desktop/mobile.
   Use existing fixtures first. An authenticated local app may share production
   data; do not treat its connection controls as disposable test operations.
4. Read-only production configuration audit: Calendar flag, dedicated OAuth client
   and callback, Calendar API/scopes, encryption key/version, cron authentication,
   migration history, and actual scheduler. September 9 recorded Production
   variables present, flag false, migration applied and no scheduler; those facts
   need current verification. Main has a cron endpoint but no `vercel.json`.
   This does not prove an external scheduler is absent. Reconcile the older setup
   guide with newer approval/migration evidence; do not repeat approved setup.
5. Define an authorized canary account/calendar/workspace and cleanup scope. Prove
   timed/recurring/all-day import, visibility isolation from another member,
   pause/resume, reconnect, and disconnect without breaking Drive/login or deleting
   Google-native events. If optional export ships, prove authorized create/update/
   cancel, retry without duplicates and access-loss behavior in a disposable export
   destination. Reuse valid user evidence; avoid repeated consent as a generic retry.
6. Choose and verify scheduled-sync cadence and capacity. Code accepts an authenticated
   GET, handles at most ten due accounts within 45 seconds, and schedules successful
   accounts five minutes later. Confirm host support/cost before scheduler creation.
7. Run focused existing Calendar/service, roadmap, Workspace Tools and interaction
   checks for the integrated changes. Review visuals with Caleb before updating
   affected Linux references. Require current-revision hosted `quality`, code-owner
   review and branch protection; then separately authorize activation/deployment and
   verify production. Rollback: disable Calendar and stop scheduled sync, preserving
   encrypted connection rows and keys.

## Evidence and limits

- GitHub PR [#237](https://github.com/Hamernick/coach-house-lms/pull/237) is still
  draft/open at `6ce80db6`; its static, acceptance, RLS, build, visual and aggregate
  quality checks are green. It is historical evidence, not a current-main release.
- September 22 resume `508b8df0` recorded focused Calendar/roadmap/Tools 41 tests,
  Drive revocation 37 tests, static, full acceptance, RLS, build/performance and
  11 Calendar visuals passing. No tests were rerun during this read-only code audit.
- Production provider configuration, scheduler, deployed flag and live canary were
  not verified today. No provider mutation, application change, push or deployment.
- Root has only this audit/handoff documentation work; its application snapshot is
  preservation-only. Keep the root server and all existing worktrees intact.

Sources: feature README on main; the scoped backup patch; GitHub PR metadata;
`docs/plans/2026-09-15-calendar-inventory-assessment.md`;
`docs/plans/2026-09-08-google-calendar-setup.md`; September 22 monthly runlog.

## Implementation checkpoint — 2026-09-28

- Release branch: `feat/google-calendar-release-20260928`, based on `aa2fc54f`.
  Worktree: `/Users/calebhamernick/Development/coach-house-platform-google-calendar-release-20260928`.
- Remaining Tools and roadmap integration is ported. Calendar has the saved mobile
  sidebar entry and accessible close control, while keeping current Menu/dock/Details
  behavior. Closed overlays unmount and retain the selected date/month on reopening.
- Removed automatic development-only demo-event creation: opening an empty calendar
  must not create 60 records in the shared database. Explicit event creation remains.
- Preview: `http://localhost:3012/workspace?drawer=tools`. Private, ignored environment
  copies reuse the existing Calendar local callback and credentials; no provider
  configuration changed. Treat authenticated connection controls as shared-data writes.
- Node 22 evidence: 52 focused tests and seven existing mocked browser behavior tests
  pass. Feature/route/boundary/interaction/React Grab/scaffold/raw-button checks and
  acceptance inventory pass. Browser runs used an ignored temporary behavior-only
  config; no macOS visual comparisons or baseline updates. Preserved screenshots,
  including the two reviewed Linux setup references from `6ce80db6`, are restored
  as prior evidence only; current-head Linux CI and user appearance review remain.
- Read-only Vercel inspection returned HTTP 403 using the existing local CLI credential.
  Production flag, variables and scheduler remain unverified; no credential refresh or
  provider mutation was attempted. Google approval remains previously recorded evidence.
- Next: Caleb reviews this integration, resolve reported issues, complete authorized
  provider/canary checks, and pass current-revision hosted release gates.

Production build also passes under Node 22; Graphify code graph refreshed (19,381 nodes).

Final performance follow-up: the first integrated build exceeded the admin budget
(1,001 KB / 1,000 KB). Lazy-loading the Calendar action in the desktop header/mobile
sidebar resolved it without changing limits or removing controls. The final build
and all route budgets pass: admin 994.9 KB, community 607.4 KB, public map 1,821.9 KB.
Twelve shell/navigation tests pass after the lazy-loading change (56 unique focused
tests across the validation passes). Unauthenticated Calendar connection and cron
requests both return 401. Changed-file lint, structure and staged secret scan pass.

## Shipping authorization — 2026-09-28 02:05 EDT

Caleb requested testing in localhost and shipping live, without extra preview servers.
Stopped the additional 3012 server and the closed mobile checkout's 3011 server; the
Calendar candidate now uses the single localhost address `http://localhost:3011`.
Chrome is on the sign-in page; Caleb has been asked to sign in for UI review. The
registered local Google OAuth callback remains port 3012, so do not start Google
consent from 3011; real consent/sync verification is a separately scoped production
canary. No new provider callback was registered. Production shipping is authorized
once hosted quality, required review, UI review and activation gates are satisfied.
No manually created cloud preview is required.

## Current pre-release checkpoint — 2026-09-28 02:20 EDT

PR [#257](https://github.com/Hamernick/coach-house-lms/pull/257) is ready for code-owner review. Hosted static, acceptance, RLS and build passed at `618e60d7`; visual comparison found two mobile Calendar style mismatches and a Details focus race. Both fixes are scoped, with no baseline changes. Updated-head hosted quality remains required.

The single server now runs at `http://localhost:3012/workspace?drawer=tools`, matching the existing local OAuth callback. This supersedes the 3011 UI-only workaround above. No second server or provider registration was created. User login/UI review and actual production Vercel access remain pending. Production configuration, scheduled sync and a scoped real-data canary must be verified before activation.
