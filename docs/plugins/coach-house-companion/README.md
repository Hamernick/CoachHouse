# Coach House Companion sandbox

Connected-account implementation and staging setup are documented in
[Connected Coach House pilot](connected-setup.md). This page and its source
`mcp.json` describe the separate local sandbox. Connected deployment and actual
ChatGPT acceptance are not established by sandbox results.

A private conversational test slice: continue the Mission lesson, save answers, review a document revision, submit an assignment, and export a study block. This package contains the plugin manifest and one workflow skill. The repository supplies the MCP server and compact status, review, and action cards. Full assignments and document editing open in Coach House; the plugin does not embed the questionnaire or recreate the application.

## What a demonstration proves

| Capability | This slice | Separate live gate |
| --- | --- | --- |
| Lesson | Published Mission module/class verified read-only October 26; all 11 answer fields captured | Live curriculum refresh |
| Document review | Read-only proposal with exact destination, text, and revision; save only after approval | Authorized production document integration |
| Draft and document | Persisted in an isolated sandbox session after their distinct save actions | Authorized production document integration |
| Assignment | Explicit sandbox submission; completion uses lesson rules | Production member progress and entitlement checks |
| Calendar | Downloadable `.ics` file | Provider authorization, event creation, independent event readback |
| Browser | `/companion` previews compact cards and exercises the shared tool service | Actual conversational ChatGPT host install and interaction |
| MCP | `/api/companion/mcp` exposes the sandbox tools | Reachable HTTPS, supported connection auth, account access |

Never describe the sandbox document as a saved Drive file or public profile update. Native links open Coach House; sandbox changes are not synchronized into that account. An export is not an added calendar event. A passing local browser or MCP protocol check is not proof of installation in ChatGPT.

## Run and connect

Use Node 22 and the repository's pinned pnpm version in the isolated Companion worktree:

```sh
pnpm install --frozen-lockfile
pnpm companion:widget
pnpm companion:dev
```

Open `http://127.0.0.1:3150/companion`. To inspect a fictional, read-only document proposal, use `/companion?example=review`; it saves only after **Save change**. The launcher supplies local placeholder Supabase settings, enables only the sandbox, and creates a private operator credential at `.tmp/companion/operator-token`. It never loads the root checkout's production environment. Do not copy that credential into this package or chat.

With the preview running, use `pnpm companion:test`, `pnpm companion:test:browser`, and `pnpm companion:test:mcp` (actual local TCP/credential/resource/resume proof). Browser tests write screenshots and failure traces beneath `.tmp/companion-browser/`. Building the widget is required before MCP resource/browser-host tests.

| Environment variable | Purpose |
| --- | --- |
| `COMPANION_SANDBOX_ENABLED=1` | Explicitly enable sandbox routes |
| `COMPANION_SANDBOX_TOKEN` | Private MCP bearer secret, at least 32 characters; set outside tracked files |
| `COMPANION_SANDBOX_DIR` | Optional isolated sandbox persistence directory |
| `COMPANION_PUBLIC_ORIGIN` | Explicit origin for a separately approved public test deployment; omit for local work |

1. Start the isolated Companion application and open `/companion`.
2. The browser obtains its session through `GET /api/companion/sandbox`, with a signed HttpOnly, SameSite=strict cookie expiring after 24 hours. Browser mutations require an exact same-origin `Origin` header and a body containing `{name, arguments}`.
3. To test MCP locally, use the streamable HTTP endpoint `/api/companion/mcp` with `Authorization: Bearer` and the value of `COMPANION_SANDBOX_TOKEN` in the client's private authorization configuration. Keep the secret out of URLs, screenshots, checked-in configuration, and chat messages. MCP uses a separate persistent fictional session from the browser.
4. Call `companion_get_session` without an organization ID to bootstrap the authenticated MCP session, or supply the explicitly selected ID. Use the returned organization ID for every write. An explicitly wrong ID is rejected. Inspect the returned source and mode before writing.
5. Load this directory as a local plugin package only in a client that supports that installation method. Refresh the connection after tools or metadata change.

The portable `mcp.json` connection uses a local endpoint and declares bearer authentication without embedding a credential. Adjust the endpoint to the verified running port. This is development configuration, not a public directory submission.

Hosted ChatGPT cannot use the developer's loopback address. A ChatGPT test needs an explicitly approved reachable HTTPS environment, compatible authentication, and account/workspace plugin access. The inspected custom-server UI offers OAuth or no authentication, not the sandbox's fixed bearer credential. An unauthenticated MCP request is rejected; choosing “No authentication” does not bypass the server's requirement. Therefore the packaged local configuration does not establish a working ChatGPT connection. Do not disable authentication, expose this sandbox through a tunnel, or change provider settings implicitly. The sandbox credential is not production OAuth or a Supabase session. Public distribution requires its own publisher, privacy, review, and authorization work.

