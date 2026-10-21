"use client"

import { useEffect, useRef } from "react"
import { notifyWorkspaceCalendarChanged } from "@/lib/roadmap/calendar-events"
import { particleCalendarChanged } from "../lib/particle-event-calendar"
import type { ParticleGraph } from "../types"

/** Includes confirmed local saves and graph updates delivered by the existing
 * workspace owner. Transient placement, dragging and typing never notify. */
export function useParticleCalendarInvalidation(graph: ParticleGraph | null) {
  const previous = useRef(graph)
  useEffect(() => {
    const before = previous.current
    previous.current = graph
    if (before && graph && before.workspaceId === graph.workspaceId && particleCalendarChanged(before, graph))
      notifyWorkspaceCalendarChanged(graph.workspaceId)
  }, [graph])
}
