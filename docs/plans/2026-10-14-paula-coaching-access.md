# Paula Coaching access

Direct user request, October 14: show Paula the existing Coaching sidebar control and allow `/coaching`. This is a bounded account-access follow-up to workstream 03 stage 1, not a reopening of coaching credits or the other account/billing work.

- Isolated branch: `fix/paula-coaching-access-20261014`.
- Worktree: `coach-house-platform-paula-coaching-20261014`.
- Base: `2c29cdd36268aa87170754d1668a82d43e92e269`.
- Preserve other coaches' route restrictions and Paula's existing staff/profile roles, memberships, credits and billing behavior.

## Implementation

Use the administrator-controlled Auth `app_metadata.coaching_access === true` permission. Read it only from the server-verified `getUser()` result, never user-editable `user_metadata`. Pass the boolean through dashboard/admin layouts to the existing sidebar. The Proxy permits only the `/coaching` path segment and descendants for a granted coach. The page repeats the check before loading booking data or processing checkout returns. No schema migration or new UI is needed.

Supabase documents [administrator metadata updates](https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid) and [verified user retrieval](https://supabase.com/docs/reference/javascript/auth-getuser).

## Account operation

Verified Paula's exact Auth/profile identity and active `coach` staff record. Applied only `app_metadata.coaching_access=true` and independently reread it. Existing app metadata, user metadata, profile and complete staff record were preserved. Private before/after receipt:
`~/.local/share/coach-house/account-access/2026-10-14-paula-coaching.json` (mode 0600).

The grant is saved in production Auth, but application release is still required. Do not claim the production sidebar or route works before this code is deployed and verified.

Rollback: revoke the single `coaching_access` app metadata key through the Auth Admin API, preserving unrelated metadata. Both Proxy and page use current Auth state, so no JWT-refresh delay is required on the next request. Code rollback leaves the dormant grant without broader role access.

## Validation and continuation

87 focused cases pass: platform capability/path rules, actual Proxy execution, rendered sidebar visibility, existing coaching booking behavior and page access before checkout handling. Cases cover grant absence/revocation, invalid/string values, user metadata spoofing, nested coaching routes and unchanged restrictions on billing/platform routes.

Changed-source lint, feature, import boundary, structure and route checks passed. No schema/RLS changes; no booking, checkout or calendar operation was run. Appearance review and visual baselines remain user-owned; existing controls/styles are reused. Graphify AST update completed (21,162 nodes / 60,958 edges). Full local TypeScript checking reports 148 diagnostics in 24 unchanged files, including missing dependencies/assets in the shared root installation and unrelated acceptance typing; no diagnostic names a changed file. This is not a passing typecheck. Hosted CI remains required. Required current-head quality and code-owner gates remain mandatory before merge/deployment. The historical SHIP-000 revision 40 host ownership blocker is preserved, not bypassed by this ad-hoc fix.
