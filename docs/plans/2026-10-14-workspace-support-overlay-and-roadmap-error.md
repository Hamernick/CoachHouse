# Workspace support text and roadmap error

User direction, October 14: remove the unwanted support/session text, roll that out as the first patch, then address the reported roadmap editor error separately. Keep the existing workspace support feature. This revises Run04A's textual presence presentation without removing authenticated presence or support access.

## Patch 1 — remove the two unwanted text rows

Source: `src/features/organization-workspace-support/components/organization-workspace-support-panel.tsx`.

Delete the temporary-workspace status paragraph and the separate staff viewing/editing roster paragraph, plus their unused derived roster variable. Do not replace the text with another banner. Keep the support controller mounted: its authenticated presence is needed for support writes. Preserve same-page cursors, access checks, workspace switching, editing and actionable error feedback. The shared component covers the normal sidebar header and the admin/dashboard fallback placements.

Branch: `fix/workspace-support-copy-20261014` in isolated `coach-house-platform-support-copy-20261014`, base `dc95147a` (includes the Coaching access fix). Preserve the separate coediting checkout/localhost3124 and the dirty root.

Actual-app review: `http://localhost:3126/workspace`, with support/collaboration flags enabled in this process only. User tests their existing temporary workspace in the authenticated browser. No synthetic preview or agent walkthrough. No schema, grant, membership, feature-flag/provider configuration or workspace content changes are required.

Validation: existing workspace support search/scope/authorization checks, changed-source lint, feature/import boundaries and diff hygiene. Confirm the two rows are absent while switching and live cursors still work. Update visual references only after user review and only if an affected approved CI fixture requires it. Keep this a small independent PR; release requires current-head hosted quality/code-owner checks and production verification. Existing unrelated bundle/visual failures remain release blockers rather than being hidden or bypassed.

## Patch 2 — roadmap server/client boundary

Reported URL: https://coachhouse.app/workspace/roadmap/fundraising-strategy?returnTo=%2Fworkspace%3Fdrawer%3Ddocuments&write=1

Reported error: `Cannot access textAlign on the server. You cannot dot into a temporary client reference from a server component. You can only pass the value through to the client.`

Route owner: `src/app/(dashboard)/workspace/roadmap/[slug]/page.tsx`, composing `src/components/roadmap/strategic-roadmap-editor-page.tsx`. The collaborative editor sends `pending.steps.map(step => step.toJSON())` in `src/features/organization-document-collaboration/hooks/use-organization-document-collaboration-controller.ts`; server actions recreate and serialize documents using `lib/schema.ts`, including TextAlign. This is a candidate boundary, not a reproduced root cause. Unauthenticated page access does not establish the authenticated error.

After patch 1 is released:

1. Reproduce opening/editing the exact URL in the user's temporary workspace and capture the failing server-action stack. Distinguish initial page render from presence, initialization and save requests.
2. Inspect the actual client action payload, especially ProseMirror node/mark attribute objects and their prototypes. Verify whether any object is encoded as a React temporary client reference.
3. If confirmed, normalize and validate the wire payload as plain serializable document data before the action call; retain server schema validation, stale-write guards, actor/organization scope and stored content. Do not convert the entire route to a client component or suppress the error.
4. Add focused regression coverage for actual aligned text/marks and action serialization, then verify the exact authenticated page, edits, persistence after reload and relevant history/collaboration behavior. Avoid changing production documents during automated diagnostics.
5. Release as its own reviewed patch after required checks. No database migration or document rewrite is assumed.

## Checkpoint

Patch 1 code is implemented locally: five runtime lines removed; README reflects the updated presentation. All 18 existing support acceptance cases, changed-source ESLint, feature and import-boundary checks pass. Actual user review, PR/hosted release evidence and production rollout remain distinct. Patch 2 has not been implemented or claimed fixed.


## October 15 — urgent editor hotfix

