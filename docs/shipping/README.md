# SHIP operator

Python 3.9+ standard library, Git, authenticated `gh`; macOS/Linux. No new packages,
model provider, dashboard or scheduled process. Adapted from FLIGHTPLAN's stable
IDs, per-checkpoint receipts, separate release evidence and preservation rules;
its existing recovery ledger stays intact on `chore/flightplan-20261012`.

## Original planning files

The existing Desktop packets are authoritative execution inputs. `plans.json`
links all ten packets and their 59 numbered stages; `intake.json` maps each of
176 requirement IDs to its exact original packet. These are references, not a
replacement plan or an assertion that the requirements are unfinished.

Before selecting or implementing a slice, read its full original prompt:

```sh
python3 docs/shipping/ship.py plans
python3 docs/shipping/ship.py prompt --workstream 04 --stage 1
python3 docs/shipping/ship.py prompt --slice AUDIT-001
```

The prompt prints the original index, audit boundaries and selected packet(s) in
full, including requests, decisions and continuation checkpoints. Keep this output
private. Selected stages narrow work; the slice's scope/exclusions and later user
decisions still control authorization. Audit references never authorize website edits.

Every new slice supplies `plan_refs`, for example
`[{"workstream":"04","stages":[1]}]`. Include each source requirement's primary
packet; add other packets/stages for genuine shared scope. `claim` rejects missing
files, invalid stages and mismatched requirement mappings, then records filenames,
sections, stage/line numbers and SHA256 hashes without copying private text.
Checkpoints reject source drift at the same code head. The tool establishes source
identity, not proof that an operator understood the prompt; reading remains mandatory.

Originals default to `~/Desktop/Coach House Codex Workstreams`. `--plans-root`
can locate a restored private folder; it never relocates shared release state.
The private recovery snapshot is identified in `plans.json`. Apple Notes links
continue to open the same originals; there is no automatic Notes synchronization.

Existing queues are never overwritten from the seed. An operator can attach
references to a **queued** legacy slice with `bind-plan --slice ID --owner CHAT_ID
--revision REV --head HEAD --receipt FILE`; the receipt contains only `plan_refs`.
Without an active claim, use the current working HEAD. With an active claim, only
its running owner in the recorded worktree/branch may bind, at the recorded HEAD.
This validates the original files while preserving active/released evidence and
queue status. Active/released slices cannot be rebound retroactively. Historical
snapshots remain readable; all future claims require the original plan references.

## Commands

Run `python3 docs/shipping/ship.py --help`. After the active slice closes, use
`enqueue --owner CHAT_ID --revision REV --head HEAD --receipt FILE` with a reviewed
`slice` object matching the seed schema to add the next sanitized scope. Status/inspect/validate/reconcile never
merge, deploy or modify provider settings. Reconcile reads GitHub and records the
observation locally. All writes take a kernel-exclusive lock and atomic rename.
State updates require the expected state revision and recorded head. Competing
operators fail immediately; there is no timed ownership expiry.

```sh
python3 docs/shipping/ship.py init
python3 docs/shipping/ship.py status
python3 docs/shipping/ship.py claim --slice SHIP-000 --owner CHAT_ID --pid OWNER_PID --revision 0 --head HEAD_SHA
python3 docs/shipping/ship.py checkpoint --owner CHAT_ID --revision REV --head OLD_HEAD --receipt /private/reviewed.json --to locally_validated
python3 docs/shipping/ship.py checkpoint --owner CHAT_ID --revision REV --head HEAD_SHA --receipt /private/reviewed.json --to awaiting_review
python3 docs/shipping/ship.py reconcile --owner CHAT_ID --revision REV --head HEAD_SHA --pr NUMBER
python3 docs/shipping/ship.py export
python3 docs/shipping/ship.py validate
```

Use the live operator's persistent process PID, not a one-shot CLI process.
Claims record host/PID/process start identity and UTC time. Same owner may continue
while that process lives. Resume also handles a crash after commit but before
checkpoint: it records the new head and invalidates previous approvals/tests. `resume` requires an evidence receipt with
`owner_evidence` and `next_action`; it checks the original process has stopped or
its PID has been reused before recording the new owner/PID. A foreign-host claim
fails closed: resolve it on the original host. No automatic takeover, cleanup,
branch deletion or server termination. A same-host reboot normally changes start
identity. Never unlink `write.lock`: kernel locks release on process exit.

