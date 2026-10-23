# Tasks prototype adoption — plan and implementation prompt

Status: [PR343](https://github.com/Hamernick/CoachHouse/pull/343) open, implementation `bbb46ab65ac730cec539e396a081434fe6becade` pushed. Production migration is not applied. See the implementation checkpoint below.

Planning branch: `chore/tasks-plan-20261020`, base `9e08dbf7` (current fetched main).
Worktree: `/Users/calebhamernick/Development/coach-house-platform-tasks-plan-20261020`.
Source audited at `29d627aa`; its complete tree equals this main base. Existing prototype server remains on port3127 in the fiscal checkout. No new server started.

## Requested outcome

Upgrade real `/tasks` to the appearance and usable interactions of `http://localhost:3127/internal/platform-lab/tasks`, including tasks grouped by project, List and Board. Customize to existing identities, data, permissions and persistence. This is a new user-selected internal-tools patch, not a reopening of completed tracker imports or unrelated workstream04 connectors. Original04 packet and SHIP were consulted for preservation boundaries; no shared release claim changed.

Three agents, each with its own goal, independently reviewed production contracts, prototype interactions and validation. Parent reconciled them using Graphify and direct source. Browser navigation and a subsequent snapshot timed out: rendered visual fidelity is not verified. No existing tests were rerun for this plan, and no production records were queried or modified. Historical import counts below are recorded evidence, not current live totals.

## The deeper approach

1. **What a leading practitioner adds:** establish a behavior contract before copying UI. For every control, identify exactly what it reads, what it may change, who may change it, how it persists, and how failure/concurrent changes are handled. Prove task conservation across both views.
2. **Raw material:** real route/loaders/actions, SQL functions and RLS, task/assignment/project types, prototype event handlers, original imported-data contracts and regression fixtures. Screenshots and React Grab paths guide appearance but cannot establish behavior or authority.
3. **Methods/tools:** Graphify call tracing; source-to-SQL mutation mapping; capability matrix; task-ID reconciliation; calendar-day boundary tests; focused Vitest; disposable PostgreSQL/RLS and concurrency tests; hydrated browser interactions and visual comparisons. Use production metadata only if a concrete unresolved question requires a read-only probe. Never run imports or notification cron endpoints for verification.
4. **Independent proof:** reload/readback agrees with the UI and project detail; fixture IDs/counts reconcile; forbidden writes leave rows unchanged; concurrent/rejected writes preserve unrelated fields; keyboard/mobile journeys pass; required current-revision GitHub quality and protection checks pass. Deployment and real staff acceptance remain separate evidence.

## Confirmed findings

Paths are relative to the repository.

| Finding | Source | Consequence |
| --- | --- | --- |
| Current UI deliberately renders flat although data is grouped | `src/features/member-workspace/components/tasks/member-workspace-tasks-page.tsx:434`; `tests/acceptance/member-workspace-task-filters.test.ts:169` | Change the presentation expectation intentionally; retain personal scope. |
| `/tasks` is a personal queue with verified platform/workspace scope | `src/app/(dashboard)/tasks/page.tsx:14`; `src/features/member-workspace/server/task-loaders.ts:192` and `:344` | Project grouping does not authorize viewing all tasks in that project. |
| Prototype loads fixtures and updates React state | `src/features/platform-admin-dashboard/upstream/components/tasks/MyTasksPage.tsx:46` | Reuse presentation through real actions, not its state/database assumptions. |
| Board is Monday-based, grouped by start date, weekdays by default | `src/features/platform-admin-dashboard/upstream/components/tasks/TaskWeekBoardView.tsx:47` and `:72` | It is a weekly schedule, not status Kanban. |
| Fiscal shared review tasks have blank dates and full editing disabled | `src/features/member-workspace/server/fiscal-review-tasks.ts:23` | Visible Unscheduled section; retain narrow status-only writes and shared assignees. |
| Native tasks support Waiting; directory status dispatcher rejects it | `src/features/member-workspace/types.ts:62`; `src/features/member-workspace/server/fiscal-review-task-actions.ts:12` | New status controls must accept Waiting for ordinary tasks without widening fiscal statuses. |
| Existing reorder requires the entire project task set | `supabase/migrations/20260805235900_atomic_organization_task_reordering.sql:59` | Personal, filtered or week subsets cannot be submitted directly. |
| Loader orders by date/title; board same-day order is local | `src/features/member-workspace/server/task-loaders.ts:50`; `src/features/platform-admin-dashboard/upstream/components/tasks/TaskWeekBoardView.tsx:157` | Saved ordering needs an explicit end-to-end contract. |
| Full updates can replace assignments | `supabase/migrations/20260928160000_task_assignment_notifications.sql:122` | Date/tag gestures must not resubmit an incomplete task editor payload. |
| Historical import included160tasks without start dates,180without deadlines | `docs/operations/tracker-import/README.md` | Blank dates are legitimate, not missing data to auto-fill. Do not reimport. |

Prototype defects excluded from adoption: empty results remove the toolbar; empty projects are omitted from create options; member matching uses fixture assumptions; list does not supply the edit callback; board Add does not prefill the selected day; many View settings and attachment/voice buttons have no effect. These are source observations, not newly reproduced browser failures.

## Recommended product contract

**Scope and identity.** Keep Assigned to me, Proposed to me and Collaborating exactly scoped to the signed-in actor. Group by project ID, preserve organization context for duplicate project names, and retain original task IDs. Do not promote collaborator/proposal metadata into accepted ownership. Keep native project recurrence and imported provenance unchanged.

**List.** Use compact collapsible project sections with project link, authorized task count, completion indicator, rows and contextual Add. Completion numbers describe the current authorized/filter scope, never an implied total for private unseen tasks. Both views open the same permitted task editor. Empty projects remain available in the creation selector. Preserve the toolbar and Create/filter-reset actions when results are empty.

**Board.** Use the prototype's weekly schedule with previous/next/Today, visible range, weekend toggle and project identity on every card. Add a persistent Unscheduled section, plus explicit counts/access for overdue and outside-range tasks. Define overdue by incomplete task deadline, not merely an old start date. Due-only tasks remain unscheduled for this start-date board and display their deadline. Never assign a date from imported planned-week text. Hidden weekend tasks have a visible count/toggle. List remains the complete matching queue; board partitions it into visible dates, Unscheduled and clearly explained outside-range work.

**State.** One filtered authorized task collection feeds both views. Keep relation, filters, List/Board and selected week in validated URL state so reload and Back/Forward restore context without writing task records. Only expose View options with implemented behavior. No new search system, deletion flow, attachment upload, voice capture, recurrence editor or external Calendar integration is included.

**Create/edit.** Existing server actions and atomic project-move path remain authoritative. Contextual Add preselects project; board day Add preselects start date and retains project selection when there is no unique project. Actual permitted edit/move/assignment options come from server scope. Do not copy prototype project-move behavior. Use explicit per-task capabilities for status, details, schedule and order; global management access alone is insufficient.

**Schedule changes.** Add a narrow, authenticated schedule mutation rather than calling full task edit. Proposed default: dragging changes start date only; deadline is preserved. If that would place start after deadline, reject the drop, retain prior state and offer the existing editor to change both dates deliberately. Clearing the start date moves the task to Unscheduled. Treat task dates as calendar dates; retain UTC timestamps for audit/version fields. Check expected schedule/version before saving, and preserve concurrently changed title/status/assignees. Shared fiscal tasks cannot be scheduled through this path.

**Order.** Do not activate prototype local-only handles. For project-local manual order, use a narrow relative operation (task plus before/after neighbor and expected order/version) with server-side project/actor validation and transaction locking. Preserve hidden-task relative order and reject cross-project or stale neighbors. Read and render the saved order consistently. Filtered subsets must not overwrite a full project order. The weekly board may mix projects, so initial same-day card order is deterministic by project and saved project order; cross-project same-day drag is omitted. Cross-day drag means rescheduling only. This avoids adding a separate personal ranking model merely to imitate a local-only demo gesture.

**Feedback/accessibility.** Optimistic changes reconcile against server results. Roll back only the affected task or operation, never restore an entire stale list over other saves. Prevent repeated pending actions, retain drafts on error, and do not report uncertain writes as saved. Provide keyboard-operable date/editor alternatives, visible focus and accessible labels; preserve generous touch targets and reduced-motion preferences. No task edits occur merely by switching views or weeks.

## Architecture and ownership

Recommended: adapt production components inside existing `src/features/member-workspace/components/tasks/`, reusing established shared primitives and current task editor contracts. Keep lab fixture page untouched as reference. No new feature scaffold is needed for extending this feature. Routes remain composition-only.

Alternatives: wrapping the prototype wholesale is faster but carries fixtures, inert controls and unsafe mutations; rebuilding the task model is broader than requested and risks imported/shared work. Neither is recommended.

Likely source owners:

- `member-workspace-tasks-page.tsx`: orchestration, toolbar, shared source, existing completion/create/edit handlers.
- New small production task-list/task-week-board/view-state modules alongside it: grouping, dates, permission-aware callbacks, URL state.
- `src/features/member-workspace/server/task-loaders.ts`, task types/adapters: capabilities, order, retained provenance and all actual status values.
- `src/features/member-workspace/server/task-actions.ts`, `fiscal-review-task-actions.ts`: narrowly authorized mutations, native Waiting compatibility, platform action scope regression.
- Additive SQL only where schedule conflict/order atomicity requires it; keep existing full-editor and fiscal RPCs intact. A new task table or data migration is not presumed necessary. Applying a future production migration is a separate action.

React Grab trace: the round project Add instance belongs to `upstream/components/tasks/task-helpers.tsx:287` (`ProjectTasksSection`); board arrows belong to `TaskWeekBoardView.tsx:203`/`:220`; rounded teal checkbox classes belong to `TaskRowBase.tsx:38`. Shared primitive base/variants are in `upstream/components/ui/button.tsx` and `checkbox.tsx`. Semantic theme tokens supply colors; `docs/design.md` governs compact spacing, borders, typography and restrained motion. Inspect linked popover/modal surfaces before implementation. Do not globally restyle primitive checkboxes/buttons to fix these task instances.

## Execution sequence

1. **Pin task invariants.** Add behavioral fixtures for personal relations, duplicate project names, native Waiting, date-less/shared fiscal work and capability differences. Reproduce the native Waiting dispatcher mismatch. Verify staff actions with a support workspace selected. Do not widen rights to make a UI control work.
2. **Deliver functional List/Board.** Project sections, shared filter/state pipeline, weekly schedule, Unscheduled/outside-range handling, both-view editor, contextual Add, pending/error states and URL restoration. Existing create/edit/completion actions must save and reload correctly. Board can first use the existing editor for explicit date changes while its narrow drag endpoint is developed; do not claim drag complete at that checkpoint.
3. **Connect safe scheduling/order.** Add and test only necessary narrow mutations. Enable controls only after actual persistence, authorization, conflict handling and rollback are verified. Retain project assignments and notification/recurrence semantics.
4. **Validate and package.** Focused tests plus disposable SQL/RLS where mutations change, hydrated desktop/mobile behavior, intentional baseline updates, one cohesive graph refresh, normal prepush and a small reviewable PR. Required hosted quality, code-owner/protection rules, deployment and real staff acceptance remain distinct gates.

## Acceptance evidence

- Same authorized matching task IDs across List and Board accounting; zero lost undated, Waiting, weekend or outside-range tasks. No unrelated organizations/tasks/members leaked.
- Role matrix: developer/admin, scoped coach, fiscal reviewer, ordinary editor, assigned read-only member and unrelated user; staff-selected support workspace included.
- Create/edit/complete/reopen and permitted project moves survive reload and agree with project detail. Dates/order preserve IDs, project, status, assignees, provenance and unrelated fields.
- Explicitly rejected mutations leave stored rows unchanged. Test stale neighbors/schedule, slow response, timeout, concurrent edits, rapid clicks and refresh during saving.
- Fiscal status changes retain shared reviewers. Native Waiting works; unsupported fiscal Waiting remains denied. Date/order updates do not emit assignment notifications. Import suppression remains intact.
- Existing project recurrence still creates one next occurrence with proper dates/assignees and completed history preserved.
- Date cases: blank/start-only/due-only, overdue, weekend, week/month boundaries, DST, New York/Honolulu/Tokyo; no UTC conversion shifts calendar dates.
- Hydrated390px/1440px flows, light/dark, keyboard, focus return, reduced motion; toolbar survives empty results. Only board container scrolls horizontally.

Extend focused suites `member-workspace-task-filters`, `member-workspace-task-actions`, `member-workspace-task-transitions`, `member-workspace-project-task-interactions`, and `fiscal-review-tasks`. Run `node supabase/tests/recurring-projects.test.mjs` when shared mutations change and relevant fiscal SQL/RLS cases for fiscal dispatch changes. Existing source-string/mock assertions alone are insufficient proof of real saves/concurrency. Required hosted CI still covers all repository merge gates; no full local quality run unless explicitly requested or diagnosing a specific CI failure.

## Rewritten implementation prompt

Build a production-ready upgrade to Coach House `/tasks` in the existing Next.js App Router, React, TypeScript, shadcn/ui and Supabase stack, using `/internal/platform-lab/tasks` as the visual and interaction reference.

Before implementing, trace each adopted control from component to server action, SQL and authorization. Establish task-ID, project, assignment, status, date, notification and recurrence invariants from source and executable fixtures. Use the prototype as visual evidence; do not import fixture state or assume its controls persist.

Include project-grouped List and weekly Board views, shared relationship/status/priority/tag filters, project context, week navigation, weekend visibility, Unscheduled/outside-range handling, permission-aware completion and editing, and contextual task creation. Preserve Assigned to me, Proposed to me and Collaborating. Retain real task IDs, blank dates, native Waiting, imported metadata, shared fiscal reviewers and existing organization boundaries.

Use the proposed schedule/order semantics in this plan: calendar-day start-date scheduling with preserved deadlines and explicit invalid-range feedback; narrow conflict-aware schedule writes; safe project-local ordering that preserves hidden records; deterministic mixed-project day order. Keep unsupported fiscal edits and cross-project same-day ordering unavailable. Save through authenticated atomic server paths; show pending, confirmed, rejected and retry states, with task-scoped rollback and no stale overwrite of unrelated edits.

Make it feel compact, calm and dependable using the prototype's project hierarchy, completion controls, restrained cards, semantic colors and existing Coach House design tokens. Support mobile/desktop, light/dark/system, keyboard operation, accessible touch targets and reduced motion. Animate only useful state transitions. Keep controls available in empty states and put supported view/filter/week state in the URL.

Work in an isolated task branch. Preserve the lab reference, other worktrees, existing imported records and production data. Avoid unrelated feature expansion. Split implementation into functional vertical slices with reviewable checkpoints, then produce a small PR containing source, any necessary additive SQL, focused regression/RLS/concurrency tests, visual evidence and a concise Markdown verification report. Prove reload/readback and project-detail agreement, personal access isolation, fiscal assignment preservation and recurrence/notification continuity. Distinguish local validation, hosted gates, deployment and actual staff acceptance. No production migration application or live task manipulation is implied by this implementation prompt.

## Implementation checkpoint — October20

User authorized implementation with “get to work.” Continued the isolated planning branch and dispatched three agents with individual goals for mutations/SQL, Board, and List/independent validation. No existing servers or unrelated worktrees changed. Original04 packet consulted; new Tasks scope remains separate from connector/import work and shared SHIP revision40 ownership hold.

Implemented the project-grouped List and weekly Board using real personal task data. Both views share relation/filter/URL state, preserve project IDs and organization context, and open the existing editor. Board accounts for Unscheduled, due-only, hidden-weekend, overdue and outside-week tasks; contextual creation prefills the chosen day and requires a selected project. Shared modal additions are optional; lab behavior remains unchanged. Inert attachment/voice controls are hidden only in the production Tasks editor.

Explicit task capabilities preserve fiscal status-only access and allow assigned read-only members to complete their own task. Native Waiting now reaches the ordinary task action while fiscal status restrictions remain. Staff create/edit/status actions use verified directory scope independent of a selected support workspace.

Narrow schedule writes preserve deadline, status, metadata and assignments. Cards remain in their current column with pending feedback until confirmed: a browser regression caught that optimistic cross-column movement unmounted and lost rejected date drafts. Failed saves now retain the draft. Completion uses per-task overlays and synchronous pending locks; no whole-list rollback. Relative up/down ordering persists with expected task/neighbor versions and preserves hidden-record relative order. Mixed-project Board ordering remains deterministic; no local-only same-day ranking.

### Migration and rollback

`supabase/migrations/20261021010000_task_schedule_and_relative_order.sql` adds two service-only RPCs; **applied and independently verified in production at2026-10-21T00:01:23Z**, following explicit user authorization. No imports, backfills, task table changes, provider settings or mail actions. Schedule uses a task-row lock; relative order uses project locking and NOWAIT task locking to reject conflict rather than deadlock with the existing task-first editor.

Rollback: revert the application slice first, then drop only `public.schedule_organization_task_transition(uuid,uuid,uuid,uuid,date,date,date)` and `public.move_organization_task_transition(uuid,uuid,uuid,uuid,uuid,text,integer,integer,timestamptz,timestamptz)`. No stored tasks/assignments are deleted or restored. Already confirmed schedule/order changes remain ordinary task data.

### Verification and review

- Focused Vitest:92 distinct cases across8 task/filter/action/transition/board/view-state/fiscal suites. Role/capability cases include assigned read-only, fiscal reviewer, global access with explicit denial, absent actions and stale versions.
- Disposable PostgreSQL: `node supabase/tests/recurring-projects.test.mjs` passes with actual two-session schedule/order races, old-editor lock contention, forbidden RPC execution, stale/cross-project/wrong-org rejection, exact assignment preservation, no new assignment notices, unchanged provenance and recurrence/history.
- Hydrated Chromium fixture: completion/edit/schedule/create/reorder survive reload; drag and Back navigation work; shared fiscal controls stay restricted; rejected scheduling retains date draft; empty filters retain toolbar.390px/1440px, light/dark and reduced-motion captures; no page-level horizontal overflow or observed client errors. These are sample records with session persistence, not authenticated production acceptance. Six durable interaction cases are in `tests/visual/tasks-interactions.visual.spec.ts`.
- Application TypeScript check uses the repository compiler options and application+root declaration files; test-fixture declarations are outside this check. Scoped lint, structure, routes, features, boundaries, raw-buttons and diff checks pass. Full local quality was not run; hosted aggregate quality and branch protection still required.
- [Review images](../qa/tasks-2026-10-20/) are macOS Chromium artifacts, not Ubuntu regression baselines. No existing stored baseline targets `/tasks`; the new fixture has screenshot attachments in the hosted interaction suite. Required Linux visual gate remains separate.
- CUA timed out; standalone isolated Playwright tests provided hydrated verification. Initial Turbopack rejected external dependency symlinks; the isolated preview uses webpack. Its generated type files were regenerated after the failed startup. Existing3127 remained untouched.

Preview: `http://localhost:3140/visual-regression/tasks?taskWeek=2026-10-19` (sample data only); real authenticated route: `http://localhost:3140/tasks`. Fixture is guarded by existing visual-route access and imports no production task actions. The required scheduling/order migration is now applied; authenticated product acceptance remains separate. Dependencies/environment are ignored links to existing authorized local files; no credentials are committed.

### Handoff

Open [PR343](https://github.com/Hamernick/CoachHouse/pull/343), implementation `bbb46ab65ac730cec539e396a081434fe6becade`, pushed and remote tracked. Normal Node22 prepush passed in9.53s. All six browser scenarios passed across focused runs; drag test now waits for activated/target states rather than racing sensor measurement. Application TypeScript has zero diagnostics. Caleb owns hosted quality/review, migration authorization/application, merge/deployment and real authenticated staff acceptance. No production task changes or migration application occurred. Other lanes and SHIP40 preserved.


### Authorized migration application — October20

User requested “apply the migrations.” Applied only `20261021010000_task_schedule_and_relative_order.sql` to configured production project `vswzhuwjtgzrkxknrmxu` at2026-10-21T00:01:23Z (October20 local). Preflight verified absent migration/functions, expected dependency column types and roles. One guarded transaction created both functions and the exact migration-history row, with5s lock/20s statement limits. Two independent readbacks verify exact ledger SQL and function bodies, SECURITY DEFINER with empty search path, service_role execution and denial to PUBLIC/anon/authenticated; existing task/project RLS remains enabled. No task records, assignments, imports, backfills or mail were changed.

SHA256: `a96bbde8490fd2e6af6ab434fab47b89e0ebd2c994837d5ffed0f6965e852b8a`. Private evidence: `~/.local/share/coach-house/tasks/2026-10-20-migration/migration-receipt.json`, with exact SQL, preflight and separate readbacks alongside it. Do not replay this migration. Rollback signatures above remain valid.

PR343 is confirmed merged. Application deployment and real authenticated staff acceptance were not verified by this migration operation. Prior code verification remains valid; no runtime source changes or repeated suites. This migration receipt supersedes the unapplied/open-PR statements in the historical implementation handoff.


### Preview-task diagnosis — October20

Read-only production audit confirms34copies each of Review the sample project, Try adding a real project and Clear this preview when ready, all marked starter_seed, across34organizations (102tasks/102assignments). Latest creation2026-10-19T17:05:30Z; none created after the new Tasks migration. Current origin/main has identical starter template/persistence/loaders: organization page loading seeds a preview project when there are no ordinary projects or starter-state marker; Tasks/detail loading persists three sample tasks and assigns them to the triggering editor. Personal task loading does not exclude starter_seed. This existing demo initialization survived the Tasks patch. Recommended correction: stop implicit production seeding, then review untouched seed records for scoped cleanup while preserving edited/user-created work. No runtime change or live deletion authorized/performed by this diagnosis.


October20 follow-up: user authorized removal/prevention after the diagnosis. [Preview cleanup checkpoint](2026-10-20-remove-workspace-preview-seeds.md) now owns that patch and its applied production correction; the diagnostic recommendation above is completed there.
