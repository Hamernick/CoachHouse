# Workspace AI

Explicit composer assistance for a selected, saved core document. Generated HTML is sanitized, retained as a private proposal, reviewed, then transferred to the existing editor and its revision-checked save path. The feature does not publish documents or write graph state.

- Public browser API: `client.ts` and authenticated `actions.ts`.
- Route adapter: `index.ts` / `routes.ts`; route files remain composition-only.
- Private server context, provider streaming and limits: `server/**`.
- Accounting belongs to `ai-credits`; it reserves before any provider work.
- Existing command/search behavior is free and unchanged.
- `WorkspaceAiComposer` requires the independently supplied current `sourceScope` (user and organization); an optional organization name labels context. Only active, editable core documents in that scope are eligible. The existing retained-tab header activity scope removes hidden editors from the ephemeral registry.
- AI mode pins an unambiguous initial document; with multiple documents, the user chooses. The compact selector can switch or remove context. New mounts, keystrokes and saves never replace an explicit selection. Removed/missing context stays empty, prompts remain in the composer, and reopening can recover the existing per-document request without another generation. Status and cancellation validate the document as well as actor/organization.

Activation requires both `NEXT_PUBLIC_WORKSPACE_AI_ENABLED=true` and server `WORKSPACE_AI_ENABLED=true`, a configured provider key, applied local migrations and an explicitly enabled organization wallet/database policy. Defaults are off. No activation or production migration is authorized by these files.

The proposed rate card is configurable through validated server-only `WORKSPACE_AI_RATE_CARD` JSON (version, model, inputMicrodollarsPerMillion, cachedMicrodollarsPerMillion, outputMicrodollarsPerMillion, microdollarsPerCredit). Run limits also fail closed in PostgreSQL. No arbitrary client model/tariff selection.

OpenAI Responses uses the already-installed SDK with retries disabled and provider storage off. Stop records cancellation durably; the bounded request finishes for accurate usage settlement. Provider request correlation is sent before generation and response IDs are durably recorded before text is forwarded. Terminal receipts survive a settlement crash. The `ai-credits` recovery worker and authorized status reads reconcile saved receipts; aged unknown requests release customer credits while retaining a conservative service-budget hold. Provider retention remains off. Activation also requires the protected recovery schedule/flag and an operations process for unresolved provider cost. See the canonical checkpoint for remaining save/reopen and browser-verification gates.

The existing roadmap action commits the canonical profile and an immutable application receipt together through `commit_workspace_ai_document`. A lost response is recovered by run ID without another generation/write. Original document and organization revisions are checked; newer collaborator edits are preserved. The editor retains typing during a save and keeps AI changes private until acknowledgment. Explicit Revise uses the selected prior proposal in a separately priced run; failed/canceled revisions can recover the earlier draft.

Tests: `tests/acceptance/workspace-ai*.test.ts`, disposable PostgreSQL via `pnpm test:rls:workspace-ai`, and `pnpm test:workspace-ai-browser`. The browser fixture uses real composer/editor components and save hooks with a deterministic simulated server. It validates UI wiring, not live authentication, provider output or database integration. Run its preview with `pnpm exec vite --config tests/browser/workspace-ai/vite.config.ts` at `http://127.0.0.1:3187`; no environment files, provider calls or production data are used. Do not run it alongside the browser suite on the same port. User visual acceptance and authenticated isolated-stack verification remain separate gates.

The server-only `generation.ts` entrypoint lets Objectives reuse provider streaming,
configuration and request bounds. Plans use strict JSON-schema output; documents
retain sanitized HTML proposals. Native OpenAI SDK reuse supersedes the original
AI SDK suggestion; no second chat/provider stack was installed. The model/tariff
remain provisional pending real-provider evaluation. `store: false` is a request
setting, not proof of account-wide retention policy.

Authoritative continuation: `docs/plans/2026-10-22-workspace-ai-plan.md`, section12. This implementation is not release-ready.
