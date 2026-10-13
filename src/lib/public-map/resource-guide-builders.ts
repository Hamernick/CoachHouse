import {
  resolvePublicMapItemSelectableId,
  type PublicMapItem,
} from "@/lib/public-map/resource-map-items"
import {
  PUBLIC_MAP_FEATURED_RESOURCE_GUIDE_IDS,
  type PublicMapResourceGuideId,
} from "@/lib/public-map/resource-guide-ids"

import {
  PUBLIC_MAP_RESOURCE_GUIDE_DEFINITIONS,
  PUBLIC_MAP_RESOURCE_GUIDE_IMAGE_URLS,
  type PublicMapResourceGuide,
  type PublicMapResourceGuideDefinition,
} from "./resource-guide-definitions"

function buildGuideItems({
  definition,
  items,
}: {
  definition: PublicMapResourceGuideDefinition
  items: PublicMapItem[]
}) {
  const seenIds = new Set<string>()
  const guideItems: PublicMapItem[] = []

  for (const item of items) {
    if (!definition.matches(item)) continue
    const selectableId = resolvePublicMapItemSelectableId(item)
    if (seenIds.has(selectableId)) continue
    seenIds.add(selectableId)
    guideItems.push(item)
  }

  return guideItems.sort((a, b) => a.title.localeCompare(b.title))
}

export function buildPublicMapResourceGuides(
  items: PublicMapItem[]
): PublicMapResourceGuide[] {
  return PUBLIC_MAP_RESOURCE_GUIDE_DEFINITIONS.flatMap((definition) => {
    const guideItems = buildGuideItems({ definition, items })
    const minItems = definition.minItems ?? 1
    if (guideItems.length < minItems) return []

    return [
      {
        id: definition.id,
        title: definition.title,
        subtitle: definition.subtitle,
        kicker: definition.kicker,
        itemCount: guideItems.length,
        items: guideItems,
        imageUrl: PUBLIC_MAP_RESOURCE_GUIDE_IMAGE_URLS[definition.id] ?? null,
        primaryResourceCategory:
          definition.primaryResourceCategory ?? "emergency_cooling_centers",
        visualVariant: definition.visualVariant,
        available: true,
      } satisfies PublicMapResourceGuide,
    ]
  })
}

export function filterPublicMapFeaturedResourceGuides(
  guides: PublicMapResourceGuide[]
) {
  const guideById = new Map(guides.map((guide) => [guide.id, guide]))
  return PUBLIC_MAP_FEATURED_RESOURCE_GUIDE_IDS.flatMap((guideId) => {
    const guide = guideById.get(guideId)
    return guide ? [guide] : []
  })
}

export function buildPublicMapSavedResourceGuides({
  guides,
  savedGuideIds,
}: {
  guides: PublicMapResourceGuide[]
  savedGuideIds: PublicMapResourceGuideId[]
}) {
  const guideById = new Map(guides.map((guide) => [guide.id, guide]))
  const definitionById = new Map(
    PUBLIC_MAP_RESOURCE_GUIDE_DEFINITIONS.map((definition) => [
      definition.id,
      definition,
    ])
  )

  return savedGuideIds.flatMap((guideId) => {
    const guide = guideById.get(guideId)
    if (guide) return [guide]
    const definition = definitionById.get(guideId)
    if (!definition) return []

    return [
      {
        id: definition.id,
        title: definition.title,
        subtitle: definition.subtitle,
        kicker: definition.kicker,
        itemCount: 0,
        items: [],
        imageUrl: PUBLIC_MAP_RESOURCE_GUIDE_IMAGE_URLS[definition.id] ?? null,
        primaryResourceCategory:
          definition.primaryResourceCategory ?? "emergency_cooling_centers",
        visualVariant: definition.visualVariant,
        available: false,
      } satisfies PublicMapResourceGuide,
    ]
  })
}

export function buildPublicMapResourceGuideHref(
  guideId: PublicMapResourceGuideId
) {
  const params = new URLSearchParams({ guide: guideId })
  return `/?${params.toString()}`
}