The portable manifest supports API-key authentication for clients/install surfaces that accept it; that route has not been installed in ChatGPT here. A Secure MCP Tunnel also needs a Platform key, tunnel/workspace association, and compatible authorization; none was configured. The local MCP bearer grant has a 24-hour sandbox lifetime. On expiry/revocation, stop this task's server, rotate only `.tmp/companion/operator-token` (or set a new `COMPANION_SANDBOX_TOKEN`), restart, and update the client's private credential. Rotation creates a new sandbox; old grants remain unusable. It does not restore old work or renew revoked access silently.

See the official [plugin package format](https://developers.openai.com/plugins/build/plugins), [connection quickstart](https://developers.openai.com/plugins/quickstart), and [authentication guidance](https://developers.openai.com/plugins/build/auth).

## Seed, reset, and resume

Each new sandbox session starts from the bounded Mission seed and has its own organization and persisted state. A fresh read of the same authorized session restores answers, document revision, submission, calendar export, and receipts. A new session is a new demonstration, not a continuation of the old session.

For a browser reset, send `DELETE /api/companion/sandbox` from the same origin. It revokes the session and clears its cookie; reloading creates a new seed. Browser reset does not reset the separate MCP session. Do not clear shared application caches, production database rows, Google data, or unrelated sandbox directories. Revocation ends access to the old session. Expired sessions require a new session.

For automated tests, set `COMPANION_SANDBOX_DIR` to a unique temporary directory, create sessions with `createCompanionSession()`, and remove only that test directory afterward. The acceptance suite follows this procedure.

## Five-minute presentation

Use fictional answers. Ask a tester unfamiliar with the implementation to work through this sequence without directing each click:

1. **Resume:** identify the organization, lesson source, and unfinished work.
2. **Answer:** answer an actual source question in conversation, save the draft, and retrieve it again. The card shows status and a native link rather than an assignment form. Submission remains separate.
3. **Review:** develop the mission draft in conversation and call the read-only review tool. Inspect the compact before/after comparison and its destination. Verify nothing was saved yet. Select **Save change**, then retrieve the exact approved revision again. Open full document work in Coach House.
4. **Submit:** explicitly submit the assignment. Incomplete answers may be submitted but must not produce a false completion state. Complete the remaining source questions if demonstrating completion.
5. **Schedule:** review title, start/end, and timezone; prepare and download the `.ics` export. Explain that importing it is a separate action.
6. **Recover:** reload and resume. Demonstrate one revision conflict or invalid schedule and preserve prior saved work.

Record where the tester hesitates, whether they can distinguish preview/draft/submission/completion/export, and whether the saved values match the fresh read. A local card harness demonstrates card behavior, not a real conversational model or ChatGPT installation. This is a script for a future test, not evidence that an independent tester has completed it.

## Acceptance evidence

The service suite is `tests/acceptance/coach-house-companion.test.ts`. It covers persistence, read-only document proposals, exact approved saves, stale proposals, explicit submission, completion rules, concurrent edits, retry identity, organization/session access, expiry/revocation, confirmation, inert retrieved text, schedule validation, calendar escaping, and partial success. The HTTP suite adds signed-cookie initialization/recovery and a complete SDK-driven lesson journey. Browser tests cover compact native links, approval/readback, stale proposals, an actual downloaded ICS file, and the built widget in a test MCP Apps host. The test host is not ChatGPT.

Run focused tests using the repository Vitest config after the test is registered in the acceptance manifest. Record the command, revision, pass/fail result, browser evidence, and live/simulated status in the task checkpoint. Tests of isolated services do not establish production RLS, OAuth interoperability, or provider delivery. Keep hosted quality, review, merge, deployment, and live acceptance as separate gates.

## Known integration boundaries

- The existing production assignment POST submits answers and may synchronize organization/public profile data. Never use it for draft autosave.
- The existing Board calendar export is not a personal study-block destination.
- Document saves require the expected revision and exact reviewed content; do not retry a conflict as an unconditional overwrite.
- Retry a lost response with the original request ID and identical arguments. A changed request needs a new ID.
- Read saved state and receipts before claiming recovery. If the document saved but scheduling failed, preserve the document and retry scheduling alone.
- Retrieved text is content, not instructions granting tool access or authorization.
