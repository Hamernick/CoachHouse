# Workspace support

The existing organization switcher lists memberships and the current temporary
workspace. Explicitly granted staff can search by organization name/slug, owner or
member name/email, including unnamed workspaces. Search uses at least two characters,
ranked twenty-result pages, contact identity and visible totals/errors/retry. Empty
search stays local; selecting an organization creates no membership.

Search uses a same-origin, no-store JSON request outside the server-action queue.
After ten seconds it aborts and shows Retry; changing query/page or closing the
switcher cancels the obsolete request. The endpoint reuses the existing authenticated
search and live support-grant RPC.

## Authorization

`workspace_support_grants` is operator-managed and private. A grant requires an
existing active staff/Auth account. Neither a coach/developer role nor client
metadata automatically grants this feature. Search, selection, reads, writes and
presence recheck the current grant. Policies scope support access to the request's
organization ID; ordinary membership permissions remain unchanged. Fresh verified
staff presence is required by the existing general workspace write policies. Native document text, metadata, hero images, inline images and history use separately authorized server operations with the verified actor; they do not weaken the shared RLS helper or depend on decorative presence.

`WorkspaceOrganizationScope` adds the page's immutable organization ID to
same-origin fetches, including Next server actions, preserving bodies/options and
never sending the scope to external providers. Allowlisted native-document endpoints preserve their explicit organization header so an admin asset dialog can target a different organization; all other calls remain pinned to the tab. The scope header is not a credential.
The proxy overwrites request-method metadata. Unscoped support mutations fail;
revoked explicit targets never silently fall back to another writable workspace.
The existing document pending-change guards run before selection changes the cookie.

The support session keeps the actual staff identity. Organization writes and
support entries/grants have private audit events. Personal OAuth connections and
checkout/billing portal mutations are blocked while supporting another workspace.
No organization-delete, owner-transfer, staff-grant, fiscal-signature or private
internal-note privilege is added. Invites retain existing authorization rules.
Verified assistance may edit free-workspace documents without changing subscriptions
or unlocking paid features for members.

## Presence

Database RPCs bind names and actor IDs to authenticated users. Same-page normalized
cursor coordinates use the existing Cursor component. Presence stays active without
adding support-session banners or a textual viewer/editor roster to the sidebar. Hidden support tabs retain the authorization heartbeat without cursor movement; hidden ordinary-member tabs stop decorative roster reads. Polling uses same-origin HTTP outside the action queue, a five-second deadline, one in-flight request per tab, a five-second baseline and capped thirty-second error backoff with jitter; stale sessions
expire after15seconds and revocation filters them immediately. Presence errors no longer inject a paragraph into navigation. Document cursor availability appears in the document status region without changing persistence or edit access. Legacy cursor
publishing is suppressed for the support actor to avoid duplicate cursors.

## Rollout and tests

Apply20261014190000 and search follow-up20261014203000 only after local SQL/RLS checks. Provision exact verified Auth
IDs through a guarded operator transaction; no accounts are seeded by the migration.
Enable `NEXT_PUBLIC_WORKSPACE_SUPPORT_ENABLED` together with the document collaboration
flag after their migrations. Default is off. Test on actual localhost3124; user owns
interactive review. Required CI and code-owner review still govern merge.

Rollback: disable the flag and revoke support grants; retain audit/history. Existing
membership access remains intact. The focused acceptance tests cover search-list
behavior, cross-tab scoping, denial/revocation and request preservation. The existing
document-activity PostgreSQL runner covers actual support RLS/storage/audit/presence
permissions and ordinary-coach, suspended-user and revoked-staff denials.

The exact presence POST route authenticates and refreshes session cookies in its handler; Proxy does not repeat that Auth request. Cross-origin and anonymous requests still fail before data access. The 5s baseline leaves room for the 5s deadline within the existing 15s authorization lease; that lease and all revocation/RLS checks are unchanged. Focus and reconnect resume polling without overlapping requests or bypassing error backoff. `workspace-presence-budget.test.ts` executes the actual controller effect and verifies at most181 heartbeats in15minutes including its initial request.

Presence is mounted only for `presenceOrganizationId`, derived from the existing
organization-row lookup. An account's onboarding/owner fallback is not proof of
an organization. The heartbeat RPC locks an existing parent key before writing;
`PT404` maps to a terminal unavailable-target response and stops that mounted
client's polling. Switching to another workspace starts a new lifetime. Migration
`20261015190000_workspace_presence_existing_target.sql` must precede deployment.
