"use client"

import { useState } from "react"
import Link from "next/link"
import ArrowUpRight from "lucide-react/dist/esm/icons/arrow-up-right"
import CheckCircle2 from "lucide-react/dist/esm/icons/check-circle-2"
import WaypointsIcon from "lucide-react/dist/esm/icons/waypoints"

import { Button } from "@/components/ui/button"
import { getTrackIcon } from "@/lib/accelerator/track-icons"
import type { ModuleCardStatus } from "@/lib/accelerator/progress"
import { cn } from "@/lib/utils"

import type { RoadmapRailItem, TimelineCard } from "./types"

const STATUS_BADGE_CLASS =
  "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium"

function statusMeta(item: RoadmapRailItem) {
  if (item.status === "complete") {
    return {
      label: "Complete",
      dotClass: "bg-emerald-500",
      badgeClass:
        "border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-500/15 dark:text-emerald-200",
    }
  }
  if (item.status === "in_progress") {
    return {
      label: "In progress",
      dotClass: "bg-amber-500",
      badgeClass:
        "border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-900/50 dark:bg-amber-500/15 dark:text-amber-200",
    }
  }
  return {
    label: "Not started",
    dotClass: "bg-zinc-400 dark:bg-zinc-500",
    badgeClass:
      "border-zinc-300 bg-zinc-100 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100",
  }
}

function moduleStatusMeta(status: ModuleCardStatus) {
  if (status === "completed") {
    return {
      label: "Completed",
      showCheck: true,
      dotClass: "bg-emerald-500",
      badgeClass:
        "border-emerald-300 bg-emerald-50/95 text-emerald-700 dark:border-emerald-500/35 dark:bg-emerald-500/12 dark:text-emerald-200",
    }
  }
  if (status === "in_progress") {
    return {
      label: "In progress",
      showCheck: false,
      dotClass: "bg-amber-500",
      badgeClass:
        "border-amber-300 bg-amber-50/95 text-amber-700 dark:border-amber-500/35 dark:bg-amber-500/12 dark:text-amber-200",
    }
  }
  return {
    label: "Not started",
    showCheck: false,
    dotClass: "bg-zinc-400 dark:bg-zinc-500",
    badgeClass: "border-border/60 bg-background/70 text-muted-foreground",
  }
}

function ctaLabelFromRoadmapStatus(status: RoadmapRailItem["status"]) {
  if (status === "complete") return "View"
  if (status === "in_progress") return "Continue"
  return "Start"
}

function ctaLabelFromModuleStatus(status: ModuleCardStatus) {
  if (status === "completed") return "View"
  if (status === "in_progress") return "Continue"
  return "Start"
}

type RoadmapCardStatusBadgeProps = {
  label: string
  badgeClass: string
  dotClass: string
  showCheck?: boolean
}

function RoadmapCardStatusBadge({ label, badgeClass, dotClass, showCheck = false }: RoadmapCardStatusBadgeProps) {
  return (
    <span
      className={cn(
        STATUS_BADGE_CLASS,
        badgeClass,
        "overflow-hidden transition-all duration-200 ease-out",
        "sm:gap-1 sm:px-2 sm:py-0.5",
        "max-sm:h-6 max-sm:w-6 max-sm:justify-center max-sm:gap-0 max-sm:p-0",
      )}
    >
      {showCheck ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden /> : <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dotClass)} aria-hidden />}
      <span
        className={cn(
          "overflow-hidden whitespace-nowrap transition-[max-width,opacity,margin-left] duration-200 ease-out",
          "sm:ml-1 sm:max-w-[7.5rem] sm:opacity-100",
          "max-sm:ml-0 max-sm:max-w-0 max-sm:opacity-0",
        )}
      >
        {label}
      </span>
    </span>
  )
}

type RoadmapCardDescriptionProps = {
  id: string
  text: string
}

function RoadmapCardDescription({ id, text }: RoadmapCardDescriptionProps) {
  const [expanded, setExpanded] = useState(false)
  const canExpand = text.trim().length > 60

  return (
    <div className="min-h-[1.35rem] max-w-[22ch] sm:max-w-[28ch] lg:max-w-[32ch]">
      <p
        id={id}
        className={cn(
          "overflow-hidden text-xs leading-relaxed text-muted-foreground transition-[max-height] duration-300 ease-out",
          expanded ? "max-h-[9rem]" : "max-h-[1.35rem]",
        )}
      >
        <span className={cn("block whitespace-pre-line", !expanded && "line-clamp-1")}>{text}</span>
      </p>
      {canExpand ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-controls={id}
          aria-expanded={expanded}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            setExpanded((current) => !current)
          }}
          className="mt-1 h-auto px-0 py-0 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-transparent hover:text-foreground"
        >
          {expanded ? "View less" : "View more"}
        </Button>
      ) : null}
    </div>
  )
}

