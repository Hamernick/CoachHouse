"use client"

import { useEffect, useRef, type RefObject } from "react"
import { cn } from "@/lib/utils"
import type { PublicMapEmbeddedScreenState } from "./embedded-screen-state"
import type { PublicMapSurfaceProps } from "./map-surface"
import { PublicMapDrawerDetailPanel, PublicMapResourceDrawerDetailPanel } from "./sidebar-detail-panels"

export function PublicMapEmbeddedScreenLayer({ surface, screen, surfaceRef }: {
  surface: PublicMapSurfaceProps
  screen: PublicMapEmbeddedScreenState
  surfaceRef: RefObject<HTMLDivElement | null>
}) {
  const contentRef = useRef<HTMLElement>(null)
  const contentKey = screen.detailsOpen
    ? surface.selectedOrganization?.id ?? surface.selectedResourceItem?.id
    : null

  useEffect(() => {
    if (!contentKey) return
    const returnTarget = document.activeElement instanceof HTMLElement ? document.activeElement : null
    contentRef.current?.focus({ preventScroll: true })
    surfaceRef.current?.scrollIntoView({
      block: "nearest",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    })
    return () => {
      if (returnTarget?.isConnected && !returnTarget.closest("[inert]")) returnTarget.focus({ preventScroll: true })
    }
  }, [contentKey, surfaceRef])

  return (
    <section
      ref={contentRef}
      data-public-map-screen-content={screen.mode}
      data-lenis-prevent=""
      aria-label="Resource details"
      aria-hidden={!screen.mapHidden}
      inert={!screen.mapHidden}
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return
        event.stopPropagation()
        surface.onBackToSearch()
      }}
      className={cn(
        "bg-background absolute inset-0 z-40 overflow-hidden rounded-[inherit] transition-[opacity,visibility] duration-150 ease-out motion-reduce:transition-none focus-visible:outline-none",
        screen.mapHidden ? "pointer-events-auto visible opacity-100" : "pointer-events-none invisible opacity-0"
      )}
    >
      <div key={contentKey} className="mx-auto h-full min-h-0 w-full max-w-xl">
        {screen.detailsOpen && surface.selectedOrganization ? (
          <PublicMapDrawerDetailPanel
            organization={surface.selectedOrganization}
            favorites={surface.favorites}
            onBack={surface.onBackToSearch}
            onToggleFavorite={surface.onToggleFavorite}
            canManageResourceMap={surface.canManageResourceMap}
            organizationCurationAction={surface.organizationCurationAction}
          />
        ) : screen.detailsOpen && surface.selectedResourceItem ? (
          <PublicMapResourceDrawerDetailPanel
            item={surface.selectedResourceItem}
            collected={surface.collectedResourceIds?.includes(surface.selectedResourceItem.id)}
            onBack={surface.onBackToSearch}
            onToggleCollected={surface.onToggleCollectedResource}
            canManageResourceMap={surface.canManageResourceMap}
            resourceMapCurationAction={surface.resourceMapCurationAction}
          />
        ) : null}
      </div>
    </section>
  )
}
