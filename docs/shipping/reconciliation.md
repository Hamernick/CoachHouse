# Bootstrap reconciliation — 2026-10-13

Base: `fabee958969e538a07c9a478c72574a3eda7d79b` (`origin/main`, PR #290).
Root mixed checkout and all unrelated worktrees/servers preserved. The clean
FLIGHTPLAN lane remains backed up at `a3655a2c`; its dashboard is not a dependency.
FP-001/SAFE-001 are existing setup/recovery evidence, not a feature shipping queue.

- Main's open-work index explicitly closes internal MVP/onboarding/publication,
  AppShell/mobile, S02/public documentation, navigation, and coaching credits.
  Honor those user closures; neither imported sources nor old local root records
  reopen them. Closure does not certify historical failed quality checks.
- Public #289 is merged; fiscal activation, delivery checks and optional profile
  import remain separately gated in the current public checklist.
- Live GitHub open PRs at bootstrap: #229, #231, #235, #237, #238, #239, #240.
  Preserve their scopes; no bulk replay/merge. Historical index claims that #269,
  #276, #285 or #289 are still open must be reconciled before reuse.
- 176 original source IDs are registered as **unreconciled**, without private
  request text. They are not 176 queued implementation tasks. Only SHIP-000 and
  dependent read-only AUDIT-001 have defined release-slice scope/acceptance.
- Outside-audit website/copy implementation still requires a concrete decision.
  The audit-only boundary remains. Rejected BaaS/directory-farming/in-app ledger
  directions remain closed. Financial claims and Next.js version assertions are
  supplied claims, not adopted facts or upgrade instructions.

## Provider connection

GitHub resolves this public repository to `Hamernick/CoachHouse`. Live main
protection requires strict current-head `quality`, one approving review and
code-owner review, with stale approvals dismissed. Bootstrap reconciliation of
#290 correctly reports merged while quality failed and review is still required;
the runner does not reinterpret that historical merge as a passing release gate.

Production integration observed: `Production – coachhouse`, GitHub deployment
7027712180, source `fabee958969e538a07c9a478c72574a3eda7d79b`, successful integration
status. Existing local Vercel linkage identifies project `coachhouse` and intended
domain `coachhouse.app`; the secondary `coach-house-platform` integration is not
proof of the primary domain's state. Repository `vercel.json` enables main-only
Git deployment. Vercel direct project/alias reads with the existing CLI credential
returned HTTP 403. Actual alias/provider verification remains blocked; no auth,
project, domain, deployment, migration or application setting was changed.

See [connectivity receipt](receipts/bootstrap-connectivity.json). For application
slices, obtain provider access and verify project/domain/source SHA explicitly.
This tooling-only slice has no app behavior, schema, provider config or deployed
artifact to smoke-test. Proposed deployment/production N/A applies only to it;
merge and remote receipt recovery must still be verified before closure.

API reference: [Vercel REST API](https://vercel.com/docs/rest-api) and
[GitHub deployments](https://docs.github.com/en/rest/deployments/deployments).
