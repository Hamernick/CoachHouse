# Next.js security upgrade

User authorized the DevTools-recommended security upgrade in a separate worktree,
with independent dependencies and no interruption to another terminal's work.
This is a narrow workstream02 security follow-up, not the full prelaunch audit.

## Source and isolation

- Branch: `fix/next-security-upgrade-20261022`.
- Worktree: `/Users/calebhamernick/Development/coach-house-platform-next-security-20261022`.
- Base: current main `5d40b7db9ef550c99bdbb5a18b4c85ca1ac6f17c`.
- Separate `node_modules` installed with Node22.13.0/pnpm10.28.0. Root edits,
  other worktrees/listeners and shared SHIP revision40 remain preserved.
- Original02 packet and SHIP read; user explicitly selected this independent
  dependency repair. No claim replacement, provider changes or deployment.

## Finding and fix

The reported runtime used16.4.0; the repository lockfile actually used16.2.6.
Both precede the [October14 security fix](https://nextjs.org/blog/nextjs-security-update-october-14-2026).
App Router and real Server Actions establish the relevant DoS prerequisite.
The image optimizer also resolved vulnerable Sharp0.34.5. Actual SVG/glibc
exploitation was not tested; Cache Components is not enabled.

- The installed16.2.6 CLI rejected `--agent=security`. The documented current
  tooling command `pnpm dlx next@canary upgrade --agent=security` selected16.4.2.
  Read both generated shared/same-major guides. No equivalent upgrade found in
  local/remote branch history or open GitHub PR lookup.
- Upgrade Next and matching `eslint-config-next` to16.4.2; preserve existing
  caret dependency policy and lock the exact target. Transitive Sharp0.35.5
  includes the Linux/glibc platform packages. No old Next runtime remains.
- Add only `experimental.agentUpgrade: "security"` to existing Next config,
  as the upgrade task requests. Existing images/auth/runtime configuration stays.
- React/react-dom19.2.4 remain; Next supplies its patched bundled RSC code.
  No major-version codemod, future-default adoption or application redesign.
- Independent read-only investigation and candidate review found no concrete
  surviving vulnerable dependency path or compatibility regression.

## Verification and release boundary

- Frozen offline installation passes; `next --version` reports16.4.2.
- Re-running `next upgrade --agent=security` reports no security update needed.
  This is the focused advisory/version substitute; no destructive exploit run.
- Native Sharp0.35.5 loads successfully through Next's own module resolution.
- 133 existing cases across proxy/auth, invitation actions, document image access,
  bounded public image transforms and public/login metadata/redirects pass:
  `pnpm exec vitest run` with the eight named suites and `--maxWorkers=2`.
- Scoped config ESLint, npm supply-chain check and diff hygiene pass.
- Full lint passes with one warning in an unchanged org-switcher component.
- Production bundling passes. Normal build fails on acceptance-test type errors;
  unchanged main and candidate reproduce exactly56identical test diagnostics,
  with0introduced/removed and0outside `tests/**`. Baseline uses its own frozen
  Next16.2.6 dependencies in a disposable archive. Application-only
  TypeScript passes, without changing tracked tsconfig or bypassing the build gate.
- Local Next16.4.2 HTTP checks pass: login200, protected workspace307to login,
  PNG optimization200, disallowed external SVG host400. Own3155server stopped.
  Next dev's generated AGENTS append was removed after shutdown; original
  repository instructions remain byte-identical to the base.
- Full diagnostic commands: baseline `next typegen`, then baseline and candidate
  `tsc --noEmit --pretty false --incremental false`; compare diagnostic headers.
  Application scope: `tsc --noEmit -p .tmp/next-security-app-tsconfig.json`.
  Temporary local comparison logs: `.tmp/next-security-{baseline,candidate}-types.log`.
- Turbopack also warns about existing broad filesystem traces in presenter-audio
  and finance-plan-response prototypes. These were not modified or suppressed.
- Outcome: dependency remediation locally prepared; full release verification
  remains blocked by the unchanged56test-type errors. No build/type guard weakened.
- One batched Graphify refresh and final draft-PR handoff pending.
- Required hosted quality/code-owner review and branch protection remain;
  application merge/deployment and production verification stay user-owned.
  A local safe install does not patch an already-running terminal or production.

## Continuation

Finish graph maintenance and the final duplicate-PR check, then push one draft PR.
Keep hosted quality/review/build and deployment blocked until their actual gates pass.
No database migration or production security remediation is claimed.
