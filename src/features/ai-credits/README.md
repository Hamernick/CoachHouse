# AI credits

Server-only accounting for workspace AI, separate from coaching credits. PostgreSQL owns immutable credit lots/entries and exact reservation allocations. Service functions recheck organization editing membership; session and anonymous callers cannot spend, forge an actor or read private tables.

- Pure pricing and balance calculations: `lib/**`.
- Trusted server API: `index.ts` / `accounting.ts`; never expose actor-accepting helpers as client server actions.
- Authenticated account action: `server/actions.ts`.
- Client-safe usage panel: `client.ts`.

No allowance, subscription binding, product or charge is created automatically. Global policy and wallets default to disabled. Commercial allowances and tariffs remain proposed. Expiring lots are spent before non-expiring purchases. Reservations retain their original lots after expiration. Admission serializes global cost, actor/org concurrency and wallet balances; settlement is idempotent and only debits successful usable artifacts. Cancellation/failed work retains provider cost but charges the customer zero. Unknown cost holds the reservation for reconciliation.

Local SQL evidence: `node supabase/tests/workspace-ai.test.mjs` creates its own disposable PostgreSQL cluster; it never connects to production. Acceptance tests: `tests/acceptance/ai-credits.test.ts`. Canonical phase/status record: `docs/plans/2026-10-22-workspace-ai-plan.md`, section12.
