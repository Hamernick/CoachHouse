# Workspace Objectives Feature

## Ownership
- Domain logic: `src/features/workspace-objectives/lib/**`
- Server actions/queries: `src/features/workspace-objectives/server/**`
- UI components: `src/features/workspace-objectives/components/**`

## Rules
- Keep route files in `src/app/**` as composition-only wrappers over this feature.
- Import other features only through their public entrypoint (`@/features/<name>`).
- Keep `lib/**` pure: no React, no UI imports, no route imports.
- Keep `server/**` free of UI/component imports.
- Keep shared UI in `src/components/ui/**`; avoid one-off primitives here.
- Keep acceptance coverage in `tests/acceptance/workspace-objectives.test.ts`.
- Add acceptance tests for user-visible behavior before merging.

## Scope
- Source objective data from normalized workspace objective tables.
- Fallback read path from legacy `organization_workspace_boards.state.tracker` during migration window.
- Provide server actions for objective load/create/status updates.

## Canvas Objectives island

`@/features/workspace-objectives/client` exposes `ObjectivesIsland`. It receives the
current actor/organization scope and edit permission, and sits at the canvas top
center. Expand to load existing objectives, create a custom objective, edit its
title/details/status, and inspect saved steps. Custom steps can be completed here;
source-managed objectives and steps remain controlled by their lesson/document.

Server actions authenticate the actor and active organization independently of
client scope. Updates constrain organization, custom ownership and expected
`updated_at`; stale edits keep their original baseline instead of silently
rebasing on Refresh. A refresh failure after acknowledgment does not retry a
successful create. Collapsing retains drafts; changing actor/organization resets
the entire boundary. Existing tables and RLS are reused; no new migration is
needed for this initial UI slice.

## Editable plans and canvas projection

Custom objectives can own multiple plans. Each plan stores membership and labeled
connections over canonical objective-step IDs; sharing a step never copies its title
or completion. The list and existing React Flow canvas use the same action/data
owner. Explicit connections and shared steps expand related plans; unrelated plans
remain separate trees. ELK lays out projected plan nodes beside existing cards;
projection IDs never enter manual canvas mutation handlers. The tree opens the same
plan editor and completion action as the checklist.

`20261022150000_workspace_objective_plans.sql` is additive and pending approval for
shared environments. Authenticated RPCs enforce organization membership/write roles,
custom source ownership, plan revisions and canonical step baselines in one
transaction. Direct table access is denied. Invalid connections, cycles or stale
steps roll back the whole edit. Missing RPCs leave the existing island usable.

The plan editor keeps its opening revision, confirms discard and preserves input on
conflict. It edits names, steps/status, explicit decisions and labeled outcomes.
`20261022160000_workspace_plan_decisions.sql` adds revision-checked, per-plan choices.
Both checklist and tree let users select an outcome or return to Needs information.
Chosen branches propagate through related plans; unchosen/waiting actions stay saved
but do not count toward progress. Converging branches use OR semantics. Completing
an action never chooses an outcome. Decision choices are plan-specific; shared action
steps retain canonical completion. Older clients preserve choices and cannot leave
invalid outcomes. Before the v2 RPC is available, decision controls stay unavailable.
Automatic evidence-based decision evaluation remains unfinished. Browser fixture `/?objectives` is
fictional and simulates persistence. The disposable PostgreSQL suite verifies real
permissions, transactions and concurrent writers independently; authenticated
Next/Supabase browser integration remains a release gate.

## Reviewed AI plans

Custom objectives expose Plan with AI behind the existing AI flag. The server checks
canonical objective scope/revision before reserving credits in the existing ledger.
The shared OpenAI Responses adapter requests strict JSON-schema output; independent
domain validation rejects broken references, duplicate outcomes and cycles. Server
IDs bind private proposals to their objective. New steps are todo, choices unselected.

Review exposes assumptions, questions and synchronized checklist/tree previews.
Revise creates a separately quoted private proposal. Apply uses the canonical plan
writer and private receipt atomically; replays never duplicate the plan. Undo only
removes untouched, unshared generated work. Scoped run IDs recover lost responses;
failed revisions can restore the prior proposal after reload. Closing never applies.

`20261022170000_workspace_ai_plans.sql` and both plan migrations remain local-only.
No second wallet or graph store. AI quality/model selection, authenticated runtime
and user visual acceptance remain unproven. The browser fixture simulates generation
and persistence without provider calls or production data.
