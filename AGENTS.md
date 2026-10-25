# AGENTS.md — Coach House LMS

Canonical agent contract for this repo. Keep this file short; details live in `/docs/agent/**`.

## Non-Negotiables

- Source of truth: this file + linked `docs/agent/**` documents.
- Original workstream plans: use the restored directory supplied through `--plans-root`, or default to `~/Desktop/Coach House Codex Workstreams` (resolved under the current user's home; see `docs/shipping/plans.json`). Before selecting or implementing work, read that directory's `WORKSTREAMS.md`, then the relevant numbered `.md` packet in full (original requests, stages, decisions and checkpoint). Read its `SHIP.md` for current runner/claim location, including when this checkout predates SHIP. Missing files in the selected root are a blocker: recover the originals; never substitute a reconstructed plan or infer unfinished work from checkboxes.
- Continuation protocol: after this file, read `docs/RUNLOG.md`, then the latest dated entries in its linked current monthly log, then `docs/agent/open-work-index.md`, following the [Agent protocol](docs/RUNLOG.md#agent-protocol) before the worktree checkpoint and lane selection. `docs/agent/HANDOFF.md` is deprecated and not authoritative.
- SHIP: read [docs/SHIP.md](docs/SHIP.md), inspect the shared record and resolve any active claim before selecting work.
- New-chat branch checkpoint: before writing files in the first turn of every chat, follow the mandatory worktree report and branch-choice protocol in `docs/agent/workflow-quality.md` unless the user's prompt already chose the branch strategy.
- Implement changes in `src/**`, `app/**`, `migrations/**`, or `docs/**`.
- Keep PRs small. Required CI merge checks include: `pnpm lint`, `pnpm test:snapshots`, `pnpm test:acceptance`, `pnpm test:rls`.
- Required CI merge guardrails include: `pnpm check:structure`, `pnpm check:routes`, `pnpm check:features`, `pnpm check:feature-scaffold`, `pnpm check:thresholds`, `pnpm check:boundaries`, `pnpm check:workspace-storage`, `pnpm check:interaction-locks`, `pnpm check:react-grab`, `pnpm check:workspace-surfaces`, `pnpm check:raw-buttons`.
- Build for Next.js App Router, RSC-first, mobile-first, shadcn/ui, dark/light/system.
- Enforce security defaults: RLS on all tables, server-side authz, webhook signature verification, Stripe idempotency via `event_id`, HTML sanitization.
- Store timestamps in UTC (`TIMESTAMPTZ`) and render locale-aware date/time/currency.
- Append each ad-hoc/Codex session summary to the current monthly log linked from `docs/RUNLOG.md`; never append to the index or an archive.

## Default Codex Mode (UI/Feature/Product)

- Default delivery ends at an open PR: implement the requested scope, run focused local checks and normal pre-push hooks, then commit, push and open the PR. Caleb owns hosted CI/check review, required review coordination, merge, deployment and production verification. Do not monitor or poll those stages, merge, deploy, or run production verification unless explicitly asked. Report the PR link, local evidence and known blockers, then stop; this handoff does not waive required merge gates.
- Treat UI, feature, and product-development requests as implementation tasks by default (not brainstorming-only) unless the user explicitly asks for planning only.
- For new feature work, start from `pnpm scaffold:feature <kebab-name>` and implement inside `src/features/**`; keep `src/app/**` route files composition-only.
- For UI changes, use existing shadcn/ui primitives and shared patterns; avoid one-off controls where system primitives already exist.
- For public resource-map work, prioritize current provider directories and real service diversity; use deterministic source-specific extraction by default, never require a model key or add an admin surface unless explicitly requested, keep raw API links private, expose provider websites, and report exact field-complete and verified/publishable counts. Never mix synthetic seeds or the raw candidate intake queue into `/find`, including admin sessions; local review requires an explicit curated preview file. Treat Wikidata/entity catalogs as discovery evidence, not public resources, until provider evidence establishes a specific actionable service.
- Ship only after the required GitHub `quality` check passes for the current PR revision with branch-protection requirements satisfied. During development, run focused checks covering the changed behavior. Run the complete local `pnpm check:quality` suite only when explicitly requested or needed to diagnose a specific CI failure.
- If visuals intentionally changed, update visual baselines with `pnpm test:visual:update` and include the rationale in the current monthly log linked from `docs/RUNLOG.md`.

## Product Review And Browser Testing

- The user is the primary tester for appearance and interactive product behavior. Present the working app early: reuse the correct preview, provide direct route links, and give a short list of changed behaviors to try. Open the preview when browser access is authorized.
- Treat the user's explicit review results as validation evidence. Do not repeat passed manual checks unless later changes invalidate them or concrete contradictory evidence appears.
- Use Playwright purposefully: reproduce reported bugs, inspect behavior the user cannot readily observe, and protect important regressions. Before running it, identify the specific question it will answer.
- Do not automatically run broad browser journeys, viewport matrices, screenshot collections, or repeated click-throughs for a small change. Use the smallest check that resolves the remaining uncertainty.
- Reuse existing fixtures and tests. Add coverage for meaningful uncovered risks; do not expand testing infrastructure as incidental feature work.
- Complete user appearance review before updating affected visual references. Batch changes before required CI; reuse valid prior results.
- Human review does not replace required security tests, authorization/RLS checks, secret scanning, required CI, or branch protection.
- While waiting for user review, complete independent scoped work. Report decisions and blockers briefly; avoid repetitive polling updates.

## Quick Commands

- Install: `pnpm install`; hooks: `pnpm setup:hooks`; dev: `pnpm dev`; build/start: `pnpm build && pnpm start`.

## Detailed Contracts

- Product scope, routes, UX flows, acceptance, backlog: `docs/agent/product-scope.md`
- Architecture, data model, RLS, security, observability, integrations: `docs/agent/architecture-security.md`
- Workflow, QA, CI/CD, git/PR, file layout, tooling: `docs/agent/workflow-quality.md`
- Code structure, naming, ownership, decomposition limits: `docs/agent/code-structure.md`
- UI quality rubric (MUST/SHOULD/NEVER): `docs/agent/ui-rubric.md`
- Prompt templates for deterministic execution: `docs/agent/codex-execution-playbook.md`
- Active unshipped work index: `docs/agent/open-work-index.md`
- External engineering references for guardrails: `docs/agent/engineering-sources.md`
- Workspace presentation operations checklist: `docs/agent/workspace-presentation-runbook.md`
- Workspace canvas node shell anatomy and React Flow boundary: `docs/agent/workspace-node-frame-contract.md`
- React Grab pasted-component ownership workflow: `docs/agent/react-grab-execution-contract.md`
- Public resource source verification, AI enrichment, review, and publication gates: `docs/agent/resource-map-enrichment.md`
- Local Graphify build, scope, query, and update workflow: `docs/agent/graphify.md`

## Existing Supporting Docs

- Overview: `docs/OVERVIEW.md`
- Schema: `docs/DB_SCHEMA.md`
- Next.js runbook: `docs/NEXTJS_RUNBOOK.md`
- Codex runbook: `docs/CODEX_RUNBOOK.md`

## graphify

This project uses a local knowledge graph at `graphify-out/`. Follow `docs/agent/graphify.md` when it is missing or stale.

When the user types `$graphify`, use the installed Graphify skill and repository runbook before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- This repository approves full-root extraction after `.graphifyignore`; do not narrow the corpus to one source subdirectory because of Graphify's generic size warning.
- Local graphify-out/ changes are expected after incremental updates; graph output is ignored by Git and is not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
