import { describe, expect, it } from "vitest"

import type { PublicMapOrganization } from "@/lib/queries/public-map-index"
import {
  buildPublicMapSearchIndex,
  filterPublicMapOrganizationIds,
} from "@/components/public/public-map-index/search-index"

function buildOrganization(
  overrides: Partial<PublicMapOrganization> = {}
): PublicMapOrganization {
  return {
    id: "org-1",
    name: "Alpha Org",
    tagline: null,
    description: null,
    boilerplate: null,
    vision: null,
    mission: null,
    values: null,
    needStatement: null,
    originStory: null,
    theoryOfChange: null,
    formationStatus: null,
    contactName: null,
    logoUrl: null,
    brandMarkUrl: null,
    headerUrl: null,
    website: null,
    donateUrl: null,
    email: null,
    phone: null,
    twitter: null,
    facebook: null,
    linkedin: null,
    instagram: null,
    brandPrimary: null,
    brandColors: [],
    brandThemePresetId: null,
    brandAccentPresetId: null,
    brandTypographyPresetId: null,
    brandTypography: null,
    brandKitAvailable: false,
    latitude: 40.7128,
    longitude: -74.006,
    address: null,
    addressStreet: null,
    addressPostal: null,
    city: "New York",
    state: "NY",
    country: "United States",
    locationUrl: null,
    publicSlug: "alpha-org",
    activityLinks: [],
    programPreview: null,
    programs: [],
    programCount: 0,
    groups: ["community"],
    primaryGroup: "community",
    isOnlineOnly: false,
    ...overrides,
  }
}

