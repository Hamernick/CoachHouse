# LIVE03 — published map coverage, duplicates, and location choices

Original packet: `05-public-profiles-discovery-collect.md`, B036/LIVE03. User expanded the reported RLS duplicate follow-up to all data feeding `/resources`, coordinate coverage, deduplication, and choosing among services at one address. Continue PR299 in `fix/public-resource-test-records-20261013`; PR298 banners remain separate. User handles visual checks. No Supabase preview, production mutation, or repeated PR297 merge check.

## Coverage and limits

Read-only production snapshot, 2026-10-13: all 877 published external rows, all 877 underlying locations for their organizations, and all 21 public platform organizations. Every published service has exactly one eligible location row; none loses a second location through the primary-location projection.

Two RLS fixtures are excluded. The remaining 875 external service records become 871 places through four confirmed pairs: Polish American Association, Legler Regional Library, Evening Star, and Iglesia Evangelica De Cristo. Both original IDs, contacts and individual schedules remain resolvable. Same names at different streets stay separate. Same street alone never merges resource identity.

Current dataset with this code produces 826 marker features representing all 869 coordinate-eligible place/platform listings. There are 33 markers with multiple choices. These are data-to-feature checks; user visual verification remains open. Marker eligibility means finite, non-placeholder coordinates within the renderer's range, not a fresh verification of every provider address. Field completeness among retained service rows: 836 have title, street, city, state, country and usable coordinates; 875 have title, source URL and categories; 853 have a provider website, public link or public contact. All 875 retained service records retain their existing external-data verification classification; no blanket provider re-verification is claimed.

17 external records lack usable coordinates: four public contact addresses have a concrete repair below; two shelter listings have administrative addresses rather than public shelter locations; six are online/service-area listings without a street; four have `(0,0)` placeholders and no street; one says “Multiple locations.” All six platform records without coordinates are explicitly online-only. No invented centroid pins.

The IRS directory is a separate identity dataset, estimated at 1,975,871 public rows by the current query planner. Its public schema has no street coordinates; every directory result is explicitly constructed with null coordinates. EIN is the primary key, and its public view excludes EINs already owned by platform/curated records. This is a schema/identity-boundary audit, not a row-by-row review of two million organizations or proof they offer walk-in services. Private discovery/import candidates remain unpublished.

One additional platform data-quality finding: Southside Community Table is identified as a recording fixture in `src/features/member-workspace/server/project-loaders.ts`. It is online-only and contributes no marker. Its public-list cleanup is recorded as outstanding; do not infer that other unfamiliar organization names are synthetic.

## Behavior changes

- Shared-marker clicks clear selected detail state and open the existing list of choices. They never invoke navigation for the first item; choosing an item does.
- Preserve the street in compact payloads. Match normalized street/locality and coordinates within 250m for a shared marker, retaining separate listings. Preserve suites, distinct addresses, and all group members. Exact-coordinate collisions also use the chooser.
- Fetch every 500-item page for the current viewport. Stop stale requests, reject mixed revisions/repeated cursors, and surface later-page failures for retry. Invalid coordinates no longer consume map-page results.
- Keep conservative automatic place identity (name/address/provider/verification/60m); add only two audited ID/title aliases for Evening Star and Iglesia. Different schedules remain separate services. No fuzzy nationwide entity merging.

## Four prepared coordinate repairs — not applied

Reviewable SQL: `docs/shipping/data-repairs/2026-10-13-resource-coordinates.sql`. It matches exact location/service IDs and current addresses, requires both coordinates still null and the service still public, and returns changed rows in a transaction. Four expected updates; repeat runs update zero. Execute deliberately against the existing production project after release review; inspect returned IDs before committing. This file is not an automatic migration.

| Resource | Public address evidence | Coordinate evidence |
| --- | --- | --- |
| Casa Esperanza | https://casaesperanzachicago.org/contact/ | US Census current address match: 41.735396010419, -87.559607537896 |
| MYSI | https://www.myschicago.org/programs/ | US Census current address match: 41.691563926184, -87.696234647443 |
| Fellowship Housing | https://www.fhcmoms.org/how-it-works | US Census current address match: 42.059949866629, -88.143403143242 |
| La Casa Norte / Solid Ground | https://www.lacasanorte.org/s/LCN-2022-Annual-Report-Final.pdf and current published same-address provider services | Reuse existing provider contact-location coordinates: 41.909659, -87.715649 |

Coordinates describe public contact locations, not a claim that residential units or walk-in intake are available there. Census matches are street-level. The raw Census match responses and URLs are in the private Desktop audit folder.

CAWC explicitly calls Greenhouse Shelter confidential: https://www.cawc.org/greenhouse/. Pillars identifies its 5220 East Avenue address as an administrative office: https://pillarscommunityhealth.org/services/; its Constance Morris House handout identifies the shelter location as undisclosed. Neither administrative address is geocoded as a shelter.

Alias evidence: Evening Star's two published records share exact address and phone but different service days; https://www.chicagosfoodbank.org/locations/operation-blessing-evening-star/ confirms provider name/address/phone. Iglesia's two published Feeding Illinois records have identical street/locality, email and hours, with a one-letter name variation and ~178m coordinate difference. Both remain accessible through original IDs. St Clement's/MJ's is not merged: same address with different names/hours and conflicting phone prefixes is insufficient identity evidence.

## Evidence and stop boundary

Private handoff: `~/Desktop/Coach House Map Audit/` contains all audited published resource rows, public location summaries, underlying locations, exact exception/duplicate/shared-marker lists, Census results, and SHA-256 manifest. No private organization profiles or credentials are copied.

Stop after the bounded code PR and reviewed coordinate correction step, current-head quality/code-owner review, deployment, and the user's map check. Do not claim production removal, new pins, comprehensive address verification, or IRS geocoding from local tests. Preserve PR298 and later Calendar/fiscal work. Do not delete resource rows or lose saved/deep-link IDs.

Validation: 128 focused behavior tests pass across ten files; complete data-to-feature audit passes. Changed-code ESLint, structure, features, thresholds, import boundaries, acceptance manifest and diff hygiene pass. Graphify refresh is in progress. Required hosted quality/code-owner review remains open.

## Review follow-up: claims and cached public profiles

The bot review of43b84630 identified two remaining leaks. Claim search and submission now apply the same fixture/Wikidata visibility rule using title, organization name and source identity. Fixture-only targets are rejected before any claim recording/delivery. A bounded set of service rows allows legitimate services after hidden rows. The public profile page's independent cache key advances fromv1 tov2. Three failing regressions reproduce the old behavior;30focused fixture/claim/directory tests pass after correction. No live records deleted, data repair applied, claims sent or production result asserted.
