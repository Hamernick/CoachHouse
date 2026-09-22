# Google Calendar verification submission

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

## Prior privacy checkpoint — September 11, 01:08 UTC

The eight-file Drive privacy/consent patch is integrated into root branch
`chore/local-development-20260907`; all file hashes match the reviewed manifest.
Chrome confirms local `/privacy` displays `2026-09-10.1` with Google Sign-In,
Drive and Calendar sections. Signup consent links remain available.

Read-only Supabase verification confirms migration `20260910120000` is applied
and `record_signup_legal_acceptance()` has the expected function hash. No database
mutation was needed. All 16 focused legal-consent/Google-auth tests, isolated
PostgreSQL consent assertions and all 16 static-quality stages pass. Earlier
accepted versions remain supported; historical acceptance records are preserved.

Public `/privacy` still displays `2026-08-27.1` without Drive/Calendar sections.
Full release validation in an isolated environment and a reviewed public deployment
remain next. Existing demo state is preserved. No commit/push, deployment, video
recording/upload or Google verification submission occurred.

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

Calendar checkpoint (September 10, 20:37 UTC): localhost:3000 in the user-confirmed
Southside sample workspace has six imported Coach House Demo events and all 61
sample board records exported to one private Google calendar. Chrome page control
and Joel's Google Cloud sign-in work. An unchanged repeat sync passed with zero
missing board exports and no error; import and export remain enabled. Earlier
import-only/disconnected states below describe prior canaries. Drive rehearsal and
local privacy integration also pass, as recorded above. Public release and recorder
preparation remain. No video or submission exists.

## Historical implementation checkpoint — superseded by the live results above

Status: implementation ready for continued review. Google has not approved Calendar data access. A callback
fix now preserves unconsumed OAuth state when Google explicitly returns incomplete
Calendar permissions; 21 focused tests pass, including correction/replay and token
scope regressions. Live import is still unverified. Do not submit a demonstration
that implies the import is working until the canary succeeds. Joel's Google Cloud
Console is accessible again as of September 9, 19:39 UTC. Branding is verified;
Calendar event-read access remains unverified.

## Current remaining order

1. Done: privacy release merged, deployed and verified on coachhouse.app.
2. Done: form review and homepage legal-link release. PR #234 merged; both live
   homepage links open the correct policies. Scope/appeal drafts remain prepared;
   Google Save still needs the actual video URL.
3. Finish the native recorder region, Do Not Disturb and readability setup.
   Audio is optional. The walkthrough tabs and continuous-take cue sheet are ready.
4. Record one continuous walkthrough: homepage, Google Sign-In, Calendar consent
   and features, then Drive consent and sample-file use. Preserve the demo until
   the on-camera disconnect/reconnect steps; restore both connections by the end.
5. Review the actual footage, mask unrelated calendar/account labels and incidental
   sensitive query values, then finalize English captions, title and description.
6. The user uploads the reviewed video as Unlisted and supplies its watch URL;
   verify playback from that URL.
7. Add the real video URL and corrected explanations, address the remaining
   app-name issue, review the complete verification request, and submit.
8. Prepare the separate focused Calendar production release during Google's review;
   after approval, deploy/activate and verify a controlled production canary.

## Historical September 9 execution plan — current status is above

1. Inspect existing Google sessions before starting consent. Done: Joel is signed
   in and the verification form is accessible. After the user returned, started
   one fresh Caleb request at 20:20 UTC after creating the safe demo calendar.
   Its warning remained open and the database confirms expiry at 20:30:07 UTC.
   Zero Calendar connections were present at that check. Wait for the human
   operator to be ready before creating another request; do not reuse the expired one.
2. Implement the Calendar privacy disclosure and compatible signup-consent update.
   Done locally, with the database migration applied and verified. The public
   privacy page has not been deployed.
3. Complete Caleb's real import, privacy, pause/resume and disconnect canary. Pending
   successful consent; keep optional export off. Do not use test mocks as live evidence.
