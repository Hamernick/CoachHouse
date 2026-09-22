import type { PublicMapResourceCategoryKey } from "./resource-categories"
import type {
  ExternalResourceMapItem,
  PublicMapItem,
} from "./resource-map-items"

const COOLING_CATEGORY = "emergency_cooling_centers"
const HEAT_TEXT =
  /\b(?:cooling cent(?:er|re)s?|cooling sites?|heat relief|warming cent(?:er|re)s?)\b/i
const NORMAL_CATEGORY_HINTS: [RegExp, PublicMapResourceCategoryKey][] = [
  [/\blibrar(?:y|ies)\b/i, "community_libraries"],
  [/\b(?:senior|older adult|oac)\b/i, "health_senior_health"],
  [
    /\b(?:park|playground|recreation|pool|spray shower|sprayground|fountain)\b/i,
    "community_recreation",
  ],
  [/\b(?:college|university|school)\b/i, "education"],
]
const normalItemCache = new WeakMap<
  ExternalResourceMapItem,
  ExternalResourceMapItem | null
>()

/** Only the existing weather gate activates a cooling-center presentation. */
export function shouldShowPublicMapCoolingCenters(signal: string | null | undefined) {
  return signal === "official_alert" || signal === "forecast_threshold"
}

function normalResourceTitle(title: string) {
  return title
    .replace(
      /^(?:warming\s+(?:and|&)\s+)?cooling(?:\s+(?:and|&)\s+warming)?\s+(?:cent(?:er|re)s?|sites?)\s*(?:[|:\-–—]\s*)?/i,
      ""
    )
    .replace(
      /\s*(?:[|:\-–—]\s*)?(?:warming\s+(?:and|&)\s+)?cooling(?:\s+(?:and|&)\s+warming)?\s+(?:cent(?:er|re)s?|sites?)\s*$/i,
      ""
    )
    .replace(
      /\s+(?:warming\s+(?:and|&)\s+)?cooling(?:\s+(?:and|&)\s+warming)?\s+(?:cent(?:er|re)s?|sites?)(?=\s*[|:\-–—])/gi,
      ""
    )
    .trim()
}

function normalResourceCategories(
  item: ExternalResourceMapItem,
  title: string
) {
  const categories = item.resourceCategories.filter(
    (category) =>
      category !== COOLING_CATEGORY &&
      category !== "emergency_warming_centers" &&
      category !== "emergency"
  )
  const specific = categories.filter(
    (category) => category.includes("_") && category !== "environment"
  )
  const facilityCategory =
    specific[0] ??
    NORMAL_CATEGORY_HINTS.find(([pattern]) => pattern.test(title))?.[1]
  const ordinary = categories.filter((category) => category !== "environment")
  const primary =
    facilityCategory ?? ordinary[0] ?? categories[0] ?? "community"
  return [...new Set([primary, ...ordinary])] as PublicMapResourceCategoryKey[]
}

/** One stable resource ID; seasonal presentation never changes source records. */
export function resolvePublicMapResourcePresentation(
  item: ExternalResourceMapItem,
  showCoolingCenters: boolean
): ExternalResourceMapItem | null {
  if (showCoolingCenters || !item.resourceCategories.includes(COOLING_CATEGORY))
    return item
  const cached = normalItemCache.get(item)
  if (cached !== undefined) return cached

  const title = normalResourceTitle(item.title)
  // A heat-only location needs an identified ordinary place before it can have
  // a normal listing. Do not manufacture a service from its cooling role.
  if (!title || /^(?:in\s+|heat relief\b)/i.test(title)) {
    normalItemCache.set(item, null)
    return null
  }
  const resourceCategories = normalResourceCategories(item, title)
  const normalItem: ExternalResourceMapItem = {
    ...item,
    title,
    // Keep the source name discoverable without presenting its seasonal role.
    aliases: [...new Set([...(item.aliases ?? []), item.title])],
    subtitle:
      item.subtitle && !HEAT_TEXT.test(item.subtitle) && item.subtitle !== title
        ? item.subtitle
        : null,
    description:
      item.description && !HEAT_TEXT.test(item.description)
        ? item.description
        : null,
    resourceCategories,
    primaryResourceCategory: resourceCategories[0] ?? "community",
    seasonalPresentation: "normal",
    weatherEligible: false,
    // Cooling opening hours and heat-event status do not establish normal hours.
    availability: undefined,
    hoursLabel: null,
    services: item.services?.filter(
      (service) =>
        !HEAT_TEXT.test(`${service.title} ${service.description ?? ""}`)
    ),
  }
  normalItemCache.set(item, normalItem)
  return normalItem
}

export function resolvePublicMapItemPresentations(
  items: PublicMapItem[],
  showCoolingCenters: boolean
) {
  return items.flatMap<PublicMapItem>((item) => {
    if (item.itemType !== "external_resource") return [item]
    const presentation = resolvePublicMapResourcePresentation(
      item,
      showCoolingCenters
    )
    return presentation ? [presentation] : []
  })
}

export function resolvePublicMapResourceDetailPresentation(
  indexItem: ExternalResourceMapItem,
  detailItem: ExternalResourceMapItem
) {
  if (
    indexItem.seasonalPresentation !== "normal" &&
    detailItem.seasonalPresentation === "normal"
  )
    return indexItem
  return indexItem.seasonalPresentation === "normal"
    ? (resolvePublicMapResourcePresentation(detailItem, false) ?? indexItem)
    : detailItem
}
