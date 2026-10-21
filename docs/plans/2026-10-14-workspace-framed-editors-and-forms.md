# Workspace framed editors and organization forms

> **MVP continuation — 2026-10-16:** Follow the [consolidated 36-step workspace board and sharing plan](2026-10-16-workspace-board-sharing-mvp.md) for current scope, decisions and resume instructions. This document is retained as historical/technical reference; its older next-step order does not override the new plan.

## Product intent

Use the supplied muted, bordered, 32px-radius inner frame for Particle configuration. Keep an explicit Add action above the scroll area. Inputs should feel like compact editable pills/rows, with gentle surfaces and restrained chrome. The fiscal workbench supplies visual references for soft pills, dashed dividers and expandable rows; its radio semantics and fiscal backend are not a general form builder.

Continue in the existing Particle lane and localhost:3008. Preserve the authorized graph writer, multiplayer state, version checks, history, drag previews and unrelated dirty work. No global shadcn reset or global Field/Input restyle.

## Checkpoint 1 — Editor surface (implemented; appearance review pending)

- Keep Motion form and existing draft identity/retry/dirty-close behavior.
- Add shadcn ScrollArea as one bounded scrolling inner frame: 12px outer inset, 12px padding, 32px radius, muted background and subtle border. Add/Back and the preset title belong in the workspace window header through the shared `ParticleEditorHeader`; only standalone editors use an inline header. The submit button explicitly targets the editor form ID.
- Library display switches belong to the browsing library's header portal only. Remove that portal during preset editing; retained-panel activity also suppresses it when a canvas inspector or another tab is active. Preserve the chosen library view when returning from an editor.
- Use an editable title with an accessible hidden label. Make description an optional expanded field instead of a permanently large empty box.
- Use compact property rows and pill-shaped controls. Maintain desktop 32px and touch 44px action targets, keyboard focus and 16px mobile input text. Preserve the larger description when expanded.
- Keep the actual Particle renderer as the preview; do not fork a decorative imitation. Configuration fields now live inside that card through editorFields, above its interactive content, instead of in a separate left column. Header Add/Back stay in the window.
- Remove generic Status from utility widget inspectors and omit an empty task checklist for those widgets. Existing populated checklists and persisted statuses are preserved.

## Checkpoint 2 — Private form drafts (implemented; interaction review pending)

- Scaffold `organization-forms`; expose pure contracts through its root entrypoint and controlled UI through its client entrypoint.
- Add one reusable Form preset. Its Activity widget stores a validated private definition within the existing graph, using the same authorization, Save, conflict and Undo/Redo operations. No responses belong in board JSON.
- Questions have stable UUIDs and ordered array positions; order changes never change identity. Initial cap: 50 questions, 50 options per choice, 240 characters per question/option.
- Support short answer, paragraph, email, number, single choice and multiple choice.
- Add question inserts at the top and expands its editor. Use compact expandable rows, dashed dividers, editable question labels, a type pill, Required and contextual reorder/remove controls.
- Incomplete private drafts may be saved. A separate publication validator rejects empty questions, empty/duplicate options or choice sets with fewer than two distinct options.
- No fake Share/Drive controls, public URLs, response totals or successful submission receipts. The prototype explicitly states its capability boundary.

## Checkpoint 3 — CSV display (implemented; appearance review pending)

- Retain existing file loading, UTF-8/CSV parsing in the worker, preview limits and truncation messages.
- Replace the raw table with a reusable shadcn Table view: optional first-row headings, column/row counts, headings on every page and 5-row compact / 40-row expanded pagination.
- Preserve duplicate/blank headings, ragged columns, literal text and leading zeros. Allow switching off heading interpretation. React escapes cell text; cells are never injected as HTML.
- This is a file preview, not response storage or a new CSV editing/import backend.

## Decision tree for the remaining form feature

### Checkpoint 4 — Version contracts and local rehearsal (implemented; user interaction review pending)

- The controlled builder has a Preview / Edit questions toggle. Preview uses the same draft definition, permits trying all six answer types, and checks required/type/choice constraints on explicit Check answers. Inline errors identify questions and focus the first invalid field. Enter in a text input and Command/Control+Enter in a textarea check the preview without submitting the outer Particle form.
- Preview answers are component-local and never enter the definition, graph history, Documents, server actions or a provider. Switching back to editing discards rehearsal answers only; the controlled definition remains. A definition change remounts the rehearsal to prevent answers from being reinterpreted after an option reorder/type change. Preview does not validate on each keystroke or issue requests.
- Added strict, detached, deeply readonly snapshot/version contracts. Question UUIDs remain stable. Choice IDs are intentionally scoped to `(version ID, question ID, option ID)`; they are positional only inside an immutable snapshot, never a cross-version identity. A new publication must create a new version/column mapping, including after option reordering. No mutation or migration of existing private graph definitions is required.
- Shared answer validation rejects unknown/repeated question IDs, duplicate/unknown choices, incorrect types, invalid email, nonfinite numbers, oversized fields, too many answers and aggregate text above 50,000 characters. Submission validation binds a receipt UUID to the exact form/version. These are pure validation contracts, not authorization, deduplication, acceptance, database immutability or revocation enforcement.
- Independent review found that native email validity inside the preview could block the enclosing Particle Add/Save. Rehearsal email fields now use text inputs with email keyboard/autocomplete and the shared explicit validator; outer form validation is unchanged.
- Storage choice is still pending. Dedicated tables/RLS, accepted receipts, publication transactions, anonymous anti-abuse, provider adapters and public routes are not implemented. Existing draft authorization/conflicts/Undo remain on the graph writer.

