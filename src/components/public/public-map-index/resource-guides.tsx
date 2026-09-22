"use client"

import { useCallback, useMemo, type Dispatch, type SetStateAction } from "react"

import { Button } from "@/components/ui/button"
import { Empty } from "@/components/ui/empty"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ShareButton } from "@/components/shared/share-button"
import Image from "next/image"
import BookmarkIcon from "lucide-react/dist/esm/icons/bookmark"
import type { PublicMapSameLocationSelection } from "@/lib/public-map/public-map-layer-api"
import {
  buildPublicMapItems,
  type ExternalResourceMapItem,
  type PublicMapItem,
} from "@/lib/public-map/resource-map-items"
import type { PublicMapOrganization } from "@/lib/queries/public-map-index"
import {
  isPublicMapResourceGuideId,
  type PublicMapResourceGuideId,
} from "@/lib/public-map/resource-guide-ids"
import { cn } from "@/lib/utils"

import type { SidebarMode } from "./constants"
import {
  buildPublicMapResourceGuides,
  buildPublicMapResourceGuideHref,
  buildPublicMapSavedResourceGuides,
  filterPublicMapFeaturedResourceGuides,
  type PublicMapResourceGuide,
} from "./resource-guide-model"

export {
  buildPublicMapResourceGuideHref,
  buildPublicMapResourceGuides,
  buildPublicMapSavedResourceGuides,
  filterPublicMapFeaturedResourceGuides,
  type PublicMapResourceGuide,
} from "./resource-guide-model"

export type PublicMapResourceGuideSearchContext = {
  title: string
  description?: string | null
  guideId: PublicMapResourceGuideId
  items: PublicMapItem[]
  onClear: () => void
}

export function usePublicMapResourceGuideState({
  activeGuideId,
  showCoolingCenters = true,
  filteredMapItems,
  organizations,
  includeSeedResources,
  resourceItems,
  setSameLocationSelection,
  setSelectedListItemId,
  setSelectedOrgId,
  setSidebarMode,
  setActiveGuideId,
}: {
  activeGuideId: PublicMapResourceGuideId | null
  showCoolingCenters?: boolean
  filteredMapItems: PublicMapItem[]
  organizations: PublicMapOrganization[]
  includeSeedResources: boolean
  resourceItems: ExternalResourceMapItem[]
  setSameLocationSelection: (
    selection: PublicMapSameLocationSelection | null
  ) => void
  setSelectedListItemId: (itemId: string | null) => void
  setSelectedOrgId: (organizationId: string | null) => void
  setSidebarMode: (mode: SidebarMode) => void
  setActiveGuideId: (guideId: PublicMapResourceGuideId | null) => void
}) {
  const guideSourceMapItems = useMemo(
    () =>
      buildPublicMapItems({
        organizations,
        includeSeedItems: includeSeedResources,
        resourceItems,
      }),
    [includeSeedResources, organizations, resourceItems]
  )
  const resourceGuides = useMemo(
    () => buildPublicMapResourceGuides(guideSourceMapItems, { showCoolingCenters }),
    [guideSourceMapItems, showCoolingCenters]
  )
  const activeGuide = useMemo<PublicMapResourceGuide | null>(
    () => resourceGuides.find((guide) => guide.id === activeGuideId) ?? null,
    [activeGuideId, resourceGuides]
  )
  const visibleMapItems = activeGuide?.items ?? filteredMapItems
  const clearActiveGuide = useCallback(() => {
    setActiveGuideId(null)
    setSelectedListItemId(null)
  }, [setActiveGuideId, setSelectedListItemId])
  const activeGuideSearchContext =
    useMemo<PublicMapResourceGuideSearchContext | null>(
      () =>
        activeGuide
          ? {
              title: activeGuide.title,
              description: `${activeGuide.itemCount.toLocaleString()} ${activeGuide.itemCount === 1 ? "resource" : "resources"} in this guide.`,
              guideId: activeGuide.id,
              items: activeGuide.items,
              onClear: clearActiveGuide,
            }
          : null,
      [activeGuide, clearActiveGuide]
    )
  const handleGuideSelect = useCallback(
    (guideId: string) => {
      const guide = resourceGuides.find((candidate) => candidate.id === guideId)
      if (!guide) return
      setSameLocationSelection(null)
      setSelectedOrgId(null)
      setSelectedListItemId(null)
      setActiveGuideId(guide.id)
      setSidebarMode("search")
    },
    [
      resourceGuides,
      setActiveGuideId,
      setSameLocationSelection,
      setSelectedListItemId,
      setSelectedOrgId,
      setSidebarMode,
    ]
  )

  return {
    activeGuideSearchContext,
    activeGuide,
    clearActiveGuide,
    handleGuideSelect,
    resourceGuides,
    visibleMapItems,
  }
}

