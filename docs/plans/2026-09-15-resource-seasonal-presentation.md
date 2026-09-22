# Seasonal resource presentations

## Behavior

A cooling-center host keeps its normal facility listing during ordinary browsing below the existing heat threshold. The same resource ID switches to its cooling presentation when the weather service reports an official alert or forecast threshold. Unknown/no weather defaults to the normal version. The weather threshold and eligibility rules are unchanged.

September 15 clarification: below the heat threshold, always show normal versions, including explicitly opened cooling guides and searches. Navigation intent cannot activate cooling presentations. A record without an identifiable normal place stays seasonal; no ordinary service is invented.

## Implementation

- Resolve a client presentation before category/search filtering and map marker creation. Preserve source records, IDs, coordinates, links, verification and visibility.
- Remove seasonal title decorations. Prefer supplied ordinary categories, then conservative facility-name hints such as library, senior center, recreation site or school. Existing evidence status remains unchanged.
- Suppress cooling-only descriptions, services, event hours and availability in the normal presentation; those do not establish ordinary service availability.
- Apply the same presentation to full details, ordinary guides and saved resources. Cooling guides retain source membership but display the weather-appropriate version. Retain saved IDs against the original source inventory. A heat-only record without an identified ordinary place is unavailable below the threshold; its saved ID remains intact and its listing returns when the weather gate opens.
- Prevent an emptied seasonal projection from activating synthetic seed fallback.

## Validation

- 96 targeted root checks and 72 targeted Mobile checks pass; suites overlap and are not an additive count. Focused ESLint, import boundaries, structure and whitespace pass.
- Historical pre-clarification canary (the explicit-query override is now superseded): Brooklyn Central Library appears under Libraries in ordinary search. Its full details preserve the ordinary name/category. Adding cooling to the query restores Cooling Centers and the cooling detail title. Ordinary search returns to Libraries. No Collect/Share or data action performed.
- Offline census of the explicit curated preview: 5,046 records adapted, including 3,542 cooling-category records. All 3,542 produce ordinary presentations with the same IDs; zero retain the cooling category or cooling-center title decoration. All originals are restored by the active-heat presentation. This is a presentation census, not a live count or evidence of verified service availability; no new records were verified or published.
- Actual weather-alert transition has not been exercised live. Existing weather tests cover threshold calculation; presentation tests cover both modes. No provider settings or weather data changed.
- Source is synchronized by focused edits across root localhost, Profile and Mobile; branch-specific code and test fixtures are preserved. Hosted checks follow the draft pushes. Production remains held.

## Review scope

No database/data/schema or provider changes. No new server, full local build/suite or Graphify refresh. Existing cross-source duplicate facilities and unresolved resource-content evidence remain separate assessment work.

## September 15 clarification implemented

- Removed query/category/guide overrides from weather selection and cooling-guide presentation. Existing official-alert and forecast-threshold signals remain the only activation conditions; none/unknown/missing signals use ordinary versions. Saved-list fallback cannot restore a raw seasonal listing below threshold. Loaded details retain the selected ordinary presentation.
- Focused root resource/layout checks:96 pass. Mobile resource/location checks:71 pass; these suites overlap. Regressions cover both cooling-guide modes, all weather signals and saved ID retention.
- Bandto localhost at66 degrees: Cooling and Heat Relief shows3,542 ordinary resource versions, including125th St Library under Libraries and playgrounds under Recreation. This is display verification, not service verification. Actual heat-alert transition remains test-covered but has not occurred live during this review.
- No source records, saved IDs, provider settings or production changes. Recovery archive: /var/folders/l2/jpghvb_52t10fnrzxcs0bpd40000gn/T/coach-house-weather-only-cooling-5ernpwlc .

- Follow-up search regression: retaining the original seasonal title as a search alias lets explicit cooling queries find the ordinary host. Display title/category remain normal; source records and existing aliases are unchanged. The query regression failed before the alias correction.
- Final Bandto canary: searching "Brooklyn Central Library cooling" returns the two existing source records, both displayed as Brooklyn Central Library / Libraries at66 degrees. No cooling presentation is reactivated.
