# Particle size families

Implement the supplied Particle Sizing System specification in the existing Particle lane. Canvas units: 192px cell, 16px gap; Small 192×192, Medium 400×192, Large 400×400, Extra large 816×400. These are product tokens, not Apple physical dimensions.

## Steps
1. Shared size tokens, typed support/defaults per registry entry and runtime validation. Persist one optional domain `Particle.size`; React Flow keeps this under `data.particle.size`, preserving existing `type` and payload contracts. Existing records without size retain their width/content height. No forced migration.
2. One native `NodeResizeControl`, bottom-right curved affordance, 44px auto-scaled target, visible on selected editable cards. Live nearest-family label; 24 canvas-unit minimum gesture; fixed top-left; Escape cancels; unsupported families rejected. No neighbor movement or auto-layout.
3. Commit only on release through the existing revision-checked graph action/history path. Keep native dimensions transient. One 150ms ease-out snap in controlled React Flow state keeps rails aligned; no snap animation for reduced motion. Failed/conflicting changes restore saved dimensions.
4. Replace size menu options with supported family names. Use existing edit/view permissions; view keeps content interactive and hides editing affordances.
5. Shared container-query frame and size-dependent summaries/record limits. Document cards fill their selected frame. Photo cards use width presets (192/280/400/816px), deriving height from the original aspect ratio plus the 36px title strip and frame borders; photos never crop or letterbox. Both retain existing full-screen access. Long content scrolls, never scales to fit.
6. Focused schema, snapping, migration, history and component tests; TypeScript/lint and boundaries. User owns visual review. No new resizing dependency, table, parallel state store, or generative UI.

References: [React Flow NodeResizeControl](https://reactflow.dev/api-reference/components/node-resize-control), [Apple WidgetFamily](https://developer.apple.com/documentation/widgetkit/widgetfamily/).

## Implementation checkpoint

Shared families, registry layout policies, native resize control, release-only persistence/history, semantic previews and compatibility adapter are implemented for registered Particle types. Existing Organization and Fiscal Sponsorship tool cards use another node contract and retain their current sizing. No new database tables/migration.

340 Particle tests pass, including ten sizing tests; source/guardrail checks pass. User visual/touch/zoom review is still open. The existing content-driven cards are deliberately not bulk-converted.

## Photo fit correction

User review found fixed family rectangles letterboxed uploaded images. Photos now derive their complete canvas geometry from intrinsic dimensions at each width preset, including legacy saved widths. Removed the old portrait/panorama aspect-ratio clamp. The native resize control changes photo width; shared geometry derives height during drag, nearest-family selection and the existing 150ms snap. React Flow rails receive the same derived dimensions. No intermediate persistence, data migration, new sizing store or change to other Particle families.

Focused validation: 37 sizing/image/document tests passed, including uncapped portrait/panorama rendering, all photo families, native resize geometry and legacy width compatibility. ESLint and threshold checks passed. TypeScript and final graph refresh recorded in the monthly log. User retains visual review on localhost:3008/workspace.
