"use client"

import { PUBLIC_MAP_GROUP_LABELS } from "@/lib/public-map/groups"
import type { PublicMapOrganization } from "@/lib/queries/public-map-index"
import { cn } from "@/lib/utils"
import { buildPublicMapOrganizationListCardSurfaceProps } from "./react-grab"

export const PUBLIC_MAP_LIST_CARD_PERF_STYLE = {
  contentVisibility: "auto",
  containIntrinsicSize: "64px",
} as const

export const PUBLIC_MAP_LIST_CARD_HEIGHT_CLASSNAME = "min-h-16"

export function buildInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "O"
  if (parts.length === 1) return parts[0]!.slice(0, 1).toUpperCase()
  return `${parts[0]!.slice(0, 1)}${parts[1]!.slice(0, 1)}`.toUpperCase()
}

export function buildLocationMetadataItems({
  city,
  country,
  primaryGroup,
  isOnlineOnly,
  state,
}: {
  city?: string | null
  country?: string | null
  primaryGroup: PublicMapOrganization["primaryGroup"]
  isOnlineOnly: boolean
  state?: string | null
}) {
  const location = isOnlineOnly
    ? "Online resource"
    : [city, state].filter(Boolean).join(", ") || country || null
  return [PUBLIC_MAP_GROUP_LABELS[primaryGroup], location].filter(
    (item): item is string => Boolean(item)
  )
}

export function PublicMapHighlightedText({
  query,
  text,
}: {
  query?: string
  text: string
}) {
  const normalizedQuery = query?.trim().toLocaleLowerCase() ?? ""
  const matchIndex = text.toLocaleLowerCase().indexOf(normalizedQuery)
  if (!normalizedQuery || matchIndex === -1) return text

  return (
    <>
      {text.slice(0, matchIndex)}
      <mark className="bg-primary/15 rounded-sm px-0 text-inherit">
        {text.slice(matchIndex, matchIndex + normalizedQuery.length)}
      </mark>
      {text.slice(matchIndex + normalizedQuery.length)}
    </>
  )
}

export function PublicMapListMetadataStrip({
  className,
  itemKeyPrefix,
  items,
  notes,
  ownerId,
  query,
}: {
  className?: string
  itemKeyPrefix: string
  items: string[]
  notes: string
  ownerId: string
  query?: string
}) {
  return (
    <div
      className={cn(
        "text-muted-foreground mt-0 flex max-w-full items-center gap-2 text-xs leading-4",
        className
      )}
      {...buildPublicMapOrganizationListCardSurfaceProps({
        ownerId,
        slot: "meta-row",
        notes,
      })}
    >
      <div
        className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-0"
        {...buildPublicMapOrganizationListCardSurfaceProps({
          ownerId,
          slot: "location",
          notes,
        })}
      >
        {items.map((item, index) => (
          <span
            key={`${itemKeyPrefix}-meta-${index}`}
            className="inline-flex max-w-full min-w-0 items-center"
          >
            {index > 0 ? (
              <span aria-hidden className="text-muted-foreground/70 mr-1.5">
                •
              </span>
            ) : null}
            <span className="min-w-0 text-pretty break-words">
              <PublicMapHighlightedText query={query} text={item} />
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}
