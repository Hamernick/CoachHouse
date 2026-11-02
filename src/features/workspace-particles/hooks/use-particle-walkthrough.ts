"use client"

import { useCallback, useEffect, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from "react"
import type { Node, ReactFlowInstance, Viewport } from "@xyflow/react"
import { toast } from "@/lib/toast"
import type { ParticleGraph } from "../types"
import type { ParticleNodeData } from "../components/particle-node"
import { readParticleWalkthrough, type ParticleWalkthroughReference } from "../lib/particle-walkthrough"
import type { ParticleSelectionOptions } from "../lib/particle-selection-options"

type Session = {
  reference: ParticleWalkthroughReference
  currentId: string
  origin: { viewport: Viewport; selectedIds: string[]; inspectorId: string | null; inspection: ParticleSelectionOptions; element: HTMLElement | null }
}

/** Personal navigation only. Persistence, membership and work status stay untouched. */
export function useParticleWalkthrough({ graph, selectedId, dirty, flow, select, focusCanvas, setNodes, getSelectedIds, inspection }: {
  graph: ParticleGraph | null
  selectedId: string | null
  dirty: RefObject<boolean>
  flow?: RefObject<ReactFlowInstance | null>
  select: (id: string | null, options?: ParticleSelectionOptions) => boolean
  inspection: ParticleSelectionOptions
  focusCanvas: (id: string) => boolean
  setNodes: Dispatch<SetStateAction<Node<ParticleNodeData>[]>>
  getSelectedIds?: () => string[]
}) {
  const [session, setSession] = useState<Session | null>(null)
  const sessionRef = useRef(session)
  const latest = useRef({ graph, selectedId, select, focusCanvas, getSelectedIds, flow, inspection })
  latest.current = { graph, selectedId, select, focusCanvas, getSelectedIds, flow, inspection }
  const update = useCallback((value: Session | null) => { sessionRef.current = value; setSession(value) }, [])
  const cancel = useCallback(() => update(null), [update])
  useEffect(() => cancel(), [graph?.workspaceId, cancel])
  const guard = useCallback(() => {
    if (!dirty.current) return true
    toast.error("Save or discard the open changes first.")
    return false
  }, [dirty])
  const start = useCallback((reference: ParticleWalkthroughReference, element?: HTMLElement | null) => {
    const current = latest.current
    const route = readParticleWalkthrough(current.graph, reference)
    const canvas = current.flow?.current
    if (!canvas || !guard()) return false
    if (!route?.items.length) { toast.error("This plan has no available walkthrough."); return false }
    const first = route.items[0]
    const origin = sessionRef.current?.reference.workspaceId === reference.workspaceId
      ? sessionRef.current.origin
      : { viewport: canvas.getViewport(), selectedIds: current.getSelectedIds?.() ?? [], inspectorId: current.selectedId, inspection: current.inspection,
        element: element ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null) }
    if (!current.select(null, { restoreFocus: false })) return false
    if (first.particle && !current.focusCanvas(first.id)) return false
    update({ reference, currentId: first.id, origin })
    return true
  }, [guard, update])
  const step = useCallback((direction: -1 | 1) => {
    const active = sessionRef.current
    if (!active || !guard()) return false
    const current = latest.current
    const route = readParticleWalkthrough(current.graph, active.reference)
    if (!route) return false
    const index = route.items.findIndex(item => item.id === active.currentId)
    // Removed membership has no inferred position: restart explicitly instead.
    if (index < 0) return false
    const next = route.items[index + direction]
    if (!next) return false
    if (!current.select(null, { restoreFocus: false })) return false
    if (next.particle && !current.focusCanvas(next.id)) return false
    update({ ...active, currentId: next.id })
    return true
  }, [guard, update])
  const exit = useCallback(() => {
    const active = sessionRef.current
    if (!active) return true
    const current = latest.current
    // Changing organizations invalidates the entire return target.
    if (current.graph?.workspaceId !== active.reference.workspaceId) { cancel(); return true }
    if (!guard() || !current.select(null, { restoreFocus: false })) return false
    const valid = new Set(current.graph.particles.filter(item => item.workspaceId === active.reference.workspaceId && !item.canvasHidden).map(item => item.id))
    const ids = active.origin.selectedIds.filter(id => valid.has(id))
    setNodes(nodes => nodes.map(node => ({ ...node, selected: ids.includes(node.id) })))
    if (active.origin.inspectorId && valid.has(active.origin.inspectorId)) current.select(active.origin.inspectorId, {
      ...active.origin.inspection,
      shareParticleIds: active.origin.inspection.shareParticleIds?.filter(id => valid.has(id)),
    })
    // Immediate return prevents a late animated completion from taking focus.
    void current.flow?.current?.setViewport(active.origin.viewport, { duration: 0 })
    const returnNode = active.origin.element?.closest<HTMLElement>(".react-flow__node[data-id]")
    if (active.origin.element?.isConnected && (!returnNode || valid.has(returnNode.dataset.id ?? ""))) active.origin.element.focus({ preventScroll: true })
    cancel()
    return true
  }, [cancel, guard, setNodes])
  const active = session?.reference.workspaceId === graph?.workspaceId ? session : null
  const route = active ? readParticleWalkthrough(graph, active.reference) : null
  const planUnavailable = Boolean(active && !route)
  useEffect(() => {
    if (planUnavailable) { cancel(); toast.error("Plan no longer available.") }
  }, [planUnavailable, cancel])
  const index = route?.items.findIndex(item => item.id === active?.currentId) ?? -1
  return {
    start, step, exit, cancel,
    reference: active?.reference ?? null,
    currentId: active?.currentId ?? null,
    current: index >= 0 ? route?.items[index] : null,
    index, total: route?.items.length ?? 0,
    unavailable: Boolean(active && (!route || index < 0)),
  }
}
