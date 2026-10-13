import { describe, expect, it } from "vitest"

import type { PublicMapOrganization } from "@/lib/queries/public-map-index"
import { filterPublicMapOrganizations } from "@/components/public/public-map-index/helpers"

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

describe("filterPublicMapOrganizations", () => {
  it("keeps published orgs without coordinates visible when no map bounds are applied", () => {
    const organizations = [
      buildOrganization({
        id: "mapped-org",
        name: "Atlas Org",
        latitude: 40.7128,
        longitude: -74.006,
      }),
      buildOrganization({
        id: "profile-only-org",
        name: "Beacon Org",
        latitude: null,
        longitude: null,
        city: null,
        state: null,
        country: null,
      }),
    ]

    const results = filterPublicMapOrganizations({
      organizations,
      query: "",
      appliedBounds: null,
      favorites: [],
      activeGroup: "all",
    })

    expect(results.map((organization) => organization.id)).toEqual([
      "mapped-org",
      "profile-only-org",
    ])
  })

  it("drops profile-only orgs from map-area filtering because they do not have marker coordinates", () => {
    const organizations = [
      buildOrganization({
        id: "mapped-org",
        name: "Atlas Org",
        latitude: 40.7128,
        longitude: -74.006,
      }),
      buildOrganization({
        id: "profile-only-org",
        name: "Beacon Org",
        latitude: null,
        longitude: null,
      }),
    ]

    const results = filterPublicMapOrganizations({
      organizations,
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

    expect(results.map((organization) => organization.id)).toEqual([
      "mapped-org",
    ])
  })

  it("keeps online-only organizations in the list even when map bounds are applied", () => {
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

    const results = filterPublicMapOrganizations({
      organizations,
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

    expect(results.map((organization) => organization.id)).toEqual([
      "mapped-org",
      "web-resource-org",
    ])
  })
})
