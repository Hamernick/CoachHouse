# Coach House Companion pilot

## Current checkpoint

User goal: privately testable TypeScript/React/MCP Apps plugin for one accelerator journey, with reviewed document persistence, correct submission/completion, calendar follow-up and resume. Full source objective is the user attachment; this checkpoint preserves implementation evidence and remaining gates.

Integration lane: `feat/coach-house-companion-20261026`, `/Users/calebhamernick/Development/coach-house-platform-companion-20261026`, base current `origin/main` `c71d4dc11`. Initial contracts `df8ffcc6`. Root checkout and older `feat/chatgpt-integration-20261007` planning lane preserved. Shared SHIP revision40 is an unrelated blocked claim; no runner mutation or release action.

Parallel owned worktrees: `companion-ui-20261026` components/hooks; `companion-services-20261026` state/service/lesson/ICS; `companion-verification-20261026` skills/docs/tests. Each agent has a dedicated goal. Lead owns HTTP/MCP/auth/widget build/integration. Child commits are integrated explicitly; no shared dependency mutation.

## Agreed contract and scope

- Five tools: get session, save draft, save document, submit assignment, prepare calendar export.
- One shared typed snapshot and application-service executor; standalone browser and MCP Apps widget use the same tool interface.
- Persistent isolated fictional organization. Server filesystem is authoritative, cookies identify sessions, every call rechecks membership-equivalent scope/expiry/revocation and revision. No production data writes.
- Draft save never invokes current live assignment submission. Submitted and completed are distinct; existing pure completion logic determines completion.
- Sandbox document destination and visibility shown before save. Native live assignment mapping can update shared/public profile, so no silent live mapping in this pilot.
- Existing Google export owns an organization Board calendar; personal study blocks must not use it. ICS export is labeled export, with provider creation remaining a separate gate.

## External access evidence

2026-10-26: actual Chrome Personal ChatGPT Plugins page supports Add custom MCP server with Server URL/Tunnel. Authentication choices are OAuth, No authentication, or OAuth or no authentication. No static bearer option. Browser is signed in; no plugin created, account grant, tunnel, or provider change performed.

Process environment has no OpenAI API key/tunnel variable. Sandbox MCP uses a separate operator-supplied bearer credential and does not claim Coach House OAuth. Live account OAuth/host connection must be proven separately. Goal explicitly authorizes a labeled persistent sandbox when those external capabilities are unavailable.

## Verification and delivery remaining

Implement and integrate child slices; compile/bundle the React MCP resource; focused behavior/auth/HTTP/MCP/browser checks; light/dark/mobile screenshots; fixture/reset run instructions and five-minute demo. Batch Graphify after cohesive code slice. Update current runlog/open-work index at handoff.

Unverified external gates: real ChatGPT tool and UI rendering; Coach House OAuth grants/revocation; live document/profile writes and native UI readback; personal-calendar provider creation/readback; unfamiliar human tester. Local sandbox tests do not close these gates. Public listing, merge and production deployment are excluded.
