# Open Work Index

Last updated: 2026-09-22 14:52 EDT.

Purpose: one durable entrypoint for unshipped local work. Use this with `AGENTS.md`, `docs/RUNLOG.md`, and `docs/plans/2026-09-22-sprint-recovery-map.md`.

## Non-negotiable recovery rules

- Do not discard, reset, delete, clean, prune, or overwrite work unless Caleb explicitly asks for that exact action.
- Do not merge/push/deploy any recovery branch as-is. Recovery branches are salvage lanes, not release lanes.
- Start release candidates from fresh `origin/main`, then restore or cherry-pick only one lane.
- If a lane touches shared shell, navigation, mobile, layout, public profiles, or Workspace drawer/canvas, validate those shared surfaces separately.
- Keep public routes separate from internal/admin/Workspace work.
- Keep provider setup, database/live mutations, deployment, and code readiness separate.
- Record every meaningful continuation in the current monthly runlog linked by `docs/RUNLOG.md`.

## Current base

- Current `origin/main`: `dc36b113` (`[STEP S99] Restore Workspace tab content widths (#244)`)
- Root recovery branch: `chore/local-development-20260907`
- Root latest local checkpoint: current `HEAD` of the root recovery branch; run `git rev-parse --short HEAD`.
- Root worktree: `/Users/calebhamernick/Development/coach-house-platform`

## Resume checklist for any new chat

1. Read `AGENTS.md`.
2. Read `docs/RUNLOG.md`, then latest entries in `docs/runlog/2026-09.md`.
3. Read this file.
4. Run:

   ```bash
   git status --short --branch
   git fetch origin
   git rev-parse --short origin/main
   ```

5. Pick one lane only.
6. Before writing, confirm the lane branch/worktree and whether the lane is clean.

## Active lanes

| Lane | Worktree | Branch / commit | Status | Not release-ready because | Must not mix with |
|---|---|---|---|---|---|
| Workspace particles/objectives | `/Users/calebhamernick/Development/coach-house-platform-particles-objective-resume-20260922` | `feat/workspace-particles-objective-resume-20260922` / `c855aea6` | Clean; focused tests, static, acceptance, RLS, build, and focused visuals passed | Full visual has unrelated Documents banner drift; needs Workspace drawer/tab/mobile regression pass before release | Calendar, public docs, public Find |
| Google Calendar | `/Users/calebhamernick/Development/coach-house-platform-google-calendar-resume-20260922` | `feat/google-calendar-resume-20260922` / `508b8df0` | Clean; local code gates and focused Calendar visual passed | OAuth/provider config and live Calendar canary are not verified | Workspace particles, public docs |
| Public Documentation recovery snapshot | `/Users/calebhamernick/Development/coach-house-platform-public-docs-resume-20260922` | `feat/public-docs-marketplace-resume-20260922` / `3b91b2ad` | Clean preservation snapshot; gitleaks passed; focused acceptance passed 72 tests; route and feature contracts passed | It includes shared AppShell, mobile navigation, and public-profile dependency closure. Split deeper before any push/PR | Workspace drawer/canvas, Calendar, public Find/resource-map |
| AppShell and mobile navigation | Create fresh worktree from `origin/main` when ready | Source: `3b91b2ad`, possibly older `/Users/calebhamernick/Development/coach-house-platform-mobile-experience-20260912` | Not isolated yet | Shared shell/mobile changes are currently hidden inside the public-docs snapshot | Documentation content/routes, Workspace product work |
| Public profiles / marketplace people | Create fresh worktree from `origin/main` when ready | Source: `3b91b2ad` plus public-profile history if needed | Not isolated yet | Marketplace people pages need public-profile privacy and handle validation checks | AppShell/mobile, public docs content |
| Public Find / map / resource-map UI | Create fresh worktree from `origin/main` when selected | Sources: root `0a1895fc`, launch-clean `f15ce510`, Find/map worktrees | Not isolated yet | Broad public-route and resource-map risk; must not expose raw intake queue or synthetic seeds | Documentation marketplace, resource acquisition scripts |
| Resource-map acquisition scripts | Create fresh worktree from `origin/main` when selected | Source: root `0a1895fc` | Not isolated yet | Private IRS EO acquisition/review tooling needs boundary checks; not public `/find` data | Public Find UI, Documentation |
| Org/Documents leftovers | Create fresh worktree from `origin/main` if needed | Source: root `0a1895fc`, Documents worktrees | Mostly likely absorbed by PR #243; compare first | Must avoid replaying older Documents code over shipped Drive/Core Documents work | Calendar, public docs |
| Account/settings/profile refinements | Create fresh worktree from `origin/main` if needed | Source: root `0a1895fc`, profile/settings worktrees | Not isolated yet | Must compare against shipped PR #242 admin/coach/internal tooling | AppShell/mobile unless selected |
| Launch-clean legacy | `/Users/calebhamernick/Development/coach-house-platform-launch-clean` | `launch/canvas-map-implementation` / `f15ce510` | Legacy reference only | One untracked tokenized media file remains and must not be printed, committed, pushed, or published | Everything unless manually extracted |

