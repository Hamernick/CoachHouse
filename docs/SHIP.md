# SHIP

One release at a time. Read this after the current runlog and open-work index,
before choosing work. Phase 0 merged externally with unresolved release gates; this is an operator-run tool,
not a background service. Never treat a queued source reference as unfinished work.

Original plans: the restored directory supplied through `--plans-root`, otherwise
`~/Desktop/Coach House Codex Workstreams/` under the current user's home, as defined
by `shipping/plans.json`. Use the same selected root for reading and runner commands.
Read `WORKSTREAMS.md`, then the relevant numbered packet in full, including original
requests, decisions and continuation checkpoints. These are the files linked from
Apple Notes. If missing, restore the private backup identified in `shipping/plans.json`;
do not reconstruct or replace the plans.

Read the original packet and numbered stage before work: `ship.py plans` lists
them; `ship.py prompt --workstream ID --stage N` prints the full private originals.
See [original planning files](shipping/README.md#original-planning-files).

```sh
python3 docs/shipping/ship.py status
python3 docs/shipping/ship.py validate
```

Run from the recorded active worktree. Other worktrees may use this runner's
absolute path with their own cwd for inspection; mutations require the recorded
worktree. The canonical mutable record is always the absolute Git common
directory's `shipping/state.json`, shared by all worktrees of this repository.
`status` prints its resolved location. No environment override creates a second
state authority. Independent clones are separate operators: restore the receipt
and resolve the old claim before doing work; never operate two clones concurrently.

See [operator commands and recovery](shipping/README.md),
[reconciliation](shipping/reconciliation.md), and [review packet](shipping/review.md).
`shipping/queue.json` is a seed, not another live queue. Immutable exported receipts
are recovery snapshots. Latest active receipt is on `chore/ship-receipts-20261013`
until closure; locate it in `docs/shipping/receipts/` on that remote recovery branch.
The implementation PR uses `chore/ship-harness-20261013`; the receipt branch
is a derived recovery archive, never a second live state or implementation lane.

Refresh remote refs at startup, reconcile any active claim, and resume its exact
next action. Never pull/reset an unrelated checkout. Closed work remains closed.
After this tooling slice closes, verify the outside audit's trust/indexing findings
read-only, then obtain approval for the concrete website fix. Keep website-copy,
fiscal-policy, live migration and deployment decisions separate.
