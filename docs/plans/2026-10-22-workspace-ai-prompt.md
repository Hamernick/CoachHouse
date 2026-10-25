# Workspace AI — rewritten prompt

Date: 2026-10-22. Planning request; implementation and production changes are separate.

## Before rewriting: the deeper work

1. **What an experienced product/AI/platform team would add:** establish one authoritative owner for curriculum progress, objectives, document versions and financial balances; define the boundary between generated suggestions and approved changes; measure task quality and real cost before promising allowances; design failure, collaboration and recovery alongside the happy path.
2. **Raw material:** the original 186 questions and their answer mappings; stable lesson/step IDs; existing graph operations and revision checks; actual document save contracts; subscription/webhook records and provider usage receipts; original funder notices, eligibility rules and award ranges. Screenshots and older PRDs inform presentation but cannot establish these contracts.
3. **Methods and tools:** repository Graphify plus source inspection; a versioned curriculum manifest; Zod-validated proposals; existing React Flow/ELK and Tiptap/document adapters; AI SDK streaming; atomic PostgreSQL reservations/ledger with RLS; Stripe test-mode event replay; official pricing research; fixture-based factual, cost, concurrency and usability evaluations.
4. **Independent evidence:** curriculum reconciliation with no missing or duplicated questions; grant amounts traced to original sources; SQL races proving no overspend or double credit; cross-organization denial tests; accepted edits surviving save/reopen and concurrent edits; measured cost/latency distributions; representative users completing the intended journeys. Neither a confident model response nor our preference is sufficient proof.

## Rewritten prompt

Plan an integrated AI workspace for Coach House in our existing Next.js App Router, React, TypeScript, Supabase, Stripe, shadcn/ui, React Flow/ELK and Tiptap architecture. Use the preserved `feat/particle-system-20261009` checkout. This is a prompt-and-plan task, not permission to implement, clear boards, apply migrations, change live billing or deploy.

Use the **optimized six-stage version** of `coach-house-accelerator-two-versions-text.md`, retaining all 41 visible lessons, 11 groups, 186 questions, 28 question-list cards and 20 output-list cards. Reconcile its labels with stable source IDs before implementation. Preserve distinctions between direct answer updates, roadmap fields and related topics. Learning order is guidance, not a new access prerequisite.

Make the Accelerator an expandable/collapsible canvas graph using our existing particle frames, navigation windows, graph operations and motion conventions. Keep existing answers, progress, documents, IDs and user layouts safe. Describe how a fresh development board can preview the new graph, and how existing users could later adopt it through a reviewed, reversible presentation change. Do not interpret “clear boards” as a blanket production deletion.

Add AI to the existing ParticleComposer so a user can ask for document help, a decision tree, an objective breakdown or opportunities for a selected resource. Preserve free deterministic commands and ordinary editing. Use visible, editable context selection. AI output must become a typed proposal with **Apply / Revise / Discard**; authorize and check revisions again when applying. Preserve draft/public status and collaboration. No automatic publication, applications, outreach or payments.

Evaluate Vercel AI SDK and selectively reuse `https://github.com/shadcn-ui/chatbot-template`: streaming messages, typed tool results, clarifying questions and source displays are relevant. Inspect exact current dependencies and license. Adapt these patterns to our composer and windows; retain our app shell, Supabase auth/RLS, document editor and billing. Its demo endpoint is not our production authorization or credit system. Keep provider selection separate from SDK choice.

Define an objective-tracker PRD grounded in existing objective records: outcomes, owners, milestones, due dates, status, target/current/unit, evidence and resource/document/lesson links. Reconcile existing relational objectives and particle projections rather than introducing another tracker. Separate lesson completion, task completion and real-world outcomes.

Design opportunity cards using the supplied reference: compact title/summary, provider, geography, eligibility, fit explanation, deadline, source and save/dismiss actions. Each match targets an explicit resource/objective. Always attempt to resolve a useful monetary amount or range from original evidence. Distinguish published awards, sourced estimates, in-kind support, total funding pools and amounts not published. Never fabricate dollars, imply that a fit score is a win probability, or count potential opportunities as secured funds. Describe ingestion, deduplication, stale data, missing facts and explainable matching.

Rename the visible Activity/Activities/Add activity language to Resource/Resources/Add resource in relevant workspace surfaces. Preserve persisted discriminators and IDs initially; do not blindly rename audit “activity” or public resource directories. Explain any necessary future compatibility migration separately.

Define AI credits independently from coaching credits. Cover included paid allowances, usage display, reset behavior, purchases, opt-in auto-refill, member limits, concurrency, reservations, settlement, failed/canceled requests, refunds, renewal and exhaustion. Verify current plan prices and provider rates. Provide transparent workload assumptions, cost calculations, stress cases and proposed pack margins. Distinguish measured evidence from assumptions. Resolve how one payer/subscription funds organizations without multiplying grants when users create workspaces.

Use the six supplied images as design references, not as an instruction to copy ChatGPT prices, plan names, payment methods or weekly limits. Match our compact rounded UI, restrained borders, light/dark/system themes, accessible controls and existing transform-based motion. Show the essential empty, working, partial, failed, unaffordable and stale-conflict states. Keep canvas pan/drag responsive while streaming or expanding.

Depth matters more than additional features. Compare a small number of architecture options, recommend one, and show why it fits. Exclude undefined Instinct/plugin integrations, unrelated acquisition, autonomous background agents, provider applications and broad product redesign.

Use parallel, independently scoped research agents with dedicated goals for architecture, unit economics and curriculum/UX; synthesize contradictions instead of concatenating reports. Deliver Markdown: this rewritten prompt, an evidence-backed product/engineering plan, concise source links, proposed defaults, phased usable slices, acceptance criteria and unresolved decisions. Distinguish local/source evidence, proposed behavior, implementation, migrations and production release.

## Output

The resulting plan is [Workspace AI, Accelerator graphs and credits](2026-10-22-workspace-ai-plan.md).
