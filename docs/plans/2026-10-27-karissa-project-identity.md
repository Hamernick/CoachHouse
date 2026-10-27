# Karissa project identity reconciliation — October 27, 2026

## Outcome and scope

User authorized reconciling imported Karissa assignments to the existing fiscal-sponsorship staff account. This bounded original01 access/identity continuation supports O039-01; the broader requirement remains In progress. The September 28 [tracker mapping](2026-09-28-joel-tracker-migration.md#identity-organization-and-existing-record-mapping) explicitly maps Karissa to that account.

The standalone Karissa filter entry was a project member label, not a staff login. Seven projects contained that imported label; five contained the staff email; one contained both. At 20:56 UTC, a guarded atomic production transaction normalized these 11 projects to the verified current profile name, Karissa Hamernick. Only member labels and the normal updated timestamp changed on the project rows; normal activity triggers remained enabled. Other members, including an unrelated duplicate label, were preserved.

Existing identity assignments were already correct: 56 organization coach assignments, 20 task assignees and three fiscal reviewers. All were independently compared before/after and remain byte-for-byte equivalent as JSON records. Three guided projects already reference the correct account UUID; their setup was preserved. Separate personal/test Auth accounts were not merged, deleted or reassigned. No role, privilege, ownership, project status, historical provenance, Google setting, schema or application code changed.

## Evidence and verification

- Verified exact Auth email/UUID, current profile name and coach grant. Confirmed that the canonical display name matches only one profile.
- Reviewed the source: project filters derive options from member-label strings; legacy detail members resolve those strings against real person options. Guided projects use saved UUIDs instead.
- Saved a private full-row snapshot and prepared an exact 11-ID correction. Preconditions checked complete project rows, identity, staff grant and all existing assignment rows; affected project rows were locked before mutation.
- Transaction checked the exact corrected labels, absence of old aliases and unchanged unrelated project fields/assignments before committing. Management API returned HTTP201.
- A separate read independently verified all 11 results and unchanged identity, staff grant, 56 organization assignments, 20 task assignments, three reviewer assignments and guided setup. No transaction retry was needed.
- Recovery evidence: `/private/tmp/coach-house-karissa-identity-evidence-20261027/` contains `before.json`, `repair.sql`, `expected.json`, `mutation-receipt.json` and `after.json`, outside Git with private permissions. Do not replay the repair; stale-state guards intentionally reject it. Any rollback requires comparing current rows to the saved after-state first.

## Limits and handoff

The production data correction is complete; refreshing Projects should reload the consolidated filter. Karissa's browser acceptance has not been observed. Legacy projects still use the existing name-based member projection, so a future profile rename can make labels stale again; durable project membership IDs would be a separate application change. This correction does not resolve broader file/fiscal authorization findings or verify deployment of the separate permissions fix in PR362.

Documentation lane: `fix/karissa-project-identity-20261027`, isolated from current main `1da38be94`; unrelated worktrees and shared SHIP40 preserved. No application tests are required for this operational-only correction; live identity, guarded mutation and independent readback are the relevant evidence. Documentation diff review, a zero-finding secret scan and normal Node22 pre-push passed (2.28 seconds). Caleb owns hosted review/merge and browser acceptance; no deployment is needed for the data correction.

Documentation handoff: open [PR363](https://github.com/Hamernick/CoachHouse/pull/363); initial receipt commit `0da5e259` independently matches the remote branch. Hosted checks have not been polled; the production data correction is already complete.

Graphify documentation maintenance completed: exact two changed allowlisted documents have current hashes and semantic caches; 22,819 nodes/64,969 edges. All prior IDs and unrelated/code nodes preserved; no new structural defects, two inherited self-loops unchanged. Receipt: ignored `graphify-out/.karissa-semantic-maintenance-receipt.json`.
