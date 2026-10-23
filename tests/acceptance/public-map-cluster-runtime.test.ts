import { describe, expect, it, vi } from "vitest"
import type mapboxgl from "mapbox-gl"
import type { PublicMapFeatureCollection } from "@/lib/public-map/public-map-geojson"

import {
  bindPublicMapPointerCursor,
  queryVisibleUnclusteredOrganizationFeatures,
  resolveClusterClickTarget,
  resolveClusterId,
  resolvePublicMapPointClickAction,
  shouldScheduleClusterRenderFromSourceData,
} from "@/components/public/public-map-index/public-map-cluster-runtime"
import { executeClusterSelection } from "@/components/public/public-map-index/cluster-click-handlers"
import { normalizeCoordinatesForMap } from "@/components/public/public-map-index/map-coordinate-normalization"
import {
  ensurePublicMapClusterLayers,
  setPublicMapClusterSourceData,
  syncClusterSourceAndLayers,
  syncSelectedOrganizationLayers,
} from "@/components/public/public-map-index/map-layer-sync"
import {
  PUBLIC_MAP_CLUSTER_LABEL_LAYER_ID,
  PUBLIC_MAP_CLUSTER_SOURCE_CLUSTER_LAYER_ID,
  PUBLIC_MAP_CLUSTER_SOURCE_POINT_LAYER_ID,
  PUBLIC_MAP_ORGANIZATION_SOURCE_ID,
  PUBLIC_MAP_POINT_LABEL_LAYER_ID,
  PUBLIC_MAP_SAME_LOCATION_COUNT_LAYER_ID,
  PUBLIC_MAP_SELECTED_POINT_BADGE_LAYER_ID,
  PUBLIC_MAP_SELECTED_POINT_CORE_LAYER_ID,
  PUBLIC_MAP_SELECTED_POINT_HALO_LAYER_ID,
  PUBLIC_MAP_SELECTED_POINT_LABEL_LAYER_ID,
  PUBLIC_MAP_SELECTED_POINT_SHADOW_LAYER_ID,
  PUBLIC_MAP_UNCLUSTERED_SHADOW_LAYER_ID,
} from "@/components/public/public-map-index/map-view-helpers"
import {
  buildPublicMapPointLabelExpression,
  PUBLIC_MAP_MARKER_SELECTION_TRANSITION,
  PUBLIC_MAP_POINT_SHADOW_KEY,
  resolvePublicMapPointShadowOpacity,
  resolvePublicMapPointShadowSize,
  resolvePublicMapSelectedPointIconSize,
  resolvePublicMapSelectedPointLabelOffset,
  resolvePublicMapSelectedPointShadowOpacity,
  resolvePublicMapSelectedPointShadowSize,
} from "@/lib/public-map/public-map-layer-api"

describe("queryVisibleUnclusteredOrganizationFeatures", () => {
  it("returns an empty list when source access throws during style teardown", () => {
    const map = {
      getSource: vi.fn(() => {
        throw new TypeError(
          "Cannot read properties of undefined (reading 'getOwnSource')"
        )
      }),
      querySourceFeatures: vi.fn(),
      queryRenderedFeatures: vi.fn(),
    } as unknown as mapboxgl.Map

    expect(queryVisibleUnclusteredOrganizationFeatures({ map })).toEqual([])
    expect(map.querySourceFeatures).not.toHaveBeenCalled()
    expect(map.queryRenderedFeatures).not.toHaveBeenCalled()
  })

  it("uses source features and keeps duplicate-coordinate organizations stable", () => {
    const inBoundsA = {
      geometry: {
        type: "Point",
        coordinates: [-87.6298, 41.8781],
      },
      properties: {
        organizationId: "org-a",
        name: "Org A",
      },
    } as unknown as mapboxgl.MapboxGeoJSONFeature

    const inBoundsB = {
      geometry: {
        type: "Point",
        coordinates: [-87.6298, 41.8781],
      },
      properties: {
        organizationId: "org-b",
        name: "Org B",
      },
    } as unknown as mapboxgl.MapboxGeoJSONFeature

    const duplicateTileCopy = {
      geometry: {
        type: "Point",
        coordinates: [-87.6298, 41.8781],
      },
      properties: {
        organizationId: "org-a",
        name: "Org A",
      },
    } as unknown as mapboxgl.MapboxGeoJSONFeature

    const outOfBounds = {
      geometry: {
        type: "Point",
        coordinates: [-120, 20],
      },
      properties: {
        organizationId: "org-c",
        name: "Org C",
      },
    } as unknown as mapboxgl.MapboxGeoJSONFeature

    const clusterFeature = {
      geometry: {
        type: "Point",
        coordinates: [-87.62, 41.87],
      },
      properties: {
        cluster: true,
        cluster_id: 11,
        point_count: 4,
      },
    } as unknown as mapboxgl.MapboxGeoJSONFeature

    const map = {
      getSource: vi.fn().mockReturnValue({}),
      querySourceFeatures: vi
        .fn()
        .mockReturnValue([
          inBoundsA,
          inBoundsB,
          duplicateTileCopy,
          outOfBounds,
          clusterFeature,
        ]),
      getBounds: vi.fn().mockReturnValue({
        getWest: () => -90,
        getEast: () => -80,
        getSouth: () => 40,
        getNorth: () => 45,
      }),
      getCenter: vi.fn().mockReturnValue({ lng: -87.6298, lat: 41.8781 }),
    } as unknown as mapboxgl.Map

    const features = queryVisibleUnclusteredOrganizationFeatures({ map })
    const organizationIds = features.map(
      (feature) =>
        (feature.properties as { organizationId?: string }).organizationId
    )

    expect(map.querySourceFeatures).toHaveBeenCalledWith(
      PUBLIC_MAP_ORGANIZATION_SOURCE_ID
    )
    expect(organizationIds).toEqual(["org-a", "org-b"])
  })
})

