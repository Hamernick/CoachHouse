"use client"

import {
  useCallback,
  useEffect,
  useState,
  useRef,
  type Dispatch,
  type SetStateAction,
  type RefObject,
} from "react"
import type { Node, ReactFlowInstance } from "@xyflow/react"
import type { ParticleGraph } from "../types"
import type { ParticleNodeData } from "../components/particle-node"
import { useParticleExpansion } from "./use-particle-expansion"
import { hasParticleMembership } from "../lib/particle-membership-responsibility"
import { withParticleAssignmentBounds } from "../lib/particle-assignment-geometry"
import { toast } from "@/lib/toast"
import { particleFamilyDimensions, PARTICLE_SIZE_SUPPORT } from "../lib/particle-size"
import { useParticleWalkthrough } from "./use-particle-walkthrough"
import type { ParticleSelectionOptions } from "../lib/particle-selection-options"
import { readWorkspaceFocusViewport } from "@/lib/workspace-canvas/focus-viewport"
import { interruptWorkspaceCamera } from "@/lib/workspace-canvas/camera-intent"

export function useParticleSelection({
  graph,
  selectedId,
  selectParticle,
  setNodes,
  dirty,
  getSelectedIds,
  flow,
  expansionBlocked = false,
}: {
  graph: ParticleGraph | null
  selectedId: string | null
  selectParticle: (id: string | null) => void
  setNodes: Dispatch<SetStateAction<Node<ParticleNodeData>[]>>
  dirty: RefObject<boolean>
  getSelectedIds?: () => string[]
  expansionBlocked?: boolean
  flow?: RefObject<ReactFlowInstance | null>
}) {
  const collapseExpansion = useRef<(restoreFocus: boolean) => void>(() => {})
  const [shareParticleIds, setShareParticleIds] = useState<string[]>([])
  const [inspectorView, setInspectorView] = useState<NonNullable<ParticleSelectionOptions["view"]>>("details")
  const currentView = useRef(inspectorView)
  const currentGraph = useRef(graph)
  currentGraph.current = graph
  const focusFrame = useRef<number | null>(null)
  const cancelReturnFocus = useCallback(() => {
    if (focusFrame.current !== null) window.cancelAnimationFrame(focusFrame.current)
    focusFrame.current = null
  }, [])
  useEffect(() => cancelReturnFocus, [cancelReturnFocus, graph?.workspaceId])
  const [calendarEntryRequest, setCalendarEntryRequest] = useState<{
    id: string
    key: number
  } | null>(null)
  const select = useCallback(
    (
      id: string | null,
      options?: ParticleSelectionOptions
    ) => {
      if (id !== null && !graph?.particles.some((item) => item.id === id))
        return false
      if (id === null && selectedId === null) {
        collapseExpansion.current(false)
        cancelReturnFocus()
        if (flow && flow.current) interruptWorkspaceCamera(flow.current)
        return true
      }
      const nextView = options?.view ?? "details"
      if (dirty.current && (currentView.current === "share" || nextView === "share") &&
        (id !== selectedId || currentView.current !== nextView)) {
        toast.error("Save or discard the open page changes first.")
        return false
      }
      if (
        dirty.current &&
        (id !== selectedId || currentView.current !== nextView) &&
        !window.confirm("Discard unsaved Particle changes?")
      )
        return false
      collapseExpansion.current(false)
      cancelReturnFocus()
      if (flow && flow.current) interruptWorkspaceCamera(flow.current)
      selectParticle(id)
      if (nextView === "share" && id) {
        const selected = options?.shareParticleIds ?? getSelectedIds?.() ?? []
        const ids = selected.includes(id) ? selected : [id]
        setShareParticleIds(ids.filter((key) => graph?.particles.some((item) => item.id === key)))
      }
      currentView.current = nextView
      setInspectorView(nextView)
      setCalendarEntryRequest((current) =>
        options?.calendarEntryId
          ? { id: options.calendarEntryId, key: (current?.key ?? 0) + 1 }
          : null
      )
      if (id)
        setNodes((current) =>
          current.map((node) => {
            const selected =
              node.id === id ||
              Boolean((options?.preserveSelection || nextView === "share") && node.selected)
            return node.selected === selected
              ? node
              : { ...node, selected: Boolean(selected) }
          })
        )
      if (id === null && selectedId && options?.restoreFocus !== false) {
        focusFrame.current = window.requestAnimationFrame(() => {
          focusFrame.current = null
          if (!currentGraph.current?.particles.some(item => item.id === selectedId && !item.canvasHidden)) return
          document
            .querySelector<HTMLElement>(
              `.react-flow__node[data-id="${selectedId}"]`
            )
            ?.focus({ preventScroll: true })
        })
      }
      return true
    },
    [selectParticle, selectedId, graph, dirty, setNodes, getSelectedIds, cancelReturnFocus, flow]
  )
  const expansion = useParticleExpansion({ graph, flow, select })
  collapseExpansion.current = expansion.collapse
  const focusCanvas = useCallback((id: string) => {
    if (!flow) return false
    const particle = graph?.particles.find(item => item.id === id)
    const canvas = flow.current
    if (!particle || particle.canvasHidden || !canvas) return false
    const animation = {
      duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 380,
      ease: (t: number) => t * t * (3 - 2 * t),
      interpolate: "linear" as const,
    }
    const node = canvas.getNode(id)
    // Direct viewport movement also works with controlled/virtualized nodes;
    // fitView queues a node update which may never flush on this canvas.
    const fallback = withParticleAssignmentBounds(particle, particleFamilyDimensions(particle, particle.size ?? PARTICLE_SIZE_SUPPORT[particle.type].defaultSize), hasParticleMembership(graph, particle.id))
    const internal = canvas.getInternalNode?.(id)
    const width = internal?.measured?.width ?? node?.measured?.width ?? node?.width ?? fallback.width
    const height = internal?.measured?.height ?? node?.measured?.height ?? node?.height ?? fallback.height
    const position = internal?.internals.positionAbsolute ?? node?.position ?? particle.position
    const viewport = readWorkspaceFocusViewport({ ...position, width, height })
    // A measured, fully obscured card gets a read-only preview in the existing
    // focused surface. Missing DOM measurements retain offscreen navigation.
    if (viewport === null) return select(id, { view: "preview" })
    if (!select(null, { restoreFocus: false })) return false
    setNodes(current => current.map(node => ({ ...node, selected: node.id === id })))
    if (viewport) void canvas.setViewport(viewport, animation)
    else void canvas.setCenter(position.x + width / 2, position.y + height / 2, { zoom: 1, ...animation })
    return true
  }, [graph, flow, select, setNodes])
  const walkthrough = useParticleWalkthrough({ graph, selectedId, dirty, flow, select, focusCanvas, setNodes, getSelectedIds,
    inspection: { view: inspectorView, shareParticleIds, calendarEntryId: calendarEntryRequest?.id } })
  const cancelWalkthrough = walkthrough.cancel
  const activeWalkthroughId = walkthrough.currentId
  const selectDirect = useCallback((id: string | null, options?: Parameters<typeof select>[1]) => {
    const accepted = select(id, options)
    if (accepted && id && id !== activeWalkthroughId) cancelWalkthrough()
    return accepted
  }, [select, activeWalkthroughId, cancelWalkthrough])
  const focusDirect = useCallback((id: string) => {
    const accepted = focusCanvas(id)
    if (accepted) cancelWalkthrough()
    return accepted
  }, [focusCanvas, cancelWalkthrough])
  const expandParticle = expansion.expand
  const expand = useCallback((id: string) => {
    if (expansionBlocked) return false
    const accepted = expandParticle(id)
    if (accepted) cancelWalkthrough()
    return accepted
  }, [expandParticle, cancelWalkthrough, expansionBlocked])
  return { ...expansion, expand, select: selectDirect, focusCanvas: focusDirect, walkthrough, calendarEntryRequest, inspectorView, shareParticleIds }
}
