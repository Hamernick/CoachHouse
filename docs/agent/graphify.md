# Graphify Workflow

Use one repository-root graph so application, tests, scripts, and Supabase stay
connected. `.graphifyignore` removes generated, deprecated, binary, historical,
and vendor noise. Do not split the graph by `src/**` subdirectory.

## Installation and Upgrades

Qualified local release: **0.9.103** (November 6, 2026). Preserve the SQL extra
so Supabase migrations and RLS tests are represented:

```bash
uv tool install --upgrade 'graphifyy[sql]'
graphify install --platform agents
graphify install --platform agents --project
graphify --version
```

`uv tool upgrade graphifyy` also preserves the installed SQL extra. Refresh the
project skill in the worktree being used; it can shadow the global skill. Use
these skill-only installers, not `graphify codex install`, which also changes
agent configuration. Preserve local customizations before replacing a skill.

After a parser/package upgrade, back up the existing local graph and perform
one full-root `graphify update . --force` to establish the new parser baseline.
Inspect warnings, retained semantic nodes, changed-file hashes and edge
endpoints before accepting it. `--force` permits graph shrinkage; never use it
as a routine speed flag or to conceal unexplained missing nodes.

## First Build

Build the deterministic code layer, then generate its report without a
full-node HTML visualization:

```bash
graphify extract . --code-only --timing
graphify cluster-only . --no-viz
```

Code extraction is local and needs no provider calls. Do not run bare
`graphify extract .` for code maintenance: semantic extraction may select a
configured provider. Keep paid-provider authorization separate.

## Daily Use

Query before reading broad source trees. Prefer an exact symbol or narrowly
scoped question, then follow relationships or read the returned source:

```bash
graphify query "readWorkspaceAcceleratorBoardState" --budget 1500
graphify path "<concept-a>" "<concept-b>"
graphify explain "<concept>"
```

A truncated broad query is not exhaustive evidence. Narrow the seed/question;
do not increase output indefinitely. Graph relationships guide inspection,
not authorization decisions or proof that a test passed.

After a cohesive code slice, from the repository root run:

```bash
graphify update .
```

In 0.9.103 this command derives changed/deleted files from AST manifest hashes
and preserves the rest of the graph. TypeScript parser-cache misses for the
changed files are expected; they do not justify re-extracting the entire tree.
The local `/mcp.json` connection configuration is explicitly excluded: it has
no graph symbols and otherwise remains pending on every scan. Unchanged runs
should leave the graph untouched. Batch maintenance once after
relevant app checks; reuse any in-flight update. Keep clustering enabled for
the normal graph rather than switching between raw and clustered outputs.
Incremental parsing does not eliminate whole-graph reconciliation/clustering
cost; do not equate one changed file with an instant update.

If an ordinary warm update unexpectedly extracts the full corpus, inspect its
version, manifest and build configuration before repeating it. For manual
freshness checks use `detect_incremental(..., kind="ast")`; its default semantic
hashes do not measure code-layer freshness. Inspect `new_files`/`new_total`,
not `files` (the full detected corpus). Verify affected `.ts` **and** `.tsx`
paths, including renamed/deleted sources, rather than treating exit zero alone
as freshness evidence.

## Documentation Coverage

Code updates preserve existing semantic nodes; they do **not** refresh document
meaning. The documentation layer is partial. Read the canonical plan/runbook
when its semantic coverage or source hash is missing or stale.

For changed allowlisted documentation, use the checked skill's semantic update
workflow with the host assistant, preserving unrelated graph data and edge
direction. Scope extraction to affected documents; do not mark unprocessed
documents current or stamp semantic hashes as AST hashes. Recheck code freshness
separately if using a mixed code/document skill workflow. Do not refresh all
documentation after each checkpoint edit or use a configured paid backend
without authorization.

## Repository Policy

`graphify-out/` stays local and ignored. The full graph exceeds the repository's
tracked-file budget and would create large Git diffs after routine updates.
Do not install Graphify's shared Git hooks or a background watcher by default;
this repository uses many worktrees and explicit batched maintenance.

The local graph represents this dirty worktree. Hosted default-branch results
cannot replace it for unmerged work. Keep other worktrees, running app servers,
private files and provider settings unchanged during graph maintenance.

Reference: [official incremental-update documentation](https://docs.graphify.com/open-source/features/incremental-updates).
