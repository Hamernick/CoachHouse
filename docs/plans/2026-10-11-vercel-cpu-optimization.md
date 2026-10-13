# Vercel CPU optimization

Branch: `fix/vercel-cpu-optimization-20261011`, based on production/main
`0819df5f`. User upgraded to Pro and authorized implementation on an isolated
branch. Existing development lanes and production settings remain separate.

## Baseline and scope

Read-only Vercel observation on October 11: coachhouse used approximately 3h 58m
of Active CPU over 30 days. The available 12-hour route breakdown showed `/` at
164 invocations / 42s, coaching reconciliation at 744 / 40s, marketplace detail
at 30 / 3.93s, and resource index at 10 / 2.07s. These samples do not attribute the
full month or establish expected savings. Anonymous production `/` returned
private/no-store and a CDN MISS.

First patch:

1. Share verified `getUser()` results within a React server render, keyed by the
   existing Supabase client. Reuse in the map viewer and authenticated app context.
   Preserve each caller's error policy; do not persist authentication across requests.
2. Exclude only the coaching cron endpoint from browser-session Proxy processing.
   Its existing timing-safe bearer-secret check remains the authorization boundary.
   Other APIs, login redirects and session refresh remain intact.
3. Avoid constructing a browser-session client for GET/HEAD public pages with zero
   cookies. Cookie-bearing requests (including unrelated cookies, malformed auth
   cookies and chunked auth cookies), APIs, POSTs and guarded routes retain the
   existing verification. Cookie contents never establish authorization.

## Documentation basis

- [React cache](https://react.dev/reference/react/cache): request-scoped RSC
  memoization, including concurrent calls; outside RSC the function remains uncached.
- [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs):
  preserve server-verified users and browser session refresh. Never authorize from
  unverified cookie contents or a cached session shared between users.
- [Next.js Proxy](https://nextjs.org/docs/app/api-reference/file-conventions/proxy):
  statically analyzable matchers and the installed Next 16.2.6
  `unstable_doesMiddlewareMatch` helper for route coverage (newer docs rename it).
- [Vercel CPU guidance](https://vercel.com/docs/functions/usage-and-pricing): CPU
  covers execution rather than external-service waiting. Reduced calls/load work
  are evidence of removed work, not a measured production billing reduction.
- [Vercel function startup](https://vercel.com/blog/introducing-bytecode-caching-for-vercel-functions):
  loading/compiling JavaScript contributes to cold starts; defer dependencies until used.

## Risks and deferred changes

- Cache scope and cron authorization are the key regression risks. Test actual
  React server rendering across concurrent users/requests and invalid cron secrets.
- Full-page caching needs a separate design because root locale cookies, viewer
  identity, search parameters and personalized navigation affect output. No forced
  static rendering, shared private-page cache, locale changes or auth shortcuts.
- No change to calendar frequency or past-booking eligibility: these could delay
  external updates or alter refunds. No Google, Supabase or Vercel configuration
  changes, migrations, new paid services or visual changes.
- Deferred calendar dependency imports were evaluated and removed: the production
  route startup probe loaded 3,125,698 bytes / 143 modules before and 3,128,667 bytes /
  146 modules after. Five-process median CPU was 479ms versus 489ms on this shared
  development machine. This noisy startup-only probe showed no benefit; the final
  patch retains the original calendar processing implementation.

## Validation and release

Run focused auth/cache, Proxy and cron behavior tests; existing map/coaching/access
regressions; changed-file ESLint and relevant structure/feature/boundary guards.
Build with placeholder credentials to catch production bundling and matcher errors
without accessing live account data. Record any baseline build blockers separately.
Use the actual React server renderer to establish deduplication and request isolation.
Update Graphify after code changes. Required current-head hosted quality, review,
merge and production readback are separate gates. Revert this scoped patch to roll
back; there is no data migration or provider-setting rollback.

## Verified work reductions

| Case | Before | After |
| --- | --- | --- |
| Cookie-free public GET/HEAD in Proxy | Construct client and call `getUser` | Neither operation |
| Map viewer + app context using the same RSC client | Two `getUser` calls | One request-scoped call |
| Exact coaching cron URL | Browser-session Proxy, then bearer verification | Bearer verification only |

The cache test uses the installed React server renderer, including concurrent
consumers, different clients, concurrent requests, a later identity, logout, and
uncached calls outside RSC. Consumer tests retain the distinct public/private
error policies. Proxy tests retain cookie-bearing requests, POSTs, APIs, redirects
and refresh cookies; matcher tests retain similar-looking cron paths. Cron tests
exercise missing/weak/wrong secrets, empty queues, failures, creation, updates,
deletion, cancellation refunds, rescheduling, optimistic guards and the deadline.

Focused suite: 88 tests across seven files pass. Changed-file ESLint, acceptance
inventory, boundaries, features, routes, structure and threshold checks pass.
The existing structure warnings and prototype presenter-audio tracing warnings
are unrelated to this patch. Final production build and HTTP smoke results are
recorded in the October runlog. Hosted release checks remain separate.
