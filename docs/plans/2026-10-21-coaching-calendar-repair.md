# Coaching calendar repair

User approved the rewritten urgent plan on October21. Scope: client-first titles,
existing upcoming invite title correction preparation, and joint-coach conflicts.

## October22 existing invitation titles completed

User authorized preview/apply with guest update notifications. All8 upcoming
confirmed app-created invitations now have the exact saved-client-first title.

- Initial preview:8ready,0skipped/failed. First summary-only conditional PATCH
  succeeded, but strict readback stopped the batch when its protected digest changed.
  The original failure receipt is retained; the first event was never blindly retried.
- Inspection found completed `conferenceData.createRequest` metadata absent after
  the first edit. Its exact historical raw event was not retained by the initial
  preview, so complete pre-first-write equality cannot be reconstructed. Current
  times/Meet/event links match the stored booking, title propagated to Paula's
  attendee copy, and all fields stayed unchanged across later independent snapshots.
- Scoped verifier correction ignores only successful creation-request metadata with
  a valid conference ID and nonempty valid entry points. It still protects all
  conference IDs/signatures/entry points, Meet links, attendees/RSVPs and incomplete
  creation requests.39focused cases and scoped ESLint pass. This is an operator-only
  follow-up; no broker/web redeployment is required to run the corrected local CLI.
- Fresh raw snapshots and a fresh preview retained the exact7remaining titles,
  IDs and ETags; the first event skipped as already updated. Apply:7updated,
  1skipped,0failures. Independent full raw comparison proves all7 changed only
  title/bookkeeping and removal of completed creation metadata. All other fields,
  including times, attendees/RSVPs, signatures and meeting links, match exactly.
- Final independent GET verifies8/8expected titles. Each write used sendUpdates=all;
  delivery/read status of guest notification emails is not claimed. No event was
  recreated, no booking rows changed, and the first event received one write only.
- Private0600receipts under
  `~/.local/share/coach-house/coaching-calendar/2026-10-22/`: original title-preview
  and failed-first-batch receipt, fresh title-preview-resume and successful resume
  receipt, full before/final snapshots, booking-reference checks, recipient readback,
  and `title-final-verification.json`. Customer data stays outside Git.
