# Organization forms

Private form-draft contracts and a controlled question builder, embedded in the existing workspace Particle editor. Source: `docs/plans/2026-10-14-workspace-framed-editors-and-forms.md`.

`index.ts` exposes pure Zod contracts and editing helpers. `client.ts` exposes `OrganizationFormBuilder`. The host owns authorization, draft persistence, conflicts, history and pending state. A Form Activity widget persists only the private definition through the existing graph writer. Responses must never be stored in board JSON.

Drafts permit unfinished questions. Publication has a separate validator for meaningful labels and unique, nonempty choice options. Stable question UUIDs survive reorder/type changes. Editing is local until the host's explicit Add/Save; no added polling, request on keystroke or independent store.

Six initial question types: short answer, paragraph, email, number, single choice and multiple choice. Add inserts at the top; rows expand to edit, reorder or remove. Existing shadcn controls, semantic tokens, keyboard access, reduced-motion-safe opacity/translation and touch targets are reused.

Preview rehearses those questions using component-local answers and explicit validation. Switching back to editing discards rehearsal answers only. Changes to the definition reset the preview. The host Particle form is never submitted by preview text-entry shortcuts, and native email validity cannot block Add/Save. No network or persistent storage is involved.

`form-version.ts` builds strict detached, deeply readonly snapshots and version records. Choice IDs are scoped to the immutable version and question; they are not identities across edits/publications. `form-answers.ts` validates bounded typed answers and exact form/version bindings. The future server must still enforce authorization, immutable versions, revocation, idempotency and request-body limits transactionally. These pure contracts do not publish or accept submissions.

Public publishing, response acceptance/storage, response tables/export and Google Sheets synchronization are not implemented. The server-action file intentionally exposes no endpoint until those contracts and database permissions exist. No pretend share URL/provider connection or submission success is shown.

Tests: `tests/acceptance/organization-forms.test.ts` covers contracts, edit transitions, graph persistence/inverse, readonly rendering and the shared CSV preview. `organization-form-preview.test.ts` covers version isolation, answer validation, numeric draft conversion and preview markup. User-owned interactive and appearance review remains required.
