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

## Follow-up: remaining standalone labels

This read-only audit predates the authorized reassignment below; Franklin is no longer unlinked on active work.

Read-only live audit covered all139 project records, including51 standard projects. Standard projects have eight distinct member labels. Joel, Paula and the corrected Karissa name uniquely match their staff profiles. Caleb has multiple real personal/test profiles with the same name, but none of those alternate accounts belongs to the organizations containing his standard projects; the current scoped staff lookup resolves to the developer account. Guided Caleb projects and imported collaborator UUIDs also identify the developer account.

- Franklin is the remaining unresolved imported identity, on Community, Community Engagement, and 19 MIGMIR Clients enrolled in I2I Annually. No Auth email/profile-name match or staff grant was found. The original tracker plan explicitly preserves him as unlinked rather than assigning his work to someone else; his intended account must be confirmed before a correction.
- Coach House on Public Map Claims is a generic system-created label, explicitly seeded by migration20260821103000, not a person/account.
- Platform User Feedback & Support Loop contains Caleb twice because he appears as owner and collaborator; both labels represent the same developer identity in this scope, not another account.
- Casey Board and Jordan Staff are actual test accounts on Southside Community Table, not imported missing admins.
- Organization cards additionally contain19 distinct labels without exact profile-name/email matches across20 cards, including You on seven. These cards use organization-member/contact presentation and must not be blanket-reassigned to platform staff. Three additional organization-card email labels match real accounts whose display names have since changed. This scan establishes display/account mismatches, not a finding that those organizations lack their assigned coaches.

No production changes were made during this follow-up. Durable project membership IDs remain the structural remedy for name collisions and profile-renaming drift; this audit does not implement that separate change.

## Authorized reassignment — 21:11 UTC

User explicitly directed moving Franklin work to the existing fiscal staff account temporarily, removing Caleb's duplicate label and assigning Public Map Claims to Caleb's real developer account. This supersedes the earlier import-plan instruction to leave Franklin unlinked; no new account or privilege was needed.

One guarded production transaction updated five project rows: Franklin's three project member labels to Karissa Hamernick, Public Map Claims to Caleb Hamernick, and Platform User Feedback & Support Loop to one Caleb label plus Karissa. Exact profile identities and existing staff grants were verified first.

The follow-up task scan found24 Franklin owner/proposed-owner source records:22 unfinished tasks without native assignees and two completed historical tasks. All22 unfinished tasks now have a native assignment to the fiscal staff UUID, attributed to the requesting Caleb developer account. Task rows, source metadata and two completed tasks were preserved; native assignments take precedence over historical proposals. Existing tasks assigned to Joel, Paula or Caleb were untouched. Public Map Claims' existing task already belonged to the correct Caleb account.

Saved full before-state and prepared exact guarded SQL, locked affected project/task rows and checked all preconditions before changes. Transaction readback enforced five exact label updates,22 exact new assignees, all152 prior assignment rows unchanged, all24 task rows unchanged and all unrelated project fields preserved except the usual updated timestamp. Normal activity/assignment-notification triggers remained enabled. Management API returned HTTP201; no retry was needed.

Independent readback confirmed every expected change. The fiscal account now has42 task assignments (20 existing +22 new); its56 organization assignments and three fiscal-reviewer assignments are unchanged. Both staff identities/grants and all original import provenance remain unchanged. Backup, prepared SQL and exact before/after/expected/receipt files are private at `/private/tmp/coach-house-franklin-transfer-evidence-20261027/`; do not replay the completed transaction. A reversal requires a new guarded comparison with the saved after-state.

Live operation complete. Refresh Projects and Tasks to reload results; browser acceptance remains unobserved. No application/schema/provider changes or deployment. Only this excluded historical checkpoint and monthly runlog changed, so the already-verified allowlisted Graphify/code corpus is unchanged.


## October29 — all-organization coach access in PR363

User requested that the exact fiscal staff, Joel and Paula accounts see/access every organization in `/organizations`, including those assigned to other coaches. User explicitly requested extending unmerged PR363 to avoid another production deployment. Same owned worktree/branch; merged main `c052d10a` locally, retaining both sets of checkpoint/index/runlog evidence. Root dirt, unrelated lanes and SHIP40 remain preserved.

Verified live identities are coaches with existing support grants. Fiscal staff lacked the narrower unassigned-organizations flag; Joel and Paula already had it. That flag intentionally excludes organizations assigned only to another coach, so enabling it alone cannot satisfy this request. Global assigned-only mode and assignments remain unchanged.

Added default-false `can_access_all_organizations` to the existing staff table. The shared server scope recognizes only an explicit current-account grant; directory defaults to All for that grant, and project asset access honors the same capability. Other coach restrictions, fiscal-only reviewer boundaries and developer capabilities remain separate. Explicitly selected URL/saved filters remain user choices. Migration20261029030000 and the three exact account grants are applied/verified; application behavior requires the PR363 deployment.

Verification so far: 71 focused cases across coach scope/filtering, coach options, project actions, People read safety and asset folders pass, including cross-coach access, new organizations, ordinary restrictions and lookup failure denial. Full TypeScript, scoped ESLint, boundaries and structure checks pass. Graphify refreshed once after the cohesive code slice, then bounded two-document semantic maintenance completed:22,852 nodes/65,092 edges/1,244 communities, all unrelated AST/semantic nodes preserved, zero new structural defects (two inherited self-loops unchanged). Receipt:`graphify-out/.all-org-semantic-maintenance-receipt.json`. Staged secret scan and diff hygiene pass; normal prepush runs on the single combined push with receipt `/private/tmp/coach-house-all-org-push.log`. Authenticated production UI acceptance remains pending; no separate merge/deployment will be performed.


Production operation at 2026-10-29 15:00 UTC: exact Auth UUID/email/profile email and coach roles matched for all three targets; captured complete staff,170 assignment and global-scope rows privately. One guarded transaction applied only the default-false column migration and three grants, checked unchanged assignments/global scope/unrelated staff fields, and recorded the exact migration SQL. Independent readback verified the three true flags, all170 assignments unchanged, other staff and roles unchanged, existing RLS policies preserved, and exact ledger SQL. Separate authenticated read-only transactions for each identity confirm the grant is readable, existing support access is true, and developer access remains false. There are88 organization records; the granted all-scope also includes future organizations.

Private recovery evidence: `/private/tmp/coach-house-all-org-access-20261029/{before.json,operation.sql,applied.json,after.json,verified.json,authenticated-readback.json}`. Do not replay the completed operation. Roll back the capability only by verifying the same current identities/flags, then setting these three flags false; preserve assignments, roles, the narrower unassigned flag and all customer records. Leave the additive column available while this app revision is deployed.

User requested a single combined deployment: all implementation/documentation changes will be pushed together to existing PR363; no new PR, production merge/deployment or hosted-CI polling. Application live acceptance remains open. Local evidence: `/private/tmp/coach-house-all-org-{tests,types,lint,graph}.log`.

Final read-only application proof: bundled the actual new `loadOrganizationCoachActorScope` and `filterByOrganizationCoachScope` code and ran it against production through the existing server client. Each of the three exact accounts resolved explicit all-scope and retained all88 current organization IDs. This validates the new server code plus live grants; it is not a claim that this revision is already deployed.
