# Bound public sitemap database lookups

## Report and cause

Caleb supplied the failed Vercel build for main `7a984bfd`: compilation and TypeScript passed, but `/sitemap.xml` exceeded the 60-second static-generation deadline three times. The public-profile handle query reported an upstream request timeout. The lookup had no application deadline. It was introduced by public-profile PR225 (`6e0b0279`), before the fiscal changes; its recent indexing changes do not establish the cause of the upstream slowdown.

The separate NFT warning traces to the older presenter-audio prototype route (last changed by PR121). It is nonfatal and is not expanded into this fix. PR317's local-preview tracing patch is already present in the supplied main build.

## Scope and recovery

Production-stability packet01 scoped build follow-up. Reuse the clean isolated `coach-house-platform-resource-preview-tracing-20261015` checkout; branch `fix/sitemap-build-timeout-20261015`, base `7a984bfd`. Preserve previous branch, root dirt, fiscal3127 and all other servers/worktrees. Vercel deploys main; no operator checkout switch is required for production. No new localhost is needed.

Wrap the complete handle/publication lookup in one 10-second deadline and pass the same cancellation signal to all three database requests. An explicit promise deadline also settles if a transport ignores cancellation. Retain the existing empty-profile-list fallback on query failure, now also covering rejection and deadline expiry. Existing static/Documentation entries and 300-second sitemap revalidation remain unchanged. No publication predicates, UI, data, schema, settings or provider changes.

During an outage, profile URLs can be omitted from a generated sitemap until its next revalidation; public/private eligibility is never relaxed. This preserves the existing query-error fallback and bounds the formerly unbounded wait. Successful lookups retain profile metadata.

## Validation and stop

33 cases across public-profile sitemap, Documentation sitemap and public profiles pass. Includes a hung initial request, each hung publication request, one deadline across query phases, transport rejection, each returned query error, private exclusion, successful metadata, unavailable credentials and static-entry preservation. Changed-file lint, structure, manifest and diff hygiene pass; manifest registers the new integration file. Normal prepush and Graphify completion are recorded at handoff.

No full local build or quality suite and no hosted polling, merge or deployment. Caleb owns hosted gates/review, the next real build and release. Codex stops at an open PR; local tests do not establish deployed build success.

References: [Supabase abortSignal](https://supabase.com/docs/reference/javascript/using-modifiers-abortsignal), [Next sitemap metadata](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap).
