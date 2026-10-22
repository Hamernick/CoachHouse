# Workspace AI

Explicit composer assistance for a selected, saved core document. Generated HTML is sanitized, retained as a private proposal, reviewed, then transferred to the existing editor and its revision-checked save path. The feature does not publish documents or write graph state.

- Public browser API: `client.ts` and authenticated `actions.ts`.
- Route adapter: `index.ts` / `routes.ts`; route files remain composition-only.
- Private server context, provider streaming and limits: `server/**`.
- Accounting belongs to `ai-credits`; it reserves before any provider work.
- Existing command/search behavior is free and unchanged.

Activation requires both `NEXT_PUBLIC_WORKSPACE_AI_ENABLED=true` and server `WORKSPACE_AI_ENABLED=true`, a configured provider key, applied local migrations and an explicitly enabled organization wallet/database policy. Defaults are off. No activation or production migration is authorized by these files.

The proposed rate card is configurable through validated server-only `WORKSPACE_AI_RATE_CARD` JSON (version, model, inputMicrodollarsPerMillion, cachedMicrodollarsPerMillion, outputMicrodollarsPerMillion, microdollarsPerCredit). Run limits also fail closed in PostgreSQL. No arbitrary client model/tariff selection.

OpenAI Responses uses the already-installed SDK with retries disabled and provider storage off. Stop records cancellation durably; the bounded request finishes for accurate usage settlement. A process crash/unknown provider outcome retains the reservation. A complete reconciliation worker remains required before activation.

Tests: `tests/acceptance/workspace-ai*.test.ts`. Authoritative continuation: `docs/plans/2026-10-22-workspace-ai-plan.md`, section12. This initial implementation is not release-ready.
