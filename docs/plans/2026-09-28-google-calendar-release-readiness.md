# Google Calendar release readiness — 2026-09-28

Calendar is the selected next lane. Caleb authorized production shipping after release
gates. Current effective status appears first; older dated checkpoints below are history.

## Current effective status — October16 Calendar activation

Caleb selected Calendar next under original04 stage5/LIVE-05, taking ownership of remaining fiscal UI/inbox checks. PR334 is merged (`122a386b`); Caleb reports its deployment succeeded, and the existing Vercel production page shows Ready at that commit. Fiscal migration20261016200000 is applied/verified; its preserved receipt documentation is carried into this branch rather than creating a separate deployment.

**Lane:** `fix/google-calendar-activation-20261016`, `/Users/calebhamernick/Development/coach-house-platform-calendar-activation-20261016`, base `122a386b`. Existing Calendar/fiscal/root/other worktrees and SHIP40 are preserved. No preview server is needed for this backend/configuration change; no OAuth port was claimed.

**Current read-only production audit:**

- `coachhouse` Production still has `GOOGLE_CALENDAR_ENABLED=false`. All seven Calendar variables plus `CRON_SECRET` are present. The public callback is `https://coachhouse.app/api/integrations/google-calendar/callback`; secret values were not revealed or changed. Saved CLI auth previously returned403 and was not retried; the signed-in Bandto browser provides read access.
- Vercel schedules only the three fiscal jobs. Supabase has page-health retention and coaching-calendar reconciliation, with no personal Google Calendar job. These are different integrations; do not change the coaching job or add a second personal Calendar scheduler elsewhere.
- Both Calendar migrations are applied. Both private tables retain forced RLS, with no anon/authenticated SELECT privilege.
- Exactly one saved connection belongs to `caleb@bandto.com`: connected/enabled, one selected calendar, workspace export configured, last synced September 12. Credentials are present but were not decrypted/refreshed or verified with Google. No Google event content was read or changed. Private metadata receipt: `~/.local/share/coach-house/fiscal-completion/2026-10-15/calendar-metadata-audit-20261016.json`.

**Narrow launch fix:** The existing route accepted only `GOOGLE_CALENDAR_CRON_SECRET`, while [Vercel sends `CRON_SECRET`](https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs). Accept either configured credential with the existing minimum 32 characters and timing-safe comparison. Keep unauthenticated/forged requests out of database/provider work. Retain the feature/configuration gate, per-user revision leases, ten-account/45-second bounds and privacy/export behavior. Add exactly one `*/5 * * * *` entry for the existing Calendar cron route to `vercel.json`; preserve the fiscal schedules and main-only deployment policy. Five-minute scheduling means288 nominal requests/day; actual freshness depends on due time, workload and hosting capacity. With the global feature off, valid requests retain503/not_configured without sync.

**Evidence:** Two Vercel-auth cases fail before the fix. All 40 focused Calendar cron/service/domain/concurrency cases pass after it; scoped ESLint, acceptance manifest, import boundaries and diff hygiene pass. Static configuration review confirms one new Calendar entry and the three unchanged fiscal jobs. No UI, RLS, database or Google provider behavior was changed. Graphify AST refresh completed21,541nodes/61,907edges. Structure/threshold checks also pass. Normal secret-scan/prepush/open-PR receipts follow.

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
