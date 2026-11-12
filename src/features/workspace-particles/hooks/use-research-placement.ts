"use client"

import { useReactFlow } from "@xyflow/react"
import { useRef } from "react"
import { applyResearchDraft, type ResearchDraft, type ResearchResult } from "@/features/workspace-ai/client"
import { beginWorkspaceCameraIntent } from "@/lib/workspace-canvas/camera-intent"
import type { ParticleGraph } from "../types"
import { particlePlacementBounds } from "../lib/particle-creation-placement"
import { researchVisiblePlacement } from "../lib/research-visible-placement"

/** The existing Add action owns placement and camera movement; no extra controls. */
export function useResearchPlacement() {
  const flow = useReactFlow()
  const camera = useRef<ReturnType<typeof flow.getViewport> | null>(null)
  const prepare = (graph: ParticleGraph, result: ResearchResult, userId: string, draft?: ResearchDraft) => {
    camera.current = flow.getViewport()
    const chat = document.querySelector<HTMLElement>('[data-workspace-canvas-chat="true"]')
    if (!chat) return undefined
    const rect = chat.getBoundingClientRect(), zoom = flow.getViewport().zoom
    const position = flow.screenToFlowPosition({ x: rect.x, y: rect.y }, { snapToGrid: false })
    const measured = flow.getNodes().filter(node => !node.hidden).flatMap(node => {
      const internal = flow.getInternalNode(node.id)
      return internal?.measured.width && internal.measured.height
        ? [{ ...internal.internals.positionAbsolute, width: internal.measured.width, height: internal.measured.height }] : []
    })
    return researchVisiblePlacement(graph, applyResearchDraft(result, draft), userId, { ...position, width: rect.width / zoom, height: rect.height / zoom }, measured)
  }
  const reveal = async (graph: ParticleGraph, added: string[]) => {
    const objective = graph.particles.find(item => added.includes(item.id) && item.type === "objective")
    const chat = document.querySelector<HTMLElement>('[data-workspace-canvas-chat="true"]')
    const surface = chat?.closest<HTMLElement>(".workspace-layout-surface")
    if (!objective || !surface) return
    const viewport = flow.getViewport(), frame = surface.getBoundingClientRect()
    if (!camera.current || Object.keys(viewport).some(key => viewport[key as keyof typeof viewport] !== camera.current![key as keyof typeof viewport])) return
    const sidebar = surface.querySelector<HTMLElement>('[data-planning-sidebar]')?.getBoundingClientRect()
    const left = sidebar ? Math.max(24, sidebar.right - frame.left + 24) : 24
    const box = particlePlacementBounds(objective, true)
    // Preserve zoom: the fixed-screen-size chat must not grow over the saved
    // branch in world coordinates. Large plans remain navigable from their root.
    const screen = { x: frame.left + left + Math.min(box.width * viewport.zoom / 2, (frame.width - left - 24) / 2), y: frame.top + frame.height / 2 }
    const current = flow.flowToScreenPosition({ x: box.x + box.width / 2, y: box.y + box.height / 2 })
    beginWorkspaceCameraIntent(flow)
    await flow.setViewport({ ...viewport, x: viewport.x + screen.x - current.x, y: viewport.y + screen.y - current.y }, { duration: 0 }).catch(() => undefined)
  }
  return { prepare, reveal }
}
