import { describe, expect, it } from "vitest"
import { resourceMapScreenBounds, serializeResourceMapBounds, resolveResourceMapQueryBounds } from "@/features/find-resource-index/lib/map-bounds"
import { buildFindResourceCatalog, queryFindResourceCatalog, parseFindResourceCatalogQuery, resourceIndexItemInBounds } from "@/features/find-resource-index/lib/catalog-query"
import type { FindResourceIndexItem } from "@/features/find-resource-index/types"

describe("resource map viewport queries", () => {
  it("keeps rotating overview queries stable while retaining all eligible coordinates", () => {
    const first = resolveResourceMapQueryBounds("globe", [156, -7, 2, 78], null, 1.5)
    expect(resolveResourceMapQueryBounds("globe", [144, -7, -10, 78], null, 1.5)).toBe(first)
    const bounds = parseFindResourceCatalogQuery(new URLSearchParams(`mode=map&bounds=${first}`))!.bounds!
    expect(resourceIndexItemInBounds({ latitude: 41.879, longitude: -87.725 } as FindResourceIndexItem, bounds)).toBe(true)
    expect(resourceIndexItemInBounds({ latitude: -33.8, longitude: 151.2 } as FindResourceIndexItem, bounds)).toBe(true)
    expect(resolveResourceMapQueryBounds("globe", [-88, 41, -87, 42], null, 5)).toBe("-88.000,41.000,-87.000,42.000")
    expect(resolveResourceMapQueryBounds("mercator", [-88, 41, -87, 42], null, 1.5)).toBe("-88.000,41.000,-87.000,42.000")
  })
  it("contains all four geographic corners after rotation, including reversed diagonals", () => {
    const screen = { left: 100, top: 200, right: 300, bottom: 400 }
    const project = ([x, y]: [number, number]) => ({ lng: -88 + (x + y) / 1000, lat: 42 + (x - y) / 1000 })
    const edges = resourceMapScreenBounds(screen, { left: 100, top: 200 }, project)
    const bounds = parseFindResourceCatalogQuery(new URLSearchParams(`mode=map&bounds=${serializeResourceMapBounds(edges)}`))!.bounds!
    for (const point of [[0, 0], [200, 0], [200, 200], [0, 200]] as [number, number][]) {
      const { lng, lat } = project(point)
      expect(resourceIndexItemInBounds({ latitude: lat, longitude: lng } as FindResourceIndexItem, bounds)).toBe(true)
    }
  })
  it.each([-180, 180])("keeps wrapped corners near longitude %s inside a narrow date-line query", (center) => {
    const screen = { left: 100, top: 200, right: 300, bottom: 400 }
    const edges = resourceMapScreenBounds(screen, screen, ([x, y]) => ({
      lng: ((center - 1 + x / 100 + 180) % 360 + 360) % 360 - 180,
      lat: 10 - y / 10,
    }))
    const serialized = serializeResourceMapBounds(edges)!
    expect(serialized).toBe("179.000,-10.000,-179.000,10.000")
    const bounds = parseFindResourceCatalogQuery(new URLSearchParams({ mode: "map", bounds: serialized }))!.bounds!
    for (const longitude of [179.5, -179.5, 180, -180]) {
      expect(resourceIndexItemInBounds({ latitude: 0, longitude } as FindResourceIndexItem, bounds)).toBe(true)
    }
    expect(resourceIndexItemInBounds({ latitude: 0, longitude: 0 } as FindResourceIndexItem, bounds)).toBe(false)
  })
  it("does not let 500 off-screen places crowd out visible date-line markers", () => {
    const screen = { left: 0, top: 0, right: 200, bottom: 200 }
    const edges = resourceMapScreenBounds(screen, screen, ([x, y]) => ({ lng: (179 + x / 100 + 180) % 360 - 180, lat: 10 - y / 10 }))
    const item = (id: string, longitude: number): FindResourceIndexItem => ({
      id, longitude, latitude: 0, itemType: "external_resource", title: id, subtitle: null,
      city: null, state: null, country: null, resourceCategories: ["food"], primaryResourceCategory: "food",
      verificationStatus: "external_data", visibility: "published",
    })
    const catalog = buildFindResourceCatalog([
      ...Array.from({ length: 500 }, (_, i) => item(`offscreen-${i}`, 0)),
      item("visible-east", 179.5), item("visible-west", -179.5),
    ], "test")
    const query = parseFindResourceCatalogQuery(new URLSearchParams({ mode: "map", limit: "500", bounds: serializeResourceMapBounds(edges)! }))!
    const response = queryFindResourceCatalog(catalog, query)
    expect(response.resourceItems.map((entry) => entry.id).sort()).toEqual(["visible-east", "visible-west"])
    expect(response.page.hasMore).toBe(false)
  })
  it("retains genuinely wide and whole-world viewports", () => {
    const screen = { left: 0, top: 0, right: 200, bottom: 200 }
    for (const [west, east] of [[-170, 170], [-200, 200]]) {
      const edges = resourceMapScreenBounds(screen, screen, ([x, y]) => ({ lng: west + (east - west) * x / 200, lat: 10 - y / 10 }))
      expect(serializeResourceMapBounds(edges)).toBe(`${Math.max(-180, west).toFixed(3)},-10.000,${Math.min(180, east).toFixed(3)},10.000`)
    }
  })
  it("uses projection-aware bounds for the globe rather than excluding visible northern places", () => {
    const viewport = [-180, -50, 180, 90]
    const corners = () => [-100, -7.244, 80, 35.973]
    const query = resolveResourceMapQueryBounds("globe", viewport, corners)
    const bounds = parseFindResourceCatalogQuery(new URLSearchParams(`mode=map&bounds=${query}`))!.bounds!
    expect(resourceIndexItemInBounds({ latitude: 41.879, longitude: -87.725 } as FindResourceIndexItem, bounds)).toBe(true)
    expect(resolveResourceMapQueryBounds("mercator", viewport, corners)).toBe("-100.000,-7.244,80.000,35.973")
  })
  it("rounds outward and preserves antimeridian and whole-world bounds", () => {
    expect(serializeResourceMapBounds([-87.1239, 41.1231, -87.1001, 41.9991])).toBe("-87.124,41.123,-87.100,42.000")
    expect(serializeResourceMapBounds([179, -10, 181, 10])).toBe("179.000,-10.000,-179.000,10.000")
    expect(serializeResourceMapBounds([-200, -95, 200, 95])).toBe("-180.000,-90.000,180.000,90.000")
    expect(serializeResourceMapBounds([NaN, 0, 1, 2])).toBeNull()
  })
})
