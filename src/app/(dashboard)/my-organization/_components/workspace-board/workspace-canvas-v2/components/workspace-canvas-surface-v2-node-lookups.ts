"use client"

import { useMemo, useRef } from "react"

import { resolveWorkspaceCanvasOrgNodePosition } from "../adapters/workspace-canvas-from-board-state"
import { resolveAcceleratorWorkspaceNodeId } from "./workspace-canvas-surface-v2-hooks"
import { type WorkspaceCanvasV2CardId } from "./workspace-canvas-surface-v2-helpers"
import { resolveWorkspaceCanvasV2InitialPositionLookup } from "./workspace-canvas-surface-v2-positioning"
import {
  buildVisibleWorkspaceCanvasCardIdSet,
  buildWorkspaceCanvasBoardNodeLookup,
  resolveWorkspaceCanvasAcceleratorNode,
} from "./workspace-canvas-surface-v2-support-helpers"
import type { WorkspaceBoardState } from "../../workspace-board-types"

export function useWorkspaceCanvasOrgNodePosition(
  boardNodes: WorkspaceBoardState["nodes"]
) {
  return useMemo(
    () => resolveWorkspaceCanvasOrgNodePosition(boardNodes),
    [boardNodes]
  )
}

export function useWorkspaceCanvasSurfaceNodeLookups({
  boardNodes,
  orgNodePositionFromBoard,
}: {
  boardNodes: WorkspaceBoardState["nodes"]
  orgNodePositionFromBoard: Parameters<
    typeof resolveWorkspaceCanvasV2InitialPositionLookup
  >[1]
}) {
  const initialPositionLookupRef = useRef<
    Record<WorkspaceCanvasV2CardId, { x: number; y: number }>
  >(
    resolveWorkspaceCanvasV2InitialPositionLookup(
      boardNodes,
      orgNodePositionFromBoard
    )
  )
  const boardNodeLookup = useMemo(
    () => buildWorkspaceCanvasBoardNodeLookup(boardNodes),
    [boardNodes]
  )
  const acceleratorWorkspaceNode = useMemo(
    () => resolveWorkspaceCanvasAcceleratorNode({ boardNodeLookup }),
    [boardNodeLookup]
  )
  const acceleratorWorkspaceNodeId = useMemo(
    () => resolveAcceleratorWorkspaceNodeId(acceleratorWorkspaceNode),
    [acceleratorWorkspaceNode]
  )

  return {
    acceleratorWorkspaceNode,
    acceleratorWorkspaceNodeId,
    boardNodeLookup,
    initialPositionLookupRef,
  }
}

export function useVisibleWorkspaceCanvasCardIdSet({
  tutorialSuppressedNodeIds,
  visibleCardIds,
}: {
  tutorialSuppressedNodeIds: string[]
  visibleCardIds: WorkspaceCanvasV2CardId[]
}) {
  return useMemo(
    () =>
      buildVisibleWorkspaceCanvasCardIdSet({
        visibleCardIds,
        tutorialSuppressedNodeIds,
      }),
    [tutorialSuppressedNodeIds, visibleCardIds]
  )
}
