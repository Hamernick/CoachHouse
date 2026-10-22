# Retire public prototypes and consolidate login — October 22, 2026

## Approved scope and lane

Caleb approved the retirement plan and explicitly included `/tester/login` and `/marketplace`. Original 01 bounded cleanup. Isolated `fix/retire-public-prototypes-20261022`, checkout `/Users/calebhamernick/Development/coach-house-platform-retire-prototypes-20261022`, initially based on `06f9fd87` from PR350. PR350 merged as `f00bca9d`; its tree exactly matches the initial base, so the cleanup is rebased onto current main before delivery without changing source. Preserve unrelated worktrees/listeners/root dirt and sharedSHIP40. No production/provider/database changes, real auth submissions, or deployment actions.

## Resulting behavior

| Old destination | Current destination |
| --- | --- |
| `/home`, `/legacy-home` | Permanent redirect to `/` |
| `/home-canvas` and retired content sections | `/`, preserving query values except old `section`/`embed` controls |
| `/home-canvas?section=login` | `/login` with invitation/return/error/notice/plan state |
| `/home-canvas?section=signup` | `/sign-up` with signup state |
| `/home-canvas?section=pricing` | `/pricing` with campaign/plan state |
| HomeCanvas auth code/token callback | Existing `/auth/callback`, before section routing |
| `/tester/login` | `/login` with query state |
| `/marketplace` | Permanent redirect to `/documentation/marketplace`, retaining supported search/filter fields |

`/login` now renders the established LoginPanel/LoginForm in the existing branded AuthScreenShell. Existing-session handling, password/Google auth, notices, errors, forgot-password and invitation return paths are retained. Both server and browser reject return targets that loop into login aliases. Mobile controls have 44px hit areas; desktop remains compact. Styling follows docs/design.md neutral theme tokens and existing auth primitives.

Map account-menu, shared Resources/Documentation header, and legal account-creation links now use canonical destinations. Global search uses the current Documentation marketplace catalog/detail URLs; deleted the obsolete marketplace renderer and its unused data catalog. Shared HomeCanvas-named shell/map/documentation components remain because active pages use them. No broad shared-component purge.

## Verification

- 181 distinct focused acceptance cases pass: 31 from login/search/map source coverage plus 150 from retired routes/auth-confirmation/recovery/Google/invites/pricing/Find/Documentation regressions. A final 10-case canonical-login rerun after scoped mobile sizing passes; counts are not added twice.
- Scoped ESLint and route/features/boundaries/structure/threshold/acceptance-manifest guards pass. Manifest: 552 files, 195 behavior / 62 contract / 11 CLI / 284 integration.
- Final full production build passes after mobile sizing: compilation 44s, TypeScript 117s, 201/201 static pages. Inherited presenter-audio NFT tracing warning remains; no image Edge warnings.
- All 8 targeted production Chromium tests pass in 16.1s: three retired homepage redirects, preserved confirmation/invitation state, rejected-password recovery, tester login, Resources sign-in and marketplace redirects. [Desktop/mobile review captures and measurements](../qa/retire-prototypes-2026-10-22/README.md) confirm no overflow and 44px mobile controls.
- Old prototype-only visual assertions and their three screenshots are retired because those pages no longer exist. Replaced with redirect/auth behavior coverage; retained Resources coverage and updated the fiscal signing-return expectation to `/login`. No active screenshot baseline overwritten or threshold weakened. New login captures are review evidence, not appearance approval or Linux baseline updates.
- Graphify refresh and final catch-up after the discovered obsolete test contracts/mobile adjustment completed: 21,893 nodes / 62,873 edges / 1,224 communities. No overlapping jobs.

## Reproduction and recovery

Use Node22.13.0 and frozen-lockfile dependencies installed only in this lane. Local preview 3144 uses the production build; prior 3142 and Particle 3008 untouched. Private evidence: `/tmp/coach-house-retire-prototypes-20261022/`.

```sh
pnpm exec next build
pnpm exec vitest run --config vitest.config.ts tests/acceptance/login-page.test.ts tests/acceptance/public-home-login-redirect.test.ts tests/acceptance/search-route.test.ts tests/acceptance/login-form-existing-session.test.ts tests/acceptance/public-home-surface.test.ts tests/acceptance/auth-confirmation.test.ts tests/acceptance/auth-recovery.test.ts tests/acceptance/google-auth.test.ts tests/acceptance/organization-invite-acceptance.test.ts tests/acceptance/signup-accessibility.test.ts tests/acceptance/public-pricing-sign-up-links.test.ts tests/acceptance/build-collect-navigation.test.ts tests/acceptance/public-find-route.test.ts tests/acceptance/public-find-performance-contract.test.ts tests/acceptance/nonprofit-documentation-marketplace.test.ts tests/acceptance/nonprofit-documentation-search.test.ts
pnpm exec playwright test --config .tmp/retirement.playwright.config.ts --grep 'retired homepage|old login bookmarks|canonical login|tester login|old marketplace|Resources sign-in'
```

The local Playwright configuration runs behavior assertions only on the production server, using installed Chromium; it does not bypass the Ubuntu-only visual baseline workflow. The fiscal authenticated spec is updated but not executed: no production test users/records are created. Tests and mocked browser auth do not establish real-account/provider acceptance.

Rollback: revert this cleanup PR only, leaving350's independent Edge image fix intact. Old routes can then render as before; no data migration or restoration is involved. Caleb owns hosted quality/review, merge, deployment, appearance review and live auth acceptance. Open [PR351](https://github.com/Hamernick/CoachHouse/pull/351) is ready for review.


## PR handoff

Source commit `e61b8e4068dd2f3a6b31c1b942b5df0e3acd080d` independently matches the remote branch. Rebase onto merged PR350 (`f00bca9d`) preserved the complete validated tree. Normal Node22 pre-push passed in 8.60s; staged binary secret scan found zero findings. No source changes followed validation. Production preview remains at http://localhost:3144/login; inspect listener ownership before restarting it with `pnpm exec next start -p 3144`. Hosted quality, review, merge, deployment and live acceptance remain pending with Caleb.


## Review correction — authenticated login return paths

Caleb approved the P2 correction in PR351. The proxy previously intercepted authenticated `/login` requests before the page could honor their destination. It now uses the existing safe post-login redirect helper after preserving invitation normalization. Signup behavior, session-cookie copying and downstream authorization remain unchanged; tester pages stay retired. Four cases reproduce the failure before the fix, including the complete retired tester page → canonical login proxy chain. All 101 focused cases across proxy auth, retired routes, canonical login and existing-session form suites pass afterward. Unsafe/external URLs and login loops fall back to `/workspace`. Scoped lint, routes, boundaries, acceptance manifest, structure and threshold guards pass. Full build and browser evidence above predate this correction; no fresh full-build or production acceptance is claimed. Private logs: `proxy-before.log` and `proxy-after.log` in the existing evidence directory.