describe("shouldScheduleClusterRenderFromSourceData", () => {
  it("ignores unrelated sources", () => {
    const map = {
      isMoving: vi.fn().mockReturnValue(false),
    } as unknown as mapboxgl.Map

    expect(
      shouldScheduleClusterRenderFromSourceData({
        map,
        event: {
          sourceId: "another-source",
          dataType: "source",
          isSourceLoaded: true,
        } as mapboxgl.MapSourceDataEvent,
      })
    ).toBe(false)
  })

  it("ignores source events while the map is moving", () => {
    const map = {
      isMoving: vi.fn().mockReturnValue(true),
    } as unknown as mapboxgl.Map

    expect(
      shouldScheduleClusterRenderFromSourceData({
        map,
        event: {
          sourceId: "public-map-organizations",
          dataType: "source",
          isSourceLoaded: true,
        } as mapboxgl.MapSourceDataEvent,
      })
    ).toBe(false)
  })

  it("waits until the public-map source reports a loaded, stable update", () => {
    const map = {
      isMoving: vi.fn().mockReturnValue(false),
    } as unknown as mapboxgl.Map

    expect(
      shouldScheduleClusterRenderFromSourceData({
        map,
        event: {
          sourceId: "public-map-organizations",
          dataType: "source",
          isSourceLoaded: false,
        } as mapboxgl.MapSourceDataEvent,
      })
    ).toBe(false)

    expect(
      shouldScheduleClusterRenderFromSourceData({
        map,
        event: {
          sourceId: "public-map-organizations",
          dataType: "source",
          isSourceLoaded: true,
        } as mapboxgl.MapSourceDataEvent,
      })
    ).toBe(true)
  })
})

describe("cluster click coordinate normalization", () => {
  it("normalizes wrapped coordinates against the visible map center", () => {
    const map = {
      getCenter: vi.fn().mockReturnValue({
        lng: -87.6298,
        lat: 41.8781,
      }),
    } as unknown as mapboxgl.Map

    const [longitude, latitude] = normalizeCoordinatesForMap({
      map,
      coordinates: [272.3702, 41.8781],
    })

    expect(longitude).toBeCloseTo(-87.6298, 8)
    expect(latitude).toBe(41.8781)
  })

  it("uses the visible rendered copy when resolving a cluster click target", () => {
    const wrappedCopy = {
      geometry: {
        type: "Point",
        coordinates: [272.3702, 41.8781],
      },
      properties: {
        cluster: true,
        cluster_id: 11,
        point_count: 4,
      },
    } as unknown as mapboxgl.MapboxGeoJSONFeature

    const visibleCopy = {
      geometry: {
        type: "Point",
        coordinates: [-87.6298, 41.8781],
      },
      properties: {
        cluster: true,
        cluster_id: 11,
        point_count: 4,
      },
    } as unknown as mapboxgl.MapboxGeoJSONFeature

    const map = {
      getCenter: vi.fn().mockReturnValue({ lng: -87.6298, lat: 41.8781 }),
      project: vi.fn((coordinates: [number, number]) => ({
        x: coordinates[0] < 0 ? 640 : 1040,
        y: 320,
      })),
      queryRenderedFeatures: vi
        .fn()
        .mockReturnValue([wrappedCopy, visibleCopy]),
    } as unknown as mapboxgl.Map

    expect(
      resolveClusterClickTarget({
        map,
        clusterId: 11,
        fallbackCoordinates: [-87.6298, 41.8781],
      })
    ).toMatchObject({
      clusterId: 11,
    })
    const target = resolveClusterClickTarget({
      map,
      clusterId: 11,
      fallbackCoordinates: [-87.6298, 41.8781],
    })
    expect(target.coordinates[0]).toBeCloseTo(-87.6298, 8)
    expect(target.coordinates[1]).toBe(41.8781)
  })
})

