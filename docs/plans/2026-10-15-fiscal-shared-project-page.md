# Restore the existing project page for fiscal applications

Original workstream03 stages3/6. Caleb rejected the unsolicited custom guest project layout. Use the existing project header, tabs, metadata and panels. Fiscal review belongs inside its existing Fiscal Sponsorship tab. Keep application/account state and fiscal actions; do not add another wrapper, badges, overview card, demo fixture or visual-regression page.

Reuse fiscal-completion checkout and actual localhost3127 on fix/fiscal-shared-project-page-20261015, stacked on PR328's typed RPC fix (e1bba393). The generic source is MemberWorkspaceProjectDetailPage. The previous project-detail-loader returned a special state and the route rendered FiscalGuestProjectReview; remove that alternate page renderer.

## Boundaries

- Reviewer authorization stays bound to the signed-in actor. Revoked, failed, malformed or indeterminate access never falls back to host data. Preserve the existing second authenticated application lookup before loading project details.
- Adapt only the applicant's own name/project data to the shared page contract. Do not load the fiscal host's organization summary, members, profiles, programs, coaches, billing or coaching credits. No organization/profile creation or publication.
- Shared task/note/link/asset/overview reads remain filtered by exact project and organization IDs. Fiscal activity uses exact project ID instead of the ordinary organization's broad program/document/file activity clause. Refresh enforces the same rule.
- The existing folder library permits authorized reviewers to read project-owned files, with editing off and all host-wide organization/core/policy/Drive sources excluded. Project-asset GETs permit that reviewer read; writes remain denied. No new storage/RLS policy or grant.
- Ordinary project mutations remain denied for fiscal intake. The existing application review actions remain in the fiscal workbench. Guest agreement/tax signing limitations are unchanged; no silent expansion of permissions or new editing controls.
- Ordinary organization/project routes keep their current loaders, actions and UI. Reuse the existing task-record type rather than exceed the loader line limit.

## Verification and handoff

109 focused tests across shared page loading, tab placement, fiscal review/isolation, folder reads/writes, project activity and asset integrity pass. Added checks for no host loaders/member enumeration, exact project scope, denied/revoked reads, mismatched identity, failed second authorization and unchanged write denial. An older folder fixture mocked only the old boolean helper; replaced that bypass with a realistic RPC result so its existing ordinary cases exercise authorization.

Feature/import/threshold checks and changed-file ESLint pass; Exact Next.js production type check passes after final code changes (3,924 input/10,412 total files, zero warnings); final prepush/Graphify checkpoint follows in the runlog. Actual localhost project route returns its expected unauthenticated307. Caleb owns authenticated appearance/interaction review on the real app; no synthetic data, broad browser sweep, screenshot baseline or visual fixture introduced. No complete production-build or deployment claim.

Existing migrations20261015200000/20261015210000 remain applied and independently verified; do not replay. No production schema/data/email/provider/env changes in this correction. The separate staff-email queue pending with zero attempts and missing reviewer labels in admin filters remain open; Vercel API env lookup returned403. Shared SHIP40 ownership hold/other lanes remain unchanged. Caleb owns hosted gates/review/merge/deployment.


## PR329 review and conflict repair — 2026-10-15

Merged origin/main8508183c into the existing PR branch after its base changed to main. Both conflicts were documentation-only; retained the fiscal correction checkpoint and current main history. Expected draft/workflow failures now return fiscal-review-unavailable and the existing route renders Empty with “Application unavailable” and the safe refresh message. Denied access still returns not-found; no host or child data is loaded on recovery. No alternate project layout restored.

33 focused tests across four suites pass, including both draft/workflow failures, loader recovery, actual /projects/[id] recovery rendering and denied-access behavior. Corrected the ordinary activity-refresh expectation to include projectOnly:false; fiscal refresh remains project-only. Updated the acceptance manifest for the new route test. Scoped lint, threshold and manifest checks pass.

Inspected the user-reported failed CI run38809158112 once. The activity expectation was this branch's failure. Three other acceptance failures (workspace-finance, org-switching and fiscal-sponsorship-authenticated-routes) also occur on base main db768a1b in run38802937918. Nine of ten visual failures also occur there (editor interactions, Find detail and Workspace Tools); the additional mobile-shell failure is not diagnosed here. Build compilation/type checking succeeded on329, but /admin is3101.6KB against1000KB; its cause remains unconfirmed because the earlier main build stopped at the now-fixed RPC type error. These are remaining merge blockers, not passing checks. Per workflow-quality, do not change unrelated feature behavior, budgets or visual baselines in this fiscal correction. No new CI polling, production migration/provider/mail change, or deployment. Caleb owns hosted rerun/review/release.

Graphify refresh completed:21,383nodes/61,461edges; ignored graph artifacts only.
