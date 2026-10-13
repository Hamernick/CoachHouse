"use client"

import { useResourceDirectoryPagination } from "@/features/find-resource-index/client"

import MapIcon from "lucide-react/dist/esm/icons/map"
import { Button } from "@/components/ui/button"
import { PUBLIC_MAP_RESOURCE_CATEGORY_LABELS } from "@/lib/public-map/resource-categories"
import type { PublicMapSurfaceProps } from "./map-surface"
import { PublicMapOrganizationList } from "./organization-list"

export function PublicMapEmbeddedScreenCollection({ surface, onShowMap }: {
  surface: PublicMapSurfaceProps
  onShowMap: () => void
}) {
  const pagination = useResourceDirectoryPagination()
  const resultCount = surface.searchContext?.guideId ? pagination?.totalCount ?? surface.filteredItems.length : surface.filteredItems.length
  const title = surface.searchContext?.title ?? (surface.activeGroup === "all"
    ? "Resources" : PUBLIC_MAP_RESOURCE_CATEGORY_LABELS[surface.activeGroup])

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-xl flex-col px-3 sm:px-4">
      <header className="flex shrink-0 items-center justify-between gap-3 py-3 sm:py-4">
        <div className="min-w-0">
          <h2 className="text-foreground text-lg leading-tight font-semibold text-balance">{title}</h2>
          <p className="text-muted-foreground mt-1 text-xs tabular-nums">
            {resultCount.toLocaleString()} {resultCount === 1 ? "result" : "results"}
          </p>
        </div>
        <Button variant="outline" size="sm" className="h-11 shrink-0 rounded-full px-3 sm:h-9" onClick={onShowMap}>
          <MapIcon aria-hidden /> Map
        </Button>
      </header>
      <div data-lenis-prevent="" className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-4">
        {surface.searchContext?.description ? <p className="text-muted-foreground mb-4 text-sm leading-6">{surface.searchContext.description}</p> : null}
        <PublicMapOrganizationList
          incrementalLoading
          bounded
          remotePagination={Boolean(surface.searchContext?.guideId)}
          items={surface.filteredItems}
          organizations={surface.filteredOrganizations}
          selectedItemId={surface.selectedItemId}
          selectedOrgId={surface.selectedOrganization?.id ?? null}
          query={surface.query}
          activeGroup={surface.activeGroup}
          loadStatus={surface.resourceItemsLoadStatus}
          loadError={surface.resourceItemsLoadError}
          onClearCategory={() => surface.onActiveGroupChange("all")}
          onClearQuery={() => surface.onQueryChange("")}
          onRetryLoad={surface.onRetryResourceItems}
          onSelectItem={surface.onSelectItem}
          onSelectOrg={surface.onSelectOrganization}
          onOpenDetails={surface.onOpenOrgDetails}
        />
      </div>
    </div>
  )
}
