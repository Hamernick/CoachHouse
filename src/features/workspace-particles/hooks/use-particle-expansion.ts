"use client"

import { hasParticleMembership } from "../lib/particle-membership-responsibility"
import { particleAssignmentHeight } from "../lib/particle-assignment-geometry"

import { useCallback, useEffect, useRef, useState, type RefObject } from "react"
import type { ReactFlowInstance, Rect } from "@xyflow/react"
import { observeWorkspaceCanvasSpace } from "@/lib/workspace-canvas/observe-canvas-space"
import { readWorkspaceCanvasSpace } from "@/lib/workspace-canvas/focus-viewport"
import type { ParticleGraph } from "../types"
import type { ParticleSelectionOptions } from "../lib/particle-selection-options"
import { particleExpansionFits, PARTICLE_EXPANDED_SIZE, supportsParticleExpansion, reservedInspectionSize } from "../lib/particle-expansion"

export function useParticleExpansion({ graph, flow, select }: {
  graph: ParticleGraph | null
  flow?: RefObject<ReactFlowInstance | null>
  select: (id: string | null, options?: ParticleSelectionOptions) => boolean
}) {
  const [expanded, setExpanded] = useState<{ id: string; workspaceId: string; revision: number; bounds: Rect; position: { x: number; y: number } } | null>(null)
  const origin = useRef<HTMLElement | null>(null)
  const focusFrame = useRef<number | null>(null)
  const collapse = useCallback((restoreFocus = true) => {
    if (focusFrame.current !== null) cancelAnimationFrame(focusFrame.current)
    focusFrame.current = null
    setExpanded(null)
    if (restoreFocus && expanded) {
      const id = expanded.id
      const trigger = origin.current
      focusFrame.current = requestAnimationFrame(() => {
        focusFrame.current = null
        const node = document.querySelector<HTMLElement>(`.react-flow__node[data-id="${id}"]`)
        // Open survives collapse; a removed Collapse control does not.
        const target = trigger?.isConnected ? trigger : node
        target?.focus({ preventScroll: true })
      })
    }
  }, [expanded])
  useEffect(() => () => { if (focusFrame.current !== null) cancelAnimationFrame(focusFrame.current) }, [])
  const particle = graph?.particles.find(item => item.id === expanded?.id && !item.canvasHidden)
  const expandedId = expanded && expanded.workspaceId === graph?.workspaceId && expanded.revision === graph?.revision && particle && supportsParticleExpansion(particle) && particle.position.x === expanded.position.x && particle.position.y === expanded.position.y ? expanded.id : null
  useEffect(() => { if (expanded && !expandedId) collapse(false) }, [expanded, expandedId, collapse])
  useEffect(() => {
    if (!expandedId || !expanded || !flow) return
    const canvas = flow.current
    if (!canvas) return
    return observeWorkspaceCanvasSpace(() => {
      if (flow.current !== canvas) { collapse(false); return }
      const space = readWorkspaceCanvasSpace()
      const nodes = canvas.getNodes().filter(node => !node.hidden)
      // Gestures belong to the user, not automatic fallback navigation.
      if (nodes.some(node => node.dragging || node.resizing)) { collapse(false); return }
      const neighbors = nodes.filter(node => node.id !== expandedId).map(node => {
        const internal = canvas.getInternalNode(node.id)
        if (!internal?.measured.width || !internal.measured.height) return null
        return { ...internal.internals.positionAbsolute, ...reservedInspectionSize(node.data, internal.measured.width, internal.measured.height) }
      })
      if (!space || neighbors.some(box => !box) || !particleExpansionFits(expanded.bounds, neighbors as Rect[], canvas.getViewport(), space.frame, space.obstacles)) select(expandedId, { view: "preview" })
    })
  }, [expandedId, expanded, flow, select, collapse])
  const expand = useCallback((id: string) => {
    if (!flow) return false
    const particle = graph?.particles.find(item => item.id === id && !item.canvasHidden)
    const canvas = flow.current
    if (!particle || !canvas) return false
    const nodes = canvas.getNodes().filter(node => !node.hidden)
    if (nodes.some(node => node.dragging || node.resizing)) return false
    const measured = (key: string): Rect | null => {
      const internal = canvas.getInternalNode(key)
      if (!internal?.measured.width || !internal.measured.height) return null
      return { ...internal.internals.positionAbsolute, ...reservedInspectionSize(canvas.getNode(key)?.data, internal.measured.width, internal.measured.height) }
    }
    const anchor = measured(id)
    const neighbors = nodes.filter(node => node.id !== id).map(node => measured(node.id))
    const space = readWorkspaceCanvasSpace()
    const target = anchor && { ...anchor, width: Math.max(anchor.width, PARTICLE_EXPANDED_SIZE.width), height: Math.max(anchor.height, PARTICLE_EXPANDED_SIZE.height + particleAssignmentHeight(particle, hasParticleMembership(graph, particle.id))) }
    if (!supportsParticleExpansion(particle) || !target || !space || neighbors.some(box => !box) || !particleExpansionFits(target, neighbors as Rect[], canvas.getViewport(), space.frame, space.obstacles)) return select(id, { view: "preview" })
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
    if (!select(null, { restoreFocus: false })) return false
    origin.current = trigger
    setExpanded({ id, workspaceId: graph!.workspaceId, revision: graph!.revision, bounds: target, position: { ...particle.position } })
    canvas.setNodes(current => current.map(node => ({ ...node, selected: node.id === id })))
    return true
  }, [graph, flow, select])
  return { expandedId, expand, collapse }
}
