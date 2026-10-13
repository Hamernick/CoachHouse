import { describe, expect, it } from "vitest"

import type { PublicMapOrganization } from "@/lib/queries/public-map-index"
import {
  buildPublicMapResourceLinkSearchText,
  buildPublicMapResourceLinks,
  formatPublicMapResourceLinkDomain,
  normalizePublicMapResourceLinkHref,
} from "@/lib/public-map/resource-links"

function buildOrganization(
  overrides: Partial<PublicMapOrganization> = {}
): PublicMapOrganization {
  return {
    id: "org-1",
    name: "Resource Org",
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
    latitude: null,
    longitude: null,
    address: null,
    addressStreet: null,
    addressPostal: null,
    city: null,
    state: null,
    country: null,
    locationUrl: null,
    publicSlug: null,
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

describe("public map resource links", () => {
  it("normalizes resource URLs and display domains", () => {
    expect(normalizePublicMapResourceLinkHref("example.org/path")).toBe(
      "https://example.org/path"
    )
    expect(normalizePublicMapResourceLinkHref(" https://example.org ")).toBe(
      "https://example.org"
    )
    expect(normalizePublicMapResourceLinkHref(" ")).toBeNull()
    expect(
      formatPublicMapResourceLinkDomain("https://www.example.org/help")
    ).toBe("example.org")
  })

  it("does not promote profile fields into resource links", () => {
    const resources = buildPublicMapResourceLinks(
      buildOrganization({
        website: "https://www.example.org",
        locationUrl: "https://example.org/",
      })
    )

    expect(resources).toEqual([])
  })

  it("dedupes duplicated activity-provided links", () => {
    const resources = buildPublicMapResourceLinks(
      buildOrganization({
        programs: [
          {
            id: "activity-1",
            title: "Youth Resource Hub",
            subtitle: null,
            description: "Public information hub for youth services.",
            activityKind: "Web resource",
            chips: ["Web resource", "Digital"],
            ctaLabel: "Open hub",
            ctaUrl: "https://hub.example.org",
            durationLabel: "Ongoing",
            imageUrl: null,
            locationUrl: "https://hub.example.org/",
            locationType: "online",
            startDate: null,
          },
        ],
      })
    )

    expect(resources).toHaveLength(1)
    expect(resources[0]).toMatchObject({
      key: "activity:activity-1:cta",
      label: "Open hub",
      domain: "hub.example.org",
      kind: "online_resource",
      kindLabel: "Web resource",
      note: "Web resource · Ongoing",
    })
  })

  it("builds published activity links without a separate review queue", () => {
    const resources = buildPublicMapResourceLinks(
      buildOrganization({
        website: "https://example.org",
        programs: [
          {
            id: "activity-1",
            title: "Youth Resource Hub",
            subtitle: null,
            description: "Public information hub for youth services.",
            activityKind: "Web resource",
            chips: ["Web resource", "Digital"],
            ctaLabel: "Open hub",
            ctaUrl: "https://hub.example.org",
            durationLabel: "Ongoing",
            imageUrl: null,
            locationUrl: "https://resource.example.org/directory",
            locationType: "online",
            startDate: null,
          },
        ],
      })
    )

    expect(resources[0]).toMatchObject({
      key: "activity:activity-1:cta",
      label: "Open hub",
      href: "https://hub.example.org",
      kind: "online_resource",
      kindLabel: "Web resource",
      note: "Web resource · Ongoing",
    })
    expect(resources).toHaveLength(2)
    expect(resources.map((resource) => resource.key)).toEqual([
      "activity:activity-1:cta",
      "activity:activity-1:location",
    ])
  })

  it("uses uncapped activity link metadata before capped visual previews", () => {
    const resources = buildPublicMapResourceLinks(
      buildOrganization({
        activityLinks: [
          {
            id: "older-resource",
            title: "Older Resource Library",
            subtitle: null,
            description: "A library of public service guides.",
            activityKind: "Web resource",
            chips: ["Web resource", "Guides"],
            ctaLabel: "Open library",
            ctaUrl: "https://library.example.org/open",
            durationLabel: "Ongoing",
            locationUrl: "https://library.example.org",
            locationType: "online",
          },
        ],
        programs: [],
      })
    )

    expect(resources.map((resource) => resource.label)).toEqual([
      "Open library",
      "Older Resource Library",
    ])
    expect(resources).toHaveLength(2)
    expect(resources[0]).toMatchObject({
      domain: "library.example.org",
      key: "activity:older-resource:cta",
      note: "Web resource · Ongoing",
    })
  })

  it("labels online resources separately from mapped location links", () => {
    const [onlineResource] = buildPublicMapResourceLinks(
      buildOrganization({
        programs: [
          {
            id: "resource-1",
            title: "Service Directory",
            subtitle: null,
            description: null,
            activityKind: "Web resource",
            chips: ["Web resource"],
            ctaLabel: "Open",
            ctaUrl: null,
            durationLabel: null,
            imageUrl: null,
            locationUrl: "resource.example.org",
            locationType: "online",
            startDate: null,
          },
        ],
      })
    )
    const [locationResource] = buildPublicMapResourceLinks(
      buildOrganization({
        programs: [
          {
            id: "event-1",
            title: "Resource Night",
            subtitle: null,
            description: null,
            activityKind: "Event",
            chips: ["Event"],
            ctaLabel: "Open",
            ctaUrl: null,
            durationLabel: null,
            imageUrl: null,
            locationUrl: "https://maps.example.org/place",
            locationType: "in_person",
            startDate: null,
          },
        ],
      })
    )

    expect(onlineResource).toMatchObject({
      label: "Service Directory",
      kind: "online_resource",
      kindLabel: "Web resource",
    })
    expect(locationResource).toMatchObject({
      label: "Resource Night location",
      kind: "location",
      kindLabel: "Location",
    })
  })

  it("exposes resource labels to search without adding review claims", () => {
    const searchText = buildPublicMapResourceLinkSearchText([
      {
        key: "activity:activity-1:cta",
        label: "Open hub",
        href: "https://example.org",
        domain: "example.org",
        kind: "online_resource",
        kindLabel: "Web resource",
        note: "Web resource · Ongoing",
      },
    ])

    expect(searchText).toContain("Open hub")
    expect(searchText).toContain("Web resource · Ongoing")
    expect(searchText).not.toContain("Needs review")
    expect(searchText).not.toContain("Reviewed source")
    expect(searchText).not.toContain("Scraped")
    expect(searchText).not.toContain("Verified source")
  })
})