export function usePublicMapSavedGuideState({
  resourceGuides,
  savedGuideIds,
  setSavedGuideIds,
}: {
  resourceGuides: PublicMapResourceGuide[]
  savedGuideIds: PublicMapResourceGuideId[]
  setSavedGuideIds: Dispatch<SetStateAction<PublicMapResourceGuideId[]>>
}) {
  const featuredGuides = useMemo(
    () => filterPublicMapFeaturedResourceGuides(resourceGuides),
    [resourceGuides]
  )
  const savedGuides = useMemo(
    () =>
      buildPublicMapSavedResourceGuides({
        guides: resourceGuides,
        savedGuideIds,
      }),
    [resourceGuides, savedGuideIds]
  )
  const toggleSavedGuide = useCallback(
    (guideId: PublicMapResourceGuideId) => {
      if (!isPublicMapResourceGuideId(guideId)) return
      setSavedGuideIds((current) =>
        current.includes(guideId)
          ? current.filter((id) => id !== guideId)
          : [...current, guideId].slice(0, 40)
      )
    },
    [setSavedGuideIds]
  )

  return { featuredGuides, savedGuides, toggleSavedGuide }
}

const PUBLIC_MAP_RESOURCE_GUIDE_CARD_CLASSNAME =
  "group relative aspect-[0.82] min-w-0 overflow-hidden rounded-xl border border-input bg-input/55 text-foreground shadow-sm backdrop-blur-md dark:border-input dark:bg-input/55"

function PublicMapResourceGuidesHeader({
  guideCount,
  subtitle = "Current resources grouped by place and service",
  title = "Guides",
}: {
  guideCount: number
  subtitle?: string
  title?: string
}) {
  return (
    <div className="flex min-w-0 items-end justify-between gap-3 px-0.5">
      <div className="min-w-0">
        <h2 className="text-foreground text-base leading-none font-semibold">
          {title}
        </h2>
        <p className="text-muted-foreground mt-1 text-sm text-pretty">
          {subtitle}
        </p>
      </div>
      <p className="text-muted-foreground shrink-0 text-xs tabular-nums">
        {guideCount.toLocaleString()}
      </p>
    </div>
  )
}

export function PublicMapResourceGuideActions({
  guideId,
  guideTitle,
  onToggleSavedGuide,
  saved,
}: {
  guideId: PublicMapResourceGuideId
  guideTitle: string
  onToggleSavedGuide?: (guideId: PublicMapResourceGuideId) => void
  saved: boolean
}) {
  return (
    <div className="flex items-center gap-1.5">
      {onToggleSavedGuide ? (
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="bg-background/90 size-9 rounded-full backdrop-blur-md"
          aria-label={
            saved
              ? `Remove ${guideTitle} from My Map`
              : `Save ${guideTitle} to My Map`
          }
          aria-pressed={saved}
          onClick={() => onToggleSavedGuide(guideId)}
        >
          <BookmarkIcon
            className={cn("size-4", saved && "fill-current")}
            aria-hidden
          />
        </Button>
      ) : null}
      <ShareButton
        url={buildPublicMapResourceGuideHref(guideId)}
        title={guideTitle}
        label={`Share ${guideTitle}`}
        iconOnly
        className="bg-background/90 size-9 rounded-full backdrop-blur-md"
      />
    </div>
  )
}

function PublicMapResourceGuideCard({
  guide,
  onGuideSelect,
  onToggleSavedGuide,
  priority,
  saved,
}: {
  guide: PublicMapResourceGuide
  onGuideSelect: (guideId: string) => void
  onToggleSavedGuide?: (guideId: PublicMapResourceGuideId) => void
  priority: boolean
  saved: boolean
}) {
  const available = guide.available !== false

  return (
    <article
      className={PUBLIC_MAP_RESOURCE_GUIDE_CARD_CLASSNAME}
      data-public-map-resource-guide-card={guide.id}
    >
      {guide.imageUrl ? (
        <Image
          src={guide.imageUrl}
          alt=""
          fill
          priority={priority}
          sizes="(max-width: 767px) 13rem, 18rem"
          className="object-cover"
        />
      ) : null}
      <span className="bg-background/60 absolute inset-0" aria-hidden />
      <Button
        type="button"
        variant="ghost"
        className="text-foreground hover:bg-input/15 hover:text-foreground focus-visible:ring-ring/50 absolute inset-0 z-10 h-full w-full items-stretch justify-start rounded-xl p-0 text-left whitespace-normal focus-visible:ring-[3px] focus-visible:outline-none disabled:pointer-events-none"
        disabled={!available}
        aria-label={
          available ? `Open ${guide.title}` : `${guide.title} unavailable`
        }
        onClick={() => onGuideSelect(guide.id)}
      >
        <span className="flex h-full min-w-0 flex-col justify-end p-4 pr-14">
          <span className="min-w-0">
            <span className="text-muted-foreground block text-xs leading-none font-semibold">
              {guide.kicker}
            </span>
            <span className="text-foreground mt-2 line-clamp-3 block text-xl leading-tight font-bold text-pretty">
              {guide.title}
            </span>
            <span className="text-muted-foreground mt-1.5 block text-sm leading-tight font-medium">
              {available
                ? `${guide.itemCount.toLocaleString()} ${guide.itemCount === 1 ? "resource" : "resources"}`
                : "Unavailable right now"}
            </span>
          </span>
        </span>
      </Button>
      <div className="absolute top-3 right-3 z-20">
        <PublicMapResourceGuideActions
          guideId={guide.id}
          guideTitle={guide.title}
          onToggleSavedGuide={onToggleSavedGuide}
          saved={saved}
        />
      </div>
    </article>
  )
}

