# Resources return layout repair

## Report and cause

User reported an unwanted rounded parent around the map/category list after opening a profile with an EIN badge and returning to search. Reproduced in production: directly open `/coachhousesolutionsgroup`, click Back to search; URL becomes `/resources`, but `data-public-find-canvas` remains and `data-public-resource-unframed` is absent. A fresh `/resources` load has the correct unframed shell. Native `history.replaceState` changed only URL/selection, leaving the directly loaded profile's framed server layout mounted.

PR301 did not introduce the outer frame; the shell/framing code predates it in PR286 (7989b377). PR301 merged as dc46e157; primary coachhouse deployment reports success and live profiles render the EIN/blue check. Historical quality/review and shared SHIP gates are not retroactively passed by the external merge.

## Scope

Direct-entry embedded profile Back to search now uses Next router replacement to load `/resources` with current search parameters. Keep the profile visible while routing rather than briefly showing results inside its stale frame. In-list profile navigation retains native history back and existing list/scroll context. Non-embedded administrative dismissal remains local. No container redesign, badge change, new coordinates, data mutation or Supabase preview.

## Lane and validation

- Branch: `fix/resources-return-layout-20261014`; base dc46e157.
- Worktree: `/Users/calebhamernick/Development/coach-house-platform-resources-return-20261014`.
- Localhost3122; preserve EIN lane3121 and unrelated servers.
- Source: `src/components/public/public-map-index/use-public-map-profile-navigation.ts`.
-53 focused tests pass: public-home-surface, public-find-route, public-profile-ein and three new return-navigation cases. Tests retain query/filter parameters, distinguish real route replacement from URL-only changes, preserve in-list history and administrative dismissal. Lint, boundaries, structure, thresholds and diff hygiene pass.
- User review and final-head hosted quality/code-owner review remain required. Local browser reproduction/repair evidence appended after verification.
- Shared SHIP revision40 ownership-host mismatch remains; do not mutate canonical state or bypass it. Private original sources: packet05 and05a/05b; this is a user-reported regression follow-up, not coordinate run05C.

Stop after this repair's review/release handoff. No automatic move to coordinates or Calendar.


## Follow-up: remove the shared outer frame

User confirmed PR302 merged and reported the unwanted parent still present after refresh. Accept that merge report; do not recheck it. The earlier repair addressed only navigation, while directly loaded organization/resource profiles still selected framed mode by default.

The shared PublicHomeResourceExplorer now always uses `frameCanvas={false}` and the unframed scrolling/dock surface; remove its framed/unframed option and the now-redundant `/resources` prop. Keep profile header navigation and the EIN/badge. Map-specific chrome and internal profile sections remain unchanged. No route can opt this explorer back into the unwanted outer frame.

Branch `fix/resources-unframed-shell-20261014`, base1376e12d, same isolated `coach-house-platform-resources-return-20261014` checkout and localhost3122 (warm server/cache preserved).36 focused public-home/route/navigation tests and changed-file lint pass. Browser verifies direct organization load has zero outer-frame elements with badge present; Back to search has zero frames and the unframed marker. First browser request briefly used the previous dev compilation; reloaded after the updated server HTML was confirmed.

Direct IRS profile response and scoped checks are recorded in the final PR/checkpoint. User review and current-head hosted quality/code-owner review remain required. No production mutation or Supabase previews; SHIP revision40 host reconciliation remains unresolved. This supersedes the earlier repair's sufficiency claim; coordinate work remains separate.


## PR303 review: mobile profile header clearance

The unframed profile header has two rows below md, so the fixed48px content inset overlapped Back to search. Direct organization/resource profiles now opt into a normal-flow header and use4px content padding; the flex scroll area automatically starts below the header's actual height. Resources list keeps its existing absolute header and48px inset. Shared shell defaults are unchanged; no outer frame is restored.

Verified at390×844: both `/coachhousesolutionsgroup` and `/find/resources/146024895` have header bottom94px and Back to search top106px, with zero outer-frame wrappers and EIN badges present. Resource Back to search reaches `/resources`, header bottom48px, zero frames and scrollTop0. Temporary viewport override reset.36 focused tests, changed-file lint, structure and diff checks pass. Required current-head hosted quality/code-owner review and user appearance review remain separate; no deployment.
