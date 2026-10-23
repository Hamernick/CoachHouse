"use client"

import { useState, type ReactNode } from "react"
import ArrowLeftIcon from "lucide-react/dist/esm/icons/arrow-left"
import BookmarkIcon from "lucide-react/dist/esm/icons/bookmark"
import MapPinIcon from "lucide-react/dist/esm/icons/map-pin"

import { PublicProfileEin } from "@/components/public/public-profile-ein"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { TrackedResourceShareButton } from "@/features/public-profiles/client"
import {
  PUBLIC_MAP_RESOURCE_CATEGORY_LABELS,
  resolvePublicMapResourceCategoryColor,
} from "@/lib/public-map/resource-categories"
import { isPublicMapTechnicalSourceUrl } from "@/lib/public-map/resource-link-visibility"
import type { ExternalResourceMapItem } from "@/lib/public-map/resource-map-items"
import { cn } from "@/lib/utils"
import {
  buildResourceAddressLines,
  buildResourceLocation,
  formatResourceVerifiedDate,
  normalizeResourceHref,
  normalizeResourceImageSrc,
  PUBLIC_MAP_RESOURCE_STATUS_LABELS,
} from "./resource-detail-helpers"
import {
  PublicMapResourceAdminActions,
  type PublicMapResourceCurationAction,
} from "./resource-detail-admin-actions"
import { PublicMapResourceCategoryIcon } from "./resource-category-icon"
import { PublicMapResourceSourceLinkPreview } from "./resource-source-link-preview"
import {
  PUBLIC_MAP_DETAIL_CHROME_BUTTON_SURFACE_CLASSNAME,
  PUBLIC_MAP_DETAIL_ICON_BUTTON_CLASSNAME,
  PUBLIC_MAP_DETAIL_IDENTITY_CLASSNAME,
  PUBLIC_MAP_DETAIL_SECTION_CLASSNAME,
  PUBLIC_MAP_DETAIL_TITLE_CLASSNAME,
  PUBLIC_MAP_SIDEBAR_PILL_CLASSNAME,
} from "./sidebar-theme"

function PublicMapResourceIdentityMedia({
  item,
  markerColor,
}: {
  item: ExternalResourceMapItem
  markerColor: string
}) {
  const imageSrc = normalizeResourceImageSrc(item.markerImageUrl)
  const [loaded, setLoaded] = useState(false)
  const [errored, setErrored] = useState(false)
  const showImage = Boolean(imageSrc && !errored)

  return (
    <div className="border-border/70 bg-muted/25 relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border">
      <span
        className="inline-flex size-8 items-center justify-center rounded-full"
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
            loading="eager"
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
    </div>
  )
}

export function PublicMapResourceDetailChrome({
  canManageResourceMap = false,
  collected = false,
  item,
  onBack,
  onToggleCollected,
  resourceMapCurationAction,
}: {
  canManageResourceMap?: boolean
  collected?: boolean
  item: ExternalResourceMapItem
  onBack: () => void
  onToggleCollected?: (resourceId: string) => void
  resourceMapCurationAction?: PublicMapResourceCurationAction
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onBack}
          className={cn(
            PUBLIC_MAP_DETAIL_ICON_BUTTON_CLASSNAME,
            PUBLIC_MAP_DETAIL_CHROME_BUTTON_SURFACE_CLASSNAME
          )}
          aria-label="Back to search"
        >
          <ArrowLeftIcon className="h-4 w-4" aria-hidden />
        </Button>
        <p className="text-foreground text-sm font-medium">
          {item.nonprofit ? "Organization" : "Resource"}
        </p>
      </div>
      <div className="flex items-center gap-1.5">
        {!item.nonprofit ? (
          <TrackedResourceShareButton
            resourceId={item.id}
            resourceTitle={item.title}
            className={cn(
              PUBLIC_MAP_DETAIL_ICON_BUTTON_CLASSNAME,
              PUBLIC_MAP_DETAIL_CHROME_BUTTON_SURFACE_CLASSNAME
            )}
          />
        ) : null}
        {canManageResourceMap &&
        resourceMapCurationAction &&
        !item.nonprofit ? (
          <PublicMapResourceAdminActions
            curationAction={resourceMapCurationAction}
            item={item}
            onComplete={onBack}
          />
        ) : null}
        {onToggleCollected ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              PUBLIC_MAP_DETAIL_ICON_BUTTON_CLASSNAME,
              collected
                ? "border-sky-400/55 bg-sky-500/12 text-sky-600 hover:bg-sky-500/18 dark:border-sky-400/45 dark:bg-sky-400/14 dark:text-sky-300 dark:hover:bg-sky-400/20"
                : PUBLIC_MAP_DETAIL_CHROME_BUTTON_SURFACE_CLASSNAME
            )}
            onClick={() => onToggleCollected(item.id)}
            aria-label={
              collected
                ? `Remove ${item.title} from My Map`
                : `Collect ${item.title} in My Map`
            }
            aria-pressed={collected}
          >
            <BookmarkIcon
              className={cn("size-4", collected && "fill-current")}
              aria-hidden
            />
          </Button>
        ) : null}
      </div>
    </div>
  )
}

