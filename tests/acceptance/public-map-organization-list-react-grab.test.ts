import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { PublicMapOrganizationList } from "@/components/public/public-map-index/organization-list"
import type {
  PublicMapOrganization,
  PublicMapProgramPreview,
} from "@/lib/queries/public-map-index"

function buildProgramPreview(
  overrides: Partial<PublicMapProgramPreview> = {}
): PublicMapProgramPreview {
  return {
    id: "program-1",
    title: "Community Kitchen",
    subtitle: "Weekly mutual-aid meals",
    description: "Weekly mutual-aid meals",
    activityKind: "Program",
    chips: ["Program", "Weekly"],
    ctaLabel: "Learn more",
    ctaUrl: "https://example.com/kitchen",
    durationLabel: "Weekly",
    imageUrl: "https://example.com/program.jpg",
    locationUrl: null,
    locationType: "in_person",
    startDate: null,
    ...overrides,
  }
}

function buildOrganization(
  overrides: Partial<PublicMapOrganization> = {}
): PublicMapOrganization {
  return {
    id: "org-1",
    name: "Atlas Collective",
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
    logoUrl: "https://example.com/logo.png",
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
    latitude: 41.8781,
    longitude: -87.6298,
    address: null,
    addressStreet: null,
    addressPostal: null,
    city: "Chicago",
    state: "IL",
    country: "United States",
    locationUrl: null,
    publicSlug: "atlas-collective",
    activityLinks: [],
    programPreview: buildProgramPreview(),
    programs: [
      buildProgramPreview(),
      buildProgramPreview({
        id: "program-2",
        title: "Youth Studio",
      }),
    ],
    programCount: 2,
    groups: ["community"],
    primaryGroup: "community",
    isOnlineOnly: false,
    ...overrides,
  }
}

