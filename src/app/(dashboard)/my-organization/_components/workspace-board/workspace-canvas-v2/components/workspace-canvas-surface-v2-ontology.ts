"use client"

import { useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { MarkerType, type Edge, type Node } from "@xyflow/react"

import {
  resolveWorkspaceOntologyNodeActivation,
  useWorkspaceOntologyController,
  useWorkspaceOntologyUrlState,
  type WorkspaceOntologyActionTarget,
  type WorkspaceOntologyNodeData,
  WORKSPACE_ONTOLOGY_RELATIONSHIP_SOURCE_HANDLE_ID,
  WORKSPACE_ONTOLOGY_RELATIONSHIP_TARGET_HANDLE_ID,
  type WorkspaceOntologyRootControl,
  type WorkspaceOntologyRootGeometry,
  type WorkspaceOntologyRootId,
} from "@/features/workspace-ontology"

import { resolveCardDimensions } from "../../workspace-board-layout"
import { WORKSPACE_CARD_SOURCE_HANDLE_IDS } from "../../workspace-board-connection-handles"
import type {
  WorkspaceBoardState,
  WorkspaceCardId,
  WorkspaceCardSize,
  WorkspaceOrganizationEditorData,
  WorkspaceSeedData,
} from "../../workspace-board-types"
import { buildWorkspaceCanvasOntologyInput } from "../adapters/workspace-canvas-ontology-input"
import {
  getWorkspaceCanvasPersonNodeId,
  type WorkspaceCanvasPersonPlacement,
  WORKSPACE_CANVAS_PERSON_NODE_SIZE,
} from "./workspace-canvas-person-node-model"
import { buildWorkspaceOntologyEmphasisResolver } from "./workspace-canvas-ontology-emphasis"
import {
  resolveWorkspaceDataDrawerRequest,
  type WorkspaceDataDrawerRequest,
} from "./workspace-canvas-overlay-drawer-tabs"
import type { WorkspaceCanvasV2CardId } from "./workspace-canvas-surface-v2-helpers"

export const WORKSPACE_ONTOLOGY_NODE_TYPE = "workspace-ontology"
export const WORKSPACE_ONTOLOGY_EDGE_TYPE = "workspace-ontology"

type WorkspaceCardMeasuredHeights = Partial<
  Record<WorkspaceCardId, Partial<Record<WorkspaceCardSize, number>>>
>

function resolveWorkspaceCardMeasuredHeight({
  cardId,
  size,
  fallbackHeight,
  cardMeasuredHeights,
}: {
  cardId: WorkspaceCardId
  size: WorkspaceCardSize
  fallbackHeight: number
  cardMeasuredHeights: WorkspaceCardMeasuredHeights
}) {
  const measuredHeight = cardMeasuredHeights[cardId]?.[size]
  return typeof measuredHeight === "number" && Number.isFinite(measuredHeight)
    ? Math.max(1, Math.round(measuredHeight))
    : fallbackHeight
}

function buildRootGeometry({
  boardState,
  visibleCardIds,
  cardMeasuredHeights,
}: {
  boardState: WorkspaceBoardState
  visibleCardIds: WorkspaceCanvasV2CardId[]
  cardMeasuredHeights: WorkspaceCardMeasuredHeights
}) {
  const visibleIds = new Set<string>(visibleCardIds)
  const geometry: Partial<
    Record<WorkspaceOntologyRootId, WorkspaceOntologyRootGeometry>
  > = {}
  for (const node of boardState.nodes) {
    if (!visibleIds.has(node.id)) continue
    if (
      node.id !== "organization-overview" &&
      node.id !== "programs" &&
      node.id !== "accelerator" &&
      node.id !== "roadmap" &&
      node.id !== "calendar" &&
      node.id !== "fiscal-sponsorship"
    ) {
      continue
    }
    const dimensions = resolveCardDimensions(node.size, node.id)
    geometry[node.id] = {
      x: node.x,
      y: node.y,
      width: dimensions.width,
      height: resolveWorkspaceCardMeasuredHeight({
        cardId: node.id,
        size: node.size,
        fallbackHeight: dimensions.height,
        cardMeasuredHeights,
      }),
    }
  }
  return geometry
}

function buildObstacles({
  boardState,
  visibleCardIds,
  personPlacements,
  cardMeasuredHeights,
}: {
  boardState: WorkspaceBoardState
  visibleCardIds: WorkspaceCanvasV2CardId[]
  personPlacements: WorkspaceCanvasPersonPlacement[]
  cardMeasuredHeights: WorkspaceCardMeasuredHeights
}) {
  const visibleIds = new Set<string>(visibleCardIds)
  return [
    ...boardState.nodes
      .filter((node) => visibleIds.has(node.id))
      .map((node) => {
        const dimensions = resolveCardDimensions(node.size, node.id)
        return {
          id: node.id,
          x: node.x,
          y: node.y,
          width: dimensions.width,
          height: resolveWorkspaceCardMeasuredHeight({
            cardId: node.id,
            size: node.size,
            fallbackHeight: dimensions.height,
            cardMeasuredHeights,
          }),
        }
      }),
    ...personPlacements.map((placement) => ({
      id: getWorkspaceCanvasPersonNodeId(placement.personId),
      x: placement.x,
      y: placement.y,
      width: WORKSPACE_CANVAS_PERSON_NODE_SIZE.width,
      height: WORKSPACE_CANVAS_PERSON_NODE_SIZE.height,
    })),
  ]
}

export function useWorkspaceCanvasOntology({
  boardState,
  seed,
  organizationEditorData,
  visibleCardIds,
  personPlacements,
  cardMeasuredHeights,
  enabled,
  zoom,
  onFocusRoot,
  onOpenAction,
  onOpenDataDrawer,
}: {
  boardState: WorkspaceBoardState
  seed: WorkspaceSeedData
  organizationEditorData: WorkspaceOrganizationEditorData
  visibleCardIds: WorkspaceCanvasV2CardId[]
  personPlacements: WorkspaceCanvasPersonPlacement[]
  cardMeasuredHeights: WorkspaceCardMeasuredHeights
  enabled: boolean
  zoom: number
  onFocusRoot: (rootId: WorkspaceOntologyRootId) => void
  onOpenAction: (
    rootId: WorkspaceOntologyRootId,
    target: WorkspaceOntologyActionTarget
  ) => void
  onOpenDataDrawer: (request: Omit<WorkspaceDataDrawerRequest, "id">) => void
}) {
  const router = useRouter()
  const { state: ontologyState, setState: setOntologyState } =
    useWorkspaceOntologyUrlState()
  const visibleRootIds = useMemo(
    () => new Set<string>(visibleCardIds),
    [visibleCardIds]
  )
  const input = useMemo(() => {
    const completeInput = buildWorkspaceCanvasOntologyInput({
      seed,
      editor: organizationEditorData,
      placedPersonIds: personPlacements.map((placement) => placement.personId),
    })
    return {
      roots: completeInput.roots.filter((root) => visibleRootIds.has(root.id)),
      relationships: completeInput.relationships,
    }
  }, [organizationEditorData, personPlacements, seed, visibleRootIds])
  const structureOpen =
    enabled &&
    (ontologyState.mode === "map" || ontologyState.expandedRootIds.length > 0)
  const rootGeometry = useMemo(
    () =>
      buildRootGeometry({
        boardState,
        visibleCardIds,
        cardMeasuredHeights,
      }),
    [boardState, cardMeasuredHeights, visibleCardIds]
  )
  const obstacles = useMemo(
    () =>
      buildObstacles({
        boardState,
        visibleCardIds,
        personPlacements,
        cardMeasuredHeights,
      }),
    [boardState, cardMeasuredHeights, personPlacements, visibleCardIds]
  )
  const controller = useWorkspaceOntologyController({
    input,
    state: ontologyState,
    rootGeometry,
    obstacles,
    enabled,
    zoom,
    onStateChange: setOntologyState,
  })
  const nodeById = useMemo(
    () => new Map(controller.allNodes.map((node) => [node.id, node])),
    [controller.allNodes]
  )
  const layoutNodeById = useMemo(
    () => new Map(controller.layoutNodes.map((node) => [node.id, node])),
    [controller.layoutNodes]
  )
  const toggleNode = controller.toggleNode
  const setMode = controller.setMode
  const activateNode = useCallback(
    (nodeId: string, options?: { openInNewTab?: boolean }) => {
      if (
        nodeId.startsWith("ontology:more:") ||
        nodeId.startsWith("ontology:rollup:")
      ) {
        setMode("map")
        return
      }
      const node = nodeById.get(nodeId)
      if (!node) return
      const activation = resolveWorkspaceOntologyNodeActivation(node)
      if (activation.kind === "toggle-details") {
        toggleNode(activation.nodeId)
        return
      }
      if (activation.kind === "show-map") {
        setMode("map")
        return
      }
      if (activation.kind === "open-action") {
        onOpenAction(activation.rootId, activation.target)
        return
      }
      if (activation.kind === "focus-root") {
        onFocusRoot(activation.rootId)
        return
      }
      if (
        node.category === "documents" &&
        node.id.startsWith("ontology:document:")
      ) {
        onOpenDataDrawer({
          tab: "documents",
          focusKey: node.id.slice("ontology:document:".length),
        })
        return
      }
      if (options?.openInNewTab) {
        window.open(activation.href, "_blank", "noopener,noreferrer")
        return
      }
      const dataDrawerRequest = resolveWorkspaceDataDrawerRequest(
        activation.href
      )
      if (dataDrawerRequest) {
        onOpenDataDrawer(dataDrawerRequest)
        return
      }
      if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(activation.href)) {
        window.location.assign(activation.href)
        return
      }
      router.push(activation.href)
    },
    [
      nodeById,
      onFocusRoot,
      onOpenAction,
      onOpenDataDrawer,
      router,
      setMode,
      toggleNode,
    ]
  )
  const rootControlsByCardId = useMemo(() => {
    const controls: Partial<
      Record<WorkspaceCardId, WorkspaceOntologyRootControl>
    > = {}
    for (const [rootId, control] of Object.entries(controller.rootControls)) {
      if (!control) continue
      controls[rootId as WorkspaceCardId] = control
    }
    return controls
  }, [controller.rootControls])
  const nodes = useMemo<Node<WorkspaceOntologyNodeData>[]>(() => {
    const resolveEmphasis = buildWorkspaceOntologyEmphasisResolver(
      controller.activeNodeIds,
      controller.activeRootId
    )
    return controller.layoutNodes.map((node) => {
      const transitionPhase =
        controller.nodeTransitionPhases.get(node.id) ?? "stable"
      const exiting = transitionPhase === "exiting"
      const { active, dimmed } = resolveEmphasis(node)
      return {
        id: node.id,
        type: WORKSPACE_ONTOLOGY_NODE_TYPE,
        className: "workspace-ontology-layout-node",
        position: node.position,
        width: node.size.width,
        height: node.size.height,
        style: node.size,
        draggable: false,
        selectable: !exiting,
        focusable: node.presentation !== "list",
        data: {
          kind: "workspace-ontology" as const,
          node,
          detailLevel: controller.detailLevel,
          expanded: active,
          active,
          activeItemId: node.items?.find((item) =>
            controller.activeNodeIds.includes(item.id)
          )?.id,
          dimmed,
          transitionPhase,
          transitionDelayMs: controller.nodeTransitionDelays.get(node.id) ?? 0,
          onActivate: (options) => activateNode(node.id, options),
          onActivateItem: activateNode,
        },
      }
    })
  }, [
    activateNode,
    controller.detailLevel,
    controller.activeNodeIds,
    controller.activeRootId,
    controller.layoutNodes,
    controller.nodeTransitionDelays,
    controller.nodeTransitionPhases,
  ])
  const edges = useMemo<Edge[]>(() => {
    const resolveEmphasis = buildWorkspaceOntologyEmphasisResolver(
      controller.activeNodeIds,
      controller.activeRootId
    )
    return controller.edges.map((edge) => {
      const targetNode = layoutNodeById.get(edge.target)
      const dimmed = targetNode ? resolveEmphasis(targetNode).dimmed : false
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        targetHandle:
          edge.kind === "relationship" && edge.target.startsWith("ontology:")
            ? WORKSPACE_ONTOLOGY_RELATIONSHIP_TARGET_HANDLE_ID
            : undefined,
        sourceHandle:
          edge.kind === "relationship" && edge.source.startsWith("ontology:")
            ? WORKSPACE_ONTOLOGY_RELATIONSHIP_SOURCE_HANDLE_ID
            : edge.source.startsWith("ontology:")
              ? undefined
              : WORKSPACE_CARD_SOURCE_HANDLE_IDS.bottom,
        type: WORKSPACE_ONTOLOGY_EDGE_TYPE,
        focusable: false,
        animated: false,
        interactionWidth: 18,
        markerEnd:
          edge.kind === "relationship"
            ? {
                type: MarkerType.ArrowClosed,
                width: 12,
                height: 12,
                color:
                  "color-mix(in srgb, var(--muted-foreground) 78%, transparent)",
              }
            : undefined,
        style: {
          stroke: edge.active
            ? "color-mix(in srgb, rgb(14 165 233) 82%, transparent)"
            : "color-mix(in srgb, var(--muted-foreground) 74%, transparent)",
          strokeWidth: edge.active
            ? 1.8
            : edge.kind === "relationship"
              ? 1.25
              : 1,
          strokeDasharray: edge.kind === "relationship" ? "5 5" : undefined,
          opacity: dimmed ? 0.28 : 1,
        },
        data: {
          role: "workspace-ontology",
          label: edge.label,
          category: edge.category,
          status: edge.status,
          kind: edge.kind,
          showLabel: edge.showLabel,
          active: edge.active,
          dimmed,
          detailLevel: controller.detailLevel,
          transitionPhase:
            controller.edgeTransitionPhases.get(edge.id) ?? "stable",
          transitionDelayMs: controller.edgeTransitionDelays.get(edge.id) ?? 0,
        },
      }
    })
  }, [
    controller.activeNodeIds,
    controller.activeRootId,
    controller.detailLevel,
    controller.edges,
    controller.edgeTransitionDelays,
    controller.edgeTransitionPhases,
    layoutNodeById,
  ])

  return {
    ...controller,
    structureOpen,
    nodes,
    edges,
    activateNode,
    rootControlsByCardId,
  }
}
