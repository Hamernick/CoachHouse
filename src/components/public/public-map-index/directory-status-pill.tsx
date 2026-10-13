"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { PublicMapOrganization } from "@/lib/queries/public-map-index"
import { getReactGrabOwnerProps, getReactGrabLinkedSurfaceProps } from "@/components/dev/react-grab-surface"
import StatusIndicator from "@/components/8starlabs-ui/status-indicator"
import { cn } from "@/lib/utils"
import { PUBLIC_MAP_OVERLAY_GLASS_CLASSNAME } from "./sidebar-theme"

function statusSurface(slot: string) {
  return getReactGrabLinkedSurfaceProps({
    ownerId: "public-map-directory-status:active",
    component: "PublicMapDirectoryStatusPill",
    source: "src/components/public/public-map-index/directory-status-pill.tsx",
    slot,
    surfaceKind: "content",
  })
}

export function resolvePublicMapDirectoryStatusCount(count: number) {
  const normalizedCount = Number.isFinite(count) ? Math.max(0, count) : 0
  return normalizedCount.toLocaleString()
}

export function resolvePublicMapDirectoryCount(
  organizationCount: number,
  totalResourceCount: number | null
) {
  return totalResourceCount === null
    ? null
    : organizationCount + totalResourceCount
}

export type DirectoryFormationCounts = { registered: number; inProgress: number }

export function resolveDirectoryFormationCounts(
  organizations: Pick<PublicMapOrganization, "formationStatus">[]
): DirectoryFormationCounts {
  return organizations.reduce((counts, organization) => {
    if (organization.formationStatus === "approved") counts.registered += 1
    if (organization.formationStatus === "in_progress" || organization.formationStatus === "pre_501c3") counts.inProgress += 1
    return counts
  }, { registered: 0, inProgress: 0 })
}

export function PublicMapDirectoryStatusHeader({
  label = "Resources",
}: {
  label?: string
}) {
  return (
    <div
      data-public-map-directory-status-header="true"
      className="flex h-8 shrink-0 items-center"
    >
      <p className="text-muted-foreground min-w-0 truncate text-xs font-medium tracking-[0.08em] uppercase">
        {label}
      </p>
    </div>
  )
}

export function PublicMapDirectoryStatusPill({
  unstyled = false,
  className,
  count,
  estimated = false,
  formationCounts,
  label = "Resources",
}: {
  className?: string
  count: number | null
  estimated?: boolean
  formationCounts?: DirectoryFormationCounts
  label?: string
  unstyled?: boolean
}) {
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [tooltipOpen, setTooltipOpen] = useState(false)
  const countLabel =
    count === null ? null : resolvePublicMapDirectoryStatusCount(count)

  const registered = formationCounts?.registered ?? 0
  const inProgress = formationCounts?.inProgress ?? 0
  const unclassified = count === null ? null : Math.max(0, count - registered - inProgress)
  const breakdown = (
    <div className="flex max-w-72 flex-col gap-1">
      <span>Registered 501(c)(3): {registered.toLocaleString()} | In progress: {inProgress.toLocaleString()}</span>
      {unclassified === null ? <span>Loading directory count…</span> : unclassified > 0 ? (
        <span>Status not provided: {estimated ? "about " : ""}{unclassified.toLocaleString()}</span>
      ) : null}
      <span>Based on reported formation status.</span>
    </div>
  )

  return (
    <Popover open={detailsOpen} onOpenChange={setDetailsOpen}>
      <Tooltip open={!detailsOpen && tooltipOpen} onOpenChange={setTooltipOpen}>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              {...getReactGrabOwnerProps({
                ownerId: "public-map-directory-status:active",
                component: "PublicMapDirectoryStatusPill",
                source: "src/components/public/public-map-index/directory-status-pill.tsx",
                slot: "status",
                tokenSource: "src/components/public/public-map-index/sidebar-theme.ts",
                notes: "Active public directory listing count, independent of visible map pins.",
              })}
              className={cn(
                "hover:bg-transparent hover:text-inherit dark:hover:bg-transparent pointer-events-auto relative isolate inline-flex h-8 shrink-0 touch-manipulation items-center gap-2 rounded-full px-0 text-xs font-medium after:absolute after:-z-10 after:inset-x-0 after:top-1/2 after:h-11 after:-translate-y-1/2",
                !unstyled && [PUBLIC_MAP_OVERLAY_GLASS_CLASSNAME, "rounded-full border px-2.5"],
                className
              )}
              aria-label={
                countLabel === null
                  ? `${label}: loading nfp's; show formation status breakdown`
                  : `${estimated ? "Approximately " : ""}${countLabel} nfp's; show formation status breakdown`
              }
            >
              <span aria-hidden="true" className="inline-flex shrink-0">
                <StatusIndicator state="active" size="sm" className="shrink-0 gap-0" />
              </span>
              <Badge {...statusSurface("label")} variant="secondary" className="rounded-full">nfp&apos;s</Badge>
              {countLabel === null ? (
                <span
                  data-public-map-directory-count-loading="true"
                  className="bg-muted-foreground/20 h-3 w-8 animate-pulse rounded-full motion-reduce:animate-none"
                  aria-hidden="true"
                />
              ) : (
                <span {...statusSurface("count")} className="tabular-nums">{countLabel}</span>
              )}
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={8}>{breakdown}</TooltipContent>
      </Tooltip>
      <PopoverContent side="top" sideOffset={8} aria-label="Nonprofit formation status" className="w-auto max-w-[calc(100vw-2rem)] rounded-md p-3 text-xs shadow-none">
        {breakdown}
      </PopoverContent>
    </Popover>
  )
}
