import type { PublicMapOrganization } from "@/lib/queries/public-map-index"

import type { PublicMapResourceAvailability } from "./resource-availability"
import { createPublicMapCategoryAliasMatcher } from "./resource-category-alias-matching"
import type { PublicMapGroupKey } from "./groups"
import {
  PUBLIC_MAP_RESOURCE_CATEGORY_DEFINITIONS,
  isPublicMapResourceTopLevelCategoryKey,
  publicMapResourceCategoryMatchesTopLevel,
  resolvePublicMapResourceCategoryColor,
  resolvePublicMapResourceTopLevelCategory,
  type PublicMapResourceCategoryKey,
  type PublicMapResourceTopLevelCategoryKey,
} from "./resource-categories"
import { buildPublicMapSuperadminResourceSeedItems } from "./resource-seed-items"

export type PublicMapItemType = "platform_organization" | "external_resource"

export type PublicMapVerificationStatus =
  | "verified_platform"
  | "external_data"
  | "pending_review"

export type PublicMapItemVisibility = "published" | "superadmin_preview"

export type PublicMapResourceDeliveryMode =
  | "in_person"
  | "online"
  | "phone"
  | "hybrid"
  | "mobile"

export type PublicMapResourceLinkType =
  | "website"
  | "donate"
  | "intake"
  | "apply"
  | "referral"
  | "resource"
  | "calendar"
  | "social"
  | "source"
  | "other"

export type PublicMapResourceContactType =
  | "email"
  | "phone"
  | "sms"
  | "whatsapp"
  | "contact_form"
  | "person"
  | "other"

export type PublicMapResourceLink = {
  id: string
  label: string
  url: string
  type: PublicMapResourceLinkType
  domain: string | null
  isPrimary?: boolean
}

export type PublicMapResourceContact = {
  id: string
  label: string | null
  value: string
  type: PublicMapResourceContactType
  url: string | null
  isPrimary?: boolean
}

export type PublicMapResourceServiceSummary = {
  id: string
  title: string
  description: string | null
  whoItHelps?: string | null
  eligibility?: string | null
  cost?: string | null
  languages?: string[]
  intakeUrl?: string | null
  appointmentInfo?: string | null
  documentsNeeded?: string[]
  accessibilityNotes?: string | null
  urgentAvailability?: string | null
  availability?: PublicMapResourceAvailability
  ageRange?: string | null
  serviceArea?: string[]
  deliveryModes?: PublicMapResourceDeliveryMode[]
}

type PublicMapBaseItem = {
  id: string
  itemType: PublicMapItemType
  title: string
  subtitle: string | null
  description: string | null
  latitude: number | null
  longitude: number | null
  address: string | null
  addressStreet: string | null
  city: string | null
  state: string | null
  country: string | null
  orgCategory: PublicMapGroupKey | null
  resourceCategories: PublicMapResourceCategoryKey[]
  primaryResourceCategory: PublicMapResourceCategoryKey
  verificationStatus: PublicMapVerificationStatus
  sourceLabel: string | null
  sourceUrl: string | null
  lastVerifiedAt: string | null
  visibility: PublicMapItemVisibility
  weatherEligible?: boolean
  markerImageUrl?: string | null
  logoUrl?: string | null
  faviconUrl?: string | null
  mission?: string | null
  vision?: string | null
  values?: string[] | null
  aliases?: string[]
  deliveryModes?: PublicMapResourceDeliveryMode[]
  hoursLabel?: string | null
  availability?: PublicMapResourceAvailability
  lastUpdatedAt?: string | null
  links?: PublicMapResourceLink[]
  contacts?: PublicMapResourceContact[]
  services?: PublicMapResourceServiceSummary[]
}

export type PlatformOrganizationMapItem = PublicMapBaseItem & {
  itemType: "platform_organization"
  organization: PublicMapOrganization
  orgCategory: PublicMapGroupKey
  verificationStatus: "verified_platform"
  visibility: "published"
}

export type ExternalResourceMapItem = PublicMapBaseItem & {
  itemType: "external_resource"
  organization?: never
  orgCategory: null
  seasonalPresentation?: "normal"
  resourceOrganizationId?: string | null
  verificationStatus: PublicMapVerificationStatus
}

export type PublicMapItem =
  | PlatformOrganizationMapItem
  | ExternalResourceMapItem

type PublicMapGroupFilterKey = PublicMapResourceCategoryKey | "all"

