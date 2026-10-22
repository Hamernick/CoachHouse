# Coaching calendar repair

User approved the rewritten urgent plan on October21. Scope: client-first titles,
existing upcoming invite title correction preparation, and joint-coach conflicts.

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

Implementation complete; preparing PR. No production changes.

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
- Ignored artifacts: `.tmp/coaching-browser/result.json`, `recovered.png`. Rerun:
  `python3 /Users/calebhamernick/.codex/skills/webapp-testing/scripts/with_server.py --server "python3 -m http.server 43187 --bind 127.0.0.1 --directory .tmp/coaching-browser" --port 43187 -- node .tmp/coaching-browser/check.mjs` with Node22 PATH.
- Application types final pass: `pnpm exec tsc --noEmit -p .tmp/coaching-tsconfig.json`.
- Hosted checks/review/merge/deploy, production migration, real incident cause,
  exact provider title-preview eligibility and recipient acceptance remain open.
- Commit/push/PR receipt follows after the normal hooks; no hosted polling.
