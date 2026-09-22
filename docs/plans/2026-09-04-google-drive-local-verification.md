# Google Drive local verification

## Current checkpoint

- Documents and Drive tests pass locally. Restored credentials and the real Picker
  passed on September 10 at 22:11 UTC. Markdown-from-Drive import/edit/save/reload
  and connected-file access passed September 11 at 00:58 UTC.
- Serving worktree: `coach-house-platform`, branch
  `chore/local-development-20260907`, port 3000, at `b476ada1`. The tested combined
  Documents/Calendar integration is merged locally; no deployment occurred.
- September 11, 01:08 UTC: the prepared eight-file Drive privacy/consent patch is
  integrated locally as uncommitted changes. Chrome confirms `/privacy` version
  `2026-09-10.1` with Drive and Calendar; the matching database migration was already
  applied and its function hash is verified. All 16 focused acceptance tests,
  isolated PostgreSQL consent assertions and 16 static-quality stages pass.
  Public privacy still shows `2026-08-27.1`. Next is isolated full release validation
  and a reviewed public deployment; local integration alone does not complete release.
- On September 10, Vercel CLI authorization succeeded in Bandto Chrome as
  `caleb-7249` / `caleb@bandto.com`. Account and coachhouse environment metadata
  requests both return 200. The former personal-account mismatch is resolved.
- All eight Drive settings exist in Production with type `sensitive` and visibility
  `secret`. Vercel's [Secret contract](https://vercel.com/docs/environment-variables/sensitive-environment-variables)
  makes their saved values unreadable; another login cannot export them. No secret
  values were retrieved from Vercel and no provider setting changed. The September 1 runlog
  records independent password-manager backups as the recovery source.
- Root Drive configuration is restored in ignored mode-0600 `.env.drive.local`
  and `.env.development.local`, enabled for localhost:3000. The original version-1
  key successfully decrypted Caleb's stored connection; the restored client secret
  passed a Google token refresh with drive.file. Replaced the incorrectly supplied
  Picker OAuth secret with the existing restricted Coach House Drive Picker API key
  from Joel's Console, without printing it or modifying Google settings.
- Next loaded the eight Drive settings while preserving Calendar and all unrelated
  values. Real UI check: New > Add from Google Drive opened Select a file; Cancel
  returned to Documents without attaching or changing a file. No reauthorization
  or account disconnect was necessary. The subsequent file rehearsal passed.
- The native Google Doc `test for coach house codex connection` is empty; the UI
  rejected it without changing Vision. Google text export independently confirmed
  zero editable characters. Left that source unchanged and uploaded the prepared
  fictional `coach-house-drive-demo.md` privately in Caleb's My Drive instead.
- Real UI imported that Markdown file into previously empty Vision, saved the
  source link, and preserved it after reload. A separate final demo-edit paragraph
  saved and survived a second reload; original agenda/format/link remain. Vision
  is now Draft with the demo content, not empty. Do not reset it or duplicate the
  sample upload. Google checksum/modifiedTime and private sharing are unchanged.
- The same file is connected in Documents, persists after reload/grid/list switch,
  and opens the expected Google source with account access. The original native
  Google Doc remains unchanged; nonempty native-Docs import was not tested.
- See [the integration review](2026-09-09-documents-calendar-integration.md) for
  the historical full quality pass and integration scope; the monthly runlog is
  authoritative for current local, Calendar, provider and release state.

## Before enabling localhost

This worktree uses the shared production Supabase database. A localhost OAuth
connection writes shared connection records; replacing or disconnecting that
connection can affect production. Obtain approval for the exact test account,
organization, and provider changes before a real canary. Fixture tests do not
need that access and must not be described as live verification.

1. Confirm the existing Cloud project and OAuth web client. Keep the existing
   `openid`, `email`, and `drive.file` scopes; do not request full-Drive access.
2. Verify both Google Drive API and Google Picker API are enabled in that project.
   The OAuth client and Picker app ID must belong to the same project; the app
   ID is the numeric project number, not its textual project ID.
3. Verify the exact OAuth redirect is registered:
   `http://localhost:3000/api/integrations/google-drive/callback`.
   Preserve production redirects; do not replace them.
4. Verify localhost is an approved origin/referrer for the selected credentials.
   Google currently documents the app referrer and `https://docs.google.com/*`
   for Picker's iframe, with API restrictions covering Picker and Drive.
   Propose any restriction changes explicitly before saving them.

These provider requirements follow Google's [Picker setup guide](https://developers.google.com/workspace/drive/picker/guides/web-picker-sample?hl=en)
and [OAuth web-server guide](https://developers.google.com/identity/protocols/oauth2/web-server).

## Restore local configuration securely

Use the saved credentials, not chat messages or committed files. Confirm whether
the local environment file is a symlink before editing so other worktrees are
not changed accidentally. Restore the variables listed in the
[feature README](../../src/features/google-drive/README.md#server-configuration),
with the localhost callback above, then restart only this worktree's dev server.

Because the database is shared, the encryption key map and current version must
remain compatible with stored connections and other active deployments. Do not
generate a replacement key just to unblock localhost, overwrite an existing key
version, or remove older versions. Never print tokens or key values in logs.

## Approved signed-in canary

- Confirm the selected organization and Google account before granting access.
- Connect, return to the app, and select one explicitly approved test file.
- Confirm it appears in Documents, survives reload and grid/list switching,
  and opens the expected Google file with appropriate account access.
- Verify cancellation and provider errors leave existing files intact.
- Check authorization with an approved read-only organization member.
- Do not disconnect a shared account or delete the source Drive file as cleanup.
  Remove only the canary reference when explicitly approved.
- Record account/org scope, tested states, and remaining limits in the runlog;
  exclude credentials and private file contents.

This step does not authorize deployment, a new Cloud project, paid database
branches, public file sharing, or a scheduled trash-purge job.


## September15 assessment update

The initial canary-open status above is superseded: original credentials/Picker were verified September10 and the real Markdown import/edit/save/reload plus linked-file canary passed September11. Evidence was recovered and inspected September15. See [current Documents assessment](2026-09-15-documents-inventory-assessment.md) for exact coverage and remaining native-Google-Doc/deployment limits. Do not repeat credential restoration or consent without a newly observed failure.
