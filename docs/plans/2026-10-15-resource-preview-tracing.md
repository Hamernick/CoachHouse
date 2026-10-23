# Resource-map local preview tracing

User reported a Next16.2.6/Turbopack build excerpt during fiscal activation. Full supplied heading classifies it as a warning: dynamic path resolution matches10,372project files. A targeted view of the reported deployment confirmed compilation/static pages had progressed; this is not proof of deployment success or a fiscal runtime defect.

## Scope

Original workstream01 stage1/scoped build follow-up. Isolated `fix/resource-preview-tracing-20261015` from main`0fd6b05d`, separate resource-preview-tracing checkout. Change only tracing annotations in `src/lib/queries/resource-map-public-items.ts`, plus handoff records. Preserve production database queries, filters, pagination, local absolute/relative preview semantics, cache invalidation and UI. No new environment flag, broad tracing exclusion, dependency change or provider/data mutation.

Next16.2.6itself uses `/* turbopackIgnore: true */` on runtime path and bare filesystem arguments in `dist/server/image-optimizer.js` and `dist/server/next-server.js`. Mark only the explicit local-preview resolver/stat/read/existence arguments. These files are supplied at runtime on the operator's machine and should not cause the deployed server bundle to include the checkout.

## Checks and handoff

Existing resource-map query and fixture-isolation acceptance: 32 cases pass. Changed-file ESLint, diff hygiene and normal prepush checks pass. Parsed syntax and literal values match main exactly; only comments and whitespace differ. Graphify refreshed (21,228 nodes, 61,112 edges). Local tests validate unchanged preview/public query behavior; the actual Vercel/Turbopack build remains Caleb's verification, not inferred from unit tests. No full quality suite or deployment polling. No server needed for annotation-only changes. Codex stops at an open PR.

Source: https://github.com/vercel/next.js/issues/95125 (bare filesystem argument placement); confirm against the pinned installed Next source rather than assuming all nested expressions honor the annotation. Preserve the shared SHIP ownership blocker and fiscal3127lane.
