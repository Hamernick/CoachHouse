import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it, vi } from "vitest"

import { resolvePublicMapPinMarkerGeometry } from "@/lib/public-map/public-map-pin-marker-canvas"
import type mapboxgl from "mapbox-gl"
import {
  ensurePublicMapMarkerLayers,
  syncPublicMapMarkerSelection,
  PUBLIC_MAP_SELECTED_MARKER_ICON_SIZE,
} from "@/components/public/public-map-index/map-marker-layer-contracts"
import { resolvePublicMapMarkerClickAction } from "@/components/public/public-map-index/public-map-marker-runtime"
import { shouldUsePublicMapPinProfileImage } from "@/lib/public-map/public-map-pin-marker-images"

function readRepoFile(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8")
}

describe("public map pin markers", () => {
  it("uses viewport collisions for normal pins only, and releases them at zoom 12", () => {
    const layers = new Map<string, mapboxgl.SymbolLayerSpecification>()
    const setData = vi.fn()
    const map = {
      getStyle: () => ({}),
      getSource: () => ({ setData }),
      getLayer: (id: string) => layers.get(id),
      addLayer: (layer: mapboxgl.SymbolLayerSpecification) =>
        layers.set(layer.id, layer),
      removeLayer: (id: string) => layers.delete(id),
      setFilter: vi.fn(),
      setPaintProperty: vi.fn(),
      setLayoutProperty: vi.fn(),
    }
    expect(
      ensurePublicMapMarkerLayers({
        map: map as unknown as mapboxgl.Map,
        declutter: true,
        maxRelevanceTier: 0,
      })
    ).toBe(true)
    const normal = [...layers.values()].find((layer) =>
      (layer.filter as unknown[])?.some((predicate) =>
        JSON.stringify(predicate).includes("markerRelevanceTier")
      )
    )
    expect(normal?.layout?.["icon-allow-overlap"]).toBe(false)
    expect(normal?.filter).toContainEqual([
      "<=",
      ["get", "markerRelevanceTier"],
      3,
    ])
    const other = [...layers.values()].filter((layer) => layer !== normal)
    expect(other).toHaveLength(2)
    expect(
      other.every((layer) => layer.layout?.["icon-allow-overlap"] === true)
    ).toBe(true)
    map.setLayoutProperty.mockClear()
    syncPublicMapMarkerSelection({
      map: map as unknown as mapboxgl.Map,
      declutter: true,
      maxRelevanceTier: 3,
      selectedOrganizationId: null,
      activeSameLocationGroupKey: null,
    })
    expect(map.setLayoutProperty).toHaveBeenCalledWith(
      normal?.id,
      "icon-allow-overlap",
      true
    )
    expect(setData).not.toHaveBeenCalled()
    layers.clear()
    ensurePublicMapMarkerLayers({
      map: map as unknown as mapboxgl.Map,
      maxRelevanceTier: 0,
    })
    expect(
      [...layers.values()].every(
        (layer) => layer.layout?.["icon-allow-overlap"] === true
      )
    ).toBe(true)
  })

  it("uses compact circular white-shell pins anchored by their tip", () => {
    const canvasSource = readRepoFile(
      "src/lib/public-map/public-map-pin-marker-canvas.ts"
    )
    const layerSource =
      readRepoFile(
        "src/components/public/public-map-index/map-marker-layer-contracts.ts"
      ) +
      readRepoFile(
        "src/components/public/public-map-index/map-marker-style-contracts.ts"
      )

    expect(canvasSource).toContain('context.fillStyle = "#FFFFFF"')
    expect(canvasSource).toContain(
      'const PUBLIC_MAP_PROFILE_IMAGE_BACKGROUND = "#FFFFFF"'
    )
    expect(canvasSource).toContain(
      'const PUBLIC_MAP_PIN_FACE_BORDER_COLOR = "#D1D5DB"'
    )
    expect(canvasSource).toContain(
      "geometry.contentRadius - PUBLIC_MAP_PIN_FACE_BORDER_WIDTH / 2"
    )
    expect(
      canvasSource.match(/drawPinFaceBorder\(\{ context, geometry \}\)/g)
    ).toHaveLength(2)
    expect(canvasSource).toContain("color: PUBLIC_MAP_PROFILE_IMAGE_BACKGROUND")
    expect(canvasSource).toContain("tipRadius = outerRadius * 0.2")
    expect(canvasSource).toContain(
      'context.shadowColor = "rgba(15, 23, 42, 0.26)"'
    )
    expect(canvasSource).toContain("context.shadowBlur = 6")
    expect(canvasSource).toContain(
      "tangentNormalY = (outerRadius - tipRadius) / centerDistance"
    )
    expect(canvasSource).toContain("context.arc(")
    expect(canvasSource).toContain("context.lineTo(tipRightX, tipRightY)")
    expect(canvasSource).toContain("drawPublicMapResourceCategoryMarkerIcon")
    expect(canvasSource).not.toContain("createRadialGradient")
    expect(layerSource).toContain('"icon-anchor": "bottom"')
    expect(layerSource).toContain('"icon-allow-overlap":')
    expect(layerSource).toContain('"icon-ignore-placement":')
    expect(layerSource).toContain(
      '"symbol-sort-key": PUBLIC_MAP_MARKER_SORT_KEY_EXPRESSION'
    )
    expect(layerSource).toContain("PUBLIC_MAP_SAVED_MARKER_LAYER_ID")
    expect(layerSource).toContain(
      "PUBLIC_MAP_MARKER_ICON_OFFSET: [number, number] = [0, 8.5]"
    )
    expect(layerSource).not.toContain("PUBLIC_MAP_MARKER_OVERVIEW_ICON_OFFSET")
    expect(layerSource).not.toContain("PUBLIC_MAP_MARKER_OVERVIEW_OFFSETS")
    expect(layerSource).toContain("selected ? [0, 0.52] : [0, 0.45]")
    expect(layerSource).toContain('["get", "designation"]')
    expect(layerSource).toContain('"text-optional": true')
    expect(layerSource).toContain(
      "removeMapLayerSafely(map, PUBLIC_MAP_MARKER_LABEL_LAYER_ID)"
    )
    expect(layerSource).toContain('"icon-pitch-alignment": "viewport"')
    expect(resolvePublicMapPinMarkerGeometry(false)).toEqual({
      centerX: 36,
      centerY: 35,
      contentRadius: 14,
      outerRadius: 18,
      pointY: 58,
    })
    expect(resolvePublicMapPinMarkerGeometry(true)).toEqual({
      centerX: 36,
      centerY: 33,
      contentRadius: 16,
      outerRadius: 20,
      pointY: 59,
    })
    expect(PUBLIC_MAP_SELECTED_MARKER_ICON_SIZE).toEqual([
      "interpolate",
      ["linear"],
      ["zoom"],
      3,
      1.55,
      8,
      1.65,
      11,
      1.75,
      14,
      1.85,
      16,
      1.95,
    ])
    expect(layerSource).toContain(
      "PUBLIC_MAP_SELECTED_MARKER_ICON_OFFSET: [number, number] = [0, 9.5]"
    )
  })

  it("keeps the archived cluster implementation out of the active hook", () => {
    const mapSource = readRepoFile("src/components/public/public-map-index.tsx")
    const markerSource = readRepoFile(
      "src/components/public/public-map-index/use-public-map-markers.ts"
    )
    const locationWeatherSource = readRepoFile(
      "src/components/public/public-map-index/use-public-map-location-weather.ts"
    )
    const mapSurfaceSource = readRepoFile(
      "src/components/public/public-map-index/map-surface.tsx"
    )
    const weatherControllerSource = readRepoFile(
      "src/components/public/public-map-index/public-map-weather-controller.tsx"
    )
    const markerArtworkSource = readRepoFile(
      "src/components/public/public-map-index/sync-public-map-marker-artwork.ts"
    )
    const archiveSource = readRepoFile(
      "docs/archive/public-map-markers-2026-08-02.md"
    )

    expect(mapSource).toContain("usePublicMapLocationWeather")
    expect(mapSource).not.toContain("usePublicMapClusteredMarkers")
    expect(locationWeatherSource).toContain("usePublicMapMarkers")
    expect(mapSurfaceSource).toContain("PublicMapWeatherController")
    expect(weatherControllerSource).toContain("useFindMapWeather")
    expect(markerSource).not.toContain("public-map-cluster")
    expect(markerSource).not.toContain("clusterClient")
    expect(markerSource).toContain("syncPublicMapMarkerArtwork")
    expect(markerArtworkSource).toContain("ensurePublicMapPinMarkerImages")
    expect(markerArtworkSource).not.toContain("ensurePublicMapMarkerImages")
    expect(markerSource).toContain("Promise.all(profileImageLoads)")
    expect(archiveSource).toContain(
      "refs/codex/snapshots/find-markers-before-20260802T143539"
    )
    expect(archiveSource).toContain("public-map-marker-canvas.ts")
  })

  it("uses profile images only for verified platform organizations", () => {
    expect(
      shouldUsePublicMapPinProfileImage({
        imageUrl: "https://images.example.org/profile.png",
        itemType: "platform_organization",
        verificationStatus: "verified_platform",
      })
    ).toBe(true)
    expect(
      shouldUsePublicMapPinProfileImage({
        imageUrl: "https://images.example.org/resource.png",
        itemType: "external_resource",
        verificationStatus: "verified_provider",
      })
    ).toBe(false)
    expect(
      shouldUsePublicMapPinProfileImage({
        imageUrl: null,
        itemType: "platform_organization",
        verificationStatus: "verified_platform",
      })
    ).toBe(false)
  })

  it("preserves organization and same-location click actions", () => {
    expect(
      resolvePublicMapMarkerClickAction({ organizationId: "org-a" })
    ).toEqual({
      type: "organization",
      organizationId: "org-a",
    })
    expect(
      resolvePublicMapMarkerClickAction({
        organizationId: "org-a",
        organizationIds: "org-a|org-b",
        sameLocationCount: 2,
        sameLocationKey: "41.8:-87.6",
        sameLocationLabel: "Chicago, IL",
      })
    ).toEqual({
      type: "same-location",
      group: {
        key: "41.8:-87.6",
        organizationIds: ["org-a", "org-b"],
        locationLabel: "Chicago, IL",
      },
    })
  })

  it("focuses the map when a single-resource marker is clicked", () => {
    const selectionSource = readRepoFile(
      "src/components/public/public-map-index/public-map-index-selection.ts"
    )
    const markerSelectionSource = selectionSource.slice(
      selectionSource.indexOf("const handleSelectMapMarker"),
      selectionSource.indexOf("const handleOpenSameLocationGroup")
    )

    expect(markerSelectionSource).toContain("focusMapItemOnMap(selectableId)")
    expect(markerSelectionSource).toContain("openDetails: true")
  })
})
