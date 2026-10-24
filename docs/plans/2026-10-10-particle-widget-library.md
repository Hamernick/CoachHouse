# Particle widget library — review checkpoint

User references: IMG_3089.PNG and IMG_3090.PNG (rounded widgets and searchable gallery), plus the supplied shadcn composition screenshot. This checkpoint temporarily precedes the React Flow migration and measured Auto-layout work; resume that plan afterward.

## Sequence

1. Reuse existing records. Organization, Activities and Fiscal Sponsorship remain board tools; domain Particles remain validated graph records. Library membership is persistent; canvas placement is reversible presentation, never record deletion.
2. Create a shared shadow-free rounded preview/tile treatment. Use actual data, compact nested content, muted theme surfaces, external labels and subtle placement controls. Responsive CSS columns provide masonry without a layout dependency; DOM/tab order follows each column. Search filters titles/types and workspace tools together.
3. Add organization-scoped native drag payloads with runtime validation, explicit canvas drop coordinates through React Flow, and Add/Remove buttons for keyboard/touch. Reject foreign/malformed payloads and honor view-only/tutorial restrictions.
4. Persist domain Particle placement using an optional backward-compatible payload field and existing authenticated operation writer. Keep hidden connections/positions/data intact; hide only their rendered elements. Existing board tools use board visibility/positions and the existing board save path. Organization becomes removable by explicit user request. Placement must not relayout unrelated cards.
5. Add small corner Remove from canvas controls. Keep existing specialized card actions/editors; preview rendering must not mount duplicate editors or perform data mutations. Preserve the approved dock/window geometry and motion.
6. Verify filtering, actual previews, placement round trips, dropped coordinates, hidden graph relationships, permission gates and persistence preservation. Run focused tests/types/lint. Pause for the user's appearance/interaction review, then resume the provider/layout plan.

## Boundaries

No data deletion, duplicate Organization/Fiscal record, new database table, fabricated results, glass blur/shadow expansion or separate drawer/canvas. Desktop native drag has keyboard/touch Add alternatives. Browser access remains denied until explicitly changed; unit/SSR evidence is not visual or authenticated save/reload acceptance.


## Implemented checkpoint

- Shared `particle-library-tile.tsx` and `particle-frame.tsx`: content-driven rounded 28px surfaces, no shadow, actual type-specific previews, external labels, On canvas indication, explicit Add/Remove buttons and restrained corner removal controls. `particle-library.tsx` now uses responsive CSS columns and a compact rounded search input; both tools and domain records use case-insensitive word matching. Preview bodies are inert and do not mount duplicate editors.
- `workspace-tool-library.tsx` adapts the existing Organization, Activities/programs and Fiscal Sponsorship records. `use-workspace-particle-library.ts` connects them to canvas drop coordinates and board controls. Legacy card content/actions are retained with the rounded, shadow-free canvas treatment. Other legacy shortcut destinations remain untouched pending their own library integration.
- `particle-placement.ts` validates workspace-scoped native drag payloads, produces reversible graph placement updates and filters rendered connections to visible endpoints. Domain `canvasHidden` is optional for existing records; positions, nested data and connections are retained. Existing authenticated put operations save changes. Position writes are flushed first, then placement reads the latest confirmed graph revision.
- `workspace-board-tool-placement.ts` performs explicit board-tool visibility/position changes without cascading or relayout. Prop wiring spans board canvas/body/flow surface and canvas v2 types/view. An optional `visibility.organizationHiddenExplicitly` intent marker preserves deliberate library removal while retaining legacy fixed-root recovery. Normalization and unrelated visibility actions preserve that intent. No database migration or separate data store.
- `workspace-particle-library.test.ts` exercises scoped/malformed drops, hide/restore serialization, retained checklist/connection data, locked positions, legacy normalization, unrelated-card position preservation, subsequent visibility changes, search, actual preview markup and read-only/touch-keyboard action alternatives. Acceptance manifest updated.
- 137 focused tests across nine suites pass. Scoped TypeScript and changed-file ESLint pass; import, React Grab ownership, workspace storage and interaction-lock boundaries pass. Initial integration found missing intermediate prop wiring and eight legacy root-recovery regressions; fixed by preserving legacy behavior behind explicit library intent. No existing root-recovery test was weakened. Diff hygiene passes.
- Preview: `/workspace?drawer=particles` on port 3008 in the isolated Particle worktree. User review: filter the gallery, drag an item onto exposed canvas, use Add on touch/keyboard, remove through a corner minus or library button, then reload and restore. Review both themes and narrow/wide windows. No browser or authenticated save/reload verification: prior access denial remains active. Visual baselines are unchanged.
- This is the requested library/design checkpoint, not completion of all Particle PRDs. Touch drag gestures use Add/Remove alternatives; graph provider migration, measured ELK worker/Auto-layout, history, connections and full editors remain next. Return to the infrastructure plan after this review.

## Review correction — shared canvas cards

- Removed the library-only Organization, Activities and Fiscal Sponsorship summaries and the extra Card/CardContent wrapper. Gallery entries now use `WorkspaceBoardCard` with the same complete card data lookup as the canvas, including hidden tools. Preview interaction is inert and canvas action requests/tutorial controls are cleared. Restored the original shared shell styling on those canvas cards rather than overriding their radius in the node wrapper.
- Extracted `ParticleCard` from the React Flow adapter so domain cards also share one presentation in both places. React Flow handles and measurement remain canvas-only.
- Available entries render first in responsive 320px masonry columns. On-canvas entries render afterward in a separate group of minimal dashed rows, without mounting previews or exposing another drag source. Existing Remove/Open actions remain accessible. Removal preserves records and connections.
- Removed the repeated heading/count and library creation menu; retained search, errors/retry and read-only feedback. Creation remains in the existing composer actions. Added distinct React Grab ownership for previews and placeholders.
- 138 focused tests across nine suites pass, including a throwing preview fixture proving placed previews never mount, available-before-placed order, placement preservation and access controls. Browser review and visual baselines remain pending under the existing browser-access denial.
- Scoped TypeScript, changed-file ESLint, import-boundary and React Grab ownership checks pass; diff hygiene passes.

- Follow-up interaction correction: library titles and previews do not open editors. Removed the selection callback entirely; labels are plain text and placement remains through drag/Add/Remove. Canvas inspection remains unchanged. This supersedes the library Open actions described above.
