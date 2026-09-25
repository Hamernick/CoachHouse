# AGENTS.md — Coach House LMS

Canonical agent contract for this repo. Keep this file short; details live in `/docs/agent/**`.

## Non-Negotiables

- Source of truth: this file + linked `docs/agent/**` documents.
- Continuation protocol: follow the [Agent protocol](docs/RUNLOG.md#agent-protocol), including the current monthly entries and `docs/agent/open-work-index.md`, before the worktree checkpoint and lane selection. `docs/agent/HANDOFF.md` is deprecated and not authoritative.
- New-chat branch checkpoint: before writing files in the first turn of every chat, follow the mandatory worktree report and branch-choice protocol in `docs/agent/workflow-quality.md` unless the user's prompt already chose the branch strategy.
- Implement changes in `src/**`, `app/**`, `migrations/**`, or `docs/**`.
- Keep PRs small. Required CI merge checks include: `pnpm lint`, `pnpm test:snapshots`, `pnpm test:acceptance`, `pnpm test:rls`.
- Required CI merge guardrails include: `pnpm check:structure`, `pnpm check:routes`, `pnpm check:features`, `pnpm check:feature-scaffold`, `pnpm check:thresholds`, `pnpm check:boundaries`, `pnpm check:workspace-storage`, `pnpm check:interaction-locks`, `pnpm check:react-grab`, `pnpm check:workspace-surfaces`, `pnpm check:raw-buttons`.
- Build for Next.js App Router, RSC-first, mobile-first, shadcn/ui, dark/light/system.
- Enforce security defaults: RLS on all tables, server-side authz, webhook signature verification, Stripe idempotency via `event_id`, HTML sanitization.
- Store timestamps in UTC (`TIMESTAMPTZ`) and render locale-aware date/time/currency.
- Append each ad-hoc/Codex session summary to the current monthly log linked from `docs/RUNLOG.md`; never append to the index or an archive.

## Default Codex Mode (UI/Feature/Product)

- Treat UI, feature, and product-development requests as implementation tasks by default (not brainstorming-only) unless the user explicitly asks for planning only.
- For new feature work, start from `pnpm scaffold:feature <kebab-name>` and implement inside `src/features/**`; keep `src/app/**` route files composition-only.
- For UI changes, use existing shadcn/ui primitives and shared patterns; avoid one-off controls where system primitives already exist.
- For public resource-map work, prioritize current provider directories and real service diversity; use deterministic source-specific extraction by default, never require a model key or add an admin surface unless explicitly requested, keep raw API links private, expose provider websites, and report exact field-complete and verified/publishable counts. Never mix synthetic seeds or the raw candidate intake queue into `/find`, including admin sessions; local review requires an explicit curated preview file. Treat Wikidata/entity catalogs as discovery evidence, not public resources, until provider evidence establishes a specific actionable service.
- Ship only after the required GitHub `quality` check passes for the current PR revision with branch-protection requirements satisfied. During development, run focused checks covering the changed behavior. Run the complete local `pnpm check:quality` suite only when explicitly requested or needed to diagnose a specific CI failure.
- If visuals intentionally changed, update visual baselines with `pnpm test:visual:update` and include the rationale in the current monthly log linked from `docs/RUNLOG.md`.

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
