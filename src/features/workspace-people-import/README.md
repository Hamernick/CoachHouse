# People: schema, sources and imports

## User flow

Choose **Add → Import contacts**, drop CSV/vCard into People, or paste spreadsheet rows outside an editor. Paste opens a reviewable input with a header checkbox; headerless rows receive generated column names so the first contact is retained. File/paste use the same column mapping, validation, matching and server save.

Optional fields stay behind **Add field** in the contact editor and column mapper: organization, location, website, timezone, relationship stage and next follow-up. Sources stay collapsed in the editor. Contact phone and extra fields participate in People search.

## Contract v1

`src/lib/people/contact-schema.ts` is the runtime contract. `OrgPerson` is inferred from `contactRecordSchema`; `contactCoreSchema` is shared by editor/import validation. `contactJsonSchema()` exports JSON Schema with `$id: urn:coach-house:contact:v1`. The custom `iana-timezone` format is validated through Intl; consumers of exported JSON Schema must register that format. Follow-up is an ISO date (no invented time); provenance timestamps are UTC ISO datetimes.

- Existing contact IDs and core fields remain compatible. Legacy records may omit metadata; old facts are never assigned invented sources or verification.
- Optional `details` is a strict typed object, not arbitrary unvalidated JSON. Add a field to the schema and field registry together, then cover parsing, persistence, AI exposure and privacy.
- `contactMetadata` contains `schemaVersion: 1`, revision, update time, optional creation/archive time and per-field provenance for core import fields and CRM details.
- Each tracked source records manual/CSV/vCard/paste kind, bounded label, server timestamp/actor, optional import batch ID and `verification: unverified`. Imports and manual entry do not verify factual accuracy. Older untracked fields remain unknown.
- Metadata is authored by server actions, not accepted from editor payloads. Editor saves check an expected tracked-contact revision when supplied. These application source records are not a tamper-proof audit ledger; current organization profile JSON remains governed by its existing permissions.
- This checkpoint retains `organizations.profile.org_people` and the existing revision-checked writer. Dedicated contact tables, normalized provider identities/multiple addresses, field-level authorization and a full cross-writer audit ledger remain a separate migration. No live schema/provider changes were made.

## Imports and undo

- At most500 contacts/1MB per file or paste,128 unique CSV columns. UTF-8 vCard3.0/4.0 supports the existing primary name/email/phone/title extraction; encoded2.1 is rejected. CSV/paste can also map typed CRM details. Secondary addresses, photos and notes are not imported.
- Automatic matches use normalized email or phone plus name. Same-name/multiple strong matches require a choice. New imports add contacts or fill blank fields, preserving existing values, roles, tags and other profile fields.
- Import receipts are committed atomically with contacts in `profile.people_import_history`. Receipts store bounded deltas/fingerprints, not uploaded files or complete spreadsheet contents. Up to5 receipts within7 days are offered for Undo; a1MB aggregate budget may retain fewer. Expired receipts are pruned on subsequent imports, not by a background deletion job.
- Client batch IDs support safe retries. A completed batch cannot run again after Undo; a deliberate new import gets a new ID. Contact matching prevents duplicate creation on retries.
- Undo archives unchanged contacts created/restored by that import. It retains the backing record/ID so existing references are not destroyed. A deliberately repeated import can restore an archived contact.
- For enriched contacts, Undo restores only fields whose value and source batch still match. Later edits, even values edited away and back, are preserved. Already-undone requests have no further effect. Undo is not global rollback, permanent deletion, or a general-purpose archive browser.
- The contact editor, import and Undo use existing organization edit authorization. History listing requires editing access. All updates recompute from the latest profile in the existing CAS retry loop. Other organization fields and concurrent import receipts are retained.

## Visibility and AI

Archived records are excluded from active workspace/member lists, counts, public organization people, document person choices, the People API and AI contact discovery. Reference resolution retains backing IDs. Public profiles still use their existing explicit field allowlist: CRM details, source metadata, email and phone are not added to public output. Choosing staff/board categories still warns about existing public profile behavior.

The existing permission-scoped AI contact reader now includes typed details and field source kind/label/date/verification. It excludes source actor IDs from model content and continues treating retrieved content as data. No broader AI runtime, outbound actions, consent or provider activation is included.

## Contact sync boundary

The approved direction is **one-way into People**: add new contacts, fill blanks, preserve Coach House edits, review conflicts, never write back to Google/Outlook or automatically propagate provider deletions. Google and Outlook connectors are not connected in this checkpoint. Existing Drive/Calendar scopes do not grant contact access; provider-specific consent, encrypted tokens, identities/cursors, bounds and revocation handling remain future work.

## Verification

Focused tests cover schema export/validation, legacy compatibility, paste/header handling, matching, provenance, exact retries, persistent undo, later-edit protection, archive restoration, organization permissions, atomic history/contact CAS retries and AI source projection. Browser drag/drop, paste, editor/undo save-reload and focus acceptance require an authenticated preview session and remain separate from automated checks.
