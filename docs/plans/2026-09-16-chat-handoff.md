# Resume the September 16 stakeholder checkout

Read `AGENTS.md`, `docs/RUNLOG.md`, its latest monthly entries, then this file.
This is the Brand Identity / localhost workstream. The separate Particles
worktree is not part of this checkpoint.

## Branches and worktrees

| Purpose | Branch | Local directory |
| --- | --- | --- |
| Complete localhost checkpoint | `chore/stakeholder-checkpoint-20260916` | `../coach-house-platform-stakeholder-checkpoint-20260916` |
| Focused Brand Identity work; draft PR #239 | `fix/profile-settings-completion-20260914` | `../coach-house-platform-profile-settings-fix-20260914` |
| Existing localhost:3000 server | `chore/local-development-20260907` | original `coach-house-platform` directory |
| Separate management authorization fix; draft #240 | `fix/management-developer-authorization-20260914` | `../coach-house-platform-ai-auth-fix-20260914` |

- The checkpoint preserves the complete non-ignored root working tree, including
  its existing Documents, Calendar, mobile, map, Profile, Marketplace, Brand
  Identity, tests, reviewed images and continuation notes. It is a recovery
  checkpoint, not an independently reviewed release candidate.
- Root's branch, HEAD and index were deliberately retained. Its dirty changes
  remain in place for the running server; do not discard them as duplicates.
- The focused Brand changes are also committed on the existing Profile branch,
  retaining its draft PR and Documents dependency. Do not merge the complete
  checkpoint into that focused branch.
- Leave `../coach-house-platform-parallel-20260914` and its Particles work alone.
- Preserve the no-merge / no-production-release / no-Calendar-activation hold.
  GitHub preservation is authorized; deployment and provider/database changes
  are not part of this task. Existing push automation may create previews.

## Completed changes

- Brand guide: sticky right-side section navigation and export controls;
  responsive mobile contents/export layout.
- Images: illustrations/campaign artwork fill their tiles; logos remain
  contained; independent 4:5 vertical-post slot and preview/export support.
- Exactly three editable Actionables below Primary audience, with persistence,
  backwards-compatible defaults and export support.
- Empty primary-logo upload icon is always visible and clickable. Uploaded
  controls still reveal on hover/focus; touch targets remain 44px. Other empty
  slots retain their existing behavior. Semantic owner:
  `src/features/nonprofit-documentation/components/brand-identity/brand-asset-field.tsx`.
- Localhost now includes the previously unmirrored Profile saving, public
  identity, email preferences and management API authorization fixes from
  `8673bcff` and `beaa15b2`. Existing files were copied only after confirming
  they matched the donor commit's parent; unrelated local edits were preserved.
- Byte parity checked for 287 Brand/Marketplace, 23 Calendar, 13 mobile
  navigation and 72 Documents feature files against their source worktrees.

## Review locally

- `http://localhost:3000/`: public map; `/find` redirects here.
- `http://localhost:3000/documentation`
- `http://localhost:3000/documentation/marketplace`: 34 resources.
- `http://localhost:3000/documentation/tools/brand-identity`
- `http://localhost:3000/workspace`: sign in for Workspace, Documents and Calendar.

The existing server was PID 4179 in the root checkout when verified. Recheck
with `lsof -nP -iTCP:3000 -sTCP:LISTEN` and `lsof -a -p <pid> -d cwd`; PIDs
change. Do not start another server or clear caches when the correct server is
healthy. Environment files and local browser kits are intentionally not in Git.
Brand text is localStorage-backed; uploaded files are IndexedDB-backed and are
specific to the user's browser/origin. A fresh browser has an empty guide.

## Evidence and limits

- Preservation validation: all 16 Profile static stages passed, including full
  lint and snapshots; both staged secret scans reported zero findings. The
  isolated checkpoint was compared byte-for-byte with all 4,669 non-ignored
  tracked/untracked root files before committing.

- Empty-logo change: scoped lint, 10 focused asset tests, React Grab ownership,
  thresholds and whitespace passed. Fresh contexts verified file-picker upload,
  removal/reload, populated hover/focus, desktop light/dark and 390px touch UI.
- Localhost synchronization: 120 focused tests in five suites plus all four
  offline Profile browser tests passed. Scoped lint and acceptance manifest pass.
- Public pages returned 200 without observed browser page errors. Brand's three
  Actionables, portrait slot, export and empty upload icon were verified. Public
  profile loaded; map canvas mounted with the first-visit location prompt.
- Browser attachment discovery returned no connected browser. These checks did
  not exercise the user's signed-in Workspace or live Google provider flows.
- The previous full hosted green result belongs to Profile `259be0c3`, before
  these local Brand refinements. Check the updated PR's exact-head CI; do not
  carry that old green status forward. Full quality/build and the broader Brand
  visual-reference refresh are not established by focused checks.
- The root graph was refreshed locally after code synchronization. No model/API
  calls were made. Avoid full local builds/suites or repeated graph rebuilds for
  status-only work; the user previously reported laptop overheating. Full
  validation should run on hosted CI, without activating production.
- Original first-login Workspace drawer confirmation remains user-deferred.
  Native Google Doc proof and external provider activation are not completed by
  this checkpoint. Existing Profile migrations were already applied earlier;
  do not rerun them simply because their files are in the checkpoint.

## Next chat

1. Inspect current worktrees and remote branch heads before changing anything.
2. For another focused Brand edit, continue the Profile worktree and mirror only
   the owned changed files to root for localhost review, preserving other edits.
3. To recover the complete presentation state elsewhere, check out the
   checkpoint branch into a new worktree. Restore environment configuration
   privately from the existing local setup; never commit credentials.
4. Check draft #239's exact-head results and the remaining visual references
   before describing the follow-ups as release-ready.

Start prompt: "Read AGENTS.md, the latest RUNLOG entries, and
docs/plans/2026-09-16-chat-handoff.md. Resume the Brand Identity / stakeholder
checkpoint. Preserve dirty work and the Particles worktree. Do not merge or
deploy."
