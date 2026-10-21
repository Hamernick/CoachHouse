# Particle workspace performance

> **MVP continuation — 2026-10-16:** Follow the [consolidated 36-step workspace board and sharing plan](2026-10-16-workspace-board-sharing-mvp.md) for current scope, decisions and resume instructions. This document is retained as historical/technical reference; its older next-step order does not override the new plan.

Scope: existing `feat/particle-system-20261009`, localhost 3008. Preserve edits, authorization, saved positions, retained drafts, and other local servers. Browser access remains unavailable; user interactions and existing server logs provide runtime evidence.

## Sequence and checkpoints

1. **Baseline** — distinguish dev compiler RSS/CPU from browser heap and request latency. Record startup, compiled-route size/module count, warm request timings and idle usage. Do not label RSS growth a leak without retention evidence.
2. **Initial code/data loading** — split unopened Documents, Tools, People, Roadmap and Accelerator panels behind stable lazy boundaries. Preserve panel identity after opening. Parallelize independent fiscal/finance reads with Accelerator loading, using existing organization-scoped loaders. Compare emitted initial route modules and regression checks.
3. **Development compiler** — verify available Next versions and worker compatibility; benchmark a compatible Turbopack configuration before selecting it. Keep Webpack fallback. Memory-optimization flags documented only for production builds are not a dev-server fix. Do not disable type checking or raise the heap limit as an optimization.
4. **Idle browser work** — suspend hidden/idle timer ticks and inspect scoped canvas subscriptions. Preserve deadline-based countdown correctness and unsaved drafts. Protect changes with focused tests.
5. **Verification** — focused types/lint/contracts, emitted chunk comparison, server readiness and real route logs where available. Production-build and authenticated browser heap/interaction measurements remain separate gates; report unmeasured outcomes explicitly.

## Initial evidence

- Before restart: Next 16.2.6 Webpack, ~10h uptime, RSS 11,937,188 KB.
- After startup before compilation: RSS 389,796 KB.
- After workspace compilation: RSS 9,341,308 KB; subsequent recompilation sample 12,617,296 KB. These are process RSS, not browser heap.
- Initial workspace dev route chunk: 72,221,741 bytes, 2,861 module definitions, including source maps/development wrappers; not production transfer size. Raw receipt `/tmp/particle-performance-baseline.json`.
- Warm GET /workspace sample: 14.1s total, 29ms Next work, 4.1s proxy, 10.0s application code. No controlled comparison yet.
- Existing source defers mounting unseen retained panels but imports several panel implementations eagerly. Finance and fiscal loading occur after independent Accelerator work.

## References

- https://nextjs.org/docs/app/guides/local-development
- https://nextjs.org/docs/app/guides/memory-usage
- https://nextjs.org/blog/next-16-3#less-memory-usage-in-dev
- https://reactflow.dev/learn/advanced-use/performance
- https://developer.chrome.com/docs/devtools/memory-problems

## Implementation checkpoint — October 13

- Lazy-loaded six dock panel implementations through stable module-level boundaries; existing retained-panel behavior preserves visited editors and drafts. On the same Webpack compiler, initial route output fell from 72,221,741 to 66,790,407 bytes and from 2,861 to 2,614 module definitions. This is development output, not production transfer size.
- Accelerator timeline, fiscal workflow and finance inputs now load concurrently. Workspace content also starts alongside dashboard state rather than waiting for it. All loaders retain request-scoped authorization; no cross-user cache was introduced.
- Workspace analytics now runs through Next.js `after`, with authenticated request values captured during rendering. Redirected or failed content does not schedule the milestone. Five behavioral tests cover concurrency, deferred telemetry, redirects, admins and unauthenticated requests.
- Countdown previews tick once per second while visible and active; hidden retained panels and hidden browser tabs stop ticking. Remaining time is recomputed from the persisted deadline when shown again.
- Upgraded Next and eslint-config-next from 16.2.6 to 16.4.0. Port 3008 uses Turbopack, including its newer default memory eviction. Startup: 1,029ms. Subsequent idle process RSS samples: approximately 4.6–4.9 GB, versus earlier Webpack samples of 9.3–12.6 GB. Workload and observation length differ; this does not establish a leak fix or long-session ceiling.
- Selective production compilation of `/workspace` with Turbopack succeeded (35.1s compilation), including ELK worker imports. This was compile-only mode, not a full production build, runtime worker test or release sign-off.
- Verification: 185 existing focused tests plus five new route-loading tests passed; scoped TypeScript, changed-file ESLint, route contract, import boundaries and threshold checks passed. Browser access remains unavailable.

