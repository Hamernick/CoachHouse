import { readFileSync } from "node:fs"
import { join } from "node:path"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { PublicMapOrganizationList } from "@/components/public/public-map-index/organization-list"
import {
  PublicMapDirectoryRail,
  resolvePublicMapDirectoryRailMode,
  resolvePublicMapDirectoryStatusCount,
} from "@/components/public/public-map-index/directory-rail"
import {
  PublicMapDrawerDetailPanel,
  PublicMapResourceDrawerDetailPanel,
} from "@/components/public/public-map-index/sidebar-detail-panels"
import { PublicMapDrawerSearchPanel } from "@/components/public/public-map-index/sidebar-panels"
import { resolvePublicMapResourceCategoryIcon } from "@/components/public/public-map-index/resource-category-icon"
import { PublicMapFailureState } from "@/components/public/public-map-index/map-failure-state"
import { PUBLIC_MAP_RESOURCE_ITEMS_OFFLINE_ERROR } from "@/components/public/public-map-index/use-resource-map-items"
import { resolveResourceIdentityTitle } from "@/components/public/public-map-index/resource-detail-primary-sections"
import {
  filterPublicMapSavedOrganizations,
  filterPublicMapSavedResources,
  PublicMapMemberRail,
} from "@/components/public/public-map-index/member-rail"
import { resolvePublicMapCollectedResources } from "@/components/public/public-map-index/map-items-state"
import { PublicMapSavedRail } from "@/components/public/public-map-index/saved-rail"
import { PublicMapSidebar } from "@/components/public/public-map-index/sidebar"
import { PublicMapShellSidebarPanel } from "@/components/public/public-map-index/sidebar-shell-panel"
import { resolveInitialPublicMapDrawerSnapPointIndex } from "@/components/public/public-map-index/sidebar-state-helpers"
import { Sidebar, SidebarProvider } from "@/components/ui/sidebar"
import {
  buildPublicMapGroupFilterCounts,
  PublicMapCategoryFilter,
} from "@/components/public/public-map-index/category-filter"
import type { PublicMapResourceGuide } from "@/components/public/public-map-index/resource-guides"
import { buildPlatformOrganizationMapItem } from "@/lib/public-map/resource-map-items"
import type { ExternalResourceMapItem } from "@/lib/public-map/resource-map-items"
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
    tagline:
      "Neighborhood support and grassroots coordination across Chicago blocks.",
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
        subtitle: "Arts and tutoring",
      }),
      buildProgramPreview({
        id: "program-3",
        title: "Wellness Table",
        subtitle: "Community care",
      }),
    ],
    programCount: 3,
    groups: ["community"],
    primaryGroup: "community",
    isOnlineOnly: false,
    ...overrides,
  }
}

function buildResourceItem(
  overrides: Partial<ExternalResourceMapItem> = {}
): ExternalResourceMapItem {
  return {
    id: "seed-resource:food-access",
    itemType: "external_resource",
    title: "Seed Food Access",
    subtitle: "Food pantry and meal support",
    description: "A superadmin preview resource for meal and pantry access.",
    latitude: 41.8837,
    longitude: -87.6478,
    address: "123 Resource Ave, Chicago, IL",
    addressStreet: "123 Resource Ave",
    city: "Chicago",
    state: "IL",
    country: "United States",
    orgCategory: null,
    resourceCategories: ["food", "food_water"],
    primaryResourceCategory: "food",
    verificationStatus: "pending_review",
    sourceLabel: "Coach House seed data",
    sourceUrl: null,
    lastVerifiedAt: null,
    visibility: "superadmin_preview",
    markerImageUrl: null,
    ...overrides,
  }
}

function buildListItems(...organizations: PublicMapOrganization[]) {
  return organizations.map(buildPlatformOrganizationMapItem)
}

function extractClassNameByAttribute(
  markup: string,
  attribute: string,
  value: string
) {
  const escapedValue = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const tag =
    markup.match(
      new RegExp(`<[^>]*${attribute}="${escapedValue}"[^>]*>`)
    )?.[0] ?? ""
  return tag.match(/class="([^"]*)"/)?.[1] ?? ""
}

