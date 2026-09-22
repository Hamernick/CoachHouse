# Sprint Recovery Map - 2026-09-22

Purpose: preserve and classify local sprint work without discarding anything. These checkpoints are recovery anchors, not release candidates.

## Current Production Base

- Fresh `origin/main`: `dc36b113` (`[STEP S99] Restore Workspace tab content widths (#244)`)
- Recent merged releases on `main`: PR #242 admin/coach tools, PR #243 Documents/Drive-backed Core Documents, PR #244 Workspace tab width hotfix.
- Closed/rejected broad release: PR #241. Do not revive it as-is.
- Durable open-work entrypoint: `docs/agent/open-work-index.md`.

## Preservation Checkpoints

| Workstream | Worktree branch | Recovery commit | Recovery branch | State |
|---|---|---:|---|---|
| Workspace particles/objective resume | `feat/workspace-particles-objective-resume-20260922` | `c855aea6` | local only | clean; quality mostly passed, visual blocked by unrelated Documents banner drift |
| Google Calendar resume | `feat/google-calendar-resume-20260922` | `508b8df0` | local only | clean; static, acceptance, RLS, build, and focused Calendar visual passed |
| Public Documentation/Marketplace recovery snapshot | `feat/public-docs-marketplace-resume-20260922` | `3b91b2ad` | local only | clean preservation snapshot; not release-ready; split AppShell/mobile/public-profiles first |
| Root sprint pile | `chore/local-development-20260907` | `00692e48` | `chore/root-sprint-recovery-20260922` | clean |
| Workspace particles/objective | `chore/parallel-development-20260914` | `fd5e5f77` | `chore/particles-objective-recovery-20260922` | clean |
| Google Calendar sync | `feat/google-calendar-sync-20260908` | `1713e8c3` | `chore/google-calendar-recovery-20260922` | clean |
| Documents/Calendar consent | `chore/documents-calendar-integration-20260909` | `911b1d5a` | `chore/documents-calendar-consent-recovery-20260922` | clean; already absorbed into current `main` except stale runlog text |
| Google Drive UI evidence | `feat/google-drive-ui-iteration-20260904` | `961efc07` | `chore/google-drive-ui-evidence-recovery-20260922` | clean |
| AI auth runlog | `fix/management-developer-authorization-20260914` | `6c2e492b` | `chore/ai-auth-runlog-recovery-20260922` | clean |
| Calendar review evidence | `feat/google-calendar-review-20260914` | `a8582c2f` | `chore/calendar-review-evidence-recovery-20260922` | clean |
| Antigravity particles test | `chore/antigravity-test-20260918` | `48199ba7` | `chore/antigravity-particles-recovery-20260922` | clean |
| Launch-clean legacy work | `launch/canvas-map-implementation` | `f15ce510` | `chore/launch-clean-recovery-20260922` | one untracked tokenized media file remains |

## Important Hold

`/Users/calebhamernick/Development/coach-house-platform-launch-clean/src/components/public/legacy-home-sections-data.tsx` is still uncommitted and unchanged because gitleaks found six JWT-like URL tokens in it. Do not print, commit, push, or publish those token values. Preserve the file in place until the user chooses whether to scrub or replace the tokenized media URLs.

## What Was Preserved

| Checkpoint commit | Files | Primary buckets |
|---:|---:|---|
| `0a1895fc` | 621 | member/admin/coach, nonprofit docs, tests, visuals, app shell/dashboard, particles/objective, docs |
| `c855aea6` | 89 | fresh-main replay of Workspace particles/objective planner plus validation runlog |
| `508b8df0` | 47 | fresh-main replay of Google Calendar sync plus validation runlog |
| `3b91b2ad` | 446 | fresh-main public Documentation/Marketplace preservation snapshot; includes shared AppShell/mobile/public-profile closure and must be split before release |
| `fd5e5f77` | 46 | Workspace particles/objective planner, visual tests, docs, acceptance tests |
| `1713e8c3` | 95 | Google Calendar feature, API routes, tests, legal consent, migrations |
| `911b1d5a` | 9 | Drive privacy consent migration/tests/docs; current `main` already matches all non-runlog files |
| `961efc07` | 17 | Drive UI screenshot evidence only |
| `6c2e492b` | 1 | AI auth runlog only |
| `a8582c2f` | 2 | Calendar QA/runlog evidence only |
| `48199ba7` | 2 | particles context/panel experiment |
| `f15ce510` | 294 | old workspace/dashboard shell, Documents UI, account settings, public home/find, roadmap |

## Release Boundaries

- Keep public surfaces separate from internal/admin work: `src/app/(public)`, `src/components/public`, `src/features/nonprofit-documentation`, public Find/map, public profiles, visual baselines.
- Treat visual snapshot changes as evidence only until the related product scope is selected and reviewed.
- Treat root `0a1895fc` as a salvage source, not a branch to merge.
- Treat `launch-clean` as legacy reference material; it is broad and token-blocked.
- Calendar and provider work needs provider/config/live-verification boundaries before release claims.
- Workspace particles/objective work should resume independently from Calendar and public Marketplace work.

## Recommended Resume Order

1. Workspace particles/objective planner: resume from `feat/workspace-particles-objective-resume-20260922` at `c855aea6`; static, acceptance, build, RLS, focused tests, and Workspace particles/objective visuals passed. Resolve or separately baseline the unrelated Documents banner visual drift before declaring full visual green.
2. Google Calendar sync: resume from `feat/google-calendar-resume-20260922` at `508b8df0`; local code gates passed. Separate code readiness from OAuth/provider setup and live calendar verification before release.
3. Public Documentation/Marketplace: use `feat/public-docs-marketplace-resume-20260922` at `3b91b2ad` only as a preservation source. Split into separate public-docs, AppShell/mobile, and public-profile/marketplace-people lanes before any PR.
4. Member/admin/coach leftovers: compare against merged PR #242 first to avoid replaying shipped internal tooling.
5. Public Find/mobile map: isolate from Marketplace and nonprofit docs; do not blend raw candidate/resource-map work into public Find.
6. Resource-map acquisition scripts: isolate private acquisition tooling from public `/find`.
7. Launch-clean legacy: inspect only for ideas or components; do not merge wholesale.

## Closed / Absorbed Lanes

- Documents/Drive consent follow-up: compared `911b1d5a` against current `main`; every non-runlog file from the checkpoint is identical in the root checkout, including legal-consent copy/version files, migration `20260910120000_accept_drive_privacy_consent.sql`, RLS test harness updates, Drive consent SQL assertions, and acceptance tests. No replay worktree needed.

## Next Action

Create a clean isolated worktree from current `origin/main` for the first selected workstream, then cherry-pick or restore specific files from the matching recovery checkpoint. Keep one PR per workstream and require a public-boundary diff for any public surface.
