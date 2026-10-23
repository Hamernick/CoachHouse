# Public indexing correction

Original inputs: `/Users/calebhamernick/Desktop/Coach House Codex Workstreams/WORKSTREAMS.md`,
full packet 09 stage 1, packet 05 stage 1, and outside-audit handoff sections 1.1 and 1.5.
Continuation authorized by the user's instruction to keep working through the
saved list and shipping code after reviewing the concrete audit findings.

## Change

`/community` already has a real member page. With public sharing disabled it redirects
anonymous requests to login, yet the sitemap previously advertised it unconditionally.
Sitemap inclusion and page robots now follow the same existing public-sharing flag.
The page also has an accurate title/description instead of inheriting scaffold copy.
Root metadata now supplies an absolute base so existing relative canonical paths
resolve to the configured site origin. Sitemap, robots and profile metadata share
the same origin resolver and existing fallback order.
Login/onboarding redirects and community invitations are unchanged. No profile data,
publication flags, entitlements, fiscal policy or provider settings are mutated.

## Verification

- Ten focused tests pass: both sharing-flag states, preserved anonymous login gate,
  retained profile/Documentation sitemap entries, public origin precedence/fallbacks,
  malformed origin handling and existing pricing rendering.
- Changed-file ESLint and acceptance manifest check pass.
- Local rendered responses confirm pricing canonical `https://coachhouse.app/pricing`,
  Community `noindex, follow` plus its login redirect, and no Community sitemap entry.
- No visual behavior changed; no new appearance baselines required for this fix.
- Required hosted quality/code-owner review and exact-revision release approval remain separate.

## Remaining source findings

- Profile slugs reported as tests remain public; determine their intended publication
  state before changing records or adding an approval policy. Existing is_public filtering
  was verified; do not blacklist personal/organization slugs based only on their names.
- Fee wording has a material source conflict: the October outside handoff describes 7%
  on incoming donations, while `docs/plans/2026-08-06-fiscal-sponsorship-policy-approval-packet.md`
  fixes the approved scope to grant allocations and explicitly leaves the fee base/trigger
  unresolved. Do not invent final fee copy or reopen the rejected in-app ledger.
- Three Workspace Tools visual references still reflect Stripe and omit Calendar Manage.
  Current/previous/difference artifacts are on the Desktop for the user's appearance review.

## Lane and recovery

Branch `fix/public-indexing-20261013`, worktree
`/Users/calebhamernick/Development/coach-house-platform-public-indexing-20261013`,
base `ce1436a2`. Draft [PR #293](https://github.com/Hamernick/CoachHouse/pull/293).
Verified rendered responses with the locked dependencies on port 3119; the task server was stopped afterward.
SHIP-000's original release record remains preserved/blocked; this is an isolated
implementation candidate, not a fabricated closure or a second active release claim.