describe("public map sidebar layout", () => {
  it("keeps category pills flat with an overflow-aware horizontal fade", () => {
    const organization = buildOrganization()
    const markup = renderToStaticMarkup(
      React.createElement(PublicMapCategoryFilter, {
        activeGroup: "all",
        counts: buildPublicMapGroupFilterCounts(buildListItems(organization)),
        onActiveGroupChange: () => {},
      })
    )
    const selectedFilterClassName = extractClassNameByAttribute(
      markup,
      "aria-pressed",
      "true"
    )
    const filterRowClassName = extractClassNameByAttribute(
      markup,
      "aria-label",
      "Filter resources by category"
    )
    const selectedFilterIconClassName = extractClassNameByAttribute(
      markup,
      "data-public-map-category-filter-icon",
      ""
    )

    expect(selectedFilterClassName).not.toContain("shadow-sm")
    expect(selectedFilterIconClassName).toBe(
      "inline-flex size-4 items-center justify-center"
    )
    expect(selectedFilterIconClassName).not.toContain("bg-")
    expect(selectedFilterIconClassName).not.toContain("rounded")
    expect(filterRowClassName.split(/\s+/)).toContain("scroll-fade-effect-x")
    expect(filterRowClassName.split(/\s+/)).toContain("overflow-x-auto")
    expect(markup).toContain('data-orientation="horizontal"')
    expect(markup).toContain(
      'style="--mask-width:1.25rem;--scroll-buffer:1rem"'
    )
    expect(
      readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8")
    ).toContain("animation: none !important")
    expect(filterRowClassName).toContain("mx-auto")
    expect(filterRowClassName).toContain("w-full")
    expect(filterRowClassName).toContain("max-w-3xl")
    expect(markup).toContain(
      'data-react-grab-anchor="PublicMapCategoryFilterButton"'
    )
  })

  it("suppresses duplicate resource subtitles in the result list", () => {
    const resource = buildResourceItem({
      title: "Neighborhood Library Cooling Center",
      subtitle: "  Neighborhood   Library Cooling Center  ",
    })
    const markup = renderToStaticMarkup(
      React.createElement(PublicMapOrganizationList, {
        items: [resource],
        organizations: [],
        selectedOrgId: null,
        query: "",
        constrainedLayout: true,
        onSelectItem: () => {},
        onSelectOrg: () => {},
      })
    )

    expect(markup).toContain("Neighborhood Library Cooling Center")
    expect(markup).not.toContain(
      'text-muted-foreground line-clamp-2 text-sm leading-relaxed text-pretty">Neighborhood Library Cooling Center</p>'
    )
  })

  it("suppresses duplicate resource subtitles in the detail identity section", () => {
    const markup = renderToStaticMarkup(
      React.createElement(PublicMapResourceDrawerDetailPanel, {
        item: buildResourceItem({
          title: "Chopin (Frederic)",
          subtitle: "  Chopin   (Frederic)  ",
          primaryResourceCategory: "emergency_cooling_centers",
          resourceCategories: ["emergency_cooling_centers"],
          sourceLabel: "Chicago Data Portal - Cooling Centers",
          address: "3420 N Long Ave",
          city: "Chicago",
          state: "IL",
        }),
        drawerBodyScrollable: false,
        onBack: () => {},
      })
    )

    expect(markup.match(/Chopin \(Frederic\)/g)).toHaveLength(1)
    expect(markup).toContain(">Cooling Centers<")
    expect(markup).not.toContain(">Emergency<")
  })

  it("formats cooling-center identity titles with the resource type first", () => {
    const coolingCenter = buildResourceItem({
      title: "Little Italy cooling center",
      primaryResourceCategory: "emergency_cooling_centers",
      resourceCategories: ["emergency_cooling_centers"],
    })
    const markup = renderToStaticMarkup(
      React.createElement(PublicMapResourceDrawerDetailPanel, {
        item: coolingCenter,
        drawerBodyScrollable: false,
        onBack: () => {},
      })
    )

    expect(resolveResourceIdentityTitle(coolingCenter)).toBe(
      "Cooling Center | Little Italy"
    )
    expect(
      resolveResourceIdentityTitle({
        ...coolingCenter,
        title: "Cooling center - Little Italy",
      })
    ).toBe("Cooling Center | Little Italy")
    expect(
      resolveResourceIdentityTitle({
        ...coolingCenter,
        title: "Cooling Center | Little Italy",
      })
    ).toBe("Cooling Center | Little Italy")
    expect(
      resolveResourceIdentityTitle({
        ...coolingCenter,
        primaryResourceCategory: "community",
        resourceCategories: ["community"],
      })
    ).toBe("Little Italy cooling center")
    expect(markup).toContain(">Cooling Center | Little Italy</h2>")
    expect(markup).not.toContain(">Little Italy cooling center</h2>")
  })

  it("uses the liquid glass shell for the public map rail surface", () => {
    const organization = buildOrganization()
    const groupCounts = buildPublicMapGroupFilterCounts(
      buildListItems(organization)
    )
    const shellSource = readFileSync(
      join(
        process.cwd(),
        "src/components/public/public-map-index/liquid-glass-shell.tsx"
      ),
      "utf8"
    )
    const sidebarSource = readFileSync(
      join(process.cwd(), "src/components/public/public-map-index/sidebar.tsx"),
      "utf8"
    )
    const sidebarMemberPanelsSource = readFileSync(
      join(
        process.cwd(),
        "src/components/public/public-map-index/sidebar-member-panels.tsx"
      ),
      "utf8"
    )

    expect(shellSource).toContain('@samasante/liquid-glass"')
    expect(shellSource).toContain("PUBLIC_MAP_LIQUID_GLASS_OPTICS")
    expect(shellSource).toContain('height: "100%"')
    expect(shellSource).toContain('width: "100%"')
    expect(shellSource).not.toContain("filterResolution")
    expect(sidebarSource).toContain("PublicMapRailPanel")
    expect(sidebarMemberPanelsSource).toContain("PublicMapLiquidGlassShell")

    const markup = renderToStaticMarkup(
      React.createElement(
        SidebarProvider,
        { defaultOpen: true },
        React.createElement(PublicMapShellSidebarPanel, {
          sidebarMode: "search",
          items: buildListItems(organization),
          organizations: [organization],
          selectedItemId: organization.id,
          selectedOrganization: organization,
          favorites: [],
          query: "",
          activeGroup: "all",
          groupCounts,
          searchContext: null,
          onQueryChange: () => {},
          onActiveGroupChange: () => {},
          onToggleFavorite: () => {},
          onSelectItem: () => {},
          onOpenDetails: () => {},
          onBackToSearch: () => {},
          setSidebarMode: () => {},
        })
      )
    )

    expect(markup).toContain('data-liquid-glass="material"')
  })

  it("keeps the light-mode map canvas free of desaturation and haze overlays", () => {
    const source = readFileSync(
      join(
        process.cwd(),
        "src/components/public/public-map-index/map-surface.tsx"
      ),
      "utf8"
    )
    const runtimeSource = readFileSync(
      join(
        process.cwd(),
        "src/components/public/public-map-index/public-map-index-runtime.ts"
      ),
      "utf8"
    )

    expect(source).toContain('data-public-map-overscan="12px"')
    expect(source).toContain('className="absolute -inset-3"')
    expect(source).toContain("[&_.mapboxgl-ctrl-logo]:!hidden")
    expect(source).not.toContain("mapboxgl-ctrl-attrib")
    expect(source).not.toContain("[&_.mapboxgl-control-container")
    expect(runtimeSource).toContain("attributionControl: false")
    expect(source).not.toContain("brightness-[1.02]")
    expect(source).not.toContain("contrast-[0.98]")
    expect(source).not.toContain("saturate-[0.92]")
    expect(source).not.toContain("rgba(248,250,252")
    expect(source).toContain("hidden dark:block")
  })

  it("gives the rail search layout one scroll owner and a shared horizontal inset", () => {
    const organization = buildOrganization()
    const groupCounts = buildPublicMapGroupFilterCounts(
      buildListItems(organization)
    )
    const markup = renderToStaticMarkup(
      React.createElement(PublicMapSidebar, {
        sidebarMode: "search",
        sidebarWidth: 374,
        surfaceHeight: 720,
        panelPresentation: "rail",
        portalContainer: null,
        filteredItems: buildListItems(organization),
        filteredOrganizations: [organization],
        selectedItemId: organization.id,
        selectedOrganization: organization,
        favorites: [],
        query: "",
        activeGroup: "all",
        groupCounts,
        searchContext: null,
        setQuery: () => {},
        setActiveGroup: () => {},
        toggleFavorite: () => {},
        onSelectItem: () => {},
        onOpenDetails: () => {},
        onBackToSearch: () => {},
        setSidebarMode: () => {},
        onSelectOrganization: () => {},
      })
    )

    const headerClassName = extractClassNameByAttribute(
      markup,
      "data-public-map-sidebar-section",
      "rail-search-header"
    )
    const shellClassName = extractClassNameByAttribute(
      markup,
      "data-public-map-sidebar-section",
      "rail-organizations-shell"
    )
    const scrollClassName = extractClassNameByAttribute(
      markup,
      "data-public-map-sidebar-section",
      "rail-organizations-scroll"
    )
    const viewportClassName = extractClassNameByAttribute(
      markup,
      "data-slot",
      "scroll-area-viewport"
    )
    const stackClassName = extractClassNameByAttribute(
      markup,
      "data-public-map-sidebar-section",
      "organization-stack"
    )
    const statusHeaderClassName = extractClassNameByAttribute(
      markup,
      "data-public-map-sidebar-section",
      "rail-status-header"
    )
    const resultsStatusClassName = extractClassNameByAttribute(
      markup,
      "data-public-map-search-results-status",
      "true"
    )
    const categoryFilterClassName = extractClassNameByAttribute(
      markup,
      "aria-label",
      "Filter resources by category"
    )

    expect(headerClassName).toContain("px-3")
    expect(shellClassName).toContain("px-3")
    expect(shellClassName).toContain("overflow-hidden")
    expect(statusHeaderClassName).toContain("shrink-0")
    expect(resultsStatusClassName.split(" ")).toContain("px-1.5")
    expect(resultsStatusClassName.split(" ")).not.toContain("px-1")
    expect(resultsStatusClassName).toContain("mx-auto")
    expect(resultsStatusClassName).toContain("w-full")
    expect(resultsStatusClassName).toContain("max-w-3xl")
    expect(categoryFilterClassName).toContain("overflow-x-auto")
    expect(categoryFilterClassName).toContain("mx-auto")
    expect(categoryFilterClassName).toContain("w-full")
    expect(categoryFilterClassName).toContain("max-w-3xl")
    expect(categoryFilterClassName).toContain("scroll-fade-effect-x")
    expect(markup).toContain('data-orientation="horizontal"')
    expect(categoryFilterClassName).toContain("[scrollbar-width:none]")
    expect(categoryFilterClassName).toContain(
      "[&amp;::-webkit-scrollbar]:hidden"
    )
    expect(scrollClassName).not.toContain("px-")
    expect(scrollClassName).toContain("pr-2.5")
    expect(scrollClassName).toContain("h-full")
    expect(scrollClassName).toContain("overflow-hidden")
    expect(viewportClassName).toContain("scroll-fade-effect-y")
    expect(viewportClassName).toContain("[--mask-height:1.5rem]")
    expect(viewportClassName).toContain("[--scroll-buffer:1rem]")
    expect(viewportClassName).toContain("[&amp;&gt;div]:!block")
    expect(viewportClassName).toContain("[&amp;&gt;div]:!w-full")
    expect(markup.match(/data-slot="scroll-area"/g)).toHaveLength(1)
    expect(markup).toContain('data-slot="scroll-area-content"')
    expect(markup).toContain('data-public-map-directory-status-header="true"')
    expect(markup).toContain(
      'class="box-border w-full max-w-full min-w-0 px-1 pt-1 pb-4"'
    )
    expect(markup).toContain('data-public-map-list-pagination="true"')
    expect(markup).toContain("Showing 1 of 1 resources")
    expect(stackClassName).toContain("w-full")
    expect(stackClassName).toContain("max-w-full")
    expect(stackClassName).not.toContain("px-")
    expect(markup).toContain("bg-sidebar/86")
    expect(markup).toContain("supports-[backdrop-filter]:bg-sidebar/76")
    expect(markup).toContain("text-sidebar-foreground")
    expect(markup).toContain("bg-transparent")
    expect(markup).toContain("Find organizations and resources")
    expect(markup).toContain('aria-label="Find organizations and resources"')
    expect(markup).toContain("mx-auto flex w-full max-w-xl items-center")
    expect(markup).toContain("relative min-w-0 flex-1")
    expect(markup).toContain("rounded-full pl-8 text-base")
    expect(markup).toContain('aria-label="Filter resources by category"')
    expect(markup).toContain(">All<")
    expect(markup).toContain(">Community<")
    expect(markup).toContain('aria-pressed="true"')
    expect(
      markup.indexOf('data-public-map-sidebar-section="rail-status-header"')
    ).toBeLessThan(
      markup.indexOf(
        'data-public-map-sidebar-section="rail-organizations-scroll"'
      )
    )
    expect(
      markup.indexOf(
        'data-public-map-sidebar-section="rail-organizations-scroll"'
      )
    ).toBeLessThan(
      markup.indexOf('data-public-map-sidebar-section="organization-stack"')
    )
    expect(markup).not.toContain("Search organizations, locations, or programs")
    expect(markup).not.toContain(
      "Search organizations, activities, or resources"
    )
    expect(markup).not.toContain("border-white/30")
  })

  it("starts the mobile drawer at its collapsed snap point", () => {
    expect(resolveInitialPublicMapDrawerSnapPointIndex("search")).toBe(0)
    expect(resolveInitialPublicMapDrawerSnapPointIndex("hidden")).toBe(0)
    expect(resolveInitialPublicMapDrawerSnapPointIndex("details")).toBe(1)
  })

  it("keeps search context outside the organization list scroll viewport and fades only the list", () => {
    const organization = buildOrganization()
    const searchContext = {
      title: "10 resources here",
      description: "Showing resources at this map point.",
      items: buildListItems(organization),
      onClear: () => {},
    }
    const groupCounts = buildPublicMapGroupFilterCounts(
      buildListItems(organization)
    )
    const shellMarkup = renderToStaticMarkup(
      React.createElement(
        SidebarProvider,
        { defaultOpen: true },
        React.createElement(PublicMapShellSidebarPanel, {
          sidebarMode: "search",
          items: buildListItems(organization),
          organizations: [organization],
          selectedItemId: organization.id,
          selectedOrganization: organization,
          favorites: [],
          query: "",
          activeGroup: "all",
          groupCounts,
          searchContext,
          onQueryChange: () => {},
          onActiveGroupChange: () => {},
          onToggleFavorite: () => {},
          onSelectItem: () => {},
          onOpenDetails: () => {},
          onBackToSearch: () => {},
          setSidebarMode: () => {},
        })
      )
    )
    const directoryMarkup = renderToStaticMarkup(
      React.createElement(PublicMapDirectoryRail, {
        sidebarMode: "search",
        items: buildListItems(organization),
        organizations: [organization],
        selectedItemId: organization.id,
        selectedOrganization: null,
        favorites: [],
        query: "",
        activeGroup: "all",
        groupCounts,
        searchContext,
        onQueryChange: () => {},
        onActiveGroupChange: () => {},
        onToggleFavorite: () => {},
        onSelectItem: () => {},
        onOpenDetails: () => {},
        onBackToSearch: () => {},
        setSidebarMode: () => {},
      })
    )

    expect(shellMarkup).toContain(
      'data-public-map-sidebar-section="search-context-card"'
    )
    expect(shellMarkup).toContain("scroll-fade-effect-y")
    expect(shellMarkup.indexOf("10 resources here")).toBeLessThan(
      shellMarkup.indexOf(
        'data-public-map-sidebar-section="rail-organizations-scroll"'
      )
    )
    expect(shellMarkup.indexOf("10 resources here")).toBeLessThan(
      shellMarkup.indexOf(
        'data-public-map-sidebar-section="organization-stack"'
      )
    )

    expect(directoryMarkup).toContain(
      'data-public-map-right-rail-section="directory-search-context"'
    )
    expect(directoryMarkup).toContain(
      'data-public-map-right-rail-section="directory-status-header"'
    )
    expect(directoryMarkup).toContain(
      'data-public-map-directory-status-header="true"'
    )
    expect(directoryMarkup).toContain(
      'data-public-map-right-rail-section="directory-list-scroll"'
    )
    expect(directoryMarkup).toContain(
      "h-full min-h-0 flex-1 overflow-hidden pr-2"
    )
    expect(directoryMarkup).toContain("scroll-fade-effect-y")
    expect(
      directoryMarkup.indexOf(
        'data-public-map-right-rail-section="directory-status-header"'
      )
    ).toBeLessThan(
      directoryMarkup.indexOf(
        'data-public-map-right-rail-section="directory-list-scroll"'
      )
    )
    expect(directoryMarkup.indexOf("10 resources here")).toBeLessThan(
      directoryMarkup.indexOf(
        'data-public-map-right-rail-section="directory-list-scroll"'
      )
    )
  })

  it("keeps constrained rail cards compact without relying on a wider three-column preview grid", () => {
    const organization = buildOrganization()
    const markup = renderToStaticMarkup(
      React.createElement(PublicMapOrganizationList, {
        organizations: [organization],
        selectedOrgId: null,
        query: "",
        constrainedLayout: true,
        onSelectOrg: () => {},
        onOpenDetails: () => {},
      })
    )
    const listStackClassName = extractClassNameByAttribute(
      markup,
      "data-public-map-organization-list-section",
      "list-stack"
    )
    const cardGridClassName = extractClassNameByAttribute(
      markup,
      "data-public-map-organization-list-section",
      "card-grid"
    )

    expect(listStackClassName.split(" ")).toContain("gap-2")
    expect(listStackClassName.split(" ")).not.toContain("gap-2.5")
    expect(cardGridClassName.split(" ")).toContain("grid")
    expect(cardGridClassName.split(" ")).toContain("shrink-0")
    expect(cardGridClassName.split(" ")).toContain("grid-cols-1")
    expect(cardGridClassName.split(" ")).toContain("divide-y")
    expect(cardGridClassName.split(" ")).toContain("items-stretch")
    expect(markup).not.toContain("grid-cols-2")
    expect(markup).toContain("w-full max-w-full min-w-0")
    expect(markup).toContain("overflow-hidden")
    expect(markup).toContain('data-public-map-result-trigger="true"')
    expect(markup).not.toContain('role="button"')
    expect(markup).toContain(organization.tagline)
    expect(markup).not.toContain(organization.description ?? "")
    expect(markup).toContain("flex-wrap items-center gap-x-1.5 gap-y-0")
    expect(markup).toContain("min-w-0 text-pretty break-words")
    expect(markup).not.toContain("max-w-[55%]")
    expect(markup).not.toContain("max-w-[45%]")
    expect(markup).toContain("•")
    expect(markup).not.toContain(">View<")
    expect(markup).toContain("flex min-w-0 items-center")
    expect(markup).toContain(
      "line-clamp-2 text-sm leading-4 font-semibold"
    )
    expect(markup).toContain("text-xs leading-4")
    expect(markup).toContain(">Community<")
    expect(markup).not.toContain("Weekly mutual-aid meals")
    expect(markup).toContain("rounded-xl text-left whitespace-normal")
    expect(markup).toContain(
      "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50"
    )
    expect(markup).not.toContain("focus-within:bg-accent")
    expect(markup).toContain(
      "focus-visible:bg-accent focus-visible:text-accent-foreground"
    )
    expect(markup).not.toContain("hover:bg-sidebar-accent/70")
    expect(markup).not.toContain("focus-within:bg-sidebar-accent/75")
    expect(markup).not.toContain("hover:shadow-sm")
    expect(markup).not.toContain("focus-within:shadow-sm")
    expect(markup).not.toContain("focus-visible:shadow-sm")
    expect(markup).not.toContain("bg-sidebar-accent/90 shadow-sm")
    expect(markup).not.toContain("box-shadow")
    expect(markup).not.toContain("text-[#06c]")
    expect(markup).not.toContain('data-react-grab-surface-slot="view-button"')
    expect(markup).not.toContain(
      "rounded-full border border-transparent bg-transparent"
    )
    expect(markup).not.toContain("h-auto shrink-0 px-0")
    expect(markup).not.toContain("Add Atlas Collective to favorites")
    expect(markup).not.toContain("dark:border-white/30")
  })

  it("renders seed resources in the shared organization list card surface", () => {
    const organization = buildOrganization()
    const resource = buildResourceItem()
    const markup = renderToStaticMarkup(
      React.createElement(PublicMapOrganizationList, {
        items: [buildPlatformOrganizationMapItem(organization), resource],
        organizations: [organization],
        selectedItemId: resource.id,
        selectedOrgId: null,
        query: "food",
        constrainedLayout: true,
        onSelectItem: () => {},
        onSelectOrg: () => {},
        onOpenDetails: () => {},
      })
    )

    expect(markup).toContain("Seed Food Access")
    expect(markup).toContain("pantry and meal support")
    expect(markup).toContain(">Food</mark>")
    expect(markup).toContain("Chicago, IL")
    expect(markup).not.toContain(">Water<")
    const resourceCardIndex = markup.indexOf(
      'aria-label="Open details for Seed Food Access"'
    )
    const organizationMetadataClassName = extractClassNameByAttribute(
      markup.slice(0, resourceCardIndex),
      "data-react-grab-surface-slot",
      "meta-row"
    )
    const resourceMetadataClassName = extractClassNameByAttribute(
      markup.slice(resourceCardIndex),
      "data-react-grab-surface-slot",
      "meta-row"
    )
    const resourceTitleSlotIndex = markup.indexOf(
      'data-react-grab-surface-slot="title"',
      resourceCardIndex
    )
    const resourceNameIndex = markup.indexOf("Seed ", resourceTitleSlotIndex)
    const primaryCategoryIndex = markup.indexOf(
      ">Food</mark>",
      resourceTitleSlotIndex
    )
    expect(resourceNameIndex).toBeGreaterThan(resourceTitleSlotIndex)
    expect(primaryCategoryIndex).toBeGreaterThan(resourceNameIndex)
    expect(markup).toContain("Chicago, IL")
    expect(organizationMetadataClassName.split(" ")).toContain("mt-0")
    expect(resourceMetadataClassName.split(" ")).toContain("mt-0")
    expect(markup.match(/min-h-16/g)).toHaveLength(4)
    expect(markup).toContain("min-h-16")
    expect(markup).not.toContain(">Pending review<")
    expect(markup).not.toContain(">Seed preview<")
    expect(markup).not.toContain(">External data<")
    expect(markup).toContain('aria-label="Open details for Seed Food Access"')
    expect(markup).toContain(
      "Clicking the non-action parts of the card opens the resource detail panel."
    )
    expect(markup).toContain("background-color:#2563eb")
    expect(markup).toContain('data-public-map-icon-mode="stroke"')
    expect(markup).not.toContain('data-public-map-filled-icon="true"')
    expect(markup).toContain('data-public-map-resource-category-icon="food"')
    expect(markup).toContain("rounded-xl text-left whitespace-normal")
    expect(markup).not.toContain('aria-label="Resource marker preview"')
    expect(markup).not.toContain("PublicMapResourcePreviewPopover")
  })

  it("keeps compact resource cards with provider images and category fallback", () => {
    const resource = buildResourceItem({
      markerImageUrl: "https://example.org/provider-photo.jpg",
    })
    const markup = renderToStaticMarkup(
      React.createElement(PublicMapOrganizationList, {
        items: [resource],
        organizations: [],
        selectedItemId: null,
        selectedOrgId: null,
        query: "",
        constrainedLayout: true,
        onSelectItem: () => {},
        onSelectOrg: () => {},
        onOpenDetails: () => {},
      })
    )

    expect(markup).toContain("min-h-16")
    expect(markup).toContain("size-11")
    expect(markup).toContain('data-react-grab-surface-slot="media"')
    expect(markup).toContain('src="https://example.org/provider-photo.jpg"')
    expect(markup).toContain('alt="Seed Food Access image"')
    expect(markup).toContain('loading="lazy"')
    expect(markup).toContain("line-clamp-2")
    expect(markup).toContain('data-public-map-resource-category-icon="food"')
  })

  it("opens seed resources in the shared right-rail detail surface", () => {
    const resource = buildResourceItem({
      sourceUrl: "https://example.org/food-access",
      lastVerifiedAt: "2026-06-20T12:00:00.000Z",
      lastUpdatedAt: "2026-06-21T12:00:00.000Z",
      deliveryModes: ["in_person", "phone"],
      hoursLabel: "Monday through Friday, 9 AM to 5 PM",
      links: [
        {
          id: "seed-resource:food-access:link:intake",
          label: "Food pantry intake",
          url: "https://example.org/intake",
          type: "intake",
          domain: "example.org",
          isPrimary: true,
        },
      ],
      contacts: [
        {
          id: "seed-resource:food-access:contact:phone",
          label: "Intake phone",
          value: "(312) 555-0100",
          type: "phone",
          url: "tel:+13125550100",
          isPrimary: true,
        },
      ],
      services: [
        {
          id: "seed-resource:food-access:service:pantry",
          title: "Free groceries",
          description: "Weekly pantry pickup and meal support.",
          whoItHelps: "Families and individuals seeking food access.",
          eligibility: "Open to nearby residents.",
          cost: "Free",
          languages: ["English", "Spanish"],
          intakeUrl: "https://example.org/intake",
          appointmentInfo: "Walk-ins accepted before 4 PM.",
          documentsNeeded: ["Photo ID if available"],
          accessibilityNotes: "Wheelchair-accessible entrance.",
          urgentAvailability: "Same-day pantry support may be available.",
          ageRange: "All ages",
          serviceArea: ["Chicago, IL"],
          deliveryModes: ["in_person"],
        },
      ],
    })
    const groupCounts = buildPublicMapGroupFilterCounts([])

    expect(
      resolvePublicMapDirectoryRailMode({
        sidebarMode: "details",
        selectedOrganization: null,
        selectedResourceItem: resource,
      })
    ).toBe("details")

    const markup = renderToStaticMarkup(
      React.createElement(PublicMapDirectoryRail, {
        sidebarMode: "details",
        items: [resource],
        organizations: [],
        selectedItemId: resource.id,
        selectedOrganization: null,
        selectedResourceItem: resource,
        favorites: [],
        query: "",
        activeGroup: "all",
        groupCounts,
        searchContext: null,
        onQueryChange: () => {},
        onActiveGroupChange: () => {},
        onToggleFavorite: () => {},
        onSelectItem: () => {},
        onOpenDetails: () => {},
        onBackToSearch: () => {},
        setSidebarMode: () => {},
      })
    )

    expect(markup).toContain(
      'data-public-map-right-rail-section="directory-detail"'
    )
    expect(markup).toContain(
      "flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
    )
    expect(markup).toContain('data-slot="scroll-area"')
    expect(markup).toContain(">Resource<")
    expect(markup).toContain("Seed Food Access")
    expect(markup).toContain("Food pantry and meal support")
    expect(markup).toContain(">Food<")
    expect(markup).toContain(">Water<")
    expect(markup).toContain(">Pending review<")
    expect(markup).toContain(">Seed preview<")
    expect(markup).toContain(">Coach House seed data<")
    expect(markup).toContain("123 Resource Ave")
    expect(markup).toContain(">Links<")
    expect(markup).toContain("Food pantry intake")
    expect(markup).toContain("example.org")
    expect(markup).toContain(">Contact<")
    expect(markup).toContain("(312) 555-0100")
    expect(markup).toContain("Intake phone")
    expect(markup).toContain(">Services<")
    expect(markup).toContain("Free groceries")
    expect(markup).toContain("Families and individuals seeking food access.")
    expect(markup).toContain("Walk-ins accepted before 4 PM.")
    expect(markup).toContain("How to access")
    expect(markup).toContain("Photo ID if available")
    expect(markup).toContain(">Access<")
    expect(markup).toContain("In person, Phone")
    expect(markup).toContain("Monday through Friday, 9 AM to 5 PM")
    expect(markup).toContain('aria-label="Back to search"')
    expect(markup).toContain('href="https://example.org/food-access"')
    expect(markup).toContain('data-slot="hover-card-trigger"')
    expect(markup).not.toContain(">Data source<")
    expect(markup).not.toContain(">Open source<")
    expect(markup).toContain('data-public-map-icon-mode="stroke"')
    expect(markup).toContain('data-public-map-resource-category-icon="food"')
    expect(markup).toContain("text-white")
    expect(markup).not.toContain("raw_snapshot")
    expect(markup).not.toContain("field_confidence")
    expect(markup).not.toContain("PublicMapResourcePreviewPopover")
  })

  it("uses distinct phone and email icons for public resource contacts", () => {
    const source = readFileSync(
      join(
        process.cwd(),
        "src/components/public/public-map-index/resource-detail-resource-sections.tsx"
      ),
      "utf8"
    )
    expect(source).toContain('contact.type === "email" ? MailIcon : PhoneIcon')
  })

  it("keeps resource websites primary and links safe sources from details", () => {
    const sourceUrl = "https://finder.example.org/resources"
    const markup = renderToStaticMarkup(
      React.createElement(PublicMapResourceDrawerDetailPanel, {
        item: buildResourceItem({
          sourceUrl,
          links: [
            {
              id: "resource-source",
              label: "Finder source",
              url: sourceUrl,
              type: "source",
              domain: "finder.example.org",
            },
            {
              id: "resource-methodology",
              label: "Directory methodology",
              url: "https://finder.example.org/methodology",
              type: "source",
              domain: "finder.example.org",
            },
            {
              id: "resource-intake",
              label: "Food pantry intake",
              url: "https://example.org/intake",
              type: "intake",
              domain: "example.org",
              isPrimary: true,
            },
            {
              id: "resource-website",
              label: "Official website",
              url: "https://example.org",
              type: "website",
              domain: "example.org",
            },
          ],
        }),
        drawerBodyScrollable: false,
        onBack: () => {},
      })
    )
    const linksIndex = markup.indexOf(">Links<")
    const websiteIndex = markup.indexOf("Official website")
    const intakeIndex = markup.indexOf("Food pantry intake")
    const addressIndex = markup.indexOf(">Address<")
    const sourceIndex = markup.indexOf(">Source<")

    expect(linksIndex).toBeGreaterThan(-1)
    expect(websiteIndex).toBeGreaterThan(linksIndex)
    expect(websiteIndex).toBeLessThan(intakeIndex)
    expect(markup).not.toContain("Finder source")
    expect(markup).toContain("Directory methodology")
    expect(addressIndex).toBeGreaterThan(-1)
    expect(sourceIndex).toBeGreaterThan(-1)
    expect(sourceIndex).toBeLessThan(addressIndex)
    expect(markup).toContain('data-slot="hover-card-trigger"')
    expect(
      markup.match(/href="https:\/\/finder\.example\.org\/resources"/g)
    ).toHaveLength(1)
    expect(markup).toContain('href="https://finder.example.org/methodology"')
  })

  it("loads rich source metadata only when the shadcn hover card opens", () => {
    const source = readFileSync(
      join(
        process.cwd(),
        "src/components/public/public-map-index/resource-source-link-preview.tsx"
      ),
      "utf8"
    )

    expect(source).toContain("HoverCard")
    expect(source).toContain("HoverCardTrigger asChild")
    expect(source).toContain("HoverCardContent")
    expect(source).toContain("onOpenChange")
    expect(source).toContain("if (open) loadPreview()")
    expect(source).toContain("/api/link-preview?url=")
  })

  it("renders resource detail images when external resources provide one", () => {
    const resource = buildResourceItem({
      markerImageUrl: "https://example.org/resource-photo.jpg",
    })
    const groupCounts = buildPublicMapGroupFilterCounts([])

    const markup = renderToStaticMarkup(
      React.createElement(PublicMapDirectoryRail, {
        sidebarMode: "details",
        items: [resource],
        organizations: [],
        selectedItemId: resource.id,
        selectedOrganization: null,
        selectedResourceItem: resource,
        favorites: [],
        query: "",
        activeGroup: "all",
        groupCounts,
        searchContext: null,
        onQueryChange: () => {},
        onActiveGroupChange: () => {},
        onToggleFavorite: () => {},
        onSelectItem: () => {},
        onOpenDetails: () => {},
        onBackToSearch: () => {},
        setSidebarMode: () => {},
      })
    )

    expect(markup).toContain('src="https://example.org/resource-photo.jpg"')
    expect(markup).toContain('alt="Seed Food Access image"')
    expect(markup).toContain("absolute inset-0 h-full w-full object-cover")
    expect(markup).toContain('data-public-map-icon-mode="stroke"')
    expect(markup).toContain('data-public-map-resource-category-icon="food"')
    expect(markup).toContain("bg-muted/45")
  })

  it("maps resource detail category icons from the resource taxonomy", () => {
    expect(resolvePublicMapResourceCategoryIcon("food")).toEqual(
      expect.arrayContaining([expect.stringContaining("M2.05 2.05h2")])
    )
    expect(resolvePublicMapResourceCategoryIcon("health")).toEqual(
      expect.arrayContaining([expect.stringContaining("M240,102c0,70")])
    )
    expect(
      resolvePublicMapResourceCategoryIcon("community_transportation")
    ).toEqual(expect.arrayContaining([expect.stringContaining("M248,80v24")]))
  })

  it("prioritizes web-resource metadata inside the constrained inline strip without overflowing badge chrome", () => {
    const organization = buildOrganization({
      isOnlineOnly: true,
    })
    const markup = renderToStaticMarkup(
      React.createElement(PublicMapOrganizationList, {
        organizations: [organization],
        selectedOrgId: null,
        query: "",
        constrainedLayout: true,
        onSelectOrg: () => {},
        onOpenDetails: () => {},
      })
    )

    expect(markup).toContain(">Online resource<")
    expect(markup).toContain(">Community<")
    expect(markup).not.toContain("rounded-md border-border/70 bg-background/85")
  })

  it("renders logo avatars on a white contained surface so transparent logos stay visible", () => {
    const organization = buildOrganization({
      logoUrl: "https://example.com/logo.png",
    })
    const markup = renderToStaticMarkup(
      React.createElement(PublicMapOrganizationList, {
        organizations: [organization],
        selectedOrgId: null,
        query: "",
        constrainedLayout: true,
        onSelectOrg: () => {},
        onOpenDetails: () => {},
      })
    )

    expect(markup).toContain("bg-white")
    expect(markup).toContain('data-slot="avatar"')
  })

  it("shows the primary category and compact location beneath organization names", () => {
    const organization = buildOrganization({
      city: "CHICAGO",
      state: "IL",
      country: "UNITED STATES",
    })
    const markup = renderToStaticMarkup(
      React.createElement(PublicMapOrganizationList, {
        organizations: [organization],
        selectedOrgId: null,
        query: "",
        constrainedLayout: true,
        onSelectOrg: () => {},
        onOpenDetails: () => {},
      })
    )

    expect(markup).toContain(">Community<")
    expect(markup).toContain("CHICAGO, IL")
    expect(markup).not.toContain("UNITED STATES")
  })

  it("moves the internal organization directory into the member right rail tabs", () => {
    const organization = buildOrganization()
    const guideItems = buildListItems(organization)
    const guides = [
      {
        id: "nyc-cooling-centers",
        title: "NYC Cooling Centers",
        subtitle: "Cooling and heat relief locations across the five boroughs.",
        kicker: "New York",
        itemCount: guideItems.length,
        items: guideItems,
        primaryResourceCategory: "emergency_cooling_centers",
        visualVariant: "nyc",
      },
    ] satisfies PublicMapResourceGuide[]
    const groupCounts = buildPublicMapGroupFilterCounts(
      buildListItems(organization)
    )
    const publicRightRailSource = readFileSync(
      join(
        process.cwd(),
        "src/components/public/public-map-index/right-rail.tsx"
      ),
      "utf8"
    )
    const directoryMarkup = renderToStaticMarkup(
      React.createElement(PublicMapDirectoryRail, {
        sidebarMode: "search",
        items: buildListItems(organization),
        organizations: [organization],
        selectedItemId: organization.id,
        selectedOrganization: null,
        favorites: [],
        query: "",
        activeGroup: "community",
        groupCounts,
        searchContext: null,
        onQueryChange: () => {},
        onActiveGroupChange: () => {},
        onToggleFavorite: () => {},
        onSelectItem: () => {},
        onOpenDetails: () => {},
        onBackToSearch: () => {},
        setSidebarMode: () => {},
      })
    )
    const memberRailMarkup = renderToStaticMarkup(
      React.createElement(PublicMapMemberRail, {
        directoryHeaderStart: React.createElement("span", {
          "data-public-map-test-header-start": "",
        }),
        directoryHeaderEnd: React.createElement("span", {
          "data-public-map-test-header-end": "",
        }),
        directoryRail: React.createElement(
          "div",
          { "data-public-map-right-rail-section": "directory-search" },
          "Directory"
        ),
        directoryMode: "search",
        guides,
        savedOrganizations: [],
        onGuideSelect: () => {},
        onToggleSavedGuide: () => {},
        onSelectOrganization: () => {},
        onToggleFavorite: () => {},
      })
    )
    const guidesRailMarkup = renderToStaticMarkup(
      React.createElement(PublicMapMemberRail, {
        directoryRail: null,
        directoryMode: null,
        guides,
        savedOrganizations: [],
        onGuideSelect: () => {},
        onToggleSavedGuide: () => {},
        onSelectOrganization: () => {},
        onToggleFavorite: () => {},
      })
    )

    expect(directoryMarkup).toContain(
      'data-public-map-right-rail-section="directory-search"'
    )
    expect(directoryMarkup).toContain(
      'data-public-map-right-rail-section="directory-status-header"'
    )
    expect(directoryMarkup).toContain(
      'data-public-map-right-rail-section="directory-list-scroll"'
    )
    expect(
      directoryMarkup.indexOf(
        'data-public-map-right-rail-section="directory-status-header"'
      )
    ).toBeLessThan(
      directoryMarkup.indexOf(
        'data-public-map-right-rail-section="directory-list-scroll"'
      )
    )
    expect(directoryMarkup).not.toContain(">Resource map<")
    expect(directoryMarkup).toContain(
      'aria-label="Filter resources by category"'
    )
    expect(directoryMarkup).toContain('aria-pressed="true"')
    expect(directoryMarkup).toContain(organization.name)
    expect(resolvePublicMapDirectoryStatusCount(1)).toBe("1")
    expect(resolvePublicMapDirectoryStatusCount(1234)).toBe("1,234")
    expect(directoryMarkup).toContain(">Resources<")
    expect(directoryMarkup).not.toContain(">Active<")
    expect(directoryMarkup).not.toContain(
      'aria-label="Resources directory status: active, 1"'
    )
    expect(directoryMarkup).toContain("flex h-8 shrink-0 items-center")
    expect(directoryMarkup).toContain(
      "text-muted-foreground min-w-0 truncate text-xs font-medium tracking-[0.08em] uppercase"
    )
    expect(directoryMarkup).not.toContain("users online")
    expect(directoryMarkup).toContain('data-public-map-list-pagination="true"')
    expect(directoryMarkup).toContain("Showing 1 of 1 resources")
    expect(directoryMarkup).not.toContain("grid-cols-2")
    expect(directoryMarkup).not.toContain(
      'data-public-map-sidebar-section="resource-guides"'
    )
    expect(directoryMarkup).not.toContain("NYC Cooling Centers")
    expect(memberRailMarkup).toContain(">Find<")
    expect(memberRailMarkup).toContain(">Guides<")
    expect(memberRailMarkup).toContain(">My Map<")
    expect(memberRailMarkup).not.toContain(">Recent<")
    expect(memberRailMarkup).not.toContain(">Joined<")
    expect(memberRailMarkup).not.toContain(">Alerts<")
    expect(memberRailMarkup).toContain('data-variant="line"')
    expect(memberRailMarkup).toContain("bg-transparent shrink-0")
    expect(memberRailMarkup).toContain(
      "mx-auto h-7 w-fit max-w-full min-w-0 justify-center gap-0 self-center p-0"
    )
    expect(memberRailMarkup).toContain("after:pointer-events-none")
    expect(memberRailMarkup).toContain(
      "h-7 min-w-0 flex-none rounded-none bg-transparent px-2 py-1 text-center text-xs leading-none"
    )
    expect(memberRailMarkup).toContain("!text-zinc-700")
    expect(memberRailMarkup).toContain("!text-zinc-950")
    expect(memberRailMarkup).not.toContain("self-end")
    expect(memberRailMarkup).not.toContain(
      "h-9 w-full items-center gap-1 rounded-full border border-border/70 bg-background/70 p-1"
    )
    expect(memberRailMarkup).not.toContain(
      "rounded-full border border-border/70 bg-background/70 p-1"
    )
    expect(memberRailMarkup).toContain(
      "flex h-full min-h-0 flex-col gap-3 overflow-hidden"
    )
    expect(directoryMarkup).toContain(
      "flex h-full min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden"
    )
    expect(memberRailMarkup).toContain(
      "mt-0 flex h-full min-h-0 flex-1 flex-col overflow-hidden"
    )
    expect(memberRailMarkup).not.toContain("flex min-h-full flex-col gap-3")
    expect(publicRightRailSource).toContain(
      "flex h-full min-h-0 min-w-0 flex-col gap-4 overflow-hidden"
    )
    expect(publicRightRailSource).not.toContain(
      "flex min-h-full flex-col gap-4"
    )
    expect(memberRailMarkup).toContain(
      "h-7 min-w-0 flex-none rounded-none bg-transparent px-2 py-1 text-center text-xs leading-none"
    )
    expect(memberRailMarkup).toContain("data-[state=active]:bg-transparent")
    expect(memberRailMarkup).toContain("data-[state=active]:shadow-none")
    expect(memberRailMarkup).toContain(
      "group-data-[orientation=horizontal]/tabs:after:bottom-0"
    )
    expect(memberRailMarkup).not.toContain(
      "group-data-[orientation=horizontal]/tabs:after:bottom-[-5px]"
    )
    expect(memberRailMarkup).toContain('data-public-map-tab-header=""')
    expect(
      memberRailMarkup.indexOf('data-public-map-test-header-start=""')
    ).toBeLessThan(memberRailMarkup.indexOf('data-public-map-tab-list=""'))
    expect(
      memberRailMarkup.indexOf('data-public-map-tab-list=""')
    ).toBeLessThan(
      memberRailMarkup.indexOf('data-public-map-test-header-end=""')
    )
    expect(memberRailMarkup).not.toContain("data-[state=active]:bg-muted/55")
    expect(memberRailMarkup).not.toContain("h-6 min-h-0 min-w-0 rounded-full")

    const emptyGuidesMarkup = renderToStaticMarkup(
      React.createElement(PublicMapMemberRail, {
        directoryRail: React.createElement("div", null, "Directory"),
        directoryMode: "search",
        guides: [],
        savedOrganizations: [],
        onGuideSelect: () => {},
        onSelectOrganization: () => {},
        onToggleFavorite: () => {},
      })
    )
    expect(emptyGuidesMarkup).toContain(">Guides<")
    expect(guidesRailMarkup).toContain(
      'data-public-map-member-rail-section="guides-panel"'
    )
    expect(guidesRailMarkup).toContain(
      "mx-auto flex h-full min-h-0 w-full max-w-3xl"
    )
    expect(guidesRailMarkup).toContain(
      'data-public-map-member-rail-section="guides-header"'
    )
    expect(guidesRailMarkup).toContain(
      'data-public-map-member-rail-section="guides-scroll"'
    )
    expect(
      guidesRailMarkup.indexOf(
        'data-public-map-member-rail-section="guides-header"'
      )
    ).toBeLessThan(
      guidesRailMarkup.indexOf(
        'data-public-map-member-rail-section="guides-scroll"'
      )
    )
    expect(guidesRailMarkup).toContain(
      'data-public-map-sidebar-section="resource-guides"'
    )
    expect(guidesRailMarkup).toContain(
      'data-public-map-resource-guides-grid="true"'
    )
    expect(guidesRailMarkup).toContain(
      "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3"
    )
    expect(guidesRailMarkup).toContain("items-stretch gap-3")
    expect(guidesRailMarkup).toContain("NYC Cooling Centers")
    expect(guidesRailMarkup).toContain(
      'data-public-map-resource-guide-card="nyc-cooling-centers"'
    )
    expect(guidesRailMarkup).toContain(
      'aria-label="Save NYC Cooling Centers to My Map"'
    )
    expect(guidesRailMarkup).toContain('aria-label="Share NYC Cooling Centers"')
    expect(guidesRailMarkup).toContain("rounded-xl border border-input")
    expect(guidesRailMarkup).toContain("bg-input/55")
    expect(guidesRailMarkup).toContain("shadow-sm backdrop-blur-md")
    expect(guidesRailMarkup).not.toContain("border-white/18")
    expect(guidesRailMarkup).not.toContain("bg-[radial-gradient")
    expect(guidesRailMarkup).not.toContain("data-public-map-filled-icon")
    expect(guidesRailMarkup).not.toContain(
      "inline-flex size-8 items-center justify-center rounded-full"
    )
    expect(memberRailMarkup).toContain("Directory")
  })

  it("lets My Map search and category-filter collected organizations", () => {
    const communityOrganization = buildOrganization({
      id: "community-org",
      name: "Atlas Collective",
      tagline: "Neighborhood meals and community support",
      groups: ["community"],
      primaryGroup: "community",
    })
    const healthOrganization = buildOrganization({
      id: "health-org",
      name: "Harbor Health",
      tagline: "Mobile clinic and dental referrals",
      groups: ["health"],
      primaryGroup: "health",
    })

    expect(
      filterPublicMapSavedOrganizations({
        activeGroup: "all",
        query: "dental",
        savedOrganizations: [communityOrganization, healthOrganization],
      }).map((organization) => organization.id)
    ).toEqual(["health-org"])
    expect(
      filterPublicMapSavedOrganizations({
        activeGroup: "community",
        query: "",
        savedOrganizations: [communityOrganization, healthOrganization],
      }).map((organization) => organization.id)
    ).toEqual(["community-org"])

    const markup = renderToStaticMarkup(
      React.createElement(PublicMapMemberRail, {
        directoryRail: null,
        directoryMode: null,
        savedOrganizations: [communityOrganization, healthOrganization],
        savedGuideIds: ["nyc-cooling-centers"],
        savedGuides: [
          {
            id: "nyc-cooling-centers",
            title: "NYC Cooling Centers",
            subtitle: "Cooling and heat relief locations.",
            kicker: "New York",
            itemCount: 1,
            items: [],
            primaryResourceCategory: "emergency_cooling_centers",
            visualVariant: "nyc",
          },
        ],
        onSelectOrganization: () => {},
        onToggleFavorite: () => {},
        onToggleSavedGuide: () => {},
      })
    )

    expect(markup).toContain(">My Map<")
    const savedRailMarkup = renderToStaticMarkup(
      React.createElement(PublicMapSavedRail, {
        savedOrganizations: [communityOrganization, healthOrganization],
        favoritesCount: 2,
        onSelectOrganization: () => {},
        onToggleFavorite: () => {},
      })
    )

    expect(savedRailMarkup).toContain(
      'data-public-map-right-rail-section="saved-organizations-scroll"'
    )
    expect(savedRailMarkup).toContain('data-slot="scroll-area"')
    expect(savedRailMarkup).toContain(
      "flex h-full min-h-0 min-w-0 flex-col gap-3 overflow-hidden"
    )
    expect(savedRailMarkup).toContain("h-full min-h-0 flex-1 overflow-hidden")
    expect(savedRailMarkup).toContain("scroll-fade-effect-y")
    expect(savedRailMarkup).not.toContain("max-h-[52vh]")
    expect(markup).toContain('data-variant="line"')
    expect(markup).toContain("bg-transparent shrink-0")
    expect(markup).toContain(
      "mx-auto h-7 w-fit max-w-full min-w-0 justify-center gap-0 self-center p-0"
    )
    expect(markup).toContain("after:pointer-events-none")
    expect(markup).not.toContain("self-end")
    expect(markup).not.toContain(
      "rounded-full border border-border/70 bg-background/70 p-1"
    )
    expect(markup).toContain(
      'data-public-map-member-rail-section="saved-panel"'
    )
    expect(markup).toContain("mx-auto flex h-full min-h-0 w-full max-w-3xl")
    expect(markup).toContain(
      'data-public-map-member-rail-section="saved-search-controls"'
    )
    expect(markup).toContain('aria-label="Find organizations and resources"')
    expect(markup).toContain('aria-label="Filter resources by category"')
    expect(markup).toContain(">All<")
    expect(markup).toContain(">Community<")
    expect(markup).toContain(">Health<")
    expect(markup).toContain(">2<")
    expect(markup).toContain(">1<")
    expect(markup).toContain("My Map")
    expect(markup).toContain("mx-2 min-h-0 flex-1 bg-transparent")
    expect(markup).not.toContain("bg-card/95")
    expect(markup).toContain("Atlas Collective")
    expect(markup).toContain("Harbor Health")
    expect(markup).toContain("NYC Cooling Centers")
    expect(markup).toContain('aria-label="Filter My Map items"')
    expect(markup).toContain(
      'aria-label="Remove NYC Cooling Centers from My Map"'
    )
    expect(markup).toContain('aria-label="Remove Atlas Collective from My Map"')
    expect(markup).toContain("lucide-minus")
    expect(markup).toContain("size-11 shrink-0 rounded-full")
    expect(markup).not.toContain(">Remove<")
    expect(markup).toContain('data-public-map-saved-organization-grid="true"')
    expect(markup).toContain(
      "grid-cols-[repeat(auto-fill,minmax(min(100%,20rem),1fr))]"
    )
    expect(markup).toContain("items-stretch gap-3")
    expect(markup).toContain(
      'data-public-map-member-rail-section="saved-list-scroll"'
    )
    expect(markup).toContain('data-slot="scroll-area"')
    expect(markup).toContain(
      "h-full min-h-0 flex-1 overflow-hidden bg-transparent"
    )
    expect(markup).toContain("scroll-fade-effect-y")
    expect(markup).toContain("overscroll-contain")
    expect(markup).toContain("[--mask-height:1.5rem]")
    expect(markup).toContain("[--scroll-buffer:1rem]")
    expect(markup).toContain(
      "h-auto w-0 max-w-full min-w-0 flex-1 justify-start overflow-hidden"
    )
    expect(markup).toContain("text-left font-normal whitespace-normal")
    expect(markup).toContain("w-full min-w-0 overflow-hidden")
    expect(markup).not.toContain("max-h-[52vh]")
  })

  it("shows collected resources in My Map and supports removal", () => {
    const resource = buildResourceItem()

    expect(
      filterPublicMapSavedResources({
        activeGroup: "food",
        query: "pantry",
        savedResources: [resource],
      }).map((item) => item.id)
    ).toEqual([resource.id])
    expect(
      filterPublicMapSavedResources({
        activeGroup: "health",
        query: "",
        savedResources: [resource],
      })
    ).toEqual([])

    const markup = renderToStaticMarkup(
      React.createElement(PublicMapMemberRail, {
        savedOrganizations: [],
        savedResources: [resource],
        onSelectOrganization: () => {},
        onSelectResource: () => {},
        onToggleFavorite: () => {},
        onToggleCollectedResource: () => {},
      })
    )

    expect(markup).toContain(">My Map<")
    expect(markup).toContain("Seed Food Access")
    expect(markup).toContain(">Food<")
    expect(markup).toContain("Food pantry and meal support")
    expect(markup).toContain('aria-label="Remove Seed Food Access from My Map"')
    expect(markup).toContain('aria-pressed="true"')
  })

  it("retains resolved My Map resources through empty and stale refreshes", () => {
    const resource = buildResourceItem()
    const initial = resolvePublicMapCollectedResources({
      collectedResourceIds: [resource.id],
      resourceItems: [resource],
    })
    const retained = resolvePublicMapCollectedResources({
      collectedResourceIds: [resource.id],
      resourceItems: [],
      retainedResources: initial,
    })

    expect(retained).toEqual([resource])
    expect(
      resolvePublicMapCollectedResources({
        collectedResourceIds: [resource.id],
        resourceItems: [],
        retainedResources: [],
      })
    ).toEqual([])
    expect(
      resolvePublicMapCollectedResources({
        collectedResourceIds: [],
        resourceItems: [],
        retainedResources: retained,
      })
    ).toEqual([])
  })

  it("does not show a false-empty My Map while collected resources resolve", () => {
    const loadingMarkup = renderToStaticMarkup(
      React.createElement(PublicMapMemberRail, {
        savedOrganizations: [],
        savedResources: [],
        unresolvedCollectedResourceCount: 2,
        resourceItemsLoadStatus: "loading",
        onSelectOrganization: () => {},
        onToggleFavorite: () => {},
      })
    )
    const errorMarkup = renderToStaticMarkup(
      React.createElement(PublicMapMemberRail, {
        savedOrganizations: [],
        savedResources: [],
        unresolvedCollectedResourceCount: 2,
        resourceItemsLoadStatus: "error",
        resourceItemsLoadError: PUBLIC_MAP_RESOURCE_ITEMS_OFFLINE_ERROR,
        onRetryResourceItems: () => {},
        onSelectOrganization: () => {},
        onToggleFavorite: () => {},
      })
    )

    expect(loadingMarkup).toContain("Loading My Map")
    expect(loadingMarkup).toContain("Loading collected resources…")
    expect(loadingMarkup).not.toContain("Nothing collected yet")
    expect(errorMarkup).toContain("Collected resources unavailable")
    expect(errorMarkup).toContain("You’re offline")
    expect(errorMarkup).toContain("Try again")
  })

  it("uses the right rail directory detail view when a map organization is selected", () => {
    const organization = buildOrganization()
    const groupCounts = buildPublicMapGroupFilterCounts(
      buildListItems(organization)
    )
    expect(
      resolvePublicMapDirectoryRailMode({
        sidebarMode: "details",
        selectedOrganization: organization,
      })
    ).toBe("details")
    expect(
      resolvePublicMapDirectoryRailMode({
        sidebarMode: "details",
        selectedOrganization: null,
      })
    ).toBe("search")

    const markup = renderToStaticMarkup(
      React.createElement(PublicMapDirectoryRail, {
        sidebarMode: "details",
        items: buildListItems(organization),
        organizations: [organization],
        selectedItemId: organization.id,
        selectedOrganization: organization,
        favorites: [organization.id],
        query: "",
        activeGroup: "all",
        groupCounts,
        searchContext: null,
        onQueryChange: () => {},
        onActiveGroupChange: () => {},
        onToggleFavorite: () => {},
        onSelectItem: () => {},
        onOpenDetails: () => {},
        onBackToSearch: () => {},
        setSidebarMode: () => {},
      })
    )

    expect(markup).toContain(
      'data-public-map-right-rail-section="directory-detail"'
    )
    expect(markup).toContain(
      'data-public-map-right-rail-section="directory-detail-scroll"'
    )
    expect(markup).toContain(
      "flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
    )
    expect(markup).toContain("h-full min-h-0 flex-1 overflow-hidden pr-2")
    expect(markup).toContain("scroll-fade-effect-y")
    expect(markup).toContain('data-slot="scroll-area"')
    expect(markup).toContain(organization.name)
    expect(markup).toContain('aria-label="Back to search"')
    expect(markup).toContain('aria-label="Remove Atlas Collective from My Map"')
    expect(markup).toContain('aria-pressed="true"')
  })

  it("can mount the find search panel into the shell sidebar without the map overlay rail", () => {
    const organization = buildOrganization()
    const groupCounts = buildPublicMapGroupFilterCounts(
      buildListItems(organization)
    )
    const markup = renderToStaticMarkup(
      React.createElement(
        SidebarProvider,
        { defaultOpen: true },
        React.createElement(
          Sidebar,
          { collapsible: "offcanvas", variant: "sidebar" },
          React.createElement(PublicMapShellSidebarPanel, {
            sidebarMode: "search",
            items: buildListItems(organization),
            organizations: [organization],
            selectedItemId: organization.id,
            selectedOrganization: organization,
            favorites: [],
            query: "",
            activeGroup: "all",
            groupCounts,
            searchContext: null,
            onQueryChange: () => {},
            onActiveGroupChange: () => {},
            onToggleFavorite: () => {},
            onSelectItem: () => {},
            onOpenDetails: () => {},
            onBackToSearch: () => {},
            setSidebarMode: () => {},
          })
        )
      )
    )

    expect(markup).not.toContain(">Resource map<")
    expect(markup).toContain('aria-label="Find organizations and resources"')
    expect(markup).toContain('aria-label="Filter resources by category"')
    expect(markup).toContain(
      'data-public-map-sidebar-section="rail-organizations-scroll"'
    )
    expect(markup).toContain(">Resources<")
    expect(markup).not.toContain(">Active<")
    expect(markup).not.toContain(
      'aria-label="Resources directory status: active, 1"'
    )
    expect(markup).not.toContain("users online")
    expect(markup).not.toContain(
      'data-public-map-sidebar-section="rail-detail-scroll"'
    )
    expect(markup).not.toContain("Hide search panel")
  })

  it("shows organization details in the shell sidebar when the find panel is in detail mode", () => {
    const organization = buildOrganization({
      website: "https://atlas.example.org",
      locationUrl: "https://atlas.example.org/profile-location",
      programPreview: buildProgramPreview({
        id: "resource-1",
        title: "Atlas resource library",
        activityKind: "Web resource",
        chips: ["Web resource", "Digital"],
        ctaUrl: null,
        durationLabel: "Ongoing",
        locationUrl: "https://atlas.example.org/resources",
        locationType: "online",
      }),
      programs: [
        buildProgramPreview({
          id: "resource-1",
          title: "Atlas resource library",
          activityKind: "Web resource",
          chips: ["Web resource", "Digital"],
          ctaUrl: null,
          durationLabel: "Ongoing",
          locationUrl: "https://atlas.example.org/resources",
          locationType: "online",
        }),
      ],
      programCount: 1,
    })
    const groupCounts = buildPublicMapGroupFilterCounts(
      buildListItems(organization)
    )
    const markup = renderToStaticMarkup(
      React.createElement(
        SidebarProvider,
        { defaultOpen: true },
        React.createElement(
          Sidebar,
          { collapsible: "offcanvas", variant: "sidebar" },
          React.createElement(PublicMapShellSidebarPanel, {
            sidebarMode: "details",
            items: buildListItems(organization),
            organizations: [organization],
            selectedItemId: organization.id,
            selectedOrganization: organization,
            favorites: [],
            query: "",
            activeGroup: "all",
            groupCounts,
            searchContext: null,
            onQueryChange: () => {},
            onActiveGroupChange: () => {},
            onToggleFavorite: () => {},
            onSelectItem: () => {},
            onOpenDetails: () => {},
            onBackToSearch: () => {},
            setSidebarMode: () => {},
          })
        )
      )
    )

    expect(markup).toContain(organization.name)
    expect(markup).toContain("Links from activities")
    expect(markup).toContain(
      "Links attached to published programs, events, services, and web resources from this organization."
    )
    expect(markup).toContain("Atlas resource library")
    expect(markup).toContain("Web resource · Ongoing")
    expect(markup).toContain("atlas.example.org")
    expect(markup).not.toContain("Provided by organization profile")
    expect(markup).not.toContain("Needs review")
    expect(markup).not.toContain("Reviewed source")
    expect(markup).not.toContain("Verified source")
    const addressIndex = markup.indexOf(">Address<")
    const linksIndex = markup.indexOf(">Links from activities<")
    const activityIndex = markup.indexOf(">Activity<")
    expect(addressIndex).toBeGreaterThan(-1)
    expect(linksIndex).toBeGreaterThan(addressIndex)
    expect(activityIndex).toBeGreaterThan(linksIndex)
    expect(markup).toContain(
      'data-public-map-sidebar-section="rail-detail-scroll"'
    )
    expect(markup).toContain(
      "h-full min-h-0 flex-1 overflow-hidden px-1 pr-3.5"
    )
    expect(markup).toContain("scroll-fade-effect-y")
    expect(markup).toContain('aria-label="Share"')
    expect(markup).toContain('aria-label="Collect Atlas Collective in My Map"')
    expect(
      markup.indexOf('aria-label="Collect Atlas Collective in My Map"')
    ).toBeGreaterThan(markup.indexOf('aria-label="Share"'))
    expect(markup).not.toContain('aria-label="Search public organizations"')
    expect(markup).not.toContain('aria-label="Hide organization panel"')
  })

  it("keeps the drawer result list and detail bodies scrollable at every snap point", () => {
    const organization = buildOrganization()
    const resource = buildResourceItem()
    const items = [buildPlatformOrganizationMapItem(organization), resource]
    const groupCounts = buildPublicMapGroupFilterCounts(items)
    const searchMarkup = renderToStaticMarkup(
      React.createElement(PublicMapDrawerSearchPanel, {
        query: "Atlas",
        items,
        organizations: [organization],
        selectedItemId: null,
        selectedOrgId: null,
        drawerBodyScrollable: false,
        activeGroup: "all",
        groupCounts,
        onQueryChange: () => {},
        onActiveGroupChange: () => {},
        onSelectItem: () => {},
        onOpenDetails: () => {},
      })
    )
    const organizationDetailMarkup = renderToStaticMarkup(
      React.createElement(PublicMapDrawerDetailPanel, {
        organization,
        favorites: [],
        drawerBodyScrollable: false,
        onBack: () => {},
        onToggleFavorite: () => {},
      })
    )
    const resourceDetailMarkup = renderToStaticMarkup(
      React.createElement(PublicMapResourceDrawerDetailPanel, {
        item: resource,
        drawerBodyScrollable: false,
        onBack: () => {},
      })
    )

    const resultListScrollClassName = extractClassNameByAttribute(
      searchMarkup,
      "data-public-map-organization-list-scroll",
      "true"
    )
    const resultListStackClassName = extractClassNameByAttribute(
      searchMarkup,
      "data-public-map-organization-list-section",
      "list-stack"
    )
    const organizationDetailScrollClassName = extractClassNameByAttribute(
      organizationDetailMarkup,
      "data-public-map-sidebar-section",
      "drawer-detail-scroll"
    )
    const resourceDetailScrollClassName = extractClassNameByAttribute(
      resourceDetailMarkup,
      "data-public-map-sidebar-section",
      "drawer-detail-scroll"
    )
    expect(searchMarkup).not.toContain(
      'data-public-map-sidebar-section="drawer-organizations-scroll"'
    )
    expect(resultListStackClassName).toContain("mx-auto")
    expect(resultListStackClassName).toContain("max-w-3xl")
    expect(resultListStackClassName).toContain("min-h-0 flex-1")
    expect(resultListScrollClassName).toContain("overflow-y-auto")
    expect(resultListScrollClassName).toContain("rounded-2xl")
    expect(resultListScrollClassName).toContain("border")
    expect(resultListScrollClassName).toContain("scroll-fade-effect-y")
    expect(resultListScrollClassName).toContain("overscroll-contain")
    expect(resultListScrollClassName).toContain(
      "[-webkit-overflow-scrolling:touch]"
    )
    expect(organizationDetailMarkup).toContain(
      'data-public-map-sidebar-section="drawer-detail-scroll"'
    )
    expect(organizationDetailMarkup).toContain(
      'data-public-map-profile="organization"'
    )
    expect(organizationDetailMarkup).not.toContain(">Organization</p>")
    expect(organizationDetailMarkup).toContain('aria-label="Back to search"')
    expect(
      organizationDetailMarkup.indexOf('aria-label="Back to search"')
    ).toBeLessThan(
      organizationDetailMarkup.indexOf(
        'data-public-map-sidebar-section="drawer-detail-scroll"'
      )
    )
    expect(organizationDetailMarkup).toContain(
      "mx-auto w-full max-w-3xl space-y-4"
    )
    expect(organizationDetailMarkup).not.toContain('data-slot="scroll-area"')
    expect(organizationDetailScrollClassName).toContain("h-full")
    expect(organizationDetailScrollClassName).toContain("min-h-0")
    expect(organizationDetailScrollClassName).toContain("flex-1")
    expect(organizationDetailScrollClassName).toContain("overflow-y-auto")
    expect(organizationDetailScrollClassName).toContain("scroll-fade-effect-y")
    expect(organizationDetailScrollClassName).toContain("overscroll-contain")
    expect(resourceDetailMarkup).toContain(
      'data-public-map-sidebar-section="drawer-detail-scroll"'
    )
    expect(resourceDetailMarkup).toContain('data-public-map-profile="resource"')
    expect(resourceDetailMarkup).toContain("mx-auto w-full max-w-3xl space-y-4")
    expect(resourceDetailMarkup).not.toContain('data-slot="scroll-area"')
    expect(resourceDetailScrollClassName).toContain("h-full")
    expect(resourceDetailScrollClassName).toContain("min-h-0")
    expect(resourceDetailScrollClassName).toContain("flex-1")
    expect(resourceDetailScrollClassName).toContain("overflow-y-auto")
    expect(resourceDetailScrollClassName).toContain("scroll-fade-effect-y")
    expect(resourceDetailScrollClassName).toContain("overscroll-contain")
  })

  it("shows the Find Nearby discovery home before search engagement", () => {
    const resource = buildResourceItem({
      resourceCategories: [
        "food",
        "food_water",
        "housing_emergency_shelter",
        "emergency",
        "health_primary_care",
        "health_dental",
        "health_mental_health",
        "health_senior_health",
      ],
    })
    const groupCounts = buildPublicMapGroupFilterCounts([resource])
    const featuredGuide = {
      id: "chicago-food-access",
      title: "Chicago Food Access",
      subtitle: "Food support in Chicago.",
      kicker: "Chicago guide",
      itemCount: 1,
      items: [resource],
      imageUrl: "/images/public-map/guides/chicago-food-access-cover.webp",
      primaryResourceCategory: "food",
      visualVariant: "city",
    } satisfies PublicMapResourceGuide
    const markup = renderToStaticMarkup(
      React.createElement(PublicMapDrawerSearchPanel, {
        query: "",
        items: [resource],
        organizations: [],
        selectedItemId: null,
        activeGroup: "all",
        featuredGuides: [featuredGuide],
        savedGuideIds: [],
        discoveryGroupCounts: groupCounts,
        groupCounts,
        onQueryChange: () => {},
        onActiveGroupChange: () => {},
        onSelectItem: () => {},
        onOpenDetails: () => {},
        onGuideSelect: () => {},
        onToggleSavedGuide: () => {},
      })
    )

    expect(markup).toContain('data-public-map-directory-home=""')
    expect(markup).toContain('data-public-map-directory-home-content=""')
    expect(markup).toContain("mx-auto w-full max-w-3xl")
    expect(markup).toContain(">Find Nearby</h2>")
    expect(markup).toContain(">Basic needs</h3>")
    expect(markup).toContain(">Health</h3>")
    expect(markup).toContain(">Water</span>")
    expect(markup).toContain(">Mental health</span>")
    expect(markup).toContain(">Guides We Love</h2>")
    expect(markup).toContain("Chicago Food Access")
    expect(markup).toContain('data-presentation="featured"')
    expect(markup).toContain('aria-label="Save Chicago Food Access to My Map"')
    expect(markup).toContain('aria-label="Share Chicago Food Access"')
    expect(markup).not.toContain(">Resources</p>")
    expect(markup).not.toContain("pb-3 border-border/60 border-b")
  })

  it("renders actionable empty and failure states on the discovery home", () => {
    const groupCounts = buildPublicMapGroupFilterCounts([])
    const baseProps = {
      query: "",
      items: [],
      organizations: [],
      selectedItemId: null,
      activeGroup: "all" as const,
      featuredGuides: [],
      savedGuideIds: [],
      discoveryGroupCounts: groupCounts,
      groupCounts,
      onQueryChange: () => {},
      onActiveGroupChange: () => {},
      onSelectItem: () => {},
      onOpenDetails: () => {},
      onGuideSelect: () => {},
      onToggleSavedGuide: () => {},
      onRetryResourceItems: () => {},
    }
    const emptyMarkup = renderToStaticMarkup(
      React.createElement(PublicMapDrawerSearchPanel, {
        ...baseProps,
        resourceItemsLoadStatus: "ready",
      })
    )
    const errorMarkup = renderToStaticMarkup(
      React.createElement(PublicMapDrawerSearchPanel, {
        ...baseProps,
        resourceItemsLoadStatus: "error",
      })
    )

    expect(emptyMarkup).toContain('data-public-map-directory-empty="empty"')
    expect(emptyMarkup).toContain("No nearby resources yet")
    expect(emptyMarkup).toContain(">Start searching</button>")
    expect(emptyMarkup).not.toContain(">Find Nearby</h2>")
    expect(errorMarkup).toContain('data-public-map-directory-empty="error"')
    expect(errorMarkup).toContain("We couldn’t load nearby resources")
    expect(errorMarkup).toContain(">Try again</button>")
    expect(errorMarkup).not.toContain('data-public-map-search-empty="true"')
  })

  it("renders polished, map-owned recovery states for configuration and runtime failures", () => {
    const configurationMarkup = renderToStaticMarkup(
      React.createElement(PublicMapFailureState, {
        reason: "configuration",
        onBrowseDirectory: () => {},
      })
    )
    const runtimeMarkup = renderToStaticMarkup(
      React.createElement(PublicMapFailureState, {
        reason: "runtime",
        onBrowseDirectory: () => {},
        onRetry: () => {},
      })
    )

    expect(configurationMarkup).toContain(
      'data-public-map-failure-state="configuration"'
    )
    expect(configurationMarkup).toContain("The map couldn’t load")
    expect(configurationMarkup).toContain(">Browse directory</button>")
    expect(configurationMarkup).not.toContain("MAPBOX_TOKEN")
    expect(configurationMarkup).not.toContain(">Try map again</button>")
    expect(runtimeMarkup).toContain('data-public-map-failure-state="runtime"')
    expect(runtimeMarkup).toContain(">Try map again</button>")
    expect(runtimeMarkup).toContain(
      'data-react-grab-owner-source="src/components/public/public-map-index/map-failure-state.tsx"'
    )
    expect(runtimeMarkup).toContain('role="alert"')
  })

  it("renders actionable loading, empty, and failure states for search", () => {
    const baseProps = {
      items: [],
      organizations: [],
      selectedOrgId: null,
      constrainedLayout: true,
      onSelectOrg: () => {},
      onOpenDetails: () => {},
      onClearQuery: () => {},
      onRetryLoad: () => {},
    }
    const loadingMarkup = renderToStaticMarkup(
      React.createElement(PublicMapOrganizationList, {
        ...baseProps,
        query: "housing",
        loadStatus: "loading",
      })
    )
    const emptyMarkup = renderToStaticMarkup(
      React.createElement(PublicMapOrganizationList, {
        ...baseProps,
        query: "housing",
        loadStatus: "ready",
        leadingContent: React.createElement(
          "div",
          { "data-search-shortcut": "guide" },
          "Housing guide"
        ),
      })
    )
    const errorMarkup = renderToStaticMarkup(
      React.createElement(PublicMapOrganizationList, {
        ...baseProps,
        query: "",
        loadStatus: "error",
        loadError: "The full resource directory could not load.",
      })
    )
    const offlineMarkup = renderToStaticMarkup(
      React.createElement(PublicMapOrganizationList, {
        ...baseProps,
        query: "",
        loadStatus: "error",
        loadError: PUBLIC_MAP_RESOURCE_ITEMS_OFFLINE_ERROR,
      })
    )

    expect(loadingMarkup).toContain('data-public-map-search-loading="true"')
    expect(loadingMarkup).toContain("Loading resources")
    expect(loadingMarkup.match(/data-slot="skeleton"/g)).toHaveLength(12)
    expect(emptyMarkup).toContain('data-public-map-search-empty="true"')
    expect(emptyMarkup).toContain("No matches for")
    expect(emptyMarkup).toContain("Clear search")
    expect(emptyMarkup).toContain('data-search-shortcut="guide"')
    expect(emptyMarkup).toContain("Housing guide")
    expect(errorMarkup).toContain("Resource directory unavailable")
    expect(errorMarkup).toContain("Try again")
    expect(offlineMarkup).toContain("You’re offline")
    expect(offlineMarkup).toContain("Connect to the internet")
  })

  it("keeps stale results visible through offline recovery", () => {
    const resource = buildResourceItem()
    const markup = renderToStaticMarkup(
      React.createElement(PublicMapDrawerSearchPanel, {
        query: "",
        items: [resource],
        organizations: [],
        selectedItemId: null,
        selectedOrgId: null,
        activeGroup: "all",
        groupCounts: buildPublicMapGroupFilterCounts([resource]),
        resourceItemsLoadStatus: "error",
        resourceItemsLoadError: PUBLIC_MAP_RESOURCE_ITEMS_OFFLINE_ERROR,
        onQueryChange: () => {},
        onActiveGroupChange: () => {},
        onSelectItem: () => {},
        onOpenDetails: () => {},
        onRetryResourceItems: () => {},
      })
    )

    expect(markup).toContain("Last loaded results")
    expect(markup).toContain("Showing last loaded results")
    expect(markup).toContain(resource.title)
    expect(markup).toContain("Try again")
  })

  it("hides raw data API endpoints from public resource detail links", () => {
    const rawArcgisUrl =
      "https://services2.arcgis.com/w657bnjzrjguNyOy/arcgis/rest/services/Warming_and_Cooling_Centers/FeatureServer/0/query?where=1%3D1&outFields=*&returnGeometry=true&outSR=4326&f=json"
    const rawOverpassUrl =
      "https://overpass-api.de/api/interpreter?data=%5Bout%3Ajson%5D%3Bout%3B"
    const rawSocrataUrl =
      "https://data.cityofchicago.org/resource/msrk-w9ih.json?$limit=500"
    const markup = renderToStaticMarkup(
      React.createElement(PublicMapResourceDrawerDetailPanel, {
        item: buildResourceItem({
          sourceLabel: "County open data",
          sourceUrl: rawArcgisUrl,
          links: [
            {
              id: "raw-source",
              label: "Raw data endpoint",
              url: rawArcgisUrl,
              type: "source",
              domain: "services2.arcgis.com",
            },
            {
              id: "raw-overpass-source",
              label: "Overpass endpoint",
              url: rawOverpassUrl,
              type: "source",
              domain: "overpass-api.de",
            },
            {
              id: "raw-socrata-source",
              label: "Socrata endpoint",
              url: rawSocrataUrl,
              type: "source",
              domain: "data.cityofchicago.org",
            },
            {
              id: "public-page",
              label: "Cooling center information",
              url: "https://cooling.example.org/info",
              type: "website",
              domain: "cooling.example.org",
            },
          ],
        }),
        drawerBodyScrollable: false,
        onBack: () => {},
      })
    )

    expect(markup).toContain("Cooling center information")
    expect(markup).toContain("cooling.example.org")
    expect(markup).not.toContain("services2.arcgis.com")
    expect(markup).not.toContain("overpass-api.de")
    expect(markup).not.toContain("data.cityofchicago.org")
    expect(markup).not.toContain("Raw data endpoint")
    expect(markup).not.toContain("Overpass endpoint")
    expect(markup).not.toContain("Socrata endpoint")
    expect(markup).not.toContain("Open source")
  })
})
