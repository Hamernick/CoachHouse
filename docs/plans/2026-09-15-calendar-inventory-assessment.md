# Calendar inventory assessment — September 15, 2026

## Product direction

Keep one switch: on starts setup/resumes synchronization; off pauses. Workspace Tools is central management. Private selected-calendar display and optional board export to a Coach House-created calendar remain the saved implementation. Mobile Calendar belongs in the sidebar. Production activation remains held; Google branding/data-access approval was already confirmed September14 and was not repeated.

## Saved source and readiness

- #237 remains open/draft on main at31b317b7, clean/synced. Hosted static/acceptance/RLS/build pass; quality fails on two390px Calendar setup screenshots (light/dark), with54 visual tests passing. Run34875383952.
- Current focused Calendar, Calendar service and Workspace Tools tests:24/24 pass. No source changes in this review.
- All23 Calendar feature files are absent from the Profile #239 checkout. Root localhost has22 identical to #237; its dialog omits the extra text-left header class. Do not mistake Profile Preview readiness for Calendar integration readiness.
- Other Calendar-touched source differs on root in the app-shell Calendar action and schema index. Root's app-shell action includes the approved sidebar placement, a44px close button and drawer description; #237 lacks those later mobile changes. Preserve them when composing Calendar with final Mobile work. Shared schema additions also need deliberate integration.

## Visual and live evidence

Reviewed the two saved390px actual/expected pairs: differences are the title/email alignment. Form controls, selection rows, optional export and actions remain intact. This is a screenshot alignment failure, not evidence of broken OAuth/sync. References were not changed in the Calendar branch during this review; first reconcile the intended combined mobile source.

Bandto localhost390px: Menu → sidebar Calendar → Workspace calendar drawer opens with a visible close button above the sidebar. Existing connection reports “Sync on”; September15 shows zero events for that day. No connection/switch/settings/save/manual-sync/export/disconnect actions were taken. Calendar close and sidebar close were exercised; viewport restored. Existing local connection state is not proof of production activation or a newly exercised import/export canary.

## Configuration and release limits

Google approval, deployed enable flag/credentials/scheduler, migration history, source deployment, and an authorized live canary remain distinct. No provider configuration was inspected or changed here, no OAuth flow repeated, and no migration proposed or pushed. The prior handoff records the Calendar migration already applied. Inspect history before any future migration work.

Assessment complete; release still requires mobile/Calendar composition, the two screenshot references and full quality, plus separately authorized production activation/canary. Next inventory feature: saved resource acquisition work (#231), followed by remaining Documents scope.

Evidence: `/tmp/coach-house-calendar-31b317b7-visual.log`, `/tmp/coach-house-calendar-31b317b7-visual`, and the earlier preserved `/tmp/coach-house-calendar-ci-visual` actual/expected pairs. Marketplace work remains on #239 and localhost; no Calendar commit or push.

## September15 — Mobile integration follow-up

Draft#237 now contains c8162050 plus documentation-only95bd6614. Calendar uses the mobile sidebar and desktop header, retains its existing overlay lifecycle/date selection, and has the approved44px mobile close control/description. Shared Dialog/Sheet primitives match approved Mobile ec0b73d4 and root byte-for-byte. Root's sidebar condition now covers eligible mobile routes beyond the map; its other local shell changes are preserved. Profile and Mobile draft heads were not changed.

The two390px setup references now reflect approved Mobile padding, left-aligned headings, corner treatment and close targets.33 focused tests, scoped lint, interaction-lock/React Grab checks and four targeted browser cases pass on existing localhost. Bandto nested sidebar → Calendar → setup → close flows work without connection/settings changes. Full source/evidence rationale: [QA](../qa/calendar-mobile-integration-20260915.md).

The independently merged branding PR created a monthly-log-only conflict that initially prevented Actions from starting.95bd6614 preserves all published entries while separating their insertion positions. No branch merge, rebase or force-push was used. Existing local session notes remain uncommitted. GitHub reports the draft mergeable; exact-head CI35036477104 is running. This checkpoint supersedes the earlier31b317b7 source/visual status but does not claim hosted quality or production release.

## Final hosted quality — 6ce80db6

Full CI35036908856 passes static, acceptance, RLS, build/performance, visual and aggregate quality at6ce80db6. The prior run passed54 visuals and exposed two platform text-rendering differences; reviewed Linux counterparts now retain both platforms' references at the unchanged2% threshold. Calendar/mobile integration and the two visual failures are closed within this source-validation scope. Draft#237 remains open and saved on GitHub; its source is synced, with local session logs intentionally uncommitted. Root localhost carries the same Calendar controls, dialog primitives and regression references. Production activation, final cross-PR release composition and authorized live provider canaries remain separate.


## Final hosted result

Commit `6ce80db6`: [CI35036908856](https://github.com/Hamernick/coach-house-lms/actions/runs/35036908856) passes every quality lane.55 browser cases passed first attempt; one full-page390px light Calendar comparison passed on retry. The repaired setup references pass. The retry's actual/diff was not uploaded by the successful job, so its cause remains unverified. Both Preview deployments are Ready. Draft#237 remains open; production activation and release are held.
