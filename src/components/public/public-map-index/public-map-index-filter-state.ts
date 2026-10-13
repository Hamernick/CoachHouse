import { useMemo } from "react"

import type { PublicMapOrganization } from "@/lib/queries/public-map-index"
import {
  buildPublicMapItems,
  publicMapItemMatchesGroupFilter,
  type ExternalResourceMapItem,
} from "@/lib/public-map/resource-map-items"
import {
  buildPublicMapGroupFilterCounts,
  type PublicMapGroupFilterKey,
} from "./category-filter"
import { rankPublicMapListItems } from "./map-items-state"

export function usePublicMapOrganizationById(
  organizations: PublicMapOrganization[]
) {
  return useMemo(
    () =>
      new Map(
        organizations.map(
          (organization) => [organization.id, organization] as const
        )
      ),
    [organizations]
  )
}

export function usePublicMapFilteredOrganizations({
  deferredQuery,
  favorites,
  organizationById,
  organizations,
}: {
  deferredQuery: string
  favorites: string[]
  organizationById: Map<string, PublicMapOrganization>
  organizations: PublicMapOrganization[]
}) {
  return useMemo(
    () =>
      rankPublicMapListItems({
        favorites,
        items: buildPublicMapItems({ organizations }),
        query: deferredQuery,
      }).flatMap((item) =>
        item.itemType === "platform_organization" &&
        organizationById.has(item.organization.id)
          ? [item.organization]
          : []
      ),
    [deferredQuery, favorites, organizationById, organizations]
  )
}

export function usePublicMapOrganizationFilterState({
  activeGroup,
  deferredQuery,
  favorites,
  includeSeedResources,
  organizations,
  resourceItems,
}: {
  activeGroup: PublicMapGroupFilterKey
  deferredQuery: string
  favorites: string[]
  includeSeedResources: boolean
  organizations: PublicMapOrganization[]
  resourceItems?: ExternalResourceMapItem[]
}) {
  const discoveryItems = useMemo(
    () =>
      buildPublicMapItems({
        organizations,
        includeSeedItems: includeSeedResources,
        resourceItems,
      }),
    [includeSeedResources, organizations, resourceItems]
  )
  const discoveryGroupCounts = useMemo(
    () => buildPublicMapGroupFilterCounts(discoveryItems),
    [discoveryItems]
  )
  const countItems = useMemo(
    () => [
      ...rankPublicMapListItems({
        favorites,
        items: discoveryItems.filter(
          (item) => item.itemType !== "external_resource" || !item.nonprofit
        ),
        query: deferredQuery,
      }),
      ...discoveryItems.filter(
        (item) => item.itemType === "external_resource" && item.nonprofit
      ),
    ],
    [deferredQuery, discoveryItems, favorites]
  )
  const groupCounts = useMemo(
    () => buildPublicMapGroupFilterCounts(countItems),
    [countItems]
  )
  const filteredItems = useMemo(
    () =>
      countItems.filter((item) =>
        publicMapItemMatchesGroupFilter({ activeGroup, item })
      ),
    [activeGroup, countItems]
  )
  const filteredOrganizations = filteredItems.flatMap((item) =>
    item.itemType === "platform_organization" ? [item.organization] : []
  )

  return {
    discoveryGroupCounts,
    filteredItems,
    filteredOrganizations,
    groupCounts,
  }
}
