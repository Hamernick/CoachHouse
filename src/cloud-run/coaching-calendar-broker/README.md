# Coaching Calendar Broker

Small Cloud Run service for Coach House coaching calendar writes.

The main app runs on Vercel and must not store Google service-account private keys. This broker runs on Cloud Run with the `coach-house-coaching-calendar@coach-house-496700.iam.gserviceaccount.com` service account attached. It mints short-lived Calendar-scoped access tokens through IAM Credentials, then creates, updates, deletes, and checks events in Joel/Paula calendars.

For Google Meet links, the broker should use Google Workspace domain-wide delegation instead of acting as the raw service account. Set the per-coach impersonation env vars to the coach Workspace users so Google Calendar can create `hangoutsMeet` conference data without a private key.

## Required Cloud Run Env

- `COACHING_CALENDAR_BROKER_SECRET`
- `GOOGLE_COACHING_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_COACHING_JOEL_CALENDAR_ID`
- `GOOGLE_COACHING_PAULA_CALENDAR_ID`
- `GOOGLE_COACHING_JOEL_IMPERSONATED_USER`
- `GOOGLE_COACHING_PAULA_IMPERSONATED_USER`

Workspace Admin must authorize service account OAuth client `108309357260349792634` for scope `https://www.googleapis.com/auth/calendar`.

## Main App Env

- `GOOGLE_COACHING_BROKER_URL`
- `GOOGLE_COACHING_BROKER_SECRET`

The broker URL points at the Cloud Run service root. The secret must match `COACHING_CALENDAR_BROKER_SECRET`.

## Blocking calendars and rollout

The configured coach calendar always blocks availability. Optional
`GOOGLE_COACHING_JOEL_BLOCKING_CALENDAR_IDS` and
`GOOGLE_COACHING_PAULA_BLOCKING_CALENDAR_IDS` add comma-separated calendar IDs;
set these on the broker (or the main app when using direct credentials).
Include only calendars the coach intends to block bookings. Every configured
calendar must be readable; missing entries, calendar errors, malformed intervals,
and incomplete event pages prevent booking rather than imply free time.

Deploy this broker revision before the corresponding app revision. Its
`freeBusy` response includes `availabilityVersion: 2`; the app rejects older
responses. Existing-event exclusion uses a bounded paginated event query and the
organizer event's verified iCalUID and organizer email, preserving unrelated
conflicts even at identical times. All-day opaque events returned by Google's
overlap query block the queried slot without interpreting date-only times as UTC.

`getEventForTitle` reads the complete current event. `updateEventTitle` requires
its ETag and `sendUpdates: "all"`, sends a summary-only PATCH with `If-Match`,
and returns an independent readback. A stale ETag returns HTTP 412. Existing
reschedule operations remain time-only. Title repairs must be previewed and
applied only to the reviewed booking/event list; no broad calendar scan is needed.
