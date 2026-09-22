import { describe, expect, it, vi } from "vitest"
import { resolvePublicMapResourceLinkBranding } from "@/components/public/public-map-index/resource-link-branding"

import { shouldShowPublicMapCoolingCenters, resolvePublicMapItemPresentations, resolvePublicMapResourceDetailPresentation, resolvePublicMapResourcePresentation } from "@/lib/public-map/resource-seasonal-presentation"

import { buildResourceAddressLines } from "@/components/public/public-map-index/resource-detail-helpers"

import {
  PUBLIC_MAP_RESOURCE_CATEGORY_COLORS,
  PUBLIC_MAP_RESOURCE_CATEGORY_ORDER,
  PUBLIC_MAP_RESOURCE_TOP_LEVEL_CATEGORY_DEFINITIONS,
  getPublicMapResourceCategoryDefinition,
} from "@/lib/public-map/resource-categories"
import {
  PUBLIC_MAP_RESOURCE_CATEGORY_ICON_PATHS,
  PUBLIC_MAP_RESOURCE_CATEGORY_STROKE_ICON_PATHS,
  resolvePublicMapResourceCategoryIconPaths,
} from "@/lib/public-map/resource-category-icon-paths"
import {
  type ExternalResourceMapItem,
  buildPlatformOrganizationMapItem,
  buildPublicMapItems,
  inferPublicMapResourceCategoriesForOrganization,
  publicMapItemMatchesGroupFilter,
  resolvePublicMapItemSelectableId,
} from "@/lib/public-map/resource-map-items"
import { buildExternalResourceMapItemFromLocalPreviewRecord } from "@/lib/public-map/resource-map-local-preview-adapter"
import {
  buildFilteredPublicMapItems,
  buildPublicMapListItems,
  buildPublicMapSelectableItemMap,
  rankPublicMapListItems,
  resolvePublicMapListItemsFromSelectableIds,
} from "@/components/public/public-map-index/map-items-state"
import {
  buildPublicMapResourceGuides,
  buildPublicMapSavedResourceGuides,
  filterPublicMapFeaturedResourceGuides,
} from "@/components/public/public-map-index/resource-guides"
import {
  PUBLIC_MAP_SUPERADMIN_RESOURCE_SEED_CITY_ANCHORS,
  PUBLIC_MAP_SUPERADMIN_RESOURCE_SEED_ITEMS,
} from "@/lib/public-map/resource-seed-items"
import {
  buildPublicMapItemPointFeatures,
  parsePublicMapOrganizationIds,
} from "@/lib/public-map/public-map-geojson"
import {
  clearPublicMapResourceItemsCache,
  loadPublicMapResourceItems,
} from "@/components/public/public-map-index/use-resource-map-items"
import {
  PUBLIC_MAP_SPECIAL_PILL_MARKER_STYLE_KEY,
  PUBLIC_MAP_STANDARD_MARKER_STYLE_KEY,
} from "@/lib/public-map/public-map-marker-styles"
import type { PublicMapOrganization } from "@/lib/queries/public-map-index"

function buildOrganization(
  overrides: Partial<PublicMapOrganization> = {}
): PublicMapOrganization {
  return {
    id: "org-health",
    name: "Health Access Org",
    tagline: "Medical and mental health care",
    description: "Free clinic, therapy, and dental navigation.",
    boilerplate: null,
    vision: null,
    mission: "Expand medical care access.",
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
    address: "Chicago, IL",
    addressStreet: null,
    addressPostal: null,
    city: "Chicago",
    state: "IL",
    country: "United States",
    locationUrl: null,
    publicSlug: "health-access-org",
    activityLinks: [],
    programPreview: null,
    programs: [],
    programCount: 0,
    groups: ["health"],
    primaryGroup: "health",
    isOnlineOnly: false,
    ...overrides,
  }
}

function buildGuideResourceItem(
  id: string,
  overrides: Partial<ExternalResourceMapItem> = {}
): ExternalResourceMapItem {
  return {
    id,
    itemType: "external_resource",
    title: "Cooling Center",
    subtitle: "Official heat relief site",
    description: "Official cooling center during high heat.",
    latitude: 40.7128,
    longitude: -74.006,
    address: "1 Civic Plaza",
    addressStreet: "1 Civic Plaza",
    city: "Manhattan",
    state: "NY",
    country: "United States",
    orgCategory: null,
    resourceCategories: ["emergency_cooling_centers"],
    primaryResourceCategory: "emergency_cooling_centers",
    verificationStatus: "external_data",
    sourceLabel: "NYC cooling center feed",
    sourceUrl: "https://example.nyc.gov/cooling-centers",
    lastVerifiedAt: null,
    visibility: "superadmin_preview",
    markerImageUrl: null,
    ...overrides,
  }
}