## Remaining measurement gates

1. Warm reload after the final concurrency change: **GET /workspace 200 in 4.1s** (15ms Next work, 84ms proxy, 4.0s application code), with compilation/checks finished. The user confirmed “Noticeably faster.” This is a single warm sample, not a cold-start benchmark or controlled attribution. The first Turbopack user load took 37.2s (25.1s Next work, 109ms proxy, 12.0s application code) while a production compilation overlapped. Cold startup still needs an uncontended measurement.
2. Existing timed data-loading sample before the final concurrency fix: dashboard state 2.8s, workspace content 5.8s, fiscal workflow 3.7s, Accelerator timeline 3.3s, finance 2.4s. These overlap after the change; do not add them together. Inspect repeated request timings before choosing further query caching or deferred data loading.
3. Confirm Particles, retained editor drafts, timers and Auto-layout in the authenticated UI. Worker compilation does not prove browser worker execution. Browser heap retention, long tasks and pan/drag frame times remain unmeasured.
4. Repeat idle RSS after longer ordinary use. Review the all-card geometry selector only with interaction measurements; existing edge subscriptions already select their own endpoints. No speculative routing rewrite in this pass.

The confirmed warm reload spent 3.71s preparing workspace content, including fiscal workflow 2.08s, Accelerator timeline 1.58s and finance 0.84s (parallel). Dashboard state took 0.96s concurrently. Further latency work should focus on those data loaders; compilation accounted for only 15ms on this reload.

Restart this lane with Node 22 and `pnpm dev --port 3008`; Webpack fallback is `pnpm dev --webpack --port 3008`. Preserve caches for ordinary restarts. Clear `.next` only for a requested clean rebuild or diagnosed stale output; clearing it guarantees another cold compilation.

## Dragging follow-up

User reported uneven Particle dragging after the loading improvement. Source inspection found position-only updates propagating into the dock, recreating all Particle edge objects, and reaching the full card/handle subtree through React Flow position props.

- Kept controlled positions and immediate endpoint tracking in React Flow; the existing serialized position queue still saves final gestures and protects newer moves during in-flight saves.
- Memoized domain session, layout and connection results. Exposed stable control props separately from per-frame node positions. A memoized `WorkspaceParticleDock` receives those control props, preserving editor updates and drafts without repainting for each move.
- Memoized connection arrays, combined flow arrays, handlers, membership and record indexes. Tool visibility changes still invalidate controls; card position changes do not.
- Split the Particle node's position-facing wrapper from its memoized content/handle subtree. Selection, domain data, edit permissions and callbacks still update the content normally.
- Verification: 265 focused tests passed, including selection, queued saves, nearest-handle routing, layout, library and retained content. Scoped TypeScript, changed-file ESLint, import/threshold/React Grab/interaction-lock/workspace-surface checks passed. No browser automation used; user drag review requested. Frame time and actual render counts remain unmeasured.

Reference: https://reactflow.dev/learn/advanced-use/performance (stable components, handlers and data dependencies).

## Next optimization sequence — performance across devices

Targets are acceptance goals, not measured achievements or guarantees for arbitrary hardware/network conditions.

