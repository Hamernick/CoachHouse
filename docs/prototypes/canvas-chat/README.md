# Canvas chat experiment — corrected scope

The standalone Vite prototype was rejected by Caleb on November 4. Its port3191 server is stopped. Do not resume or develop the simulated fixture.

The experiment now wraps the real composer in the existing application on localhost:3153:

http://localhost:3153/workspace?workspace=15ef1a52-7afd-4a82-8dfb-9dc90aa6d401&canvasChat=1

Remove `canvasChat=1` to use the existing dock. The actual planning, context, document assistance, authorization and save handlers remain unchanged. This slice adds a centered intro, a world-anchored composer, a collision-aware Return control and bottom alignment after returning/submitting. Existing review panels remain bounded and scrollable. The initial positioning slice did not add generated-result drag/drop or conversational history. The November4 AI-first follow-up below supersedes the drag/drop status; conversation remains pending.

Implementation: `workspace-canvas-chat.tsx`, `canvas-chat-geometry.ts`, plus bounded composition changes in `workspace-canvas-surface-v2-view.tsx`, `workspace-drawer-composer.tsx` and `workspace-dock.module.css`. Five hash-guarded files synced to the existing3153 runtime without restart.

Verified on the authenticated real workspace: intro renders, pan moves chat offscreen, indicator avoids measured overlays, return restores bottom position, draft and input focus. No page errors or provider calls. Scoped lint passes. The existing dock host test passes; six old overlay source-contract assertions fail on expectations unrelated to these edits (legacy sheet strings and removed selectionKeyCode). Typecheck/graph completion tracked in the local receipt.

Existing standalone files are abandoned reference artifacts only, not the product or an integration claim. Preserve other worktree changes. Execution continuation is consolidated in [Canvas chat integration and remaining work — November4](../../plans/2026-10-27-particle-system-execution-spec.md#canvas-chat-integration-and-remaining-work--november4). That mega-plan checkpoint owns overlap, remaining work and acceptance; this README and verification.json retain the implementation evidence. The earlier composer/context work remains preserved.

## Sidebar usage follow-up

The user requested moving usage out of the chat into a compact control below Coach scheduling, matching their five usage screenshots. This is a real application update independent of `canvasChat=1`. The ring has a hover summary; click opens included/additional/reserved credits and the current request maximum; row tooltips show actual expiry and explanations. Manage usage opens Account settings > Usage & billing on desktop/mobile, reusing the existing authenticated purchase, allowance, limits and history controls. The application has no weekly allowance contract, so the UI shows actual included balances/expiry and never fabricates a weekly reset.

`AiUsageProvider` loads the active organization through a server-authenticated read, refreshes on workspace/focus/request status, and shares it with the sidebar/settings. Scoped quote publication removes the old Pricing details block and empty review container from the chat while preserving the generation tariff/reservation authorization. Auth/read failure never becomes a zero balance. No purchase, allowance assignment, provider generation or deployment was performed.

Implementation lives in existing ai-credits components/actions and app sidebar/account settings; runtime file hashes and checks are recorded under `usageUi` in `verification.json`. This follow-up is not removed by turning off the canvas chat experiment.

## AI-first planning and placement follow-up

Caleb deferred Stripe. Natural-language Create requests now reach AI, and generated whole plans can be added or dragged onto the actual canvas through the existing canonical writer. One real3153 run generated three work items/two dependencies, saved by drag and survived fresh database readback/reload; existing board work was preserved. Two calls/$0.015894/eight credits. Persistent back-and-forth conversation remains the next gap. The mega plan's AI-first checkpoint owns current scope and budget boundaries. `boardPlacement` in verification.json and the private current source-sync receipt supersede historical file hashes for overlapping paths.

## Private conversation follow-up — November5

The real3153 composer now persists private chats and refines unsaved plans through the same input. Compact chat selection/New chat, reload recovery and canonical latest-plan Add are integrated. The [November5 checkpoint](../../plans/2026-10-27-particle-system-execution-spec.md#persistent-private-plan-conversation--november5) owns scope, verification and remaining work. Controlled browser/SQL/acceptance verification and the separately approved real two-turn test pass:2 calls, $0.018686,11 credits. Actual reload, follow-up and Add saved only the revised plan, preserving the first note and existing board work. Approval is completed. Post-Add conversational revisions remain pending. No allowance increase, server restart or hosted deployment.

## Saved-plan revision continuation — November5

The real3153 chat now continues accepted plans through existing proposal/review writers. [The master checkpoint](../../plans/2026-10-27-particle-system-execution-spec.md#saved-plan-chat-revisions--november5) owns current evidence and remaining provider/history gates; older pre-Add-only descriptions above are historical. No standalone prototype is active.
