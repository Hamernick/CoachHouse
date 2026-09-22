# Google verification submission wording

## Verified September 14, 2026

Read Joel's live Google Cloud Verification Center for `coach-house-496700`
on September 14, approximately 20:11 EDT. It confirms **branding verified**
and **data access verified**. This supersedes the pending status below;
the date Google issued its decision was not shown.

No new submission, consent, credential, or provider setting was changed.
Production Calendar activation and its canary still require separate release
authorization. Do not repeat filming or OAuth consent to check approval.

The Drive Documents OAuth client currently has two enabled secrets, created
August 31 and September 1. Google's rotation warning asks operators to retire
an old secret after confirming the replacement is in use. Neither secret was
changed or revealed. Identify the active deployed credential before cleanup.

## Submitted September 12, 2026

Submitted at **2026-09-12 05:40 UTC** in Joel's Chrome profile for
`coach-house-496700`. At submission, Google confirmed receipt and **data access
under review**; branding was verified. The September 14 check above confirms
the later approval.

- User-uploaded, unlisted demo: https://www.youtube.com/watch?v=1LRgVQr7Mt8.
  Playback and the approximately 11:14 duration were confirmed.
- Added `https://www.googleapis.com/auth/userinfo.profile` to match the filmed
  Google Sign-In permission. All seven declarations were checked after saving.
- Saved the 794-character sensitive-scope justification below and real video URL.
  `calendar.events.readonly` remains the only sensitive scope; none are restricted.
- Submitted the app-name appeal with reason **The finding is incorrect**. The
  actual explanation below uses the homepage title and resource-map prompt
  confirmed during this submission, rather than the earlier draft's header claim.
- Supplied client-specific video timestamps, staging context, privacy-mask
  explanation, and the narrow Drive scope in additional information.
- Google's progress dialog says its Trust and Safety team received the form,
  expects its first email within **3–5 days**, and allows **up to 4–6 weeks** for
  review. Contact: `joel@coachhousesolutions.org`. All seven review stages show
  in progress; the last approved consent screen remains in use.
- Next: handle Google's review email or decision, then complete production
  Calendar activation and its live canary after approval. Production Calendar
  was not activated by this submission.

Receipt and exact submitted fields:
`test-results/google-verification-release-20260911/google-verification-submission.json`.

Actual submitted appeal:

> The application is named Coach House. The public homepage at https://coachhouse.app/ has the page title 'Find resources and organizations · Coach House' and identifies Coach House in its 'Have an NFP listed on Coach House?' prompt. Its drawer links to our Privacy Policy and Terms, which also identify Coach House. The Verification Center states that our branding is verified. Please review the current homepage and clarify or clear the app-name mismatch finding.

## Historical preparation draft

Prepared 2026-09-11 18:38 UTC. These are review drafts, not saved
Google settings. Use them after the homepage-link fix is live and the user has
uploaded the actual reviewed recording. Do not use a placeholder video URL.

## Confirmed provider state

- Project: `coach-house-496700`; signed-in owner: `joel@coachhousesolutions.org`.
- App name: Coach House; branding verified; Calendar data access not verified.
- Homepage: https://coachhouse.app; Privacy: https://coachhouse.app/privacy;
  Terms: https://coachhouse.app/terms. Both policy pages are publicly live.
- Contact/support: joel@coachhousesolutions.org.
- Existing authorized domains: coachhouse.app and the existing Google-auth Vercel
  preview hostname. Neither was changed or removed during this review.
- Clients: Coach House Web, Coach House Drive Documents, Coach House Calendar.
- Declared scopes: openid, userinfo.email, drive.file, calendar.calendarlist.readonly,
  calendar.events.readonly, calendar.app.created. Google marks only
  calendar.events.readonly sensitive in this form; there are no restricted scopes.
- Video link is blank; Save is disabled. The saved justification has the inaccurate
  event-encryption sentence. The app-name appeal explanation is also blank.

## Sensitive-scope justification (794 / 1000 characters)

Coach House displays events from calendars explicitly selected by the signed-in user in that user's private agenda, alongside workspace board events. calendar.calendarlist.readonly lets the user choose calendars; calendar.events.readonly supplies titles, times, all-day dates and recurring occurrences that free/busy cannot provide. Stored Calendar data is restricted by server-side authorization; refresh credentials are encrypted. Imported personal events are not shared with organization members, published, or sent to AI providers. Users can pause sync or disconnect to remove the stored refresh credential and event cache. Existing Google-native events are not edited. Optional board export uses calendar.app.created to manage exported events in a separate calendar created by Coach House.

## September 12 recording scope reconciliation

The actual expanded Google consent lists seven permissions, including basic
profile information. The Web client uses `google.accounts.id.initialize` and
Google Identity Services returns its ID token to Supabase. Google's
[GIS setup guide](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid?hl=en)
identifies `email`, `profile`, and `openid` as the default authentication scopes.
Calendar and Drive request their narrower integration scopes with
`include_granted_scopes=true`, explaining why the existing combined permissions
appear during their returning-account consent flows.

Before submission, reconcile the Data Access declaration with the filmed
`https://www.googleapis.com/auth/userinfo.profile` permission. The last live form
read showed only six declarations. This document does not claim that the provider
declaration has been updated. No new sensitive Calendar scope is proposed.

## App-name appeal (511 / 1000 characters)

Observed reason choices are **The finding is incorrect**, **I'm not able to fix
the issue**, and **Other**. Proposed choice: **The finding is incorrect**, once
the current anonymous homepage clearly presents Coach House and its legal links.
No option was selected during this review.

The application is named Coach House. The public page at https://coachhouse.app/ includes Coach House in its header and page title, and displays the Coach House logo. The resource map is part of the Coach House application. Our public Privacy Policy at https://coachhouse.app/privacy and Terms at https://coachhouse.app/terms also identify Coach House. The Verification Center currently states that our branding is verified. Please review the current homepage and clarify or clear the app-name mismatch finding.

## Final assembly after recording

1. Confirm the homepage visibly identifies Coach House, explains its purpose and
   links to Privacy (and Terms). Verify the published page without an account.
2. Review the real recording for all three OAuth clients and actual requested
   scopes, including the expected unverified-app warning for new Calendar access.
   Reconcile basic profile access as described above before submitting.
3. The user uploads the reviewed video as Unlisted and provides the watch URL.
4. Add that real URL and the corrected justification, save, and reload to verify.
5. Complete the remaining app-name appeal with the current page evidence, review
   the complete request, and submit at the planned submission step.

Audio is optional. The September 12 silent continuous take includes English
captions in its reviewed export. It restarted the three real demo OAuth flows;
it did not change production configuration, submit an appeal, or upload a video.
