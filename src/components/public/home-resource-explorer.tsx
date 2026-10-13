import { Suspense } from "react"
import { cn } from "@/lib/utils"
import { PublicFindRoute } from "@/features/find-map"
import type { PublicMapOrganization } from "@/lib/queries/public-map-index"
import type { ExternalResourceMapItem } from "@/lib/public-map/resource-map-items"
import { HomeCanvasFindShell } from "./home-canvas-find-shell"
import { PublicMapHomeLoading } from "./public-map-index/map-loading-state"

export function PublicHomeResourceExplorer({ searchParams, initialOrganization, initialResource, unframed = false }: {
  unframed?: boolean
  searchParams?: Promise<Record<string, string | string[] | undefined>>
  initialOrganization?: PublicMapOrganization
  initialResource?: ExternalResourceMapItem
}) {
  return (
    <HomeCanvasFindShell frameCanvas={!unframed} showPublicNavigation={!unframed} searchDockBelowCanvas glassHeader showPublicSearch={false} className={cn("[html.light_&]:[--shell-bg:var(--muted)]", unframed && "dark:[--shell-bg:#000] [&_[data-build-collect-public-header]]:min-h-12 [&_[data-build-collect-public-header]]:py-0")} canvasClassName="mx-auto max-w-3xl [contain:layout]">
      <section data-public-resource-unframed={unframed ? "" : undefined} data-public-home-scroll="" data-public-home-flat-surfaces="" aria-label="Resources"
        className={cn("relative isolate h-full min-h-0 w-full min-w-0 flex-1 scroll-pt-1 overflow-x-hidden overflow-y-auto p-3 pt-1 pb-4 [clip-path:inset(0)] sm:p-4 sm:pt-1 sm:pb-4", unframed && "pt-12 sm:pt-12 [overflow-anchor:none] pb-[calc(8rem+env(safe-area-inset-bottom))] sm:pb-[calc(8rem+env(safe-area-inset-bottom))] [&_[data-public-map-backdrop]]:hidden")}>
        <Suspense fallback={<PublicMapHomeLoading />}>
          <PublicFindRoute embedded searchParams={searchParams} initialOrganization={initialOrganization} initialResource={initialResource} />
        </Suspense>
      </section>
    </HomeCanvasFindShell>
  )
}
