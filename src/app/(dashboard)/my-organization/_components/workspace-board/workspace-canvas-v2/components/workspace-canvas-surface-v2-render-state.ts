"use client"

import type { Node as ReactFlowNode } from "@xyflow/react"
import {
  type MutableRefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react"
import { applyNodeChanges, useNodesState, type NodeChange } from "@xyflow/react"

import type { OrgPersonWithImage } from "@/components/people/supporters-showcase"
import type { WorkspaceBoardNodeData } from "../../workspace-board-node-types"
import type {
  WorkspaceBoardState,
  WorkspaceCardId,
} from "../../workspace-board-types"
import { useWorkspaceTutorialSceneFitRequest } from "./workspace-canvas-surface-v2-controller-hooks"
import { shouldReconcileWorkspaceCanvasNodes } from "./workspace-canvas-node-change-policy"
import { buildInitialWorkspaceCanvasNodes } from "./workspace-canvas-surface-v2-node-builders"
import type { WorkspaceCanvasPersonPlacement } from "./workspace-canvas-person-node-model"
import {
  type WorkspaceCanvasNode,
  type WorkspaceCanvasNodeData,
  type WorkspaceCanvasV2CardId,
  resolveWorkspaceCanvasRenderNodes,
} from "./workspace-canvas-surface-v2-helpers"

function resolveTutorialSceneLayoutKey({
  nodes,
  tutorialActive,
  tutorialSceneNodeIds,
}: {
  nodes: WorkspaceCanvasNode[]
  tutorialActive: boolean
  tutorialSceneNodeIds: string[]
}) {
  if (!tutorialActive || tutorialSceneNodeIds.length === 0) {
    return null
  }

  const sceneNodeIdSet = new Set(tutorialSceneNodeIds)
  const sceneNodes = nodes.filter((node) => sceneNodeIdSet.has(node.id))
  const layoutNodes = sceneNodes.filter(
    (node) => node.id !== "workspace-canvas-tutorial"
  )

  const nodesForLayoutKey = layoutNodes.length > 0 ? layoutNodes : sceneNodes

  return nodesForLayoutKey
    .map(
      (node) =>
        `${node.id}:${Math.round(node.position.x)}:${Math.round(node.position.y)}`
    )
    .join("|")
}

function useWorkspaceTutorialSceneFit({
  nodes,
  tutorialActive,
  tutorialSceneNodeIds,
  tutorialSceneSignature,
  tutorialSceneCameraViewport,
  tutorialSceneRequestSeed,
}: {
  nodes: WorkspaceCanvasNode[]
  tutorialActive: boolean
  tutorialSceneNodeIds: string[]
  tutorialSceneSignature: string | null
  tutorialSceneCameraViewport: {
    x: number
    y: number
    zoom: number
    duration: number
    delayMs?: number
  } | null
  tutorialSceneRequestSeed: number
}) {
  const tutorialSceneLayoutKey = useMemo(
    () =>
      resolveTutorialSceneLayoutKey({
        nodes,
        tutorialActive,
        tutorialSceneNodeIds,
      }),
    [nodes, tutorialActive, tutorialSceneNodeIds]
  )

  return useWorkspaceTutorialSceneFitRequest({
    tutorialActive,
    sceneSignature: tutorialSceneSignature,
    sceneViewport: tutorialSceneCameraViewport,
    sceneNodeIds: tutorialSceneNodeIds,
    sceneLayoutKey: tutorialSceneLayoutKey,
    sceneRequestSeed: tutorialSceneRequestSeed,
  })
}

function useResolvedWorkspaceCanvasNodes({
  nodes,
  visibleCardIds,
  boardNodeLookup,
  cardDataLookup,
  orgNodePositionFromBoard,
  allowEditing,
  allowPeopleCanvasInteraction,
  acceleratorStepNodeData,
  tutorialNodeData,
  workspacePersonPlacements,
  workspacePersonById,
  onRemoveWorkspacePerson,
  tutorialSceneCardPositionOverrides,
  tutorialDraggableCardIds,
}: {
  nodes: WorkspaceCanvasNode[]
  visibleCardIds: WorkspaceCanvasV2CardId[]
  boardNodeLookup: Map<WorkspaceCardId, WorkspaceBoardState["nodes"][number]>
  cardDataLookup: Record<WorkspaceCardId, WorkspaceBoardNodeData>
  orgNodePositionFromBoard: { x: number; y: number }
  allowEditing: boolean
  allowPeopleCanvasInteraction: boolean
  acceleratorStepNodeData: WorkspaceCanvasNode | null
  tutorialNodeData: WorkspaceCanvasNode | null
  workspacePersonPlacements: WorkspaceCanvasPersonPlacement[]
  workspacePersonById: ReadonlyMap<string, OrgPersonWithImage>
  onRemoveWorkspacePerson: (personId: string) => void
  tutorialSceneCardPositionOverrides: Partial<
    Record<WorkspaceCanvasV2CardId, { x: number; y: number }>
  > | null
  tutorialDraggableCardIds: WorkspaceCanvasV2CardId[]
}) {
  const renderNodes = useMemo(
    () =>
      resolveWorkspaceCanvasRenderNodes({
        nodes,
        visibleCardIds,
        boardNodeLookup,
        cardDataLookup,
        orgNodePositionFromBoard,
        allowEditing,
        allowPeopleCanvasInteraction,
        acceleratorStepNodeData,
        tutorialNodeData,
        workspacePersonPlacements,
        workspacePersonById,
        onRemoveWorkspacePerson,
        tutorialCardPositionOverrides: tutorialSceneCardPositionOverrides,
        tutorialDraggableCardIds,
      }),
    [
      acceleratorStepNodeData,
      allowEditing,
      allowPeopleCanvasInteraction,
      boardNodeLookup,
      cardDataLookup,
      nodes,
      onRemoveWorkspacePerson,
      orgNodePositionFromBoard,
      tutorialNodeData,
      tutorialDraggableCardIds,
      tutorialSceneCardPositionOverrides,
      visibleCardIds,
      workspacePersonById,
      workspacePersonPlacements,
    ]
  )
  const visibleNodeIds = useMemo(
    () => renderNodes.map((node) => node.id),
    [renderNodes]
  )

  return { renderNodes, visibleNodeIds }
}

export function useWorkspaceCanvasRenderState({
  visibleCardIds,
  boardNodeLookup,
  initialPositionLookupRef,
  cardDataLookup,
  allowEditing,
  allowPeopleCanvasInteraction,
  tutorialActive,
  acceleratorStepNodeData,
  tutorialNodeData,
  workspacePersonPlacements,
  workspacePersonById,
  onRemoveWorkspacePerson,
  tutorialSceneCardPositionOverrides,
  tutorialDraggableCardIds,
  orgNodePositionFromBoard,
  tutorialSceneNodeIds,
  tutorialSceneSignature,
  tutorialSceneCameraViewport,
  tutorialSceneRequestSeed,
}: {
  visibleCardIds: WorkspaceCanvasV2CardId[]
  boardNodeLookup: Map<WorkspaceCardId, WorkspaceBoardState["nodes"][number]>
  initialPositionLookupRef: MutableRefObject<
    Record<WorkspaceCanvasV2CardId, { x: number; y: number }>
  >
  cardDataLookup: Record<WorkspaceCardId, WorkspaceBoardNodeData>
  allowEditing: boolean
  allowPeopleCanvasInteraction: boolean
  tutorialActive: boolean
  acceleratorStepNodeData: WorkspaceCanvasNode | null
  tutorialNodeData: WorkspaceCanvasNode | null
  workspacePersonPlacements: WorkspaceCanvasPersonPlacement[]
  workspacePersonById: ReadonlyMap<string, OrgPersonWithImage>
  onRemoveWorkspacePerson: (personId: string) => void
  tutorialSceneCardPositionOverrides: Partial<
    Record<WorkspaceCanvasV2CardId, { x: number; y: number }>
  > | null
  tutorialDraggableCardIds: WorkspaceCanvasV2CardId[]
  orgNodePositionFromBoard: { x: number; y: number }
  tutorialSceneNodeIds: string[]
  tutorialSceneSignature: string | null
  tutorialSceneCameraViewport: {
    x: number
    y: number
    zoom: number
    duration: number
    delayMs?: number
  } | null
  tutorialSceneRequestSeed: number
}) {
  const initialNodes = useMemo<WorkspaceCanvasNode[]>(
    () =>
      buildInitialWorkspaceCanvasNodes({
        visibleCardIds,
        boardNodeLookup,
        initialPositionLookupRef,
        cardDataLookup,
        allowEditing,
        allowPeopleCanvasInteraction,
        acceleratorStepNodeData,
        tutorialNodeData,
        workspacePersonPlacements,
        workspacePersonById,
        onRemoveWorkspacePerson,
        tutorialDraggableCardIds,
        tutorialCardPositionOverrides: tutorialSceneCardPositionOverrides,
      }),
    [
      acceleratorStepNodeData,
      allowEditing,
      allowPeopleCanvasInteraction,
      boardNodeLookup,
      cardDataLookup,
      initialPositionLookupRef,
      onRemoveWorkspacePerson,
      tutorialNodeData,
      tutorialDraggableCardIds,
      tutorialSceneCardPositionOverrides,
      visibleCardIds,
      workspacePersonById,
      workspacePersonPlacements,
    ]
  )
  const [nodes, setNodes] = useNodesState<ReactFlowNode<WorkspaceCanvasNodeData>>(initialNodes)
  const latestInitialNodesRef = useRef(initialNodes)
  const previousTutorialSceneRequestSeedRef = useRef(tutorialSceneRequestSeed)
  const previousTutorialActiveRef = useRef(tutorialActive)

  useEffect(() => {
    latestInitialNodesRef.current = initialNodes
  }, [initialNodes])

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((currentNodes) => {
        const baseNodes = shouldReconcileWorkspaceCanvasNodes(changes)
          ? resolveWorkspaceCanvasRenderNodes({
              nodes: currentNodes,
              visibleCardIds,
              boardNodeLookup,
              cardDataLookup,
              orgNodePositionFromBoard,
              allowEditing,
              allowPeopleCanvasInteraction,
              acceleratorStepNodeData,
              tutorialNodeData,
              workspacePersonPlacements,
              workspacePersonById,
              onRemoveWorkspacePerson,
              tutorialCardPositionOverrides: tutorialSceneCardPositionOverrides,
              tutorialDraggableCardIds,
            })
          : currentNodes

        return applyNodeChanges(changes, baseNodes) as WorkspaceCanvasNode[]
      })
    },
    [
      acceleratorStepNodeData,
      allowEditing,
      allowPeopleCanvasInteraction,
      boardNodeLookup,
      cardDataLookup,
      onRemoveWorkspacePerson,
      orgNodePositionFromBoard,
      setNodes,
      tutorialNodeData,
      tutorialDraggableCardIds,
      tutorialSceneCardPositionOverrides,
      visibleCardIds,
      workspacePersonById,
      workspacePersonPlacements,
    ]
  )

  useEffect(() => {
    if (previousTutorialActiveRef.current === tutorialActive) {
      return
    }

    previousTutorialActiveRef.current = tutorialActive
    setNodes(latestInitialNodesRef.current)
  }, [setNodes, tutorialActive])

  useEffect(() => {
    if (
      previousTutorialSceneRequestSeedRef.current === tutorialSceneRequestSeed
    ) {
      return
    }
    previousTutorialSceneRequestSeedRef.current = tutorialSceneRequestSeed
    // Restarting the guide should rebuild the local React Flow node store from the
    // authored welcome snapshot instead of reconciling against whatever node set
    // the completed guide left behind.
    setNodes(latestInitialNodesRef.current)
  }, [setNodes, tutorialSceneRequestSeed])

  const { renderNodes, visibleNodeIds } = useResolvedWorkspaceCanvasNodes({
    nodes,
    visibleCardIds,
    boardNodeLookup,
    cardDataLookup,
    orgNodePositionFromBoard,
    allowEditing,
    allowPeopleCanvasInteraction,
    acceleratorStepNodeData,
    tutorialNodeData,
    workspacePersonPlacements,
    workspacePersonById,
    onRemoveWorkspacePerson,
    tutorialSceneCardPositionOverrides,
    tutorialDraggableCardIds,
  })
  const tutorialSceneFitRequest = useWorkspaceTutorialSceneFit({
    nodes: renderNodes,
    tutorialActive,
    tutorialSceneNodeIds,
    tutorialSceneSignature,
    tutorialSceneCameraViewport,
    tutorialSceneRequestSeed,
  })

  return {
    onNodesChange: handleNodesChange,
    renderNodes,
    visibleNodeIds,
    tutorialSceneFitRequest,
  }
}
