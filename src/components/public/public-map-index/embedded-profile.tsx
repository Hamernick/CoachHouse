"use client"

import { createContext, useEffect, useRef } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { PublicMapOrganizationDetail } from "./organization-detail"
import { OrganizationDetailPanelChrome } from "./organization-detail-shell-sections"
import { PublicMapResourceDetail } from "./resource-detail"
import { PublicMapResourceDetailChrome } from "./resource-detail-primary-sections"
import type { PublicMapSurfaceProps } from "./map-surface"

export const EmbeddedProfileActiveContext = createContext(false)

export function PublicMapEmbeddedProfile({ surface }: { surface: PublicMapSurfaceProps }) {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    const main = ref.current?.closest<HTMLElement>("[data-public-home-scroll], main")
    const scrollTop = main?.scrollTop ?? 0
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    if (main) main.scrollTop = 0
    ref.current?.focus({ preventScroll: true })
    return () => {
      requestAnimationFrame(() => {
        if (main?.querySelector("[data-public-map-home-profile]")) return
        if (main) main.scrollTop = scrollTop
        if (previousFocus?.isConnected && !previousFocus.closest("[inert]")) previousFocus.focus({ preventScroll: true })
      })
    }
  }, [])
  const organization = surface.selectedOrganization
  const item = surface.selectedResourceItem
  return (
    <section ref={ref} tabIndex={-1} aria-label="Resource profile" data-public-map-home-profile=""
      onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); surface.onBackToSearch() } }}
      className="pointer-events-auto relative z-20 mx-auto w-full max-w-2xl outline-none motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-200">
      {surface.preferencesSaveError ? <Alert className="mb-4"><AlertDescription>{surface.preferencesSaveError}</AlertDescription></Alert> : null}
      {organization ? <>
        <OrganizationDetailPanelChrome organization={organization} favorites={surface.favorites}
          onBack={surface.onBackToSearch} onToggleFavorite={surface.onToggleFavorite} className="px-4 pb-4"
          canManageResourceMap={surface.canManageResourceMap} organizationCurationAction={surface.organizationCurationAction} />
        <PublicMapOrganizationDetail organization={organization} standalone />
      </> : item ? <>
        <div className="px-4 pb-4"><PublicMapResourceDetailChrome item={item}
          collected={surface.collectedResourceIds?.includes(item.id)} onBack={surface.onBackToSearch}
          onToggleCollected={surface.onToggleCollectedResource} canManageResourceMap={surface.canManageResourceMap}
          resourceMapCurationAction={surface.resourceMapCurationAction} /></div>
        <PublicMapResourceDetail item={item} standalone onBack={surface.onBackToSearch} />
      </> : null}
    </section>
  )
}
