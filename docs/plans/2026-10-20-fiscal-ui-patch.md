# Fiscal UI patch — October 20, 2026

Status: implementation `a20a8584` pushed; open non-draft [PR341](https://github.com/Hamernick/CoachHouse/pull/341). Normal Node22 prepush passes (9.65s). Caleb owns hosted review/release and live acceptance. No production migrations, account/data changes, emails or provider changes performed. This is the authoritative implementation/evidence checkpoint; the original investigation follows for context.

- Original packet: `03-accounts-onboarding-fiscal.md`, stages 3–6. Historical work and SHIP revision40 remain untouched.
- Branch: `fix/fiscal-ui-patch-20261020`, base `89108944` (merged invitation PR340).
- Worktree: `/Users/calebhamernick/Development/coach-house-platform-fiscal-ui-patch-20261020`.
- Preview: http://localhost:3127/fs; Node22, Next webpack, exec session93132, independent `.next`. Verify listener cwd before restarting it. Other lanes/servers preserved.
- Existing backend configuration and lockfile-matching dependencies reused; local fiscal guest/staff email sending remains disabled.
- Release boundary: normal prepush, branch push and open PR are agent-owned. Caleb owns hosted quality/review, merge, the exact reviewed migration application, deployment and live acceptance. The prepared migrations are not applied by this task. Linked staff/applicant screens depend on those new RPCs, so the current shared-backend localhost cannot prove their live operation until an authorized migrated backend is available.

## Implemented outcome

| Slice | Final behavior |
| --- | --- |
| Public flow | `/fs` GET/HEAD returns HTTP308 to the existing fiscal documentation page, preserving query parameters. Both requested paragraphs and receipt Check status/Not now are removed. Remaining receipt CTA reads **Start free and save your info**. Separate optional-profile Not now remains. |
| Fiscal identity | Fiscal projects display **Fiscal Sponsorship**. Lifecycle status remains editable in explicit edit mode; ordinary project behavior is unchanged. |
| Reviewer files | Assigned fiscal reviewers can upload before an applicant has an account, connect saved files to required documents, and reopen files. Server authorization binds the exact reviewer/project; registration atomically saves asset plus audit event. Content-bound request IDs and retained failed batches support retries; failed document connection preserves its completed upload. Generic guest PATCH/DELETE/folder editing remain denied. |
| Platform actions | Directory-origin folder and fiscal-opt-in actions use an explicitly validated platform context while retaining coach organization restrictions. Default workspace context stays unchanged. This fixes the reproduced source/context mismatch; the user's precise historical request remains unconfirmed. |
| Link organization | Existing reviewer workbench searches only organizations whose confirmed owner uses the application email, confirms the destination, atomically records the association and independently reads it back. Original host project, application, tasks, files and history stay in place; no profile fields are copied by staff linking. Conflicts, stale versions, revoked authority and duplicate/concurrent requests are handled. |
| Applicant workspace | Optional selected-field profile save and staff linking converge on the same association. The active organization's fiscal card shows the existing application/status and opens its applicant-safe view. Editors can use the linked application without selecting their own unrelated workspace. Exact legacy owner claims retain cookie-free profile reopening. A database guard prevents creating a second native application after linking. |
| Notifications | Assigning-staff receipts say **You assigned a task to [name]**; old receipt titles render **You assigned a task** without rewriting history. Personal SELECT/UPDATE/DELETE policies are owner-only, including developers; trusted production inserts remain supported. Client account changes remount the inbox, discard late loads and clear private stale state after errors. |

Google signup already uses the shared auth integration. Read-only provider configuration confirms Google enabled; genuine public client configuration was added only to this lane's ignored local env. The script, iframe and signup control render, but Google reports that `http://localhost:3127` is not an allowed origin. No provider configuration changed and no completed Google authentication is claimed.

The FS observation remains classified accurately: read-only role tests found zero foreign notifications, and own-recipient assigning-staff receipts naming Caleb match the reported symptom. The separate developer-wide personal-notification policy exception is repaired; it was not evidence that FS could read Caleb's inbox.

## Implementation evidence and release gates

All commands use Node22 unless noted. Reuse these results while their affected source remains unchanged.

- Public intake/redirect and shared project-header tests:57 cases pass; final route-only6 rerun after switching the redirect to an explicit route response. Actual localhost GET and HEAD return308, including repeated query parameters.
- Reviewer upload/client retry, isolation, folder/opt-in, shared project, workbench, asset integrity and document tests:75 cases pass across the focused groups; final transport/retry interaction plus handler suite11 pass. These cover denied/revoked/wrong-project scope, failed writes, saved-file preservation and actual Files-tab retry using the same request ID.
- Organization attachment/profile/follow-up/workspace tests and UI transport tests pass. Search rejection settles; a lost action response retains selection/request ID for retry. Active-org projection and exact legacy-owner authorization are checked. Five additional workspace-card interaction tests pass for hiding prior-org data immediately, ignoring late responses, failed loads, retry and returning the existing start card only after a confirmed empty result.
- `node supabase/tests/fiscal-final-schema-rls.test.mjs --guest --connected`: passes with both attachment and upload migrations, matching/nonmatching/unverified owners, destination conflicts, revoked/unrelated roles, direct-write denial, profile rollback, immutable original IDs, asset/event rollback/replay, native duplicate guard, and two real PostgreSQL connections racing different attachments and identical retries.
- Notification actions/menu/mapper:36 cases pass. `node supabase/tests/recurring-projects.test.mjs`: passes with owner-only notification RLS, foreign admin select/update/delete denial, trusted service insertion, own state and exact assignment-receipt copy.
- Changed-source TypeScript program:41 roots,7,385 dependencies,zero diagnostics; baseline also zero. Three initial new typing errors were corrected before this pass.
- Focused source/test ESLint passes. Structure, routes, feature contract, thresholds, import boundaries, workspace storage/surface, React Grab ownership and raw-button guards pass. Existing near-budget warnings are nonblocking. Acceptance manifest includes new tests.
- Hydrated Chromium public intake/receipt at390px and1440px passes with fiscal APIs fully intercepted: no real draft/application writes. Review screenshots: `docs/qa/fiscal-ui-patch-20261020/`. Screenshots are macOS review artifacts, not Linux visual baseline replacements. Affected new states have no existing screenshot baseline; existing Fund-card defaults are preserved. Required hosted visual gate remains. A later screenshot-framing recapture encountered a transient Next dev JSON parse error during compilation; the bounded failing desktop case passed on retry without source/cache changes.
- Independent review found browser transport recovery and skipped legacy-claim reopening gaps; both were repaired with regression coverage. Further reviewed attachment/upload paths had no additional high-confidence authorization or data-loss finding.
- No authenticated real FS upload/link/application journey or production Google auth was performed. Test evidence combines component interactions, API handlers and ephemeral PostgreSQL/RLS. After migration/deployment, Caleb must verify the actual FS project and destination applicant workspace, reload/open an uploaded file, then check an unrelated identity is denied.

### Prepared migrations — not applied

Apply only these new migrations in ascending order after reviewed release authorization; never replay historical fiscal migrations:

1. `20261020230000_fiscal_organization_link.sql`: association/audit table, scoped linking/search/owner RPCs, selected-field-save wrapper, conservative legacy backfill, applicant projection and duplicate-native-application guard.
2. `20261020231000_fiscal_reviewer_asset_upload.sql`: service-only exact reviewer asset registration and audit transaction.
3. `20261020232000_personal_notification_privacy.sql`: owner-only personal inbox policies and clearer actor receipt producer.

Deploy schema before dependent application code. Keep existing fiscal guest/profile rollout flags enabled for the intended paths. Reversal must preserve associations, files and audit records; migration comments identify function/policy rollback boundaries. A rollback is a separately reviewed migration, not destructive table/data deletion. Unlink/reassignment, mismatched-email identity overrides and merging two applications are deferred.

Graphify completed the full-root AST refresh:21,664nodes/62,197edges. Targeted host-agent semantic checkpoint refresh adds2nodes/1edge without external API calls. The merge helper refused an unrelated fuzzy-dedup shrink; the current graph was preserved and only the two checkpoint nodes/edge were added (21,666nodes/62,198edges). No forced shrink or duplicate full refresh.

Private read-only evidence and detailed agent receipts remain at `~/.local/share/coach-house/fiscal-completion/2026-10-20-ui-audit/`; never put raw customer identities, tokens or application content in the public PR. Local compiler report: `/tmp/fiscal-patch-types.json`; browser fixture scripts: `/tmp/fiscal-public-browser-check.py` and `/tmp/fiscal-google-browser-check.py`.

## Original investigation and approved plan

## Expert approach: deeper, not broader

1. **What a leading engineer would add:** model applicant identity, organization association, internal project ownership and operation-specific permissions separately. Reproduce the precise failing request before changing access. Prove that guest-to-account transitions preserve one application and its history; classify notification recipients before claiming an inbox leak.
2. **Raw materials:** current components and handlers; actual Auth identities and memberships; application/project foreign keys; deployed RLS and SQL functions; receipt/assignment metadata; original browser request, response and selected workspace. Screenshots and summaries locate a symptom but do not establish the responsible identity or authorization rule.
3. **Methods/tools:** Graphify dependency queries followed by direct source inspection; React Grab ownership trace; read-only Supabase catalog/metadata queries and authenticated-role RLS probes; focused Vitest and SQL/RLS tests; two isolated browser identities for reproduction; record-ID/count comparisons before and after fixture transitions. Use existing Next.js, Supabase and shadcn patterns.
4. **Independent proof:** the correct role can complete each operation and an unrelated role cannot; database IDs/history/documents remain intact; retries do not duplicate work; a linked application appears only in its destination workspace; required current-revision CI passes; Caleb verifies the real affected screens after release. A passing unit test alone is not production acceptance.

Ambition is depth: resolve these exact notes through their underlying contracts. No new standalone fiscal site, billing redesign, blanket admin access, new notification platform or general-purpose organization-merging tool.

## Findings and requested outcomes

| Note | Current evidence | Proposed outcome |
| --- | --- | --- |
| `coachhouse.app/fs` | No existing alias found. | Fixed redirect to `/documentation/fiscal-sponsorship`; no visual page. Preserve query parameters; verify signed-in/out GET and HEAD behavior. |
| First text deletion | Intake line83: “No payment or account needed to apply.” | Remove that exact paragraph. |
| Second text deletion | Intake lines86–88: “After submitting, you’ll have the option to create a free profile and reuse your details. You can skip that step.” | Remove that exact paragraph. |
| Receipt buttons | Intake lines41–43: Check status (optional), Create your organization profile, Not now. | Remove first/third. Rename remaining CTA exactly **Start free and save your info**. Preserve its existing application destination and feature gate. |
| Google signup | Fiscal already embeds shared signup/login with Google. Public Google client ID and login/signup flags are absent from this localhost configuration. | Verify/configure the existing local Google client/origin; reuse current integration. Production Google availability was not verified. |
| Account creation and fiscal workspace | Signup alone does not claim an application. Explicit Save to profile / Link without copying sets claimant fields; internal project remains with the host. Workspace shows a recent-application link, not the normal integrated workflow. | Explicitly associate the same application with the destination organization and show its actual status in the existing fiscal workspace component. |
| Later independent signup | Matching email alone does not discover/claim an application; no admin attach action exists. | Add **Link organization** to the existing staff fiscal review UI, with search, review and one audited atomic attachment. |
| Onboarding badge | Shared project header maps planned/default state to Onboarding. Latest fiscal project is planned, with no type label/tags. | Show **Fiscal Sponsorship** based on fiscal identity; retain underlying project/review statuses and ordinary organization labels. |
| Guest project files | Existing storage model supports host-org/project/staff uploader. Generic guest asset writes and folder edits are intentionally blocked. | Add exact-project reviewer upload and document-connection capability. No applicant account is required. |
| Add fiscal / project-access errors | Latest submitted project already has fiscal enabled; FS is an assigned reviewer and host coach. Page/action context differs in some platform flows. | Reproduce exact action/context; avoid duplicate enablement and repair only the failing authorized operation. Do not broaden unrelated coach access. |
| FS sees Caleb assignment | Own-recipient inbox filtering is present. Live FS role probe returns 51 own rows, zero foreign/Caleb rows. Two FS-addressed assignment-confirmation records name Caleb as assignee. | Treat these as likely actor receipts, not a proven foreign-inbox leak. Clarify receipt copy; retain recipient isolation. Exact screen item remains unconfirmed. |

The separate optional-profile page also has a Not now control; the supplied React Grab metadata targets the intake receipt, so that separate control is outside the requested deletion.

## Identity and organization design

Recommended operation: **Link organization**, preserving the internal project rather than moving it. The same application, review events, reviewers, tasks, documents and signature history remain authoritative.

Today, the claim RPC targets the authenticated user's personal organization and requires confirmed matching email plus verified application access. `claimed_org_id = auth.uid()` is built into current linked-access authorization. Merely writing another org ID into that field would not create a working team relationship. The current recent-applications list is user-scoped and can follow that user between workspaces.

Implement one explicit application-to-organization relationship and a common attachment transition for self-service and staff-assisted paths. Keep verified applicant identity distinct from destination organization. The normal workspace card should consume an applicant-safe, active-org-scoped projection of that relationship, without creating another blank application.

Staff interaction:

1. Open the existing fiscal application and select Link organization.
2. Search existing organizations/users. Show the selected organization's name and confirmed owner alongside the application identity.
3. Show whether either side is already linked or the destination has another fiscal application. Reject ambiguous/conflicting attachments; no automatic consolidation.
4. Confirm the exact destination. Copy no profile fields by default; preserve selected-only import as a separate explicit action.
5. Save atomically, audit actor/time/source/destination and verification basis, then read back the saved association. Double-clicks/retries return the same result.

Initial policy recommendation: platform developer or explicitly authorized fiscal staff with access to this application can link to a confirmed organization owner. FS is a scoped coach, not a platform developer; a developer-only button would fail the requested workflow. Do not grant all coaches/reviewers global linking power. Organization owners/editors can receive the applicant-facing view under existing organization permissions; read-only/board access to application PII must be explicitly defined before implementation. Applicant-visible data excludes internal reviewer notes, tasks and internal-only files.

Stop on existing-link conflicts, removed/unauthorized membership, unconfirmed identity, internal-host destination, stale source state or conflicting destination application. Email matching helps locate candidates but does not authorize a link by itself. Different-email attachment needs verified identity correction/consent, not an automatic bypass. Unlink/reassignment and merging two applications are deferred.

## Staff access, uploads and fiscal identity

Live metadata identifies the latest test submission at `2026-10-20T22:13:33.287521Z`: submitted application, planned internal project, fiscal flag already true, unclaimed organization/account. The confirmed FS identity is a platform coach, host organization staff member, assigned host coach and assigned reviewer. Private evidence retains identifiers; do not copy customer/application details into a public PR.

There are two distinct defects to address:

- **Confirmed capability gap:** guest reviewers can read existing files but cannot write through ordinary project upload/folder APIs. Required-document controls also lack connected upload handlers. Build a fiscal-specific authorized operation that checks exact application/project assignment, derives host organization server-side, uploads through existing storage rules, records staff uploader and asset/document association, and refreshes the real UI. Preserve file restrictions and executed-document immutability. Failed association must not report success or leave an uncontrolled orphan; retries must not duplicate assets/events. Keep internal and applicant-visible document access explicit.
- **Unconfirmed exact error cause:** only folder access and fiscal-opt-in actions emit “Unable to access that project.” Some platform detail loaders use platform actor context while actions use workspace context, which can suppress staff access when a support workspace is selected. Guest opt-in has a different deliberate denial and fiscal is already enabled. Capture the exact FS URL/action/response and current workspace, then test that route/context pair. Assigned-coach metadata rules out a simple missing host assignment for the newest application; it does not prove which client action ran.

Use narrowly authorized fiscal transitions rather than removing restrictive guest RLS or allowing all staff ordinary project mutations. A new atomic RPC/migration may be needed for association/audit consistency; never replay previously applied fiscal migrations.

Render Fiscal Sponsorship as the requested identity badge on fiscal projects. Do not rewrite planned/active/archived lifecycle values just to change the visible label.

## Notification diagnosis and policy

`listNotificationsAction` and mutation actions filter by authenticated `user.id`, independent of selected organization. The live FS role is not `is_admin()` and can read zero other-user rows. Its two latest task assignment receipts are titled Task assignment confirmed, addressed to FS, with FS recorded as actor and Caleb as assignee. The trigger deliberately emits one notice to the assignee and one confirmation to assigning staff. This closely matches the user's observation but is not a confirmed match to the exact screen item.

Recommended copy: **You assigned a task to Caleb**, clearly distinct from **Task assigned to you**. Keep shared fiscal notices only for their intended reviewer recipients. Do not delete assignment receipts/history or silently change recipient policy in a visual patch. If the intended rule is assignee-only notifications, that is a specific policy decision to remove future actor receipts, not a cross-user security fix.

A separate, confirmed database boundary exists: notification SELECT/UPDATE/DELETE policies allow platform developers access across recipients. A read-only developer-role probe confirms foreign rows are visible through direct DB access. To satisfy the stated rule that every user's personal inbox is private, plan owner-only personal read/state-change policies, while retaining narrowly authorized service-side notification production/maintenance. Audit existing trigger/cleanup callers before changing grants. Do not infer this exception caused the FS report, because FS does not have that role.

The client hook does not key state by user identity and preserves old items after a load error. This is a candidate for account-switch regression coverage, not a reproduced incident. Test sign-out/account-switch, late responses, counts and read-state operations before deciding whether additional runtime changes are required.

## Ordered implementation slices and proof

1. **Public cleanup and fiscal label.** Exact copy/button changes, fixed `/fs` redirect, contextual fiscal badge. Use a composition-only redirect route under `src/app/(public)/fs` with a feature helper if needed to stay within repository file ownership. Google is existing functionality: validate local configuration and callback/origin behavior, not a duplicate auth build. Present localhost early for Caleb's review.
2. **Staff project operations.** Reproduce latest FS action; implement narrowly scoped upload/required-document association and correct proven page/action context mismatch. Verify upload → persisted asset → connected requirement → reload/open with an assigned reviewer; unrelated coach/applicant/forged project denied. Preserve applicant-account-free intake.
3. **Application-to-organization connection.** Shared atomic association for optional signup and later staff linking; existing fiscal workspace integration; conflict/idempotency/audit and active-org isolation. Keep internal records in place and show only applicant-safe content.
4. **Notification specificity and privacy.** Resolve actor receipt wording/policy, add account-switch and recipient-negative tests, tighten confirmed developer personal-inbox exception without disrupting trusted delivery. Do not claim FS inbox leakage from the current evidence.

Required invariants: one original application/project; preserved events/files/tasks/signatures; no duplicate organization from retry; no paid upgrade or publication side effect; no silent profile overwrite; no unrelated-organization visibility; no unverified/email-only claim; no broad reviewer/admin bypass. Linking must not break guest recovery or invalidate existing documents.

Use focused Vitest, actual SQL/RLS role tests and fixture-based two-user browser checks. Include wrong account, revoked reviewer, unrelated org, duplicate/concurrent request, destination conflict, storage/DB failure and switching active workspace. After controlled transitions, compare database IDs/counts/relationships and reopen actual UI. Avoid production sample submissions/emails during tests. Required hosted quality/review gates remain; Caleb owns merge/deployment and live acceptance under the repo contract.

### Planning-pass evidence and limits (superseded by implementation evidence above)

- 30 notification action/menu-state tests pass on current source (2 files).
- 50 fiscal isolation/shared-project/folder/opt-in tests pass (4 files). These include the present intentional write denials; they do not prove uploads work.
- Read-only production catalog/identity/project/notification metadata and role-scoped SELECT probes performed. No rows, roles, provider settings, emails or migrations changed.
- No authenticated FS browser reproduction, Google provider/origin proof, full quality run, implemented patch, PR or deployment in this pass.
- Root/other worktrees, localhost servers and shared SHIP40 preserved. Planning artifacts remain local only. Private read-only receipts and agent reports: `~/.local/share/coach-house/fiscal-completion/2026-10-20-ui-audit/`.

Source anchors: intake component:41–43,83–88; fiscal-optional-profile-auth.tsx:7–16; google-auth/lib/index.ts:18–30; fiscal-optional-profile.tsx:51–96; guest profile claim migration20261010180000:13–25,74–92; linked-access migration20261015040000:3–12,28–38; my-organization-page-fiscal.ts:28–43; project-assets/route-support.ts:190–192; project-asset-folder-actions.ts:17–29; project-fiscal-sponsorship-actions.ts:16–25; project-detail-loader.ts:577–584; project detail header:62–81; notifications.ts:89–100; task assignment migration20260928160000:223–237. All paths are repository-relative under their existing feature/route/migration directories.

## Rewritten implementation prompt

Build a reliable guest-to-organization fiscal sponsorship flow in the existing Coach House Next.js App Router, TypeScript, Supabase/Postgres/RLS and shadcn stack. Work only on the fiscal notes in this plan. Make it feel compact, clear and consistent with the existing interface: reuse shared controls, current light/dark styling and responsive layouts; add no decorative effects or unnecessary animation.

Before implementation, reconstruct the actual application, project, verified account and organization relationships from current source and read-only metadata. Trace the exact FS actor and failed request through UI, action, RLS and storage. Separate confirmed defects from hypotheses and existing intentional behavior. Preserve original application IDs, internal ownership, reviewers, documents, tasks, signatures and history.

Include a fixed `/fs` redirect; the exact two paragraph removals and receipt-button changes listed above; the exact CTA “Start free and save your info”; the Fiscal Sponsorship badge; the existing Google signup path with verified configuration; assigned-staff guest uploads and document association; and an audited Link organization action for a later-created verified organization. Both immediate signup/link and later staff attachment must show the same application/status in the destination workspace's existing fiscal component without duplicating it, overwriting profile data or exposing internal review materials.

For notifications, distinguish assignee notices from assigning-staff receipts using actual recipient/actor/assignee IDs. Preserve personal inbox isolation across accounts, roles and workspace switching. Treat the FS observation as unproven foreign-inbox leakage unless a request/row reproduction establishes it. Resolve the confirmed developer RLS exception separately and preserve trusted delivery.

Use Graphify, direct source/RPC review, scoped read-only SQL, focused Vitest, SQL/RLS negative tests and isolated browser identities. Prove persistence, denied cross-project access, retry/concurrency safety and record preservation. Use fixtures/sinks for automated workflow tests. Do not send real emails, mutate production accounts/data, replay migrations or change providers without exact task authorization.

Deliver small reviewable slices: public UI, staff operations, organization attachment, notification specificity/privacy. For each, include source-backed cause, changed behavior, focused verification, direct localhost review links and remaining limitations. Output a Markdown implementation/evidence report and reviewable code PRs; stop at the repository's PR handoff boundary. Keep deployment and real-user acceptance separate from local passes. Raise only decisions that change permissions, identity verification or data handling; do not expand into a broader product redesign.
