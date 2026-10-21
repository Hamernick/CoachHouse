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
