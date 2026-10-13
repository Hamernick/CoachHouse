import { resolvePublicMapItemSelectableId, type PublicMapItem, type ExternalResourceMapItem } from "@/lib/public-map/resource-map-items"
import {
  PUBLIC_MAP_RESOURCE_CATEGORY_DEFINITIONS,
  PUBLIC_MAP_RESOURCE_CATEGORY_LABELS,
  type PublicMapResourceCategoryKey,
} from "@/lib/public-map/resource-categories"
import {
  normalizePublicMapSearchText,
  scorePublicMapSearchFields,
  type PublicMapWeightedSearchField,
} from "./resource-search-text"

type PublicMapListItem = PublicMapItem

function buildPublicMapResourceCategorySearchText(
  categories: PublicMapResourceCategoryKey[] | null | undefined
) {
  return (categories ?? [])
    .flatMap((category) => {
      const definition = PUBLIC_MAP_RESOURCE_CATEGORY_DEFINITIONS.find(
        (candidate) => candidate.key === category
      )
      return definition
        ? [definition.label, ...definition.aliases]
        : [PUBLIC_MAP_RESOURCE_CATEGORY_LABELS[category]]
    })
    .join(" ")
}

function normalizePublicMapListEnumSearchText(
  value: string | null | undefined
) {
  return normalizePublicMapSearchText(value?.replaceAll("_", " "))
}

type PublicMapListSearchDocument = {
  fields: PublicMapWeightedSearchField[]
  sortName: string
}

const publicMapListItemSearchDocumentCache = new WeakMap<
  PublicMapListItem,
  PublicMapListSearchDocument
>()

function buildPublicMapListItemSearchDocument(item: PublicMapListItem) {
  const cached = publicMapListItemSearchDocumentCache.get(item)
  if (cached !== undefined) return cached

  const fields: PublicMapWeightedSearchField[] = [
    { text: normalizePublicMapSearchText(item.title), weight: 0 },
    {
      text: normalizePublicMapSearchText(
        [item.subtitle, ...(item.aliases ?? [])].filter(Boolean).join(" ")
      ),
      weight: 1,
    },
    {
      text: normalizePublicMapSearchText(
        (item.services ?? []).map((service) => service.title).join(" ")
      ),
      weight: 1,
    },
    {
      text: normalizePublicMapSearchText(
        buildPublicMapResourceCategorySearchText(item.resourceCategories)
      ),
      weight: 2,
    },
    {
      text: normalizePublicMapSearchText(
        [item.address, item.addressStreet, item.city, item.state, item.country]
          .filter(Boolean)
          .join(" ")
      ),
      weight: 3,
    },
    {
      text: normalizePublicMapSearchText(
        [item.description, item.mission, item.vision, ...(item.values ?? [])]
          .filter(Boolean)
          .join(" ")
      ),
      weight: 4,
    },
    {
      text: normalizePublicMapSearchText(
        (item.services ?? [])
          .flatMap((service) => [
            service.description,
            service.whoItHelps,
            service.eligibility,
            service.appointmentInfo,
            service.urgentAvailability,
          ])
          .filter(Boolean)
          .join(" ")
      ),
      weight: 4,
    },
    {
      text: normalizePublicMapSearchText(
        [
          item.sourceLabel,
          normalizePublicMapListEnumSearchText(item.verificationStatus),
          normalizePublicMapListEnumSearchText(item.visibility),
        ]
          .filter(Boolean)
          .join(" ")
      ),
      weight: 5,
    },
  ]

  if (item.itemType === "platform_organization") {
    const organization = item.organization
    fields.push(
      {
        text: normalizePublicMapSearchText(
          [
            organization.needStatement,
            organization.originStory,
            organization.theoryOfChange,
          ]
            .filter(Boolean)
            .join(" ")
        ),
        weight: 4,
      },
      {
        text: normalizePublicMapSearchText(
          organization.activityLinks
            .flatMap((activity) => [
              activity.title,
              activity.subtitle,
              activity.description,
              activity.activityKind,
              ...activity.chips,
            ])
            .filter(Boolean)
            .join(" ")
        ),
        weight: 1,
      }
    )
  }

  const document = {
    fields: fields.filter((field) => field.text.length > 0),
    sortName: normalizePublicMapSearchText(item.title),
  }
  publicMapListItemSearchDocumentCache.set(item, document)
  return document
}

export function warmPublicMapListItemSearchCache(
  items: ExternalResourceMapItem[]
) {
  for (const item of items) {
    buildPublicMapListItemSearchDocument(item)
  }
}

const PUBLIC_MAP_LIST_ITEM_COLLATOR = new Intl.Collator(undefined, {
  sensitivity: "base",
})

export function rankPublicMapListItems({
  favorites = [],
  items,
  query,
}: {
  favorites?: string[]
  items: PublicMapListItem[]
  query: string
}) {
  const favoriteIds = new Set(favorites)
  return items
    .map((item) => ({
      document: buildPublicMapListItemSearchDocument(item),
      item,
      score: scorePublicMapSearchFields({
        fields: buildPublicMapListItemSearchDocument(item).fields,
        query,
      }),
    }))
    .filter((entry) => Number.isFinite(entry.score))
    .sort((left, right) => {
      if (left.score !== right.score) return left.score - right.score

      const leftFavorite = favoriteIds.has(
        resolvePublicMapItemSelectableId(left.item)
      )
      const rightFavorite = favoriteIds.has(
        resolvePublicMapItemSelectableId(right.item)
      )
      if (leftFavorite !== rightFavorite) return leftFavorite ? -1 : 1

      return PUBLIC_MAP_LIST_ITEM_COLLATOR.compare(
        left.document.sortName,
        right.document.sortName
      )
    })
    .map((entry) => entry.item)
}

export function publicMapListItemMatchesQuery({
  item,
  query,
}: {
  item: PublicMapListItem
  query: string
}) {
  return Number.isFinite(
    scorePublicMapSearchFields({
      fields: buildPublicMapListItemSearchDocument(item).fields,
      query,
    })
  )
}