describe("public map interactions", () => {
  it("cluster click requests expansion zoom and eases to the cluster target", async () => {
    const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {})
    const map = {
      easeTo: vi.fn(),
      getSource: vi.fn().mockReturnValue({}),
      getZoom: vi.fn().mockReturnValue(8),
      project: vi.fn((coordinates: [number, number]) => ({
        x: coordinates[0],
        y: coordinates[1],
      })),
      queryRenderedFeatures: vi.fn().mockReturnValue([]),
      getCenter: vi.fn().mockReturnValue({ lng: -87.6298, lat: 41.8781 }),
    } as unknown as mapboxgl.Map
    const getExpansionZoom = vi.fn(async () => 11)

    executeClusterSelection({
      clusterId: 42,
      coordinates: [-87.6298, 41.8781],
      mapRef: { current: map },
      mapLoadedRef: { current: true },
      getExpansionZoom,
    })
    await Promise.resolve()

    expect(getExpansionZoom).toHaveBeenCalledWith(42)
    expect(map.easeTo).toHaveBeenCalledWith(
      expect.objectContaining({
        center: [-87.6298, 41.8781],
        duration: 460,
        essential: true,
        zoom: 11.35,
      })
    )
    debugSpy.mockRestore()
  })

  it("keeps cluster interactions keyed by cluster_id instead of sprite image identity", () => {
    const renderedCluster = {
      geometry: {
        type: "Point",
        coordinates: [-87.6298, 41.8781],
      },
      properties: {
        cluster: true,
        cluster_id: "42",
        clusterImageId: "public-map-cluster-sprite-stable",
        clusterSignature: "tier:medium|count:5",
        point_count: 5,
      },
    } as unknown as mapboxgl.MapboxGeoJSONFeature
    const map = {
      getCenter: vi.fn().mockReturnValue({ lng: -87.6298, lat: 41.8781 }),
      project: vi.fn(() => ({ x: 10, y: 10 })),
      queryRenderedFeatures: vi.fn().mockReturnValue([renderedCluster]),
    } as unknown as mapboxgl.Map

    expect(resolveClusterId(renderedCluster.properties?.cluster_id)).toBe(42)
    expect(
      resolveClusterClickTarget({
        map,
        clusterId: 42,
        fallbackCoordinates: [-87.6298, 41.8781],
      })
    ).toEqual({
      clusterId: 42,
      coordinates: [-87.6298, 41.8781],
    })
    expect(map.queryRenderedFeatures).toHaveBeenCalledWith({
      layers: [PUBLIC_MAP_CLUSTER_SOURCE_CLUSTER_LAYER_ID],
    })
  })

  it("point click action emits the organization id for single-location points", () => {
    expect(
      resolvePublicMapPointClickAction({
        organizationId: " org-42 ",
        organizationIds: "org-42",
        sameLocationCount: 1,
      })
    ).toEqual({
      type: "organization",
      organizationId: "org-42",
    })
  })

  it("point click action opens the same-location group for colliding points", () => {
    expect(
      resolvePublicMapPointClickAction({
        organizationId: "org-a",
        organizationIds: "org-a|org-b",
        sameLocationCount: 2,
        sameLocationKey: "41.878100,-87.629800",
        sameLocationLabel: "Chicago, IL",
      })
    ).toEqual({
      type: "same-location",
      group: {
        key: "41.878100,-87.629800",
        organizationIds: ["org-a", "org-b"],
        locationLabel: "Chicago, IL",
      },
    })
  })

  it("hover only updates the cursor and does not rebuild sources or indexes", () => {
    const handlers = new Map<string, () => void>()
    const canvas = {
      style: {
        cursor: "",
      },
    }
    const map = {
      addLayer: vi.fn(),
      addSource: vi.fn(),
      getCanvas: vi.fn().mockReturnValue(canvas),
      off: vi.fn(),
      on: vi.fn((event: string, layerId: string, handler: () => void) => {
        handlers.set(`${event}:${layerId}`, handler)
      }),
    } as unknown as mapboxgl.Map

    const cleanup = bindPublicMapPointerCursor(map, ["layer-a"])
    handlers.get("mouseenter:layer-a")?.()
    expect(canvas.style.cursor).toBe("pointer")
    handlers.get("mouseleave:layer-a")?.()
    expect(canvas.style.cursor).toBe("")
    cleanup()

    expect(map.addSource).not.toHaveBeenCalled()
    expect(map.addLayer).not.toHaveBeenCalled()
    expect(map.off).toHaveBeenCalledWith(
      "mouseenter",
      "layer-a",
      expect.any(Function)
    )
    expect(map.off).toHaveBeenCalledWith(
      "mouseleave",
      "layer-a",
      expect.any(Function)
    )
  })
})

