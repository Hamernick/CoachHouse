"use client"

import { useContext, useEffect, useRef, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { HOME_SEARCH_DOCK_SURFACE_CLASSNAME, HomeCanvasDockHostContext } from "../home-canvas-dock-slot"
import { cn } from "@/lib/utils"

import { PublicMapDockAvatar } from "./dock-viewer"

export function PublicMapFloatingSearchDock({
  search,
  collection,
}: {
  search: ReactNode
  collection: ReactNode
}) {
  const dockHost = useContext(HomeCanvasDockHostContext)
  const dockRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport || dockHost === null) return
    const host = dockRef.current?.closest<HTMLElement>("[data-public-home-dock-host]")
    const updatePosition = () => {
      if (host) {
        host.style.marginBottom = `${Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)}px`
        return
      }
      const canvas = dockRef.current?.closest("[data-public-find-canvas]")
      const bottom = canvas?.getBoundingClientRect().bottom ?? window.innerHeight
      const keyboardInset = Math.max(0, bottom - viewport.height - viewport.offsetTop)
      dockRef.current?.style.setProperty("bottom", `calc(${keyboardInset}px + max(0.75rem, env(safe-area-inset-bottom)))`)
    }
    updatePosition()
    viewport.addEventListener("resize", updatePosition)
    viewport.addEventListener("scroll", updatePosition)
    return () => {
      viewport.removeEventListener("resize", updatePosition)
      viewport.removeEventListener("scroll", updatePosition)
      if (host) host.style.marginBottom = ""
    }
  }, [dockHost])

  const dock = (
    <nav
      ref={dockRef}
      aria-label="Resource search and collection"
      data-public-map-search-dock=""
      className={cn(
        HOME_SEARCH_DOCK_SURFACE_CLASSNAME,
        dockHost ? "relative" : "fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] w-auto"
      )}
    >
      <div className="flex min-w-0 items-center justify-between gap-2 px-1 pb-1">
        {collection}
        <PublicMapDockAvatar />
      </div>
      {search}
    </nav>
  )
  return dockHost === undefined ? dock : dockHost ? createPortal(dock, dockHost) : null
}
