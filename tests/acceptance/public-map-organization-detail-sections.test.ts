import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import {
  OrganizationDetailActivitiesSection,
  OrganizationDetailBrandKitSection,
  OrganizationDetailOriginSection,
  OrganizationDetailStoryContent,
} from "@/components/public/public-map-index/organization-detail-sections"
import { PublicMapOrganizationDetail } from "@/components/public/public-map-index/organization-detail"
import { OrganizationDetailResourceLinksSection } from "@/components/public/public-map-index/organization-detail-resource-links-section"
import {
  PUBLIC_MAP_DETAIL_CHROME_BUTTON_SURFACE_CLASSNAME,
  PUBLIC_MAP_DETAIL_SECTION_CLASSNAME,
  PUBLIC_MAP_SIDEBAR_SECTION_ALT_CLASSNAME,
  PUBLIC_MAP_SIDEBAR_SECTION_CLASSNAME,
} from "@/components/public/public-map-index/sidebar-theme"
import type { PublicMapOrganization } from "@/lib/queries/public-map-index"

function buildOrganization(
  overrides: Partial<PublicMapOrganization> = {}
): PublicMapOrganization {
  return {
    id: "org-1",
    name: "Atlas Collective",
    tagline: "Neighborhood support",
    description: "Atlas supports local families through civic programming.",
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
    publicSlug: "atlas-collective",
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

describe("public map detail section chrome", () => {
  it("matches detail header controls to the drawer glass surface", () => {
    expect(PUBLIC_MAP_DETAIL_CHROME_BUTTON_SURFACE_CLASSNAME).toContain(
      "!bg-input/35"
    )
    expect(PUBLIC_MAP_DETAIL_CHROME_BUTTON_SURFACE_CLASSNAME).toContain(
      "hover:!bg-input/50"
    )
    expect(PUBLIC_MAP_DETAIL_CHROME_BUTTON_SURFACE_CLASSNAME).toContain(
      "border-input"
    )
    expect(PUBLIC_MAP_DETAIL_CHROME_BUTTON_SURFACE_CLASSNAME).toContain(
      "backdrop-blur-xl"
    )
    expect(PUBLIC_MAP_DETAIL_CHROME_BUTTON_SURFACE_CLASSNAME).not.toContain(
      "bg-zinc"
    )
    expect(PUBLIC_MAP_DETAIL_CHROME_BUTTON_SURFACE_CLASSNAME).not.toContain(
      "bg-white"
    )
  })

  it("keeps detail content on solid blurred section surfaces", () => {
    expect(PUBLIC_MAP_SIDEBAR_SECTION_CLASSNAME).toContain(
      "rounded-2xl border border-border/75 bg-background/90"
    )
    expect(PUBLIC_MAP_SIDEBAR_SECTION_CLASSNAME).toContain("backdrop-blur-md")
    expect(PUBLIC_MAP_SIDEBAR_SECTION_ALT_CLASSNAME).toContain(
      "rounded-xl border border-border/75 bg-background/95"
    )
    expect(PUBLIC_MAP_SIDEBAR_SECTION_ALT_CLASSNAME).toContain(
      "backdrop-blur-sm"
    )
  })

  it("renders brand kit content on the shared profile section surface", () => {
    const organization = buildOrganization({
      brandKitAvailable: true,
      logoUrl: "https://example.org/logo.png",
      brandMarkUrl: "https://example.org/mark.png",
      publicSlug: "atlas-collective",
    })

    const sectionMarkup = renderToStaticMarkup(
      React.createElement(OrganizationDetailBrandKitSection, {
        organization,
        brandKitDownloadHref:
          "/api/public/organizations/atlas-collective/brand-kit",
      })
    )
    const markup = renderToStaticMarkup(
      React.createElement(PublicMapOrganizationDetail, {
        organization,
      })
    )

    expect(sectionMarkup).toContain(
      `<section class="relative ${PUBLIC_MAP_DETAIL_SECTION_CLASSNAME}">`
    )
    expect(markup).toContain(
      '<h3 class="text-base font-semibold">Brand kit</h3>'
    )
    expect(markup).toContain(
      'data-public-map-resource-category-icon="community"'
    )
    expect(markup).toContain('aria-label="Download brand kit"')
    expect(markup).not.toContain(">Download<")
    expect(markup).toContain("Primary logo")
    expect(markup).toContain("Logo mark")
    expect(markup).toContain("https://example.org/mark.png")
  })

  it("keeps website and socials in the identity without a separate socials card", () => {
    const website = "https://example.org/a-long-public-organization-address"
    const markup = renderToStaticMarkup(
      React.createElement(PublicMapOrganizationDetail, {
        organization: buildOrganization({
          website,
          instagram: "https://instagram.com/atlas",
          linkedin: "https://linkedin.com/company/atlas",
        }),
      })
    )

    expect(markup).toContain(`href="${website}"`)
    expect(markup).toContain(`title="${website}"`)
    expect(markup).toContain("example.org/a-long-public-organization-address")
    expect(markup).toContain('aria-label="Open Instagram"')
    expect(markup).toMatch(/aria-label="Open LinkedIn"[^>]*><svg[^>]*>.*?<path d=/)
    expect(markup).not.toContain("/brand/linkedin-in.png")
    expect(markup.indexOf('aria-label="Open Instagram"')).toBeLessThan(
      markup.indexOf(">About</h3>")
    )
    expect(markup).not.toContain(">Socials</h3>")
    expect(markup).not.toContain(">Donate</span>")
  })

  it("uses one icon size and label gap for every profile action", () => {
    const markup = renderToStaticMarkup(
      React.createElement(PublicMapOrganizationDetail, {
        organization: buildOrganization({
          website: "https://example.org",
          donateUrl: "https://example.org/donate",
          email: "hello@example.org",
          phone: "+1 312 555 0100",
          brandKitAvailable: true,
        }),
      })
    )

    expect(
      markup.match(/data-public-map-organization-action-content="true"/g)
    ).toHaveLength(3)
    expect(
      markup.match(/data-public-map-organization-action-icon="true"/g)
    ).toHaveLength(3)
    expect(markup.match(/h-16 min-h-16/g)).toHaveLength(3)
    expect(markup).toContain('href="https://example.org/donate"')
    expect(markup).toContain(">Donate</span>")
    expect(markup).not.toContain(">Website</span>")
    expect(markup).toContain(
      "flex h-full w-full flex-col items-center justify-center gap-1.5 text-center"
    )
    expect(markup).toContain(
      "inline-flex size-5 shrink-0 items-center justify-center"
    )
    expect(markup).not.toContain("gap-0.5 text-center")
    expect(markup).not.toContain("h-4.5 w-4.5")
  })
})

describe("OrganizationDetailOriginSection", () => {
  it('renders the section title as "Organization story"', () => {
    const markup = renderToStaticMarkup(
      React.createElement(OrganizationDetailOriginSection, {
        storyFields: [
          {
            label: "Origin story",
            value:
              '<h2 style="text-align:center">Our beginning</h2><p><strong>Started</strong> after repeated service gaps.</p><img src="https://example.org/story.png" alt="Founding team">',
          },
        ],
      })
    )

    expect(markup).toContain(">Organization story<")
    expect(markup).not.toContain(">Origin<")
    expect(markup).toContain("Origin story")
    expect(markup).toContain("pt-1 pb-[3px]")
  })

  it("preserves sanitized rich layout and images after expansion", () => {
    const markup = renderToStaticMarkup(
      React.createElement(OrganizationDetailStoryContent, {
        value:
          '<h2 style="text-align:center">Our beginning</h2><p><strong>Started</strong> together.</p><img src="https://example.org/story.png" alt="Founding team">',
      })
    )

    expect(markup).toContain('<h2 style="text-align:center">')
    expect(markup).toContain("<strong>Started</strong>")
    expect(markup).toContain('alt="Founding team"')
    expect(markup).toContain("[&amp;_img]:my-4")
    expect(markup).toContain("[&amp;_img]:rounded-lg")
    expect(markup).toContain("[&amp;_img]:overflow-hidden")
    expect(markup).not.toContain("prose-img:")
  })

  it("renders nothing when no public story fields have content", () => {
    const markup = renderToStaticMarkup(
      React.createElement(OrganizationDetailOriginSection, {
        storyFields: [],
      })
    )

    expect(markup).toBe("")
    expect(markup).not.toContain("Not provided yet.")
  })
})

describe("OrganizationDetailResourceLinksSection", () => {
  it("renders activity links from org-created public activity", () => {
    const markup = renderToStaticMarkup(
      React.createElement(OrganizationDetailResourceLinksSection, {
        resources: [
          {
            key: "activity:resource-1:location",
            label: "Youth Resource Hub",
            href: "https://example.org/resources",
            domain: "example.org",
            kind: "online_resource",
            kindLabel: "Web resource",
            note: "Web resource · Ongoing",
          },
        ],
      })
    )

    expect(markup).toContain(">Links from activities<")
    expect(markup).toContain(">1<")
    expect(markup).toContain(
      "Links attached to published programs, events, services, and web resources from this organization."
    )
    expect(markup).toContain("Youth Resource Hub")
    expect(markup).toContain("example.org")
    expect(markup).toContain("Web resource · Ongoing")
    expect(markup).not.toContain(">Resources<")
    expect(markup).not.toContain(">Activity links<")
    expect(markup).not.toContain("Needs review")
    expect(markup).not.toContain("Coach House reviewed")
    expect(markup).not.toContain("Reviewed source")
    expect(markup).not.toContain("Verified source")
    expect(markup).not.toContain("Scraped")
    expect(markup).not.toContain("AI")
  })
})

describe("OrganizationDetailActivitiesSection", () => {
  it("renders public organization activities with kind and link actions", () => {
    const markup = renderToStaticMarkup(
      React.createElement(OrganizationDetailActivitiesSection, {
        activities: [
          {
            id: "program-1",
            title: "Youth Resource Hub",
            subtitle: null,
            description: "A public information hub for youth services.",
            activityKind: "Web resource",
            chips: ["Web resource", "Digital"],
            ctaLabel: "Open hub",
            ctaUrl: "https://hub.example.org",
            durationLabel: "Ongoing",
            locationUrl: "https://hub.example.org",
            locationType: "online",
          },
        ],
      })
    )

    expect(markup).toContain(">Activity<")
    expect(markup).not.toContain("Featured Programs")
    expect(markup).toContain("Youth Resource Hub")
    expect(markup).toContain("A public information hub for youth services.")
    expect(markup).toContain("Web resource")
    expect(markup).toContain("Ongoing")
    expect(markup).toContain("Online")
    expect(markup).toContain("https://hub.example.org")

    const profile = renderToStaticMarkup(
      React.createElement(PublicMapOrganizationDetail, {
        organization: buildOrganization({
          activityLinks: [{
            id: "program-1", title: "Youth Resource Hub", subtitle: null,
            description: "Public activity", activityKind: "Program", chips: [],
            ctaLabel: null, ctaUrl: null, durationLabel: null,
            locationUrl: null, locationType: null,
          }],
        }),
      })
    )
    expect(profile.indexOf(">Activity<")).toBeGreaterThan(profile.indexOf(">About<"))
    expect(profile.indexOf(">Activity<")).toBeLessThan(profile.indexOf(">Contact<"))
    expect(profile.match(/Youth Resource Hub/g)).toHaveLength(1)
  })

  it("renders the full activity list from activity metadata, not the visual preview cap", () => {
    const activities: PublicMapOrganization["activityLinks"] = Array.from(
      { length: 7 },
      (_, index): PublicMapOrganization["activityLinks"][number] => {
        const number = index + 1
        return {
          id: `activity-${number}`,
          title: `Activity ${number}`,
          subtitle: null,
          description: `Public activity ${number}`,
          activityKind: number === 7 ? "Web resource" : "Program",
          chips: [number === 7 ? "Web resource" : "Program"],
          ctaLabel: null,
          ctaUrl: number === 7 ? "https://example.org/seven" : null,
          durationLabel: "Ongoing",
          locationUrl: null,
          locationType: number === 7 ? "online" : "in_person",
        }
      }
    )

    const markup = renderToStaticMarkup(
      React.createElement(OrganizationDetailActivitiesSection, {
        activities,
      })
    )

    expect(markup).toContain(">7<")
    expect(markup).toContain("Activity 7")
    expect(markup).toContain("Public activity 7")
    expect(markup).toContain("https://example.org/seven")
  })
})
