import {
  useCallback,
  useMemo,
  useRef,
  type Dispatch,
  type SetStateAction,
} from "react"

import type { PublicMapOrganization } from "@/lib/queries/public-map-index"
import {
  buildPublicMapItems,
  publicMapItemMatchesGroupFilter,
  resolvePublicMapItemSelectableId,
  type ExternalResourceMapItem,
  type PublicMapItem,
} from "@/lib/public-map/resource-map-items"
import type { PublicMapResourceCategoryKey } from "@/lib/public-map/resource-categories"
import { rankPublicMapListItems } from "./resource-search"
export { rankPublicMapListItems, publicMapListItemMatchesQuery, warmPublicMapListItemSearchCache } from "./resource-search"

type PublicMapGroupFilterKey = PublicMapResourceCategoryKey | "all"

export type PublicMapListItem = PublicMapItem

export function buildPublicMapSelectableItemMap(items: PublicMapItem[]) {
  return new Map(
    items.map((item) => [resolvePublicMapItemSelectableId(item), item] as const)
  )
}

export function usePublicMapSelectableItemMap(items: PublicMapItem[], additionalItems?: PublicMapItem[]) {
  return useMemo(() => buildPublicMapSelectableItemMap(additionalItems ? [...items, ...additionalItems] : items), [items, additionalItems])
}


export function buildPublicMapListItems({
  items,
  query,
}: {
  items: PublicMapItem[]
  query: string
}): PublicMapListItem[] {
  return rankPublicMapListItems({ items, query })
}

export function usePublicMapListItems({
  items,
  query,
}: {
  items: PublicMapItem[]
  query: string
}) {
  return useMemo(
    () => buildPublicMapListItems({ items, query }),
    [items, query]
  )
}

export function resolvePublicMapListItemsFromSelectableIds({
  itemBySelectableId,
  selectableIds,
}: {
  itemBySelectableId: Map<string, PublicMapItem>
  selectableIds: string[]
}): PublicMapListItem[] {
  return selectableIds
    .map((selectableId) => itemBySelectableId.get(selectableId) ?? null)
    .filter((item): item is PublicMapListItem => item !== null)
}

export function buildFilteredPublicMapItems({
  activeGroup,
  filteredOrganizations,
  includeSeedResources,
  resourceItems = [],
}: {
  activeGroup: PublicMapGroupFilterKey
  filteredOrganizations: PublicMapOrganization[]
  includeSeedResources: boolean
  resourceItems?: ExternalResourceMapItem[]
}) {
  const items = buildPublicMapItems({
    organizations: filteredOrganizations,
    includeSeedItems: includeSeedResources,
    resourceItems,
  })

  return items.filter((item) =>
    publicMapItemMatchesGroupFilter({ activeGroup, item })
  )
}

export function useFilteredPublicMapItems({
  activeGroup,
  filteredOrganizations,
  includeSeedResources,
  resourceItems = [],
}: {
  activeGroup: PublicMapGroupFilterKey
  filteredOrganizations: PublicMapOrganization[]
  includeSeedResources: boolean
  resourceItems?: ExternalResourceMapItem[]
}) {
  return useMemo(
    () =>
      buildFilteredPublicMapItems({
        activeGroup,
        filteredOrganizations,
        includeSeedResources,
        resourceItems,
      }),
    [activeGroup, filteredOrganizations, includeSeedResources, resourceItems]
  )
}

export function usePublicMapSavedOrganizations({
  favorites,
  organizationById,
}: {
  favorites: string[]
  organizationById: Map<string, PublicMapOrganization>
}) {
  return useMemo(
    () =>
      favorites
        .map((organizationId) => organizationById.get(organizationId) ?? null)
        .filter((organization): organization is PublicMapOrganization =>
          Boolean(organization)
        ),
    [favorites, organizationById]
  )
}

export function usePublicMapCollectedResources({
  collectedResourceIds,
  resourceItems,
  retainMissingResources,
  setCollectedResourceIds,
}: {
  collectedResourceIds: string[]
  resourceItems: ExternalResourceMapItem[]
  retainMissingResources: boolean
  setCollectedResourceIds: Dispatch<SetStateAction<string[]>>
}) {
  const retainedResourcesRef = useRef<ExternalResourceMapItem[]>([])
  const savedResources = useMemo(() => {
    const resolvedResources = resolvePublicMapCollectedResources({
      collectedResourceIds,
      resourceItems,
      retainedResources: retainMissingResources
        ? retainedResourcesRef.current
        : [],
    })
    retainedResourcesRef.current = resolvedResources
    return resolvedResources
  }, [collectedResourceIds, resourceItems, retainMissingResources])

  const toggleCollectedResource = useCallback(
    (resourceId: string) => {
      setCollectedResourceIds((current) =>
        current.includes(resourceId)
          ? current.filter((entry) => entry !== resourceId)
          : [resourceId, ...current].slice(0, 120)
      )
    },
    [setCollectedResourceIds]
  )

  return {
    savedResources,
    toggleCollectedResource,
    unresolvedCollectedResourceCount:
      collectedResourceIds.length - savedResources.length,
  }
}

export function resolvePublicMapCollectedResources({
  collectedResourceIds,
  resourceItems,
  retainedResources = [],
}: {
  collectedResourceIds: string[]
  resourceItems: ExternalResourceMapItem[]
  retainedResources?: ExternalResourceMapItem[]
}) {
  const collectedResourceIdSet = new Set(collectedResourceIds)
  const resourceById = new Map(
    retainedResources
      .filter((item) => collectedResourceIdSet.has(item.id))
      .map((item) => [item.id, item] as const)
  )
  for (const item of resourceItems) {
    if (collectedResourceIdSet.has(item.id)) resourceById.set(item.id, item)
  }

  return collectedResourceIds.flatMap((resourceId) => {
    const item = resourceById.get(resourceId)
    return item ? [item] : []
  })
}