- [Google's event reference](https://developers.google.com/workspace/calendar/api/v3/reference/events)
  distinguishes conference creation requests from established conference details;
  actual metadata removal is observed provider behavior, not an explicit documented
  guarantee. No broader normalization of conference data is allowed.

## October22 production broker and migration receipt

User merged PR346 as `bbfe4ae438810e141e03223009f141ba8694bcac`, then explicitly
authorized deploying the broker and applying the migration. Both are complete.

- Cloud Run `coach-house-calendar-broker`, us-central1: revision `00010-p6r`
  independently verified ready and serving100% traffic. Source is merged PR head
  `a06b5d53`; image SHA256 `38c9d805ced753c29bdbf8f31d9b88197b2b7893ef134dcb2fb8ecf30458d781`.
  Source deploy preserved an explicit old-revision traffic pin, so traffic was then
  deliberately switched to the new revision and independently read back. Existing
  environment and service account are unchanged. Read-only signed requests through
  an authenticated local proxy returned availabilityVersion2 for both coaches.
- Applied only migration `20261022010000` plus exact history entry atomically with
  the existing joint-calendar lock and bounded deadlines. Independent readback
  matches exact migration SQL, function body/security/search path, enabled trigger,
  denied anon/authenticated function execution and unchanged RLS/policies/other
  triggers. Zero active booking overlaps at preflight and readback; no row edits.
  Migration SHA256 `c87226f20a960dd8b37545de439ac1c2b768afba2932b46f3affa31357ff9368`.
- Private receipt: `~/.local/share/coach-house/coaching-calendar/2026-10-22/release/release-receipt.json`.
  SQL, before/after catalog and API verification receipts retained with0600permissions.
  Temporary proxy stopped. Rollback broker revision is `00009-hud`; do not roll it
  back alone while the new app requires availabilityVersion2.
- App deployment/real-user acceptance and exact existing-title preview/apply remain
  separate. No invitations renamed, emails sent or calendar configuration changed.
  Prior direct IAM-signing403 remains historical; broker access now works through
  the authorized proxy, without changing IAM permissions.

## October22 release continuation

User explicitly authorized the remaining release work. This supersedes the earlier
PR-only authority boundary below; required quality/review gates remain mandatory.

- Corrected both automated review findings: generic checkout notice consumes its
  URL parameter and stays dismissed after successful replacement, Back and reload;
  ICS first authorizes the booking through caller RLS, then resolves only that
  booking owner's saved name. Organization-member download access is preserved.
- Fixed the hosted feature-contract error by using the existing loaders facade;
  public index no longer directly exports server internals. No guard weakened.
- 47 focused cases pass; sticky-dismissal follow-up reran the affected13 cases.
  Real-component Chromium proves query cleanup, retained notes, replacement success,
  Back/reload dismissal and zero browser errors. Private proof:
  `~/.local/share/coach-house/coaching-calendar/2026-10-21/browser/notice-result.json`.
  Actions/router are stubbed; this is not authenticated production acceptance.
- Complete local static gate passes in53.61s, including lint, feature/import/structure
  guards and snapshots. Application TypeScript passes; final refresh recorded in handoff.
- Current prior-head hosted run39712226207 failed static plus inherited acceptance,
  build and visual checks. Exact-base main run39532273238 independently reproduces
  both acceptance failures, /admin3109.1KB against1000KB budget, and the same10 visual
  failures (Documents1, editor4, Find2, Tools3). PR /admin3109.4KB. These unrelated
  failures remain blocked per workflow-quality.md; no budget/baseline changes.
  Evidence logs: `/tmp/coaching-pr346-ci-failed.log` and
  `/tmp/coaching-base5baa0d35-ci-failed.log`. GitHub also requires one code-owner
  approval, strict current-head quality and resolved conversations.
- User restored GCP CLI authentication. Read-only service inspection verified
  `coach-house-calendar-broker`, us-central1, serving00009-hud; Joel/Paula primary
  calendars only, no additional blocking calendars configured. Direct IAM signJwt
  failed403 PERMISSION_DENIED, so exact event reads/title preview could not run.
  Do not broaden IAM permissions or retry blindly. Existing broker lacks the new
  title-event read operation. Private failure receipt:
  `~/.local/share/coach-house/coaching-calendar/2026-10-22/live-calendar-audit-private.json`.
- No merge, migration, deployment, event edit or email occurred. Next: clear inherited
  CI in its owning scope and obtain required review; deploy tested broker before app,
  apply exact migration with readback, then preview the exact upcoming title batch.
  The actual screenshot conflict and recipient-calendar acceptance remain unverified.

## Lane and authority

- Branch `fix/coaching-calendar-20261021`, isolated checkout
  `/Users/calebhamernick/Development/coach-house-platform-coaching-calendar-20261021`.
- Fresh base `origin/main` `5baa0d359f4812c47775f99b63aae8b2f1461e08`.
- Root dirt, other worktrees/listeners, and canonical SHIP revision40 are preserved.
  This user-selected repair ends at an open PR, not SHIP claim replacement/release.
- Original03 coaching/credit context and original WORKSTREAMS/SHIP read this session.
- Parent owns integration/migration; agents own titles/backfill, Google adapter/broker,
  and independent disposable PostgreSQL/live-read-only evidence respectively.
- No live event edit, email send, provider/config write, migration, merge or deployment
  is authorized by this implementation handoff. Prepare exact backfill first.

## Confirmed source findings

- New event summary omitted client identity; direct and broker updates only move time.
- Google availability reads cover one calendar per coach. Direct calendar errors and
  missing responses could become empty availability; final confirmation has no recheck.
- Database confirmation serializes confirmed overlaps but initial inserts/active holds
  were not atomic. Add one trigger using the existing joint-calendar advisory lock.
- Reschedule excluded every busy window sharing the original timestamps; use exact
  booking/event identity instead.
- These findings do not establish which defect caused the screenshot's actual conflict.

## Behavior and verification

- Canonical saved-client-name-first title, neutral fallback, consistent app surfaces.
- Title-only conditional upcoming-event updates, exact generic title matching, protected
  field readback, explicit notifications, skipped ambiguous/custom titles, private receipts.
- Fail closed on incomplete Calendar data; both coaches and configured blocking calendars;
  finalization and retry self exclusion; preserve purchased credit if slot is lost.
- Real PostgreSQL concurrent holds/confirmation, expiry/self update/RLS/credit rollback;
  focused adapter, backfill, finalizer, payment/retry, and affected client behavior checks.
- Broker and application deployments are separate. Required order and exact migration,
  operator preview/update commands and local/remote evidence will be finalized here.

## Current checkpoint

Implementation complete in open [PR346](https://github.com/Hamernick/CoachHouse/pull/346). No production changes.

### Implementation and local evidence

- Canonical titles resolve `profiles.full_name` using the booking owner, with
  Client fallback. Events, email meeting details, Google links and ICS agree.
- Both provider paths validate all configured blocking calendars. Exact verified
  iCalUID/organizer exclusion preserves unrelated same-time conflicts; bounded
  pagination and conservative all-day handling prevent incomplete availability.
- Finalization rechecks Google before debit. Definite conflicts release pending
  reservations; already-recorded purchased credit stays available. Concurrent
  cancellation cannot become a false confirmation or restored-credit promise.
- Migration `20261022010000_coaching_booking_conflicts.sql` protects active holds,
  confirmation and rescheduling using the existing joint-calendar lock. Expired
  holds do not block; half-open adjacent intervals remain usable. No data rewrite.
- Title backfill defaults to preview. Apply requires exact reviewed title/ETag/
  protected-field digest; summary-only writes preserve event identity/RSVPs/Meet.
  Custom, recurring, ambiguous, canceled/past, mismatched and pending events skip.
  Exclusive private0600 receipts journal before every write; independent readback
  verifies protected fields. Uncertain results stop the batch; never blindly retry.
- Stale-slot UI refresh preserves notes; paid-conflict notice uses shared Alert.
  `docs/design.md` layout/tokens/motion remain; no visual baseline was changed.
- Node22.13.0/pnpm10.28.0, task-local frozen-lockfile dependencies, successful Next
  route type generation. Shared root dependencies were not changed.
- 99 focused cases across eight coaching suites pass, including20title/operator,
  19provider-safety and18finalization/payment/recovery cases.
- `pnpm test:rls:coaching` passes real two-session reservation/confirmation races,
  expiry/null holds, self updates, credit rollback, payment/idempotency, reschedule
  rollback and RLS denials. `--without-fix` reproduces overlapping inserts. The
  check joins the existing `test:rls` merge gate; migration reapplies safely.
- Application TypeScript passes with `.tmp/coaching-tsconfig.json` covering
  `src/**`, `next-env.d.ts`, application declarations, excluding unrelated tests.
  Earlier full tsc had missing generated declarations/stale shared dependencies
  and unrelated acceptance diagnostics; no full-repository tsc pass is claimed.
- Scoped ESLint, structure/features/boundaries/routes/raw-buttons/thresholds pass.
  Final browser, Graphify, normal prepush and remote evidence follow below.

### Incident evidence and limits

Private receipt: `~/.local/share/coach-house/coaching-calendar/2026-10-21/booking-audit-private.json`
(0600inside0700directory).17recent/upcoming bookings;9upcoming confirmed, all
with saved client names/event IDs; zero pairwise app-booking overlaps. This does
not establish Google parity or backfill eligibility. Actual provider conflicts,
deployed blocking-calendar coverage and recipient rendering remain unverified:
existing GCP login requires interactive reauthentication, not blindly repeated
refreshes. No synthetic booking, email, event write, provider/config change,
production migration, merge or deployment was performed.

### Release and existing-invitation operation

1. Caleb reviews the PR; current-head hosted quality, required review and branch
   protection remain mandatory. Default handoff ends at an open PR.
2. After exact schema authorization apply only migration`20261022010000` and
   independently verify its function/trigger/permissions. Preserve ledger/history.
3. Deploy broker source `src/cloud-run/coaching-calendar-broker` before app;
   include `calendar-availability.mjs`. Verify `availabilityVersion:2`; new app
   fails closed against older broker. Confirm readable intended blocking calendars.
4. Deploy application separately. Web deployment deploys neither broker nor SQL.
5. Restore authorized provider access and run read-only preview below. Broker
   mode requires HMAC secret plus invoker authentication (production identity or
   authenticated local proxy); a saved broker URL alone is insufficient.

```sh
PATH=/Users/calebhamernick/.nvm/versions/node/v22.13.0/bin:$PATH \
pnpm dlx tsx@4.23.15 --conditions=react-server \
  --env-file=/absolute/private/production.env \
  src/features/coaching-booking/server/title-backfill-cli.ts \
  --output /absolute/private/coaching-titles-preview.json
```

6. Review exact ready/skipped/failed entries and `sendUpdates=all`: guests receive
   calendar updates. After explicit approval of this batch, use the same command
   adding `--apply --approved <preview.json>` with a NEW private receipt `--output`.
   Never overwrite an old receipt. Read back every event and one recipient calendar;
   old notification-email subjects are not rewritten.
7. Caleb verifies a client-first invite and blocked-conflict booking. External
   edits can still create later conflicts: Google and PostgreSQL are separate
   transactions. Existing reconciliation failures retain unresolved work; no new
   monitoring system or automatic destructive repair is introduced.

Rollback app and broker using their separate release receipts. Dropping the
data-preserving trigger is a separate reviewed schema action, never auto-retry.


## Final local verification

- Graphify full-root AST extraction and required `graphify update .` completed:
  21,895nodes / 62,898edges / 1,183communities. Ignored local graph only.
- Final scoped lint/diff hygiene and staged secret scan pass (no leaks).
- Chromium mounted the real CoachingBookingFlow and hook/shared controls with
  only server actions/router stubbed. Stale submit refetched availability1to2,
  retained exact entered notes, enabled a replacement slot and exposed the paid
  conflict notice as role=status; zero browser errors. All nonlocal network was
  blocked and the disposable server stopped. This proves browser interaction,
  not production auth/provider/SSR or appearance acceptance. No baseline changed.
- Private artifacts: `~/.local/share/coach-house/coaching-calendar/2026-10-21/browser/result.json`, `recovered.png`. Generated bundles were moved outside the repository after the first push hook correctly rejected vendor code inside the temporary browser harness. Rerun:
  `python3 /Users/calebhamernick/.codex/skills/webapp-testing/scripts/with_server.py --server "python3 -m http.server 43187 --bind 127.0.0.1 --directory /Users/calebhamernick/.local/share/coach-house/coaching-calendar/2026-10-21/browser" --port 43187 -- node .tmp/coaching-browser/check.mjs` with Node22 PATH.
- Application types final pass: `pnpm exec tsc --noEmit -p .tmp/coaching-tsconfig.json`.
- Hosted checks/review/merge/deploy, production migration, real incident cause,
  exact provider title-preview eligibility and recipient acceptance remain open.
- Open non-draft [PR346](https://github.com/Hamernick/CoachHouse/pull/346). Runtime implementation `895a64ef`; private-artifact documentation `b6e4f5d`. Normal Node22 pre-push checks pass in5.07s, including full repository lint. Local and remote `b6e4f5d22175d0ad1f4ff0f47da9de77077d5bfb` independently matched before this documentation-only receipt; source checks remain valid. Checkout was clean/upstream-synced. No hosted checks polled; final remote verification is recorded in the handoff.
- Resume `fix/coaching-calendar-20261021` in this checkout. Next: Caleb reviews current-head hosted gates/release; restore GCP access for actual blocking-calendar audit and exact read-only invite preview. Do not apply SQL, deploy, or rename live invites merely to close this handoff.
