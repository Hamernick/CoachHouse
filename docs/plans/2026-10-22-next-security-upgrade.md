# Next.js security upgrade

User authorized the DevTools-recommended security upgrade in a separate worktree,
with independent dependencies and no interruption to another terminal's work.
User then explicitly authorized fixing the build/CI blockers needed to complete
the upgrade, superseding the initial leave-existing-tests boundary. This remains
a narrow workstream02 follow-up, not the full prelaunch audit.

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
- One batched `GRAPHIFY_MAX_WORKERS=2 graphify update .` completed; no AST graph
  topology change. Exact open-work-index semantic refresh/cache readback passes:
 21,926nodes; all unrelated graph data and existing communities preserved.
- Open draft [PR354](https://github.com/Hamernick/CoachHouse/pull/354), source
  `9ebe010a4497bb294216778e849f2563779b96a5`, independently matched to remote.
  Final duplicate lookup found no equivalent open PR. Patch secret scan found0;
  normal Node22 pre-push passes in8.58s, including full cached lint.
- Upgrade CLI outcome report executed once as failure because full verification
  remains blocked; no false success report. Telemetry was disabled.
- Required hosted quality/code-owner review and branch protection remain;
  application merge/deployment and production verification stay user-owned.
  A local safe install does not patch an already-running terminal or production.

## Authorized unblock continuation

The verification section above records the initial dependency-only revision.
The following continuation supersedes its build blocker and completion status.

- Fixed all56test diagnostics using complete typed fixtures/mocks and four script
  JSDoc annotations. Emitted runtime JavaScript for those scripts is byte-identical.
  Baseline comparison logs remain in `.tmp/next-security-{baseline,candidate}-types.log`.
- Full production build/types and201static pages now pass. Initial `/admin` bundle
  was2994.8KB against1000KB. A marked public `member-workspace/server.ts` facade
  avoids unrelated fiscal/document/client imports from the mixed feature barrel.
  Both import guards require an explicit root facade with an actual side-effect
  `server-only` import; private directory fallback/deep imports remain rejected.
  Admin now937.6KB; public1138.5/1975KB and community561.7/900KB also pass.
- Prior [CI39891857648](https://github.com/Hamernick/CoachHouse/actions/runs/39891857648)
  found three stale acceptance contracts. Org switching now exercises successful
  and denied invalidation behavior; font/finance checks follow current routes and
  composition. Acceptance project manifest regenerated.
- Browser DOM reproduced two real bugs. Immediate marketplace filter state ignores
  older URL snapshots that overwrote newer typing; Back dismisses local Find
  details rather than leaving results hidden. Direct profile/history behavior kept.
- Editor tests mock editable capabilities for their synthetic organization and
  assert focus/editability. Empty documents use the established direct editor
  contract. Production authorization/editor behavior unchanged.
- Eight affected local Playwright interactions pass: marketplace; Find1280/390;
  empty editor; Mission/Vision1440/390 with scrolling, save/discard/reopen. These
  temporary configs perform no macOS screenshot comparisons. Linux keyboard and
  canonical visual comparisons remain hosted gates.
- Three Drive references still show Stripe, intentionally hidden since PR269
  (`dbdec6c1`; acceptance explicitly requires Calendar/Drive). Prior Ubuntu CI
  expected/actual/diff images reviewed. Existing canonical Ubuntu reference workflow
  now includes this spec; retain only three reviewed Drive images from its artifact.
  No local baseline overwrite, threshold increase or budget weakening.
- Independent read-only review found no concrete regression/security issue in the
  server facade, guards, marketplace synchronization or Find dismissal.
- Final full acceptance/build/performance and one batched Graphify refresh running;
  exact logs in this lane's `.tmp/next-security-*`. Own3155dev server stopped after
  interactions; only Next's generated AGENTS suffix removed. Other lanes preserved.

Next: finish checks, commit/push this unblock slice to PR354, obtain canonical
Ubuntu references, review/retain only three Drive images, push and verify required
hosted `quality` on the final revision. Merge/deployment remain user-owned. No
database/provider/calendar/account/credential changes or production fix claimed.
