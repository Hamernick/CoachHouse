"use client"

import {
  memo,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react"
import {
  RoadmapTocStatusDot,
  RoadmapTocCompletedRailSegment,
  RoadmapTocCompletionCheck,
} from "@/components/roadmap/roadmap-status-indicators"
import { resolveRoadmapSectionDerivedStatus } from "@/lib/roadmap/helpers"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { particleSourceKey } from "../lib"
import type { ParticleSource } from "../types"
import { useWorkspaceParticles } from "./particle-context"
import { ParticlePreview } from "./particle-preview"
import { ParticleSourceHandle } from "./particle-source-handle"
import { workspaceParticleSurfaceProps } from "./particle-surface"

const PARTICLE_TILE_SOURCE =
  "src/features/workspace-particles/components/particle-tile.tsx"
const PARTICLE_TILE_COMPONENT = "ParticleTile"

function tileSurfaceProps(
  sourceKey: string,
  slot: string,
  surfaceKind: "trigger" | "content" | "root" = "content"
) {
  return workspaceParticleSurfaceProps({
    component: PARTICLE_TILE_COMPONENT,
    source: PARTICLE_TILE_SOURCE,
    slot: `${slot}:${sourceKey}`,
    surfaceKind,
  })
}

export const ParticleTile = memo(function ParticleTile({
  source,
}: {
  source: ParticleSource
}) {
  const controller = useWorkspaceParticles()
  const placed =
    Boolean(source.canvasNodeId) ||
    controller?.state.items.some(
      (item) => particleSourceKey(item.source) === particleSourceKey(source.ref)
    )
  const sourceKey = particleSourceKey(source.ref)
  const isCalendar =
    source.ref.kind === "roadmap" && source.ref.id === "board_calendar"
  const isLargePreview =
    source.ref.kind === "organization" ||
    (source.ref.kind === "roadmap" && source.ref.id === "board_calendar")
  const isRoadmapFile = source.ref.kind === "roadmap" && !isCalendar
  const roadmapStatus = source.section
    ? resolveRoadmapSectionDerivedStatus(source.section)
    : "not_started"
  const fitContent = source.ref.kind === "activity" || isRoadmapFile
  const tileRef = useRef<HTMLDivElement>(null)
  const [contentRows, setContentRows] = useState(9)
  useLayoutEffect(() => {
    const tile = tileRef.current
    if (!fitContent || !tile) return
    // Desktop grid: 8px rows + 8px gaps. Keep unused space outside the card.
    const measure = () =>
      setContentRows(Math.ceil((tile.offsetHeight + 8) / 16))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(tile)
    return () => observer.disconnect()
  }, [fitContent])
  return (
    <Card
      ref={tileRef}
      data-particle-tile
      style={{ "--particle-row-span": contentRows } as CSSProperties}
      {...tileSurfaceProps(sourceKey, "particle-tile", "root")}
      className={cn(
        "hover:border-foreground/20 focus-within:border-foreground/25 h-full min-w-0 gap-0 overflow-hidden rounded-[12px] py-0 shadow-none lg:row-span-9",
        (isLargePreview || source.ref.kind === "activity") &&
          "min-[360px]:col-span-2 sm:col-span-2",
        source.ref.kind === "organization" && "row-span-2 lg:row-span-16",
        isCalendar && "row-span-3 lg:row-span-26",
        fitContent &&
          "lg:row-span-[var(--particle-row-span)] lg:h-auto lg:self-start",
        isRoadmapFile &&
          "lg:text-muted-foreground lg:hover:text-foreground lg:hover:bg-accent/50 lg:focus-within:bg-accent/50 motion-reduce:transition-none lg:relative lg:col-span-2 lg:rounded-md lg:border-0 lg:bg-transparent lg:transition-colors lg:duration-150",
        isRoadmapFile && roadmapStatus === "complete" && "lg:text-foreground"
      )}
    >
      {isRoadmapFile ? (
        <span
          aria-hidden
          className="bg-border/60 pointer-events-none absolute inset-y-1.5 left-1 hidden w-px rounded-full lg:block"
        />
      ) : null}
      {isRoadmapFile && roadmapStatus === "complete" ? (
        <RoadmapTocCompletedRailSegment className="inset-y-1.5 left-1 hidden h-auto lg:block" />
      ) : null}
      <CardHeader
        className={cn(
          "items-center gap-1 px-2 py-1.5 lg:grid-rows-1",
          isRoadmapFile && "lg:gap-2 lg:pr-2 lg:pl-4"
        )}
      >
        <CardTitle
          {...tileSurfaceProps(sourceKey, "particle-title", "content")}
          className={cn(
            "min-w-0 truncate text-[11px] leading-4",
            isRoadmapFile &&
              "lg:flex lg:items-center lg:gap-2 lg:text-[13px] lg:leading-5 lg:font-medium"
          )}
          title={source.title}
        >
          {isRoadmapFile ? (
            <span className="hidden shrink-0 lg:flex">
              <RoadmapTocStatusDot status={roadmapStatus} />
            </span>
          ) : null}
          <span className="truncate">{source.title}</span>
          {isRoadmapFile ? (
            <span className="ml-auto hidden shrink-0 lg:flex">
              <RoadmapTocCompletionCheck status={roadmapStatus} />
            </span>
          ) : null}
        </CardTitle>
        {source.available && controller?.canEdit ? (
          <CardAction className="flex items-center gap-0.5 lg:row-span-1 lg:self-center">
            <ParticleSourceHandle
              source={source.ref}
              title={source.title}
              dragOnly
              doubleClickToAdd
              clickLabel={placed ? "show" : "add"}
              keyboardAccessible
              className="size-6 rounded-md p-0 transition-none [&_svg]:size-3.5"
              surfaceProps={tileSurfaceProps(
                sourceKey,
                "particle-drag",
                "trigger"
              )}
            />
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent
        {...tileSurfaceProps(sourceKey, "particle-preview-frame", "root")}
        className={cn(
          "relative m-1 mt-0 min-h-0 flex-1 overflow-hidden rounded-[8px] p-0",
          fitContent && "lg:flex-none",
          isRoadmapFile && "lg:hidden"
        )}
      >
        <div
          inert
          aria-hidden
          className={cn(
            "pointer-events-none size-full min-h-0 overflow-hidden",
            fitContent && "lg:h-auto"
          )}
        >
          <ParticlePreview source={source} />
        </div>
      </CardContent>
    </Card>
  )
})
