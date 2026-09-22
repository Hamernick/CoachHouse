"use client"

import StatusIndicator from "@/components/8starlabs-ui/status-indicator"
import { getReactGrabOwnerProps } from "@/components/dev/react-grab-surface"
import { cn } from "@/lib/utils"
import { PUBLIC_MAP_OVERLAY_GLASS_CLASSNAME } from "./sidebar-theme"

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
  className,
  count,
  compactOnMobile = false,
  label = "Resources",
}: {
  className?: string
  count: number | null
  compactOnMobile?: boolean
  label?: string
}) {
  const countLabel =
    count === null ? null : resolvePublicMapDirectoryStatusCount(count)

  return (
    <span
      {...getReactGrabOwnerProps({
        ownerId: "public-map-directory-status:active-count",
        component: "PublicMapDirectoryStatusPill",
        source: "src/components/public/public-map-index/directory-status-pill.tsx",
        tokenSource: "src/components/public/public-map-index/sidebar-theme.ts",
        slot: "status",
      })}
      data-public-map-directory-status
      className={cn(
        PUBLIC_MAP_OVERLAY_GLASS_CLASSNAME,
        "pointer-events-auto inline-flex h-8 shrink-0 items-center gap-2 rounded-full border px-2.5 text-xs font-medium",
        className
      )}
      aria-label={
        countLabel === null
          ? `${label} directory status: loading`
          : `${label} directory status: active, ${countLabel}`
      }
    >
      <span aria-hidden="true" className="inline-flex shrink-0">
        <StatusIndicator state="active" size="sm" className="shrink-0 gap-0" />
      </span>
      <span data-public-map-active-label>Active</span>
      {countLabel === null ? (
        <span
          data-public-map-directory-count-loading="true"
          className="bg-muted-foreground/20 h-3 w-8 animate-pulse rounded-full motion-reduce:animate-none"
          aria-hidden="true"
        />
      ) : (
        <span data-public-map-directory-count className="tabular-nums">
          {compactOnMobile ? (
            <>
              <span className="md:hidden">
                {new Intl.NumberFormat(undefined, {
                  notation: "compact",
                  maximumFractionDigits: 0,
                }).format(count ?? 0)}
              </span>
              <span className="hidden md:inline">{countLabel}</span>
            </>
          ) : (
            countLabel
          )}
        </span>
      )}
    </span>
  )
}
