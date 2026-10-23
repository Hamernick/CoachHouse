import { describe, expect, it, vi, beforeEach } from "vitest"
import { fetchFindResourceDetailItem } from "@/features/find-resource-index/server/actions"
import type { ExternalResourceMapItem } from "@/lib/public-map/resource-map-items"

const mocks = vi.hoisted(() => ({ item: vi.fn(), catalog: vi.fn() }))
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }))
vi.mock("@/lib/queries/resource-map-public-items", () => ({ fetchPublicResourceMapItemById: mocks.item, fetchPublicResourceMapItems: vi.fn() }))
vi.mock("@/features/find-resource-index/server/catalog", () => ({ getFindResourceCatalog: mocks.catalog }))
const base: ExternalResourceMapItem = {
  id: "a", itemType: "external_resource", title: "Community Center", subtitle: null,
  description: "Library services", address: null, addressStreet: "100 Main Street",
  latitude: 41.9, longitude: -87.7, city: "Chicago", state: "IL", country: "US",
  orgCategory: null, resourceCategories: ["community"], primaryResourceCategory: "community",
  visibility: "published", verificationStatus: "external_data", sourceLabel: "Provider", sourceUrl: null, lastVerifiedAt: null,
  services: [{ id: "a", title: "Library", description: "Library services" }],
}
beforeEach(() => { vi.resetAllMocks(); mocks.catalog.mockResolvedValue({ items: [{ id: "a", relatedResourceIds: ["a", "b"] }] }) })
describe("consolidated resource detail", () => {
  it("resolves an old link and retains the distinct service details", async () => {
    mocks.item.mockImplementation(async (id) => id === "a" ? base : { ...base, id: "b", resourceCategories: ["food"], services: [{ id: "b", title: "Food", description: "Meals" }] })
    const detail = await fetchFindResourceDetailItem("b")
    expect(detail?.id).toBe("b")
    expect(detail?.resourceCategories).toEqual(["community", "food"])
    expect(detail?.services).toHaveLength(2)
  })
  it("never restores an unpublished sibling from cached grouping", async () => {
    mocks.item.mockImplementation(async (id) => id === "a" ? base : null)
    expect((await fetchFindResourceDetailItem("a"))?.services).toHaveLength(1)
    expect(await fetchFindResourceDetailItem("b")).toBeNull()
  })
  it("rechecks location identity when a sibling moves", async () => {
    mocks.item.mockImplementation(async (id) => id === "a" ? base : { ...base, id: "b", addressStreet: "200 Main Street", description: "Other place" })
    expect((await fetchFindResourceDetailItem("a"))?.description).toBe("Library services")
  })
  it("keeps individual detail available when the catalog is unavailable", async () => {
    mocks.item.mockResolvedValue(base)
    mocks.catalog.mockRejectedValue(new Error("catalog unavailable"))
    expect((await fetchFindResourceDetailItem("a"))?.id).toBe("a")
  })
})
