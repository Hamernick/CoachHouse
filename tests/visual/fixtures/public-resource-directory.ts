import type { Page } from "@playwright/test"
import type { FindResourceIndexItem } from "../../../src/features/find-resource-index/types"

export const resourceFixture: FindResourceIndexItem = {
  id: "resource_map:visual-food-pantry", itemType: "external_resource",
  title: "Visual Test Food Pantry", subtitle: "Community food access",
  city: "Chicago", state: "IL", country: "United States",
  latitude: 41.881, longitude: -87.629,
  primaryResourceCategory: "food", resourceCategories: ["food"],
  verificationStatus: "external_data", visibility: "published",
}

// Browser-intercepted test data only; never published to the public catalog.
export async function mockPublicResourceDirectory(page: Page, items: FindResourceIndexItem[] = [resourceFixture]) {
  const counts: Record<string, number> = { all: items.length }
  for (const item of items) for (const category of item.resourceCategories) counts[category] = (counts[category] ?? 0) + 1
  await page.route("**/api/public/nonprofits/summary", (route) => route.fulfill({ json: { count: 0 } }))
  await page.route("**/api/public/nonprofits/search?**", (route) => route.fulfill({ json: {
    version: 1, items: [], page: { hasMore: false, limit: 20, nextCursor: null },
  } }))
  await page.route("**/api/public/resource-map/index?**", (route) => route.fulfill({ json: {
    version: 3, revision: "visual-fixture-v1", resourceItems: items,
    page: { hasMore: false, limit: 24, nextCursor: null, totalCount: items.length },
    totalCount: items.length, counts, discoveryCounts: counts, guides: [],
  } }))
}
