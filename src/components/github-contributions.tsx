"use client"

// Adapted from https://chanhdai.com/components/github-contributions.
// Uses caller-provided activity rather than fetching GitHub account data.
import { useState } from "react"
import { cn } from "@/lib/utils"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  type Activity,
  ContributionGraph,
  ContributionGraphBlock,
  ContributionGraphCalendar,
  ContributionGraphFooter,
  ContributionGraphLegend,
  ContributionGraphTotalCount,
} from "@/components/contribution-graph"

export function ActivityContributions({
  data,
  caption,
  className,
}: {
  data: Activity[]
  caption: string
  className?: string
}) {
  const [focusedDate, setFocusedDate] = useState<string | null>(null)
  return (
    <ContributionGraph
      className={cn("w-full", className)}
      data={data}
      blockSize={14}
      blockMargin={4}
      blockRadius={3}
      fontSize={11}
    >
      <ContributionGraphCalendar
        title="Recorded Coach House activity by day (UTC)"
        className="pb-1 [&>svg]:h-auto [&>svg]:min-w-full"
      >
        {({ activity, dayIndex, weekIndex }) => {
          const label = `${activity.count} recorded ${activity.count === 1 ? "event" : "events"} on ${new Intl.DateTimeFormat(undefined, { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(activity.date))} (UTC)`
          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <g
                  tabIndex={
                    activity.date === (focusedDate ?? data.at(-1)?.date)
                      ? 0
                      : -1
                  }
                  aria-label={label}
                  className="focus-visible:[&>rect]:stroke-ring outline-none focus-visible:[&>rect]:stroke-2"
                  onFocus={() => setFocusedDate(activity.date)}
                  onKeyDown={(event) => {
                    const offset = {
                      ArrowLeft: -7,
                      ArrowRight: 7,
                      ArrowUp: -1,
                      ArrowDown: 1,
                    }[event.key]
                    if (offset === undefined) return
                    event.preventDefault()
                    const blocks = Array.from(
                      event.currentTarget
                        .closest("svg")
                        ?.querySelectorAll<SVGGElement>("g[tabindex]") ?? []
                    )
                    const index = blocks.indexOf(event.currentTarget)
                    blocks[
                      Math.max(0, Math.min(blocks.length - 1, index + offset))
                    ]?.focus()
                  }}
                >
                  <ContributionGraphBlock
                    activity={activity}
                    dayIndex={dayIndex}
                    weekIndex={weekIndex}
                  />
                </g>
              </TooltipTrigger>
              <TooltipContent>
                <p>{label}</p>
              </TooltipContent>
            </Tooltip>
          )
        }}
      </ContributionGraphCalendar>
      <ContributionGraphFooter className="items-center gap-y-2 text-xs">
        <ContributionGraphTotalCount>
          {({ totalCount }) => (
            <p className="text-muted-foreground min-w-0 whitespace-normal">
              {totalCount.toLocaleString()} recorded events · {caption}
            </p>
          )}
        </ContributionGraphTotalCount>
        <ContributionGraphLegend className="text-muted-foreground" />
      </ContributionGraphFooter>
    </ContributionGraph>
  )
}