describe("syncClusterSourceAndLayers", () => {
  const loadedStyle = {
    layers: [],
    sources: {},
    version: 8,
  }
  const nonEmptyFeatureCollection: PublicMapFeatureCollection = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [-87.6298, 41.8781],
        },
        properties: {
          itemId: "platform_organization:org-1",
          itemType: "platform_organization",
          organizationId: "org-1",
          organizationIds: "org-1",
          designation: "Community",
          name: "Org 1",
          primaryGroup: "community",
          primaryResourceCategory: "community",
          markerAccentColor: "#2f9f8f",
          markerImageKey: "public-map-marker-org-1",
          markerImageUrl: null,
          markerStyleKey: "standard",
          verificationStatus: "verified_platform",
          sameLocationKey: "org-1",
          sameLocationCount: 1,
          sameLocationLabel: null,
        },
      },
    ],
  }

  it("returns cleanly when source access throws during style teardown", () => {
    const map = {
      getStyle: vi.fn().mockReturnValue(loadedStyle),
      isStyleLoaded: vi.fn().mockReturnValue(true),
      getSource: vi.fn(() => {
        throw new TypeError(
          "Cannot read properties of undefined (reading 'getOwnSource')"
        )
      }),
      addSource: vi.fn(),
      getLayer: vi.fn(),
      addLayer: vi.fn(),
      setFilter: vi.fn(),
      setPaintProperty: vi.fn(),
      setLayoutProperty: vi.fn(),
    } as unknown as mapboxgl.Map

    expect(() =>
      syncClusterSourceAndLayers({
        map,
      })
    ).not.toThrow()
    expect(map.addSource).not.toHaveBeenCalled()
    expect(map.addLayer).not.toHaveBeenCalled()
  })

  it("does not reset an existing non-empty source to empty during lifecycle sync", () => {
    const source = {
      setData: vi.fn(),
    }
    const map = {
      getStyle: vi.fn().mockReturnValue(loadedStyle),
      isStyleLoaded: vi.fn().mockReturnValue(true),
      getSource: vi.fn().mockReturnValue(source),
      addSource: vi.fn(),
      getLayer: vi.fn((id: string) => ({ id })),
      addLayer: vi.fn(),
      setFilter: vi.fn(),
      setPaintProperty: vi.fn(),
      setLayoutProperty: vi.fn(),
    } as unknown as mapboxgl.Map

    expect(ensurePublicMapClusterLayers(map, null)).toBe(true)

    expect(source.setData).not.toHaveBeenCalled()
    expect(map.addSource).not.toHaveBeenCalled()
  })

  it("does not re-add existing source or layers", () => {
    const map = {
      getStyle: vi.fn().mockReturnValue(loadedStyle),
      isStyleLoaded: vi.fn().mockReturnValue(true),
      getSource: vi.fn().mockReturnValue({ setData: vi.fn() }),
      addSource: vi.fn(),
      getLayer: vi.fn((id: string) => ({ id })),
      addLayer: vi.fn(),
      setFilter: vi.fn(),
      setPaintProperty: vi.fn(),
      setLayoutProperty: vi.fn(),
    } as unknown as mapboxgl.Map

    expect(ensurePublicMapClusterLayers(map, nonEmptyFeatureCollection)).toBe(
      true
    )

    expect(map.addSource).not.toHaveBeenCalled()
    expect(map.addLayer).not.toHaveBeenCalled()
  })

  it("re-adds missing source and layers after a real style replacement", () => {
    const layers = new Set<string>()
    const map = {
      getStyle: vi.fn().mockReturnValue(loadedStyle),
      isStyleLoaded: vi.fn().mockReturnValue(true),
      getSource: vi.fn().mockReturnValue(undefined),
      addSource: vi.fn(),
      getLayer: vi.fn((id: string) => (layers.has(id) ? { id } : undefined)),
      addLayer: vi.fn((layer: { id: string }) => {
        layers.add(layer.id)
      }),
      setFilter: vi.fn(),
      setPaintProperty: vi.fn(),
      setLayoutProperty: vi.fn(),
    } as unknown as mapboxgl.Map

    expect(ensurePublicMapClusterLayers(map, nonEmptyFeatureCollection)).toBe(
      true
    )

    expect(map.addSource).toHaveBeenCalledWith(
      PUBLIC_MAP_ORGANIZATION_SOURCE_ID,
      expect.objectContaining({
        type: "geojson",
        data: nonEmptyFeatureCollection,
      })
    )
    expect(map.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        id: PUBLIC_MAP_CLUSTER_SOURCE_CLUSTER_LAYER_ID,
      })
    )
    expect(map.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({ id: PUBLIC_MAP_CLUSTER_SOURCE_POINT_LAYER_ID })
    )
  })

  it("attaches source and layers when style object exists even if isStyleLoaded is false", () => {
    const layers = new Set<string>()
    const map = {
      getStyle: vi.fn().mockReturnValue(loadedStyle),
      isStyleLoaded: vi.fn().mockReturnValue(false),
      getSource: vi.fn().mockReturnValue(undefined),
      addSource: vi.fn(),
      getLayer: vi.fn((id: string) => (layers.has(id) ? { id } : undefined)),
      addLayer: vi.fn((layer: { id: string }) => {
        layers.add(layer.id)
      }),
      setFilter: vi.fn(),
      setLayoutProperty: vi.fn(),
    } as unknown as mapboxgl.Map

    expect(ensurePublicMapClusterLayers(map, nonEmptyFeatureCollection)).toBe(
      true
    )

    expect(map.addSource).toHaveBeenCalledWith(
      PUBLIC_MAP_ORGANIZATION_SOURCE_ID,
      expect.objectContaining({
        data: nonEmptyFeatureCollection,
        type: "geojson",
      })
    )
    expect(map.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        id: PUBLIC_MAP_CLUSTER_SOURCE_CLUSTER_LAYER_ID,
      })
    )
    expect(map.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({ id: PUBLIC_MAP_CLUSTER_SOURCE_POINT_LAYER_ID })
    )
  })

  it("does not attach source or layers when no style object exists", () => {
    const map = {
      getStyle: vi.fn().mockReturnValue(undefined),
      isStyleLoaded: vi.fn().mockReturnValue(true),
      getSource: vi.fn(),
      addSource: vi.fn(),
      getLayer: vi.fn(),
      addLayer: vi.fn(),
    } as unknown as mapboxgl.Map

    expect(ensurePublicMapClusterLayers(map, nonEmptyFeatureCollection)).toBe(
      false
    )

    expect(map.getSource).not.toHaveBeenCalled()
    expect(map.addSource).not.toHaveBeenCalled()
    expect(map.addLayer).not.toHaveBeenCalled()
  })

  it("leaves the source available after initial layer sync", () => {
    const sources = new Map<string, mapboxgl.AnySourceData>()
    const layers = new Set<string>()
    const map = {
      getStyle: vi.fn().mockReturnValue(loadedStyle),
      isStyleLoaded: vi.fn().mockReturnValue(false),
      getSource: vi.fn((id: string) => sources.get(id)),
      addSource: vi.fn((id: string, source: mapboxgl.AnySourceData) => {
        sources.set(id, source)
      }),
      getLayer: vi.fn((id: string) => (layers.has(id) ? { id } : undefined)),
      addLayer: vi.fn((layer: { id: string }) => {
        layers.add(layer.id)
      }),
      setFilter: vi.fn(),
      setLayoutProperty: vi.fn(),
    } as unknown as mapboxgl.Map

    expect(ensurePublicMapClusterLayers(map, nonEmptyFeatureCollection)).toBe(
      true
    )

    expect(sources.has(PUBLIC_MAP_ORGANIZATION_SOURCE_ID)).toBe(true)
    expect(map.getSource(PUBLIC_MAP_ORGANIZATION_SOURCE_ID)).toEqual(
      expect.objectContaining({
        data: nonEmptyFeatureCollection,
        type: "geojson",
      })
    )
  })

  it("leaves required cluster and point layers available after initial layer sync", () => {
    const layers = new Set<string>()
    const map = {
      getStyle: vi.fn().mockReturnValue(loadedStyle),
      isStyleLoaded: vi.fn().mockReturnValue(false),
      getSource: vi.fn().mockReturnValue(undefined),
      addSource: vi.fn(),
      getLayer: vi.fn((id: string) => (layers.has(id) ? { id } : undefined)),
      addLayer: vi.fn((layer: { id: string }) => {
        layers.add(layer.id)
      }),
      setFilter: vi.fn(),
      setLayoutProperty: vi.fn(),
    } as unknown as mapboxgl.Map

    expect(ensurePublicMapClusterLayers(map, nonEmptyFeatureCollection)).toBe(
      true
    )

    expect(layers.has(PUBLIC_MAP_CLUSTER_SOURCE_CLUSTER_LAYER_ID)).toBe(true)
    expect(layers.has(PUBLIC_MAP_CLUSTER_LABEL_LAYER_ID)).toBe(true)
    expect(layers.has(PUBLIC_MAP_CLUSTER_SOURCE_POINT_LAYER_ID)).toBe(true)
    expect(layers.has(PUBLIC_MAP_POINT_LABEL_LAYER_ID)).toBe(true)
  })

  it("sets non-empty cluster data when isStyleLoaded is false but style object exists", () => {
    const source = {
      setData: vi.fn(),
    }
    const map = {
      getStyle: vi.fn().mockReturnValue(loadedStyle),
      isStyleLoaded: vi.fn().mockReturnValue(false),
      getSource: vi.fn().mockReturnValue(source),
    } as unknown as mapboxgl.Map

    expect(
      setPublicMapClusterSourceData({
        map,
        sourceData: nonEmptyFeatureCollection,
      })
    ).toBe(true)

    expect(source.setData).toHaveBeenCalledWith(nonEmptyFeatureCollection)
  })

  it("creates visible cluster sprite, point, and selected layers", () => {
    const layers = new Set<string>()
    const map = {
      getStyle: vi.fn().mockReturnValue(loadedStyle),
      isStyleLoaded: vi.fn().mockReturnValue(true),
      getSource: vi.fn().mockReturnValue(undefined),
      addSource: vi.fn(),
      getLayer: vi.fn((id: string) => (layers.has(id) ? { id } : undefined)),
      addLayer: vi.fn((layer: { id: string }) => {
        layers.add(layer.id)
      }),
      setFilter: vi.fn(),
      setPaintProperty: vi.fn(),
      setLayoutProperty: vi.fn(),
    } as unknown as mapboxgl.Map

    syncClusterSourceAndLayers({
      map,
    })

    expect(map.addSource).toHaveBeenCalledWith(
      PUBLIC_MAP_ORGANIZATION_SOURCE_ID,
      expect.objectContaining({
        type: "geojson",
        data: expect.objectContaining({
          type: "FeatureCollection",
        }),
      })
    )
    expect(map.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        id: PUBLIC_MAP_CLUSTER_SOURCE_CLUSTER_LAYER_ID,
      })
    )
    expect(map.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({ id: PUBLIC_MAP_CLUSTER_LABEL_LAYER_ID })
    )
    expect(map.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({ id: PUBLIC_MAP_CLUSTER_SOURCE_POINT_LAYER_ID })
    )
    expect(map.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({ id: PUBLIC_MAP_POINT_LABEL_LAYER_ID })
    )
    expect(map.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({ id: PUBLIC_MAP_UNCLUSTERED_SHADOW_LAYER_ID })
    )
    expect(map.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({ id: PUBLIC_MAP_SAME_LOCATION_COUNT_LAYER_ID })
    )
    expect(map.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({ id: PUBLIC_MAP_SELECTED_POINT_HALO_LAYER_ID })
    )
    expect(map.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({ id: PUBLIC_MAP_SELECTED_POINT_SHADOW_LAYER_ID })
    )
    expect(map.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({ id: PUBLIC_MAP_SELECTED_POINT_CORE_LAYER_ID })
    )
    expect(map.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({ id: PUBLIC_MAP_SELECTED_POINT_BADGE_LAYER_ID })
    )
    expect(map.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({ id: PUBLIC_MAP_SELECTED_POINT_LABEL_LAYER_ID })
    )
    expect(map.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        id: PUBLIC_MAP_CLUSTER_SOURCE_CLUSTER_LAYER_ID,
        type: "symbol",
        layout: expect.objectContaining({
          "icon-image": ["get", "clusterImageId"],
          "icon-size": 1,
          "icon-allow-overlap": true,
        }),
      })
    )
    expect(map.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        id: PUBLIC_MAP_CLUSTER_LABEL_LAYER_ID,
        type: "symbol",
        layout: expect.objectContaining({
          "text-field": [
            "concat",
            ["to-string", ["get", "point_count_abbreviated"]],
            " resources",
          ],
          "text-anchor": "top",
          "text-offset": [0, 2.92],
          "text-allow-overlap": true,
          "text-ignore-placement": true,
        }),
        paint: expect.objectContaining({
          "text-halo-blur": 0.16,
          "text-halo-color": "rgba(255, 255, 255, 0.9)",
          "text-halo-width": 0.65,
        }),
      })
    )
    expect(map.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        id: PUBLIC_MAP_UNCLUSTERED_SHADOW_LAYER_ID,
        type: "symbol",
        layout: expect.objectContaining({
          "icon-image": PUBLIC_MAP_POINT_SHADOW_KEY,
          "icon-size": resolvePublicMapPointShadowSize(),
          "icon-ignore-placement": true,
        }),
        paint: expect.objectContaining({
          "icon-opacity": resolvePublicMapPointShadowOpacity(),
          "icon-opacity-transition": PUBLIC_MAP_MARKER_SELECTION_TRANSITION,
        }),
      })
    )
    expect(map.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        id: PUBLIC_MAP_CLUSTER_SOURCE_POINT_LAYER_ID,
        type: "symbol",
        layout: expect.objectContaining({
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
          "icon-padding": 4,
        }),
      })
    )
    expect(map.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        id: PUBLIC_MAP_POINT_LABEL_LAYER_ID,
        type: "symbol",
        layout: expect.objectContaining({
          "text-field": buildPublicMapPointLabelExpression(),
          "text-anchor": "top",
          "text-offset": [0, 1.55],
          "text-allow-overlap": false,
        }),
        paint: expect.objectContaining({
          "text-halo-blur": 0.16,
          "text-halo-color": "rgba(255, 255, 255, 0.9)",
          "text-halo-width": 0.7,
        }),
      })
    )

    const addedLayers = (
      map.addLayer as unknown as ReturnType<typeof vi.fn>
    ).mock.calls.map(([layer]) => layer)
    const selectedHaloLayer = addedLayers.find(
      (layer) => layer.id === PUBLIC_MAP_SELECTED_POINT_HALO_LAYER_ID
    )
    const selectedCoreLayer = addedLayers.find(
      (layer) => layer.id === PUBLIC_MAP_SELECTED_POINT_CORE_LAYER_ID
    )
    const selectedShadowLayer = addedLayers.find(
      (layer) => layer.id === PUBLIC_MAP_SELECTED_POINT_SHADOW_LAYER_ID
    )
    const selectedBadgeLayer = addedLayers.find(
      (layer) => layer.id === PUBLIC_MAP_SELECTED_POINT_BADGE_LAYER_ID
    )
    const selectedLabelLayer = addedLayers.find(
      (layer) => layer.id === PUBLIC_MAP_SELECTED_POINT_LABEL_LAYER_ID
    )

    expect(selectedHaloLayer).toMatchObject({
      paint: expect.objectContaining({
        "circle-color": "rgba(0, 0, 0, 0)",
        "circle-opacity": 0,
        "circle-stroke-opacity": 0,
        "circle-stroke-width": 0,
      }),
    })
    expect(selectedShadowLayer).toMatchObject({
      layout: expect.objectContaining({
        "icon-image": PUBLIC_MAP_POINT_SHADOW_KEY,
        "icon-size": resolvePublicMapSelectedPointShadowSize(),
      }),
      paint: expect.objectContaining({
        "icon-opacity": resolvePublicMapSelectedPointShadowOpacity(),
        "icon-opacity-transition": PUBLIC_MAP_MARKER_SELECTION_TRANSITION,
      }),
    })
    expect(selectedCoreLayer).toMatchObject({
      layout: expect.objectContaining({
        "icon-size": resolvePublicMapSelectedPointIconSize(),
      }),
      paint: expect.objectContaining({
        "icon-opacity": 1,
        "icon-opacity-transition": PUBLIC_MAP_MARKER_SELECTION_TRANSITION,
      }),
    })
    expect(selectedBadgeLayer).toMatchObject({
      filter: expect.arrayContaining([[">", ["get", "sameLocationCount"], 1]]),
      paint: expect.objectContaining({
        "text-halo-width": 0,
        "text-opacity": 0,
      }),
    })
    expect(selectedLabelLayer).toMatchObject({
      filter: expect.arrayContaining([
        [
          "any",
          ["==", ["get", "organizationId"], "__public-map-no-selection__"],
          ["==", ["get", "sameLocationKey"], "__public-map-no-selection__"],
        ],
      ]),
      layout: expect.objectContaining({
        "text-field": buildPublicMapPointLabelExpression(),
        "text-offset": resolvePublicMapSelectedPointLabelOffset(),
        "text-allow-overlap": true,
        "text-ignore-placement": true,
      }),
      paint: expect.objectContaining({
        "text-halo-width": 0.7,
        "text-opacity": 1,
        "text-opacity-transition": PUBLIC_MAP_MARKER_SELECTION_TRANSITION,
      }),
    })
    expect(resolvePublicMapSelectedPointLabelOffset()).toEqual([0, 2.62])
  })

  it("uses dark label paint when syncing dark map marker layers", () => {
    const layers = new Set<string>()
    const map = {
      getStyle: vi.fn().mockReturnValue(loadedStyle),
      isStyleLoaded: vi.fn().mockReturnValue(true),
      getSource: vi.fn().mockReturnValue(undefined),
      addSource: vi.fn(),
      getLayer: vi.fn((id: string) => (layers.has(id) ? { id } : undefined)),
      addLayer: vi.fn((layer: { id: string }) => {
        layers.add(layer.id)
      }),
      setFilter: vi.fn(),
      setPaintProperty: vi.fn(),
      setLayoutProperty: vi.fn(),
    } as unknown as mapboxgl.Map

    syncClusterSourceAndLayers({
      map,
      markerTheme: "dark",
    })

    expect(map.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        id: PUBLIC_MAP_CLUSTER_LABEL_LAYER_ID,
        paint: expect.objectContaining({
          "text-color": "rgba(250, 250, 250, 0.9)",
          "text-halo-blur": 0.25,
          "text-halo-color": "rgba(9, 9, 11, 0.92)",
          "text-halo-width": 1.45,
        }),
      })
    )
    expect(map.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        id: PUBLIC_MAP_POINT_LABEL_LAYER_ID,
        paint: expect.objectContaining({
          "text-color": "rgba(250, 250, 250, 0.92)",
          "text-halo-blur": 0.25,
          "text-halo-color": "rgba(9, 9, 11, 0.92)",
          "text-halo-width": 1.5,
        }),
      })
    )
    expect(map.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        id: PUBLIC_MAP_SELECTED_POINT_LABEL_LAYER_ID,
        paint: expect.objectContaining({
          "text-color": "rgba(250, 250, 250, 0.92)",
          "text-halo-blur": 0.25,
          "text-halo-color": "rgba(9, 9, 11, 0.92)",
          "text-halo-width": 1.5,
        }),
      })
    )
  })

  it("does not create the old demo circle cluster or point-shadow layers", () => {
    const layers = new Set<string>()
    const addLayer = vi.fn((layer: mapboxgl.LayerSpecification) => {
      layers.add(layer.id)
    })
    const map = {
      getStyle: vi.fn().mockReturnValue(loadedStyle),
      isStyleLoaded: vi.fn().mockReturnValue(true),
      getSource: vi.fn().mockReturnValue(undefined),
      addSource: vi.fn(),
      getLayer: vi.fn((id: string) => (layers.has(id) ? { id } : undefined)),
      addLayer,
      setFilter: vi.fn(),
      setLayoutProperty: vi.fn(),
    } as unknown as mapboxgl.Map

    syncClusterSourceAndLayers({ map })

    const addedLayers = addLayer.mock.calls.map(([layer]) => layer)
    expect(
      addedLayers.find(
        (layer) => layer.id === PUBLIC_MAP_CLUSTER_SOURCE_CLUSTER_LAYER_ID
      )
    ).toMatchObject({ type: "symbol" })
    expect(
      addedLayers.find(
        (layer) => layer.id === PUBLIC_MAP_UNCLUSTERED_SHADOW_LAYER_ID
      )
    ).toMatchObject({ type: "symbol" })
    expect(
      addedLayers.some(
        (layer) =>
          layer.type === "circle" &&
          (layer.id === PUBLIC_MAP_CLUSTER_SOURCE_CLUSTER_LAYER_ID ||
            layer.id === PUBLIC_MAP_UNCLUSTERED_SHADOW_LAYER_ID)
      )
    ).toBe(false)
  })

  it("refreshes cluster sprite image and size without text-count or feature-state interaction", () => {
    const existingLayers = new Set([
      PUBLIC_MAP_CLUSTER_SOURCE_CLUSTER_LAYER_ID,
      PUBLIC_MAP_CLUSTER_LABEL_LAYER_ID,
      PUBLIC_MAP_CLUSTER_SOURCE_POINT_LAYER_ID,
      PUBLIC_MAP_POINT_LABEL_LAYER_ID,
      PUBLIC_MAP_UNCLUSTERED_SHADOW_LAYER_ID,
      PUBLIC_MAP_SAME_LOCATION_COUNT_LAYER_ID,
      PUBLIC_MAP_SELECTED_POINT_HALO_LAYER_ID,
      PUBLIC_MAP_SELECTED_POINT_SHADOW_LAYER_ID,
      PUBLIC_MAP_SELECTED_POINT_CORE_LAYER_ID,
      PUBLIC_MAP_SELECTED_POINT_BADGE_LAYER_ID,
      PUBLIC_MAP_SELECTED_POINT_LABEL_LAYER_ID,
    ])
    const map = {
      getStyle: vi.fn().mockReturnValue(loadedStyle),
      getSource: vi.fn().mockReturnValue({}),
      getLayer: vi.fn((id: string) =>
        existingLayers.has(id) ? { id } : undefined
      ),
      setFilter: vi.fn(),
      setLayoutProperty: vi.fn(),
      setPaintProperty: vi.fn(),
      setFeatureState: vi.fn(),
      removeFeatureState: vi.fn(),
    } as unknown as mapboxgl.Map

    syncClusterSourceAndLayers({ map })

    expect(map.setLayoutProperty).toHaveBeenCalledWith(
      PUBLIC_MAP_CLUSTER_SOURCE_CLUSTER_LAYER_ID,
      "icon-image",
      ["get", "clusterImageId"]
    )
    expect(map.setLayoutProperty).toHaveBeenCalledWith(
      PUBLIC_MAP_CLUSTER_SOURCE_CLUSTER_LAYER_ID,
      "icon-size",
      1
    )
    expect(map.setLayoutProperty).not.toHaveBeenCalledWith(
      PUBLIC_MAP_CLUSTER_SOURCE_CLUSTER_LAYER_ID,
      "text-field",
      expect.anything()
    )
    expect(map.setLayoutProperty).toHaveBeenCalledWith(
      PUBLIC_MAP_CLUSTER_LABEL_LAYER_ID,
      "text-field",
      [
        "concat",
        ["to-string", ["get", "point_count_abbreviated"]],
        " resources",
      ]
    )
    expect(map.setLayoutProperty).toHaveBeenCalledWith(
      PUBLIC_MAP_POINT_LABEL_LAYER_ID,
      "text-field",
      buildPublicMapPointLabelExpression()
    )
    expect(map.setLayoutProperty).toHaveBeenCalledWith(
      PUBLIC_MAP_SELECTED_POINT_LABEL_LAYER_ID,
      "text-field",
      buildPublicMapPointLabelExpression()
    )
    expect(map.setLayoutProperty).toHaveBeenCalledWith(
      PUBLIC_MAP_SELECTED_POINT_LABEL_LAYER_ID,
      "text-offset",
      resolvePublicMapSelectedPointLabelOffset()
    )
    expect(map.setFeatureState).not.toHaveBeenCalled()
    expect(map.removeFeatureState).not.toHaveBeenCalled()
  })

  it("updates point and selected filters when selection changes", () => {
    const map = {
      getLayer: vi.fn().mockReturnValue({ id: "layer" }),
      setFilter: vi.fn(),
    } as unknown as mapboxgl.Map

    syncSelectedOrganizationLayers({
      map,
      selectedOrganizationId: "org-42",
    })

    const unselectedFilter = [
      "all",
      ["!", ["has", "point_count"]],
      [
        "!",
        [
          "any",
          ["==", ["get", "organizationId"], "org-42"],
          ["==", ["get", "sameLocationKey"], "__public-map-no-selection__"],
        ],
      ],
    ]

    expect(map.setFilter).toHaveBeenCalledWith(
      PUBLIC_MAP_CLUSTER_SOURCE_POINT_LAYER_ID,
      unselectedFilter
    )
    expect(map.setFilter).toHaveBeenCalledWith(
      PUBLIC_MAP_UNCLUSTERED_SHADOW_LAYER_ID,
      unselectedFilter
    )
    expect(map.setFilter).toHaveBeenCalledWith(
      PUBLIC_MAP_POINT_LABEL_LAYER_ID,
      unselectedFilter
    )
    expect(map.setFilter).toHaveBeenCalledWith(
      PUBLIC_MAP_SELECTED_POINT_HALO_LAYER_ID,
      [
        "all",
        ["!", ["has", "point_count"]],
        [
          "any",
          ["==", ["get", "organizationId"], "org-42"],
          ["==", ["get", "sameLocationKey"], "__public-map-no-selection__"],
        ],
      ]
    )
    expect(map.setFilter).toHaveBeenCalledWith(
      PUBLIC_MAP_SELECTED_POINT_CORE_LAYER_ID,
      [
        "all",
        ["!", ["has", "point_count"]],
        [
          "any",
          ["==", ["get", "organizationId"], "org-42"],
          ["==", ["get", "sameLocationKey"], "__public-map-no-selection__"],
        ],
      ]
    )
    expect(map.setFilter).toHaveBeenCalledWith(
      PUBLIC_MAP_SELECTED_POINT_SHADOW_LAYER_ID,
      [
        "all",
        ["!", ["has", "point_count"]],
        [
          "any",
          ["==", ["get", "organizationId"], "org-42"],
          ["==", ["get", "sameLocationKey"], "__public-map-no-selection__"],
        ],
      ]
    )
    expect(map.setFilter).toHaveBeenCalledWith(
      PUBLIC_MAP_SELECTED_POINT_LABEL_LAYER_ID,
      [
        "all",
        ["!", ["has", "point_count"]],
        [
          "any",
          ["==", ["get", "organizationId"], "org-42"],
          ["==", ["get", "sameLocationKey"], "__public-map-no-selection__"],
        ],
      ]
    )
    expect(map.setFilter).toHaveBeenCalledWith(
      PUBLIC_MAP_SELECTED_POINT_BADGE_LAYER_ID,
      [
        "all",
        ["!", ["has", "point_count"]],
        [
          "any",
          ["==", ["get", "organizationId"], "org-42"],
          ["==", ["get", "sameLocationKey"], "__public-map-no-selection__"],
        ],
        [">", ["get", "sameLocationCount"], 1],
      ]
    )
  })

  it("returns cleanly when layer access throws during style teardown", () => {
    const map = {
      getLayer: vi.fn(() => {
        throw new TypeError(
          "Cannot read properties of undefined (reading 'getOwnLayer')"
        )
      }),
      setFilter: vi.fn(),
    } as unknown as mapboxgl.Map

    expect(() =>
      syncSelectedOrganizationLayers({
        map,
        selectedOrganizationId: "org-42",
      })
    ).not.toThrow()
    expect(map.setFilter).not.toHaveBeenCalled()
  })
})
