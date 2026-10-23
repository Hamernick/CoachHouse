import { describe, expect, it } from "vitest"

import {
  buildPublicMapMarkerRelevance,
  resolvePublicMapMarkerRelevanceTier,
} from "@/lib/public-map/public-map-marker-relevance"
import type { PublicMapPointFeature } from "@/lib/public-map/public-map-geojson"
import type { PublicMapResourceCategoryKey } from "@/lib/public-map/resource-categories"
import {
  resolveRelevantUnselectedPointFilter,
  resolveSavedPointFilter,
} from "@/components/public/public-map-index/map-layer-filters"

function buildFeature({
  category = "food",
  id,
  latitude,
  longitude,
  organizationIds = id,
  verificationStatus = "external_data",
  weatherEligible = false,
}: {
  category?: PublicMapResourceCategoryKey
  id: string
  latitude: number
  longitude: number
  organizationIds?: string
  verificationStatus?: "external_data" | "verified_platform"
  weatherEligible?: boolean
}): PublicMapPointFeature {
  return {
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: [longitude, latitude],
    },
    properties: {
      designation: "Resource",
      itemId: id,
      itemType:
        verificationStatus === "verified_platform"
          ? "platform_organization"
          : "external_resource",
      markerAccentColor: "#2563eb",
      markerImageKey: `marker-${id}`,
      markerImageUrl: null,
      markerStyleKey: "standard",
      name: id,
      organizationId: id,
      organizationIds,
      primaryGroup: "community",
      primaryResourceCategory: category,
      sameLocationCount: 1,
      sameLocationKey: id,
      sameLocationLabel: "Chicago, IL",
      verificationStatus,
      weatherEligible,
    },
  }
}