## Required lane split before Documentation can ship

Do not push `feat/public-docs-marketplace-resume-20260922` as-is.

Split it into:

1. `feat/public-documentation-content-<date>`
   - Include only `/documentation` routes, `src/features/nonprofit-documentation`, documentation visual fixtures/tests/assets, and docs plans.
   - Prefer adapting Documentation shell to current `main` over pulling shared AppShell changes.

2. `feat/app-shell-mobile-navigation-<date>`
   - Include only shared AppShell/mobile-navigation support.
   - Validate dashboard shell, public shell, mobile nav, auth/header actions, sidebar/right-rail behavior, and Workspace drawer width/tab refinements.

3. `feat/public-profiles-marketplace-people-<date>`
   - Include only marketplace people/public-profile projection code.
   - Validate public privacy, handle routing, `/[handle]`, `/documentation/marketplace/people/[handle]`, and empty/error states.

## Release-readiness gate for any lane

A lane is not release-ready until all are true:

- Branch is fresh from current `origin/main` or intentionally rebased/replayed onto it.
- Branch contains only its lane files; shared files are audited.
- `git status --short --branch` is clean.
- `gitleaks protect --staged --redact` passed before local commit.
- Focused acceptance/unit tests for the lane pass.
- Guardrails relevant to scope pass: routes, features, feature scaffold, boundaries, workspace surfaces, interaction locks, raw buttons as applicable.
- `pnpm check:quality:static`, `pnpm check:quality:acceptance`, `pnpm check:quality:build`, and relevant visual/RLS gates pass or blockers are explicitly documented.
- Public-route changes have screenshot/browser review.
- Workspace changes prove drawer/tab/mobile refinements from current `main` remain intact.
- Provider/database/deployment/live canaries are separated and explicitly approved.
- Current monthly runlog records evidence and limitations.

## Known holds

- Do not touch or print this file without explicit direction:

  `/Users/calebhamernick/Development/coach-house-platform-launch-clean/src/components/public/legacy-home-sections-data.tsx`

  It remains uncommitted because gitleaks found six redacted JWT-like URL tokens.

## Quick status command

```bash
for path in \
  /Users/calebhamernick/Development/coach-house-platform \
  /Users/calebhamernick/Development/coach-house-platform-particles-objective-resume-20260922 \
  /Users/calebhamernick/Development/coach-house-platform-google-calendar-resume-20260922 \
  /Users/calebhamernick/Development/coach-house-platform-public-docs-resume-20260922 \
  /Users/calebhamernick/Development/coach-house-platform-launch-clean
do
  printf '\n%s\n' "$path"
  git -C "$path" status --short --branch
  git -C "$path" log --oneline --max-count=1
done
```
