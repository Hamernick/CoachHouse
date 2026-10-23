import { describe, expect, it } from "vitest"

import { buildBrooklynNonprofitDirectoryRecords } from "../../scripts/resource-map/lib/brooklyn-nonprofit-directory.mjs"
import { normalizeCandidateRecord } from "../../scripts/resource-map/lib/data-engine/normalizer.mjs"

function row(overrides: Record<string, string> = {}) {
  return {
    "Address Type": "Food Bank service location(s)",
    "Addresses / Locations": "342 Willis Avenue, Bronx, NY, 10454",
    "Contact Email(s)": "",
    "Contact Phone(s)": "718-292-9321 ext.110",
    Coordinates: "40.8101, -73.9231",
    "Data Sources": "Food Bank For NYC map",
    Description:
      "Food Bank For NYC member providing food pantry across one listed service location.",
    "Eligibility / Notes": "",
    Facebook: "",
    "Food Bank Data As Of": "2025-04-28",
    "Food Bank Sites": "1",
    Instagram: "",
    "Issue Areas": "Food Access",
    LinkedIn: "",
    "Locations Served": "Bronx",
    "Match Confidence": "",
    Organization: "Abraham House Inc.",
    "Record Type": "Food access organization",
    "Research Status": "Map data only",
    "Resource Guide Listings": "",
    Retrieved: "2026-07-30",
    "Service Hours / Frequency": "Pantry - Sat: 09:00 AM - 11:00 AM - Weekly",
    "Services / Offerings": "Food pantry",
    "Source URLs": "https://example.org/food-map",
    TikTok: "",
    Website: "https://abraham.example.org",
    "X / Twitter": "",
    "YouTube / Vimeo": "",
    ...overrides,
  }
}

describe("Brooklyn and NYC nonprofit directory ingestion", () => {
  it("builds a held, source-linked physical service candidate", () => {
    const [record] = buildBrooklynNonprofitDirectoryRecords([row()])

    expect(record).toMatchObject({
      sourceId: "brooklyn-nyc-nonprofit-directory-2026-07-30",
      sourceUrl: "https://example.org/food-map",
      extractedFields: {
        address: "342 Willis Avenue, Bronx, NY, 10454",
        latitude: 40.8101,
        longitude: -73.9231,
        organizationName: "Abraham House Inc.",
        serviceTitle: "Food pantry",
        websiteUrl: "https://abraham.example.org",
        contacts: [],
        enrichment: {
          publicResourceEligible: true,
          sourceComparisonCount: 1,
          verification: { status: "needs_review" },
        },
      },
    })
  })

  it("splits multi-location rows without claiming aggregate services are verified per site", () => {
    const records = buildBrooklynNonprofitDirectoryRecords([
      row({
        "Addresses / Locations":
          "1. 50 West 132nd Street, New York, NY, 10037\n2. 215 Beach 77th Street, Arverne, NY, 11692",
        Coordinates: "",
        Organization: "Bethel AME Church",
      }),
    ])

    expect(records).toHaveLength(2)
    expect(
      new Set(
        records.map((record: { sourceRecordId: string }) => record.sourceRecordId)
      ).size
    ).toBe(2)
    expect(records[0].extractedFields.enrichment).toMatchObject({
      publicResourceEligible: false,
      qualityNotes: expect.arrayContaining([
        "services_aggregated_across_locations",
      ]),
    })
  })

  it("holds mismatched numbered coordinates instead of assigning them to the wrong address", () => {
    const [record] = buildBrooklynNonprofitDirectoryRecords([
      row({
        "Addresses / Locations":
          "2. 5402 New Utrecht Avenue, Brooklyn, NY, 11219",
        Coordinates: "1. 40.6324813, -73.9992683",
        Organization: "Masbia of Boro Park",
      }),
    ])

    expect(record.extractedFields).toMatchObject({
      latitude: null,
      longitude: null,
      enrichment: {
        qualityNotes: expect.arrayContaining([
          "source_coordinates_not_safely_assignable",
        ]),
      },
    })
  })

  it("keeps no-address organizations list-only with their stated service area", () => {
    const [record] = buildBrooklynNonprofitDirectoryRecords([
      row({
        "Addresses / Locations": "",
        Coordinates: "",
        "Locations Served": "Central Brooklyn; North Brooklyn",
        Organization: "651 ARTS",
        "Record Type": "Organization",
      }),
    ])

    expect(record.extractedFields).toMatchObject({
      address: null,
      locationType: "service_area",
      serviceArea: ["Central Brooklyn", "North Brooklyn"],
      enrichment: { publicResourceEligible: false },
    })
  })

  it("does not treat human-service organizations with Rescue in their name as animal resources", () => {
    const [record] = buildBrooklynNonprofitDirectoryRecords([
      row({
        Organization: "Brooklyn Rescue Mission Urban Harvest",
        "Services / Offerings": "Food pantry",
      }),
    ])
    const normalized = normalizeCandidateRecord(record)

    expect(normalized.extractedFields.resourceCategories).toContain(
      "food_food_pantries"
    )
    expect(normalized.extractedFields.resourceCategories).not.toContain(
      "animals_rescue"
    )
    expect(normalized.extractedFields.resourceCategories).not.toContain(
      "animals"
    )
  })
})
