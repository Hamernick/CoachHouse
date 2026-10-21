"use client"

import {
  useCallback,
  useState,
  useRef,
  type Dispatch,
  type SetStateAction,
  type RefObject,
} from "react"
import type { Node } from "@xyflow/react"
import type { ParticleGraph } from "../types"
import type { ParticleNodeData } from "../components/particle-node"
import { toast } from "@/lib/toast"

export function useParticleSelection({
  graph,
  selectedId,
  selectParticle,
  setNodes,
  dirty,
  getSelectedIds,
}: {
  graph: ParticleGraph | null
  selectedId: string | null
  selectParticle: (id: string | null) => void
  setNodes: Dispatch<SetStateAction<Node<ParticleNodeData>[]>>
  dirty: RefObject<boolean>
  getSelectedIds?: () => string[]
}) {
  const [shareParticleIds, setShareParticleIds] = useState<string[]>([])
  const [inspectorView, setInspectorView] = useState<"details" | "share">("details")
  const currentView = useRef(inspectorView)
  const [calendarEntryRequest, setCalendarEntryRequest] = useState<{
    id: string
    key: number
  } | null>(null)
  const select = useCallback(
    (
      id: string | null,
      options?: {
        restoreFocus?: boolean
        preserveSelection?: boolean
        calendarEntryId?: string
        view?: "details" | "share"
      }
    ) => {
      if (id !== null && !graph?.particles.some((item) => item.id === id))
        return false
      if (id === null && selectedId === null) return true
      const nextView = options?.view ?? "details"
      if (dirty.current && (currentView.current === "share" || nextView === "share") &&
        (id !== selectedId || currentView.current !== nextView)) {
        toast.error("Save or discard the open page changes first.")
        return false
      }
      if (
        dirty.current &&
        id !== selectedId &&
        !window.confirm("Discard unsaved Particle changes?")
      )
        return false
      selectParticle(id)
      if (nextView === "share" && id) {
        const selected = getSelectedIds?.() ?? []
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
        window.requestAnimationFrame(() => {
          document
            .querySelector<HTMLElement>(
              `.react-flow__node[data-id="${selectedId}"]`
            )
            ?.focus({ preventScroll: true })
        })
      }
      return true
    },
    [selectParticle, selectedId, graph, dirty, setNodes, getSelectedIds]
  )
  return { select, calendarEntryRequest, inspectorView, shareParticleIds }
}
