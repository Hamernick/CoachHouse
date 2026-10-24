# Decision editor checkpoint

Continue the approved specialized-editor milestone. Generative UI and performance profiling remain deferred.

1. Reuse the Decision payload and existing inspector draft/save/history path. Add pure helpers for criterion edits/order and stable outcome identity; no new persistence layer or migration.
2. Edit criterion titles and statuses, add/remove/reorder criteria, and bound long lists. Preserve optional linked Particle/resource references on edits. Show a compact checklist on the canvas with progress derived from saved criteria.
3. Edit outcome labels, add/remove/reorder outcomes and explicitly select or clear a result. Keep outcome IDs and handles stable when labels change. Keep the existing 2–12 outcome limits. Choosing a result must never complete criteria or execute work.
4. Block removal of an outcome with connected branches and explain how to disconnect it. Pass current connections from the existing graph; server graph validation remains authoritative for races. Removing an unconnected selected outcome clears its selection in the same draft.
5. Verify schema boundaries, identity, connection safeguards, criterion/selection independence, atomic persistence/inverse, concurrency rejection and read-only/editor/preview controls. Run focused tests, types, lint and repository guards. Present localhost:3008 for user review; browser and visual acceptance remain unverified until reviewed.

## Implemented checkpoint

- Added pure Decision helpers plus modular criteria/outcome editors inside the current inspector. Current graph connections are passed through the existing dock adapter. Preview checkboxes use the same criterion updates as the saved payload; result selection remains separate.
- Existing optional criterion references are preserved; editing those source bindings is not included. No schema, database, transport or dock/window changes.
- 336 tests across 17 focused workspace suites passed. After a TypeScript inference correction for newly added criteria, the final 58-test Decision/UI rerun passed, including one additional control-dispatch test (337 distinct focused tests across the runs). Scoped TypeScript, affected ESLint, boundaries, thresholds, interaction locks, React Grab, workspace surfaces/storage and acceptance-manifest guards passed.
- Port 3008 still belongs to the Particle worktree server. User browser review remains pending; no visual baselines updated. Generative UI and performance profiling remain deferred. Next specialized editors: People, Metric and Finance.
