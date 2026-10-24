# Particle System — initial evaluation

Date: 2026-10-09

## Working lane

- Branch: `feat/particle-system-20261009`.
- Worktree: `/Users/calebhamernick/Development/coach-house-platform-particle-system-20261009`.
- Base: freshly fetched `origin/main`, `0819df5f`.
- Preview: <http://localhost:3008/workspace> (authentication required).
- Product contract: [complete supplied PRD](2026-10-09-coach-house-particle-system-prd.md).
- Expanded interaction contract: [Workspace Engine PRD](2026-10-09-workspace-interaction-generative-ui-prd.md) — layout, selection, controls, images/forms, sharing, tools, and generative UI.
- This checkpoint covers setup and the requested initial evaluation. Particle implementation and PRD acceptance remain open.

## Assessment

The PRD fits the existing workspace, but requires a substantial domain and graph extension. Preserve the current canvas, data owners, authorization, and drawer. Establish persistence and compatibility alongside contracts before completing the eight renderers; treating persistence as a late phase would risk duplicate records and lost edits.

## Verified reuse and gaps

| Area | Existing evidence | Implementation consequence |
| --- | --- | --- |
| Canvas | `workspace-canvas-v2` and React Flow v11; 67 source files reference `reactflow` | Plan a coordinated migration of the existing canvas to `@xyflow/react`; do not put incompatible provider contexts inside one canvas. |
| Layout | `workspace-board-layout-elk.ts`; ELKjs 0.9.3 installed; layered layout already available | Existing helper uses fixed card dimensions and `WORKSPACE_EDGE_SPECS`. Generalize around persisted relationships, measured dimensions, outcome ports, stable ordering, and explicit auto-layout. |
| Shell | `docs/agent/workspace-node-frame-contract.md`; Fiscal Sponsorship panel and existing workspace shells | Build shared Particle anatomy at the workspace shell boundary. Keep graph state and handles in the React Flow adapter, outside clipped content. |
| Drawer | Existing Vaul drawer supports collapsed `68px`, half `0.48`, and full `1` snap points | Extend the same container for typed selection, entry editing, composer, and requested navigation. Preserve existing drawer routes and content. |
| Storage | `organization_workspace_boards.state` JSONB; version-1 board contract; RLS migrations | Investigate a versioned, validated Particle graph extension with backward-compatible reads and operation-based updates. No new tables are assumed necessary yet. |
| Concurrency | `workspace-board-state-write.ts` compares `updated_at` and retries up to four times | Reuse this writer and apply mutations against the latest state. Whole stale graph replacement would still risk overwriting unrelated edits. |
| Existing data | Normalized workspace objective tables and `workspace-objectives` feature; organization, finance, people, calendar, and document owners | Reference canonical records where they exist; distinguish editable Particle configuration from source-owned data. |
| Collaboration | Workspace presence and cursor broadcasts | Preserve these. This inspection does not establish collaborative synchronization of arbitrary graph payload edits; audit that path before claiming multiplayer completeness. |
| Validation and charts | Zod and Recharts already installed | Reuse established validation and chart components; derive progress from records. |
| Historical Particles | `src/features/workspace-particles` exists on `chore/workspace-particles-objectives-20260924`, absent from current main | Review contracts, reference adapters, persistence, and tests selectively. Do not replay the old branch or revive its UI wholesale. |
| AI | Existing `/api/ai/sql` route; no workspace graph generation endpoint identified in this pass | Start with explicit typed create/update/link commands unless a suitable authorized AI path is established. |
| Tests | Existing board-state persistence, layout, connection, drawer, ontology, objectives, and visual suites | Extend these for domain transitions and compatibility; add focused user interaction coverage for the new behavior. |

## Decisions to carry into implementation

1. Introduce the reusable domain feature under `src/features/**`, using the scaffold and public entrypoints. Reconcile historical `workspace-particles` ownership before choosing its final extension boundary.
2. Keep domain records distinct from React Flow rendering types. Define all eight payload schemas, typed handles, edge semantics, graph operations, and undo/redo boundaries together.
3. Prove one persisted edit through the existing authenticated workspace before expanding renderers. Cover deletion cleanup, cross-organization access, stale edits, and preservation of unrelated board fields.
4. Drive ELK with actual edges and measured geometry. Keep manual positions durable; expose auto-layout in the existing dock/action surface.
5. Keep content entries nested inside Calendar. Resolve chronological order versus manual order explicitly, including automatic and unscheduled entries. Never infer publication from scheduled time.
6. Keep existing ontology projections separate from editable Particle domain records. Its semantic-depth positioning and generated details are not the requested editable decision graph.
7. Define feedback loops explicitly, exclude them from dependency-cycle semantics, and route them intentionally. Decision selection changes the result and highlighted branch, not criterion completion.
8. Keep demo loading explicit, deterministic, and isolated from real organization data. Attendance and sponsorship amounts remain labeled targets/proposals.

## Missing reference and scope details

- No Fiscal Sponsorship screenshot accompanied the message. The repository component is a provisional design reference; screenshot fidelity is not verified.
- The PRD includes the example graph but not the full referenced Chicago event-series plan. Detailed content must be sourced before claiming an exact fixture match.
- Current board storage is organization-scoped. The illustrative `workspaceId` must map to the real workspace identity rather than introducing unsupported multiple workspaces per organization.
- The PRD remains the target; this evaluation does not mark any feature acceptance criterion complete.

## Setup validation

- `pnpm install --offline --frozen-lockfile` passed with Node 22; lockfile unchanged.
- Next.js started on port 3008; `/workspace` returned HTTP 307 to `/login?redirect=%2Fworkspace`.
- Graphify queried the root checkout's historical graph; findings were checked against source in the new current-main worktree. The historical graph is navigation evidence, not proof of current implementation.
- Documentation diff checks only; no application code or database changes, application test claims, push, PR, or deployment.

## Next implementation checkpoint

Finish the current-main versus preserved Particle contract comparison, then implement validated graph operations and compatible persistence with one working Particle in the existing canvas. Continue through all eight types, measured layout, integrated inspector/composer, and the PRD acceptance suite.
