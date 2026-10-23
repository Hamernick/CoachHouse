# Cleanup assessment — October16, 2026

Read-only assessment requested by Caleb. No PR was closed, stash applied/dropped, branch removed, worktree reset/deleted, process stopped, or source migrated. Counts are Git artifacts and changed paths, not unfinished product features. Seven of ten dirty worktrees have all changed paths byte-identical to current main or their matching October13 remote recovery snapshot. This includes expanded untracked file lists; ignored files/private databases/credentials are outside that comparison.

## Seven historical draft PRs

| PR | Purpose | What we know / cleanup disposition |
| --- | --- | --- |
| [229](https://github.com/Hamernick/CoachHouse/pull/229) | Broad September development baseline: resources, Drive, Documentation, Find and Workspace | Mixed historical integration branch;231 depends on it. Preserve as an archive and reconcile remaining feature requirements before closing as superseded. Do not merge wholesale into current main. |
| [231](https://github.com/Hamernick/CoachHouse/pull/231) | Guarded resource crawler: signed plans, URL/network protection, pacing and resumable evidence | Its named crawler scripts are absent from current main; newer nonprofit enrichment exists separately. Keep until that workstream decides whether this older executor remains needed. It was never evidence of published map resources. Depends on229. |
| [235](https://github.com/Hamernick/CoachHouse/pull/235) | Mobile layouts, map drawer/navigation and saved-guide handling | Older version predates later mobile/Resources redesigns. Reconcile residual behavior against the current app, then archive/close the draft if superseded. Do not bring back the old navigation layout. Full equivalence has not been established. |
| [237](https://github.com/Hamernick/CoachHouse/pull/237) | Google Calendar connection, synchronization and Tools controls | Later implementation257/CI268 merged; production connection/sync acceptance remains open. Treat237 as a likely superseded draft, not the next implementation branch. Check for residual fixes, then close while keeping Calendar on the checklist. |
| [238](https://github.com/Hamernick/CoachHouse/pull/238) | Connected document import, rich text, serialized saves and draft recovery | Stacked on a preserved baseline, now overlaps later Documents/co-editing releases. Reconcile import/recovery-specific leftovers before closing. Do not merge the entire old dependency stack. |
| [239](https://github.com/Hamernick/CoachHouse/pull/239) | Profile settings, Workspace, Marketplace/People, Documentation and Brand assets | Broad mixed draft on238. Split any remaining product requirements into the existing checklist, preserve source, then retire the old draft when accounted for. No blanket shipped claim for Brand/People refinements. |
| [240](https://github.com/Hamernick/CoachHouse/pull/240) | Require current developer authority for management/AI APIs | Exact runtime guard and authorization test files match main. Strong candidate to close as already incorporated; retain useful historical security rationale. This finding does not establish every broader management security review is complete. |

PR330 is the new documentation-only handoff, outside those seven old drafts. Closing a PR removes it from the active review queue; it does not itself delete its source branch or local worktree. These are separate cleanup decisions.

## Ten dirty worktrees

All names below are directories under /Users/calebhamernick/Development/. “Recovery” means matching branch under origin/chore/recovery-20261013t005640z/. Exact ref/path lists are in the private closeout JSON. Counts include all untracked files rather than collapsed directory entries; therefore some exceed the initial inventory counts.

| Worktree | Contents / current evidence | Cleanup disposition |
| --- | --- | --- |
| coach-house-platform |4changed files: instructions, tracker, September log and Calendar readiness plan.3match recovery; AGENTS.md differs. Active processes use this root. | Keep root. Preserve/reconcile the one newer instruction change; then consolidate stale local documentation. Do not delete the primary checkout. |
| coach-house-platform-internal-projects-tasks-20260928 |133changed paths for internal projects/tasks, admin/coach dashboards and supporting tests.84match main;49match recovery. | Archive/retirement candidate after reviewing the remaining49against newer main, saving private/ignored state and checking branch/history/process ownership. No need to reimplement all133changes. |
| coach-house-platform-internal-updates-20261001 |52changed paths for project/task feedback, onboarding/profile changes and dialogs.7match main;45match recovery. | Same reconciliation/archive process; keep unique requirements on the checklist rather than merging this mixed checkout. |
| coach-house-platform-live-hotfix-20261009 |Only a6-line production-verification runlog receipt; exact recovery copy exists. | Easy retirement candidate after ensuring the receipt is discoverable and remaining branch/private-state checks pass. No unfinished application code in its dirty diff. |
| coach-house-platform-map-data-scale-20261003 |12changed files: nonprofit crawl caching/structured evidence and planning/tests.2match main;10match recovery. | Keep the private acquisition database/source receipts. Source is recoverable, but Git does not protect the private dataset. Retire only after verified private-data backup and ownership handoff. |
| coach-house-platform-onboarding-scroll-20261009 |Only a5-line post-merge runlog receipt; exact recovery copy exists. | Easy retirement candidate after preserving the receipt and checking remaining branch/private state. No unfinished application code in its dirty diff. |
| coach-house-platform-particle-system-20261009 |368changed files covering the active Particle/editor/workspace system, supporting schema/tests/config. None match main or that checkout's October13recovery snapshot. Active processes use it. | KEEP. Current owner must checkpoint and back up the newer work; do not clean/reset/delete or merge it incidentally. A file difference is not proof that a feature is unshipped, but it is a preservation requirement. |
| coach-house-platform-rapid-iteration-20261005 |128changed files across public homepage/profiles/Find/map/Collect and shared actions.34match main;94match recovery. | Mixed historical archive candidate after remaining feature reconciliation and private-state checks. Do not replay old public layouts. |
| coach-house-platform-rapid-ui-ux-20261007 |303changed paths across onboarding, Workspace, profile/documents and tutorials.238match main;65match recovery. | Largely already incorporated; reconcile remaining65and preserve private assets before retiring. Original chat closure remains closed unless a specific unmatched requirement warrants work. |
| coach-house-platform-tiptap-hotfix-20261015 |Only a6-line production migration receipt, newer than the matching recovery snapshot. Records20261015190000applied/verified. | Preserve receipt in the canonical log and archive its rollback evidence first; then assess retirement. Do not replay the migration. |

Comparing changed paths does not prove all branch commits are integrated, or that a worktree has no ignored/private files. Before physical removal: verify exact branch/history preservation, ignored data, env files, symlink/shared dependency ownership and running processes. No general deletion command is proposed from this inventory alone.

## Two stashes

- stash@{1}, be29667362023ccd7d8a4ec1454eb1fea947d3de, December29,2025: only tsconfig.json. Its compiler options and included paths are already in main; main additionally excludes deprecated. Strong candidate to drop after an optional recovery export. Do not apply it: that would restore an older configuration.
- stash@{0},0ef785437a0b20ec0e780d2289efd60c14ee467f, same date: same tracked tsconfig patch PLUS an untracked-files parent containing .codex/config.toml, old dev log/PID and about60MBof Supabase CLI executable/archive/support files. The local config differs from the current root. Preserve/review that config privately before dropping; the old executable/logs are not application features. Do not publish raw config or logs in a cleanup PR.

Use immutable hashes, not just stash indices, when acting: indices renumber after a drop. The two tracked patches are identical, but the complete stashes are not duplicates.

## Recommended cleanup order

1. Preserve the newer Tiptap receipt and root instruction delta; the Particle owner handles its active source backup. Keep the enrichment dataset/receipts intact.
2. With explicit cleanup authorization, close240as incorporated; export/drop the redundant configuration stash and handle0's private configuration separately.
3. Reconcile and retire the three documentation-only worktrees. Root itself stays.
4. Reconcile237and235against their later implementations; retain Calendar provider work as open after closing an obsolete draft.
5. Work through the mixed229/238/239stack and four large historical UI/internal worktrees by remaining requirements, not by merging their entire branches. Keep231until the crawler owner decides.
6. Delete physical worktree directories only after the source/private-state/process checks above and explicit approval for exact paths. Existing remote recovery snapshots reduce risk but do not replace a current private-data backup.
