"use client"

import CloudOffIcon from "lucide-react/dist/esm/icons/cloud-off"
import SearchXIcon from "lucide-react/dist/esm/icons/search-x"

import { Button } from "@/components/ui/button"
import { Empty } from "@/components/ui/empty"
import { cn } from "@/lib/utils"
import type {
  PublicMapGroupFilterCounts,
  PublicMapGroupFilterKey,
} from "./category-filter"
import { PublicMapNearbyCategoryGrid } from "./nearby-category-grid"
import type { PublicMapResourceItemsLoadStatus } from "./use-resource-map-items"
import type { PublicMapResourceGuideId } from "@/lib/public-map/resource-guide-ids"
import {
  PublicMapResourceGuides,
  type PublicMapResourceGuide,
} from "./resource-guides"

import { PublicMapClaimPrompt, PublicMapFooter } from "./footer"

export function PublicMapDirectoryHome({
  scrollable = true,
  showFooter = true,
  counts,
  featuredGuides,
  onCategorySelect,
  onGuideSelect,
  onRetryResourceItems,
  onStartSearch,
  onToggleSavedGuide,
  resourceItemsLoadStatus,
  savedGuideIds,
}: {
  scrollable?: boolean
  showFooter?: boolean
  counts: PublicMapGroupFilterCounts
  featuredGuides: PublicMapResourceGuide[]
  onCategorySelect: (category: PublicMapGroupFilterKey) => void
  onGuideSelect: (guideId: string) => void
  onRetryResourceItems: () => void
  onStartSearch: () => void
  onToggleSavedGuide?: (guideId: PublicMapResourceGuideId) => void
  resourceItemsLoadStatus: PublicMapResourceItemsLoadStatus
  savedGuideIds: PublicMapResourceGuideId[]
}) {
  const loadFailed = resourceItemsLoadStatus === "error"
  const showEmptyState =
    resourceItemsLoadStatus !== "loading" && (loadFailed || counts.all === 0)

  return (
    <div
      data-public-map-directory-home=""
      data-lenis-prevent={scrollable ? "" : undefined}
      className={cn(
        "min-h-0 flex-1 px-2.5 pt-1 pb-[max(env(safe-area-inset-bottom),1rem)]",
        scrollable && "overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]"
      )}
    >
      <div
        data-public-map-directory-home-content=""
        className="mx-auto w-full max-w-3xl"
      >
        {showEmptyState ? (
          <section
            data-public-map-directory-empty={loadFailed ? "error" : "empty"}
            className="pb-4"
          >
            <Empty
              variant="subtle"
              size="lg"
              className="min-h-64"
              role={loadFailed ? "alert" : "status"}
              icon={
                loadFailed ? (
                  <CloudOffIcon className="size-5" aria-hidden />
                ) : (
                  <SearchXIcon className="size-5" aria-hidden />
                )
              }
              title={
                loadFailed
                  ? "We couldn’t load nearby resources"
                  : "No nearby resources yet"
              }
              description={
                loadFailed
                  ? "Try again to reconnect to the public directory."
                  : "Search for a service, organization, program, or location."
              }
              actions={
                <Button
                  type="button"
                  variant={loadFailed ? "outline" : "default"}
                  className="rounded-full"
                  onClick={loadFailed ? onRetryResourceItems : onStartSearch}
                >
                  {loadFailed ? "Try again" : "Start searching"}
                </Button>
              }
            />
          </section>
        ) : (
          <section className="flex flex-col gap-3 pb-4">
            <h2 className="text-foreground px-0.5 text-xl font-semibold tracking-tight">
              Find Nearby
            </h2>
            <PublicMapNearbyCategoryGrid
              counts={counts}
              loading={resourceItemsLoadStatus === "loading"}
              onSelect={onCategorySelect}
            />
          </section>
        )}
        {featuredGuides.length > 0 ? (
          <div className="pb-5">
            <PublicMapResourceGuides
              guides={featuredGuides}
              onGuideSelect={onGuideSelect}
              onToggleSavedGuide={onToggleSavedGuide}
              presentation="featured"
              savedGuideIds={savedGuideIds}
            />
          </div>
        ) : null}
        {showFooter ? <PublicMapFooter /> : <PublicMapClaimPrompt />}
      </div>
    </div>
  )
}
