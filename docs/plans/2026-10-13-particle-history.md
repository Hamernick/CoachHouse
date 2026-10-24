# Particle Undo/Redo

Continue the approved infrastructure plan in the existing Particle lane. Performance profiling is deferred at the user's request.

## Scope and sequence

1. Add one bounded, session-local history of confirmed Particle operation receipts. Reuse the existing inverse operations, scoped transport, stable operation IDs and exact-revision writes. Capture creation, saved edits/checklists/decisions, placement, group moves, connections/insertion and layout. Navigation, unsaved text and legacy tool data are outside this history.
2. Track undo/redo at the session commit boundary so all callers participate. Each confirmed batch is one step. Generate redo from the inverse of the confirmed undo. Refresh record preconditions only along a known local history chain; invalidate history on external graph revisions or workspace changes. Failed writes must not consume a step; uncertain replay receipts have no inverse, so safely clear history rather than guess.
3. Replace the independent one-step layout/connection stacks with one pair of actions in the existing canvas help controls. Name the action being undone/redone. Support Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z and Ctrl+Y only in canvas context; preserve native text undo and dialog/menu interactions. No new toolbar, dock styling or animation.
4. Flush queued positions before history changes, reject active drags/layout work, and guard unsaved Particle inspector drafts. Serialize submission and retries. Cap history by entry count and serialized payload budget. Keep unrelated board/tool records unchanged.
5. Test multi-step same-record edits, move/layout reversals, creation/root/connection cleanup, redo invalidation, external changes, failed/replayed writes, bounds and keyboard exclusions. Run focused types/lint and relevant repository guards. Show the user the working checkpoint on localhost:3008; browser/visual review remains user-owned.

## Decisions

Use receipt history instead of graph snapshots: it preserves existing validated mutation semantics and avoids retaining full graphs. Use a conservative external-revision fence instead of rebasing across unknown collaboration edits. This first history is intentionally session-local; refreshing starts a new history while saved data remains persisted.

## Implemented checkpoint

- `particle-history.ts` maintains receipt inverses, fresh preconditions along the known local chain, 50-entry/2 MB limits and external-revision invalidation. No persisted history or full-graph snapshot stack.
- The session records every confirmed mutation and preserves history intent/operation identity through retries. Replay receipts clear history because the server intentionally omits inverse payloads on replay.
- Shared history replaces both one-step stacks. Canvas help has labeled Undo/Redo actions. Canvas-scoped keyboard shortcuts preserve text fields, menus, dialogs and legacy-card handling. Pending positions flush before undo/redo; dirty Particle edits, active gestures, layout and read-only permissions block writes.
- Tests: 309 focused tests across 15 suites, then four additional dirty/layout/drag/read-only guard cases passed (313 distinct tests). Scoped TypeScript, affected ESLint, boundaries, thresholds, React Grab, interaction-lock, workspace-surface/storage and acceptance-manifest checks passed.
- Review requested on localhost:3008. Browser appearance, authenticated reload and gestures are not independently verified. Session history intentionally resets on refresh/external graph changes; persisted operations remain saved. Legacy Organization/Activities/Fiscal Sponsorship data and visibility edits remain outside Particle history. No migration, commit, push or deployment.
