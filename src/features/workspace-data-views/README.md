# Saved workspace data views

This feature owns view settings and revisions. Projects remain canonical in `organization_projects`; workspace-created/imported tables own one row store reused by any number of views. Particle widgets store only a view ID. No live public projection is registered.

Qualified manual adapters:
- Ordinary workspace projects: current source access/paywall; guest fiscal projects excluded. Only status is editable through the existing revision-checked project transition.
- Workspace tables: existing standard board audience (owner/admin/staff edit, other members read), without a new subscription gate. Declared text, number, boolean, date and selection cells; technical identities and revisions are protected.
- Native form responses: existing response access only, including separately invited readers/correctors. Saved views retain the source version and query current canonical answers; correction uses the existing validated, revision-checked form writer. Organization ownership alone grants no response access.
- CSV: explicit bounded copy, visible audience and filename/row-count provenance, atomic validation and request-receipt retry. Original files remain unchanged.

The authenticated RPC derives `auth.uid()`, locks the existing authority facts, checks source scope, applies typed bounded filtering/order/pagination, and joins all writes to organization closure. Four new stores have RLS, private API ACLs and closure triggers, including privileged writes. Receipts are immutable. Authorized read-only access retains the fixed closure export window without edit controls. Source edits use row revisions independently from view configuration revisions. Unknown results retry the identical request; stale cell and settings drafts require explicit review before a new revision is used.

The focused editor is reached through the Particle Data view preset. It supports create/import/select an existing table, configure visible columns/filter/order, save/reload, edit permitted cells and add owned rows. Hidden columns never define authorization.

Verification: `workspace-data-views.test.ts` uses the explicit local `ORGANIZATION_CLOSURE_TEST_DATABASE_URL`; `workspace-data-views-browser.test.ts` runs the real React interaction against that disposable SQL fixture through a fixed synthetic owner bridge. The bridge is test-only, not production authentication proof. `supabase/tests/workspace-data-views-fixture.sql` includes scoped real migrations, actual paid-workspace helper bodies and inherited synthetic prerequisites; it is not hosted full-chain acceptance.

Remaining S09 adapters and release acceptance: linked Google Sheets with current execution identity/capability/concurrency qualification, explicit narrower table grants and scoped support qualification where needed, hosted migration/CI/authenticated-browser verification. No generic AI dataset command, formulas, bulk edits, public live query, universal sync or closure controls are introduced.

Native qualification: `workspace-response-data-views.test.ts` exercises the actual SQL source authority, canonical correction service, stale revisions, invitations/revocation, closure export reads and independent sessions. `workspace-response-data-views-browser.test.ts` uses the real React editor and SQL-backed canonical service through a fixed test identity, including explicit stale-draft recovery, focus, reload, mobile overflow and denied-access clearing. The native fixture remains scoped local evidence; hosted auth, migration and provider gates are separate.
