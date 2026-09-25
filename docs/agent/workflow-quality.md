# Workflow And Quality Contract

## Ground Rules

- `AGENTS.md` + `docs/agent/**` are the active repository contract.
- For deeper implementation details, cross-reference `/docs`.
- Keep changes small and deterministic.

## New Chat Worktree Checkpoint

On the first turn of every new chat, before changing files:

1. Complete the reading steps in the [canonical startup sequence](../RUNLOG.md#agent-protocol), reusing any already-read context. Then inspect `git branch --show-current`, `git status --short --branch`, `git branch -vv`, and `git worktree list`.
2. Display a concise startup report with the current branch and upstream, clean/dirty state, staged/unstaged/untracked summary, relevant open branches or worktrees, overlap with the requested files, and any known commit, push, PR, or deployment status. Summarize; do not dump the full worktree.
3. If the user's prompt has not already chosen a strategy, recommend the safest option and ask whether to continue the current branch, use a named existing branch/worktree, or create a clean isolated `feat/*`, `fix/*`, or `chore/*` branch/worktree from current `origin/main`.
4. Once the user has chosen a strategy, including in the task prompt, proceed without asking again. Otherwise, do not create or switch branches, move existing changes, or write task files until the user chooses. Read-only inspection may continue.
5. Preserve dirty worktrees. Prefer an isolated worktree when the requested change must later ship independently or overlaps unrelated staged, unstaged, or untracked work.

## Agent Workflow

1. Plan: list files to touch and propose diffs.
2. Implement: write code/migrations/docs in the correct directories.
3. Validate locally with checks covering the changed behavior; require complete hosted CI before merge.
4. Deliver: include screenshots (light/dark/mobile) and state-coverage notes in PRs when UI changes.
5. Log: append a concise entry to the current monthly log linked from `docs/RUNLOG.md` for every ad-hoc/Codex session:
   what changed, what worked, what did not, and where to continue.

## Required CI Merge Gates

- `pnpm lint`
- `pnpm check:npm-supply-chain`
- `pnpm check:large-files`
- `pnpm check:structure`
- `pnpm check:routes`
- `pnpm check:features`
- `pnpm check:feature-scaffold`
- `pnpm check:thresholds`
- `pnpm check:boundaries`
- `pnpm check:deprecated-imports`
- `pnpm check:workspace-storage`
- `pnpm check:interaction-locks`
- `pnpm check:react-grab`
- `pnpm check:raw-buttons`
- `pnpm check:workspace-surfaces`
- `pnpm test:snapshots`
- `pnpm test:visual`
- `pnpm test:acceptance`
- `pnpm test:rls`
- `pnpm build`
- `pnpm check:perf`

## Testing And QA

- Test framework: Vitest (acceptance + snapshot suites).
- After migration/policy edits, run RLS tests.
- Update snapshots via `pnpm snapshots:update` when intended.
- Before testing, name the selected checks and the behavior each verifies. Do not
  expand validation without identifying a concrete uncovered risk.
- Use this local validation guide; the required CI merge gates above remain in force:

  | Change | Required local evidence |
  | --- | --- |
  | Live assignment/data correction without code changes | Verify identities, authorization, intended mutation, and saved result. |
  | Documentation only | Diff/format review and automatic pre-push checks. |
  | Application logic | Named tests covering changed behavior. |
  | Authorization or RLS | Relevant access tests; RLS tests for migration/policy changes. |
  | UI behavior or appearance | Relevant tests and a focused browser check of the affected surface. |
  | Quality-gate scripts | `quality-gate-runner.test.ts`, `prepush-lint-optimization.test.ts`, and `large-file-guard.test.ts`. |

- Reuse passing results while their relevant code, dependencies, configuration,
  and environment remain unchanged.
- When an unrelated check fails, record the failure and leave the merge blocked.
  Do not investigate unrelated features or update visual baselines within the
  current task.
- A focused local pass means locally validated, not release-ready.
- Local `check:quality` and `check:prepush` write stage timings to ignored
  `test-results/quality-gate/*.json` artifacts. Acceptance inventory is included
  only when the selected profile runs acceptance tests.
- Acceptance tests are classified by the checked
  `tests/acceptance/projects.json` manifest. Every test file must appear exactly
  once across `behavior`, `contract`, `cli`, and `integration`; manifest drift
  fails before Vitest starts.
- Use `pnpm test:acceptance:<project>` for focused development feedback. These
  commands do not replace the complete `pnpm test:acceptance` merge gate.
- Run `pnpm test:acceptance:manifest:update` after adding or changing an
  acceptance file, then review its project assignment. The focused source-only
  `contract` command avoids the application/server mock setup; the required full
  union retains its proven single-project scheduler and setup.
- Add targeted edge cases for touched behavior.
- Visual baselines:
  - Run visual comparisons and baseline updates on Ubuntu 24.04 x64 with the
    repository's locked Playwright version. The visual config fails early on
    unsupported environments; macOS browser captures are for UI review.
  - Review expected, actual, and diff images before replacing baselines. Use
    `pnpm exec playwright test --config=playwright.visual.config.ts
    <affected-spec> --update-snapshots` only for the affected spec in the
    supported environment. Normal runs do not create missing baselines.
  - Keep screenshot thresholds unchanged when correcting an environment
    mismatch. Review baseline changes when upgrading the runner or browser.

## File And Module Layout

- `src/app/(public|auth|dashboard)/**`
- `src/app/admin/**`
- `src/app/billing/**`
- `src/components/**`
- `src/lib/**`
- `src/hooks/**`
- `supabase/**` (schema, policies, tests)
- `public/**`
- `docs/**`

## CI/CD And Environment

- Single environment: `prod` (Supabase + Stripe test/live modes).
- Migrations must be versioned and reversible.
- `pnpm check:quality` remains available for complete local diagnosis. Run it
  only when explicitly requested or needed to diagnose a specific CI failure.
- GitHub Actions runs the same stage manifest in parallel static, acceptance,
  RLS, build, and visual lanes; the aggregate `quality` job must require all
  five results.
- CI should install Playwright Chromium only in the visual lane and enforce
  visual regression checks.
- Branch protection should require the aggregate `quality` job before merge.
- Enable CODEOWNERS review enforcement for protected branches.
- Feature flags are required for risky rollouts.

## Git And PR Workflow

- Branch format: `feat/<slug>`, `fix/<slug>`, or `chore/<slug>`.
- Commit messages use present tense.
- PR title format: `[STEP SNN] <title>`.
- Include checklist, linked issue, UI artifacts, and reproducibility notes.

## Build And Dev Commands

- Install: `pnpm install`
- Setup hooks (once): `pnpm setup:hooks`
- Dev: `pnpm dev` (`http://localhost:3000`)
- Build/start: `pnpm build` then `pnpm start`
- Utilities:
  - `pnpm check:structure`
  - `pnpm check:routes`
  - `pnpm check:features`
  - `pnpm check:feature-scaffold`
  - `pnpm check:thresholds`
  - `pnpm check:boundaries`
  - `pnpm check:workspace-storage`
  - `pnpm check:interaction-locks`
  - `pnpm check:react-grab`
  - `pnpm check:raw-buttons`
  - `pnpm check:workspace-surfaces`
  - `pnpm check:prepush`
  - `pnpm check:acceptance-projects`
  - `pnpm test:acceptance`
  - `pnpm test:acceptance:behavior`
  - `pnpm test:acceptance:contract`
  - `pnpm test:acceptance:cli`
  - `pnpm test:acceptance:integration`
  - `pnpm test:acceptance:manifest:update`
  - `pnpm test:visual`
  - `pnpm test:visual:update`
  - `pnpm check:perf`
  - `pnpm check:quality`
  - `pnpm check:quality:static`
  - `pnpm check:quality:acceptance`
  - `pnpm check:quality:rls`
  - `pnpm check:quality:build`
  - `pnpm check:quality:visual`
  - `pnpm scaffold:feature <feature-name>`
  - `pnpm db:push`
  - `pnpm create:admin`
  - `pnpm seed:validate` (dry-run fixture validation for full-account seed)
  - `pnpm verify:settings`

## Agent Tooling Notes

- `mcp.json` provisions filesystem/shell/ripgrep/git MCP servers via `npx`.
- Install `rg` locally so ripgrep-backed search works.
- Approve MCP servers in your client before long runs.
