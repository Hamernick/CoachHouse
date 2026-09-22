# September 14 GitHub synchronization

The original worktrees remain intact. Publication uses separate draft branches;
no main merge or shared migration was performed.

| Work | GitHub review | Base |
| --- | --- | --- |
| Mobile layouts and combined map navigation | [#235](https://github.com/Hamernick/coach-house-lms/pull/235) | main |
| Homepage branding | [#236](https://github.com/Hamernick/coach-house-lms/pull/236) | main |
| Google Calendar and verification handoffs | [#237](https://github.com/Hamernick/coach-house-lms/pull/237) | main |
| Connected Documents and draft recovery | [#238](https://github.com/Hamernick/coach-house-lms/pull/238) | preserved local feature baseline |
| Existing development consolidation | [#229](https://github.com/Hamernick/coach-house-lms/pull/229) | main |
| Owned resource crawler | [#231](https://github.com/Hamernick/coach-house-lms/pull/231) | #229 |

## Recovery

- Verified private backup: `/Users/calebhamernick/Development/coach-house-github-sync-backup-20260914-125932`.
- Includes all eight originally dirty worktrees, staged/unstaged patches, original
  files, indexes, hashes, and a verified complete Git-history/reflog bundle.
- GitHub `chore/local-development-backup-20260914` preserves local development
  commit `b476ada1`; `chore/local-feature-baseline-20260914` preserves `be09d23a`.
- Original dirty worktrees and two duplicate tsconfig stashes remain unchanged.
  Older launch variants and standalone review screenshots remain in the private
  recovery archive; they have not been mixed into current product PRs.

## Validation and merge order

- Redacted secret scans passed for the published source/history and handoffs.
- Pre-push acceptance checkpoints: mobile 2,302; Calendar 2,313; Documents 2,507;
  repaired #229/#231 stack 2,380. Each includes one expected skip separately.
- Branding CI passed. Mobile production build/bundle budget passed after separating
  the lightweight navigation context. Calendar build/static/RLS/acceptance passed.
  Visual fixes and final publication checks must be assessed on the latest PR head.
- #229/#231 were updated by normal fast-forward pushes; GitHub reports both
  mergeable. Review #229 before its dependent #231. No history rewrite occurred.
- Mobile, branding, and Calendar can be reviewed separately against main. Check
  the overlapping mobile/Calendar component changes together before merging both.
- Documents depends on additional preserved baseline work. Review/reconcile that
  baseline before retargeting Documents to main; do not merge the backup branches
  wholesale. Its visual CI failures still need resolution before release.

Google provider settings, credentials, production feature activation, and live
canaries are separate from this GitHub source synchronization.

## Older work assessment

The [September 14 feature inventory](2026-09-14-older-work-assessment.md) separates
#229 and the preserved baseline into ten product areas, identifies versions
already on main, and records remaining product decisions. This is assessment
only; no release or cleanup is authorized. The latest Documentation library,
planners, and Marketplace are preserved in #238's base, rather than an
independent main-based Documentation PR.