User reported the same error blocking a coach/customer call and authorized immediate fix and rollout. Patch 1 is on fetched main `84d9d09b` (#309). Hotfix branch `fix/tiptap-server-reference-20261015`, isolated worktree `coach-house-platform-tiptap-hotfix-20261015`, starts there and preserves unrelated work.

Reproduced the exact reported exception with actual ProseMirror paragraph JSON and Next's React Flight encoder/decoder: null-prototype `attrs` become `$T` temporary references. The server then throws when reading `attrs.textAlign`. Default collaboration transport now deep-normalizes its JSON payload before invoking the action, covering initialization, step slices and mark attributes. Newly generated server document JSON is also normalized before returning to clients. Existing authorization, revisions, validation, history, stored content and formatting remain intact; no migration or content rewrite.

44 focused tests pass, including the original failure, real Flight transport with aligned/link-formatted text, plain bootstrap responses, concurrent editing/undo, server persistence and access/roadmap regressions. Changed-file ESLint, import boundaries and diff hygiene pass. Actual authenticated product review and current-head hosted quality/code-owner/protection remain release gates. Preserve the shared SHIP revision40 ownership blocker; this urgent user-selected patch does not rewrite its historical claim.


Release receipt: PR311 merged externally as1c97b269; intended Vercel deployment dpl_CqSMAv6jyCXZsb3qAKoQwLBKad96 is Ready and assigned coachhouse.app (October15,10:18EDT). Actual authenticated local editor opens, initializes and shows Saved; user production edit/save confirmation requested.44focused cases, lint, structure/features/boundaries/prepush/secret scan and Graphify pass. The external merge occurred before quality/code-owner gates passed. Existing admin bundle budget failure remains; the new codec test required an omitted manifest reclassification, corrected in follow-up fix/tiptap-test-manifest-20261015. No runtime change in that follow-up.


### October15 — Paula admin organization asset dialog follow-up

Paula can open but cannot type after PR311. The reported dialog resolves to OrganizationCoreDocumentEditor in member-workspace, composed by MemberWorkspaceProjectDetailPage from organizations/[id]/page.tsx; DialogContent owns the portal/chrome and globals.css owns background/border tokens. No style change. The collaboration panel starts RichTextEditor readOnly until ready. Installed Tiptap preserves the current editable value across useEditor option changes, so the toolbar becomes enabled while the text DOM remains contenteditable=false. Reproduced on actual authenticated localhost3128.

PR312 now synchronizes live editor.setEditable when readOnly changes, suppressing update events. A disposable browser fixture using the actual shared component verifies typing after unlocking, later locking, unlocking without content loss, and no false onChange events. A committed Playwright regression covers that same flow; hosted execution remains pending. Seven serialization regressions and manifest check pass. Actual local connected editor now has contenteditable=true. No production document text or authorization changes. Paula production save, current-revision CI and review remain pending. Slow Connecting has not been diagnosed or claimed fixed.


### October15 — Endless workspace-drawer connection follow-up

PR312 merged externally as56aa3a38. User then reported the roadmap drawer remained Connecting/Opening document. Existing production tab confirmed stuck, fresh tab eventually opened; precise triggering request remains unverified because browser network inspection was declined. Opening previously awaited an unbounded server action in Next's navigation/action queue. New branch fix/roadmap-connection-20261015 moves sync/open to a same-origin JSON endpoint using the same authorized server implementation, with a15-second abort and visible retry. Maintains optimistic concurrency/idempotent acknowledgements for ambiguous timed-out writes.

49focused cases and scoped lint/routes/features/structure/boundaries pass. Actual local Need drawer timeout recovered via Try connecting again to Saved/contenteditable=true without altering saved text. Live endpoint returned200 in633–755ms after compilation. Production rollout and user verification remain pending.


### October 15 — Workspace switching and loading follow-up

PR312 (56aa3a38) and PR313 (a6a3527e) are externally merged. Vercel production deployments 5sQzQEYYcY976YkzaRjPzynM36TH and DuUkGKbmPJnK8rwtg29L34StnXxa show Ready at 10:40:24 and 10:48:28 EDT respectively. Existing tabs can retain older editor code; Paula's production edit/save confirmation remains pending.

User reports silent, slow organization switches and slow workspace/document opening. Continue on fix/workspace-switch-latency-20261015 from a6a3527e in the same isolated hotfix checkout, preserving the root and unrelated servers. Switcher now immediately shows Switching to the target, disables duplicate selections, and uses a same-origin JSON endpoint followed by one full navigation. Targeted membership or audited support-entry checks replace loading every accessible organization's profiles and repeated support checks. Existing grant, organization existence, audit, cookie and unsaved-change protections remain. Read-only background document polling no longer blocks switching; dirty content, local steps and budget edits still do.

Workspace content and layout resolve concurrently. Independent timeline/fiscal/finance loads overlap; timeline skips module-progress reads it never consumes, preserving published lesson content and the default progress behavior elsewhere. Added public routes facades also repair the feature-entry contract omitted in PR313's final entrypoint split; the earlier recorded feature-check pass preceded that split and did not validate its final revision.

82 focused cases across 14 files pass; scoped ESLint, structure/routes/features/boundaries, acceptance manifest and diff hygiene pass. Graphify updated 21,218 nodes/61,090 edges. Full TypeScript remains failed in 12 unchanged acceptance-test files, with no diagnostics in this patch's files; not a full typecheck pass.

Actual local UI showed immediate switching feedback, switched into Southside Community Table, loaded its saved Need document, and returned to the original Coach House Solutions Group. No document body edited. One switch endpoint took 655ms application time plus 12.6s dev compilation. Local workspace content timing fell from one 13.2s sample to one 5.3s sample, but dev compilation/cache/network differ: this is not a controlled benchmark or production speed claim. A later local document remained in retryable timeout during development recompilation; full end-to-end production latency/edit/save verification remains outstanding.

Hosted current-head quality/code-owner/protection and deployment remain required. Historical /admin bundle-budget failure and shared SHIP revision40 ownership blocker remain recorded; this patch does not bypass them. No schema, grant, provider configuration or customer content changes.


### October 15 — Bound organization search and remove action-queue dependency

User reports the admin organization switcher stays Searching without results. Current clean main9784757b includes PR314; new fix/workspace-org-search-20261015 reuses the isolated hotfix checkout and preserves unrelated lanes. The search hook still awaited a server action without a deadline; its existing rejection handler cannot settle a request that never resolves. Production triggering request was not inspected or claimed proven.

Search now uses same-origin/no-store POST /api/account/workspace-support-search, delegating to the unchanged authenticated search and live-grant-enforcing RPC. The client aborts after10seconds and exposes the existing Retry UI; hook cleanup aborts superseded searches and retains stale-result suppression, debounce and pagination. No schema, grant, customer content, presence or selection changes.

35focused tests across4files pass: independent HTTP dispatch, timeout/retry, cancellation, failed/invalid responses, origin/input rejection, existing search authorization/identity/paging, switch authorization and member-workspace behavior. Feature/boundary/route/structure and normal prepush checks are recorded with the PR. User owns actual UI and production verification; agent scope ends at open PR, without hosted polling/merge/deployment.


### October 15 — Pause patching; evaluate the complete support-editing chain

User reports Joel and Paula can only view Origin after switching organizations; Caleb also gets slow document connection plus two explicit errors: Live support presence is unavailable/Reopen the workspace, and Connecting took too long/Try connecting again/Your edits are retained. User requires Caleb, Joel, Paula and fs@coachhouse support access across organizations and explicitly paused patch work for a whole-chain evaluation.

Before that pause, new fix/support-roadmap-edit-access-20261015 from main0fd6b05d reproduced the drawer defect: WorkspaceCanvasOverlayRoadmapPanel combines canEdit with paid-team entitlement and ignores server-verified WorkspaceSupportMode. Three new actual-panel render cases failed before the local fix;45focused cases pass after honoring support mode, skipping unrelated member/billing loading for support, and preserving ordinary member/read-only restrictions. Server documentContext already permits verified support writes without paid storage and checks current access on each request; added tests cover that and revoked support. Changes remain uncommitted, with no PR/deployment; do not claim the complete flow works. PR315 search changes are on main27309aa7; no need to repeat them.

Read-only chain assessment: permission decisions are split across active organization, support grant, UI paid-plan gate and document server access. Opening may require both initial read and client bootstrap. Every document sync waits for actor lookup, presence upsert, participant read and cleanup after document reads/write; presence failures can mask successful durable work. Separate workspace presence still uses a one-second unbounded server action; some support-write RLS requires presence within15seconds. This is distinct from document-session presence. The document transport's15-second client deadline produces the reported timeout. Generic Download my current copy appears for every error, even before a loaded editor exists, and does not prove conflict or data loss. Current server catches hide root errors and have no stage timings. The exact slow/failing production stage is not established.

Historical private records identify four explicit grants, but a fresh read-only grant/identity query timed out and was bounded/stopped; no current four-account verification or grant mutation is claimed. Existing production tab was only listed, never reloaded/edited/network-inspected. Runtime changes stopped on user request.

Next proposal for user evaluation: one consistent server-derived document-edit capability honoring the existing grants; an authenticated durable load/save path that does not wait on decorative presence or team-management loading (preserve existing authorization and required presence guards); bounded/recoverable presence with stage-level error/timing evidence; real integrated switch/open/type/save/reopen and concurrent-staff regression coverage rather than isolated mocked checks. Caleb owning hosted CI/merge/deployment/production verification does not replace agent-owned integration evidence before PR handoff.


### Superseding implementation proposal

Caleb requested planning before further patches. Continue from [Reliable workspace support editing](2026-10-15-workspace-support-editing-design.md), which includes architecture, permissions, complete error-state presentation and integrated acceptance. Preserve this file as incident evidence; do not resume isolated patch shipping from its historical steps.
