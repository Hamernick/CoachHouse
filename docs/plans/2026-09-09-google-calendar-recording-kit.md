# Coach House Google OAuth recording kit

## Current recording setup — 2026-09-11 21:02 UTC

Use **one continuous recording with tab switching**. The earlier ten-second clip
was only an optional framing test, not a plan to film separate segments.

PR #234 merged at 2026-09-11 20:40:51 UTC as
`cb9287b1ed8a447f599914b66ba427c6dba80e73`. Both Vercel deployments passed;
Chrome verified the live homepage Privacy and Terms links open version 2026-09-10.1.
Their placement is below the NFP claim prompt. This release prerequisite is complete.

Six tabs are retained in Caleb's Bandto profile: public homepage, localhost Tools,
Google Calendar September, private Drive sample, Documents filtered to the sample,
and the app Calendar panel showing the September 11 private imported event.
Calendar sync and export remain on; Drive remains connected. No OAuth, disconnect,
sign-out, source edit, video recording, upload, or Google submission occurred.

The login page redirects an existing session to Workspace. During the take, use
the account menu to sign out and sign back in as caleb@bandto.com. Demonstrate each
service's local disconnect/reconnect on camera to expose its real consent flow.
Do not revoke the whole Google project grant or reset the demo before recording.
OAuth intents expire after ten minutes, so start each grant only when filming it.

The Calendar selector includes unrelated calendar names/contact labels; mask those
rows in the reviewed video while leaving the selected demo calendar and permissions
visible. The Google event view contains only the demo source and app-created board
calendar. The private Drive sample still contains the original sample text.

Follow [the continuous-take cue sheet](2026-09-11-google-oauth-continuous-take.md).
The human operator still needs to choose the Mac recording region/options and start
recording. Native recorder controls are unavailable to this chat. No saved clip is
verified. The user handles the final upload. Audio remains optional.

## Recorder framing test staged — September 11, 20:43 UTC

Caleb's existing localhost:3000 Southside workspace is open on Tools. Chrome
confirms Calendar Sync on and Drive Connected for caleb@bandto.com. No connection,
selection, event, file, or consent was changed. QuickTime Player and the macOS
Screenshot toolbar were launched; no recording was started by the agent.
Save folder: `/Users/calebhamernick/Movies/Coach House OAuth Verification`.

Next human action: select only the prepared Chrome window area, leave microphone
at None, enable Do Not Disturb, and save a ten-second Tools-screen readability
test. The crop, recorder options, DND, and saved clip remain unverified. Review
that clip before OAuth filming. PR #234 is still open with required code-owner
review; merge and verify the live homepage links before the final take.

## Homepage legal links ready for merge — September 11, 20:26 UTC

