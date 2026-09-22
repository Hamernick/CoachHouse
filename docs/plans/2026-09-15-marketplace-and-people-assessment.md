# Marketplace and People assessment — September 15, 2026

## Product and source

User approved continuing the inventory and requested the Marketplace header/filter layout from the four supplied color-library/coss.com screenshots. Implemented in Profile draft #239 at `f2fe76cf`; five source files and the updated browser regression match root localhost. No production release.

The catalog contains 23 resource records. People separates three fixed Coach House coaching cards from opted-in public person profiles. Bandto localhost rendered one published profile during this review; this is an observed directory result, not a count of accounts or eligible members. The catalog and People owners are absent from inspected main `cb9287b1` and #229 `4c42e323`, present in preserved baseline `be09d23a`, Documents #238 `702b2a8d` and Profile #239. They still need focused release separation from this draft stack.

## Current behavior

- Large heading, short subtitle, compact category pills, resource search and searchable category/purpose/stage/access menu. Active filters are removable chips. Existing resource cards and Ad Grants content remain; the feature promotion now follows the results.
- Filter state remains in the URL. Corrected existing query defects: normalization removed spaces during typing; the filter sentinel incorrectly cleared a literal “all” query.
- Resource shortlist/export implementation is unchanged. Prior hosted tests cover save/reload/CSV; 52 focused acceptance tests covering Documentation, Marketplace and public People pass in this session.
- Desktop light/dark and mobile 390/320px verified in Bandto. No page horizontal overflow; mobile filter trigger 44×44px, 320px popup fits the viewport. Combined Software + Free if eligible returned two resources after reload. Keyboard menu search/Enter and chip removal/clear work. Original light theme and normal viewport restored.

## Authority, configuration and limits

People reads `public_person_profiles` with `is_public=true`, then valid person handles. Its explicit projection exposes display name, headline, public location label, HTTPS avatar and public handle link; no account/contact/private profile fields. This is the current person directory, superseding older notes describing organization Community previews. Existing public-profile configuration already returns a published member locally; no migration or publication changes were made.

Coach links lead Joel/Paula to `/coaching` and Franklin to the public contact page. No booking/contact submission or capacity verification. Catalog provider terms were not refreshed in this layout review; recorded dates and primary-source links remain the verification boundary. No OAuth, provider, account or database mutations.

## Remaining technical/release checks

- Hosted static/acceptance/RLS/build and the new interaction regression pass at `f2fe76cf`; both Previews are Ready and live filtering/People round-trip/search pass. Reviewed the five intentional Marketplace/People visual differences and updated only those Linux references in `0b6a3f4a`. Final full CI35017956570 at `0b6a3f4a` passes every quality lane; both Previews are Ready. Prior visual totals: 140 passed, four unrelated cases passed on retry, five reviewed screenshot failures. These draft checks do not authorize production release.
- People pagination originally dropped resource filters on a page change. Fixed locally September15; see the follow-up below. Production deployment remains pending.
- Catalog filtering/shortlist are local workflows; production route availability and live provider eligibility/booking remain separate checks.
- Brand Identity storage/export reliability fixes are implemented locally; see its assessment follow-up. First-login confirmation remains user-deferred.

## Safety and recovery

Original touched files are preserved at `/var/folders/l2/jpghvb_52t10fnrzxcs0bpd40000gn/T/coach-house-marketplace-layout-fm7gk13v`. Root and existing Profile monthly-log changes were preserved. Hosted validation replaces the local pre-push full gate for this authorized push under the explicit no-full-local-suite/build constraint. No new server, Graphify refresh, merge or release.

## September15 — People pagination repair

Previous/More profiles now copy the current URL query and change only the view/page. A small client pagination component reads current search parameters; the People directory remains server-rendered. Search, category, purpose, stage and access survive page changes and returning to Tools & resources. Styling and directory visibility are unchanged.

Nine focused workflow tests pass, including previous/next filter retention with encoded punctuation and pagination without filters. Scoped lint, feature contract, React Grab ownership and whitespace checks pass. Bandto localhost: opened empty page2, followed Previous profiles to the real published profile on page1, returned to resources and retained Google Workspace search plus Software/Technology/Forming/Free if eligible, with one matching resource and no horizontal overflow. Only one public profile was available; live forward traversal through a populated second page was not exercised. Both directions are covered by the URL regression tests.

Four owned source/test files match Profile and root localhost. Recovery originals: `/var/folders/l2/jpghvb_52t10fnrzxcs0bpd40000gn/T/coach-house-people-pagination-4qe3q058`. This repair and later34-resource/logo/card/Brand Identity refinements are local and uncommitted; earlier hosted quality at0b6a3f4a does not validate them. No database/provider changes, new server, full local build/suite, commit, push or release. Next: reconcile Calendar with the approved mobile layout.