export function PublicMapResourceIdentitySection({
  item,
  headingLevel: Heading = "h2",
}: {
  item: ExternalResourceMapItem
  headingLevel?: "h1" | "h2"
}) {
  const location = buildResourceLocation(item)
  const title = resolveResourceIdentityTitle(item)
  const subtitle = resolveResourceIdentitySubtitle(item)
  const markerColor = resolvePublicMapResourceCategoryColor(
    item.primaryResourceCategory
  )

  return (
    <div className={cn(PUBLIC_MAP_DETAIL_IDENTITY_CLASSNAME, "gap-3 sm:flex-col sm:items-center sm:text-center")}>
      <PublicMapResourceIdentityMedia item={item} markerColor={markerColor} />
      <div className="w-full min-w-0 flex-1">
        <Heading className={cn(PUBLIC_MAP_DETAIL_TITLE_CLASSNAME, "text-xl leading-7 tracking-tight sm:text-2xl sm:leading-8")}>{title}</Heading>
        <PublicProfileEin value={item.nonprofit?.ein ?? item.ein} />
        {subtitle ? (
          <p className="text-muted-foreground mx-auto mt-0.5 max-w-lg text-sm leading-5 text-pretty">
            {subtitle}
          </p>
        ) : null}
        {location ? (
          <p className="text-muted-foreground mt-2 inline-flex items-center gap-1.5 text-xs leading-5">
            <MapPinIcon className="size-4 shrink-0" aria-hidden />
            {item.nonprofit ? `${location} · Filing location` : location}
          </p>
        ) : null}
        <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
          {item.resourceCategories.map((category) => (
            <span
              key={category}
              className={cn(
                "inline-flex min-h-6 items-center rounded-full px-2.5 py-1 text-xs leading-none",
                PUBLIC_MAP_SIDEBAR_PILL_CLASSNAME
              )}
            >
              {PUBLIC_MAP_RESOURCE_CATEGORY_LABELS[category]}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

function normalizeResourceIdentityText(value: string | null | undefined) {
  return value?.trim().replace(/\s+/g, " ").toLowerCase() ?? ""
}

export function resolveResourceIdentityTitle(item: ExternalResourceMapItem) {
  const title = item.title.trim()
  const isCoolingCenter =
    item.primaryResourceCategory === "emergency_cooling_centers" ||
    item.resourceCategories.includes("emergency_cooling_centers")
  if (!isCoolingCenter) return title
  if (/^cooling centers?$/i.test(title)) return "Cooling Center"

  const prefixMatch = title.match(/^cooling centers?\s*(?:[|:\-–—]\s*)?(.+)$/i)
  if (prefixMatch?.[1]?.trim()) {
    return `Cooling Center | ${prefixMatch[1].trim()}`
  }

  const suffixMatch = title.match(/^(.+?)\s+cooling centers?$/i)
  if (suffixMatch?.[1]?.trim()) {
    return `Cooling Center | ${suffixMatch[1].trim()}`
  }

  return title
}

function resolveResourceIdentitySubtitle(item: ExternalResourceMapItem) {
  const subtitle = item.subtitle?.trim()
  if (!subtitle) return null
  return normalizeResourceIdentityText(subtitle) ===
    normalizeResourceIdentityText(item.title)
    ? null
    : subtitle
}

function resolveResourceSourceLinkLabel(href: string) {
  try {
    return new URL(href).hostname.replace(/^www\./i, "")
  } catch {
    return "Source"
  }
}

export function resolvePublicMapResourceSourceLinks(
  item: ExternalResourceMapItem
) {
  const candidates = [
    {
      label: item.sourceLabel,
      url: item.sourceUrl,
    },
    ...(item.links ?? [])
      .filter((link) => link.type === "source")
      .map((link) => ({ label: link.label, url: link.url })),
  ]
  const seen = new Set<string>()

  return candidates.flatMap((candidate) => {
    const href = normalizeResourceHref(candidate.url)
    if (!href || isPublicMapTechnicalSourceUrl(href) || seen.has(href)) {
      return []
    }
    seen.add(href)
    return [
      {
        href,
        label: candidate.label?.trim() || resolveResourceSourceLinkLabel(href),
      },
    ]
  })
}

function PublicMapResourceStatusRow({
  children,
  label,
}: {
  children: ReactNode
  label: string
}) {
  return (
    <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3">
      <dt className="text-muted-foreground text-sm leading-5">{label}</dt>
      <dd className="text-foreground min-w-0 text-sm leading-5 font-medium break-words">
        {children}
      </dd>
    </div>
  )
}

export function PublicMapResourceStatusSection({
  item,
}: {
  item: ExternalResourceMapItem
}) {
  const verifiedDate = formatResourceVerifiedDate(item.lastVerifiedAt)
  const sourceLinks = resolvePublicMapResourceSourceLinks(item)
  const sourceLabel = item.sourceLabel?.trim() || null

  return (
    <section className={PUBLIC_MAP_DETAIL_SECTION_CLASSNAME}>
      <h3 className="text-base font-semibold">Details</h3>
      <dl className="mt-3 grid gap-2.5">
        <PublicMapResourceStatusRow label="Status">
          {PUBLIC_MAP_RESOURCE_STATUS_LABELS[item.verificationStatus]}
        </PublicMapResourceStatusRow>
        <PublicMapResourceStatusRow label="Visibility">
          {item.visibility === "superadmin_preview"
            ? "Seed preview"
            : "Published"}
        </PublicMapResourceStatusRow>
        {sourceLinks.length > 0 || sourceLabel ? (
          <PublicMapResourceStatusRow label="Source">
            {sourceLinks.length > 0 ? (
              <div className="flex min-w-0 flex-col items-start gap-1.5">
                {sourceLinks.map((sourceLink) => (
                  <PublicMapResourceSourceLinkPreview
                    key={sourceLink.href}
                    href={sourceLink.href}
                    label={sourceLink.label}
                  />
                ))}
              </div>
            ) : (
              sourceLabel
            )}
          </PublicMapResourceStatusRow>
        ) : null}
        {verifiedDate ? (
          <PublicMapResourceStatusRow label="Last verified">
            {verifiedDate}
          </PublicMapResourceStatusRow>
        ) : null}
      </dl>
    </section>
  )
}

export function PublicMapResourceAddressSection({
  item,
}: {
  item: ExternalResourceMapItem
}) {
  const addressLines = buildResourceAddressLines(item)
  if (!addressLines || addressLines.length === 0) return null

  return (
    <section className={PUBLIC_MAP_DETAIL_SECTION_CLASSNAME}>
      <h3 className="text-base font-semibold">
        {item.nonprofit ? "Filing location" : "Address"}
      </h3>
      <div className="text-muted-foreground mt-2 space-y-1 text-sm leading-6">
        {addressLines.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
    </section>
  )
}
