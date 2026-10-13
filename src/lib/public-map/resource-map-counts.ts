import { PUBLIC_MAP_RESOURCE_ALL_CATEGORY_ORDER, resolvePublicMapResourceTopLevelCategory, type PublicMapResourceCategoryKey } from "./resource-categories"

type PublicMapGroupFilterKey = PublicMapResourceCategoryKey | "all"
type PublicMapGroupFilterCounts = Record<PublicMapGroupFilterKey, number>
const PUBLIC_MAP_GROUP_FILTER_COUNT_ORDER = ["all", ...PUBLIC_MAP_RESOURCE_ALL_CATEGORY_ORDER] as const

export function buildPublicMapGroupFilterCounts(
  items: Array<{ resourceCategories?: readonly PublicMapResourceCategoryKey[] }>
): PublicMapGroupFilterCounts {
  const counts = Object.fromEntries(
    PUBLIC_MAP_GROUP_FILTER_COUNT_ORDER.map((key) => [key, 0])
  ) as PublicMapGroupFilterCounts

  counts.all = items.length
  for (const item of items) {
    const matchedCategories = new Set<PublicMapResourceCategoryKey>()
    const categories =
      item.resourceCategories && item.resourceCategories.length > 0
        ? item.resourceCategories
        : (["community"] as const)
    for (const category of categories) {
      matchedCategories.add(category)
      matchedCategories.add(resolvePublicMapResourceTopLevelCategory(category))
    }
    for (const category of matchedCategories) {
      counts[category] += 1
    }
  }

  return counts
}