[PR #234](https://github.com/Hamernick/coach-house-lms/pull/234), final commit
`1a41dac18c38977503f7b62e3a34d7b5182482b7`, adds Privacy Policy and Terms of
Service immediately below “Have an NFP listed on Coach House?” in the map drawer.
The contrast review finding is fixed and resolved. All 21 local quality stages,
pre-push checks, hosted CI `34643615265`, and both Vercel previews passed.
Chrome verified both policy pages open from the final preview, with 44px targets
and the corrected interaction styles. The optional location prompt was dismissed
without granting location access.

[Review the preview](https://coachhouse-git-fix-public-home-9a691e-calebs-projects-58ab1538.vercel.app).
Primary deployment: `Cx1ngr2d28E6fWNn4tGxNDCLV7Tv`. GitHub requires one approving
code-owner review before merge. This homepage change is **not on production yet**.
Next: review/merge PR #234, verify the rendered public homepage links, then resume
recorder preparation. User uploads the finished video; audio remains optional.
No recording, upload, Google submission, migration, or provider change occurred.
The localhost:3000 demo and all Calendar/Drive connections and sample content remain.

## Google form review — September 11, 18:38 UTC

Step 2 review is complete in Joel's Chrome profile and project
`coach-house-496700`. Branding is verified; Calendar event-read access is not.
The form has the expected six scopes, correct Coach House identity/contact and
public homepage/Privacy/Terms URLs, and all three existing web clients.
No scopes, clients, credentials or provider settings were changed.

The real video URL is still missing. Google disables Save while that field is
blank. The saved justification still incorrectly says imported events are
encrypted. The app-name mismatch appeal remains required even though branding
is verified. Corrected 794-character scope wording and a 511-character appeal are
prepared in [the submission draft](2026-09-11-google-verification-submission-draft.md);
they have not been submitted or saved to Google.

Before recording, add a clearly discoverable Privacy link to the registered public
homepage (and keep Terms alongside it). The anonymous homepage response shows
Coach House in its header/title/logo but has no `/privacy` or `/terms` anchors;
the inspected signed-in homepage also has none. Signup links work, but do not
replace the homepage requirement. Verify the final anonymous rendered homepage
after this small release. Google's [homepage/privacy requirements](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification)
require the homepage to link to the privacy policy and explain the app's purpose.

Next is that homepage fix and verification, then recorder preparation. The user
handles upload; audio remains optional. Demo connections, sample files, Vision
and calendars are unchanged. No recording or Google submission occurred.

## Production verification — September 11, 18:28 UTC

Step 1 is complete. PR #233 was merged at 18:19:57 UTC into main commit
`ffd8f63c443b8091d1f379f0f0c2374cd4d14942`. Post-merge CI and both Vercel
deployments passed. The coachhouse deployment `A2Pijek6XfGKUJQ6mbKDkSCEnpyj`
is **Production / Current / Ready** for `coachhouse.app` at that exact commit.

Chrome verified public `/privacy` and `/terms` show version `2026-09-10.1`.
Privacy includes separate Google Sign-In, Drive and Calendar sections, correct
credential/event-data wording, selected-file access, private Calendar imports,
and optional export to a separate app-created calendar. The Drive anchor works.
The signup Terms and Privacy links open those public documents in new tabs;
consent stays unchecked and no account was submitted.

Next is step 2 only: inspect Joel's Google verification form, recheck branding
and any app-name issue, and reconcile scopes, policy links and explanations.
Do not restart OAuth, modify the demo, record, or submit while checking the form.
The user will upload the final reviewed video. Microphone/audio are optional;
English text captions can explain a silent recording. No video exists yet.

This release contains policy/consent and Drive disconnect/account-deletion fixes.
The separate Calendar feature still needs its production release and activation.

## Prior release checkpoint — September 11, 18:11 UTC

[PR #233](https://github.com/Hamernick/coach-house-lms/pull/233), final commit
`8f3382ae`, has passed all local and hosted checks, including both Vercel previews.
The final scoped release passed all 21 quality stages: 2,290 acceptance tests,
45 browser tests and seven isolated PostgreSQL suites. The combined demo separately
passed 2,530 acceptance tests, 155 browser tests and eight PostgreSQL suites.
Each acceptance run has one expected skip; connected Supabase fixtures skip without
credentials. No shared database fixture writes occurred.

The release publishes legal version `2026-09-10.1` and makes normal Drive disconnect
local-only. The account-deletion review finding is fixed: full deletion explicitly
requests best-effort Google revocation while still clearing local credentials if
the provider fails. All 43 focused regressions pass; the addressed review thread
is resolved. The candidate is clean, committed and pushed from production main.

[Exact hosted policy preview](https://coachhouse-joyn4k1i3-calebs-projects-58ab1538.vercel.app/privacy#google-drive)
was verified in Chrome: version `2026-09-10.1`, separate Google Sign-In/Drive/Calendar
sections and a working Drive anchor. Public main remains `67501039`; production
publication still requires one approving code-owner review from `@calebhamernick`.
No protection bypass or production deployment occurred.

Next: obtain the GitHub review, merge normally, verify the public deployment,
then finish recorder checks and filming. Localhost:3000 and all rehearsed demo
connections/files are preserved. No new OAuth, video recording/upload or Google
submission occurred. Carry the explicit account-deletion revocation fix into the
combined development branch when integrating this reviewed release.

Prepared September 9, updated September 10, 2026. Target: a clear 5–7 minute recording; this duration is
our estimate, not a Google requirement. The script, sample files, and private Google
demo calendar are ready. The live Calendar import/control/disconnect rehearsal
passed. The final recording remains pending.

## Prior privacy checkpoint — September 11, 01:08 UTC

The prepared September 10 Drive disclosure is integrated into the running root
checkout on `chore/local-development-20260907`. Local `/privacy` displays version
`2026-09-10.1`, including separate Google Sign-In, Drive and Calendar sections.
The signup consent links remain available. Read-only database verification confirms
the matching migration is already applied; no migration was rerun.

All 16 focused legal-consent/Google-auth tests, the isolated PostgreSQL consent
suite, and all 16 static-quality stages pass. The full release gate still needs
to run in an isolated review environment. The shared-production RLS fixture writer
and a build against the running server's output were not used.

Public `/privacy` still displays `2026-08-27.1`, without the Drive/Calendar sections.
Next: complete release validation and review the public deployment, then finish
recorder checks and film. Demo connections, calendars, Vision and Drive files remain
as rehearsed below. No deployment, commit/push, video or Google submission occurred.

## Drive rehearsal checkpoint — September 11, 00:58 UTC

Drive rehearsal passed in caleb@bandto.com's Southside workspace on localhost:3000.
The original configuration is active, using encryption key version `1`; no new
consent, key rotation, Calendar change or provider-setting change was required.

The existing Google Doc **test for coach house codex connection** is empty:
Google's text export has zero editable characters. Import correctly showed
**No editable text was found in this document** and left Vision empty. The source
Doc was preserved. Used the prepared fictional **coach-house-drive-demo.md** instead,
uploaded once to Caleb's My Drive and verified owner-only/private with matching
local/Google content. Source file ID: `1M_FH7hZ_uI_iMhkzg0qfkG4lxCr5P6ee`.

Through the actual editor/Picker, imported the Markdown sample into the previously
empty **Vision** document. It saved with a Google Drive source link and survived
reload. Added **Demo edit: saved in Coach House only.** as its own final paragraph;
a second reload preserved that edit, all three agenda items and the source link.
Vision remains **Draft**. The native Google Docs nonempty-import path was not
exercised by this rehearsal; the successful content case uses Markdown from Drive.

The same source file was selected through Documents' **New → Add from Google Drive**.
The connected file survived reload, appeared in grid/list views, and its Open action
opened the expected Google file with account access. Google shows the original
sample without the Coach House edit. API readback confirms unchanged source checksum
and modification time, private sharing, and the original empty Doc unchanged.

Prepared tabs: Vision editor, Documents and the Google source preview. Local evidence
is in root `test-results/google-drive-demo/` (file-baseline.json, source-integrity.json,
ui-rehearsal.json), without credentials. The sample source, connected reference and
Vision copy are retained for recording. Do not reset Vision or repeat the upload.

The September 10 Drive disclosure is now integrated locally. Finish public release
and recorder checks, then film the real consent/features.
No recording, upload of a video, deployment or Google submission occurred.

## Example to watch

[Google Calendar API OAuth Demo for App Verification — Qyra, May 27, 2025](https://www.youtube.com/watch?v=DfR3PB5nj6I).
The creator describes account selection, consent, and Calendar event operations.
The video page and playback controls were available when checked in Chrome. This
is a format reference, not evidence that Google approved that app or a model for
our permissions: Coach House imports selected calendars and has separate optional export.

[How To (Correctly) Make An OAuth Demo Video For Google Verification — Graeme Rouse](https://www.youtube.com/watch?v=evD9X34Ahus)
is an additional walkthrough from 2019. Use Google's current requirements below
for the final recording.

## What to have ready

| Item | Preparation and current state |
| --- | --- |
| Recording browser | Caleb's Bandto Chrome profile, signed into Coach House and caleb@bandto.com. Keep Joel's Console outside the recording area. |
| Calendar app | http://localhost:3000/workspace?drawer=tools in Southside Community Table. The user confirmed its people, finance and board records are sample data suitable for recording. Calendar is configured and the switch opens the setup dialog. Google saved the port 3000 callback; production activation is unchanged. |
| Privacy explanation | Root localhost:3000 now displays the Calendar and Drive disclosure in version 2026-09-10.1; its database migration is applied and verified. Public policy release and homepage legal links are deployed and verified. Port 3012 is stopped. |
| Google Calendar | **Coach House Demo** created in Caleb's Bandto account; timezone America/New_York. Public and Bandto sharing both off; Caleb is the sole owner. Other calendars are hidden and the sidebar is collapsed for recording. |
| Sample events | Created the three examples through Calendar's real UI, including a weekly series explicitly limited to four occurrences. All are private/free, with no guests, Meet links or reminders. The [ICS file](recording-assets/coach-house-calendar-demo.ics) was not imported; do not import it now and duplicate these examples. |
| Drive sample | [coach-house-drive-demo.md](recording-assets/coach-house-drive-demo.md) contains only invented content and supports both file linking and the newer document-import flow. The Markdown sample is now private in Caleb’s Drive, connected in Documents and imported into Vision. The original .txt is unused. Keep the uploaded source unchanged. |
| OAuth test | Passed. The September 10 localhost:3000 connection has only Coach House Demo selected, six imported occurrences, sync on and no error. The app visibly shows timed, all-day and recurring events with Google · Only you labels. Do not restart consent to verify this state. |
| Export chapter | Passed on September 10: all 61 Southside sample board records exported to one Coach House — Board calendar; six recurring masters and seven all-day records. Google settings show Caleb as sole owner, public/Bandto sharing off and notifications off. Repeat sync completed with 61 tracked exports, zero missing records and one destination. Export remains on. |
| Client inventory | All three public client IDs identified below. Saved and reloaded localhost:3012 for the Web origin, Drive callback and Picker website restriction. Local Google login and Drive are enabled; the original Drive configuration and real Picker were verified at 22:11 UTC. Production has all eight Drive settings as unreadable Secret variables. Production Sign-In remains available; its Documents UI lacks Drive file-selection controls. The restored localhost:3000 configuration and sample-file rehearsal passed. |
| Recorder | QuickTime Player opened. This CLI chat exposes Chrome controls, but no native desktop Computer Use controls or recorder capability. The human operator must choose the recording region, optionally enable a microphone for narration, enable Do Not Disturb, and start/stop recording. None of those recorder settings is confirmed yet. |
| Upload | The user handles uploading. Review the actual file together, then the user uploads with visibility **Unlisted** and supplies the watch URL for playback verification. No upload exists. |

The sample calendar contains six occurrences: one timed event on September 10,
one all-day event on September 11, and four weekly meetings beginning September 14.
Dates are in September/October 2026. If recording later, move the demo dates first.
The file has no guests, invitations, locations, meeting links, or reminders. The
equivalent events now exist in Google Calendar. September 10, 11, 14, 21 and 28
and October 5 were confirmed in the month views; the recurrence editor confirmed
four Monday occurrences. The recording tab is back on September.

Live rehearsal evidence: the saved selection contained only Coach House Demo;
all six cached occurrences had the expected Eastern times/all-day date bounds.
Renamed the timed event to **Demo: Planning review (updated)** in Google and used
**Sync now**; Coach House displayed the updated title. Tools off hid September 11's
demo event, and on restored it without setup reopening. Disconnect cleared the
stored Calendar credential, selections and caches. The Google demo source events
remain, and the existing Drive connection row is unchanged. The timed event still
has its updated title; restore it before recording the rename chapter.

The user selected **caleb@bandto.com** and confirmed that **Southside Community
Table** contains sample people, finance and board data suitable for recording.
Use that existing workspace at **http://localhost:3000/workspace**. A separate
workspace or Google account is not needed. Preserve its sample records.

### Exact demo-workspace preparation

1. Use Caleb's existing Southside Community Table session on localhost:3000.
   Done: the switch opens setup, and the subsequent localhost:3000 Google
   callback connected Caleb successfully. The user selected **Coach House Demo**;
   six events imported. Chrome control recovered and the export rehearsal passed.
   Sync and Southside export are now on.
2. Board inventory complete: 61 active sample records, six recurring and seven
   all-day, from May 31 through November 24. Use the September 7 recurring board
   meeting, September 10 reporting deadline and September 16 all-day board meeting
   for the export chapter. No new board fixture was needed; source records remain
   unchanged.
3. Reuse Caleb's private **Coach House Demo** Google calendar and its six verified
   occurrences. Do not re-import the ICS. The Markdown Drive sample is uploaded privately and the rehearsal passed.
4. Calendar rehearsal complete. All six imported demo occurrences remain selected
   and all 61 source board records have export mappings in one private destination.
   Google confirms the example titles/times, all-day date and monthly recurrence.
   Last repeat sync: **2026-09-10T20:37:22.275Z**, no error. Initial export required
   four bounded sync passes; subsequent unchanged sync completed in one pass.
5. Rehearse Sign-In and Drive separately. Local Drive configuration, selected-file linking, Markdown import/edit/save/reload,
   source preservation and grid/list access now pass. The original native test Doc
   was empty and remains unchanged. Production Sign-In remains available; the live production Documents UI does not expose the Drive picker.
   Preserve Caleb's working Drive connection and select only the demo file.

Joel is signed into Google Cloud as **joel@coachhousesolutions.org** in project
**coach-house-496700**, and Chrome page control is restored. Google saved the
localhost:3000 Calendar callback while preserving port 3012 and production.
The current sensitive-scope justification still incorrectly describes event-cache
encryption. Replace it with the corrected verification-plan text when adding the
actual video URL; the Save button is disabled while that URL is blank.

Chrome's file chooser rejected the attempted upload with `Not allowed` because
extension file-URL access is unavailable. No file was uploaded. The fixtures were
created through the Calendar editor instead. Creation initially inherited Bandto
organization sharing; this was explicitly turned off before adding any events.
Timed and all-day notification lists were empty and all other notifications were
set to None. The source calendars were only hidden, not modified or disconnected.

For a future replacement calendar only: in Google Calendar, use **Other calendars → Add → Create new
calendar**, name it **Coach House Demo**, and keep it private. Open **Settings →
Import & Export**, choose the supplied ICS file, explicitly select **Coach House
Demo** as the destination, and import once. Confirm the three event types appear.
Google defaults imports to the primary calendar, so select the demo destination
before importing. See Google's [create-calendar](https://support.google.com/calendar/answer/37095?hl=en)
and [import instructions](https://support.google.com/calendar/answer/37118?hl=en).

## Recording order and narration

Record **one continuous walkthrough** with tab changes, following the
[exact cue sheet](2026-09-11-google-oauth-continuous-take.md).

| Order | On-screen evidence | Short narration or caption |
| --- | --- | --- |
| 1 | Public home and Privacy/Terms | Coach House helps organizations manage their workspace. |
| 2 | Local sign-out, Google Sign-In, same Southside workspace | Sign-in identifies my account. Calendar and Drive permissions are separate. |
| 3 | Calendar local disconnect, switch on, full real consent | I connect my Google Calendar and choose the calendars to display. |
| 4 | Demo-only selection; timed, all-day and recurring imports | Imported events are visible only to my account. |
| 5 | Sample rename, Sync now, pause and resume | I control when my calendar is displayed and refreshed. |
| 6 | Enable export; separate existing Coach House — Board calendar | Optional export writes board events to an app-created calendar. |
| 7 | Drive local disconnect/reconnect and consent; select existing sample in Picker | Drive access is limited to files I choose. The Google source stays unchanged when I edit its imported copy. |
| 8 | Both Tools connections restored | Calendar and Drive are managed independently. |

Keep working connections intact until the take. Their on-camera disconnect/reconnect
provides genuine consent and demonstrates disconnect without a second recording.
Do not use Google account-wide revocation. Calendar reconnect requires source
selection and Save and sync; restore optional export during its own demonstration.

## Identity and capture settings

- App name: **Coach House**. Google project: **coach-house-496700**.
- Calendar OAuth client: **Coach House Calendar** (web).
- Public client ID: `74627119265-lhjpd79oj5oqlk85psat4r10skp11m9c.apps.googleusercontent.com`.
- Drive client: **Coach House Drive Documents**, public ID
  `74627119265-kkigf54jpg0ikg3u4o51e23t71ab8ci5.apps.googleusercontent.com`.
  Console confirms callbacks at `https://coachhouse.app/api/integrations/google-drive/callback`,
  `http://localhost:3000/api/integrations/google-drive/callback`,
  `http://localhost:3010/api/integrations/google-drive/callback`, and
  `http://localhost:3012/api/integrations/google-drive/callback`. Added the 3012
  callback and verified persistence by reopening the client; retained all originals.
- Sign-In client: **Coach House Web**, public ID
  `74627119265-hgjurfsatkqm8u30bcg9mvjsuhn1u3nd.apps.googleusercontent.com`.
  Console confirms JavaScript origins at `https://coachhouse.app`,
  `http://localhost:3000`, `http://localhost:3010`, the existing Google-auth
  Vercel branch preview, and `http://localhost:3012`. Added the 3012 origin and
  verified persistence; no redirect URIs are listed on this client.
- Picker key: **Coach House Drive Picker** remains restricted to **Google Picker
  API** and **Websites**. Saved and reopened the website list: http://localhost:3000/*,
  http://localhost:3010/*, http://localhost:3012/* and https://coachhouse.app/*. No key
  value was revealed or rotated.
- The isolated, ignored, mode-0600 `.env.development.local` now contains the
  public Sign-In client ID with `NEXT_PUBLIC_GOOGLE_LOGIN_ENABLED=true`, plus
  the public Drive client ID, 3012 callback and Picker app ID. Existing Calendar
  configuration and the canonical environment symlink were preserved. Drive
  still lacks `GOOGLE_DRIVE_CLIENT_SECRET`, `GOOGLE_DRIVE_PICKER_API_KEY`,
  `GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEYS` and
  `GOOGLE_DRIVE_TOKEN_ENCRYPTION_CURRENT_VERSION`; enable Drive only after its
  original private configuration is available. Do not replace existing encryption
  keys or disconnect the working Drive connection to stage footage.
- Vercel CLI identity `hamernick` sees only `caleb-hamernicks-projects`, a different
  team from the target `calebs-projects-58ab1538`; target environment metadata
  returned 403. Caleb's browser identity `caleb-7249` can access the target project
  and confirms all eight Drive settings exist in Production as Secret variables.
  Vercel documents those values as [unreadable after creation](https://vercel.com/docs/environment-variables/sensitive-environment-variables).
  Reauthenticating the CLI alone will not recover them. No Vercel settings or CLI
  login changed, and no secret values were retrieved. The September 10 production UI check found no Drive picker in either
  Documents surface, so that earlier fallback is not established. Local Drive
  configuration was subsequently restored and the Picker verified at 22:11 UTC;
  use localhost:3000 for the remaining file rehearsal.
- Show the app name and `client_id` in the consent-page address bar. Keep the
  authorization code, state, rapt values, passwords, and client secrets out of the
  shared edit. Preserve the evidence of the grant and successful return when
  obscuring sensitive query values. Do not record Cloud Console credential dialogs.
- Capture Chrome at readable size, around 1440×900 or 1920×1080. Keep the address
  bar visible, enlarge text if needed, and move notifications outside the capture.
- English voice narration or text captions are enough; use the short script above.
  No webcam, intro animation, music, or promotional editing is needed for this plan.
- Use only sample Calendar events and the supplied sample document. An unlisted
  video is accessible to anyone with its link, so review every frame before upload.

Apple's [screen recording instructions](https://support.apple.com/en-us/guide/mac-help/mh26782/mac)
cover selecting the recording region, microphone, and save location. The browser
tools used for preparation have not started a recording; the human operator starts
and stops the Mac recorder and completes the account-security screens.

Before pressing Record, use QuickTime **File → New Screen Recording** (or
Shift-Command-5), choose **Record Selected Portion**, and frame the prepared Chrome
content. Enable Do Not Disturb, choose a local save folder, and make a ten-second
readability test. Leave the microphone off for silent recording with captions;
only select and test a microphone if choosing spoken narration. Keep other application
windows, bookmark names, profile lists, private workspace cards and Console outside
the capture. Southside is approved sample data for this recording. Keep unrelated account
information, browser profiles and Console credentials outside the capture.
Capture only the public OAuth client identifier when needed; obscure incidental
authorization query values during editing without obscuring requested permissions
or the successful return. Review the saved recording before any upload.

## Final review and upload

Check that every relevant client/consent flow and declared feature is represented,
including existing Sign-In and Drive. The rehearsal used an existing Drive grant;
record the actual consent chapter as planned without claiming it was filmed here. Match the exported Google scope list against
the video; do not silently omit a requested capability or remove production clients.
Do not claim Google's approval based on another developer's example video.

Suggested YouTube title: **Coach House — Google OAuth and Calendar Demo**.

Suggested description, to use only after all listed chapters are recorded:

> Coach House OAuth verification demonstration: Google Sign-In, personal Calendar
> selection and event import, sync controls and disconnect, optional export to an
> app-created calendar, and selected-file Google Drive access. Recorded using
> demonstration data. Google project: coach-house-496700.

After upload, use the video's normal watch URL in Console's **YouTube link** field.
Save and recheck the corrected scope justification from the
[verification plan](2026-09-09-google-calendar-verification.md). The reviewed public
privacy release and app-name appeal remain separate submission prerequisites.

Google's current [demo guidance](https://support.google.com/cloud/answer/13804565?hl=en)
requires the relevant consent flows and the features that use the requested access;
its [sensitive-scope guide](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification)
specifies English, app identity/client ID evidence, and an unlisted YouTube upload.
