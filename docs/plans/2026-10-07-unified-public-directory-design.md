# Unified public directory presentation

Continue `feat/frontpage-20261007` on localhost:3000. The IRS acquisition and
publication workstream remains independently owned; this change does not import,
publish, geocode, or rewrite records.

## Chosen design

Use one listing presentation and the existing screen/profile overlay for public
platform organizations, curated resources, and published nonprofit identities.
Replace the separate nonprofit accordion and next/first controls with the common
bounded list and Load more control. Preserve independent server cursors behind
that control; national data must never be downloaded as a full browser catalog.

Adapt published nonprofit identities to the shared presentation shape with an
explicit nonprofit provenance field and stable `nonprofit:<EIN>` identifiers.
This is a view-model adapter, not a conversion into verified service records.
Keep IRS records searchable without coordinates. Do not infer pins, operating
status, service eligibility, or visitable addresses from filing information.
Existing server publication, suppression and EIN precedence rules remain in force.
A future curated record can supply a real pin while replacing its IRS duplicate
through the existing database projection.

Open these records through the existing selection/profile flow. A dismissible
notice above profile identity explains the IRS source and unconfirmed operating,
service and location information. Preserve EIN and per-field filing provenance
in profile details after dismissal. Use filing-location wording and no fabricated
service sections. Keep saved-record resolution bounded; do not offer the curated
resource mutation/share endpoint for IRS identities.

The Active badge represents the complete public directory, not pins or operating
status. Use the public projection's planned count plus platform/curated counts,
mark the total approximate, and cache for five minutes. Exact counting exceeded
a five-second probe; planned count returned in about 350 ms. The count request
runs independently of search and map loading. Query-specific results show a plus
suffix while more records remain rather than pretending a loaded page is the total.

## Alternatives considered

- Restyling the separate accordion leaves duplicate navigation and pagination.
- Physically merging IRS identities into resource tables risks losing publication
  distinctions and crosses the independently owned data workstream.
- The shared presentation adapter provides consistent UI while retaining provenance
  and existing security boundaries.

## Verification

Focused adapter/API/count tests, existing directory/sidebar tests, and targeted
browser checks cover one list, profile dismissal, pagination, stable map identity
and catalog count. No database migration or visual baseline update is required
for local product review. Hosted quality/protection remains required to ship.
