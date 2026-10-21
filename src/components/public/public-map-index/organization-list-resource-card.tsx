"use client"

import {
  resolvePublicMapItemSelectableId,
  type ExternalResourceMapItem,
} from "@/lib/public-map/resource-map-items"
import {
  PUBLIC_MAP_RESOURCE_CATEGORY_LABELS,
  resolvePublicMapResourceCategoryColor,
} from "@/lib/public-map/resource-categories"
import { Button } from "@/components/ui/button"
import BookmarkIcon from "lucide-react/dist/esm/icons/bookmark"
import { cn } from "@/lib/utils"

import {
  PUBLIC_MAP_LIST_CARD_HEIGHT_CLASSNAME,
  PUBLIC_MAP_LIST_CARD_PERF_STYLE,
  PublicMapHighlightedText,
  PublicMapListMetadataStrip,
} from "./organization-list-card-shared"
import { PublicMapResourceCategoryIcon } from "./resource-category-icon"

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
  const metadataItems = item.nonprofit
    ? ["Nonprofit organization", [item.city, item.state].filter(Boolean).join(", ")]
    : [
        PUBLIC_MAP_RESOURCE_CATEGORY_LABELS[item.primaryResourceCategory],
        item.latitude === null && item.longitude === null
          ? "Online resource"
          : [item.city, item.state].filter(Boolean).join(", ") || item.country || "Location available",
      ]

  const markerColor = resolvePublicMapResourceCategoryColor(
    item.primaryResourceCategory
  )
  const openResourceDetails = () => onSelectItem?.(selectableItemId)

  return (
    <article
      key={item.id}
      style={PUBLIC_MAP_LIST_CARD_PERF_STYLE}
      className={cn(
        "text-foreground relative w-full max-w-full min-w-0 overflow-hidden bg-transparent p-1",
        PUBLIC_MAP_LIST_CARD_HEIGHT_CLASSNAME
      )}

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
          "px-3 py-2"
        )}

      >
        <div
          className={cn(
            "flex min-w-0 items-center",
            constrainedLayout ? "gap-3" : "gap-4"
          )}

        >
          <span
            className={cn(
              "mt-0.5 inline-flex shrink-0 items-center justify-center rounded-full shadow-sm",
              constrainedLayout ? "size-11" : "size-12"
            )}
            style={{ backgroundColor: markerColor }}

          >
            <PublicMapResourceCategoryIcon
              category={item.primaryResourceCategory}
              className="size-5 text-white"
              aria-hidden
            />
          </span>
          <div
            className={cn(
              "min-w-0 flex-1 pt-0.5",
              onToggleCollected && "pr-12"
            )}
          >
            <p
              data-public-map-list-title=""
              className="text-foreground truncate text-base leading-snug font-semibold"

            >
              <PublicMapHighlightedText query={query} text={item.title} />
            </p>
            <PublicMapListMetadataStrip
              itemKeyPrefix="resource"
              items={metadataItems}
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
