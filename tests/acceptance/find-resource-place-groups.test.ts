import { describe, expect, it } from "vitest"
import { groupResourcePlaces, mergeResourcePlace } from "@/features/find-resource-index/lib/resource-place-groups"
import { serializeFindResourceIndexItem } from "@/features/find-resource-index"
import { buildFindResourceCatalog, parseFindResourceCatalogQuery, queryFindResourceCatalog } from "@/features/find-resource-index/lib/catalog-query"
import { resolveResourceAvailability } from "@/lib/public-map/resource-availability"
import type { ExternalResourceMapItem } from "@/lib/public-map/resource-map-items"

const library: ExternalResourceMapItem = {
  id: "resource_map:a", itemType: "external_resource", title: "Neighborhood Library", subtitle: null,
  description: "Library services", addressStreet: "115 S. Pulaski Rd.", address: null,
  city: "Chicago", state: "IL", country: "United States", latitude: 41.879345, longitude: -87.725476,
  orgCategory: null, resourceCategories: ["community_libraries"], primaryResourceCategory: "community_libraries",
  verificationStatus: "external_data", visibility: "published", sourceLabel: "Library provider", sourceUrl: null, lastVerifiedAt: null,
  services: [{ id: "a", title: "Library", description: "Books", eligibility: "Library card" }],
}
const food: ExternalResourceMapItem = { ...library, id: "resource_map:b", country: "US",
  addressStreet: "115 South Pulaski Road, Chicago, IL 60624", longitude: -87.72525,
  resourceCategories: ["food"], primaryResourceCategory: "food", description: "Food support", sourceLabel: "Food provider",
  services: [{ id: "b", title: "Meals", description: "Groceries", eligibility: "Call provider" }],
}

describe("published resource place identity", () => {
  it("groups the same published place across providers with stable identity and preserves both services", () => {
    const groups = groupResourcePlaces([food, library, library])
    expect(groups).toHaveLength(1)
    expect(groups[0].map((item) => item.id)).toEqual([library.id, food.id])
    const merged = mergeResourcePlace(groups[0])
    expect(merged.resourceCategories).toEqual(["community_libraries", "food"])
    expect(merged.services?.map((service) => service.eligibility)).toEqual(["Library card", "Call provider"])
    expect(merged.description).toContain("Food support")
    expect(merged.services?.[0].title).toBe("Library — Libraries")
    expect(merged.hoursLabel).toBeNull()
    expect(merged.availability).toBeUndefined()
  })
  it.each([
    { addressStreet: "117 South Pulaski Road" },
    { addressStreet: "115 South Pulaski Road, Suite 2" },
    { addressStreet: "115 South Pulaski Road, Chicago, IL 60624, Suite 2" },
    { longitude: -87.7 }, { latitude: null }, { city: "Oak Park" },
    { addressStreet: null }, { title: "Different provider" }, { visibility: "unpublished" },
  ])("keeps separate or uncertain places distinct: %j", (changes) => {
    expect(groupResourcePlaces([library, { ...food, ...changes } as ExternalResourceMapItem])).toHaveLength(2)
  })
  it("keeps both category searches, stable pagination, and saved alias lookup", () => {
    const item = { ...serializeFindResourceIndexItem(mergeResourcePlace([library, food])), relatedResourceIds: [library.id, food.id] }
    const catalog = buildFindResourceCatalog([item], "grouped")
    for (const category of ["all", "food", "community_libraries"]) {
      const options = parseFindResourceCatalogQuery(new URLSearchParams(`mode=directory&category=${category}&limit=1`))!
      expect(queryFindResourceCatalog(catalog, options).resourceItems).toHaveLength(1)
      expect(queryFindResourceCatalog(catalog, options).page.hasMore).toBe(false)
    }
    const params = new URLSearchParams({ mode: "directory", ids: JSON.stringify([food.id]) })
    expect(queryFindResourceCatalog(catalog, parseFindResourceCatalogQuery(params)!).resourceItems[0].id).toBe(food.id)
    expect(mergeResourcePlace([library, food], food.id).id).toBe(food.id)
    const aliases = { ...parseFindResourceCatalogQuery(params)!, ids: [library.id, food.id], limit: 1 }
    const first = queryFindResourceCatalog(catalog, aliases)
    const second = queryFindResourceCatalog(catalog, { ...aliases, cursor: first.page.nextCursor })
    expect(first.page.hasMore).toBe(true)
    expect(second.resourceItems[0].id).toBe(food.id)
    expect(second.page.hasMore).toBe(false)
  })
})


describe("audited provider name aliases", () => {
  it("consolidates the confirmed Portage spelling variant and keeps both saved IDs", () => {
    const a = { ...library, id: "resource_map:887e6a14-2367-4c97-bda6-10509e5b3f93", title: "Iglesia Evangelical De Cristo", addressStreet: "5929 Stone Ave.", city: "Portage", state: "IN", latitude: 41.5633351, longitude: -87.1858411 }
    const b = { ...a, id: "resource_map:8903177f-5f18-48a7-9f5f-6e58b392e190", title: "Iglesia Evangelica De Cristo", addressStreet: "5929 Stone Avenue, Portage, IN 46368", latitude: 41.56478, longitude: -87.18675 }
    expect(groupResourcePlaces([a, b])).toHaveLength(1)
    expect(groupResourcePlaces([a, { ...b, title: "Another ministry" }])).toHaveLength(2)
    expect(groupResourcePlaces([a, { ...b, addressStreet: "6001 Stone Avenue" }])).toHaveLength(2)
    expect(groupResourcePlaces([a, { ...b, latitude: 42 }])).toHaveLength(2)
  })
  it("consolidates Evening Star aliases while preserving different service hours", () => {
    const a: ExternalResourceMapItem = {
      ...library,
      id: "resource_map:758a9108-48e4-4031-81d8-f695f7700097",
      title: "Operation Blessing Evening Star",
      services: [{
        id: "sat",
        title: "Pantry",
        description: null,
        availability: resolveResourceAvailability({ hours: "Saturday 9–11" }),
      }],
    }
    const b: ExternalResourceMapItem = {
      ...a,
      id: "resource_map:7c60815a-b24f-41d7-8d4d-410ee500cef6",
      title: "Evening Star MBC",
      services: [{
        id: "thu",
        title: "Pantry",
        description: null,
        availability: resolveResourceAvailability({ hours: "Thursday 12–2" }),
      }],
    }
    const groups = groupResourcePlaces([a, b])
    expect(groups).toHaveLength(1)
    expect(mergeResourcePlace(groups[0]).services?.map((service) => service.availability?.label)).toEqual(["Saturday 9–11", "Thursday 12–2"])
  })
})