describe("public map marker relevance", () => {
  it("reveals several exact-coordinate pins on the overview globe", () => {
    const features = [
      buildFeature({ id: "food-a", latitude: 41.88, longitude: -87.63 }),
      buildFeature({ id: "food-b", latitude: 41.881, longitude: -87.631 }),
      buildFeature({ id: "food-c", latitude: 41.882, longitude: -87.632 }),
      buildFeature({ id: "food-d", latitude: 41.883, longitude: -87.633 }),
    ]
    const relevant = buildPublicMapMarkerRelevance({ features })
    const countAtTier = (tier: 0 | 1 | 2 | 3) =>
      relevant.filter(
        (feature) => (feature.properties.markerRelevanceTier ?? 3) <= tier
      ).length

    expect(countAtTier(0)).toBe(4)
    expect(countAtTier(1)).toBe(4)
    expect(countAtTier(2)).toBe(4)
    expect(countAtTier(3)).toBe(4)
    expect(
      relevant.every(
        (feature) => feature.properties.markerOverviewOffsetIndex === undefined
      )
    ).toBe(true)
    expect(relevant.map((feature) => feature.geometry.coordinates)).toEqual(
      features.map((feature) => feature.geometry.coordinates)
    )
  })

  it("reserves overview representation for each resource category", () => {
    const relevant = buildPublicMapMarkerRelevance({
      features: [
        buildFeature({ id: "food-a", latitude: 41.88, longitude: -87.63 }),
        buildFeature({
          category: "health",
          id: "health-a",
          latitude: 41.881,
          longitude: -87.631,
        }),
      ],
    })

    expect(
      relevant.every((feature) => feature.properties.markerRelevanceTier === 0)
    ).toBe(true)
  })

  it("chooses the resource nearest the user as the local representative", () => {
    const relevant = buildPublicMapMarkerRelevance({
      features: [
        ...Array.from({ length: 12 }, (_, index) =>
          buildFeature({
            id: `far-${index}`,
            latitude: 41.95,
            longitude: -87.7,
          })
        ),
        buildFeature({ id: "near", latitude: 41.88, longitude: -87.63 }),
      ],
      userCoordinates: { latitude: 41.879, longitude: -87.629 },
    })

    expect(
      relevant.find((feature) => feature.properties.itemId === "near")
        ?.properties.markerRelevanceTier
    ).toBe(0)
    const nearest = relevant.find(
      (feature) => feature.properties.itemId === "near"
    )!
    expect(
      relevant
        .filter((feature) => feature !== nearest)
        .every(
          (feature) =>
            feature.properties.markerSortKey! >
            nearest.properties.markerSortKey!
        )
    ).toBe(true)
  })

  it("prioritizes eligible heat pins without hiding ordinary places", () => {
    const features = Array.from({ length: 10 }, (_, index) =>
      buildFeature({
        category: index === 9 ? "emergency_cooling_centers" : "environment",
        id: `place-${index}`,
        latitude: 41.88,
        longitude: -87.63,
        weatherEligible: index === 9,
      })
    )
    const inactive = buildPublicMapMarkerRelevance({ features })
    const active = buildPublicMapMarkerRelevance({
      features,
      boostCoolingCenters: true,
    })
    expect(
      inactive.find((f) => f.properties.itemId === "place-9")?.properties
        .markerRelevanceTier
    ).toBeGreaterThan(0)
    expect(
      active.find((f) => f.properties.itemId === "place-9")?.properties
        .markerRelevanceTier
    ).toBe(0)
    expect(active).toHaveLength(features.length)
    expect(active.map((f) => f.geometry)).toEqual(
      features.map((f) => f.geometry)
    )
  })

  it("spreads overview choices across neighborhoods with deterministic ordering", () => {
    const features = Array.from({ length: 20 }, (_, index) =>
      buildFeature({
        id: `a-${index.toString().padStart(2, "0")}`,
        latitude: 41.88,
        longitude: -87.63,
      })
    )
    features.push(
      buildFeature({ id: "z-distant", latitude: 43.5, longitude: -88 })
    )
    const ranked = buildPublicMapMarkerRelevance({ features })
    expect(
      ranked.find((f) => f.properties.itemId === "z-distant")?.properties
        .markerRelevanceTier
    ).toBe(0)
    const byId = (result: PublicMapPointFeature[]) =>
      result
        .map((f) => [
          f.properties.itemId,
          f.properties.markerRelevanceTier,
          f.properties.markerSortKey,
        ])
        .sort()
    expect(
      byId(buildPublicMapMarkerRelevance({ features: [...features].reverse() }))
    ).toEqual(byId(ranked))
  })

  it("reveals the whole 4904-place source at neighborhood detail", () => {
    const features = Array.from({ length: 4904 }, (_, index) =>
      buildFeature({
        id: `place-${index}`,
        latitude: 41.88 + index / 100000,
        longitude: -87.63,
      })
    )
    const ranked = buildPublicMapMarkerRelevance({ features })
    expect(ranked).toHaveLength(4904)
    const counts = [1.5, 5, 8, 12].map(
      (zoom) =>
        ranked.filter(
          (f) =>
            (f.properties.markerRelevanceTier ?? 3) <=
            resolvePublicMapMarkerRelevanceTier(zoom)
        ).length
    )
    expect(counts).toEqual([...counts].sort((a, b) => a - b))
    expect(counts[3]).toBe(4904)
    expect(ranked.map((f) => f.geometry)).toEqual(
      features.map((f) => f.geometry)
    )
  })

  it("keeps any saved organization in a same-location marker prioritized", () => {
    const [feature] = buildPublicMapMarkerRelevance({
      favoriteOrganizationIds: new Set(["org-b"]),
      features: [
        buildFeature({
          id: "org-a",
          latitude: 41.88,
          longitude: -87.63,
          organizationIds: "org-a|org-b",
          verificationStatus: "verified_platform",
        }),
      ],
    })

    expect(feature?.properties.isSaved).toBe(true)
  })

  it("maps zoom levels to overview, city, neighborhood, and full detail", () => {
    expect(resolvePublicMapMarkerRelevanceTier(4.85)).toBe(0)
    expect(resolvePublicMapMarkerRelevanceTier(5)).toBe(1)
    expect(resolvePublicMapMarkerRelevanceTier(8)).toBe(2)
    expect(resolvePublicMapMarkerRelevanceTier(11)).toBe(2)
    expect(resolvePublicMapMarkerRelevanceTier(12)).toBe(3)
    expect(resolvePublicMapMarkerRelevanceTier(13)).toBe(3)
    expect(resolvePublicMapMarkerRelevanceTier(15)).toBe(3)
  })

  it("filters normal pins by relevance while keeping saved pins separate", () => {
    expect(
      resolveRelevantUnselectedPointFilter({
        maxRelevanceTier: 1,
        selectedOrganizationId: null,
      })
    ).toEqual([
      "all",
      ["!", ["has", "point_count"]],
      ["<=", ["get", "markerRelevanceTier"], 1],
      ["!=", ["get", "isSaved"], true],
    ])
    expect(resolveSavedPointFilter({ selectedOrganizationId: null })).toEqual([
      "all",
      ["!", ["has", "point_count"]],
      ["==", ["get", "isSaved"], true],
    ])
  })
})
