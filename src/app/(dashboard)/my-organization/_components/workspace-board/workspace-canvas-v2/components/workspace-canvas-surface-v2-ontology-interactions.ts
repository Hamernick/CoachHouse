"use client"

import type { WorkspaceSelectionDragHandler } from "@/lib/workspace-canvas/drag-events"
import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type KeyboardEventHandler,
  type MutableRefObject,
} from "react"
import type {
  NodeChange,
  OnNodeDrag,
  NodeMouseHandler,
  OnNodesChange,
  ReactFlowInstance,
} from "@xyflow/react"

import {
  useWorkspaceOntologyWayfinding,
  WORKSPACE_ONTOLOGY_ROOT_IDS,
} from "@/features/workspace-ontology"

import type { WorkspaceCanvasNode } from "./workspace-canvas-surface-v2-helpers"
import { mergeUniqueWorkspaceCanvasNodes } from "./workspace-canvas-edge-deduplication"
import { applyWorkspaceOntologySelectionChanges } from "./workspace-canvas-ontology-selection"
import type { useWorkspaceCanvasOntology } from "./workspace-canvas-surface-v2-ontology"

function resolveNodeChangeId(change: NodeChange) {
  return change.type === "add" || change.type === "replace"
    ? change.item.id
    : change.id
}

function useStableVisibleNodeIds(nodes: WorkspaceCanvasNode[]) {
  const previousIdsRef = useRef<string[]>([])
  return useMemo(() => {
    const nextIds = nodes.map((node) => node.id)
    const previousIds = previousIdsRef.current
    const unchanged =
      previousIds.length === nextIds.length &&
      nextIds.every((id, index) => previousIds[index] === id)
    if (unchanged) return previousIds
    previousIdsRef.current = nextIds
    return nextIds
  }, [nodes])
}

