# Internal tooling release candidate — September 20, 2026

User approval: isolated release branch/PR, controlled live acceptance tests with cleanup, and shared release if ready. Frank's intended email is the email supplied privately by the user; no account exists yet. Invitation authorization was requested separately because it sends email.

## Candidate

- Branch: feat/team-internal-tooling-release-20260920.
- Worktree: /Users/calebhamernick/Development/coach-house-platform-team-release-20260920.
- Parent local integration baseline: b476ada1. Production main d88a0943 is merged into this isolated candidate; the original dirty checkout and its localhost server are preserved.
- The local baseline was 138 commits ahead and three commits behind main. This candidate carries that existing integration dependency; do not describe it as an isolated small patch against production.
- Selected current changes: internal Organizations/Projects/Tasks, Coach Dashboard, staff scope, financial controls, guided setup/shared options, document editing/activity, navigation and necessary shared-component/profile/Drive dependencies. Unrelated Particles, objective planner and public Marketplace/design edits were excluded. Full-root prior test results do not certify this narrower candidate.

## Live blocker found and repaired

The document activity migration replaced the event check constraint and omitted the existing `deleted` type. All live permission assertions passed, but deleting fixture projects/users failed. Corrected the unreleased source migration and added forward repair 20260920214000_restore_deleted_activity_event.sql. The repair only expands allowed event types, preserves rows, and is recorded in live migration history. Its isolated regression passed before application.

First live test run: assertions passed; cleanup failed. Eight exact newly created fixture IDs were tracked and removed. Removal required deleting project/task rows before their organization, then dependent coach users. The existing organization cascade trigger can otherwise try to record activity after its parent organization is gone; direct organization deletion remains an identified limitation, outside the team project/task flow.

Second live run: RLS tests passed including normal cleanup. A fresh auth list confirmed no new test accounts remained. No original fixture account or real organization was deleted.

## Gates and release boundary

The candidate's final canonical Node 22 `PLAYWRIGHT_PORT=3003 pnpm check:quality` passes all stages (2,719 acceptance tests, 156 visual tests, live/isolated RLS, build and performance). No production deployment is approved as ready until the candidate passes this gate, hosted checks, and shared authenticated route/persistence verification. Current local owner workspace on port 3000 is untouched.

Pending: candidate gate, immutable commit/PR, hosted preview, multiple-role live create/assign/update/complete/reload, shared URL verification, and Frank onboarding. Do not reset a teammate's password or impersonate their existing session. Use disposable acceptance identities and clean them up by exact ID.

## Verified release preparation

- All 218 candidate migration versions exist in live migration history (read-only comparison).
- Live guided-project/shared-option canary: 19 assertions passed, including retry idempotency, assignment persistence, completion, fresh second-account reads, outsider denial, shared rename/color/delete, stale-edit rejection and persisted activity. All exact canary fixtures were removed. This does not replace authenticated coach browser verification.
- Standardized local/CI/deployment runtime on Node 22. The old local Node 20.12 runtime lacked the native WebSocket required by the installed Supabase client. No package upgrades. Candidate dependencies are installed independently; original localhost remains untouched.
- Included the existing narrowly scoped management authorization fix from PR #240: management/AI APIs require current developer staff authority, fail closed, and no longer accept a legacy admin profile after coach reassignment. Its matching regression suite is included.
- Production branch protection requires aggregate quality plus one code-owner review. No bypass requested or performed.
- Candidate repository is public; personal onboarding email is intentionally omitted from release documentation.

## Authenticated release rehearsal

On isolated production-mode port 3004, a disposable assigned coach successfully signed in, saw only its assigned organization/project/task, completed a task through the UI and retained completion after reload. The timeline displays the saved September 21–25 task interval. The coach edited the fixture mission document, reloaded and read the saved text; the Activity tab displayed that document event and task transition.

Authenticated file-route canary passed upload, fresh listing, signed download/content, trash, restore and permanent removal; no fixture file or storage object remains. Temporary browser identities remain tracked only until hosted verification completes.

Hosted configuration inspection found Drive and Calendar credentials scoped only to Production. Preserve those provider settings; new OAuth connections are outside preview certification. Standard Vercel protection can be retained while providing a shareable team preview link. Production requires aggregate quality and code-owner review.

### 2026-09-20 19:02 EDT — Production candidate green; required review blocks release
- PR241 is ready for review at b7c9a0c35b754a2f591594806250d03c9b20ad57. CI35542896506 attempt2 aggregate quality passes: static, acceptance, RLS, build and visual. All156 visual cases pass (154 first attempt, two retries); one onboarding acceptance timeout passes on unchanged-code rerun. No assertions/timeouts weakened. Full local quality passed earlier; final changes after app verification are test references and docs only.
- Vercel coachhouse Preview J8Ro7xeffrsRnA7txqKRp6P9eEUo is Ready; this is verification evidence, not the requested production delivery. Hosted coach task/document save/reload and assigned scope pass. All tracked test identities/data cleaned and independently verified.
- Production main remains d88a09431d474c8b4b13eeb102a63fba209546f9. GitHub reports BLOCKED / REVIEW_REQUIRED; code-owner approval is mandatory and absent. Repository auto-merge is disabled. No bypass, protection changes, production merge/deploy, invitation email or share-link replacement performed.
- User will send Frank the signup link; after signup, resolve his actual auth identity and provision authorized coach access. Do not synthesize legal consent or send an invitation. Production release remains authorized after the real GitHub approval.
- Continue in isolated release worktree /Users/calebhamernick/Development/coach-house-platform-team-release-20260920, branch feat/team-internal-tooling-release-20260920 (clean, pushed). Verify exact head/checks/main and required review, merge through normal GitHub protection, then verify the intended coachhouse production deployment and coachhouse.app routes. Original dirty root branch b476ada1 and port3000 preserved; own3004 server stopped. Root final evidence is logged locally here; PR body also records final checks/limitations without introducing another docs-only deployment.

### 2026-09-20 19:06 EDT — Release scope rejected after Marketplace regression review
- User correctly challenged the public Marketplace screenshot changes. PR241 is based on broad development baseline b476ada1, not a minimal production-based internal-tooling patch: 1,000 changed files against production, including238 nonprofit-documentation files. Newer local Marketplace/Brand Identity edits were excluded, leaving older public designs in the candidate. Updating Linux references certified that older output; it did not validate the user's intended release scope. This is a release-selection error, not a production deployment.
- Returned PR241 to draft and added a do-not-merge scope warning. PR remains open/unmerged; production main still d88a09431d474c8b4b13eeb102a63fba209546f9. Original local Marketplace and dirty workspace untouched. No source changes or new deployment in this corrective batch. Earlier green CI applies only to the rejected candidate.
- Asked whether to preserve production public pages exactly while releasing internal tooling only, or include the latest local public designs. Do not assume either broad public rollout or older public baseline is acceptable. Direct imports from coach-dashboard/member-workspace/platform-admin-dashboard into nonprofit-documentation/documentation-decision-canvas were not found; full shared dependency closure remains to audit.
- Continuation: establish explicit public-page boundary, rebuild candidate against production with that boundary enforced, review exact source/public-route diff before screenshot updates, then rerun relevant validation. Do not merge PR241 as currently assembled.