describe("public map resource map items", () => {
  it("looks up website favicons using only the destination hostname", () => {
    const icon = resolvePublicMapResourceLinkBranding({
      href: "https://user:private@www.example.org/apply?token=secret#private",
    })
    expect(icon.domain).toBe("example.org")
    expect(icon.iconUrls).toEqual(["https://www.google.com/s2/favicons?domain=example.org&sz=64"])
  })

  it("uses the provider logo only for that provider's website", () => {
    const options = {
      websiteHref: "https://www.example.org",
      faviconUrl: "https://cdn.example.org/logo.png",
    }
    expect(resolvePublicMapResourceLinkBranding({ ...options, href: "https://example.org/donate" }).iconUrls[0])
      .toBe(options.faviconUrl)
    expect(resolvePublicMapResourceLinkBranding({ ...options, href: "https://facebook.com/example" }).iconUrls)
      .toEqual(["https://www.google.com/s2/favicons?domain=facebook.com&sz=64"])
  })

  it.each(["mailto:hello@example.org", "tel:+12125550100", "/local", "javascript:alert(1)"])(
    "does not request a site favicon for a non-HTTP target: %s", (href) => {
      expect(resolvePublicMapResourceLinkBranding({ href }).iconUrls).toEqual([])
    }
  )

  it("keeps the ordinary library under its existing ID below the heat threshold", () => {
    const source = buildGuideResourceItem("shared-library-id", {
      title: "Brooklyn Central Library cooling center",
      resourceCategories: ["emergency_cooling_centers", "environment", "community_libraries", "community"],
      weatherEligible: true,
      hoursLabel: "Heat-event hours only",
    })
    const ordinary = resolvePublicMapResourcePresentation(source, false)!
    expect(ordinary).toMatchObject({
      id: source.id,
      title: "Brooklyn Central Library",
      primaryResourceCategory: "community_libraries",
      seasonalPresentation: "normal",
      weatherEligible: false,
      hoursLabel: null,
    })
    expect(ordinary.resourceCategories).not.toContain("emergency_cooling_centers")
    expect(buildPublicMapItemPointFeatures([ordinary])[0].properties.markerStyleKey).toBe("standard")
    expect(buildPublicMapItemPointFeatures([source])[0].properties.markerStyleKey).toBe("special-pill")
    expect(ordinary.latitude).toBe(source.latitude)
    expect(ordinary.verificationStatus).toBe(source.verificationStatus)
    expect(source.title).toBe("Brooklyn Central Library cooling center")
    expect(resolvePublicMapResourcePresentation(source, true)).toBe(source)
  })

  it("finds an ordinary resource by its retained seasonal name without showing cooling status", () => {
    const source = buildGuideResourceItem("search-library", {
      title: "Brooklyn Central Library cooling center",
      aliases: ["Central Library"],
      sourceLabel: "NYC Emergency Management - Cool Options",
      resourceCategories: ["emergency_cooling_centers", "community_libraries"],
    })
    const ordinary = resolvePublicMapResourcePresentation(source, false)!
    const results = rankPublicMapListItems({ items: [ordinary], query: "Brooklyn Central Library cooling" })
    expect(results).toMatchObject([{ id: source.id, title: "Brooklyn Central Library", primaryResourceCategory: "community_libraries" }])
    expect(ordinary.aliases).toContain("Central Library")
    expect(ordinary.resourceCategories).not.toContain("emergency_cooling_centers")
    expect(source.aliases).toEqual(["Central Library"])
  })

  it("retains a named cooling host even when its feed only gives a broad category", () => {
    const source = buildGuideResourceItem("college", {
      title: "Daley College — Cooling Center",
      resourceCategories: ["emergency_cooling_centers", "environment"],
    })
    expect(resolvePublicMapResourcePresentation(source, false)).toMatchObject({
      title: "Daley College",
      primaryResourceCategory: "education",
    })
  })

  it.each([
    ["Community Center cooling center - Delano", "Community Center - Delano"],
    ["Senior Center cooling center - Fresno", "Senior Center - Fresno"],
    ["Harbor Library — Cooling and Warming Center", "Harbor Library"],
    ["Warming & Cooling Center: Harbor Library", "Harbor Library"],
  ])("removes the seasonal role while keeping facility and city: %s", (title, expected) => {
    const source = buildGuideResourceItem("named-host", { title })
    expect(resolvePublicMapResourcePresentation(source, false)?.title).toBe(expected)
    expect(source.title).toBe(title)
  })

  it("keeps heat-only records seasonal without inventing a normal service", () => {
    const source = buildGuideResourceItem("heat-only", { title: "Cooling center" })
    expect(resolvePublicMapResourcePresentation(source, false)).toBeNull()
    expect(resolvePublicMapResourcePresentation(source, true)).toBe(source)
  })

  it("preserves other resources and removes cooling-only service claims from ordinary listings", () => {
    const source = buildGuideResourceItem("mixed", {
      title: "Cooling Center | Harbor Library",
      description: "This cooling center opens during heat alerts.",
      services: [
        { id: "cooling", title: "Cooling center", description: "Heat-event access" },
        { id: "library", title: "Library", description: "Public library services" },
      ],
    })
    const ordinary = resolvePublicMapResourcePresentation(source, false)!
    expect(ordinary.title).toBe("Harbor Library")
    expect(ordinary.description).toBeNull()
    expect(ordinary.services?.map(service => service.id)).toEqual(["library"])
    const unaffected = buildGuideResourceItem("food", {
      title: "Pantry",
      resourceCategories: ["food"],
      primaryResourceCategory: "food",
    })
    expect(resolvePublicMapResourcePresentation(unaffected, false)).toBe(unaffected)
  })

  it("keeps the ordinary presentation when full resource details arrive", () => {
    const source = buildGuideResourceItem("detail", {
      title: "Harbor Library cooling center",
      resourceCategories: ["emergency_cooling_centers", "community_libraries"],
    })
    const ordinary = resolvePublicMapResourcePresentation(source, false)!
    expect(resolvePublicMapResourceDetailPresentation(ordinary, source)).toMatchObject({
      id: source.id, title: "Harbor Library", seasonalPresentation: "normal",
    })
    expect(resolvePublicMapResourceDetailPresentation(source, source)).toBe(source)
    expect(resolvePublicMapResourceDetailPresentation(source, ordinary)).toBe(source)
  })

  it("uses normal versions inside ordinary service guides during cool weather", () => {
    const items = Array.from({ length: 5 }, (_, i) => buildGuideResourceItem(`health-${i}`, {
      title: `Clinic ${i} cooling center`,
      city: "Chicago", state: "IL",
      resourceCategories: ["emergency_cooling_centers", "health"],
    }))
    const guide = buildPublicMapResourceGuides(items, { showCoolingCenters: false })
      .find(candidate => candidate.id === "chicago-health-care")!
    expect(guide.items).toHaveLength(5)
    expect(guide.items.map(item => item.title)).toEqual(items.map((_, i) => `Clinic ${i}`))
    expect(guide.items.map(item => item.id)).toEqual(items.map(item => item.id))
  })

  it("keeps saved IDs while applying the weather gate to saved resources and details", () => {
    const heatOnly = buildGuideResourceItem("saved-heat-only")
    const library = buildGuideResourceItem("saved-library", { title: "Harbor Library cooling center" })
    const sources = [heatOnly, library]
    const savedItems = resolvePublicMapItemPresentations(sources, false)
    const selectable = buildPublicMapSelectableItemMap([], savedItems)
    expect(savedItems).toMatchObject([{ id: library.id, title: "Harbor Library", seasonalPresentation: "normal" }])
    expect(selectable.has(resolvePublicMapItemSelectableId(heatOnly))).toBe(false)
    expect(selectable.get(resolvePublicMapItemSelectableId(library))).toBe(savedItems[0])
    expect(sources.map(item => item.id)).toEqual([heatOnly.id, library.id])
    expect(resolvePublicMapItemPresentations(sources, true)).toEqual(sources)
  })

  it.each([
    ["official_alert", true],
    ["forecast_threshold", true],
    ["none", false],
    ["unknown", false],
    [null, false],
    [undefined, false],
  ] as const)("uses only the weather signal %s for cooling presentation", (signal, expected) => {
    expect(shouldShowPublicMapCoolingCenters(signal)).toBe(expected)
  })

  it.each([false, true])("applies weather mode %s even inside a cooling guide", (showCoolingCenters) => {
    const source = buildGuideResourceItem("guide-library", {
      title: "Harbor Library cooling center",
      resourceCategories: ["emergency_cooling_centers", "community_libraries"],
    })
    const guideItems = [source, ...Array.from({ length: 9 }, (_, i) => ({ ...source, id: `guide-${i}` }))]
    const coolingGuide = buildPublicMapResourceGuides(guideItems, { showCoolingCenters })
      .find(guide => guide.id === "cooling-heat-relief")!
    expect(coolingGuide.itemCount).toBe(10)
    expect(coolingGuide.items.map(item => item.id)).toEqual(guideItems.map(item => item.id))
    expect(coolingGuide.items[0]).toMatchObject(showCoolingCenters
      ? { title: source.title, primaryResourceCategory: "emergency_cooling_centers" }
      : { title: "Harbor Library", primaryResourceCategory: "community_libraries", seasonalPresentation: "normal" })
  })

  it.each([
    {
      address: "80-45 Winchester Blvd, Building 4",
      addressStreet: null,
      expected: ["80-45 Winchester Blvd, Building 4"],
    },
    {
      address: " 80-45 Winchester Blvd, Building 4\n\n Queens, NY 11427\nUnited States ",
      addressStreet: " ",
      expected: ["80-45 Winchester Blvd, Building 4", "Queens, NY 11427", "United States"],
    },
    {
      address: "Legacy address text",
      addressStreet: "80-45 Winchester Blvd, Building 4",
      expected: ["80-45 Winchester Blvd, Building 4", "Queens, NY", "United States"],
    },
    {
      address: " ",
      addressStreet: null,
      expected: ["Queens, NY", "United States"],
    },
  ])("preserves resource addresses with partial structured fields: $address", ({ address, addressStreet, expected }) => {
    const item = buildGuideResourceItem("address-regression", {
      address,
      addressStreet,
      city: "Queens",
      state: "NY",
      country: "United States",
    })

    expect(buildResourceAddressLines(item)).toEqual(expected)
  })

  it("deduplicates concurrent public resource loads and supports cache clearing", async () => {
    clearPublicMapResourceItemsCache("/api/test-resource-items")
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      json: vi.fn(async () => ({ resourceItems: [] })),
      ok: true,
    } as unknown as Response)

    const firstLoad = loadPublicMapResourceItems("/api/test-resource-items")
    const concurrentLoad = loadPublicMapResourceItems(
      "/api/test-resource-items"
    )
    expect(concurrentLoad).toBe(firstLoad)
    await firstLoad

    await loadPublicMapResourceItems("/api/test-resource-items")
    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(fetchSpy).toHaveBeenCalledWith("/api/test-resource-items", {
      cache: "no-store",
      headers: { Accept: "application/json" },
    })

    clearPublicMapResourceItemsCache("/api/test-resource-items")
    await loadPublicMapResourceItems("/api/test-resource-items")
    expect(fetchSpy).toHaveBeenCalledTimes(3)

    fetchSpy.mockRestore()
    clearPublicMapResourceItemsCache("/api/test-resource-items")
  })

  it("keeps resource/service categories separate from public org groups", () => {
    expect(PUBLIC_MAP_RESOURCE_CATEGORY_ORDER).toEqual([
      "health",
      "food",
      "housing",
      "education",
      "employment",
      "finance",
      "legal",
      "family",
      "community",
      "emergency",
      "environment",
      "safety",
      "organizations",
      "international",
      "animals",
    ])
    expect(PUBLIC_MAP_RESOURCE_CATEGORY_COLORS.health).toBe("#059669")
    expect(PUBLIC_MAP_RESOURCE_CATEGORY_COLORS.food).toBe("#2563eb")
    expect(getPublicMapResourceCategoryDefinition("emergency").label).toBe(
      "Crisis support"
    )
  })

  it("keeps top-level marker colors intentional and non-gray", () => {
    expect(
      PUBLIC_MAP_RESOURCE_TOP_LEVEL_CATEGORY_DEFINITIONS.map(
        ({ key, tailwindToken }) => [key, tailwindToken]
      )
    ).toEqual(
      expect.arrayContaining([
        ["education", "amber-500"],
        ["employment", "orange-500"],
        ["organizations", "sky-500"],
      ])
    )

    expect(PUBLIC_MAP_RESOURCE_CATEGORY_COLORS.education).toBe("#f59e0b")
    expect(PUBLIC_MAP_RESOURCE_CATEGORY_COLORS.employment).toBe("#f97316")
    expect(PUBLIC_MAP_RESOURCE_CATEGORY_COLORS.organizations).toBe("#0ea5e9")
  })

  it("labels domestic violence resources as support", () => {
    expect(
      getPublicMapResourceCategoryDefinition("family_domestic_violence").label
    ).toBe("Domestic Violence Support")
  })

  it("uses a blue cooling-center marker identity instead of the red emergency siren", () => {
    expect(PUBLIC_MAP_RESOURCE_CATEGORY_COLORS.emergency).toBe("#dc2626")
    expect(PUBLIC_MAP_RESOURCE_CATEGORY_COLORS.emergency_cooling_centers).toBe(
      "#0284c7"
    )
    expect(
      getPublicMapResourceCategoryDefinition("emergency_cooling_centers")
    ).toMatchObject({
      iconName: "wind",
      markerColor: "#0284c7",
      parentKey: "environment",
      tailwindToken: "sky-600",
    })
    expect(
      getPublicMapResourceCategoryDefinition("emergency_cooling_centers")
        .iconName
    ).not.toBe(getPublicMapResourceCategoryDefinition("emergency").iconName)
    expect(
      resolvePublicMapResourceCategoryIconPaths("emergency_cooling_centers")
    ).toBe(PUBLIC_MAP_RESOURCE_CATEGORY_STROKE_ICON_PATHS.wind)
    expect(PUBLIC_MAP_RESOURCE_CATEGORY_STROKE_ICON_PATHS.wind).toEqual([
      "M12.8 19.6A2 2 0 1 0 14 16H2",
      "M17.5 8a2.5 2.5 0 1 1 2 4H2",
      "M9.8 4.4A2 2 0 1 1 11 8H2",
    ])
    expect(PUBLIC_MAP_RESOURCE_CATEGORY_ICON_PATHS.wind).toBeUndefined()
  })

  it("uses separate shopping cart and basket identities for food and community fridges", () => {
    expect(getPublicMapResourceCategoryDefinition("food")).toMatchObject({
      iconName: "shopping-cart",
      markerColor: "#2563eb",
      tailwindToken: "blue-600",
    })
    expect(resolvePublicMapResourceCategoryIconPaths("food")).toBe(
      PUBLIC_MAP_RESOURCE_CATEGORY_STROKE_ICON_PATHS["shopping-cart"]
    )
    expect(
      PUBLIC_MAP_RESOURCE_CATEGORY_STROKE_ICON_PATHS["shopping-cart"]
    ).toEqual([
      "M8 20a1 1 0 1 0 0 2a1 1 0 1 0 0-2",
      "M19 20a1 1 0 1 0 0 2a1 1 0 1 0 0-2",
      "M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12",
    ])
    expect(
      PUBLIC_MAP_RESOURCE_CATEGORY_ICON_PATHS["shopping-cart"]
    ).toBeUndefined()
    expect(PUBLIC_MAP_RESOURCE_CATEGORY_COLORS.food).toBe("#2563eb")
    expect(PUBLIC_MAP_RESOURCE_CATEGORY_COLORS.food_community_fridges).toBe(
      "#0891b2"
    )
    expect(
      getPublicMapResourceCategoryDefinition("food_community_fridges")
    ).toMatchObject({
      iconName: "shopping-basket",
      markerColor: "#0891b2",
      tailwindToken: "cyan-600",
    })
    expect(
      resolvePublicMapResourceCategoryIconPaths("food_community_fridges")
    ).toBe(PUBLIC_MAP_RESOURCE_CATEGORY_STROKE_ICON_PATHS["shopping-basket"])
    expect(
      PUBLIC_MAP_RESOURCE_CATEGORY_STROKE_ICON_PATHS["shopping-basket"]
    ).toHaveLength(7)
    expect(
      resolvePublicMapResourceCategoryIconPaths("food_community_fridges")
    ).not.toBe(PUBLIC_MAP_RESOURCE_CATEGORY_ICON_PATHS.bread)
  })

  it("uses special marker style keys separately from category semantics", () => {
    const coolingFeature = buildPublicMapItemPointFeatures([
      buildGuideResourceItem("cooling-special-style"),
    ])[0]
    const foodFeature = buildPublicMapItemPointFeatures([
      buildGuideResourceItem("food-standard-style", {
        primaryResourceCategory: "food",
        resourceCategories: ["food"],
        title: "Food Access",
      }),
    ])[0]

    expect(coolingFeature?.properties).toMatchObject({
      markerStyleKey: PUBLIC_MAP_SPECIAL_PILL_MARKER_STYLE_KEY,
      primaryResourceCategory: "emergency_cooling_centers",
    })
    expect(foodFeature?.properties).toMatchObject({
      markerStyleKey: PUBLIC_MAP_STANDARD_MARKER_STYLE_KEY,
      primaryResourceCategory: "food",
    })
  })

  it("shares category marker sprites across external resources", () => {
    const [firstFoodFeature, secondFoodFeature] =
      buildPublicMapItemPointFeatures([
        buildGuideResourceItem("food-a", {
          latitude: 41.88,
          longitude: -87.63,
          primaryResourceCategory: "food",
          resourceCategories: ["food"],
          title: "First Food Resource",
        }),
        buildGuideResourceItem("food-b", {
          latitude: 41.9,
          longitude: -87.65,
          primaryResourceCategory: "food",
          resourceCategories: ["food"],
          title: "Second Food Resource",
        }),
      ])
    const [healthFeature] = buildPublicMapItemPointFeatures([
      buildGuideResourceItem("health-a", {
        latitude: 41.92,
        longitude: -87.67,
        primaryResourceCategory: "health",
        resourceCategories: ["health"],
        title: "Health Resource",
      }),
    ])

    expect(firstFoodFeature?.properties.markerImageKey).toBe(
      secondFoodFeature?.properties.markerImageKey
    )
    expect(firstFoodFeature?.properties.markerImageKey).not.toBe(
      healthFeature?.properties.markerImageKey
    )
  })

  it("infers resource/service categories without replacing the org category", () => {
    const organization = buildOrganization()
    const categories =
      inferPublicMapResourceCategoriesForOrganization(organization)
    const item = buildPlatformOrganizationMapItem(organization)

    expect(item.orgCategory).toBe("health")
    expect(categories).toEqual(
      expect.arrayContaining([
        "health",
        "health_dental",
        "health_mental_health",
      ])
    )
    expect(item.verificationStatus).toBe("verified_platform")
  })

  it("matches category aliases as complete words instead of substrings", () => {
    const organization = buildOrganization({
      tagline: "Collaboration over competition",
      description: "Culturally competent guidance for local residents.",
      mission: null,
      needStatement: null,
      groups: ["community"],
      primaryGroup: "community",
    })
    const item = buildPlatformOrganizationMapItem(organization)

    expect(item.resourceCategories).not.toContain("animals")
    expect(
      publicMapItemMatchesGroupFilter({ activeGroup: "animals", item })
    ).toBe(false)

    expect(
      inferPublicMapResourceCategoriesForOrganization(
        buildOrganization({
          tagline: "Pet food assistance and animal welfare",
          description: null,
          mission: null,
          needStatement: null,
        })
      )
    ).toEqual(expect.arrayContaining(["animals"]))
  })

  it("supports exact subcategory filters without widening to the parent", () => {
    const dentalItem = buildGuideResourceItem("dental", {
      resourceCategories: ["health", "health_dental"],
      primaryResourceCategory: "health_dental",
    })
    const mentalHealthItem = buildGuideResourceItem("mental-health", {
      resourceCategories: ["health", "health_mental_health"],
      primaryResourceCategory: "health_mental_health",
    })

    expect(
      publicMapItemMatchesGroupFilter({
        activeGroup: "health",
        item: dentalItem,
      })
    ).toBe(true)
    expect(
      publicMapItemMatchesGroupFilter({
        activeGroup: "health_dental",
        item: dentalItem,
      })
    ).toBe(true)
    expect(
      publicMapItemMatchesGroupFilter({
        activeGroup: "health_dental",
        item: mentalHealthItem,
      })
    ).toBe(false)
  })

  it("derives resource display names for civic-owner cooling center rows", () => {
    const townshipItem = buildExternalResourceMapItemFromLocalPreviewRecord(
      {
        sourceRecordId: "cook-township-1",
        sourceName: "Cook County Data Catalog - Cooling Centers",
        extractedFields: {
          organizationName: "Calumet Township",
          title: "Calumet Township",
          sourceCategoryText: "Cooling Centers",
          address: "12633 S. Ashland Ave",
          city: "CALUMET PARK",
          latitude: 41.665,
          longitude: -87.663,
          resourceCategories: ["emergency_cooling_centers", "emergency"],
        },
      },
      0
    )
    const countyItem = buildExternalResourceMapItemFromLocalPreviewRecord(
      {
        sourceRecordId: "pge-county-1",
        sourceName: "PG&E - California Cooling Centers 2026",
        extractedFields: {
          organizationName: "Merced County",
          title: "Merced County",
          sourceCategoryText: "Cooling Centers; Library",
          address: "1600 Third St, Atwater, CA",
          city: "Atwater",
          latitude: 37.35,
          longitude: -120.6,
          resourceCategories: ["community", "community_libraries"],
        },
      },
      1
    )

    expect(townshipItem).toMatchObject({
      title: "Cooling center - CALUMET PARK",
      subtitle: "12633 S. Ashland Ave",
      primaryResourceCategory: "emergency_cooling_centers",
    })
    expect(countyItem).toMatchObject({
      title: "Library cooling center - Atwater",
      subtitle: "1600 Third St, Atwater, CA",
      primaryResourceCategory: "emergency_cooling_centers",
    })
  })

  it("uses cooling marker treatment for NYC Finder cooling rows", () => {
    const item = buildExternalResourceMapItemFromLocalPreviewRecord(
      {
        sourceId: "nyc-arcgis-cooling-centers",
        sourceRecordId: "CC1001",
        sourceName: "NYC Emergency Management - Cooling Centers",
        sourceUrl: "https://finder.nyc.gov/coolingcenters/locations?mView=map",
        extractedFields: {
          title: "Neighborhood Older Adult Center",
          sourceCategoryText: "Cooling Centers; Senior Center",
          latitude: 40.75,
          longitude: -73.98,
          resourceCategories: ["family_seniors", "family"],
          primaryResourceCategory: "family_seniors",
        },
      },
      2
    )

    expect(item).toMatchObject({
      id: "local_resource_map:nyc-arcgis-cooling-centers:CC1001",
      primaryResourceCategory: "emergency_cooling_centers",
      resourceCategories: expect.arrayContaining([
        "emergency_cooling_centers",
        "family_seniors",
      ]),
    })
    expect(item?.resourceCategories).not.toContain("emergency")
  })

  it("does not expose raw ArcGIS query endpoints as public resource links", () => {
    const item = buildExternalResourceMapItemFromLocalPreviewRecord(
      {
        sourceId: "cook-county-arcgis-cooling-centers",
        sourceRecordId: "cooling-raw-1",
        sourceName: "Cook County Cooling Centers",
        sourceUrl:
          "https://services2.arcgis.com/w657bnjzrjguNyOy/arcgis/rest/services/Warming_and_Cooling_Centers/FeatureServer/0/query?where=1%3D1&outFields=*&returnGeometry=true&outSR=4326&f=json",
        extractedFields: {
          title: "Library Cooling Center",
          sourceCategoryText: "Cooling Centers",
          latitude: 41.75,
          longitude: -87.6,
          links: [
            {
              type: "source",
              label: "Raw data endpoint",
              url: "https://services2.arcgis.com/w657bnjzrjguNyOy/arcgis/rest/services/Warming_and_Cooling_Centers/FeatureServer/0/query?where=1%3D1&outFields=*&returnGeometry=true&outSR=4326&f=json",
            },
            {
              type: "website",
              label: "Public page",
              url: "https://example.org/cooling-center",
            },
          ],
        },
      },
      4
    )

    expect(item?.sourceUrl).toContain("FeatureServer/0/query")
    expect(item?.links).toEqual([
      expect.objectContaining({
        label: "Public page",
        url: "https://example.org/cooling-center",
      }),
    ])
  })

  it("does not expose Overpass query endpoints as public resource links", () => {
    const overpassUrl =
      "https://overpass-api.de/api/interpreter?data=%5Bout%3Ajson%5D%5Btimeout%3A45%5D%3B%28nwr%5B%22amenity%22%7E%22clinic%7Cdoctors%7Cdentist%7Chospital%22%5D%2841.6%2C-87.95%2C42.05%2C-87.5%29%3Bnwr%5B%22healthcare%22%7E%22clinic%7Cdoctor%7Cdentist%7Chospital%22%5D%2841.6%2C-87.95%2C42.05%2C-87.5%29%3B%29%3Bout+center+80%3B"
    const item = buildExternalResourceMapItemFromLocalPreviewRecord(
      {
        sourceId: "chicago-osm-health-care",
        sourceRecordId: "osm:node:463772325",
        sourceName: "OpenStreetMap - Chicago health care",
        sourceUrl: overpassUrl,
        extractedFields: {
          title: "AMITA Sage Medical Group",
          category: "doctors",
          latitude: 41.9257023,
          longitude: -87.658009,
        },
      },
      5
    )

    expect(item?.sourceUrl).toBe(overpassUrl)
    expect(item?.links).toEqual([])
  })

  it("does not expose Socrata raw data endpoints as public resource links", () => {
    const socrataUrl =
      "https://data.cityofchicago.org/resource/msrk-w9ih.json?$limit=500"
    const item = buildExternalResourceMapItemFromLocalPreviewRecord(
      {
        sourceId: "chicago-socrata-cooling-centers",
        sourceRecordId: "cooling-center-1",
        sourceName: "Chicago Data Portal - Cooling Centers",
        sourceUrl: socrataUrl,
        extractedFields: {
          organizationName: "Daley College Cooling Center",
          title: "Daley College Cooling Center",
          category: "Cooling Centers",
          latitude: 41.7556,
          longitude: -87.7216,
          resourceCategories: ["community"],
        },
      },
      6
    )

    expect(item?.sourceUrl).toBe(socrataUrl)
    expect(item?.subtitle).toBeNull()
    expect(item?.title).toBe("Daley College Cooling Center")
    expect(item?.primaryResourceCategory).toBe("emergency_cooling_centers")
    expect(item?.resourceCategories).toEqual(
      expect.arrayContaining(["emergency_cooling_centers", "community"])
    )
    expect(item?.resourceCategories).not.toContain("emergency")
    expect(item?.links).toEqual([])
  })

  it("does not promote source URLs into website links", () => {
    const sourceUrl =
      "https://finder.nyc.gov/coolingcenters/locations?mView=map"
    const websiteUrl =
      "https://www.nycgovparks.org/facilities/recreationcenters"
    const itemWithoutWebsite =
      buildExternalResourceMapItemFromLocalPreviewRecord(
        {
          sourceId: "nyc-arcgis-cooling-centers",
          sourceRecordId: "cooling-center-source-only",
          sourceName: "NYC Finder - Cooling Centers",
          sourceUrl,
          extractedFields: {
            title: "Hamilton Fish Recreation Center",
            category: "Cooling Centers",
            latitude: 40.719,
            longitude: -73.981,
          },
        },
        7
      )
    const itemWithWebsite = buildExternalResourceMapItemFromLocalPreviewRecord(
      {
        sourceId: "nyc-arcgis-cooling-centers",
        sourceRecordId: "cooling-center-with-website",
        sourceName: "NYC Finder - Cooling Centers",
        sourceUrl,
        extractedFields: {
          title: "Hamilton Fish Recreation Center",
          category: "Cooling Centers",
          latitude: 40.719,
          longitude: -73.981,
          websiteUrl,
          links: [
            {
              type: "source",
              label: "NYC Finder source",
              url: sourceUrl,
            },
          ],
        },
      },
      8
    )

    expect(itemWithoutWebsite?.sourceUrl).toBe(sourceUrl)
    expect(itemWithoutWebsite?.links).toEqual([])
    expect(itemWithWebsite?.sourceUrl).toBe(sourceUrl)
    expect(itemWithWebsite?.links).toEqual([
      expect.objectContaining({
        label: "Website",
        type: "website",
        url: websiteUrl,
      }),
    ])
  })

  it("turns machine-only category descriptions into plain public copy", () => {
    const item = buildExternalResourceMapItemFromLocalPreviewRecord(
      {
        sourceId: "chicago-osm-community-libraries",
        sourceRecordId: "osm:way:145257059",
        sourceName: "OpenStreetMap - Chicago libraries and community centers",
        sourceUrl: "https://overpass-api.de/api/interpreter?data=...",
        extractedFields: {
          organizationName: "Hyde Park Neighborhood Club",
          title: "Hyde Park Neighborhood Club",
          description: "community_centre",
          sourceCategoryText: "community_centre",
          category: "community",
          latitude: 41.799,
          longitude: -87.593,
          address: "5480 South Kenwood Avenue",
          city: "Chicago",
          state: "IL",
        },
      },
      9
    )

    expect(item?.description).toBe(
      "Listed as a community center in Chicago, IL."
    )
    expect(item?.services?.[0]?.description).toBe(
      "Listed as a community center in Chicago, IL."
    )
    expect(item?.description).not.toContain("community_centre")
  })

  it("adds cooling-center context to named cooling-source rows", () => {
    const item = buildExternalResourceMapItemFromLocalPreviewRecord(
      {
        sourceId: "chicago-socrata-cooling-centers",
        sourceRecordId: "amundsen-park",
        sourceName: "Chicago Data Portal - Cooling Centers",
        sourceUrl:
          "https://data.cityofchicago.org/resource/msrk-w9ih.json?$limit=500",
        extractedFields: {
          organizationName: "Amundsen Park",
          title: "Amundsen Park",
          category: "Cooling Centers",
          latitude: 41.913,
          longitude: -87.781,
          resourceCategories: ["community"],
        },
      },
      7
    )

    expect(item).toMatchObject({
      title: "Amundsen Park cooling center",
      subtitle: null,
      primaryResourceCategory: "emergency_cooling_centers",
    })
  })

  it("maps community-fridge local preview records to the fridge category", () => {
    const item = buildExternalResourceMapItemFromLocalPreviewRecord(
      {
        sourceId: "nyc-fridgefinder-community-fridges",
        sourceRecordId: "livinggallery",
        sourceName: "Fridge Finder - Community Fridges",
        sourceUrl: "https://www.fridgefinder.app/fridge/livinggallery",
        extractedFields: {
          title: "Living Gallery",
          sourceCategoryText: "Community Fridges",
          latitude: 40.694207,
          longitude: -73.930599,
          resourceCategories: ["food_community_fridges", "food"],
          primaryResourceCategory: "food_community_fridges",
        },
      },
      3
    )

    expect(item).toMatchObject({
      id: "local_resource_map:nyc-fridgefinder-community-fridges:livinggallery",
      primaryResourceCategory: "food_community_fridges",
      resourceCategories: ["food_community_fridges", "food"],
    })
  })

  it("scopes local preview resource ids by source", () => {
    const first = buildExternalResourceMapItemFromLocalPreviewRecord(
      {
        sourceId: "nyc-arcgis-cooling-centers",
        sourceRecordId: "CC1046",
        extractedFields: {
          title: "Petco Rego Park",
          latitude: 40.73,
          longitude: -73.86,
        },
      },
      3
    )
    const second = buildExternalResourceMapItemFromLocalPreviewRecord(
      {
        sourceId: "nyc-arcgis-cool-options",
        sourceRecordId: "CC1046",
        extractedFields: {
          title: "Petco Rego Park",
          latitude: 40.73,
          longitude: -73.86,
        },
      },
      4
    )

    expect(first?.id).toBe(
      "local_resource_map:nyc-arcgis-cooling-centers:CC1046"
    )
    expect(second?.id).toBe("local_resource_map:nyc-arcgis-cool-options:CC1046")
    expect(first?.id).not.toBe(second?.id)
  })

  it("adds a broad superadmin seed resource layer only when requested", () => {
    const organization = buildOrganization()
    const publishedOnly = buildPublicMapItems({
      organizations: [organization],
      includeSeedItems: false,
    })
    const withSeeds = buildPublicMapItems({
      organizations: [organization],
      includeSeedItems: true,
    })

    expect(publishedOnly).toHaveLength(1)
    expect(withSeeds).toHaveLength(
      1 +
        PUBLIC_MAP_SUPERADMIN_RESOURCE_SEED_ITEMS.length +
        PUBLIC_MAP_SUPERADMIN_RESOURCE_SEED_CITY_ANCHORS.length *
          PUBLIC_MAP_RESOURCE_CATEGORY_ORDER.length +
        PUBLIC_MAP_RESOURCE_CATEGORY_ORDER.length
    )
    expect(withSeeds.slice(1).every((item) => item.visibility)).toBe(true)
    expect(withSeeds.slice(1).map((item) => item.visibility)).toEqual(
      Array(withSeeds.length - 1).fill("superadmin_preview")
    )
    expect(withSeeds.map((item) => item.primaryResourceCategory)).toEqual(
      expect.arrayContaining([...PUBLIC_MAP_RESOURCE_CATEGORY_ORDER])
    )
    expect(
      withSeeds.some((item) =>
        item.id.startsWith("seed-resource:preview:org-health:")
      )
    ).toBe(true)
    expect(
      withSeeds.some(
        (item) => item.id === "seed-resource:national:seattle:food"
      )
    ).toBe(true)
    expect(
      withSeeds.some(
        (item) => item.id === "seed-resource:national:miami:health"
      )
    ).toBe(true)
    expect(
      withSeeds.some(
        (item) => item.id === "seed-resource:national:new-york:housing"
      )
    ).toBe(true)
    const foodSeed = withSeeds.find(
      (item) => item.id === "seed-resource:national:seattle:food"
    )
    expect(foodSeed?.links?.map((link) => link.type)).toEqual([
      "resource",
      "intake",
    ])
    expect(foodSeed?.contacts?.[0]?.type).toBe("phone")
    expect(foodSeed?.services?.[0]?.title).toBe("Food access")
    expect(foodSeed?.services?.[0]?.documentsNeeded).toEqual([
      "Photo ID if available",
    ])
    expect(foodSeed?.deliveryModes).toEqual(["in_person"])
    expect(
      Math.max(...withSeeds.map((item) => item.longitude ?? 0)) -
        Math.min(...withSeeds.map((item) => item.longitude ?? 0))
    ).toBeGreaterThan(45)

    const realResource: ExternalResourceMapItem = {
      id: "local_resource_map:real-food-1",
      itemType: "external_resource",
      title: "Real Food Pantry",
      subtitle: "Local source",
      description: "A real local candidate record.",
      latitude: 41.88,
      longitude: -87.63,
      address: "123 Real Ave, Chicago, IL",
      addressStreet: "123 Real Ave",
      city: "Chicago",
      state: "IL",
      country: "United States",
      orgCategory: null,
      resourceCategories: ["food"],
      primaryResourceCategory: "food",
      verificationStatus: "external_data",
      sourceLabel: "Local engine",
      sourceUrl: "https://example.org/real-food",
      lastVerifiedAt: null,
      visibility: "superadmin_preview",
      markerImageUrl: null,
    }
    const withRealResource = buildPublicMapItems({
      organizations: [organization],
      includeSeedItems: true,
      resourceItems: [realResource],
    })
    expect(withRealResource).toHaveLength(2)
    expect(
      withRealResource.some((item) => item.id.startsWith("seed-resource:"))
    ).toBe(false)
  })

  it("filters superadmin seed resources through the active org category", () => {
    const healthOrganization = buildOrganization({
      id: "org-health",
      groups: ["health"],
      primaryGroup: "health",
    })
    const educationOrganization = buildOrganization({
      id: "org-education",
      groups: ["education"],
      primaryGroup: "education",
    })
    const filteredOrganizations = [healthOrganization]

    const items = buildFilteredPublicMapItems({
      activeGroup: "health",
      filteredOrganizations,
      includeSeedResources: true,
    })

    expect(
      items.some((item) => item.id === "platform_organization:org-health")
    ).toBe(true)
    expect(
      items.some((item) => item.id === "platform_organization:org-education")
    ).toBe(false)
    expect(
      items.some((item) => item.id === "seed-resource:national:seattle:food")
    ).toBe(false)
    expect(
      items.some((item) => item.id === "seed-resource:national:miami:health")
    ).toBe(true)
    expect(
      items.some((item) => item.id === "seed-resource:medical-dental-pilsen")
    ).toBe(true)
    expect(
      items.some(
        (item) => item.id === "seed-resource:national:dallas:employment"
      )
    ).toBe(false)
    expect(
      Math.max(...items.map((item) => item.longitude ?? 0)) -
        Math.min(...items.map((item) => item.longitude ?? 0))
    ).toBeGreaterThan(45)
    expect(educationOrganization.id).toBe("org-education")
  })

  it("keeps community seed resources separate from health resources", () => {
    const organization = buildOrganization({
      groups: ["community"],
      primaryGroup: "community",
    })

    const items = buildFilteredPublicMapItems({
      activeGroup: "community",
      filteredOrganizations: [organization],
      includeSeedResources: true,
    })

    expect(
      items.some(
        (item) => item.id === "seed-resource:national:seattle:community"
      )
    ).toBe(true)
    expect(
      items.some(
        (item) => item.id === "seed-resource:jobs-transport-bronzeville"
      )
    ).toBe(true)
    expect(
      items.some((item) => item.id === "seed-resource:national:miami:health")
    ).toBe(false)
  })

  it("builds cooling-center guide groups from resource fields", () => {
    const boroughs = [
      "Manhattan",
      "Manhattan",
      "Manhattan",
      "Brooklyn",
      "Brooklyn",
      "Queens",
      "Queens",
      "Bronx",
      "Staten Island",
      "Manhattan",
    ]
    const resources = boroughs.map((city, index) =>
      buildGuideResourceItem(`local_resource_map:nyc-cooling-${index}`, {
        city,
        title:
          index < 5
            ? `Library Cooling Center ${index + 1}`
            : index < 8
              ? `Senior Center Cooling Center ${index + 1}`
              : `Cooling Center ${index + 1}`,
      })
    )

    const guideById = new Map(
      buildPublicMapResourceGuides(resources).map((guide) => [guide.id, guide])
    )

    expect(guideById.get("nyc-cooling-centers")?.itemCount).toBe(10)
    expect(guideById.get("manhattan-cooling-centers")?.itemCount).toBe(4)
    expect(guideById.get("brooklyn-cooling-centers")?.itemCount).toBe(2)
    expect(guideById.get("queens-cooling-centers")?.itemCount).toBe(2)
    expect(guideById.get("bronx-cooling-centers")?.itemCount).toBe(1)
    expect(guideById.get("staten-island-cooling-centers")?.itemCount).toBe(1)
    expect(guideById.get("library-cooling-centers")?.itemCount).toBe(5)
    expect(guideById.get("senior-cooling-centers")?.itemCount).toBe(3)
  })

  it("builds current Chicago guides across verified service categories", () => {
    const guideCategories = [
      ["food", "chicago-food-access", "food"],
      ["housing", "chicago-housing-shelter", "housing"],
      ["legal", "chicago-legal-help", "legal"],
      [
        "community_libraries",
        "chicago-libraries-community-centers",
        "community",
      ],
      ["family", "chicago-family-support", "family"],
      ["health", "chicago-health-care", "health"],
    ] as const
    const resources = guideCategories.flatMap(
      ([category, , primaryCategory], categoryIndex) =>
        Array.from({ length: category === "health" ? 5 : 6 }, (_, itemIndex) =>
          buildGuideResourceItem(
            `resource_map:chicago-${categoryIndex}-${itemIndex}`,
            {
              city: "Chicago",
              state: "IL",
              title: `Chicago ${category} resource ${itemIndex + 1}`,
              resourceCategories: [category],
              primaryResourceCategory: primaryCategory,
            }
          )
        )
    )
    resources.push(
      ...Array.from({ length: 4 }, (_, index) =>
        buildGuideResourceItem(`resource_map:gary-food-${index}`, {
          city: "Gary",
          state: "IN",
          title: `Gary food resource ${index + 1}`,
          resourceCategories: ["food"],
          primaryResourceCategory: "food",
        })
      )
    )

    const guideById = new Map(
      buildPublicMapResourceGuides(resources).map((guide) => [guide.id, guide])
    )

    for (const [category, guideId, primaryCategory] of guideCategories) {
      expect(guideById.get(guideId)).toMatchObject({
        itemCount: category === "health" ? 5 : 6,
        primaryResourceCategory: primaryCategory,
      })
    }
    expect(guideById.get("essentials")?.itemCount).toBe(21)
    expect(Array.from(guideById.keys())).not.toContain("gary-food-access")

    const featuredGuides = filterPublicMapFeaturedResourceGuides(
      Array.from(guideById.values())
    )
    expect(featuredGuides.map((guide) => guide.id)).toEqual([
      "essentials",
      "chicago-food-access",
      "chicago-housing-shelter",
      "chicago-health-care",
    ])
    expect(
      featuredGuides
        .filter((guide) => guide.id !== "essentials")
        .every((guide) => guide.imageUrl?.endsWith(".webp"))
    ).toBe(true)
    expect(guideById.get("essentials")).toMatchObject({
      kicker: "Start here",
      primaryResourceCategory: "community",
      title: "Basics",
      subtitle:
        "Food, shelter, health care, transportation, documents, and digital access.",
    })
  })

  it("builds transportation, document, and digital-access discovery guides", () => {
    const resources = [
      ["community_transportation", "transportation-access"],
      ["legal_identification_documentation", "documents-and-id"],
      ["finance_benefits_enrollment", "documents-and-id"],
      ["community_internet_access", "digital-access"],
      ["education_digital_literacy", "digital-access"],
    ] as const
    const guides = buildPublicMapResourceGuides(
      resources.map(([category], index) =>
        buildGuideResourceItem(`resource_map:lens-${index}`, {
          title: `Resource ${index + 1}`,
          resourceCategories: [category],
          primaryResourceCategory: category,
        })
      )
    )
    const guideById = new Map(guides.map((guide) => [guide.id, guide]))

    expect(guideById.get("transportation-access")?.itemCount).toBe(1)
    expect(guideById.get("documents-and-id")?.itemCount).toBe(2)
    expect(guideById.get("digital-access")?.itemCount).toBe(2)
    expect(guideById.get("essentials")?.itemCount).toBe(5)
  })

  it("retains saved guides when their current public item gate is unavailable", () => {
    expect(
      buildPublicMapSavedResourceGuides({
        guides: [],
        savedGuideIds: ["chicago-food-access"],
      })
    ).toMatchObject([
      {
        id: "chicago-food-access",
        itemCount: 0,
        available: false,
      },
    ])
  })

  it("builds marker features with resource colors and legacy org selection ids", () => {
    const organization = buildOrganization()
    const items = buildPublicMapItems({
      organizations: [organization],
      includeSeedItems: true,
    })
    const features = buildPublicMapItemPointFeatures(items)
    const orgFeature = features.find(
      (feature) => feature.properties.itemType === "platform_organization"
    )
    const seedFeature = features.find(
      (feature) =>
        feature.properties.itemId === "seed-resource:food-water-west-loop"
    )
    const sameLocationSeedFeature = features.find(
      (feature) =>
        feature.properties.sameLocationCount === 2 &&
        feature.properties.organizationIds.includes("seed-resource:shelter")
    )

    expect(orgFeature?.properties.organizationId).toBe("org-health")
    expect(orgFeature?.properties.itemId).toBe(
      "platform_organization:org-health"
    )
    expect(orgFeature?.properties.designation).toBe("Health")
    expect(seedFeature?.properties.primaryResourceCategory).toBe("food")
    expect(seedFeature?.properties.designation).toBe("Food")
    expect(seedFeature?.properties.markerAccentColor).toBe(
      PUBLIC_MAP_RESOURCE_CATEGORY_COLORS.food
    )
    expect(sameLocationSeedFeature?.properties.sameLocationCount).toBe(2)
    expect(
      parsePublicMapOrganizationIds(
        sameLocationSeedFeature?.properties.organizationIds
      )
    ).toEqual([
      "seed-resource:food-water-west-loop",
      "seed-resource:shelter-west-loop",
    ])
  })

  it("excludes malformed resource coordinates from marker features", () => {
    const features = buildPublicMapItemPointFeatures([
      buildGuideResourceItem("valid"),
      buildGuideResourceItem("origin", { latitude: 0, longitude: 0 }),
      buildGuideResourceItem("invalid-latitude", { latitude: -86 }),
      buildGuideResourceItem("invalid-longitude", { longitude: -181 }),
      buildGuideResourceItem("not-finite", {
        longitude: Number.POSITIVE_INFINITY,
      }),
    ])

    expect(features.map((feature) => feature.properties.itemId)).toEqual([
      "valid",
    ])
  })

  it("resolves selectable resources into shared list rows", () => {
    const organization = buildOrganization()
    const items = buildPublicMapItems({
      organizations: [organization],
      includeSeedItems: true,
    })
    const itemBySelectableId = buildPublicMapSelectableItemMap(items)
    const platformItem = items.find(
      (item) => item.itemType === "platform_organization"
    )

    expect(platformItem).toBeDefined()
    expect(resolvePublicMapItemSelectableId(platformItem!)).toBe("org-health")
    expect(itemBySelectableId.get("org-health")).toBe(platformItem)
    expect(
      buildPublicMapListItems({
        items,
        query: "dental",
      }).some((item) => item.id === "seed-resource:medical-dental-pilsen")
    ).toBe(true)
    expect(
      resolvePublicMapListItemsFromSelectableIds({
        itemBySelectableId,
        selectableIds: [
          "org-health",
          "seed-resource:shelter-west-loop",
          "missing",
        ],
      }).map((item) => item.id)
    ).toEqual([
      "platform_organization:org-health",
      "seed-resource:shelter-west-loop",
    ])
  })
})
