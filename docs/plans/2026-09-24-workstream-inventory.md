# Workstream inventory — 2026-09-24

This records the read-only source audit at `origin/main` `32d7e8d8`. It does not assert that historical branches are unshipped. User-confirmed release status overrides older plans: Public Documentation / S02 and PRs #247–#249 are closed.

## Preservation state

Before this planning worktree was created, Git registered 60 valid worktrees and nine stale registrations. Fifty-eight valid worktrees were clean. Two were dirty:

| Worktree | Exact local state | Disposition |
| --- | --- | --- |
| `coach-house-platform-public-documentation-production-20260924` | Unstaged `docs/runlog/2026-09.md`; untracked `docs/plans/2026-09-24-s02-closeout.md` | Preserve; historical closed lane. Do not copy its runlog over main. |
| `coach-house-platform-launch-clean` | Untracked `src/components/public/legacy-home-sections-data.tsx` | Preserve; previous secret scan found six token-like URLs. Do not open, print, stage, commit, or publish. |

The clean root worktree is `chore/local-development-20260907` at `189e0df7`, with no upstream or matching remote branch. Its ancestry is 147 ahead / 11 behind `origin/main`; the fork diff spans 1,255 paths and includes history since absorbed by squash merges. Retain root recovery commit `0a1895fc` as a source, never a release candidate. No listener was observed on TCP port 3000 during the audit; do not start or stop the user's server from this plan.

The planning worktree is `coach-house-platform-workstream-inventory-20260924` on `chore/workstream-inventory-20260924`, created clean from `origin/main`. Its documentation changes are the only writes in this pass.

## Four isolated code sources

All four source worktrees were clean. Ahead/behind counts below are against `origin/main` by ancestry, not the amount of unshipped code. `git cherry origin/main <branch>` marked every listed source commit patch-unmatched; squash merges can still contain equivalent behavior.

| Lane | Branch / head | Ahead / behind | Triple-dot changed paths | Remote state and ownership |
| --- | --- | --- | --- | --- |
| AppShell/mobile | `feat/app-shell-mobile-navigation-20260922` / `d1e4b1a1` | 1 / 5 | 25 | Tracks `origin/main`; no matching remote branch. Eleven AppShell paths, 13 mobile-navigation paths, one acceptance test. |
| Marketplace people | `feat/public-profiles-marketplace-people-20260922` / `6b3be0b6` | 1 / 5 | 10 | Tracks `origin/main`; no matching remote branch. Seven feature paths, one public detail route, one query, one test. |
| Particles/Objectives | `feat/workspace-particles-objective-resume-20260922` / `c855aea6` | 4 / 5 | 89 | No upstream or matching remote branch. Particles, objective planner, dashboard canvas, API, Drive/roadmap adapters, tests and visual fixtures. Product concept/UI unfinished. |
| Calendar | `feat/google-calendar-resume-20260922` / `508b8df0` | 6 / 5 | 42 | Tracks `origin/main`; no matching remote branch. Roadmap calendar, Workspace Tools, two AppShell components, tests/visual fixtures, provider documentation. |

Source commits: AppShell `d1e4b1a1`; people `6b3be0b6`; Particles `318b5915`, `6606c1a7`, `9d047707`, `c855aea6`; Calendar `024860c6`, `e5ca7e04`, `9e4e3be1`, `e1fc1c6f`, `bbc1a902`, `508b8df0`. These are candidate sources, not cherry-pick instructions. The Particles and Calendar diffs overlap exactly on `docs/runlog/2026-09.md` and `tests/acceptance/projects.json`. Calendar also owns two AppShell Calendar components; review their integration with the AppShell lane. The People route sits under Documentation but its content was intentionally excluded from the closed Documentation release.

## Other local source and recovery references

| Reference | Head | Disposition |
| --- | --- | --- |
| `feat/public-docs-marketplace-resume-20260922` | `3b91b2ad` | Mixed immutable preservation source; never push whole. |
| `feat/public-documentation-content-20260922` | `67c7fa8d` | Closed Documentation history; do not restart. |
| `feat/google-calendar-sync-20260908` and `chore/google-calendar-recovery-20260922` | `1713e8c3` | Calendar source/evidence; compare with isolated Calendar lane. |
| `chore/particles-objective-recovery-20260922` and `chore/parallel-development-20260914` | `fd5e5f77` | Particles recovery source; compare with isolated lane. |
| `chore/documents-calendar-consent-recovery-20260922` | `911b1d5a` | Mostly historical/absorbed; never replay without exact hunks. |
| `chore/google-drive-ui-evidence-recovery-20260922` | `961efc07` | Documents visual evidence, review for residuals only. |
| `chore/ai-auth-runlog-recovery-20260922` | `6c2e492b` | Historical auth/log source; review for residuals only. |
| `chore/calendar-review-evidence-recovery-20260922` | `a8582c2f` | Calendar review evidence. |
| `chore/antigravity-particles-recovery-20260922` | `48199ba7` | Local experimental preservation. |
| `chore/launch-clean-recovery-20260922` | `f15ce510` | Legacy public UI reference; exclude untracked secret-bearing file. |

Many older registered worktrees and local branches remain. They are parked historical references, not approved deletion targets or independent release candidates. Their exact disposition remains unresolved until a lane's file comparison proves a residual change. Stale registrations also remain untouched. No pruning is authorized by this inventory.

## Provisional discovery for four unsplit lanes

These are path-prefix matches in the root's 1,255-path fork diff, not verified residuals. The root mixed multiple lanes and some content has shipped. No files from this table are approved to copy until a file/hunk comparison against current main is recorded.

| Lane | Candidate paths seen in root triple-dot diff | Boundary to resolve |
| --- | --- | --- |
| Public Find/map | 37 `src/components/public/public-map-index/**`, one `src/features/find-map/**`, five `src/lib/public-map/**`, and `src/lib/queries/resource-map-public-items.ts` | Public behavior and publishable data only; review each hunk against current main and closed Documentation routes. |
| Resource acquisition | 30 `scripts/resource-map/**` and 14 `tests/acceptance/resource-map-*` | Separate private IRS EO tooling tests from public resource-map tests; never copy raw candidate queues. |
| Org/Documents | 44 `src/components/organization/**` and ten `src/features/google-drive/**` | Compare with shipped Core Documents/Drive behavior; organization paths include unrelated company/profile UI. |
| Account/settings/profile | 18 `src/components/account-settings/**`, two `src/actions/{account-email-preferences,public-profile-settings}.ts`, ten `src/features/public-profiles/**` | Compare with shipped admin/profile/auth changes and with the Marketplace people lane; public-profile paths have mixed ownership. |

These areas are too broad for a safe replay. The next executor pass should classify exact paths/hunks for one selected lane, then return a manifest before moving code. Public Find and acquisition share a naming family but have distinct publication boundaries.

## Candidate comparison procedure

For each selected source, run `git log --oneline origin/main..<source>`, `git diff --name-status origin/main...<source>`, and `git cherry origin/main <source>`. Then compare proposed files and hunks with current `origin/main`; these commands alone cannot identify squashed/absorbed work. Record an exact inclusion/exclusion list and any shared-file owner before copying. Stop if a source mixes lanes or a file's current ownership is unclear.
