"use client"

import { useState } from "react"

import {
  resolvePublicMapItemSelectableId,
  type ExternalResourceMapItem,
} from "@/lib/public-map/resource-map-items"
import {
  PUBLIC_MAP_RESOURCE_CATEGORY_LABELS,
  resolvePublicMapResourceCategoryColor,
} from "@/lib/public-map/resource-categories"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import BookmarkIcon from "lucide-react/dist/esm/icons/bookmark"
import { cn } from "@/lib/utils"
import {
  buildPublicMapOrganizationListCardOwnerId,
  buildPublicMapOrganizationListCardOwnerProps,
  buildPublicMapOrganizationListCardSurfaceProps,
} from "./react-grab"
import {
  PUBLIC_MAP_LIST_CARD_HEIGHT_CLASSNAME,
  PUBLIC_MAP_LIST_CARD_PERF_STYLE,
  PublicMapHighlightedText,
  PublicMapListMetadataStrip,
} from "./organization-list-card-shared"
import { PublicMapResourceCategoryIcon } from "./resource-category-icon"
import { normalizeResourceImageSrc } from "./resource-detail-helpers"

const PUBLIC_MAP_RESOURCE_LIST_CARD_PERF_STYLE = {
  ...PUBLIC_MAP_LIST_CARD_PERF_STYLE,
  containIntrinsicSize: "64px",
} as const

function PublicMapResourceListMedia({
  constrainedLayout,
  item,
  markerColor,
  ownerId,
}: {
  constrainedLayout: boolean
  item: ExternalResourceMapItem
  markerColor: string
  ownerId: string
}) {
  const imageSrc = normalizeResourceImageSrc(
    item.markerImageUrl ?? item.logoUrl ?? item.faviconUrl
  )
  const [loaded, setLoaded] = useState(false)
  const [errored, setErrored] = useState(false)
  const showImage = Boolean(imageSrc && !errored)

  return (
    <span
      className={cn(
        "border-border/60 bg-muted/35 relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl border",
        constrainedLayout ? "size-11" : "size-12"
      )}
      {...buildPublicMapOrganizationListCardSurfaceProps({
        ownerId,
        slot: "media",
        surfaceKind: "indicator",
        notes: "Asset-forward provider image with category fallback.",
      })}
    >
      <span
        className="inline-flex size-9 items-center justify-center rounded-full"
        style={{ backgroundColor: markerColor }}
        aria-hidden
      >
        <PublicMapResourceCategoryIcon
          category={item.primaryResourceCategory}
          className="size-4.5 text-white"
        />
      </span>
      {showImage ? (
        <>
          {!loaded ? (
            <Skeleton className="bg-muted/45 absolute inset-0" aria-hidden />
          ) : null}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageSrc!}
            alt={`${item.title} image`}
            loading="lazy"
            decoding="async"
            className={cn(
              "absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ease-out motion-reduce:transition-none",
              loaded ? "opacity-100" : "opacity-0"
            )}
            onLoad={() => setLoaded(true)}
            onError={() => {
              setErrored(true)
              setLoaded(false)
            }}
          />
        </>
      ) : null}
    </span>
  )
}