describe("public map organization list react grab", () => {
  it("keeps the centered stack fixed while the rounded list surface scrolls", () => {
    const markup = renderToStaticMarkup(
      React.createElement(PublicMapOrganizationList, {
        organizations: [buildOrganization()],
        selectedOrgId: null,
        scrollable: true,
        onSelectOrg: () => {},
      })
    )

    expect(markup).toContain('data-public-map-organization-list-scroll="true"')
    expect(markup).toContain("mx-auto flex w-full max-w-3xl")
    expect(markup).toContain(
      'data-public-map-organization-list-section="rounded-scroll"'
    )
    expect(markup).toContain(
      "bg-background/85 border-input w-full min-w-0 rounded-2xl border"
    )
    expect(markup).toContain("scroll-fade-effect-y")
    expect(markup).toContain("overflow-y-auto")
    expect(markup).toContain("overscroll-contain")
    expect(markup).toContain('data-orientation="vertical"')
    expect(markup).toContain("pb-[env(safe-area-inset-bottom)]")
    expect(markup).toContain(
      'style="--mask-height:1.5rem;--scroll-buffer:1rem"'
    )
    expect(markup).not.toContain(
      "pb-[max(env(safe-area-inset-bottom),0.75rem)]"
    )
    expect(markup).toContain("[-webkit-overflow-scrolling:touch]")
  })

  it("supports scroll-pagination batches with a load-more fallback", () => {
    const organizations = Array.from({ length: 10 }, (_, index) =>
      buildOrganization({
        id: `org-${index + 1}`,
        name: `Resource ${index + 1}`,
        publicSlug: `resource-${index + 1}`,
      })
    )
    const markup = renderToStaticMarkup(
      React.createElement(PublicMapOrganizationList, {
        organizations,
        selectedOrgId: null,
        query: "",
        constrainedLayout: true,
        incrementalLoading: true,
        initialVisibleCount: 4,
        pageSize: 3,
        onSelectOrg: () => {},
        onOpenDetails: () => {},
      })
    )

    expect(markup).toContain("Resource 1")
    expect(markup).toContain("Resource 4")
    expect(markup).not.toContain("Resource 5")
    expect(markup).toContain('data-public-map-list-pagination="true"')
    expect(markup).toContain('data-public-map-list-load-sentinel="true"')
    expect(markup).toContain("Showing 4 of 10 resources")
    expect(markup).toContain("Load 3 more")
  })

  it("includes a selected organization even when it is beyond the first scroll page", () => {
    const organizations = Array.from({ length: 10 }, (_, index) =>
      buildOrganization({
        id: `org-${index + 1}`,
        name: `Resource ${index + 1}`,
        publicSlug: `resource-${index + 1}`,
      })
    )
    const markup = renderToStaticMarkup(
      React.createElement(PublicMapOrganizationList, {
        organizations,
        selectedOrgId: "org-7",
        query: "",
        constrainedLayout: true,
        incrementalLoading: true,
        initialVisibleCount: 4,
        pageSize: 3,
        onSelectOrg: () => {},
        onOpenDetails: () => {},
      })
    )

    expect(markup).toContain("Resource 7")
    expect(markup).not.toContain("Resource 8")
    expect(markup).toContain("Showing 7 of 10 resources")
    expect(markup).toContain("Load 3 more")
  })

  it("exposes stable semantic owner metadata for the card and its major sub-surfaces", () => {
    const markup = renderToStaticMarkup(
      React.createElement(PublicMapOrganizationList, {
        organizations: [buildOrganization()],
        selectedOrgId: null,
        query: "",
        constrainedLayout: true,
        onSelectOrg: () => {},
        onOpenDetails: () => {},
      })
    )
    const roomyMarkup = renderToStaticMarkup(
      React.createElement(PublicMapOrganizationList, {
        organizations: [buildOrganization()],
        selectedOrgId: null,
        query: "",
        constrainedLayout: false,
        onSelectOrg: () => {},
        onOpenDetails: () => {},
      })
    )

    expect(markup).toContain(
      'data-react-grab-anchor="PublicMapOrganizationListCard"'
    )
    expect(markup).toContain(
      'data-react-grab-owner-id="public-map-organization-list-card:org-1"'
    )
    expect(markup).toContain(
      'data-react-grab-owner-source="src/components/public/public-map-index/organization-list.tsx"'
    )
    expect(markup).not.toContain(
      'data-react-grab-surface-slot="favorite-button"'
    )
    expect(markup).not.toContain("Add Atlas Collective to favorites")
    expect(markup).toContain('data-react-grab-surface-slot="body"')
    expect(markup).toContain(
      "group relative z-10 flex h-auto min-h-16 w-full min-w-0 justify-start"
    )
    expect(markup).toContain("p-2")
    expect(roomyMarkup).toContain("p-2")
    expect(markup).toContain('data-react-grab-surface-slot="identity-row"')
    expect(markup).toContain('data-react-grab-surface-slot="avatar"')
    expect(markup).toContain('data-react-grab-surface-slot="title"')
    expect(markup).toContain('data-react-grab-surface-slot="location"')
    expect(markup).not.toContain(
      'data-react-grab-surface-slot="featured-program"'
    )
    expect(markup).not.toContain(
      'data-react-grab-surface-slot="program-preview-grid"'
    )
    expect(markup).toContain('data-react-grab-surface-slot="meta-row"')
    expect(markup).not.toContain('data-react-grab-surface-slot="view-button"')
    expect(markup).toContain('data-public-map-result-trigger="true"')
    expect(markup).toContain("min-h-16")
    expect(markup).toContain(
      "text-foreground line-clamp-2 text-sm leading-4 font-semibold text-pretty"
    )
    expect(markup).toContain(
      "text-muted-foreground mt-0 flex max-w-full items-center"
    )
    expect(markup).toContain("mt-0")
    expect(markup).toContain("flex-wrap items-center gap-x-1.5 gap-y-0")
    expect(markup).toContain("min-w-0 text-pretty break-words")
    expect(markup).not.toContain("max-w-[55%]")
    expect(markup).not.toContain("max-w-[45%]")
    expect(markup).toContain(">Community<")
    expect(markup).not.toContain("Weekly mutual-aid meals")
  })
})