New claims require a clean isolated branch containing freshly fetched main.
After committing new code, checkpoint with the previous recorded head: tests,
approval and GitHub evidence are invalidated and status returns to in progress.
Record fresh tests for the new head. Once merged, deployed or production-verified,
the recorded head stays immutable even if the slice later becomes blocked. A fetched
external merge also freezes the head before normal release gates have passed. This intentionally also invalidates approval
on documentation commits; finish reviewable changes before requesting approval.

## Evidence and transitions

`checkpoint --to STATE --receipt FILE` merges a reviewed sanitized JSON receipt.
The field contract and cumulative gates are in `gates.py`; tests include examples.
Stages cannot be skipped. `blocked` requires `blocker` and `next_action` and retains
the last stage. It holds the exclusive slice until resumed or closed.

Required evidence includes current-head tests and UI review (reasoned N/A for
tooling), concrete `review_packet`, exact-head/scope human approval with actor,
time, source reference and no unresolved conditions. UX approval is separate
from GitHub review. Do not invent either. `github` and `merge` evidence can only
come from live `reconcile --pr`. Protected transitions require fresh `--pr` reads.
If fresh evidence invalidates an already reached gate, reconciliation saves the
failed observation and blocks the slice instead of retaining stale success.
Pre-merge protection must have been observed CLEAN with required checks and review;
a later merged state cannot retroactively prove skipped protection passed.

Application deployment evidence needs the actual intended project/domain/ID,
matching merge SHA, provider verification, observation time and reference. GitHub
integration labels alone are observations, not deployment proof. Production smoke
checks, provider/migration work and rollback are separate records. Tooling-only
N/A needs an explicit reason. `closeout` takes the same owner/revision/head/receipt
arguments plus `--pr`; it requires remote recovery, mirror synchronization and
explicit safe retirement or preservation. No filesystem cleanup is performed.

The tool validates evidence structure and provenance of fetched GitHub data;
it cannot independently authenticate a human's pasted approval or a manually
supplied smoke-test receipt. Those remain attributed operator attestations.
GitHub protection remains the final independent merge enforcement.

## Checkpoints, privacy and recovery

Review receipt text before export; public snapshots must contain no credentials,
account details, raw intake or private test data. Source intake retains IDs,
line locations and file hashes only. Read the private original wording before
selecting a slice; reconcile existing releases before turning intake into work.
Do not change source checkbox states merely because a test passed.

`export` copies immutable state and its hash-linked receipt payloads to
`docs/shipping/receipts/`. Commit snapshots on the dedicated `chore/ship-receipts-20261013` recovery
branch, run normal pre-push checks, push that branch,
and verify `git ls-remote` matches its snapshot commit. Keep the implementation
branch unchanged so receipt archival cannot invalidate exact-head approval.
An ephemeral clean worktree may be used to export/archive; it does not claim
or implement another release slice. Retire only that clean pushed archive checkout. Record that remote SHA in the
next checkpoint. A snapshot's own containing commit is established by Git history;
never put a guessed self-referential commit SHA into the file. State after that
export is local-only until another export/push. Ignored private state needs its
own private backup; Git does not protect it.

On restart in this repository, use status and resume; never reinitialize. On a
fresh recovery clone, inspect the newest `NNNNNN-HASH.json` snapshot, then:

```sh
python3 docs/shipping/ship.py init --receipt docs/shipping/receipts/NNNNNN-HASH.json
python3 docs/shipping/ship.py validate
```

Restore refuses to overwrite existing canonical state. It verifies the snapshot
filename against its revision and full-state digest, then validates every child
receipt before writing. Receipt names must be generated basenames directly in
the source/destination directory; absolute paths, parent paths and symlinks are
rejected for restore, export and validation. Checksums detect corruption, not
malicious authors who can recompute them. Old-host owner and worktree identity still need reconciliation; do not
silently rewrite them. Cross-machine relocation is deliberately a manual recovery
boundary, not automatic takeover. Orphaned `.pending-*` files after a hard crash
are non-authoritative; the prior state or fully replaced state remains readable.

At checkpoints update the repository runlog/open-work entry, export/push/verify,
then deliberately update the private Desktop SHIP checkpoint with the canonical
path, latest remote receipt and next action. Apple Notes links and checkboxes are
preserved; no Notes automation is installed. Do not claim continuous synchronization.

## Validation

```sh
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s docs/shipping -p 'test_*.py' -v
```

Simulations never mutate production. Hosted repository quality and required
code-owner review remain mandatory. This harness does not bypass failing visual
CI, manufacture approvals or turn a successful merge into production verification.
