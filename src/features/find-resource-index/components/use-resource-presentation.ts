"use client"

import { useMemo } from "react"
import { buildPublicMapItems, publicMapItemMatchesGroupFilter, type ExternalResourceMapItem } from "@/lib/public-map/resource-map-items"
import { buildPublicMapGroupFilterCounts } from "@/lib/public-map/resource-map-counts"
import type { PublicMapOrganization } from "@/lib/queries/public-map-index"
import type { PublicMapGroupFilterKey } from "@/components/public/public-map-index/category-filter"
import { rankPublicMapListItems } from "@/lib/public-map/resource-search"
import { PUBLIC_MAP_RESOURCE_GUIDE_DEFINITIONS } from "@/lib/public-map/resource-guide-definitions"
import type { FindResourceCatalogResponse } from "../lib/catalog-query"

export function useResourcePresentation({ organizations, mapItems, query, category, guide, metadata }: {
  organizations: PublicMapOrganization[]
  mapItems: ExternalResourceMapItem[]
  query: string
  category: PublicMapGroupFilterKey
  guide: string | null
  metadata?: FindResourceCatalogResponse
}) {
  return useMemo(() => {
    const platform = buildPublicMapItems({ organizations })
    const matched = rankPublicMapListItems({ items: platform, query })
    const platformCounts = buildPublicMapGroupFilterCounts(matched)
    const discoveryCounts = buildPublicMapGroupFilterCounts(platform)
    const definition = PUBLIC_MAP_RESOURCE_GUIDE_DEFINITIONS.find((item) => item.id === guide)
    const matches = (item: typeof platform[number]) => definition ? definition.matches(item) : publicMapItemMatchesGroupFilter({ item, activeGroup: category })
    const mergeCounts = (local: typeof platformCounts, external: typeof platformCounts | undefined) => Object.fromEntries(Object.entries(local).map(([key, count]) => [key, count + (external?.[key as keyof typeof local] ?? 0)])) as typeof platformCounts
    return {
      mapItems: [...matched.filter(matches), ...mapItems],
      groupCounts: mergeCounts(platformCounts, metadata?.counts),
      discoveryCounts: mergeCounts(discoveryCounts, metadata?.discoveryCounts),
      resultCount: (metadata?.page.totalCount ?? 0) + matched.filter(matches).length,
    }
  }, [organizations, mapItems, query, category, guide, metadata])
}
