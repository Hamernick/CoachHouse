"use client"

import type { ComponentProps, ReactNode } from "react"

import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
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

export function PublicMapSidebarDrawer({
  autoFocus = false,
  overlayResizeControl = false,
  contentClassName,
  onCloseAutoFocus,
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
}: {
  autoFocus?: boolean
  overlayResizeControl?: boolean
  contentClassName?: string
  onCloseAutoFocus?: ComponentProps<typeof DrawerContent>["onCloseAutoFocus"]
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
}) {
  return (
    <Drawer
      autoFocus={autoFocus}
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
      onOpenChange={(open) => {
        if (!open) {
          resetPublicMapDrawer(setActiveSnapIndex, setDrawerTab, setSidebarMode)
          return
        }
        if (effectiveSidebarMode === "hidden") {
          setActiveSnapIndex(0)
          setSidebarMode("search")
        }
      }}
    >
      <DrawerContent
        onCloseAutoFocus={onCloseAutoFocus}
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
          "touch-pan-y overscroll-contain",
          overlayResizeControl && "[--public-map-detail-top-inset:1.5rem]",
          contentClassName
        )}
        style={{ height: "100%", maxHeight: "100%" }}
      >
        <div className={overlayResizeControl ? "absolute inset-x-0 top-0 z-20" : "shrink-0"}>
          <PublicMapDrawerResizeControl
            activeSnapIndex={activeSnapIndex}
            onSnapIndexChange={setActiveSnapIndex}
          />
        </div>
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
    </Drawer>
  )
}