### A. Choose response ownership

**Awaiting preference:** Coach House with an optional linked Google Sheet, or Drive-only storage.

Recommended: keep form definitions, immutable published versions and accepted response receipts in dedicated organization-scoped Supabase tables; use a linked Sheet as an explicit synchronized destination. This permits reliable acceptance during provider outages. Drive-only requires a separately defined acceptance/outage/retention contract; do not silently fall back to durable Coach House response storage.

Proceed with draft UI independently. Do not create a competing response store in localStorage or board JSON.

### B. Define and test publishing before building a public endpoint

1. Add organization-owned forms, immutable versions and response records with forced RLS and explicit member/editor permissions.
2. Publish snapshots a validated saved draft, its title/description and stable question/option identities. Preserve previous versions with their responses.
3. Decide edits after publication: create a new published version; never reinterpret old answer columns after a rename, reorder or type change.
4. Publish/revoke/republish are explicit authorized operations. Revocation prevents subsequent submission acceptance; concurrent publish/submit must have a transactionally defined outcome.
5. A hidden/removed canvas card does not implicitly delete a form or its responses. Archiving the form is separate and reversible.
6. Verify organization boundaries, role changes, stale writes, empty drafts, publication races and version preservation in database tests. Review migration/rollback and apply to the verified intended environment before exposing the UI.

### C. Public sharing and submissions

1. Thin App Router composition route over feature-owned public renderer; expose only the published form projection, never board state, member identity or response records.
2. Use an unguessable revocable share capability with only a hash stored server-side. Copy/Share appears only after a real publish receipt exists.
3. Validate bounded request size, current publication, required fields, exact question IDs, allowed choice IDs and field lengths server-side. Add rate limiting and existing anti-abuse infrastructure as appropriate for anonymous intake.
4. Use a client-generated submission UUID and an idempotency constraint scoped to the form/version. Retries return the same receipt rather than inserting twice.
5. Keep completion feedback tied to confirmed acceptance. Retain the draft after transient failures; do not show success for a pending provider write.
6. Public visitors cannot query, enumerate or modify prior responses. Add cross-organization, revoked-link, replay, forged-field and concurrency acceptance/RLS tests.

### D. Private response table and CSV

1. Load only the selected form/version and one bounded response page (cursor pagination); use stable column IDs behind displayed question labels.
2. Reuse shadcn table styling and bounded row rendering. Avoid loading all responses to count, filter or export them in the browser.
3. CSV export preserves quoting/newlines/Unicode and neutralizes spreadsheet formula execution. Choose stable metadata columns for response ID, published version and UTC submission time.
4. Store generated exports/references in Documents through existing file infrastructure; do not manufacture document URLs or duplicate response records.

### E. Google Drive/Sheets adapter

The current Drive feature provides OAuth, Picker-selected attachments, thumbnails and document imports. It does not implement Sheets creation, range updates, form-response export or writeback.

1. Reuse the existing connection/token owner and per-file authorization. Verify Sheets API configuration and access to the explicitly selected/app-created destination. Existing `drive.file` scope is accepted by Sheets; do not request broader scopes automatically. [Google scopes](https://developers.google.com/workspace/sheets/api/scopes).
2. Separate the custom Coach House public form from native Google Forms. A linked Sheet destination does not mean Google Forms was created.
3. Explicitly create/select one destination Sheet and freeze response column mapping for each published version. Use RAW cell values and bounded batch writes. [Sheets append API](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets.values/append).
4. Export only after accepted submissions or an explicit sync operation. No provider requests while typing, dragging, resizing or merely rendering. No constant polling.
5. Maintain bounded outbox jobs/leases and durable receipts. An ambiguous append timeout must be reconciled before retrying; no blind duplicate append or unbounded full-Sheet scans. Expose queued/failed/confirmed destination status accurately.
6. Define Sheet edits before promising bidirectional synchronization: immutable submission receipts versus editable response cells, deletions, schema changes, conflict handling and version mapping. Initially refresh only on open/focus/manual refresh; add provider notifications only with verified lifecycle/renewal handling.
7. Disconnect/revoke and provider failures preserve accepted responses according to the chosen storage contract. Test token expiry, missing destination, lost write permission, throttling and ambiguous writes without real customer data.

## Review and continuation

Review localhost:3008/workspace: configure a preset, expand description, add a Form, add/edit/reorder questions, save/reopen/Undo/Redo, then view a CSV in compact/fullscreen modes. User owns appearance/authenticated product review. Static/component tests do not establish visual or multi-user browser correctness. Public sharing and Sheets integration are the next separate implementation milestone, not completed by this prototype.

## File ownership

- `src/features/workspace-particles/components/particle-preset-editor.tsx` and `particle-editor.module.css`: framed preset editor and shared compact editor controls.
- `src/features/organization-forms/**`: pure contracts/edit transitions and controlled question UI; no active public/server endpoint.
- `src/features/workspace-particles/lib/particle-widget-schema.ts`, `particle-presets.ts`, `particle-event.ts`: form payload/preset and immutable creation-receipt comparison.
- `src/features/workspace-particles/components/particle-widget-fields.tsx`, `particle-widget-preview.tsx`, `particle-preset-icons.ts`, `particle-work-fields.tsx`, `particle-inspector.tsx`: reuse within canvas/inspector and utility metadata filtering.
- `src/components/workspace/workspace-file-table.tsx` and `particle-document-preview.tsx`: paginated CSV presentation over the existing worker result.
- Existing acceptance tests/manifest plus `tests/acceptance/organization-forms.test.ts`: domain, state, rendering and integration checks.
