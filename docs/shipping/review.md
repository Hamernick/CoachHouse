# SHIP Phase 0 review

Scope: shared operator runner and startup discovery; no website/app/provider changes.

- One Git-common-directory state, exclusive claim, revision/head checks and atomic
  persistence. Crashed process recovery requires evidence, never timed expiry.
- Stable private-source IDs/hashes, sanitized immutable receipts and explicit
  remote export/recovery; existing user closures retained.
- Sequential human approval, current-head GitHub quality/review/protection,
  merge, provider/source alignment, scoped production and safe-closeout gates.
- No background watcher, dashboard, new service, automatic merge or deployment.

Review the PR's exact head and the command/evidence contract in README.md.
Decision requested at handoff: approve this tooling scope/revision for release.
Required GitHub code-owner approval is a separate gate. No approval is recorded yet.

Validation: 27 Python tests covering state gates, concurrent claims, CLI ownership,
head-change invalidation and export/restore; live read-only GitHub protection/PR/deployment
reconciliation, receipt restoration and normal repository pre-push checks. Graphify AST update completed (20,909 nodes); diff hygiene, staged secret scan
and normal Node 22 pre-push checks pass. Hosted current-head quality remains required. Vercel credential receives HTTP 403; direct
provider verification is unavailable. Deployment/production N/A is proposed for
this tooling-only change, not for future app releases.

Limitations: operator-supplied human/provider/smoke evidence requires honest source
attribution; no cryptographic human approval. New-machine claim relocation is
manual and blocked by default. No automatic Notes sync. Exported receipts protect
only the recorded checkpoint, and must be committed/pushed to become recoverable.

Automated review follow-up: preserve the effective released stage while blocked;
restrict all receipt IO to safe direct-child names; validate the full snapshot
checksum before restore. Regression tests reproduced the original failures and
now reject traversal, symlink and stale-checksum inputs without altering victims
or canonical state. Existing export/restore and pre-release head changes pass.
