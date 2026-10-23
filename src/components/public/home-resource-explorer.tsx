import { Suspense } from "react"
import { PublicFindRoute } from "@/features/find-map"
import type { PublicMapOrganization } from "@/lib/queries/public-map-index"
import type { ExternalResourceMapItem } from "@/lib/public-map/resource-map-items"
import { cn } from "@/lib/utils"
import { HomeCanvasFindShell } from "./home-canvas-find-shell"
import { PublicMapHomeLoading } from "./public-map-index/map-loading-state"

export function PublicHomeResourceExplorer({ searchParams, initialOrganization, initialResource }: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
  initialOrganization?: PublicMapOrganization
  initialResource?: ExternalResourceMapItem
}) {
  const hasInitialProfile = Boolean(initialOrganization || initialResource)

  return (
    <HomeCanvasFindShell frameCanvas={false} headerInFlow={hasInitialProfile} showPublicNavigation={hasInitialProfile} searchDockBelowCanvas glassHeader showPublicSearch={false} className="[html.light_&]:[--shell-bg:var(--muted)] dark:[--shell-bg:#000] [&_[data-build-collect-public-header]]:min-h-12 [&_[data-build-collect-public-header]]:py-0">
      <section data-public-resource-unframed="" data-public-home-scroll="" data-public-home-flat-surfaces="" aria-label="Resources"
        className={cn("relative isolate h-full min-h-0 w-full min-w-0 flex-1 scroll-pt-1 overflow-x-hidden overflow-y-auto p-3 pb-[calc(8rem+env(safe-area-inset-bottom))] [clip-path:inset(0)] [overflow-anchor:none] sm:p-4 sm:pb-[calc(8rem+env(safe-area-inset-bottom))] [&_[data-public-map-backdrop]]:hidden", hasInitialProfile ? "pt-1 sm:pt-1" : "pt-12 sm:pt-12")}>
        <Suspense fallback={<PublicMapHomeLoading />}>
          <PublicFindRoute embedded searchParams={searchParams} initialOrganization={initialOrganization} initialResource={initialResource} />
        </Suspense>
      </section>
    </HomeCanvasFindShell>
  )
}
