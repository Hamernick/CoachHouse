# Coach House Companion pilot

## Current checkpoint

User goal: privately testable TypeScript/React/MCP Apps plugin for one accelerator journey, with reviewed document persistence, correct submission/completion, calendar follow-up and resume. Full source objective is the user attachment; this checkpoint preserves implementation evidence and remaining gates.

Integration lane: `feat/coach-house-companion-20261026`, `/Users/calebhamernick/Development/coach-house-platform-companion-20261026`, base current `origin/main` `c71d4dc11`. Initial contracts `df8ffcc6`. Root checkout and older `feat/chatgpt-integration-20261007` planning lane preserved. Shared SHIP revision40 is an unrelated blocked claim; no runner mutation or release action.

Parallel owned worktrees: `companion-ui-20261026` components/hooks; `companion-services-20261026` state/service/lesson/ICS; `companion-verification-20261026` skills/docs/tests. Each agent has a dedicated goal. Lead owns HTTP/MCP/auth/widget build/integration. Child commits are integrated explicitly; no shared dependency mutation.

## Agreed contract and scope

- Six tools: get session, save draft, read-only document review, save document, submit assignment, prepare calendar export.
- One shared typed snapshot and application-service executor; standalone browser and MCP Apps widget use the same tool interface.
- Persistent isolated fictional organization. Server filesystem is authoritative, cookies identify sessions, every call rechecks membership-equivalent scope/expiry/revocation and revision. No production data writes.
- Draft save never invokes current live assignment submission. Submitted and completed are distinct; existing pure completion logic determines completion.
- Sandbox document destination and visibility shown before save. Native live assignment mapping can update shared/public profile, so no silent live mapping in this pilot.
- Existing Google export owns an organization Board calendar; personal study blocks must not use it. ICS export is labeled export, with provider creation remaining a separate gate.

## External access evidence

2026-10-26: actual Chrome Personal ChatGPT Plugins page supports Add custom MCP server with Server URL/Tunnel. Authentication choices are OAuth, No authentication, or OAuth or no authentication. No static bearer option. Browser is signed in; no plugin created, account grant, tunnel, or provider change performed.

Process environment has no OpenAI API key/tunnel variable. Sandbox MCP uses a separate operator-supplied bearer credential and does not claim Coach House OAuth. Live account OAuth/host connection must be proven separately. Goal explicitly authorizes a labeled persistent sandbox when those external capabilities are unavailable.

## Current verified checkpoint

Latest user decision: **small review/action cards; open full work in Coach House**. Removed the hero, overview, tabs, questionnaire, document editor and calendar form. The skill asks source questions in conversation. Cards show status, exact before/after approval, and an export receipt; native links open the live application. Sandbox changes remain isolated and are explicitly labeled.

Integrated service, UI and verification agents in separate worktrees. Read-only published module/class/assignment verification captured all 11 Mission answer fields, `all_answered`, `complete_on_submit=true`, module idx1. Public-only source evidence is retained at `.tmp/companion/published-lesson.json`; its SHA and extracted fields are in the feature README/data file.

Final `pnpm companion:test`: **59 cases pass**, covering behavior, HTTP, real SDK transport, read-only preview, exact approval, revision/idempotency races, expiry/revocation and full tool-driven lesson journey. Encoded-formatting preview/save disagreement reproduced before bounded fixed-point correction. Equal-time capped receipts cannot roll completion back. `pnpm companion:test:browser`: **five cases pass**, covering compact native links/no embedded forms, exact approved save/reload/no redundant identical proposal, stale conflict, actual downloaded ICS bytes, and built MCP Apps card approval plus optional download bridge in a test host. Review screenshot capture rerun passed. Light/dark/mobile/review screenshots: `.tmp/companion-browser/action-card-{light,dark,mobile}.png`, `review-card-light.png`. This test host is not ChatGPT.

Full `pnpm exec tsc --noEmit --incremental false` passed (empty `.tmp/companion/types-final.log`). Scoped ESLint, npm supply-chain, feature/import/route/raw-button/scaffold/structure and acceptance-manifest checks passed. Staged gitleaks found zero leaks. Full hosted quality remains a separate merge gate. Original embedded-form agent walkthrough was superseded. Final compact-card agent walkthrough confirmed readability/approval/native links and saved text; its identical-proposal observation was fixed and browser-tested. Actual ICS delivery is independently proven by browser file bytes; the agent's native-browser automation could not observe a download event. No unfamiliar-human acceptance is claimed.

Live local TCP proof `pnpm companion:test:mcp` passed against the official launcher: unauthenticated401, six tools, published Mission/11fields, actual `review-cards-v1` HTML/MCP Apps resource (1,092,452bytes), fresh connection resumes the same sandbox. `.tmp/companion/mcp-network-proof.json` contains no credential. Launcher remains on3150 in this worktree; its private operator token is `.tmp/companion/operator-token`, outside Git/package.

Portable package `.tmp/companion/coach-house-companion-plugin.zip` contains root plugin.json/mcp.json/README and the workflow skill, with no credentials/runtime state. [Run/install/demo instructions](../plugins/coach-house-companion/README.md) own the five-minute script and reset behavior. Package installation in ChatGPT is unverified; source is the feature and route files in this lane.

Graphify current: **22,228nodes /63,512edges /1,202communities**. Full-root AST retained; two subsequently changed code files and two canonical docs refreshed with exact source/cache/manifest readback. Local receipt `graphify-out/companion-maintenance/receipt.json`; unrelated graph content preserved. Two SQL self-loops predate this task; broader documentation coverage remains unclaimed. Current monthly log/open-work entry and private original08 pointer reference this checkpoint. No original176 requirement is newly declared complete.

First push was correctly blocked by full lint scanning the minified widget under `.tmp`. Moved its generated output to the repository's existing ignored `build/companion-widget` directory; lint rules/thresholds unchanged. Full `pnpm lint` then passed (one pre-existing org-switcher warning). All five browser cases and live local TCP MCP smoke passed again after this output-path correction. Browser traces now live under `.tmp/companion-browser/runs` so focused runs retain sibling screenshots. Three fictional-data screenshots are packaged in `docs/plugins/coach-house-companion/assets/screenshots/` for PR review.

Next: commit/push the reviewed output-path correction and prepare a draft PR, then inspect current-head hosted evidence. Connection name/endpoint requested asynchronously for the live ChatGPT gate. Preserve this sandbox and the separate old login plan; no production deployment/provider/data action is authorized by this checkpoint.

Unverified external gates: real ChatGPT tool and UI rendering; Coach House OAuth grants/revocation; live document/profile writes and native UI readback; personal-calendar provider creation/readback; unfamiliar human tester. Local sandbox tests do not close these gates. Public listing, merge and production deployment are excluded.
