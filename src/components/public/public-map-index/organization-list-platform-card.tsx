"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import type { PlatformOrganizationMapItem } from "@/lib/public-map/resource-map-items"
import { buildPublicImageTransformUrl } from "@/lib/storage/public-url"
import { cn } from "@/lib/utils"

import {
  buildInitials,
  buildLocationMetadataItems,
  PUBLIC_MAP_LIST_CARD_HEIGHT_CLASSNAME,
  PUBLIC_MAP_LIST_CARD_PERF_STYLE,
  PublicMapHighlightedText,
  PublicMapListMetadataStrip,
} from "./organization-list-card-shared"

export function PublicMapPlatformOrganizationListCard({
  constrainedLayout,
  item,
  selected,
  query,
  onOpenDetails,
  onSelectOrg,
}: {
  constrainedLayout: boolean
  item: PlatformOrganizationMapItem
  selected: boolean
  query?: string
  onOpenDetails?: (id: string) => void
  onSelectOrg: (id: string) => void
}) {
  const org = item.organization
  const categoryMetadataItems = buildLocationMetadataItems({
    city: org.city,
    country: org.country,
    primaryGroup: org.primaryGroup,
    isOnlineOnly: org.isOnlineOnly,
    state: org.state,
  })
  const fallbackInitials = buildInitials(org.name)
  const hasLogoImage = Boolean(org.logoUrl && org.logoUrl.trim().length > 0)
  const avatarImageSrc = buildPublicImageTransformUrl(
    org.logoUrl ?? org.headerUrl ?? undefined,
    {
      width: 144,
      height: 144,
      resize: hasLogoImage ? "contain" : "cover",
    }
  )

  const openDetails = () =>
    onOpenDetails ? onOpenDetails(org.id) : onSelectOrg(org.id)

  return (
    <article
      key={org.id}
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
        aria-label={`Open details for ${org.name}`}
        onClick={openDetails}
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
          <Avatar
            className={cn(
              "border-border/60 mt-0.5 rounded-xl border",
              constrainedLayout ? "size-11" : "size-12",
              hasLogoImage && "bg-white"
            )}

          >
            <AvatarImage
              src={avatarImageSrc}
              alt={org.name}
              className={cn(
                hasLogoImage ? "object-contain p-1.5" : "object-cover"
              )}
            />
            <AvatarFallback className="bg-muted/45 text-foreground rounded-xl text-xs font-semibold">
              {fallbackInitials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 pt-0.5">
            <p
              data-public-map-list-title=""
              className="text-foreground truncate text-base leading-snug font-semibold"

            >
              <PublicMapHighlightedText query={query} text={org.name} />
            </p>
            <PublicMapListMetadataStrip
              itemKeyPrefix="category"
              items={categoryMetadataItems}
              query={query}
            />
          </div>
        </div>
      </Button>
    </article>
  )
}