export function PublicMapResourceGuides({
  guides,
  onGuideSelect,
  onToggleSavedGuide,
  presentation = "grid",
  savedGuideIds = [],
  showHeader = true,
}: {
  guides: PublicMapResourceGuide[]
  onGuideSelect: (guideId: string) => void
  onToggleSavedGuide?: (guideId: PublicMapResourceGuideId) => void
  presentation?: "featured" | "grid"
  savedGuideIds?: PublicMapResourceGuideId[]
  showHeader?: boolean
}) {
  if (guides.length === 0) return null

  return (
    <section
      data-public-map-sidebar-section="resource-guides"
      className="flex min-w-0 flex-col gap-2"
      aria-label="Resource guides"
    >
      {showHeader ? (
        <PublicMapResourceGuidesHeader
          guideCount={guides.length}
          title={presentation === "featured" ? "Guides We Love" : "Guides"}
          subtitle={
            presentation === "featured"
              ? "Useful collections from current public resources"
              : undefined
          }
        />
      ) : null}
      <div
        data-public-map-resource-guides-grid="true"
        data-presentation={presentation}
        className={cn(
          "min-w-0 items-stretch gap-3",
          presentation === "featured"
            ? "scrollbar-none flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain pb-1"
            : "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3"
        )}
      >
        {guides.map((guide, index) => (
          <div
            key={guide.id}
            className={cn(
              "min-w-0",
              presentation === "featured" && "w-52 shrink-0 snap-start"
            )}
          >
            <PublicMapResourceGuideCard
              guide={guide}
              onGuideSelect={onGuideSelect}
              onToggleSavedGuide={onToggleSavedGuide}
              priority={presentation === "featured" && index === 0}
              saved={savedGuideIds.includes(guide.id)}
            />
          </div>
        ))}
      </div>
    </section>
  )
}

export function PublicMapGuidesRail({
  guides,
  onGuideSelect,
  onToggleSavedGuide,
  savedGuideIds = [],
}: {
  guides: PublicMapResourceGuide[]
  onGuideSelect: (guideId: string) => void
  onToggleSavedGuide?: (guideId: PublicMapResourceGuideId) => void
  savedGuideIds?: PublicMapResourceGuideId[]
}) {
  return (
    <div
      data-public-map-member-rail-section="guides-panel"
      className="mx-auto flex h-full min-h-0 w-full max-w-3xl flex-col gap-3 overflow-hidden px-3"
    >
      <div
        data-public-map-member-rail-section="guides-header"
        className="shrink-0"
      >
        <PublicMapResourceGuidesHeader guideCount={guides.length} />
      </div>
      <ScrollArea
        data-public-map-member-rail-section="guides-scroll"
        className="h-full min-h-0 flex-1 overflow-hidden pr-1"
        viewportClassName="scroll-fade-effect-y overscroll-contain [--mask-height:1.5rem] [--scroll-buffer:1rem] [&>div]:!block [&>div]:!min-w-0 [&>div]:!w-full [&>div]:!max-w-full"
        contentClassName="pb-3"
      >
        {guides.length > 0 ? (
          <PublicMapResourceGuides
            guides={guides}
            onGuideSelect={onGuideSelect}
            onToggleSavedGuide={onToggleSavedGuide}
            savedGuideIds={savedGuideIds}
            showHeader={false}
          />
        ) : (
          <Empty
            className="border-border/70 bg-background/70 min-h-[220px] rounded-xl border"
            title="No guides available"
            description="Published resource collections will appear here."
          />
        )}
      </ScrollArea>
    </div>
  )
}
