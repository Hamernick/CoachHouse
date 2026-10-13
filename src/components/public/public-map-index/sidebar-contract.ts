import type { ExternalResourceMapItem } from "@/lib/public-map/resource-map-items"
import type { PublicMapOrganization } from "@/lib/queries/public-map-index"

import type {
  PublicMapGroupFilterCounts,
  PublicMapGroupFilterKey,
} from "./category-filter"
import type { SidebarMode } from "./constants"
import type { PublicMapListItem } from "./map-items-state"
import type { PublicMapPanelPresentation } from "./map-view-helpers"
import type { PublicMapOrganizationCurationAction } from "./organization-detail-admin-actions"
import type { PublicMapResourceCurationAction } from "./resource-detail-admin-actions"
import type { PublicMapResourceGuide } from "./resource-guides"
import type { PublicMapResourceGuideId } from "@/lib/public-map/resource-guide-ids"
import type { PublicMapSidebarSearchContext } from "./sidebar-panels"
import type { PublicMapResourceItemsLoadStatus } from "./use-resource-map-items"

type OpenDetailsOptions = { preserveSearchContext?: boolean }
type OpenDetails = (orgId: string, options?: OpenDetailsOptions) => void

export const noopPublicMapSidebarAction = () => undefined

export type PublicMapSidebarProps = {
  inline?: boolean
  sidebarMode: SidebarMode
  sidebarWidth: number
  surfaceHeight: number
  panelPresentation: PublicMapPanelPresentation
  portalContainer: HTMLElement | null
  filteredItems: PublicMapListItem[]
  filteredOrganizations: PublicMapOrganization[]
  selectedItemId: string | null
  selectedOrganization: PublicMapOrganization | null
  selectedResourceItem?: ExternalResourceMapItem | null
  canManageResourceMap?: boolean
  organizationCurationAction?: PublicMapOrganizationCurationAction
  resourceMapCurationAction?: PublicMapResourceCurationAction
  favorites: string[]
  collectedResourceIds?: string[]
  guides?: PublicMapResourceGuide[]
  featuredGuides?: PublicMapResourceGuide[]
  savedGuideIds?: PublicMapResourceGuideId[]
  savedGuides?: PublicMapResourceGuide[]
  savedOrganizations?: PublicMapOrganization[]
  savedResources?: ExternalResourceMapItem[]
  unresolvedCollectedResourceCount?: number
  query: string
  activeGroup: PublicMapGroupFilterKey
  discoveryGroupCounts?: PublicMapGroupFilterCounts
  groupCounts: PublicMapGroupFilterCounts
  resourceItemsLoadStatus?: PublicMapResourceItemsLoadStatus
  resourceItemsLoadError?: string | null
  searchPending?: boolean
  searchContext?: PublicMapSidebarSearchContext | null
  setQuery: (value: string) => void
  setActiveGroup: (group: PublicMapGroupFilterKey) => void
  retryResourceItems?: () => void
  toggleFavorite: (orgId: string) => void
  toggleCollectedResource?: (resourceId: string) => void
  onSelectItem: (itemId: string) => void
  onGuideSelect?: (guideId: string) => void
  onToggleSavedGuide?: (guideId: PublicMapResourceGuideId) => void
  onSelectOrganization: (organizationId: string) => void
  onOpenDetails: OpenDetails
  onBackToSearch: () => void
  onDrawerInsetChange?: (value: number) => void
  setSidebarMode: (mode: SidebarMode) => void
}
