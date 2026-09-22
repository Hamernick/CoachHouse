# Google OAuth verification: one-take filming plan

## Objective and scope

Record one continuous, silent walkthrough of Coach House using
caleb@bandto.com in the Bandto Chrome profile and the Southside Community Table
sample workspace. Target 5–7 minutes, allowing for Google consent/loading.
Save to `/Users/calebhamernick/Desktop/Coach House OAuth Review.mov` for review.
The user uploads the approved movie.

The September 12 live Google form lists `calendar.events.readonly` as unverified
and `drive.file` as non-sensitive. Its video field explicitly says:
“Your video must include all OAuth clients that you assigned to this project.”
The project's previously verified client list comprises Coach House Web,
Coach House Calendar, and Coach House Drive Documents. The September 12 attempt
to refresh the client list timed out; the scope form itself was read successfully.

Google requires app identity/purpose, complete English OAuth consent flows, and
actual features using the requested permissions. Narration is optional.

Sources:
- [Project's verification form](https://console.cloud.google.com/auth/scopes;verificationMode=true?project=coach-house-496700)
- [Google demo-video requirements](https://support.google.com/cloud/answer/13804565?hl=en)

## 1. Prepare off camera

- Restore one Chrome window with only the five tabs below. Keep all other windows
  minimized. The former recording tabs disappeared; do not assume they still exist.
- Verify actual visible tab switching, pointer targeting, readable consent framing,
  and native capture. Background DOM access alone does not prove the screen is ready.
- Confirm English Google screens and the approved sample account/content. Hide
  unrelated Google calendars, bookmarks, notifications and developer overlays.
- Keep Caleb signed into Google. Coach House is already signed out, and its local
  Google Sign-In button was verified after restoring two public environment values.
- Calendar and Drive stored connections remain connected. Their local disconnects
  and reconnects happen during the take to show real consent. Preserve the source
  events, Drive file, imported Vision draft, and existing board-export destination.
- Reuse known routes and verified controls. Avoid the Workspace header account menu
  while its drawer traps focus. Resolve any navigation issue before capture.
- Do not begin another consent flow merely to rehearse it. Authentication prompts
  that demand user input are a stop condition, not an invitation to keep clicking.

| Tab | Prepared screen |
| --- | --- |
| 1 | Coach House identity/homepage, then the local Google login page |
| 2 | Local Workspace Tools and app Calendar |
| 3 | Google Calendar, September 2026, only the demo and app-created calendars shown |
| 4 | Coach House Documents, filtered to the approved sample; Vision copy available |
| 5 | Original private `coach-house-drive-demo.md` in Google Drive |

Authenticated local tabs may need one refresh after Google Sign-In completes.

## 2. Announce the start

Only after preparation passes, say:

**“Hands off now—recording is starting. Please leave the mouse and keyboard alone
until I say recording has stopped.”**

Allow ten seconds for the user to see the cue. Hide Terminal, verify the clean
frame, and start the silent recorder. If the clean frame is not ready, do not start.

## 3. Record this exact sequence

| Order | Tab | Actions and required evidence |
| --- | --- | --- |
| 1 | 1 | Briefly show Coach House identity/purpose. Open the local login page, choose Google Sign-In, select Caleb, and show successful return to the sample workspace. |
| 2 | 2 | Open Calendar management, disconnect the existing local connection, turn its switch on, and complete Calendar's real consent flow. Keep every requested permission readable; show Google's unverified-app warning if presented. |
| 3 | 2 | Select only **Coach House Demo**, initially leave board export off, save/sync, and show private imported timed/all-day/recurring events. Then enable the already approved board export and sync to its existing destination. |
| 4 | 3 | Show the matching source events and the separate **Coach House — Board** calendar containing exported sample board events. |
| 5 | 2 | Disconnect the stored Drive connection and turn its switch on. Show the complete Drive consent flow and successful return. |
| 6 | 4 | Documents → New → Add from Google Drive → select `coach-house-drive-demo.md`. Open/use its content; show the existing Vision imported copy, source link, and saved local edit without overwriting it. |
| 7 | 5 → 2 | Show the original Drive file for comparison. Return to Tools with both connections working; stop and save. |

Tab order: **1 → 2 → 3 → 2 → 4 → 5 → 2**. OAuth redirects/popups are part
of these steps. Pause briefly on consent and results so the evidence is readable.

Scope coverage:
- Web Sign-In: `openid`, `userinfo.email`.
- Calendar choice: `calendar.calendarlist.readonly`.
- Private imported events: `calendar.events.readonly`.
- Separate board-calendar export: `calendar.app.created`.
- Picker selection and sample-file use: `drive.file`.

Skip the event-renaming exercise, pause/resume tour, extended policy tour,
`/coaching`, Supabase, Cloud Console, credential screens, and microphone setup.

## 4. Stop and review

- Stop/save using macOS Control–Command–Escape. Ctrl-C can discard the capture.
- Say **“Recording stopped—you can use the computer again.”**
- Confirm the movie exists and plays; review all consent flows and feature results.
- Mask incidental sensitive OAuth URL values or unrelated account/calendar names
  without hiding app identity, permissions, or results. Keep all secrets and private
  non-demo content out of the upload version. Add brief English captions if useful.
- Report the exact Desktop path and any remaining edit needed. The user reviews,
  uploads, then supplies the video URL for the separate verification submission.

### Submission-ready acceptance gate

The movie is not complete until the actual footage passes every item below:

- Coach House identity and purpose are clear and consistent with the submitted app.
- All three client flows show initiation, account selection, readable English
  consent as presented by Google, and successful return. No missing grant screen,
  hidden requested permission, or unresolved error is passed off as a complete flow.
- Each of the six declared scopes maps to a visible feature/result in the movie.
  Record timestamps for the three client flows and their scope-dependent results
  in the review handoff so coverage can be checked without replaying everything.
- The footage uses only approved sample content. Inspect consent account choices,
  calendar selectors, browser tabs, URL transitions, desktop and notifications for
  unrelated information. Review the final redacted version if edits are needed.
- Text remains readable at normal playback size. The saved movie plays through
  without missing sections, broken transitions, troubleshooting or unrelated windows.
- Any captions describe what the footage actually demonstrates. Do not claim broad
  Calendar access, writes to source calendars, or encryption of event content.
- The user receives the reviewed local file and timestamped coverage notes before
  upload. Check the final supplied video link is accessible before form submission.

Google makes the approval decision; passing this gate establishes that the video
addresses the stated requirements, not a guarantee of verification. The separate
form still needs the reviewed video's URL and corrected prepared justification.

If a click fails or security input is required, stop/save, explain the specific
blocker and hand back control. Diagnose off camera before another take. Do not
leave the recorder running through troubleshooting.

## Current status

Recorded September 12, 2026, 04:35:46–04:47:00 UTC. The complete silent source
is 673.583 seconds, 3584 × 2240, with no audio tracks. Recording is stopped and
the user has been told they can use the computer. The reviewed export is being
produced at `~/Desktop/Coach House OAuth - Reviewed.mp4`; do not upload the raw
movie or the separate failed consent rehearsal.

The sequence above was executed with these operational corrections:

- Browser tab shortcuts did not switch the native foreground tab. We used page
  navigation in the visible tab; opening the selected Drive file created a real
  foreground tab, which was used for the final Vision and Tools steps.
- The local Calendar and Drive connections were reset off camera. Calendar setup
  is **select Coach House Demo → Save and sync**; saving enables sync. Turning on
  sync before choosing a source caused the first rehearsal's visible error, and
  that take was stopped and preserved separately.
- Calendar import and the approved export both succeeded. The source Google
  events, Drive sample and existing imported Vision draft were preserved.
- The full returning-account consent lists include basic profile access from
  Google Sign-In, as well as the six previously declared scopes. The submission
  draft now records this additional `userinfo.profile` reconciliation item.
- The selected Drive tile and successful file-added result are visible. The
  native Picker footage still shows other files around it; those previews are
  masked in the export. Do not describe the native footage as a filtered result.

All 135 five-second source samples and the consent/selection detail frames were
reviewed. The export adds English scope/client captions, crops browser chrome
and desktop margins, magnifies consent and selection screens, and masks unrelated
calendar names and Drive previews. It preserves the complete continuous timeline.
Final exported-file decode/privacy checks remain before the user-review handoff.


### Latest override: processing stopped at user request

The user reported excessive computer heat and asked to see the recorded video.
Stopped the Swift export with SIGTERM and confirmed no export/review/validation
process remained. Opened `~/Desktop/Coach House OAuth Review.mov` in QuickTime.
The complete raw take is available; the edited export is unfinished and must not
be described as reviewed or upload-ready. Do not restart encoding, OCR or other
heavy processing unless the user asks. Upload wording was prepared, but references
to a reviewed MP4 are prospective. The raw take contains unrelated calendar/file
details and OAuth URL values; it needs redaction before sharing.


### Completed reviewed copy

The user resumed the work. Finished `~/Desktop/Coach House OAuth - Reviewed.mp4`
using 1080p output, low-priority CPU/GPU scheduling, and a thermal-pressure pause.
The original source frame timing was retained by AVFoundation despite the requested
lower composition frame rate; do not describe the finished file as 10 fps.

Two brief privacy transitions were repaired by encoding only 8.6 seconds total:
the opening Google popup chrome and the Picker's initial file-list load. Assembled
those patches at verified encoded keyframes with passthrough, preserving the
673.583-second timeline and avoiding another complete encode.

Final checks: 1920x1080, no audio, matching duration, complete compressed-stream
read, and 24 selected frames decoded across consent, privacy transitions and
results. The inspected frames retain readable permission text, the selected demo
file, the Vision copy, and both connected Tools entries. No repeat full OCR scan
or full-frame decode was run. The raw source remains preserved separately.

The Desktop upload-details file contains scope/client descriptions and chapter
timestamps. The video is ready for user review. Upload is still user-owned; the
Google form still needs basic-profile scope reconciliation, the actual video URL,
corrected prepared justification, and final app-name finding review.
