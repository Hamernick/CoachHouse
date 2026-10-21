# Admin project timeline

## Scope and ownership

Original packet: Desktop `Coach House Codex Workstreams/04-workspace-documents-integrations.md`, internal tools continuation. User requested production admin timeline parity with the existing platform-lab project timeline. Preserve closed integration/import stages and SHIP revision 40. Separate branch `fix/admin-project-timeline-20261020`, worktree `coach-house-platform-admin-timeline-20261020`, base `22b1ccf6`; unrelated preview-seed cleanup remains PR344.

React Grab points to `projects-content.tsx` through the upstream button/sidebar trigger. The reference behavior belongs to upstream `project-timeline.tsx`; the production owner is `components/projects/member-workspace-project-timeline-view.tsx`. Change production orchestration/components, not the shared button or prototype fixtures. Existing semantic colors, compact rows, shadcn controls, visible keyboard focus, restrained movement and bounded mobile scrolling follow `docs/design.md` and the UI rubric.

## Implemented behavior

- `/projects` and `/organizations` receive authenticated timeline load/date/status actions through the public feature entrypoint. Existing directory filters, view switching and organization/coach scopes remain intact.
- Actual local today, date jump, previous/next period, Day/Week/Month/Quarter scale, zoom, fit, collapsible names and project task rows. URL state supports reload/back without fetching the whole directory for presentation changes.
- Tasks load on expansion with pagination and retry. Undated, start-only, due-only, offscreen, system/read-only and empty project states remain visible. More than 50 rows use vertical virtualization.
- Drag/resize snap to calendar days; click or the calendar button opens accessible date inputs. Explicit save retains rejected drafts, disables duplicate writes, and never changes child schedules implicitly. Pointer cancellation cannot save.
- Project changes use the existing revision-checked project schedule RPC. Task updates are narrow conditional writes scoped to verified project, organization, task, non-system provenance, and expected dates/status. Assignment/title/provenance fields are not replaced. Concurrent unrelated field edits survive; stale edits return errors.
- Staff scope comes from verified capability even while viewing a support workspace. Ordinary organization authorization, paid member access and fiscal reviewer boundaries are checked server-side before elevated writes. Fiscal review tasks remain in their dedicated project flow; this patch does not broaden reviewer access.
- No migration, production data edit, notification delivery or import changes.

## Verification and delivery

Focused acceptance covers real action authorization, scope, field isolation, expected-value guards, pagination, invalid/reversed/partial calendar dates, DST/leap navigation and clipping. Existing project schedule/task planning tests and disposable PostgreSQL project/task/RLS regression also apply.

Browser fixture `/visual-regression/project-timeline?timelineDate=2026-10-19&timelineExpanded=community` is access-gated and sample-only. It imports the real timeline with session-storage adapters, not production database actions. Local server 3141 uses Node 22/webpack, leaving existing 3127/3140 untouched. Durable Playwright cases cover desktop/mobile edit/reload, child date isolation, completion, read-only records, drag/resize/cancellation, rejected drafts/load retry, URL navigation, dark mode and204project virtualization. Sample persistence is not authenticated production acceptance.

macOS screenshots are review artifacts, not Linux visual baselines. No existing timeline baseline exists to replace; required hosted Ubuntu 24.04/Playwright 1.58.2 visual checks remain a release gate. Caleb has not yet reviewed this timeline.

Final commands/results, PR and remaining gates are recorded below when complete. Caleb owns hosted quality/review, merge, deployment and live acceptance. No shipped/deployed claim before those gates.

### Local validation

