"use client"

import { useCallback, useRef } from "react"
import { createParticle } from "@/features/workspace-particles/client"
import type { WorkspaceFinanceOpportunityInput } from "@/features/workspace-finance"
import type { PlanningControls } from "./use-particle-plans"

// Event handlers read current permissions, pending state and graph without
// invalidating the retained opportunity list on canvas selection or autosave.
export function useOpportunityCanvasActions(organizationId: string, current: PlanningControls) {
  const latest = useRef(current)
  latest.current = current
  const onAddToWorkspace = useCallback(async (item: WorkspaceFinanceOpportunityInput, screenPosition?: { x: number; y: number }) => {
    const controls = latest.current
    const graph = controls.getCurrentGraph()
    if (!graph || !controls.canEdit || controls.pending)
      return false
    const position = screenPosition ? controls.flow.current?.screenToFlowPosition(screenPosition) : undefined
    if (screenPosition && !position) return false
    const existing = graph.particles.find(
      (p) =>
        p.type === "activity" &&
        p.data.widget?.kind === "opportunity" &&
        p.data.widget.opportunityId === item.id &&
        p.data.widget.organizationId === organizationId
    )
    if (existing) {
      if (position && existing.locked) return false
      if (
        (existing.canvasHidden || position) &&
        !(await controls.commit([
          {
            kind: "put_particle",
            particle: { ...existing, canvasHidden: false, ...(position ? { position, positionMode: "manual" as const } : {}) },
            expectedRevision: existing.revision,
          },
        ]))
      )
        return false
      if (!position) controls.select(existing.id)
      return true
    }
    const particle = createParticle("activity", {
      id: crypto.randomUUID(),
      workspaceId: graph.workspaceId,
      title: item.title,
      now: new Date().toISOString(),
    })
    if (particle.type !== "activity") return false
    particle.size = "large"
    particle.data.widget = {
      kind: "opportunity",
      organizationId,
      opportunityId: item.id,
    }
    return controls.create("activity", item.title, particle, { position, inspect: false })
  }, [organizationId])
  const onOpenSource = useCallback((id: string) => {
    const controls = latest.current
    return controls.getCurrentGraph()?.particles.some(item => item.id === id) ? controls.select(id) : false
  }, [])
  return { onAddToWorkspace, onOpenSource }
}