const GROUP_RESOURCE_CATEGORY_FALLBACKS: Record<
  PublicMapGroupKey,
  PublicMapResourceCategoryKey
> = {
  education: "education",
  community: "community",
  health: "health",
  housing: "housing",
  funding: "finance",
  workforce: "employment",
  climate: "environment",
  global: "international",
}

function normalizeSearchText(value: string | null | undefined) {
  return typeof value === "string" ? value.trim().toLowerCase() : ""
}

function buildOrganizationResourceCorpus(organization: PublicMapOrganization) {
  return [
    organization.name,
    organization.tagline,
    organization.description,
    organization.mission,
    organization.needStatement,
    organization.website,
    organization.locationUrl,
    ...organization.groups,
    ...organization.activityLinks.flatMap((activity) => [
      activity.title,
      activity.subtitle,
      activity.description,
      activity.activityKind,
      activity.locationUrl,
      activity.ctaUrl,
      ...activity.chips,
    ]),
  ]
    .map(normalizeSearchText)
    .filter(Boolean)
    .join(" ")
}

export function inferPublicMapResourceCategoriesForOrganization(
  organization: PublicMapOrganization
): PublicMapResourceCategoryKey[] {
  const detected = new Set<PublicMapResourceCategoryKey>()
  const corpus = buildOrganizationResourceCorpus(organization)
  const matchesAlias = createPublicMapCategoryAliasMatcher(corpus)

  for (const category of PUBLIC_MAP_RESOURCE_CATEGORY_DEFINITIONS) {
    if (category.aliases.some(matchesAlias)) {
      detected.add(category.key)
      detected.add(resolvePublicMapResourceTopLevelCategory(category.key))
    }
  }

  if (detected.size === 0) {
    detected.add(GROUP_RESOURCE_CATEGORY_FALLBACKS[organization.primaryGroup])
  }

  return [...detected]
}

export function buildPlatformOrganizationMapItem(
  organization: PublicMapOrganization
): PlatformOrganizationMapItem {
  const resourceCategories =
    inferPublicMapResourceCategoriesForOrganization(organization)
  const primaryResourceCategory = resourceCategories[0] ?? "community"

  return {
    id: `platform_organization:${organization.id}`,
    itemType: "platform_organization",
    title: organization.name,
    subtitle: organization.tagline,
    description: organization.description,
    latitude: organization.latitude,
    longitude: organization.longitude,
    address: organization.address,
    addressStreet: organization.addressStreet,
    city: organization.city,
    state: organization.state,
    country: organization.country,
    orgCategory: organization.primaryGroup,
    resourceCategories,
    primaryResourceCategory,
    verificationStatus: "verified_platform",
    sourceLabel: "Coach House organization profile",
    sourceUrl: organization.publicSlug
      ? `/${encodeURIComponent(organization.publicSlug)}`
      : null,
    lastVerifiedAt: null,
    visibility: "published",
    markerImageUrl:
      organization.logoUrl ??
      organization.brandMarkUrl ??
      organization.headerUrl,
    organization,
  }
}

export function buildPublicMapItems({
  organizations,
  includeSeedItems = false,
  resourceItems = [],
}: {
  organizations: PublicMapOrganization[]
  includeSeedItems?: boolean
  resourceItems?: ExternalResourceMapItem[]
}): PublicMapItem[] {
  const organizationItems = organizations.map(buildPlatformOrganizationMapItem)
  const publishedItems = [...organizationItems, ...resourceItems]
  if (!includeSeedItems || resourceItems.length > 0) return publishedItems
  return [
    ...publishedItems,
    ...buildPublicMapSuperadminResourceSeedItems(organizations),
  ]
}

export function publicMapItemMatchesGroupFilter({
  activeGroup,
  item,
}: {
  activeGroup: PublicMapGroupFilterKey
  item: PublicMapItem
}) {
  if (activeGroup === "all") return true

  if (isPublicMapResourceTopLevelCategoryKey(activeGroup)) {
    return item.resourceCategories.some((category) =>
      publicMapResourceCategoryMatchesTopLevel({
        category,
        topLevelCategory: activeGroup,
      })
    )
  }

  return item.resourceCategories.includes(activeGroup)
}

export function resolvePublicMapItemMarkerColor(item: PublicMapItem) {
  return resolvePublicMapResourceCategoryColor(item.primaryResourceCategory)
}

export function resolvePublicMapItemSelectableId(item: PublicMapItem) {
  return item.itemType === "platform_organization"
    ? item.organization.id
    : item.id
}