4. Record the working flow and prepare the actual unlisted demonstration video.
   Pending the canary. No recording or upload exists.
5. Finish Console verification details and submit the completed request. Pending
   the reviewed public privacy release, the actual video and the app-name appeal
   field now displayed by the submission form. Joel's sign-in is complete.
6. Complete release validation, deploy through the repository workflow and activate
   Calendar/scheduling when rollout is ready. Production is still disabled.

Validation in this follow-up: 28 focused acceptance tests; isolated PostgreSQL tests
for exact consent hashes, prior-version compatibility, immutable records, server
timestamps and role restrictions; all 16 static-quality stages including lint and
snapshots; local browser confirmation of the Calendar disclosure and effective date.
The full release quality gate was not repeated against shared production credentials.

## Application and project

- Application: Coach House; project: coach-house-496700.
- Calendar OAuth client: Coach House Calendar (web).
- Client ID: 74627119265-lhjpd79oj5oqlk85psat4r10skp11m9c.apps.googleusercontent.com.
- Homepage: https://coachhouse.app/.
- Privacy policy: https://coachhouse.app/privacy.
- Developer/support contact: joel@coachhousesolutions.org.
- Branding was verified at the September 9 provider checkpoint. Calendar data
  access was not verified. Refresh this status in Console before submitting.
- Existing Google login and Drive clients/scopes must remain intact.

## Requested Calendar access

| Scope | Feature and justification |
| --- | --- |
| calendar.calendarlist.readonly | List calendars the user can read so the user can choose which calendars to display. |
| calendar.events.readonly | Display event titles, dates, times and all-day/recurring occurrences from selected calendars in the user's private agenda. Free/busy does not provide the event details this agenda displays. |
| calendar.app.created | Optional board export creates a separate Coach House calendar and manages its exported events. Existing Google-native events are not edited. Optional export was separately rehearsed with Southside sample data. |
| openid and email | Identify the Google account connected by this signed-in Coach House user and prevent account mixing when credentials are refreshed or reconnected. |

Ready-to-use sensitive-scope justification:

> Coach House displays events from calendars explicitly selected by the signed-in
> user in that user's private agenda, alongside workspace board events. Event read
> access supplies titles, start/end times, all-day dates and recurring occurrences;
> free/busy cannot supply this agenda. Calendar data is protected by server-side
> authorization, and refresh credentials are encrypted. Imported events are not
> published to organization members or public pages. Users can pause sync, or
> disconnect to remove the stored refresh credential and event cache. Existing
> Google-native events are not edited. Optional board export uses a separate
> calendar created by Coach House.

The corrected text above was entered in the Console editor but was not confirmed
saved: Save was disabled with the demo-video field blank. After Joel signed back
in, the old incorrect event-cache encryption wording was still displayed. Enter
the corrected draft when adding the actual video URL and verify persistence.

The verification summary also displays an app-name mismatch appeal field despite
the Verification Center reporting branding verified. The public homepage currently
opens the resource map. Investigate the visible name and complete the appeal with
accurate evidence; do not claim that the existing rejection has been resolved.

Do not describe the event cache as application-encrypted: refresh tokens and PKCE
verifiers use application encryption, while event cache data is stored as JSON in a
service-only, RLS-protected table. Ensure the Console justification reflects this
distinction. Do not claim consent or import succeeded based only on an HTTP 200.

## Privacy disclosure implemented for release

The checked privacy document contains separate Google Calendar and Drive sections.
Calendar covers access, private visibility, retention, disconnect and optional
export. Drive covers selected-file metadata, optional imported copies, organization
sharing, credential removal, retained workspace records and Limited Use. Google
Sign-In alone grants neither integration access. The shared Terms/Privacy version
is now 2026-09-10.1, effective September 10, 2026. Terms body text is unchanged;
its version/date and hash follow the existing bundled-consent contract.

