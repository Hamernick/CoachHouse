# Workspace presence requires a persisted organization

## Evidence and cause

Caleb selected this follow-up after confirming PR320 merged/deployed. Read-only
production logs for October15,15:00UTC through the investigation window returned
60 violations of `workspace_support_presence_org_id_fkey`, all referencing one
account ID, between15:58:27 and15:59:50UTC (11:58–11:59EDT). This is a bounded
historical sample, not evidence that the errors remain active now.

A read-only identity check confirmed that ID exists in Auth, belongs to a coach,
has no organization row and has zero organization memberships. No identity,
organization, grant or customer-content mutation was performed.

The causal path is:

1. `src/lib/organization/active-org.ts` deliberately falls back to the user's ID
   as an owner scope, including before a personal organization is created.
2. The accessible-organizations loader likewise retains a “My organization”
   fallback for navigation/onboarding.
3. Dashboard state mounted workspace presence using that scope without checking
   whether the already-fetched organization row existed.
4. The scoped fetch header matched the fallback ID. The granted coach satisfied
   `workspace_supports_org`, which checks the grant/header, not target existence.
5. `sync_workspace_support_presence` attempted to insert the fallback ID into
   its organization foreign key. Its generic error response caused retries.

The foreign key correctly rejected the invalid reference. Do not remove it or
create a fake organization to silence the error.

## Correction

- Dashboard state derives `presenceOrganizationId` from the existing successful
  organization-row lookup. Both layout placements and the member header mount
  presence only for that verified ID. Keep the switcher, onboarding fallback,
  request scoping and support search available. No new per-heartbeat lookup.
- Migration `20261015190000_workspace_presence_existing_target.sql` checks and
  locks the parent organization key inside the existing authenticated RPC before
  cleanup/upsert. Missing/deleted targets raise `PT404`; the key lock prevents
  concurrent deletion from racing the insert. Existing authorization, grants,
  foreign keys, expiry and tenant isolation remain enforced.
- The action maps only `PT404` to `organization_unavailable`, `retryable:false`.
  The client stops network polling for that mounted target, including focus/
  reconnect events. A new organization/path lifetime can try again. Transient
  backend failures retain their existing capped retries. Errors stay in the
  existing presence channel; no new banner or page-blocking UI.

## Validation and handoff

- 41 focused tests across5files passed. Changed-file ESLint, structure, routes,
  features, boundaries, thresholds and acceptance-manifest checks passed. Full
  TypeScript still reports56 existing test diagnostics; no source or new-case
  diagnostics. This is not a complete typecheck pass.
- Focused tests cover fallback versus verified presence rendering, ordinary and
  support targets, terminal response classification, transient recovery, stopped
  target polling, a subsequent valid switch, handler auth and HTTP deadlines.
- Disposable PostgreSQL tests cover account-without-organization, nonexistent
  target, deletion after a successful heartbeat/cascade, valid support heartbeat,
  selected-tenant writes, cross-tenant denial, grant revocation and private tables.
- The broader `org-switching.test.ts` has an existing source-string assertion
  expecting individual `revalidatePath(...)` calls; main uses a loop. That
  unchanged assertion fails independently of this correction and is not repaired
  in this PR.
- Apply the migration before deploying the application changes. No production
  migration was applied by the agent. Caleb owns migration/release, hosted checks
  and production verification. Refresh old tabs to load the new client behavior.
- Verify a coach without a personal organization retains the switcher without
  heartbeat traffic; selecting a real organization restores presence and editing.
  Compare fresh logs for absence of the FK error and persistent terminal retries.
- Application rollback may restore unnecessary polling, but retaining this
  migration continues protecting target integrity. Do not drop presence data or
  relax constraints as rollback.

Protocol reference: [PostgREST custom SQLSTATE errors](https://docs.postgrest.org/en/stable/references/errors.html#raise-errors-with-http-status-codes).
