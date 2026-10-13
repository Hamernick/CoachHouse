"use client"

import { ScrollArea } from "@/components/ui/scroll-area"
import { SidebarContent } from "@/components/ui/sidebar"
import type { ExternalResourceMapItem } from "@/lib/public-map/resource-map-items"
import type { PublicMapOrganization } from "@/lib/queries/public-map-index"
import type { ReactNode } from "react"

import { PublicMapOrganizationDetail } from "./organization-detail"
import type { PublicMapOrganizationCurationAction } from "./organization-detail-admin-actions"
import { OrganizationDetailPanelChrome } from "./organization-detail-shell-sections"
import { PublicMapResourceDetail } from "./resource-detail"
import type { PublicMapResourceCurationAction } from "./resource-detail-admin-actions"

type PublicMapRailDetailPanelProps = {
  canManageResourceMap?: boolean
  organizationCurationAction?: PublicMapOrganizationCurationAction
  organization: PublicMapOrganization
  favorites: string[]
  onBack: () => void
  onToggleFavorite: (orgId: string) => void
  showHeaderControls?: boolean
}

function PublicMapDrawerDetailScrollViewport({
  children,
}: {
  children: ReactNode
}) {
  return (
    <div
      data-public-map-sidebar-section="drawer-detail-scroll"
      className="h-full min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 [-webkit-overflow-scrolling:touch] [scrollbar-width:thin] sm:px-4"
    >
      <div className="box-border min-h-full w-full max-w-full min-w-0 pt-[var(--public-map-detail-top-inset,0px)] pb-[max(env(safe-area-inset-bottom),1rem)]">
        {children}
      </div>
    </div>
  )
}

export function PublicMapRailDetailPanel({
  canManageResourceMap = false,
  organizationCurationAction,
  organization,
  favorites,
  onBack,
  onToggleFavorite,
  showHeaderControls = true,
}: PublicMapRailDetailPanelProps) {
  return (
    <SidebarContent className="h-full min-h-0 overflow-hidden bg-transparent pt-0 pb-0">
      {showHeaderControls ? (
        <OrganizationDetailPanelChrome
          canManageResourceMap={canManageResourceMap}
          className="shrink-0 px-5"
          organizationCurationAction={organizationCurationAction}
          organization={organization}
          favorites={favorites}
          onBack={onBack}
          onToggleFavorite={onToggleFavorite}
        />
      ) : null}
      <ScrollArea
        data-public-map-sidebar-section="rail-detail-scroll"
        className="h-full min-h-0 flex-1 overflow-hidden px-1 pr-3.5"
        viewportClassName="scroll-fade-effect-y [--mask-height:1.5rem] [--scroll-buffer:1rem] [&>div]:!block [&>div]:!min-w-0 [&>div]:!w-full [&>div]:!max-w-full"
        contentClassName="pb-3 pr-1"
      >
        <PublicMapOrganizationDetail organization={organization} />
      </ScrollArea>
    </SidebarContent>
  )
}

export function PublicMapResourceRailDetailPanel({
  canManageResourceMap = false,
  collected = false,
  item,
  onBack,
  onToggleCollected,
  resourceMapCurationAction,
}: {
  canManageResourceMap?: boolean
  collected?: boolean
  item: ExternalResourceMapItem
  onBack: () => void
  onToggleCollected?: (resourceId: string) => void
  resourceMapCurationAction?: PublicMapResourceCurationAction
}) {
  return (
    <SidebarContent className="h-full min-h-0 overflow-hidden bg-transparent pt-0 pb-0">
      <ScrollArea
        data-public-map-sidebar-section="rail-detail-scroll"
        className="h-full min-h-0 flex-1 overflow-hidden px-1 pr-3.5"
        viewportClassName="scroll-fade-effect-y [--mask-height:1.5rem] [--scroll-buffer:1rem] [&>div]:!block [&>div]:!min-w-0 [&>div]:!w-full [&>div]:!max-w-full"
        contentClassName="pb-3 pr-1"
      >
        <PublicMapResourceDetail
          canManageResourceMap={canManageResourceMap}
          collected={collected}
          item={item}
          onBack={onBack}
          onToggleCollected={onToggleCollected}
          resourceMapCurationAction={resourceMapCurationAction}
        />
      </ScrollArea>
    </SidebarContent>
  )
}

type PublicMapDrawerDetailPanelProps = {
  canManageResourceMap?: boolean
  organizationCurationAction?: PublicMapOrganizationCurationAction
  organization: PublicMapOrganization
  favorites: string[]
  drawerBodyScrollable?: boolean
  onBack: () => void
  onToggleFavorite: (orgId: string) => void
  showHeaderControls?: boolean
}

export function PublicMapDrawerDetailPanel({
  canManageResourceMap = false,
  organizationCurationAction,
  organization,
  favorites,
  onBack,
  onToggleFavorite,
  showHeaderControls = true,
}: PublicMapDrawerDetailPanelProps) {
  return (
    <PublicMapDrawerDetailScrollViewport>
      <div className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 mx-auto w-full max-w-3xl motion-safe:duration-200">
        {showHeaderControls ? (
          <OrganizationDetailPanelChrome
            canManageResourceMap={canManageResourceMap}
            className="px-4 pt-3 sm:px-6"
            organizationCurationAction={organizationCurationAction}
            organization={organization}
            favorites={favorites}
            onBack={onBack}
            onToggleFavorite={onToggleFavorite}
          />
        ) : null}
        <PublicMapOrganizationDetail organization={organization} compact />
      </div>
    </PublicMapDrawerDetailScrollViewport>
  )
}

export function PublicMapResourceDrawerDetailPanel({
  canManageResourceMap = false,
  collected = false,
  item,
  onBack,
  onToggleCollected,
  resourceMapCurationAction,
}: {
  canManageResourceMap?: boolean
  collected?: boolean
  item: ExternalResourceMapItem
  drawerBodyScrollable?: boolean
  onBack: () => void
  onToggleCollected?: (resourceId: string) => void
  resourceMapCurationAction?: PublicMapResourceCurationAction
}) {
  return (
    <PublicMapDrawerDetailScrollViewport>
      <div className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 mx-auto w-full max-w-3xl motion-safe:duration-200">
        <PublicMapResourceDetail
          canManageResourceMap={canManageResourceMap}
          collected={collected}
          item={item}
          onBack={onBack}
          onToggleCollected={onToggleCollected}
          resourceMapCurationAction={resourceMapCurationAction}
          compact
        />
      </div>
    </PublicMapDrawerDetailScrollViewport>
  )
}
