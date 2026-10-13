import { describe, expect, it } from "vitest"

import { buildStoryFields } from "@/components/public/public-map-index/organization-detail-helpers"
import type { PublicMapOrganization } from "@/lib/queries/public-map-index"

function buildOrganization(
  overrides: Partial<PublicMapOrganization> = {}
): PublicMapOrganization {
  return {
    id: "org-1",
    name: "Atlas Org",
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

describe("buildStoryFields", () => {
  it("returns roadmap-ordered origin fields including origin story and theory of change", () => {
    const fields = buildStoryFields(
      buildOrganization({
        originStory:
          "Community leaders launched Atlas after repeated service gaps.",
        needStatement: "Families lacked nearby legal and coaching support.",
        mission:
          "Support organizations building equitable public infrastructure.",
        vision: "Every neighborhood has a trusted support hub.",
        values: "Care, rigor, and shared ownership.",
        theoryOfChange:
          "Train local leaders, pair with technical coaching, and measure outcomes monthly.",
      })
    )

    expect(fields.map((field) => field.label)).toEqual([
      "Origin story",
      "Need",
      "Mission",
      "Vision",
      "Values",
      "Theory of change",
    ])
    expect(fields.map((field) => field.value)).toEqual([
      "Community leaders launched Atlas after repeated service gaps.",
      "Families lacked nearby legal and coaching support.",
      "Support organizations building equitable public infrastructure.",
      "Every neighborhood has a trusted support hub.",
      "Care, rigor, and shared ownership.",
      "Train local leaders, pair with technical coaching, and measure outcomes monthly.",
    ])
  })

  it("omits empty story fields", () => {
    const fields = buildStoryFields(buildOrganization())

    expect(fields).toEqual([])
  })

  it("keeps image-only story fields while omitting empty markup", () => {
    const fields = buildStoryFields(
      buildOrganization({
        originStory: "<p><br></p>",
        needStatement:
          '<img src="https://example.org/need.png" alt="Community need map">',
      })
    )

    expect(fields).toEqual([
      {
        label: "Need",
        value:
          '<img src="https://example.org/need.png" alt="Community need map">',
      },
    ])
  })
})