describe("public map search index", () => {
  it("matches against indexed narrative and program fields", () => {
    const organizations = [
      buildOrganization({
        id: "alpha",
        name: "Alpha Org",
        originStory: "Started as a neighborhood food rescue collective.",
      }),
      buildOrganization({
        id: "beacon",
        name: "Beacon Org",
        programs: [
          {
            id: "program-1",
            title: "Family Justice Accelerator",
            subtitle: null,
            description: "A family justice public program.",
            activityKind: "Program",
            chips: ["Program", "Justice"],
            ctaLabel: "Apply",
            ctaUrl: "https://justice.example.org/apply",
            durationLabel: "12 weeks",
            imageUrl: null,
            locationUrl: null,
            locationType: null,
            startDate: null,
          },
        ],
      }),
    ]

    const index = buildPublicMapSearchIndex(organizations)
    const originResults = filterPublicMapOrganizationIds({
      searchIndex: index,
      query: "food rescue",
      appliedBounds: null,
      favorites: [],
      activeGroup: "all",
    })
    const programResults = filterPublicMapOrganizationIds({
      searchIndex: index,
      query: "justice accelerator",
      appliedBounds: null,
      favorites: [],
      activeGroup: "all",
    })
    const activityLinkResults = filterPublicMapOrganizationIds({
      searchIndex: index,
      query: "justice.example.org",
      appliedBounds: null,
      favorites: [],
      activeGroup: "all",
    })

    expect(originResults).toEqual(["alpha"])
    expect(programResults).toEqual(["beacon"])
    expect(activityLinkResults).toEqual(["beacon"])
  })

  it("keeps online-only organizations when bounds are applied", () => {
    const organizations = [
      buildOrganization({
        id: "mapped-org",
        name: "Atlas Org",
        latitude: 40.7128,
        longitude: -74.006,
      }),
      buildOrganization({
        id: "web-resource-org",
        name: "Beacon Resource",
        latitude: null,
        longitude: null,
        isOnlineOnly: true,
        locationUrl: "https://beacon.org/resource",
      }),
    ]

    const index = buildPublicMapSearchIndex(organizations)
    const results = filterPublicMapOrganizationIds({
      searchIndex: index,
      query: "",
      appliedBounds: {
        west: -75,
        south: 40,
        east: -73,
        north: 41,
      },
      favorites: [],
      activeGroup: "all",
    })

    expect(results).toEqual(["mapped-org", "web-resource-org"])
  })

  it("matches profile website and org-created activity link domains", () => {
    const organizations = [
      buildOrganization({
        id: "profile-source",
        name: "Profile Source",
        website: "https://mutualaid.example.org/start",
      }),
      buildOrganization({
        id: "resource-source",
        name: "Resource Source",
        programs: [
          {
            id: "resource-1",
            title: "Resource directory",
            subtitle: null,
            description: null,
            activityKind: "Web resource",
            chips: ["Web resource", "Digital"],
            ctaLabel: "Open",
            ctaUrl: null,
            durationLabel: "Ongoing",
            imageUrl: null,
            locationUrl: "https://resource.example.org/find-help",
            locationType: "online",
            startDate: null,
          },
        ],
        isOnlineOnly: true,
      }),
    ]

    const index = buildPublicMapSearchIndex(organizations)
    const websiteResults = filterPublicMapOrganizationIds({
      searchIndex: index,
      query: "mutualaid.example.org",
      appliedBounds: null,
      favorites: [],
      activeGroup: "all",
    })
    const resourceResults = filterPublicMapOrganizationIds({
      searchIndex: index,
      query: "resource.example.org",
      appliedBounds: null,
      favorites: [],
      activeGroup: "all",
    })

    expect(websiteResults).toEqual(["profile-source"])
    expect(resourceResults).toEqual(["resource-source"])
  })

  it("matches activity resource categories without review labels", () => {
    const organizations = [
      buildOrganization({
        id: "profile-website",
        name: "Profile Website",
        website: "https://guide.example.org/start",
      }),
      buildOrganization({
        id: "online-resource",
        name: "Online Resource",
        programs: [
          {
            id: "resource-1",
            title: "Learning hub",
            subtitle: null,
            description: null,
            activityKind: "Web resource",
            chips: ["Web resource", "Digital"],
            ctaLabel: "Open",
            ctaUrl: null,
            durationLabel: "Ongoing",
            imageUrl: null,
            locationUrl: "https://learning.example.org",
            locationType: "online",
            startDate: null,
          },
        ],
        isOnlineOnly: true,
      }),
    ]

    const index = buildPublicMapSearchIndex(organizations)
    const resourceCategoryResults = filterPublicMapOrganizationIds({
      searchIndex: index,
      query: "web resource",
      appliedBounds: null,
      favorites: [],
      activeGroup: "all",
    })
    const reviewLabelResults = filterPublicMapOrganizationIds({
      searchIndex: index,
      query: "needs review",
      appliedBounds: null,
      favorites: [],
      activeGroup: "all",
    })

    expect(resourceCategoryResults).toEqual(["online-resource"])
    expect(reviewLabelResults).toEqual([])
  })

  it("matches resource domains from uncapped activity link metadata", () => {
    const organizations = [
      buildOrganization({
        id: "uncapped-resource-source",
        name: "Uncapped Resource Source",
        activityLinks: [
          {
            id: "older-resource",
            title: "Older Resource Library",
            subtitle: "Public benefit guides",
            description: "Continuity care navigation for mutual aid stewards.",
            activityKind: "Web resource",
            chips: ["Web resource", "Mutual aid"],
            ctaLabel: "Open library",
            ctaUrl: "https://library.example.org/open",
            durationLabel: "Ongoing",
            locationUrl: "https://library.example.org",
            locationType: "online",
          },
        ],
        programs: [],
      }),
    ]

    const index = buildPublicMapSearchIndex(organizations)
    const results = filterPublicMapOrganizationIds({
      searchIndex: index,
      query: "library.example.org",
      appliedBounds: null,
      favorites: [],
      activeGroup: "all",
    })
    const descriptionResults = filterPublicMapOrganizationIds({
      searchIndex: index,
      query: "continuity care navigation",
      appliedBounds: null,
      favorites: [],
      activeGroup: "all",
    })
    const chipResults = filterPublicMapOrganizationIds({
      searchIndex: index,
      query: "mutual aid",
      appliedBounds: null,
      favorites: [],
      activeGroup: "all",
    })

    expect(results).toEqual(["uncapped-resource-source"])
    expect(descriptionResults).toEqual(["uncapped-resource-source"])
    expect(chipResults).toEqual(["uncapped-resource-source"])
  })
})
