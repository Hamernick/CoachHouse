# Content Calendar editor

Generative UI is deferred by the user. Continue specialized editors, beginning with the existing Calendar Particle; preserve dock/window design and the existing persistence/history system.

1. Reuse the validated nested entry contract. Add pure helpers for defaults, chronological previews, planning order and local-time/UTC conversion. Keep stable entry IDs and one parent Particle mutation.
2. Pass a calendar-entry selection request from the canvas row through the existing Particle selection/dock adapter. Opening another entry in the same Particle keeps the whole unsaved calendar draft. Opening a different Particle retains the existing discard guard.
3. Add modular calendar list and entry fields inside the current inspector. Edit title, channels, content type, manual/automatic delivery, schedule, content, CTA, status, actual publish time, optional public URL and linked Activity. Add/remove/reorder records without leaving the canvas. Paginate the editor list; keep the card preview compact and chronological.
4. Keep drafts local until Save changes. Reuse schema validation, pending/error/stale handling, board authorization and history receipts. Recording publication requires an actual timestamp; no sending/publishing provider is implied. Local time inputs convert to UTC and identify their timezone semantics.
5. Focused tests: entry identity and edits, ordering, timestamp round trips, publication validation, chronological previews, nested-entry selection and one-batch persistence/inverse restoration. Run scoped types/lint/guards. Present on localhost:3008 for user review before visual baselines.

No new tables, parallel data stores, provider integrations, generative work or dock redesign. Other specialized editors follow this checkpoint.

## Implemented checkpoint

- Added pure calendar helpers and modular list/entry/date/preview components. Extracted existing Objective/checklist fields and Particle selection into cohesive modules to stay below repository function-size limits.
- Canvas entry requests carry the nested UUID through the existing selection/dock path. Same-calendar navigation preserves the parent draft; different-Particle navigation still uses the discard guard. Requested entry details receive focus/reveal without the parent stealing it.
- All entry fields are editable; new entries are drafts. Reorder is planning order, while canvas rows remain chronological. Local date inputs convert to UTC and reject invalid/nonexistent local times. Actual publish time is required for Published; save never sends content. Activity references reuse graph validation. Restore handles accidental local removal.
- Verification: 326 focused tests across 16 suites passed, including 13 calendar tests for data/schema, ordering, time round trips, atomic save/inverse, invalid Activity links, specific-entry click dispatch, draft protection, previews, pagination and read-only controls. Scoped TypeScript, affected ESLint and relevant repository guards passed. A follow-up focus adjustment is covered by the final targeted rerun recorded in the runlog.
- User review requested at localhost:3008. Browser/visual/touch review remains user-owned; no baselines updated before acceptance. No database migration or provider/generative integration. Generative UI remains deferred; People/Decision/Metric/Finance editors follow after this checkpoint.
