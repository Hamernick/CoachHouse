# Open Work Index

Updated 2026-09-25. Read after `AGENTS.md`, `docs/RUNLOG.md`, and its latest monthly entries. Cleanup base: `origin/main` `32d7e8d8`; recheck Git before new work.

Maintain one active entry per lane or preservation hold. Update entries in place:
replace renamed branch references and obsolete next actions instead of appending
duplicates. Keep historical closeout records in the logs; they do not reopen work.
When changing the startup sequence, keep `AGENTS.md`, `docs/RUNLOG.md`, and the
workflow checkpoint aligned in the same change.

## Closed

Caleb confirmed Public Documentation / S02 shipped and PRs #247–#251 merged. Do not reopen them, repeat production checks, or restart the historical menu investigation from old handoffs. #249 changed test isolation only. Caleb also confirmed the navigation/startup cleanup merged; PR #253 is closed work. Do not restart its menu fix or repeat merge/production verification.

## Open lanes

The four `chore/*` backup branches start at `32d7e8d8`, contain scoped copies of existing work, and are backed up on GitHub. They are **unfinished, not release-ready**. Original sources remain. Old runlog versions were excluded; Particles and Calendar acceptance manifest additions were merged with current main.

| Lane | GitHub backup / source | Remaining work and validation |
| --- | --- | --- |
| AppShell/mobile | `chore/app-shell-mobile-20260924` (`2f15f54f`); `feat/app-shell-mobile-navigation-20260922` (`d1e4b1a1`) | Review dashboard/public/mobile shell, sidebar and drawer behavior; focused browser/acceptance and hosted quality. Calendar owns separate AppShell Calendar controls. |
| Marketplace people | `chore/marketplace-people-20260924` (`21026428`); `feat/public-profiles-marketplace-people-20260922` (`6b3be0b6`) | Complete list/detail integration; check privacy, handles, empty/error states and browser behavior. Closed Documentation content stays separate. |
| Particles/Objectives — high priority | `chore/workspace-particles-objectives-20260924` (`8eabd28e`); `feat/workspace-particles-objective-resume-20260922` (`c855aea6`) | Product concept and UI/UX remain rough. Decide the flow, then review canvas/drawer/mobile and Drive authorization. Passing tests do not establish readiness. |
| Google Calendar | `chore/google-calendar-20260924` (`a1acccad`); `feat/google-calendar-resume-20260922` (`508b8df0`) | Review Workspace Tools/roadmap/AppShell integration; finish provider/OAuth setup and approved live-flow verification separately from code checks. |


## Named preservation holds

The mixed root history has broad candidate areas. No file/hunk review yet proves which changes remain unshipped. Keep the source locally; never push or replay the mixed history wholesale.

| Hold | Owner/source | Concrete next step |
| --- | --- | --- |
| `H-FIND` | Public Find/resource-map UI; root `0a1895fc`, launch reference `f15ce510`, Find branches | Compare public UI/data files with main; isolate residuals and prove raw intake/synthetic seeds cannot enter `/find`. |
| `H-ACQUISITION` | Private resource acquisition scripts; root `0a1895fc` | Compare `scripts/resource-map/**` and tests with main; keep private tools separate from publication. |
| `H-ORG-DOCS` | Org/Documents leftovers; root and Documents/Drive branches | Compare with shipped Core Documents/Drive work; isolate only remaining hunks. |
| `H-ACCOUNT` | Account/settings/profile; root and profile/settings branches | Compare with shipped admin/auth/profile work; resolve Marketplace people and shared-shell ownership. |

`H-LEGACY` holds other historical local refs whose current-main equivalence is unproven. See the [branch ledger](../plans/2026-09-24-local-branch-ledger.csv) for every local ref, saved head, matching remote, purpose, and next action, and the [worktree ledger](../plans/2026-09-24-worktree-ledger.csv) for every checkout. Nine stale registrations remain untouched.

## Clean state and release gates

All 61 valid registered worktrees were clean after cleanup. Closed S02 notes were saved locally on `chore/preserve-s02-closeout-local-20260924` (`80cb2c3f`); this is historical, not a release branch or remote backup. The token-bearing legacy file was copied byte-for-byte to a mode-0700 private archive outside all worktrees, verified, then removed from launch-clean. Its contents were not printed or uploaded. Ignored credentials/data and localhost:3000 were left alone.

The root mixed recovery branch remains local. Four scoped backup branches passed staged and complete outgoing-commit secret scans and diff hygiene. No new application or hosted release tests ran in this organization pass. No open lane is marked release-ready.

Before shipping any lane: inspect branch/upstream/dirt and compare with current main; resolve shared-file ownership; run focused checks and browser review for affected UI; append the current monthly runlog; pass the current PR's hosted `quality`, code-owner review, and branch protection. Provider setup, live data, deployment, and production verification have separate gates. Particles and Calendar own only their respective additions to `tests/acceptance/projects.json`; current-main entries must remain. Work one lane at a time.

## Local continuation checkpoint — 2026-09-25

- Root checkout: `chore/local-development-20260907`, mixed local preservation history. Startup documents are synced from `origin/main` at `b8cce495` with this local closeout. Application files are unchanged. Root state before sync is preserved at `285a0899`; do not push or replay the mixed history wholesale.
- Navigation/startup cleanup is closed per Caleb. Eight unfinished feature lanes above remain open; none is declared release-ready. Start the selected lane in a clean isolated worktree from freshly fetched `origin/main`, adapting only its remaining changes.
- Readiness audit: all 62 usable worktrees were clean; four scoped `chore/*` lane backups matched live GitHub refs. Nine stale registrations remain preserved, not active worktrees. Ignored credentials/local data and localhost:3000 remain untouched.
- `H-STALE-REGISTRATIONS`: nine previously inventoried missing/broken worktree registrations. Keep the existing worktree ledger as evidence; inspect surviving directories and preserve any files before considering pruning. They do not block a new isolated lane.
- `H-STASH-20251229`: two historical stashes remain local, intentionally unapplied. Ownership and current-main equivalence are unproven. During relevant lane review, inspect only file names/diffs needed to classify remaining work; never apply or upload them wholesale. Saved refs:
  - `stash@{0} 0ef785437a0b20ec0e780d2289efd60c14ee467f 2025-12-29`
  - `stash@{1} be29667362023ccd7d8a4ec1454eb1fea947d3de 2025-12-29`
- This is a local handoff checkpoint, not a release or cloud backup. Carry the PR #253 closed status into the next lane's normal handoff update; no separate bookkeeping PR is needed. The merged AGENTS snapshot contained two equivalent continuation bullets; this local copy keeps the canonical linked rule only.
