"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { useMobileMapNavigation } from "@/features/mobile-navigation"
import { cn } from "@/lib/utils"
import { PublicMapDrawerResizeControl } from "./drawer-resize-control"
import type { PublicMapSidebarDrawerProps } from "./sidebar-drawer"
import { useMapPanelDrag } from "./use-map-panel-drag"
import { mobileMapPanelStyles as styles } from "@/features/mobile-navigation"

export function PublicMapCombinedDrawer({
  activeSnapIndex,
  drawerPanel,
  portalContainer,
  setActiveSnapIndex,
  setDrawerTab,
  setSidebarMode,
  snapPoints,
}: PublicMapSidebarDrawerProps) {
  const navigation = useMobileMapNavigation()
  const [host, setHost] = useState<HTMLDivElement | null>(null)
  const [drawer, setDrawer] = useState<HTMLDivElement | null>(null)
  const [footer, setFooter] = useState<HTMLDivElement | null>(null)
  const registerSearch = navigation?.registerSearch
  const registerFooter = navigation?.setFooter
  const { dragHeight, handlers } = useMapPanelDrag({ frame: drawer, host, collapsedHeight: snapPoints[0], middleHeight: snapPoints[1], onSnap: setActiveSnapIndex })

  useEffect(() => {
    registerFooter?.(footer)
    return () => registerFooter?.(null)
  }, [footer, registerFooter])

  useEffect(() => {
    registerSearch?.(() => {
      setSidebarMode("search")
      setDrawerTab("directory")
      setActiveSnapIndex(1)
    })
    return () => registerSearch?.(null)
  }, [registerSearch, setActiveSnapIndex, setDrawerTab, setSidebarMode])

  if (!portalContainer) return null
  return createPortal(
    <div ref={setHost} className={styles.host} data-public-map-combined-panel="">
      {host ? <Dialog open modal={false}>
        <DialogContent
          portalContainer={host}
          ref={setDrawer}
          showCloseButton={false}
          data-public-map-drawer-mode={activeSnapIndex === 2 ? "fullscreen" : "floating"}
          data-public-map-drawer-snap-index={activeSnapIndex}
          className={cn(styles.panel, "absolute inset-x-0 top-auto bottom-0 flex w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-[36px] p-0 sm:max-w-none sm:rounded-[36px] sm:p-0 data-[state=open]:animate-none data-[state=closed]:animate-none")}
          style={{ height: dragHeight ?? (activeSnapIndex === 2 ? "100%" : snapPoints[activeSnapIndex]), maxHeight: "100%" }}
          onOpenAutoFocus={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
          onEscapeKeyDown={(event) => { event.preventDefault(); setActiveSnapIndex(0) }}
        >
          <DialogTitle className="sr-only">Resource map panel</DialogTitle>
          <DialogDescription className="sr-only">Expand to search resources. Navigation stays along the bottom.</DialogDescription>
          <PublicMapDrawerResizeControl activeSnapIndex={activeSnapIndex} onSnapIndexChange={setActiveSnapIndex} combined dragHandlers={handlers} />
          <div data-public-map-drawer-content-viewport="" className={styles.body} inert={activeSnapIndex === 0 && dragHeight === null}>
            {drawerPanel}
          </div>
          <div ref={setFooter} className={styles.navigation} data-public-map-navigation-footer="" />
        </DialogContent>
      </Dialog> : null}
    </div>,
    portalContainer
  )
}
