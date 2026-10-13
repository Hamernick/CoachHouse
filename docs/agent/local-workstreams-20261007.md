# Local workstream handoff — 2026-10-07

## Front page / map UI — this chat

- URL: http://localhost:3000
- Worktree: `/Users/calebhamernick/Development/coach-house-platform-frontpage-20261007`
- Branch: `feat/frontpage-20261007`
- Base: `072b34d71c5a38ab611e0482bb5d8188e3a1a8b3`, freshly fetched main. GitHub production deployment `6915130889` reports success for that SHA.
- Overlay: all 128 tracked/untracked changed files from the original rapid UI checkout, three-way integrated against this base. Preserves the screen-contained map, surrounding glass, stable tabs, search category labels, hidden category pills and keyboard-only focus indicator. Shipped national nonprofit search/category and Accelerator/navigation changes remain included.
- Local edits are uncommitted. The branch name alone therefore does NOT yet transfer them to another worktree. No commit, push, deployment or provider mutation was made during setup.
- Separate dependencies installed from the merged frozen lockfile, including the shipped Radix patch and local Lenis dependency. `.next` was absent at clean start. Environment symlinks reuse the canonical local environment; secret contents were never printed.

Start here, with Node 22 on PATH:

```sh
cd /Users/calebhamernick/Development/coach-house-platform-frontpage-20261007
pnpm dev --hostname 127.0.0.1 --port 3000
```

Do not start a second server if 3000 is already listening. Inspect the listener's working directory first. Stop only this checkout's server before running `pnpm clean:next`; never clear another stream's build cache.

## Other streams

- Original rapid worktree on `feat/rapid-iteration-20261005`: preserved unchanged as the prior front-page source; its old server is stopped. Continue new front-page edits in the new front-page checkout on port 3000. Port 3001 is reserved for the other chat and is not started by this chat.
- Category-filter checkout, port 3107: preserved unchanged.
- ChatGPT integration worktree on `feat/chatgpt-integration-20261007`: separate lane, preserved unchanged.
- Accelerator work belongs to its separate chat/lane; shipped Accelerator changes are already in this checkout's main base. No unshipped Accelerator branch was replayed.

## Sharing updates reliably

1. Give every chat one explicit worktree, branch and port. Different ports in the same worktree still share files and `.next`, so they do not isolate work.
2. Before starting or resuming a stream, inspect status/listener ownership, fetch `origin main`, then merge current main into that stream after preserving its local edits in a reviewed checkpoint commit. Resolve conflicts in that stream and run focused checks. Do not reset or blindly overwrite its files.
3. To share unshipped work, create a scoped checkpoint commit in the source stream and cherry-pick its exact SHA into the receiving stream. For a broad shared foundation, merge a reviewed integration branch. Uncommitted edits do not move with Git fetch/merge.
4. After merging/cherry-picking, install dependencies if the lockfile changed and restart only that stream's server. Clear `.next` when a restart or dependency/branch change leaves stale output; routine source edits use HMR.
5. A browser refresh/cache clear changes neither branch history nor source files. Use a hard refresh once when moving from an old server on the same port.

Suggested instruction for another chat:

> Work only in your assigned worktree and port. Preserve current local edits, fetch latest origin/main, and integrate it without touching other checkouts or servers. For front-page changes, coordinate a scoped checkpoint commit from feat/frontpage-20261007; those edits are currently uncommitted. Report the resulting base/SHA and verify your own localhost.

## Local data status

The missing nonprofit search function is repaired and live-verified after conditional user approval and security/compatibility screening. Text search works on localhost:3000 and production. Category assignments are not yet published, so nonprofit category searches return empty; the separate data publication lane owns that work. See [repair evidence](../operations/nonprofit-search-repair-20261007.md). The original environment still references a missing curated resource preview file; no raw data was substituted.
