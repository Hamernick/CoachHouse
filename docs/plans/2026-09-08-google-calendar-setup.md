# Google Calendar setup and activation

Updated 2026-10-16. Use the [current release checklist](2026-09-28-google-calendar-release-readiness.md)
for implementation and validation status. Older verification submissions and recordings
are historical evidence, not instructions to repeat consent or provider setup.

## Product flow

Workspace Tools → Google Calendar switch → consent/setup → select up to five personal
calendars → optionally export the current workspace's board events → Save and sync.
Calendar settings are also available from the roadmap Calendar. Mobile opens Calendar
from the Menu sidebar; desktop keeps the header control.

Personal Google events are visible only to the connected user. Sync Off pauses work
and hides imported events while retaining settings and credentials. Disconnect removes
Calendar credentials/cache without deleting Google events or revoking Drive/login grants.
Optional export creates a separate app-owned Google calendar; it does not edit native
Google events or send invitations. Only currently authorized workspace events may export.

## Configuration

Required server-side variables:

- `GOOGLE_CALENDAR_ENABLED`
- `GOOGLE_CALENDAR_CLIENT_ID`
- `GOOGLE_CALENDAR_CLIENT_SECRET`
- `GOOGLE_CALENDAR_REDIRECT_URI`
- `GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEYS`
- `GOOGLE_CALENDAR_TOKEN_ENCRYPTION_CURRENT_VERSION`

Scheduler authentication: Vercel uses the existing `CRON_SECRET` (minimum 32 characters). A custom scheduler may instead use `GOOGLE_CALENDAR_CRON_SECRET` (same minimum); existing dedicated credentials remain supported.

Use the existing dedicated Calendar OAuth client and encryption key version. Never
regenerate an existing encryption key as setup; saved connections depend on it.
Registered callbacks previously recorded:

- `http://localhost:3012/api/integrations/google-calendar/callback`
- `https://coachhouse.app/api/integrations/google-calendar/callback`

Scopes: `openid`, email identity, `calendar.events.readonly`,
`calendar.calendarlist.readonly`, and optional `calendar.app.created`. Calendar API
enablement and Google branding/data-access approval were previously recorded. Verify
current configuration without restarting completed approval work.

The Calendar and consent migrations are in main and were previously recorded as applied:
`20260908160000_add_google_calendar_sync.sql` and
`20260909150000_accept_calendar_privacy_consent.sql`. Read-only live inspection on September 28 confirms both applied and both Calendar
tables have forced RLS with no anon/authenticated SELECT privilege. Do not replay them.

## Scheduled sync and activation

The scheduler calls `GET /api/integrations/google-calendar/cron`. Vercel sends
`Authorization: Bearer <CRON_SECRET>` automatically; custom schedulers can keep
`Authorization: Bearer <GOOGLE_CALENDAR_CRON_SECRET>`. Both must have at least 32 characters.
The current `vercel.json` change adds a five-minute schedule. It becomes a real job
only on production deployment; no manual provider job was created during development.

Each invocation handles up to ten due accounts within45 seconds. Successful accounts
become due five minutes later; actual freshness depends on scheduling alignment and
capacity. October16 read-only audit confirms no personal Calendar job in either Vercel
or Supabase. Keep the separate coaching-calendar reconciliation and three fiscal jobs.

Production remains globally disabled. Seven Calendar settings and the existing platform
scheduler secret are present, and the callback matches `coachhouse.app`. One real Caleb
connection has saved workspace export enabled; resolve the import/export test scope before
activation or sync. No key rotation or repeat Google approval is needed.

## Live canary

Agree the account, selected calendar, workspace, side effects and cleanup scope first.
Local authenticated previews can share the production database. Use mocks for routine
UI checks; never treat an existing real connection as disposable test data.

- Import timed, recurring and multi-day all-day events; verify another member cannot
  see them and private events do not enter shared/public feeds.
- Verify pause hides events and stops new work; resume and reconnect recover correctly.
- For optional export, verify create/update/cancel and retry without duplicates in an
  approved test destination, including stopping export when workspace access is lost.
- Verify disconnect removes credentials/cache without affecting native Google events,
  Drive or login. Do not revoke the shared Google project grant as a disconnect test.
- Clean up only approved artifacts. Deleting an exported Google calendar is separate
  from disconnect and needs explicit authorization.

## Rollback

Disable `GOOGLE_CALENDAR_ENABLED` and stop scheduled sync. Preserve encrypted connection
rows and all applicable key versions for recovery. No Google events are deleted by this
rollback. Production enablement/deployment and live verification remain separate gates.
