# AI credits

Server-only accounting for workspace AI, separate from coaching credits. PostgreSQL owns immutable credit lots/entries and exact reservation allocations. Service functions recheck organization editing membership; session and anonymous callers cannot spend, forge an actor or read private tables.

- Pure pricing and balance calculations: `lib/**`.
- Trusted server API: `index.ts` / `accounting.ts`; never expose actor-accepting helpers as client server actions.
- Authenticated account action: `server/actions.ts`.
- Client-safe usage panel: `client.ts`.

No allowance, subscription binding, product or charge is created automatically. Global policy and wallets default to disabled. Commercial allowances and tariffs remain proposed. Expiring lots are spent before non-expiring purchases. Reservations retain their original lots after expiration. Admission serializes global cost, actor/org concurrency and wallet balances; settlement is idempotent and only debits successful usable artifacts. Cancellation/failed work retains provider cost but charges the customer zero. Terminal provider results are committed as immutable receipts before settlement. Authorized status reads and the separately enabled recovery worker finish interrupted settlements. After 15 minutes, abandoned requests release customer reservations at zero charge. A never-claimed request has zero provider cost; an unknown claimed outcome retains a clearly marked worst-case provider budget hold across days, until a terminal receipt or audited operations resolution confirms cost. Late evidence never retroactively charges a customer. Expired lots retain visible in-flight reservations without becoming spendable.

Recovery route: `/api/internal/cron/workspace-ai-recovery`, protected by `INTERNAL_CRON_SECRET` (or `CRON_SECRET`) and `WORKSPACE_AI_RECOVERY_ENABLED=true`. It recovers at most 100 runs per invocation, independently of the generation kill switch. The configured minute schedule is source configuration only, not a deployed job. `resolve_workspace_ai_cost` is service-only for reviewed provider evidence; it records operator, immutable evidence reference, prior bound and measured cost. No client action exposes it. Unknown cost may exhaust the global budget intentionally; operations must review unresolved runs before activation and monitor them thereafter.

Local SQL evidence: `node supabase/tests/workspace-ai.test.mjs` creates its own disposable PostgreSQL cluster; it never connects to production. Acceptance tests: `tests/acceptance/ai-credits.test.ts`. Canonical phase/status record: `docs/plans/2026-10-22-workspace-ai-plan.md`, section12.


## Credit purchases (disabled until controlled activation)

The existing Usage panel offers owner-only configured credit packs; editor members can consume but cannot purchase. `WORKSPACE_AI_PURCHASES_ENABLED=true`, enabled AI policy/wallet, and explicitly configured enabled `ai_credit_packs` are all required. No catalog entries or billing settings are created by the migration. Pack keys version immutable mode/price/currency/amount/credit terms. Payment methods are card-only; no saved-method consent or auto-refill is implied.

Server actions validate active organization and verified actor. SQL snapshots a bound order before Stripe Checkout; retries reuse the order, fixed expiry and provider idempotency key. Signed webhook handling retrieves current payment and product facts before atomic, replay-safe fulfillment. Success/cancel both return to the workspace without granting credits. Purchase history/balance refresh on focus; pending status polling is bounded. Credits have no expiration and do not depend on renewing a subscription.

`20261022233000_workspace_ai_credit_purchases.sql` is local-only tested. Fulfillment is exported through the public feature root for the existing signed webhook. Do not enable sales before allowance binding, approved commercial/deletion policy and remaining release checks are ready. Those and capped auto-refill remain separate unfinished work under the full sprint; this checkpoint is not billing launch readiness. Evidence: `tests/acceptance/ai-credit-purchases.test.ts`, `tests/browser/workspace-ai/credit-purchases.spec.ts`, and `supabase/tests/workspace-ai-purchases.assertions.sql`.


## Spending limits

Owners can set organization and per-member monthly credit caps in the Usage disclosure. Blank removes the owner-imposed cap;0 pauses new work. Service safety ceilings still apply. Calendar months/reset are UTC. SQL counts actual settled usage in the month plus every pending maximum (including prior-month pending work), serializes cap writes and admission, and preserves already admitted requests when a cap decreases. Document, selection and plan generation share the same enforced path. Changes use expected revisions and immutable operation-keyed audit entries. Members can read their own usage/cap but cannot raise it. The shared authenticated context rejects active-organization changes.

Migration `20261022234500_workspace_ai_spending_limits.sql` is disposable-test-only until separately applied. Evidence: `tests/acceptance/ai-credit-limits.test.ts`, `tests/browser/workspace-ai/credit-limits.spec.ts`, `supabase/tests/workspace-ai-limits.assertions.sql`. This does not activate paid billing or replace remaining capped auto-refill work.


## Payment restrictions

Refund/dispute webhooks reconcile current provider facts before changing private payment restrictions. The immutable adjustment journal preserves provider identity, prior/current state and held/consumed credit snapshots. Admission excludes held lots; prior reservations settle against their original allocations. Replays do not duplicate grants; a reversal before fulfillment binds and holds that later grant. Provider/reconciliation failures leave an event-specific verification hold until successful retry. Partial/consumed refunds remain for explicit policy review, with no automatic debt or replacement charge.

Migration `20261023001500_workspace_ai_payment_restrictions.sql` must be applied before enabling this code; it has only disposable-test evidence. Tests: `ai-credit-payment-restrictions.test.ts`, `workspace-ai-payment-restrictions.assertions.sql`, and the purchase browser scenarios. No real Stripe charge/refund/dispute was created during development.


## Usage history

The existing workspace account menu opens Usage in the composer surface without a selected document or model request. `read_workspace_ai_usage` exposes paginated financial fields only. Owners can filter member/task usage; other eligible members are restricted to themselves. Other members' private source titles/references, all prompts/proposals/source bodies and provider IDs are excluded. Keyset pagination retains timestamp precision and breaks ties by run UUID. Source actions exist only for current-scope mounted document editors, and are unavailable during generation.

`20261023010000_workspace_ai_usage_history.sql` has disposable-test evidence only. Included totals/earliest expiration reflect actual lots; subscription plan/allowance reset metadata awaits explicit billing binding. Usage does not grant credits or activate AI. See the plan checkpoint for tests and remaining release gates.


## Subscription allowances

`WORKSPACE_AI_ALLOWANCES_ENABLED=true` and explicitly configured enabled `ai_credit_allowance_rules` are required. No commercial rows are seeded. Owners assign their verified active monthly subscription to the named organization in Usage. Assignment is immutable; one subscription and one organization cannot silently accumulate duplicate bindings. Reassignment requires a separately reviewed future-period path. Provider reads precede assignment; uncertain grant recovery reuses the assignment and period identity.

The signed invoice.paid handler verifies the current full monthly invoice line and real payment before granting. The line's service period and invoice-payment relationship use the installed Stripe API contract ([invoice line items](https://docs.stripe.com/api/invoice-line-item/object), [invoice payments](https://docs.stripe.com/api/invoice-payment)). SQL serializes immutable grants, rejects period overlap and preserves replayed grants after policy-version changes. No trial/past-due/incomplete, annual, prorated/short, mixed, comped, refunded/disputed or unsupported-discount invoice is credited.

Migration `20261023020000_workspace_ai_subscription_allowances.sql` has disposable-test evidence only. Annual scheduling, prorated/comped entitlements, next-period reassignment, post-grant allowance reversals and deletion policy remain launch gates, along with capped refill. No live Stripe writes are performed by assignment or grant reconciliation.
