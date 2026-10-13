"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react"
import type { Edge, Node } from "@xyflow/react"

import type { WorkspaceFlowContextMenuState } from "./workspace-board-context-menu"
import type { WorkspaceBoardNodeData } from "./workspace-board-node"
import type { WorkspaceCardId, WorkspaceNodeState } from "./workspace-board-types"

type UseWorkspaceBoardContextMenuArgs = {
  allowEditing: boolean
  isCanvasFullscreen: boolean
  nodes: WorkspaceNodeState[]
  hiddenCardIds: WorkspaceCardId[]
}

export function useWorkspaceBoardContextMenu({
  allowEditing,
  isCanvasFullscreen,
  nodes,
  hiddenCardIds,
}: UseWorkspaceBoardContextMenuArgs) {
  const surfaceRef = useRef<HTMLDivElement | null>(null)
  const [contextMenuState, setContextMenuState] = useState<WorkspaceFlowContextMenuState | null>(null)

  useEffect(() => {
    if (!contextMenuState) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setContextMenuState(null)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [contextMenuState])

  const visibleCardIds = useMemo(
    () => nodes.map((node) => node.id).filter((cardId) => !hiddenCardIds.includes(cardId)),
    [hiddenCardIds, nodes],
  )

  const resolveMenuPosition = useCallback((event: { clientX: number; clientY: number }) => {
    const surfaceBounds = surfaceRef.current?.getBoundingClientRect()
    if (!surfaceBounds) {
      return {
        x: event.clientX,
        y: event.clientY,
      }
    }
    return {
      x: event.clientX - surfaceBounds.left,
      y: event.clientY - surfaceBounds.top,
    }
  }, [])

  const resolveHandleKindFromTarget = useCallback(
    (target: EventTarget | null): "source" | "target" | null => {
      if (!(target instanceof Element)) return null
      const handleElement = target.closest(".react-flow__handle")
      if (!handleElement) return null
      if (handleElement.classList.contains("source")) return "source"
      if (handleElement.classList.contains("target")) return "target"
      return null
    },
    [],
  )

  const handlePaneContextMenu = useCallback(
    (event: ReactMouseEvent) => {
      if (!allowEditing || isCanvasFullscreen) return
      event.preventDefault()
      const position = resolveMenuPosition(event)
      setContextMenuState({
        kind: "canvas",
        x: position.x,
        y: position.y,
      })
    },
    [allowEditing, isCanvasFullscreen, resolveMenuPosition],
  )

  const handleNodeContextMenu = useCallback(
    (event: ReactMouseEvent, node: Node<WorkspaceBoardNodeData>) => {
      if (!allowEditing || isCanvasFullscreen) return
      event.preventDefault()
      const position = resolveMenuPosition(event)
      setContextMenuState({
        kind: "node",
        x: position.x,
        y: position.y,
        nodeId: node.id as WorkspaceCardId,
        handleKind: resolveHandleKindFromTarget(event.target),
      })
    },
    [
      allowEditing,
      isCanvasFullscreen,
      resolveHandleKindFromTarget,
      resolveMenuPosition,
    ],
  )

  const handleEdgeContextMenu = useCallback(
    (event: ReactMouseEvent, edge: Edge) => {
      if (!allowEditing || isCanvasFullscreen) return
      event.preventDefault()
      const position = resolveMenuPosition(event)
      setContextMenuState({
        kind: "edge",
        x: position.x,
        y: position.y,
        edgeId: edge.id,
        source: edge.source as WorkspaceCardId,
        target: edge.target as WorkspaceCardId,
      })
    },
    [allowEditing, isCanvasFullscreen, resolveMenuPosition],
  )

  return {
    surfaceRef,
    contextMenuState,
    setContextMenuState,
    visibleCardIds,
    handlePaneContextMenu,
    handleNodeContextMenu,
    handleEdgeContextMenu,
  }
}