- 38 focused acceptance cases pass across timeline actions/calendar geometry, project schedule transitions and task planning; the 13 timeline cases also pass after final action typing.
- Application TypeScript passes with generated Next route types. Changed-file ESLint, structure/routes/features/boundaries/thresholds, React Grab and raw-button checks pass. Normal pre-push hooks will validate the committed revision.
- Disposable PostgreSQL project recurrence/RLS suite passes, including existing narrow scheduling/ordering, concurrent conflict serialization, assignments, notifications, optional fields and recurrence. No provider/live writes.
- Six Chromium journeys pass at 1440px/390px, including drag/resize/cancel, save/reload, rejected drafts/retry, URL/back/scale/zoom/fit/names, and 204 projects. Final captures have no browser page errors. The protected `/projects` route compiles and redirects unauthenticated requests (307); no authenticated production UI acceptance claimed.
- Review images: [desktop](../qa/admin-timeline-2026-10-20/desktop.png), [mobile](../qa/admin-timeline-2026-10-20/mobile.png), [dark](../qa/admin-timeline-2026-10-20/dark.png). These are macOS review evidence; hosted Linux baselines remain unchanged because no existing timeline screenshot baseline is affected.
- Review URL: http://localhost:3141/visual-regression/project-timeline?timelineDate=2026-10-19&timelineExpanded=community . Production component review after sign-in: http://localhost:3141/projects?view=timeline . Fixture writes persist only in that browser tab's session storage.

### Delivery

