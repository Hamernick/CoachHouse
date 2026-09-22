import type { PublicMapItem } from "@/lib/public-map/resource-map-items"
import type { PublicMapResourceCategoryKey } from "@/lib/public-map/resource-categories"

function itemHasResourceCategory(
  item: PublicMapItem,
  categories: readonly PublicMapResourceCategoryKey[]
) {
  return categories.some((category) =>
    item.resourceCategories.some(
      (itemCategory) =>
        itemCategory === category || itemCategory.startsWith(`${category}_`)
    )
  )
}

const ESSENTIAL_RESOURCE_CATEGORIES = [
  "food",
  "housing",
  "health",
  "community_transportation",
  "community_internet_access",
  "community_device_access",
  "education_digital_literacy",
  "legal_identification_documentation",
  "finance_cash_assistance",
  "finance_benefits_enrollment",
  "finance_public_benefits",
  "emergency_emergency_shelter",
  "emergency_emergency_food",
  "emergency_emergency_cash",
] as const satisfies readonly PublicMapResourceCategoryKey[]

export const PUBLIC_MAP_GOAL_RESOURCE_GUIDE_DEFINITIONS = [
  {
    id: "essentials",
    title: "Basics",
    subtitle:
      "Food, shelter, health care, transportation, documents, and digital access.",
    kicker: "Start here",
    minItems: 1,
    primaryResourceCategory: "community",
    visualVariant: "community",
    matches: (item: PublicMapItem) =>
      itemHasResourceCategory(item, ESSENTIAL_RESOURCE_CATEGORIES),
  },
  {
    id: "transportation-access",
    title: "Transportation",
    subtitle: "Rides, transit support, and help getting where you need to go.",
    kicker: "Get around",
    minItems: 1,
    primaryResourceCategory: "community_transportation",
    visualVariant: "community",
    matches: (item: PublicMapItem) =>
      itemHasResourceCategory(item, ["community_transportation"]),
  },
  {
    id: "documents-and-id",
    title: "Documents & ID",
    subtitle: "Identification, records, applications, and enrollment help.",
    kicker: "Get prepared",
    minItems: 1,
    primaryResourceCategory: "legal_identification_documentation",
    visualVariant: "community",
    matches: (item: PublicMapItem) =>
      itemHasResourceCategory(item, [
        "legal_identification_documentation",
        "finance_benefits_enrollment",
      ]),
  },
  {
    id: "digital-access",
    title: "Digital Access",
    subtitle: "Internet, devices, digital skills, and online support.",
    kicker: "Get connected",
    minItems: 1,
    primaryResourceCategory: "community_internet_access",
    visualVariant: "community",
    matches: (item: PublicMapItem) =>
      itemHasResourceCategory(item, [
        "community_internet_access",
        "community_device_access",
        "education_digital_literacy",
      ]),
  },
] as const
