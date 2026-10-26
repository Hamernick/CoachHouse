# Connected Coach House pilot

Approved deployment target: the existing Coach House Supabase project and real
account, restricted to an allowlisted private production pilot. This file is configuration guidance,
not evidence of a deployed or installed ChatGPT plugin. The canonical task
checkpoint is `docs/plans/2026-10-26-coach-house-companion.md` in the repository.

## Connection architecture

ChatGPT connects to the Coach House OAuth broker on Vercel. It receives opaque
`accelerator:read` / `accelerator:write` credentials usable only by the MCP
endpoint. Supabase provides a separate upstream OAuth session for the existing
member. Those Supabase tokens remain encrypted on the server and calls use the
member's database RLS context. The browser's rotating login session is never
copied into the plugin connection.

This distinction matters: Supabase's ordinary user JWTs also work against other
Supabase APIs. Identity scopes do not restrict database access. Do not expose
those JWTs to ChatGPT or advertise them as narrowly scoped MCP credentials.

## Configure the approved private pilot

Use the existing Supabase project and the reviewed canonical Coach House HTTPS
origin. Restrict connection, consent and bearer use to the verified pilot account
IDs with `COMPANION_ALLOWED_USER_IDS`; this is not a public launch. Root applies
the reviewed migration transaction and provider/deployment changes. Do not load
production credentials into an ordinary local preview. This guide does not prove
that configuration, deployment or account acceptance has finished.

1. Apply the reviewed migrations `20261026150000_companion_oauth.sql` and
   `20261026160000_companion_live_work.sql` to the approved project. Both add RLS-protected
   feature storage; neither changes existing website token hooks or providers.
2. In Supabase **Authentication > OAuth Server**, enable OAuth 2.1 and
   set Authorization Path to `/oauth/consent`. Its Site URL must be the canonical
   Coach House origin serving that route. Use asymmetric signing if requesting
   `openid`. Do not rotate production signing keys as a shortcut.
3. Register one confidential Supabase OAuth client for **Coach House Companion**,
   using `client_secret_basic`. Its only callback is
   `https://<coach-house-origin>/api/companion/oauth/callback`. Dynamic client
   registration is unnecessary. Keep its secret only in server configuration.
4. Configure Vercel with the values below, build the widget, and deploy the
   reviewed source to the chosen stable HTTPS origin. ChatGPT needs to reach
   OAuth metadata, authorization/token endpoints and MCP without a separate
   Vercel-login wall. The MCP endpoint itself always requires its broker token.
   Do not remove deployment protection across unrelated projects.
5. In ChatGPT, add a custom MCP plugin at
   `https://<coach-house-origin>/api/companion/mcp`. Choose OAuth and a provided public
   client with ID matching `COMPANION_CHATGPT_CLIENT_ID`, token authentication
   method `none`, and PKCE S256. Discovery points to our broker, not directly to
   Supabase. The Supabase client secret must never be entered in ChatGPT.
6. Copy the exact callback URI displayed by OpenAI into
   `COMPANION_CHATGPT_REDIRECT_URI`, then finalize/redeploy that pilot config.
   Our broker's fixed allowlist rejects all other callbacks; no wildcard or
   guessed callback is accepted. The broker advertises issuer identification.
7. Connect as the allowlisted existing member, review consent, and test the journey below.

## Server configuration

All values belong to this environment; no credential belongs in Git, a plugin
ZIP, a screenshot or a chat message.

| Variable | Value |
| --- | --- |
| `COMPANION_LIVE_ENABLED` | `1` only for the reviewed connected environment |
| `COMPANION_ALLOWED_USER_IDS` | Comma-separated verified account UUIDs; required, exact private-pilot allowlist |
| `COMPANION_SANDBOX_ENABLED` | Unset or `0`; never enable both modes |
| `COMPANION_PUBLIC_ORIGIN` | Canonical HTTPS origin, without a path |
| `NEXT_PUBLIC_SUPABASE_URL` | Approved existing project's HTTPS origin |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Approved project publishable/anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Approved project server-only key for the private OAuth store |
| `COMPANION_OAUTH_CLIENT_ID` | Dedicated upstream Supabase OAuth client UUID |
| `COMPANION_SUPABASE_CLIENT_SECRET` | Dedicated upstream client secret |
| `COMPANION_CHATGPT_CLIENT_ID` | Public identifier, for example `coach-house-chatgpt` |
| `COMPANION_CHATGPT_REDIRECT_URI` | Exact callback copied from OpenAI |
| `COMPANION_TOKEN_ENCRYPTION_KEY` | Independent random 32-byte key, base64 encoded |
| `COMPANION_CONSENT_SECRET` | Independent random secret, at least 32 characters |

Retain the encryption key for existing connections. Replacing it makes those
connections unreadable and requires reconnecting; never rotate it implicitly.
Keep any future staging credentials and origins separate from this production pilot.

Generate the deployment-specific package only after the origin/client ID are
known:

```sh
pnpm companion:widget
pnpm companion:package https://<coach-house-origin> coach-house-chatgpt
```

The generated `.tmp/companion/coach-house-companion-connected.zip` contains only
plugin metadata, MCP OAuth configuration, this guide and the conversation skill.
It excludes runtime credentials/state and the sandbox's screenshots. The source
package's existing `mcp.json` remains explicitly for local sandbox testing.

## Acceptance journey

Use the approved existing account and its own organization. Connect, choose that
organization, load a published lesson, answer typed questions and save a private
Companion draft. Before submission, review the exact answers and explicitly
approve their native merge into your own organization profile, including possible
public profile changes. Then submit, review an exact
organization document change, approve it, and read it again. Open the native
Coach House app to verify submission/progress/document values, then resume in a
new conversation. Verify unallowlisted accounts are denied without creating or
changing their records. Existing local tests cover cross-organization denial; do
not claim live multi-account acceptance without observing it. Test stale native
edits, refresh, denied consent and disconnect.

Drafts are private Companion work until submitted and do not change organization
profiles. Submission is owner-only and invokes the existing native profile merge;
it may affect public profile content. Separately approved document-draft writes
preserve the previous published version. Videos and resources are current source links; inline video
playback is not implemented in this slice. Coaching opens `/coaching`, where the
existing availability/credit/payment flow runs. Calendar output is an ICS export,
not a provider event or coaching reservation.

## Verification and rollback

`pnpm companion:test` runs the focused sandbox/connected service, OAuth, consent,
and HTTP cases. `pnpm companion:test:rls` uses disposable local PostgreSQL only:
no remote database URL is accepted. Browser tests exercise the built cards in a
test host; they do not establish real ChatGPT installation or provider behavior.

To disable the integration, set `COMPANION_LIVE_ENABLED=0` and redeploy only the
reviewed target. Revoke broker grants and the dedicated upstream client through
the reviewed operational process. Keep saved drafts/receipts until their data
retention decision; destructive table removal is not an automatic rollback.

References: [OpenAI OAuth](https://developers.openai.com/plugins/build/auth),
[Supabase OAuth setup](https://supabase.com/docs/guides/auth/oauth-server/getting-started),
[Supabase token security](https://supabase.com/docs/guides/auth/oauth-server/token-security),
[Vercel MCP deployment](https://vercel.com/docs/mcp/deploy-mcp-servers-to-vercel).