type RoadmapRailCardSnakeGridProps = {
  cards: TimelineCard[]
  onDeliverableSelect: (index: number) => void
}

export function RoadmapRailCardSnakeGrid({ cards, onDeliverableSelect }: RoadmapRailCardSnakeGridProps) {
  if (cards.length === 0) {
    return (
      <p className="mt-4 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
        No roadmap sections found yet.
      </p>
    )
  }

  return (
    <div className="mt-4">
      <div className="relative">
        <div className="relative z-10 grid auto-rows-[minmax(116px,auto)] gap-3 sm:grid-cols-1 xl:grid-cols-2 2xl:grid-cols-2 md:gap-4">
          {cards.map((card) => {
            if (card.kind === "deliverable") {
              const { item } = card
              const Icon = WaypointsIcon
              const meta = statusMeta(item)
              const ctaLabel = ctaLabelFromRoadmapStatus(item.status)

              return (
                <div key={card.key} className="min-w-0 h-full">
                  <article
                    className={cn(
                      "group relative flex h-full min-h-[116px] min-w-0 overflow-hidden rounded-[20px] border border-border/60 bg-card text-left transition-transform duration-300 ease-out",
                      "hover:-translate-y-1",
                      "focus-within:outline-none focus-within-visible:ring-2 focus-within-visible:ring-primary/40 focus-within-visible:ring-offset-2",
                    )}
                  >
                    <div className="relative m-[5px] w-[92px] shrink-0 overflow-hidden rounded-[14px] border border-border/60 bg-muted/20">
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span
                          data-roadmap-node="true"
                          className="inline-flex h-10 min-w-10 items-center justify-center rounded-lg border border-border/60 bg-background/90 px-3 text-muted-foreground"
                        >
                          <Icon className="h-4 w-4" aria-hidden />
                        </span>
                      </div>
                    </div>

                    <div className="min-w-0 flex flex-1 flex-col gap-1 py-2.5 pl-1 pr-4">
                      <div className="flex items-start justify-between gap-3">
                        <p className="line-clamp-1 text-sm font-semibold text-foreground">{item.displayTitle}</p>
                        <RoadmapCardStatusBadge label={meta.label} badgeClass={meta.badgeClass} dotClass={meta.dotClass} />
                      </div>
                      <RoadmapCardDescription id={`deliverable-description-${item.id}`} text={item.displaySubtitle} />
                      <div className="mt-auto flex items-center justify-end">
                        <Link
                          href={item.href}
                          title={item.displayTitle}
                          aria-label={`Go to ${item.displayTitle}`}
                          onClick={() => onDeliverableSelect(item.idx)}
                          className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                        >
                          {ctaLabel}
                          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                        </Link>
                      </div>
                    </div>
                  </article>
                </div>
              )
            }

            const { module } = card
            const meta = moduleStatusMeta(module.status)
            const ModuleTrackIcon = getTrackIcon(module.groupTitle ?? module.title)
            const ctaLabel = ctaLabelFromModuleStatus(module.status)

            return (
              <div key={card.key} className="min-w-0 h-full">
                <article
                  className={cn(
                    "group flex h-full min-h-[116px] min-w-0 overflow-hidden rounded-[20px] border border-border/60 bg-card text-left transition-transform duration-300 ease-out",
                    "hover:-translate-y-1 focus-within:outline-none focus-within-visible:ring-2 focus-within-visible:ring-ring/50",
                  )}
                >
                  <div className="relative m-[5px] w-[92px] shrink-0 overflow-hidden rounded-[14px] border border-border/60 bg-muted/20">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span
                        data-roadmap-node="true"
                        title={module.groupTitle ?? module.title}
                        aria-label={module.groupTitle ?? module.title}
                        className="inline-flex h-10 min-w-10 items-center justify-center rounded-lg border border-border/60 bg-background/90 px-3 text-muted-foreground"
                      >
                        <ModuleTrackIcon className="h-4 w-4" aria-hidden />
                      </span>
                    </div>
                  </div>

                  <div className="min-w-0 flex flex-1 flex-col gap-1 py-2.5 pl-1 pr-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="line-clamp-1 text-sm font-semibold text-foreground">{module.title}</p>
                      <RoadmapCardStatusBadge label={meta.label} badgeClass={meta.badgeClass} dotClass={meta.dotClass} showCheck={meta.showCheck} />
                    </div>
                    {module.description ? <RoadmapCardDescription id={`module-description-${module.id}`} text={module.description} /> : <div className="min-h-[1.35rem]" aria-hidden />}
                    <div className="mt-auto flex items-center justify-end">
                      <Link
                        href={module.href}
                        className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                      >
                        {ctaLabel}
                        <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                      </Link>
                    </div>
                  </div>
                </article>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
