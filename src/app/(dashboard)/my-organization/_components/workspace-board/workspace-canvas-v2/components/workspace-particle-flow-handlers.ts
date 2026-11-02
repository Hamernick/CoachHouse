import { useMemo } from "react"
import type { ReactFlowInstance } from "@xyflow/react"
import type { useParticleFlow } from "@/features/workspace-particles/client"
import type { WorkspaceCanvasSurfaceV2ViewProps } from "./workspace-canvas-surface-v2-view-types"

type Handlers = Pick<
  WorkspaceCanvasSurfaceV2ViewProps,
  | "onNodesChange"
  | "onNodeClick"
  | "onKeyDownCapture"
  | "onNodeDragStop"
  | "onSelectionDragStop"
  | "onInit"
>

export function createWorkspaceParticleFlowHandlers(
  particles: Pick<
    ReturnType<typeof useParticleFlow>,
    "ids" | "onNodesChange" | "select" | "selectedId" | "move"
  > & {
    expand?: (id: string) => boolean
    expandedId?: string | null
    collapse?: () => void
    history?: Pick<ReturnType<typeof useParticleFlow>["history"], "onKeyDown">
    flow: { current: Pick<ReactFlowInstance, "getNodes" | "setNodes"> | null }
  },
  legacy: Handlers
): Handlers {
  return {
    onNodesChange: (changes) => {
      const getId = (change: (typeof changes)[number]) =>
        change.type === "add" || change.type === "replace"
          ? change.item.id
          : change.id
      const particleChanges = changes.filter((change) =>
        particles.ids.has(getId(change))
      )
      const legacyChanges = changes.filter(
        (change) => !particles.ids.has(getId(change))
      )
      if (particleChanges.length) particles.onNodesChange(particleChanges)
      if (legacyChanges.length) legacy.onNodesChange(legacyChanges)
    },
    onNodeClick: (event, node) => {
      // React Flow owns canvas selection. Opening the editor is an explicit
      // action, so ordinary and additive clicks never navigate away from a draft.
      if (particles.ids.has(node.id)) return
      legacy.onNodeClick(event, node)
    },
    onKeyDownCapture: (event) => {
      const target = event.target
      if (
        target instanceof Element &&
        target.closest(
          'button,input,textarea,select,a,[contenteditable]:not([contenteditable="false"]),[role="menu"],[role="menuitem"],[role="dialog"]'
        )
      )
        return
      if (target instanceof Element) {
        const id = target.closest(".react-flow__node")?.getAttribute("data-id")
        if (
          (!id || particles.ids.has(id)) &&
          particles.history?.onKeyDown(event)
        )
          return
        if (event.key === "Enter" && id && particles.ids.has(id)) {
          event.preventDefault()
          event.stopPropagation()
          if (particles.expand) particles.expand(id)
          else particles.select(id, { preserveSelection: true })
          return
        }
        if (event.key === "Escape" && particles.expandedId) {
          event.preventDefault()
          event.stopPropagation()
          particles.collapse?.()
          return
        }
        if (
          event.key === "Escape" &&
          particles.flow.current?.getNodes().some((node) => node.selected)
        ) {
          event.preventDefault()
          event.stopPropagation()
          particles.flow.current.setNodes((nodes) =>
            nodes.map((node) =>
              node.selected ? { ...node, selected: false } : node
            )
          )
          return
        }
        if (event.key === "Escape" && particles.selectedId) {
          event.preventDefault()
          event.stopPropagation()
          particles.select(null)
          return
        }
      }
      legacy.onKeyDownCapture(event)
    },
    onNodeDragStop: (event, node, dragged) => {
      const moved = dragged.length ? dragged : [node]
      void particles.move(moved.filter((item) => particles.ids.has(item.id)))
      const legacyNodes = moved.filter((item) => !particles.ids.has(item.id))
      if (!particles.ids.has(node.id))
        legacy.onNodeDragStop(event, node, legacyNodes)
      else if (legacyNodes.length)
        legacy.onSelectionDragStop(event, legacyNodes)
    },
    onSelectionDragStop: (event, dragged) => {
      void particles.move(dragged.filter((node) => particles.ids.has(node.id)))
      const legacyNodes = dragged.filter((node) => !particles.ids.has(node.id))
      if (legacyNodes.length) legacy.onSelectionDragStop(event, legacyNodes)
    },
    onInit: (instance) => {
      particles.flow.current = instance
      legacy.onInit(instance)
    },
  }
}

/** Keep React Flow callbacks stable while controlled positions change. */
export function useWorkspaceParticleFlowHandlers(
  particles: Parameters<typeof createWorkspaceParticleFlowHandlers>[0],
  legacy: Handlers
) {
  const {
    ids,
    onNodesChange: particleChanges,
    select,
    selectedId,
    expand,
    expandedId,
    collapse,
    move,
    flow,
    history,
  } = particles
  const {
    onNodesChange,
    onNodeClick,
    onKeyDownCapture,
    onNodeDragStop,
    onSelectionDragStop,
    onInit,
  } = legacy
  return useMemo(
    () =>
      createWorkspaceParticleFlowHandlers(
        {
          ids,
          onNodesChange: particleChanges,
          select,
          selectedId,
          expand,
          expandedId,
          collapse,
          move,
          flow,
          history,
        },
        {
          onNodesChange,
          onNodeClick,
          onKeyDownCapture,
          onNodeDragStop,
          onSelectionDragStop,
          onInit,
        }
      ),
    [
      ids,
      particleChanges,
      select,
      selectedId,
      expand,
      expandedId,
      collapse,
      move,
      flow,
      history,
      onNodesChange,
      onNodeClick,
      onKeyDownCapture,
      onNodeDragStop,
      onSelectionDragStop,
      onInit,
    ]
  )
}