1. Establish production-build interaction baselines on an older phone and an ordinary laptop, with CPU/network throttling as supplemental coverage. Exercise 25, 100 and 250 Particles, dragging, multi-selection, connected-card movement, library search, dock transitions and repeated editor opening. Measure usable-canvas time separately from LCP; record frame duration, long tasks and browser heap. Browser access remains unavailable in this session, so these measurements need an authorized testing path.
2. Profile the geometry observer: it currently scans the node lookup and serializes all geometry on store notifications outside active dragging. Limit work to actual geometry changes and affected connections if traces confirm cost. Preserve live four-side attachment, variable-height measurement, layout cancellation and saved manual positions. Keep offscreen rendering disabled only for bounded measurement/layout operations.
3. Shorten the initial data dependency chain. Fiscal workflow and Accelerator details dominate the last warm sample. Load a useful initial canvas from authorized summaries, then fetch detailed records when needed. Deduplicate request-local reads first; introduce shared caching only with explicit organization/auth scope and mutation invalidation.
4. Bound retained UI costs. Virtualize long library/calendar lists if DOM counts warrant it, defer heavy editors and charts, serve appropriately sized image previews, and reclaim clean inactive editors while retaining dirty drafts safely. Avoid replacing existing state/persistence systems.
5. Profile painting and idle activity. Prefer transform/opacity animation, scope blur to small surfaces, avoid animating filters/large repaints, stop hidden polling/media/animations where appropriate, and keep reduced-motion support. Preserve the established visual design.
6. Add reproducible performance regression checks to existing infrastructure: production bundle budgets, representative interaction traces, repeated open/close heap recovery, and field Web Vitals through existing telemetry where available. Do not enforce hardware-dependent RAM/FPS numbers without a fixed benchmark environment.

Initial goals: 60fps on the agreed baseline device (16.7ms frame budget), immediate local selection/drag feedback, Core Web Vitals at the 75th percentile of LCP <=2.5s / INP <=200ms / CLS <=0.1, and no sustained heap growth over repeated equivalent interaction cycles. INP alone does not measure drag smoothness. Sources: https://web.dev/articles/vitals and https://nextjs.org/docs/app/guides/production-checklist.

## Geometry and data-loading checkpoint

Replaced geometry JSON serialization with an observer-local cache of measured values. It compares absolute positions, dimensions, visibility and handle geometry, including in-place mutations in React Flow's mutable lookup. Selection, content-only changes and lookup iteration order do not invalidate routing. Any active drag suppresses intermediate geometry notifications; drag completion still invalidates routing. Removed cards release their snapshots. This is a derived cache, not a second graph store.

Synthetic comparison on Node 22.13, five alternating rounds, median total milliseconds for 500 notifications, with eight handles per card:

| Cards | Notification workload | Previous | Updated |
| --- | --- | ---: | ---: |
| 25 | Unchanged geometry | 55.747 | 2.031 |
| 100 | Unchanged geometry | 218.159 | 8.335 |
| 250 | Unchanged geometry | 626.451 | 21.484 |
| 25 | Active drag | 0.118 | 0.645 |
| 100 | Active drag | 0.430 | 0.346 |
| 250 | Active drag | 1.046 | 0.837 |

The unchanged-geometry selector improved 26–29x in this microbenchmark. The small active-drag workload is already cheap; the 25-card case regressed by approximately one microsecond per notification. These are synthetic selector timings, not browser FPS, whole-canvas speedups or production-device results. Raw local receipt: `/tmp/particle-geometry-benchmark.json`; harness: `/tmp/particle-geometry-benchmark.cjs`. Ten behavior tests cover geometry changes, in-place mutation, drag boundaries, multiple dragged cards, replacement/removal and observer isolation.

Fiscal summary loading previously awaited seven independent reads sequentially after project authorization and application lookup. Those reads now use one `Promise.all`: three document summaries, required documents, signature packet, events and signing permission. Authorization and the no-application fast path remain gates; error precedence and signing-link filtering are unchanged. Seven tests verify concurrency, denied access, empty applications, signing permissions and error behavior. No shared cache or schema change.

Verification: 272 focused tests passed across Particle behavior and related fiscal summary/review suites; scoped TypeScript, changed-file ESLint, import/threshold guards and acceptance manifest checks passed. Warm user reload requested. Production telemetry already has Vercel Speed Insights with private-route filtering; no duplicate analytics added. Actual production-device frame traces and browser heap tests remain blocked by unavailable browser access.