Open [PR345](https://github.com/Hamernick/CoachHouse/pull/345), implementation0ba71027. Normal Node22pre-push checks passed in7.71s, including all22changed TypeScript files; staged secret scan found no leaks. Manual Refresh clears local project-date overlays before fetching current server state. No migration or production write. Hosted quality/review, user UI acceptance, merge, deployment and live verification remain open. Local Graphify AST refresh completed; changed index documentation extracted by the repository-required semantic helper and merged separately.

### Preview housekeeping

User-authorized cleanup retired ports3000,3127,3132,3140; this timeline remains at3141. Protected3008and its cache were untouched.62inactive worktree `.next` directories (85.89GiB) removed after per-path process/ignore/symlink/tracked-file checks; source/dependencies preserved. Exact receipt and verification are in the October20runlog cleanup entry. Prior preview links3127/3140are now intentionally offline.

### Task and project filter follow-up — October20

User clarified that Assigned to me / Proposed to me / Collaborating is the multi-select. The actual task owner is `member-workspace-tasks-page.tsx`; shared Select/Checkbox primitives are unchanged. Relationship selections use OR semantics with no duplicate tasks; an empty selection stays empty and legacy single-choice URLs still work. Completion and date ordering are presentation state, persisted in the URL. Task groups and List/Board share the same filtered records; manual move controls disappear during date sorting.

Task and project checkbox filters now apply immediately while their popovers stay open. Tasks exposes completion/order under Display; Projects exposes them under View. Both support All / Completed / Not completed, earliest due first and newest added first. Ordinary task/project loaders carry actual `created_at`; missing/invalid dates sort last and ties retain source order. Existing fiscal review RPCs omit dates, so those restricted task records stay undated; no access expansion or migration. Cancelled projects count as not completed; legacy `closed=hide` still excludes completed/cancelled until the completion control is changed. Clearing the project empty-state filters resets completion too.

Validation:
- 56 cases pass across `member-workspace-task-view-state`, `member-workspace-task-filters` and `member-workspace-project-filters`: combined relationships/deduplication, empty/legacy URL state, completion after mutation, independent date sorting, stable ties and missing dates.
- Eleven distinct Chromium cases pass: five new task/project filter journeys across desktop/mobile, plus all six existing task journeys for editing, completion, scheduling/rejection, creation, drag, manual ordering and reload. Initial cold compilation/hydration timeouts and an ambiguous test locator were corrected in the runner; the final cases wait for hydrated controls and scope the ordering menu.
- Application TypeScript passes (`pnpm exec tsc --noEmit -p .tmp/tasks-tsconfig.json`), changed-file ESLint and structure/routes/features/boundaries/thresholds/React Grab/raw-button checks pass. No database contract changed, so the prior SQL/RLS evidence is reused.
- Graphify refreshed: 21,865 nodes / 62,766 edges; final changed-file hashes match its manifest. No allowlisted semantic documentation changed.
- Review captures: [task display](../qa/task-project-filters-2026-10-20/tasks-desktop.png), [project filters desktop](../qa/task-project-filters-2026-10-20/projects-desktop.png), [project filters mobile](../qa/task-project-filters-2026-10-20/projects-mobile.png). No existing screenshot baseline targets these controls. Captures remain macOS review evidence; Linux visual gates remain hosted.

Review `/tasks` and `/projects` on localhost3141. Sample-only fixtures: `/visual-regression/tasks?taskWeek=2026-10-19&filterPreview=1` and `/visual-regression/project-directory?view=list`; no fixture data enters real organizations. Port3008 remains untouched. Same branch/PR345; required hosted quality, Caleb's review, merge/deployment and authenticated live acceptance remain pending.

### PR343 review corrections — October20

All three supplied findings confirmed in the inherited code. PR343 is already merged, so corrections continue in open PR345 on the same lane/3141:
- Dragged source cards are inert and non-selectable while the overlay represents the task. Drop and cancellation restore controls; no duplicate keyboard interaction remains available during drag.
- `readTaskViewState` no longer reads the system clock. One client calendar-day hook supplies both the default week and board today/overdue state. SSR and initial hydration render the same calendar loading state; local dates appear after mount. Midnight, focus and visibility refresh the shared local day; explicit URL weeks remain selected until navigation/Today changes them.
- Board mode renders even with zero matching tasks, retaining week navigation, weekends and contextual creation. The standalone empty message applies only to List.

26 focused calendar/view-state/board cases pass, plus four browser regressions for inert drag/drop and focus exclusion, cancellation, empty filtered-board creation/reload, and real SSR hydration in New York on Sunday evening while UTC is Monday. The midnight/focus case verifies Today/current-day state and no hydration diagnostics. Cold fixture hydration initially exceeded generic five-second assertions; browser checks now wait explicitly for restored task controls. Application TypeScript, changed-file lint, structure and route checks pass. Prior unaffected authorization/SQL evidence is reused; no migration or live mutation. Graphify refreshed (21,868 nodes / 62,777 edges).

The access-gated fixture supports `ssr=1` to exercise the actual task page during SSR. [Empty-board review](../qa/tasks-review-2026-10-20/empty-board.png) is macOS evidence; no existing visual baseline targets this state. Required hosted checks, Caleb review, merge/deployment and live acceptance remain pending.

### Task board layout refinement — October20

User rejected the previous card hierarchy and outdated design assumptions. This slice uses the existing production project-card conventions and shared app Button/Input/Badge/Field primitives as its reference, rather than treating the older Geist document's radius/padding examples as prescriptive. Task titles lead with aligned completion controls; project and organization have separate lines; status, tag and assignee share a secondary row. Scheduling, deadline and a compact drag handle occupy a consistent footer. Columns align in height, empty states lose nested dashed boxes, and each day has one contextual add control. Mobile targets remain 44px; desktop controls are compact. No global primitive or prototype edits.

Final source validation: 15 existing board acceptance cases, all 9 task browser journeys, application TypeScript, changed-file lint, structure and raw-button checks pass. Additional sample-only checks open/edit and complete/reopen directly from the board, inspect light/dark/mobile layouts, and verify long content has no page/card overflow at 390/1440/2880px. No browser page errors. Existing authorization, date, persistence and database contracts are unchanged; prior SQL evidence remains valid.

Review images: [desktop](../qa/task-board-layout-2026-10-20/desktop.png), [mobile](../qa/task-board-layout-2026-10-20/mobile.png), [dark](../qa/task-board-layout-2026-10-20/dark.png), [long mobile content](../qa/task-board-layout-2026-10-20/long-content-mobile.png). These are macOS review captures. No existing screenshot baseline covers this board; the repository's Ubuntu-only baseline guard is preserved. Hosted visual/quality checks and Caleb's visual acceptance remain release gates.

Same branch/PR345 and localhost3141; review `/tasks?taskView=board`, or the gated sample fixture `/visual-regression/tasks?taskView=board&taskWeek=2026-10-19`. No migration, live data mutation or deployment;3008 and other lanes remain untouched. Graphify AST refresh completed:21,868 nodes /62,785 edges. Normal pre-push delivery follows; hosted gates remain user-owned.
