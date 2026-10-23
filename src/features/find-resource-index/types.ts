import type {
  ExternalResourceMapItem,
  PublicMapItemVisibility,
  PublicMapVerificationStatus,
} from "@/lib/public-map/resource-map-items"
import type { PublicMapResourceCategoryKey } from "@/lib/public-map/resource-categories"
import type { PublicMapResourceAvailabilityStatus } from "@/lib/public-map/resource-availability"

export type FindResourceIndexAvailability = {
  status: PublicMapResourceAvailabilityStatus
  statusLabel: string
  openNow: boolean | null
}

export type FindResourceIndexItem = {
  id: string
  relatedResourceIds?: string[]
  itemType: "external_resource"
  title: string
  subtitle: string | null
  latitude: number | null
  longitude: number | null
  addressStreet?: string | null
  city: string | null
  state: string | null
  country: string | null
  resourceCategories: PublicMapResourceCategoryKey[]
  primaryResourceCategory: PublicMapResourceCategoryKey
  verificationStatus: PublicMapVerificationStatus
  visibility: PublicMapItemVisibility
  weatherEligible?: boolean
  markerImageUrl?: string | null
  availability?: FindResourceIndexAvailability
}

export type FindResourceIndexResponse = {
  version: 2
  resourceItems: FindResourceIndexItem[]
  page: {
    hasMore: boolean
    limit: number
    nextCursor: string | null
    totalCount: number
  }
}

export type FindResourceDetailResponse = {
  version: 1
  resourceItem: ExternalResourceMapItem
}
