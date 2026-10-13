import type { ExternalResourceMapItem } from "@/lib/public-map/resource-map-items"
import type { PublicMapOrganization } from "@/lib/queries/public-map-index"

import type { PublicMapIndexPresentationMode } from "./presentation-mode"
import type {
  PublicMapAdminOnboardingPreviewConfig,
  PublicMapMemberOnboardingConfig,
} from "./member-onboarding-preview-controls"
import type { PublicMapOrganizationCurationAction } from "./organization-detail-admin-actions"
import type { PublicMapResourceCurationAction } from "./resource-detail-admin-actions"

export type PublicMapIndexProps = {
  embedded?: boolean
  organizations: PublicMapOrganization[]
  mapboxToken?: string
  initialPublicSlug?: string
  initialResource?: ExternalResourceMapItem
  viewer?: { id: string; email: string | null; displayName?: string | null; avatarUrl?: string | null } | null
  includeSeedResources?: boolean
  resourceItems?: ExternalResourceMapItem[]
  resourceItemsEndpoint?: string
  canManageResourceMap?: boolean
  organizationCurationAction?: PublicMapOrganizationCurationAction
  resourceMapCurationAction?: PublicMapResourceCurationAction
  presentationMode?: PublicMapIndexPresentationMode
  memberOnboarding?: PublicMapMemberOnboardingConfig
  adminOnboardingPreview?: PublicMapAdminOnboardingPreviewConfig
}
