"use client"

import { useCallback, type CSSProperties, type ReactNode } from "react"

import { Sidebar, SidebarProvider } from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

import { PublicMapLiquidGlassShell } from "./liquid-glass-shell"
import { PublicMapMemberRail, type PublicMapMemberTab } from "./member-rail"
import type { PublicMapSidebarProps } from "./sidebar-contract"
import { PUBLIC_MAP_SIDEBAR_RAIL_CLASSNAME } from "./sidebar-theme"

export function PublicMapRailPanel({
  collectedCount,
  directoryHeaderEnd,
  directoryHeaderStart,
  directoryRail,
  directoryMode,
  guides,
  savedGuideIds,
  savedGuides,
  savedOrganizations,
  savedResources,
  unresolvedCollectedResourceCount,
  resourceItemsLoadStatus,
  resourceItemsLoadError,
  onRetryResourceItems,
  onGuideSelect,
  onToggleSavedGuide,
  onSelectOrganization,
  onSelectResource,
  onToggleFavorite,
  onToggleCollectedResource,
}: {
  collectedCount: number
  directoryHeaderEnd?: ReactNode
  directoryHeaderStart?: ReactNode
  directoryRail: ReactNode
  directoryMode: "search" | "details"
  guides: NonNullable<PublicMapSidebarProps["guides"]>
  savedGuideIds: NonNullable<PublicMapSidebarProps["savedGuideIds"]>
  savedGuides: NonNullable<PublicMapSidebarProps["savedGuides"]>
  savedOrganizations: NonNullable<PublicMapSidebarProps["savedOrganizations"]>
  savedResources: NonNullable<PublicMapSidebarProps["savedResources"]>
  unresolvedCollectedResourceCount: number
  resourceItemsLoadStatus: NonNullable<
    PublicMapSidebarProps["resourceItemsLoadStatus"]
  >
  resourceItemsLoadError: string | null
  onRetryResourceItems: NonNullable<PublicMapSidebarProps["retryResourceItems"]>
  onGuideSelect: PublicMapSidebarProps["onGuideSelect"]
  onToggleSavedGuide: PublicMapSidebarProps["onToggleSavedGuide"]
  onSelectOrganization: PublicMapSidebarProps["onSelectOrganization"]
  onSelectResource: PublicMapSidebarProps["onSelectItem"]
  onToggleFavorite: PublicMapSidebarProps["toggleFavorite"]
  onToggleCollectedResource: NonNullable<
    PublicMapSidebarProps["toggleCollectedResource"]
  >
}) {
  const providerStyle = { "--sidebar-width": "100%" } as CSSProperties

  return (
    <SidebarProvider
      defaultOpen
      className="h-full min-h-0 w-full bg-transparent"
      style={providerStyle}
    >
      <PublicMapLiquidGlassShell
        className={cn(
          "pointer-events-auto h-full w-full",
          PUBLIC_MAP_SIDEBAR_RAIL_CLASSNAME
        )}
      >
        <Sidebar
          collapsible="none"
          className="text-sidebar-foreground h-full w-full overflow-hidden bg-transparent"
        >
          <PublicMapMemberRail
            collectedCount={collectedCount}
            directoryHeaderEnd={directoryHeaderEnd}
            directoryHeaderStart={directoryHeaderStart}
            directoryRail={directoryRail}
            directoryMode={directoryMode}
            guides={guides}
            savedGuideIds={savedGuideIds}
            savedGuides={savedGuides}
            savedOrganizations={savedOrganizations}
            savedResources={savedResources}
            unresolvedCollectedResourceCount={unresolvedCollectedResourceCount}
            resourceItemsLoadStatus={resourceItemsLoadStatus}
            resourceItemsLoadError={resourceItemsLoadError}
            onRetryResourceItems={onRetryResourceItems}
            onGuideSelect={onGuideSelect}
            onToggleSavedGuide={onToggleSavedGuide}
            onSelectOrganization={onSelectOrganization}
            onSelectResource={onSelectResource}
            onToggleFavorite={onToggleFavorite}
            onToggleCollectedResource={onToggleCollectedResource}
          />
        </Sidebar>
      </PublicMapLiquidGlassShell>
    </SidebarProvider>
  )
}

export function usePublicMapDrawerSelectionHandlers({
  onGuideSelect,
  onSelectItem,
  onSelectOrganization,
  setActiveSnapIndex,
  setDrawerTab,
}: {
  onGuideSelect: PublicMapSidebarProps["onGuideSelect"]
  onSelectItem: PublicMapSidebarProps["onSelectItem"]
  onSelectOrganization: PublicMapSidebarProps["onSelectOrganization"]
  setActiveSnapIndex: (index: 0 | 1 | 2) => void
  setDrawerTab: (tab: PublicMapMemberTab) => void
}) {
  const selectDirectory = useCallback(() => {
    setDrawerTab("directory")
    setActiveSnapIndex(1)
  }, [setActiveSnapIndex, setDrawerTab])
  const handleGuideSelect = useCallback(
    (guideId: string) => {
      onGuideSelect?.(guideId)
      selectDirectory()
    },
    [onGuideSelect, selectDirectory]
  )
  const handleOrganizationSelect = useCallback(
    (organizationId: string) => {
      onSelectOrganization(organizationId)
      selectDirectory()
    },
    [onSelectOrganization, selectDirectory]
  )
  const handleResourceSelect = useCallback(
    (resourceId: string) => {
      onSelectItem(resourceId)
      selectDirectory()
    },
    [onSelectItem, selectDirectory]
  )

  return { handleGuideSelect, handleOrganizationSelect, handleResourceSelect }
}
