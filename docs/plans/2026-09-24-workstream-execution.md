# Workstream execution packets — 2026-09-24

Use [inventory](2026-09-24-workstream-inventory.md) and [open-work index](../agent/open-work-index.md). Planner owns scope and review; executor works one isolated lane at a time. Before any write, perform the `docs/agent/workflow-quality.md` branch checkpoint, inspect current `origin/main` and lane dirt, and name the focused checks. Preserve all existing worktrees, handoffs, and port 3000. Do not replay closed Documentation work.

## First executor packet: one candidate manifest only

The four isolated lanes have source/path ownership summarized in the inventory. The four unsplit lanes have only provisional prefix matches. On `chore/workstream-inventory-20260924`, select **one** unsplit lane and produce its exact path/hunk candidate manifest, source commit, current-main comparison, upstream/remote state, shared owner, and unresolved questions. Write only to this plan/inventory and append a session note to the current monthly runlog. Do not copy code, run tests, push, clean, or prune. Return the manifest for planner review. Stop if a source contains secrets or its ownership cannot be resolved by read-only comparison.

Suggested commands per source: `git log --oneline origin/main..<source>`, `git diff --name-status origin/main...<source>`, `git cherry origin/main <source>`, then `git diff origin/main <source> -- <specific-path>` for the few candidate paths. A triple-dot path list is a discovery aid; equivalent code may already be on main through a squash merge.

## Next code packets after manifest review

| Lane | Allowed source area | Acceptance / stop condition |
| --- | --- | --- |
| AppShell/mobile | `src/components/app-shell/**`, `src/features/mobile-navigation/**`, `tests/acceptance/mobile-navigation.test.ts` from `d1e4b1a1` | Review current-main shell, dashboard/public/mobile navigation, sidebar/right rail, and Workspace drawer behavior. Stop on overlap with Calendar AppShell components or unrelated public content. |
| Marketplace people | `src/features/public-profiles/**`, `src/lib/queries/public-people.ts`, the Marketplace people detail route, its acceptance test from `6b3be0b6` | Show list/detail integration, privacy and handle rules, empty/error states, browser evidence. Stop if closed Documentation content must change without a scoped integration decision. |
| Particles/Objectives — high priority | `src/features/workspace-particles/**`, `src/features/workspace-objective-planner/**`, related dashboard canvas/API/tests from `c855aea6` | First agree on product concept and UI flows. Validate drawer/tab/mobile and state/data behavior. Tests alone cannot clear the product gate; stop on unresolved design or Drive authorization boundary. |
| Calendar | Calendar/roadmap, Workspace Tools, its two AppShell components and scoped tests from `508b8df0` | Separate code validation from OAuth/provider setup and approved live flow. Stop at missing provider configuration or unapproved external mutation. |
| Public Find/map UI | Exact manifest from root recovery `0a1895fc`, launch reference `f15ce510`, and Find branches | Public route/browser behavior plus field-complete, verified/publishable data boundaries. Stop on synthetic/raw intake exposure or the legacy token-bearing file. |
| Resource acquisition | Private acquisition scripts from root recovery after exact comparison | Confirm tooling remains private; raw candidate queue never enters `/find`. Stop on token exposure or provider data ambiguity. |
| Org/Documents leftovers | Root and Documents branches after shipped-code comparison | Identify actual residuals beyond shipped Documents work. Stop if no residual remains or a replay would overwrite current Drive/Core Documents behavior. |
| Account/settings/profile | Root and profile/settings branches after current-main comparison | Isolate unshipped refinements; stop on auth/role or shared-shell ownership ambiguity. |

For a selected code lane, create a fresh isolated branch from current `origin/main`, replay only reviewed hunks, run named focused checks and the relevant guardrails, and review UI in browser when affected. Run `graphify update .` once after a completed code batch. Before a commit, scan staged content for secrets. Shipping waits for the current PR's required hosted `quality` gate, branch protection, and review; external provider, data, and deployment gates remain separate.
