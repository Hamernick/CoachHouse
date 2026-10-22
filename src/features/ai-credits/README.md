# AI credits

Server-only accounting for workspace AI, separate from coaching credits. PostgreSQL owns immutable credit lots/entries and exact reservation allocations. Service functions recheck organization editing membership; session and anonymous callers cannot spend, forge an actor or read private tables.

- Pure pricing and balance calculations: `lib/**`.
- Trusted server API: `index.ts` / `accounting.ts`; never expose actor-accepting helpers as client server actions.
- Authenticated account action: `server/actions.ts`.
- Client-safe usage panel: `client.ts`.

No allowance, subscription binding, product or charge is created automatically. Global policy and wallets default to disabled. Commercial allowances and tariffs remain proposed. Expiring lots are spent before non-expiring purchases. Reservations retain their original lots after expiration. Admission serializes global cost, actor/org concurrency and wallet balances; settlement is idempotent and only debits successful usable artifacts. Cancellation/failed work retains provider cost but charges the customer zero. Terminal provider results are committed as immutable receipts before settlement. Authorized status reads and the separately enabled recovery worker finish interrupted settlements. After 15 minutes, abandoned requests release customer reservations at zero charge. A never-claimed request has zero provider cost; an unknown claimed outcome retains a clearly marked worst-case provider budget hold across days, until a terminal receipt or audited operations resolution confirms cost. Late evidence never retroactively charges a customer. Expired lots retain visible in-flight reservations without becoming spendable.

Recovery route: `/api/internal/cron/workspace-ai-recovery`, protected by `INTERNAL_CRON_SECRET` (or `CRON_SECRET`) and `WORKSPACE_AI_RECOVERY_ENABLED=true`. It recovers at most 100 runs per invocation, independently of the generation kill switch. The configured minute schedule is source configuration only, not a deployed job. `resolve_workspace_ai_cost` is service-only for reviewed provider evidence; it records operator, immutable evidence reference, prior bound and measured cost. No client action exposes it. Unknown cost may exhaust the global budget intentionally; operations must review unresolved runs before activation and monitor them thereafter.

Local SQL evidence: `node supabase/tests/workspace-ai.test.mjs` creates its own disposable PostgreSQL cluster; it never connects to production. Acceptance tests: `tests/acceptance/ai-credits.test.ts`. Canonical phase/status record: `docs/plans/2026-10-22-workspace-ai-plan.md`, section12.
