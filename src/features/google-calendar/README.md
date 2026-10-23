# Google Calendar

Personal Google Calendar connections, private event display, and optional board export.
Workspace Tools has one switch: on starts setup or resumes a saved connection, off pauses
sync. The roadmap calendar opens settings, manual sync and disconnect controls.

## Ownership

- Domain logic: `src/features/google-calendar/lib/**`
- Server operations and synchronization: `src/features/google-calendar/server/**`
- UI components: `src/features/google-calendar/components/**`
- Controllers: `src/features/google-calendar/hooks/**`
- API composition: `src/app/api/integrations/google-calendar/**`
- Client imports use `@/features/google-calendar/client`; server imports use the public root.
- Cross-feature imports use public entrypoints. No route imports from feature code.
- Keep shared UI in existing shadcn primitives, lib pure, and server code free of UI.
- Acceptance: `tests/acceptance/google-calendar*.test.ts`.
- Database isolation runs with `pnpm test:rls:google-drive` and the full RLS gate.

## Behavior

Connection is per user, including for staff and board members. Google events never enter
organization events, public feeds, notifications, or shared workspace data. Calendars are
selected explicitly (up to five). Setup requests calendar list/event read permissions and
permission to create app-owned calendars; users denying the export scope can still import.
Export is off until selected and is limited to one authorized workspace at a time.
It creates a separate Google calendar; no invitations or default reminders are sent.
Google-native events open in Google for editing. Board events are edited in Coach House.

Sync Off cancels pending work through a new connection revision and hides personal events,
retaining selections and encrypted credentials. Disconnect removes the Calendar credentials,
OAuth intents, selected calendars and personal cache. It retains only Google account identity
and export destination IDs/fingerprints, preventing duplicate exports on reconnection to the
same Google account. Different-account reconnection resets all prior account state.

Disconnect never deletes Google events or revokes the shared Google project grant.
Google's revocation endpoint invalidates all project grants, including Drive/login.
The dialog links to Google account permissions with an explanation of that broader effect.
Drive feature disconnect now also removes only its own saved credentials.

## Synchronization

- Authenticated manual POST and a separately authenticated scheduler GET. Vercel uses
  its existing `CRON_SECRET`; custom schedulers can retain `GOOGLE_CALENDAR_CRON_SECRET`.
  The production cron entry runs every five minutes after deployment; the feature flag
  still gates all sync work.
- One database lease/revision per user serializes jobs. Settings, pause, disconnect and
  reconnect invalidate that revision. Before external work and before persisting its results,
  workers recheck the active lease. A Google request already sent can finish after pause;
  no subsequent work starts and stale responses cannot restore credentials or private data.
- Import uses paginated incremental cursors with identical query options. Expired cursors
  trigger a full refresh. Recurrence expansion is performed by Google.
- Cache covers three months back through twelve months ahead, refreshed fully every 30 days.
  The interface outside this window has board events only. Limit: 10,000 occurrences per calendar.
- Atomic cache+cursor saves make retries safe. Partial syncs never advance last successful sync.
- Board export reconciles current events and cancellations, uses stable IDs, sanitizes text,
  preserves all-day date boundaries and recurrence/time-zone metadata, and skips exported
  copies on import. Deleted export calendars are recreated; deleted events use a new ID generation.
- Every export rechecks current owner/admin/staff/board membership. Lost access stops export.
  Copies already exported remain in Google; later board changes are not sent.
- Worker processes at most ten due accounts in 45 seconds; each account is bounded by
  provider-request/page limits. Interrupted batches resume from committed progress.
  Accounts become due five minutes after success. Actual cadence depends on scheduler capacity.
- Provider quotas retry later; credential revocation requires reconnect. Private payloads,
  Google tokens, authorization codes and calendar titles are not logged.

## Configuration and activation

See [setup and verification](../../../docs/plans/2026-09-08-google-calendar-setup.md).
Feature flag defaults off. No database/provider changes are performed by mounting the UI.
