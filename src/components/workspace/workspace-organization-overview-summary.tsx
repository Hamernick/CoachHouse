"use client"

import Image from "next/image"
import { useEffect, useState } from "react"
import ImageIcon from "lucide-react/dist/esm/icons/image"

import { GridBackground } from "@/components/ui/grid-background"
import { WORKSPACE_TEXT_STYLES } from "@/components/workspace/workspace-typography"
import { cn } from "@/lib/utils"

const BANNER_ASPECT_RATIO = 3.7 / 1

export function compactWorkspaceUsd(cents: number) {
  const dollars = Math.max(0, cents) / 100
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(dollars)
}

function useImageLoaded(src: string) {
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setLoaded(false)
  }, [src])

  return { loaded, setLoaded }
}

export function WorkspaceOrganizationOverviewSummary({
  compact = false,
  fundingGoalCents,
  headerUrl,
  logoUrl,
  peopleCount,
  programsCount,
  subtitle,
  title,
}: {
  compact?: boolean
  fundingGoalCents: number
  headerUrl: string
  logoUrl: string
  peopleCount: number
  programsCount: number
  subtitle: string
  title: string
}) {
  const headerImage = useImageLoaded(headerUrl)
  const logoImage = useImageLoaded(logoUrl)

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col",
        compact ? "size-full gap-1.5 p-1.5" : "gap-3 pb-0.5"
      )}
    >
      <div
        className={cn(
          "bg-muted/30 ring-border/50 relative w-full shrink-0 overflow-hidden ring-1",
          compact
            ? "h-[38%] min-h-0 rounded-[6px]"
            : "min-h-[124px] rounded-[18px]"
        )}
        style={compact ? undefined : { aspectRatio: BANNER_ASPECT_RATIO }}
      >
        {headerUrl ? (
          <>
            <Image
              src={headerUrl}
              alt=""
              fill
              priority={!compact}
              sizes={
                compact
                  ? "180px"
                  : "(max-width: 768px) 92vw, (max-width: 1280px) 520px, 760px"
              }
              className={cn(
                "object-cover object-center transition-opacity duration-300",
                headerImage.loaded ? "opacity-100" : "opacity-0"
              )}
              onLoad={() => headerImage.setLoaded(true)}
            />
            <div
              aria-hidden
              className={cn(
                "from-muted/70 via-muted/40 absolute inset-0 bg-gradient-to-br to-transparent transition-opacity duration-300",
                headerImage.loaded ? "opacity-0" : "opacity-100"
              )}
            />
          </>
        ) : (
          <GridBackground
            className={compact ? "rounded-[6px]" : "rounded-[18px]"}
          />
        )}
      </div>

      <div
        className={cn(
          "flex min-w-0 items-start",
          compact ? "gap-1.5" : "gap-3"
        )}
      >
        <div
          className={cn(
            "bg-background ring-border/60 relative shrink-0 overflow-hidden ring-1",
            compact ? "size-6 rounded-[6px]" : "size-12 rounded-[14px]"
          )}
        >
          {logoUrl ? (
            <>
              <Image
                src={logoUrl}
                alt=""
                fill
                priority={!compact}
                sizes={compact ? "24px" : "44px"}
                className={cn(
                  "object-cover transition-opacity duration-300",
                  logoImage.loaded ? "opacity-100" : "opacity-0"
                )}
                onLoad={() => logoImage.setLoaded(true)}
              />
              <div
                aria-hidden
                className={cn(
                  "bg-muted/55 absolute inset-0 transition-opacity duration-300",
                  logoImage.loaded ? "opacity-0" : "opacity-100"
                )}
              />
            </>
          ) : (
            <div className="text-muted-foreground grid size-full place-items-center">
              <ImageIcon
                className={compact ? "size-3" : "h-4.5 w-4.5"}
                aria-hidden
              />
            </div>
          )}
        </div>
        <div className={cn("min-w-0", compact ? "space-y-0" : "space-y-0.5")}>
          <h3
            className={cn(
              "text-foreground",
              compact
                ? "line-clamp-1 text-[10px] leading-3 font-semibold"
                : `line-clamp-2 ${WORKSPACE_TEXT_STYLES.surfaceTitle}`
            )}
          >
            {title}
          </h3>
          <p
            className={cn(
              "line-clamp-1",
              compact
                ? "text-muted-foreground text-[8px] leading-3"
                : WORKSPACE_TEXT_STYLES.surfaceSubtitle
            )}
          >
            {subtitle}
          </p>
        </div>
      </div>

      <dl
        className={cn(
          "border-border/50 grid grid-cols-3 border-t",
          compact ? "mt-auto gap-1 pt-1" : "gap-3 pt-3"
        )}
      >
        <OrganizationStat
          compact={compact}
          label="Objects"
          value={programsCount}
        />
        <OrganizationStat
          compact={compact}
          label={peopleCount === 1 ? "Person" : "People"}
          value={peopleCount}
        />
        <OrganizationStat
          compact={compact}
          label="Raising"
          value={compactWorkspaceUsd(fundingGoalCents)}
        />
      </dl>
    </div>
  )
}

function OrganizationStat({
  compact,
  label,
  value,
}: {
  compact: boolean
  label: string
  value: number | string
}) {
  return (
    <div className="min-w-0">
      <dt
        className={
          compact
            ? "text-muted-foreground truncate text-[7px] leading-2.5"
            : WORKSPACE_TEXT_STYLES.statLabel
        }
      >
        {label}
      </dt>
      <dd
        className={cn(
          "truncate tabular-nums",
          compact
            ? "text-[9px] leading-3 font-semibold"
            : `mt-1 ${WORKSPACE_TEXT_STYLES.statValue}`
        )}
      >
        {value}
      </dd>
    </div>
  )
}