- Terms SHA-256: 8757308d709eac552572d79642b0374f6c41ee7c5277b50b961ce9948577e03c.
- Privacy SHA-256: dd58c9175fd80b067658f07e503883f4f983c357413092e1533df8aeeccc0135.
- Latest applied migration: 20260910120000_accept_drive_privacy_consent.sql.
- Migration SHA-256: 6a528d9e905d969acc01e46e627840c2cc8150d25886ace9309504aa78f39042.
- Database: vswzhuwjtgzrkxknrmxu. Installed function body matches the local migration
  (MD5 39f8d8cd2488eb2c9945a389e4adde2d), accepts August 12/August 27/September 9/
  September 10 tuples and leaves the unrelated Documentation migration unapplied.
  The September 9 migration and its historical document hashes remain unchanged.
- The updated disclosure is integrated and browser-verified in root localhost:3000.
  Port 3012 is stopped. Public release remains pending.

Submission summary of the implemented Calendar-specific disclosure:

> Google Calendar is optional and requires separate permission from Google Sign-In.
> When you connect it, Coach House receives your Google account identifier and
> verified email address, a list of calendars you can access, and event information
> from the calendars you select. We store calendar names and identifiers, event
> titles, dates, start/end times, all-day status, links to Google events and sync
> information to display and refresh your private agenda. Connection credentials
> are encrypted and access to stored Calendar data is restricted by server-side
> authorization. Imported personal events are visible only to you in Coach House;
> they are not added to shared organization boards or public pages.
>
> Turning sync off pauses updates and hides imported events while retaining your
> connection and selections. Disconnecting removes the stored refresh credential
> and event cache from active storage. It does not delete events in Google Calendar
> or disconnect Google Sign-In or Drive. You can also revoke access in your Google
> Account. If you enable optional board export, Coach House sends the selected
> workspace's board events to a separate Google calendar it creates for that
> purpose. Coach House does not sell Calendar data, use it for advertising, or send
> it to AI providers for this integration. Its use of Google data follows the
> Google API Services User Data Policy, including applicable Limited Use requirements.

Verified the published privacy page in Chrome on September 11: it still shows
2026-08-27.1 and has no separate Calendar or Drive section. Verify it again after
the reviewed release. No privacy changes have been published in this preparation.

## Demonstration video outline

Use the prepared [recording kit](2026-09-09-google-calendar-recording-kit.md) for
sample files, the shot list and narration. Caleb's private Coach House Demo calendar
has six imported occurrences; optional export has 61 sample board records in one
private destination. The private Markdown Drive sample is linked in Documents and
saved as an editable Vision copy. Both live rehearsals passed. No video exists.
Keep these connections and prepared documents intact until actual filming.

Google requires an unlisted YouTube video showing the real OAuth grant flow and
how each sensitive scope enables the application feature. Use English UI. Show the
Coach House app name and OAuth client ID in the consent-page address bar; keep
secrets, authorization codes and unrelated personal calendar details out of the video.

1. Open Workspace Tools and show the single Google Calendar switch off.
2. Turn it on and show the Calendar explanation and Continue with Google.
3. Show account selection, app identity and the requested Calendar permissions.
4. Return to Coach House and select a calendar approved for the demonstration.
5. Save and sync. Show a known event in the private agenda and its corresponding
   Google event; show the Only you indicator and day/month navigation.
6. Turn sync off in Tools, show imported events disappear, then resume.
7. Show the disconnect control and explain that it clears the local credential and
   cache while preserving Google events. Complete the authorized disconnect test.

Do not upload Caleb's unrelated private events or contacts. Prepare and review the
actual video before uploading it. No recording or upload has been created yet.

## Submission completion

After remaining recording preparation is complete, the reviewed privacy release is
available, and the video exists: verify branding status, confirm the exact declared
scopes, save the scope justification and video URL in Google Auth Platform, review
the completed submission, and submit the Calendar data-access verification request.
Track the actual Google review result; submitting does not mean approved.

Sources: [Google sensitive-scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification),
[Google submission requirements](https://support.google.com/cloud/answer/13461325?hl=en).