export function PublicMapResourceListCard({
  constrainedLayout,
  item,
  selected,
  query,
  onSelectItem,
  collected = false,
  onToggleCollected,
}: {
  constrainedLayout: boolean
  item: ExternalResourceMapItem
  selected: boolean
  query?: string
  onSelectItem?: (id: string) => void
  collected?: boolean
  onToggleCollected?: (id: string) => void
}) {
  const selectableItemId = resolvePublicMapItemSelectableId(item)
  const metadataItems = [
    PUBLIC_MAP_RESOURCE_CATEGORY_LABELS[item.primaryResourceCategory],
    item.latitude === null && item.longitude === null
      ? "Online resource"
      : [item.city, item.state].filter(Boolean).join(", ") ||
        item.country ||
        "Location available",
  ]
  const ownerId = buildPublicMapOrganizationListCardOwnerId(selectableItemId)
  const markerColor = resolvePublicMapResourceCategoryColor(
    item.primaryResourceCategory
  )
  const openResourceDetails = () => onSelectItem?.(selectableItemId)
  const serviceOutcome =
    item.services?.[0]?.title ?? item.subtitle ?? item.description

  return (
    <article
      key={item.id}
      style={PUBLIC_MAP_RESOURCE_LIST_CARD_PERF_STYLE}
      className={cn(
        "text-foreground relative w-full max-w-full min-w-0 overflow-hidden bg-transparent",
        PUBLIC_MAP_LIST_CARD_HEIGHT_CLASSNAME
      )}
      {...buildPublicMapOrganizationListCardOwnerProps({
        ownerId,
        slot: "card",
        notes:
          "Clicking the non-action parts of the card opens the resource detail panel.",
      })}
    >
      <Button
        type="button"
        variant="ghost"
        data-public-map-result-trigger="true"
        aria-label={`Open details for ${item.title}`}
        onClick={openResourceDetails}
        className={cn(
          "group relative z-10 flex h-auto min-h-16 w-full min-w-0 justify-start rounded-xl text-left whitespace-normal transition-[background-color,color] motion-reduce:transition-none",
          "focus-visible:bg-accent focus-visible:text-accent-foreground focus-visible:ring-ring/45 focus-visible:ring-2 focus-visible:ring-inset",
          selected
            ? "bg-accent text-accent-foreground dark:bg-accent/50"
            : "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
          "p-2"
        )}
        {...buildPublicMapOrganizationListCardSurfaceProps({
          ownerId,
          slot: "body",
          surfaceKind: "content",
          notes: "Primary content stack for the public map resource list card.",
        })}
      >
        <div
          className={cn(
            "flex min-w-0 items-center",
            constrainedLayout ? "gap-2.5" : "gap-3"
          )}
          {...buildPublicMapOrganizationListCardSurfaceProps({
            ownerId,
            slot: "identity-row",
            notes:
              "Top identity row containing the resource marker, title, and metadata.",
          })}
        >
          <PublicMapResourceListMedia
            constrainedLayout={constrainedLayout}
            item={item}
            markerColor={markerColor}
            ownerId={ownerId}
          />
          <div
            className={cn(
              "flex min-w-0 flex-1 flex-col justify-center",
              onToggleCollected && "pr-12"
            )}
          >
            <p
              className="text-foreground line-clamp-2 text-sm leading-4 font-semibold text-pretty"
              {...buildPublicMapOrganizationListCardSurfaceProps({
                ownerId,
                slot: "title",
                notes: "Primary resource category text block.",
              })}
            >
              <PublicMapHighlightedText query={query} text={item.title} />
            </p>
            {serviceOutcome ? (
              <p className="text-muted-foreground line-clamp-1 text-xs leading-4 text-pretty">
                <PublicMapHighlightedText query={query} text={serviceOutcome} />
              </p>
            ) : null}
            <PublicMapListMetadataStrip
              itemKeyPrefix="resource"
              items={metadataItems}
              notes="Inline metadata strip for the resource list card."
              ownerId={ownerId}
              query={query}
            />
          </div>
        </div>
      </Button>
      {onToggleCollected ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="border-border/70 bg-background/85 text-muted-foreground hover:bg-muted hover:text-foreground absolute top-1/2 right-2.5 z-20 size-11 -translate-y-1/2 rounded-full border"
          aria-label={
            collected
              ? `Remove ${item.title} from My Map`
              : `Collect ${item.title} in My Map`
          }
          aria-pressed={collected}
          onClick={() => onToggleCollected(item.id)}
        >
          <BookmarkIcon
            className={cn("size-4", collected && "fill-current")}
            aria-hidden
          />
        </Button>
      ) : null}
    </article>
  )
}
