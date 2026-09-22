"use client"

import type { ReactNode } from "react"
import { useMobileMapNavigation } from "@/features/mobile-navigation"
import { PublicMapCombinedDrawer } from "./combined-drawer"

import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { Dialog } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

import type { SidebarMode } from "./constants"
import { PublicMapDrawerResizeControl } from "./drawer-resize-control"
import type { PublicMapMemberTab } from "./member-rail"
import {
  resolvePublicMapDrawerSnapPointIndex,
  type PublicMapDrawerSnapPoints,
} from "./sidebar-snap-points"
import { resetPublicMapDrawer } from "./sidebar-state-helpers"
import { PUBLIC_MAP_OVERLAY_GLASS_CLASSNAME } from "./sidebar-theme"

export type PublicMapSidebarDrawerProps = {
  activeSnapIndex: 0 | 1 | 2
  activeSnapPoint: number | string
  drawerIsFullscreen: boolean
  drawerPanel: ReactNode
  drawerViewportHeight: string
  effectiveSidebarMode: SidebarMode
  panelOpen: boolean
  portalContainer: HTMLElement | null
  setActiveSnapIndex: (index: 0 | 1 | 2) => void
  setDrawerTab: (tab: PublicMapMemberTab) => void
  setSidebarMode: (mode: SidebarMode) => void
  snapPoints: PublicMapDrawerSnapPoints
  surfaceHeight: number
}

export function PublicMapSidebarDrawer(props: PublicMapSidebarDrawerProps) {
  const navigation = useMobileMapNavigation()
  if (navigation && props.portalContainer) return <PublicMapCombinedDrawer {...props} />
  return <PublicMapStandaloneDrawer {...props} />
}

function PublicMapStandaloneDrawer({
  activeSnapIndex,
  activeSnapPoint,
  drawerIsFullscreen,
  drawerPanel,
  drawerViewportHeight,
  effectiveSidebarMode,
  panelOpen,
  portalContainer,
  setActiveSnapIndex,
  setDrawerTab,
  setSidebarMode,
  snapPoints,
  surfaceHeight,
}: PublicMapSidebarDrawerProps) {
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      resetPublicMapDrawer(setActiveSnapIndex, setDrawerTab, setSidebarMode)
      return
    }
    if (effectiveSidebarMode === "hidden") {
      setActiveSnapIndex(0)
      setSidebarMode("search")
    }
  }

  return (
    <Drawer
      container={portalContainer}
      activeSnapPoint={activeSnapPoint}
      disablePreventScroll
      dismissible={false}
      fadeFromIndex={2}
      modal={false}
      noBodyStyles
      open={panelOpen}
      snapToSequentialPoint
      setActiveSnapPoint={(nextSnapPoint) => {
        const nextIndex = resolvePublicMapDrawerSnapPointIndex({
          snapPoint: nextSnapPoint,
          snapPoints,
          surfaceHeight,
        })
        if (nextIndex == null) return
        if (nextIndex === 0) {
          setDrawerTab("directory")
          setSidebarMode("search")
        }
        setActiveSnapIndex(nextIndex)
      }}
      snapPoints={[...snapPoints]}
      shouldScaleBackground={false}
      onOpenChange={handleOpenChange}
    >
      {/* Keep the persistent map drawer nonmodal in Vaul and Radix. */}
      <Dialog open={panelOpen} onOpenChange={handleOpenChange} modal={false}>
        <DrawerContent
          data-public-map-drawer-mode={
            drawerIsFullscreen ? "fullscreen" : "floating"
          }
          data-public-map-drawer-snap-index={activeSnapIndex}
          overlayClassName="pointer-events-none bg-background/10 backdrop-blur-[1.5px]"
          showHandle={false}
          className={cn(
            PUBLIC_MAP_OVERLAY_GLASS_CLASSNAME,
            "pointer-events-auto h-full gap-0 overflow-hidden border p-0 shadow-sm",
            "data-[vaul-drawer-direction=bottom]:mt-0 data-[vaul-drawer-direction=bottom]:max-h-none data-[vaul-drawer-direction=bottom]:rounded-t-[28px]",
            "touch-pan-y overscroll-contain"
          )}
          style={{ height: "100%", maxHeight: "100%" }}
        >
          <PublicMapDrawerResizeControl
            activeSnapIndex={activeSnapIndex}
            onSnapIndexChange={setActiveSnapIndex}
          />
          <DrawerHeader className="sr-only">
            <DrawerTitle>Resource map panel</DrawerTitle>
            <DrawerDescription>
              Search organizations and view public organization details.
            </DrawerDescription>
          </DrawerHeader>
          <div
            data-public-map-drawer-content-viewport=""
            className="flex min-h-0 flex-none flex-col overflow-hidden"
            style={{ height: drawerViewportHeight }}
          >
            {drawerPanel}
          </div>
        </DrawerContent>
      </Dialog>
    </Drawer>
  )
}
