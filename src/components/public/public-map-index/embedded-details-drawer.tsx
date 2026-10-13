"use client"

import { useEffect, useMemo, useState } from "react"

import { PublicMapSidebarDrawer } from "./sidebar-drawer"
import { buildPublicMapDrawerSnapPoints, type PublicMapDrawerSnapPoints } from "./sidebar-snap-points"
import type { PublicMapSidebarProps } from "./sidebar-contract"
import { PublicMapDrawerDetailPanel, PublicMapResourceDrawerDetailPanel } from "./sidebar-detail-panels"

type EmbeddedDetailsProps = Pick<PublicMapSidebarProps,
  | "portalContainer" | "selectedOrganization" | "selectedResourceItem"
  | "favorites" | "collectedResourceIds" | "toggleFavorite"
  | "toggleCollectedResource" | "onBackToSearch" | "surfaceHeight"
  | "canManageResourceMap" | "organizationCurationAction" | "resourceMapCurationAction"
> & { open: boolean }

export function PublicMapEmbeddedDetailsDrawer({
  open,
  portalContainer,
  surfaceHeight,
  canManageResourceMap,
  organizationCurationAction,
  resourceMapCurationAction,
  selectedOrganization,
  selectedResourceItem,
  favorites,
  collectedResourceIds = [],
  toggleFavorite,
  toggleCollectedResource,
  onBackToSearch,
}: EmbeddedDetailsProps) {
  const [activeSnapIndex, setActiveSnapIndex] = useState<0 | 1 | 2>(2)
  const snapPoints = useMemo<PublicMapDrawerSnapPoints>(() => {
    // Keep the shared drawer stops inside short embedded screens, including landscape.
    if (surfaceHeight > 0 && surfaceHeight < 424) {
      return [`${Math.round(surfaceHeight * 0.35)}px`, `${Math.round(surfaceHeight * 0.7)}px`, 1]
    }
    return buildPublicMapDrawerSnapPoints(surfaceHeight)
  }, [surfaceHeight])
  const activeSnapPoint = snapPoints[activeSnapIndex]
  const drawerIsFullscreen = activeSnapIndex === 2

  useEffect(() => {
    setActiveSnapIndex(2)
  }, [open, selectedOrganization?.id, selectedResourceItem?.id])

  useEffect(() => {
    if (!open || !portalContainer) return
    portalContainer.parentElement?.scrollIntoView({
      block: "nearest",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    })
  }, [open, portalContainer])

  if (!portalContainer) return null

  return (
    <PublicMapSidebarDrawer
      autoFocus
      overlayResizeControl
      contentClassName={drawerIsFullscreen ? "data-[vaul-drawer-direction=bottom]:rounded-[inherit]" : undefined}
      activeSnapIndex={activeSnapIndex}
      activeSnapPoint={activeSnapPoint}
      drawerIsFullscreen={drawerIsFullscreen}
      drawerViewportHeight={typeof activeSnapPoint === "number" ? `${activeSnapPoint * 100}%` : activeSnapPoint}
      effectiveSidebarMode="details"
      panelOpen={open}
      portalContainer={portalContainer}
      setActiveSnapIndex={setActiveSnapIndex}
      setDrawerTab={() => undefined}
      setSidebarMode={(mode) => { if (mode !== "details") onBackToSearch() }}
      snapPoints={snapPoints}
      surfaceHeight={surfaceHeight}
      onCloseAutoFocus={(event) => {
        event.preventDefault()
        portalContainer.parentElement?.querySelector<HTMLElement>('[aria-label="Public organization map"]')?.focus({ preventScroll: true })
      }}
      drawerPanel={<div className="mx-auto flex h-full min-h-0 w-full max-w-xl flex-col" data-public-map-embedded-detail-content="">
        {selectedOrganization ? (
        <PublicMapDrawerDetailPanel canManageResourceMap={canManageResourceMap} organizationCurationAction={organizationCurationAction} organization={selectedOrganization} favorites={favorites} onBack={onBackToSearch} onToggleFavorite={toggleFavorite} />
      ) : selectedResourceItem ? (
        <PublicMapResourceDrawerDetailPanel canManageResourceMap={canManageResourceMap} resourceMapCurationAction={resourceMapCurationAction} item={selectedResourceItem} collected={collectedResourceIds.includes(selectedResourceItem.id)} onBack={onBackToSearch} onToggleCollected={toggleCollectedResource} />
      ) : null}
      </div>}
    />
  )
}
