# Launch checklist: five existing requirements and telemetry privacy

## Current checkpoint

Local implementation and focused verification complete; preparing an open PR on `fix/launch-checklist-five-20261023`. Hosted quality/review, merge, deployment and production acceptance remain Caleb-owned. This closes verification gaps for existing features; it does not claim five newly built features or a complete launch audit.

Original source: Desktop `02-security-infrastructure-launch.md`, stage 5 / B115. User selected five more tasks; the 56 test-type errors and dependency upgrade belong to another chat. Worktree: `coach-house-platform-launch-checklist-five-20261023`, base `5d40b7db`. Shared SHIP revision40 and unrelated worktrees/providers are unchanged.

| Original requirement | Result and evidence | Remaining boundary |
| --- | --- | --- |
| O118-01 Privacy policy page | Existing `/privacy` serves200, correct title/canonical,23 working document anchors, signup and Terms links. Existing legal-consent tests pass. | Content/version/consent unchanged; this is delivery verification, not legal approval. |
| O119-01 Terms and conditions page | Existing `/terms` serves200, correct title/canonical,19 working document anchors, signup and Privacy links. | Same legal boundary; no replacement copy. |
| O125-01 Favicon | Root metadata links existing icons. Every rendered icon URL serves200, both theme PNGs load, and favicon has a valid ICO header. | No appearance change or visual baseline update. |
| O174-01 robots.txt points to sitemap | `/robots.txt` serves200 and names `https://coachhouse.app/sitemap.xml`. | Does not close the broader complete-sitemap audit O126/O173. |
| O136-01 Analytics installed | Existing Analytics and Speed Insights mount in hydrated Chromium. Both register the shared beforeSend filter; synthetic checks confirm query/fragment removal and private signing-path suppression. | Provider scripts intercepted during local verification; actual dashboard ingestion and production privacy-fix delivery not claimed. |

## Changed behavior

The old URL filter only suppressed four exact fiscal guest paths. It could forward login/invite/recovery query parameters, fragments and signing/W-9 identifiers. The shared filter now strips query strings and fragments, excludes fiscal private workflow descendants, and rejects malformed/unsupported URLs or URL credentials. Clean ordinary page events retain identity; sanitized events preserve their other fields without mutating the original. Authentication requests, redirect destinations, legal content and custom-event payloads are unchanged.

Changed source: `src/lib/telemetry-privacy.ts`. New regression suite: `tests/acceptance/telemetry-url-privacy.test.ts`, registered in `tests/acceptance/projects.json`.

## Reproducible local evidence

Node22.13.0, locked Next16.2.6; no dependency edits. Before the fix, the new suite reproduced13 failures with9 passes. Afterward,80 tests across8 suites pass:

```sh
pnpm exec vitest run --config vitest.config.ts tests/acceptance/telemetry-url-privacy.test.ts tests/acceptance/vercel-observability.test.ts tests/acceptance/legal-consent.test.ts tests/acceptance/fiscal-sponsorship-email-proof.test.ts tests/acceptance/fiscal-sponsorship-guest-recovery.test.ts tests/acceptance/fiscal-sponsorship-guest-followup.test.ts tests/acceptance/public-site-origin.test.ts tests/acceptance/community-indexing.test.ts
```

Changed-file ESLint, import boundaries, structure conventions and acceptance-project manifest checks pass. Structure emits existing near-budget warnings. No full local quality/build rerun: the separately owned56 baseline test-type errors are not modified here. Required hosted merge gates still apply.

HTTP and hydrated-browser evidence: `/tmp/coach-house-launch-five-20261023/http-evidence.json` and `browser-evidence.json`. Reproduction scripts are `verify-http.py` and `verify-browser.cjs` in that directory; synthetic tokens only, external telemetry scripts intercepted. Initial cold compilation exceeded the HTTP timeout; retry after compilation passed, without application changes.

Preview: [Privacy](http://localhost:3156/privacy), [Terms](http://localhost:3156/terms), [robots.txt](http://localhost:3156/robots.txt), [favicon](http://localhost:3156/favicon.ico). Dedicated webpack dev server uses this worktree; preserve other listeners and shared dependency owner.

Graph AST refresh initiated once after the code slice; completion recorded in the delivery receipt. No schema, provider, production data, email or deployment actions.

## Counts and continuation

Four existing page/asset/indexing requirements now have explicit local verification. Analytics installation is also verified; the newly discovered privacy correction awaits PR/release. Earlier this chat shipped2 other complete original requirements (O124/O132). These are7 distinct requirements with implementation evidence, not7 newly shipped changes or an all-chats completion total. Keep production acceptance separate.

Finish normal secret scan/commit/push and open one PR. Caleb owns hosted checks, merge/deployment and live acceptance. After release, confirm ordinary page measurement continues and private URL data is absent; do not send test credentials to production telemetry. Continue other original02 requirements only after source reconciliation. Do not duplicate the other chat's56 test-type repair.