export function useWorkspaceCanvasOntologyInteractions({
  ontology,
  tutorialActive,
  renderNodes,
  onNodesChange,
  onNodeDragStop,
  onSelectionDragStop,
  flowInstanceRef,
  isFlowReady,
}: {
  ontology: ReturnType<typeof useWorkspaceCanvasOntology>
  tutorialActive: boolean
  renderNodes: WorkspaceCanvasNode[]
  onNodesChange: OnNodesChange
  onNodeDragStop: OnNodeDrag
  onSelectionDragStop: WorkspaceSelectionDragHandler
  flowInstanceRef: MutableRefObject<ReactFlowInstance | null>
  isFlowReady: boolean
}) {
  const {
    activateNode,
    activeNodeIds,
    activeRootId,
    layoutAnimating,
    nodes: ontologyNodes,
    state: ontologyState,
    stepBack,
  } = ontology
  const [selectedOntologyNodeIds, setSelectedOntologyNodeIds] = useState<
    ReadonlySet<string>
  >(() => new Set())
  const { cancelPendingFit } = useWorkspaceOntologyWayfinding({
    flowInstance: flowInstanceRef.current,
    isFlowReady,
    layoutAnimating,
    nodes: ontologyNodes,
    mode: ontologyState.mode,
    activeRootId,
    activeNodeIds,
  })
  const handleNodeClick = useCallback<NodeMouseHandler>(
    (event, node) => {
      if (!node.id.startsWith("ontology:")) return
      if (event.shiftKey || event.metaKey || event.ctrlKey) return
      if (
        event.target instanceof HTMLElement &&
        event.target.closest("button, a")
      ) {
        return
      }
      activateNode(node.id)
    },
    [activateNode]
  )
  const handleKeyDownCapture = useCallback<
    KeyboardEventHandler<HTMLDivElement>
  >(
    (event) => {
      if (event.key === "Escape" && !event.repeat) {
        const target = event.target
        if (
          target instanceof HTMLElement &&
          target.closest("input, textarea, select, [role=dialog]")
        ) {
          return
        }
        if (
          ontologyState.mode === "map" ||
          activeNodeIds.length > 0 ||
          activeRootId
        ) {
          const activeNodeId = activeNodeIds[activeNodeIds.length - 1]
          const activeNode = ontologyNodes.find(
            (node) => node.id === activeNodeId
          )
          const returnNodeId =
            activeNode?.data.node.parentId ?? activeRootId ?? null
          event.preventDefault()
          event.stopPropagation()
          stepBack()
          if (returnNodeId) {
            window.requestAnimationFrame(() => {
              const returnNode = Array.from(
                document.querySelectorAll<HTMLElement>(
                  ".react-flow__node[data-id]"
                )
              ).find((element) => element.dataset.id === returnNodeId)
              returnNode?.focus()
            })
          }
        }
        return
      }
      if ((event.key !== "Enter" && event.key !== " ") || event.repeat) return
      const target = event.target
      if (!(target instanceof HTMLElement)) return
      if (
        target.closest("button, a, input, textarea, select, [role=menuitem]")
      ) {
        return
      }
      const nodeElement = target.closest<HTMLElement>(
        '.react-flow__node[data-id^="ontology:"]'
      )
      const nodeId = nodeElement?.dataset.id
      if (!nodeId) return
      event.preventDefault()
      activateNode(nodeId)
    },
    [
      activateNode,
      activeNodeIds,
      activeRootId,
      ontologyNodes,
      ontologyState.mode,
      stepBack,
    ]
  )
  const nodes = useMemo(() => {
    if (tutorialActive) return renderNodes
    const rootIdSet = new Set<string>(WORKSPACE_ONTOLOGY_ROOT_IDS)
    const contextualRenderNodes = renderNodes.map((node) => {
      if (!activeRootId || !rootIdSet.has(node.id)) return node
      return {
        ...node,
        className: [
          node.className,
          "workspace-ontology-arranged-root",
          node.id === activeRootId
            ? "workspace-ontology-active-root"
            : "workspace-ontology-dimmed-root",
        ]
          .filter(Boolean)
          .join(" "),
      }
    })
    return mergeUniqueWorkspaceCanvasNodes(
      contextualRenderNodes,
      ontologyNodes.map((node) => ({
        ...node,
        selected: selectedOntologyNodeIds.has(node.id),
      }))
    )
  }, [
    activeRootId,
    ontologyNodes,
    renderNodes,
    selectedOntologyNodeIds,
    tutorialActive,
  ])
  const visibleNodeIds = useStableVisibleNodeIds(nodes)
  const handleNodesChange = useCallback<OnNodesChange>(
    (changes) => {
      const dragging = changes.some(
        (change) => change.type === "position" && change.dragging === true
      )
      if (dragging) {
        cancelPendingFit()
      }
      const ontologyChanges = changes.filter((change) =>
        resolveNodeChangeId(change).startsWith("ontology:")
      )
      const workspaceChanges = changes.filter(
        (change) => !resolveNodeChangeId(change).startsWith("ontology:")
      )
      if (ontologyChanges.length > 0) {
        setSelectedOntologyNodeIds((selectedIds) =>
          applyWorkspaceOntologySelectionChanges({
            selectedIds,
            changes: ontologyChanges,
          })
        )
      }
      if (workspaceChanges.length > 0) onNodesChange(workspaceChanges)
    },
    [cancelPendingFit, onNodesChange]
  )
  const handleNodeDragStop = useCallback<OnNodeDrag>(
    (event, node, draggedNodes) => {
      if (node.id.startsWith("ontology:")) {
        return
      }
      onNodeDragStop(event, node, draggedNodes)
    },
    [onNodeDragStop]
  )
  const handleSelectionDragStop = useCallback<WorkspaceSelectionDragHandler>(
    (event, draggedNodes) => {
      const workspaceNodes = draggedNodes.filter(
        (node) => !node.id.startsWith("ontology:")
      )
      if (workspaceNodes.length > 0) onSelectionDragStop(event, workspaceNodes)
    },
    [onSelectionDragStop]
  )
  return {
    nodes,
    visibleNodeIds,
    onNodesChange: handleNodesChange,
    onNodeClick: handleNodeClick,
    onKeyDownCapture: handleKeyDownCapture,
    onNodeDragStop: handleNodeDragStop,
    onSelectionDragStop: handleSelectionDragStop,
    onMoveStart: cancelPendingFit,
  }
}
