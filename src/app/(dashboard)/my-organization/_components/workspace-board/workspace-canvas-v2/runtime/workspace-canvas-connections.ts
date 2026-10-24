"use client"

import type { Connection, Edge } from "@xyflow/react"

import {
  ACCELERATOR_STEP_EDGE_ID,
  ACCELERATOR_STEP_NODE_ID,
} from "../../workspace-board-flow-surface-accelerator-graph-composition"
import { resolveWorkspaceAcceleratorStepEdgeHandles } from "../../workspace-board-accelerator-step-layout"
import {
  type WorkspaceCardEdgeGeometryLookup,
  resolveWorkspaceCardConnectionHandleIds,
} from "../../workspace-board-connection-handles"
import type {
  WorkspaceAutoLayoutMode,
  WorkspaceBoardState,
  WorkspaceCardId,
} from "../../workspace-board-types"
import {
  validateWorkspaceConnection,
  type WorkspaceConnectionValidationResult,
} from "../contracts/workspace-connection-contract"
import { WORKSPACE_CANVAS_TUTORIAL_NODE_ID } from "../components/workspace-canvas-surface-v2-tutorial-runtime"
import {
  WORKSPACE_CANVAS_V2_CARD_IDS,
  type WorkspaceCanvasV2CardId,
} from "../contracts/workspace-card-contract"
import type { WorkspaceCardReadiness } from "./workspace-canvas-card-readiness"
import { resolveWorkspaceCanvasBranchStyle } from "./workspace-canvas-branch-style"

const WORKSPACE_CANVAS_V2_CARD_ID_SET = new Set<WorkspaceCanvasV2CardId>(
  WORKSPACE_CANVAS_V2_CARD_IDS
)

const WORKSPACE_CONNECTION_LABELS = {
  "workspace-link": "connected to",
  "organization-context": "informs",
  "program-plan": "plans",
  tasks: "requires",
  "brand-assets": "uses",
  "financial-model": "funds",
  schedule: "schedules",
  campaign: "publishes",
} as const

type WorkspaceConnectionValidationFailureReason = Extract<
  WorkspaceConnectionValidationResult,
  { allowed: false }
>["reason"]

export type WorkspaceCanvasDroppedConnectionReason =
  | "unknown-node-id"
  | "hidden-node-id"
  | WorkspaceConnectionValidationFailureReason

export type WorkspaceCanvasDroppedConnection = {
  id: string
  reason: WorkspaceCanvasDroppedConnectionReason
}

export type WorkspaceCanvasConnectAttemptResult =
  | {
      allowed: true
      source: WorkspaceCanvasV2CardId
      target: WorkspaceCanvasV2CardId
      matchedPortType: Extract<
        WorkspaceConnectionValidationResult,
        { allowed: true }
      >["matchedPortType"]
    }
  | {
      allowed: false
      reason:
        | "read-only"
        | "missing-node-id"
        | "unknown-node-id"
        | "hidden-node-id"
        | WorkspaceConnectionValidationFailureReason
    }

export type WorkspaceCanvasDisconnectActionSets = {
  edgeConnectionIds: string[]
  sourceConnectionIds: string[]
  targetConnectionIds: string[]
}

function isWorkspaceCanvasV2CardId(
  value: string
): value is WorkspaceCanvasV2CardId {
  return WORKSPACE_CANVAS_V2_CARD_ID_SET.has(value as WorkspaceCanvasV2CardId)
}

export function resolveWorkspaceCanvasConnectAttempt({
  connection,
  allowEditing,
  visibleCardIdSet,
}: {
  connection: Pick<Connection, "source" | "target">
  allowEditing: boolean
  visibleCardIdSet: ReadonlySet<WorkspaceCanvasV2CardId>
}): WorkspaceCanvasConnectAttemptResult {
  if (!allowEditing) {
    return { allowed: false, reason: "read-only" }
  }

  if (!connection.source || !connection.target) {
    return { allowed: false, reason: "missing-node-id" }
  }

  if (
    !isWorkspaceCanvasV2CardId(connection.source) ||
    !isWorkspaceCanvasV2CardId(connection.target)
  ) {
    return { allowed: false, reason: "unknown-node-id" }
  }

  if (
    !visibleCardIdSet.has(connection.source) ||
    !visibleCardIdSet.has(connection.target)
  ) {
    return { allowed: false, reason: "hidden-node-id" }
  }

  const validation = validateWorkspaceConnection({
    source: connection.source,
    target: connection.target,
  })

  if (!validation.allowed) {
    return {
      allowed: false,
      reason: validation.reason,
    }
  }

  return {
    allowed: true,
    source: connection.source,
    target: connection.target,
    matchedPortType: validation.matchedPortType,
  }
}

function resolveAcceleratorStepEdgeStyle(presentationMode: boolean) {
  return {
    stroke: "rgba(148, 163, 184, 0.72)",
    strokeWidth: presentationMode ? 1.2 : 1.5,
    strokeDasharray: "4 4",
    opacity: presentationMode ? 0.72 : 0.88,
  } as const
}

export function buildWorkspaceCanvasV2Edges({
  connections,
  visibleCardIdSet,
  presentationMode,
  readinessMap,
  includeAcceleratorStepEdge,
  autoLayoutMode = "dagre-tree",
  acceleratorWorkspaceNodeId,
  tutorialEdgeTargetId,
  nodeGeometryLookup = {},
}: {
  connections: WorkspaceBoardState["connections"]
  visibleCardIdSet: ReadonlySet<WorkspaceCanvasV2CardId>
  presentationMode: boolean
  readinessMap: Record<WorkspaceCanvasV2CardId, WorkspaceCardReadiness>
  includeAcceleratorStepEdge: boolean
  autoLayoutMode?: WorkspaceAutoLayoutMode
  acceleratorWorkspaceNodeId: WorkspaceCanvasV2CardId | null
  tutorialEdgeTargetId: WorkspaceCardId | null
  nodeGeometryLookup?: WorkspaceCardEdgeGeometryLookup
}): {
  edges: Edge[]
  droppedConnectionIds: string[]
  droppedConnections: WorkspaceCanvasDroppedConnection[]
} {
  const edges: Edge[] = []
  const droppedConnectionIds: string[] = []
  const droppedConnections: WorkspaceCanvasDroppedConnection[] = []

  for (const connection of connections) {
    if (
      !isWorkspaceCanvasV2CardId(connection.source) ||
      !isWorkspaceCanvasV2CardId(connection.target)
    ) {
      droppedConnectionIds.push(connection.id)
      droppedConnections.push({
        id: connection.id,
        reason: "unknown-node-id",
      })
      continue
    }

    if (
      !visibleCardIdSet.has(connection.source) ||
      !visibleCardIdSet.has(connection.target)
    ) {
      droppedConnectionIds.push(connection.id)
      droppedConnections.push({
        id: connection.id,
        reason: "hidden-node-id",
      })
      continue
    }

    const validation = validateWorkspaceConnection({
      source: connection.source,
      target: connection.target,
    })
    if (!validation.allowed) {
      droppedConnectionIds.push(connection.id)
      droppedConnections.push({
        id: connection.id,
        reason: validation.reason,
      })
      continue
    }

    const handleIds = resolveWorkspaceCardConnectionHandleIds({
      source: nodeGeometryLookup[connection.source],
      target: nodeGeometryLookup[connection.target],
    })

    edges.push({
      id: connection.id,
      source: connection.source,
      target: connection.target,
      sourceHandle: handleIds?.sourceHandle,
      targetHandle: handleIds?.targetHandle,
      type: "workspace-ontology",
      animated: false,
      style: resolveWorkspaceCanvasBranchStyle({
        readiness: readinessMap[connection.target],
        presentationMode,
      }),
      data: {
        role: "workspace-card-connection",
        label: WORKSPACE_CONNECTION_LABELS[validation.matchedPortType],
        portType: validation.matchedPortType,
        readiness: readinessMap[connection.target].status,
      },
    })
  }

  if (includeAcceleratorStepEdge && acceleratorWorkspaceNodeId) {
    const handleIds = resolveWorkspaceAcceleratorStepEdgeHandles(autoLayoutMode)
    edges.push({
      id: ACCELERATOR_STEP_EDGE_ID,
      source: acceleratorWorkspaceNodeId,
      target: ACCELERATOR_STEP_NODE_ID,
      sourceHandle: handleIds.sourceHandle,
      targetHandle: handleIds.targetHandle,
      type: "smoothstep",
      animated: true,
      style: resolveAcceleratorStepEdgeStyle(presentationMode),
      data: {
        role: "accelerator-step",
      },
    })
  }

  if (
    tutorialEdgeTargetId &&
    visibleCardIdSet.has(tutorialEdgeTargetId as WorkspaceCanvasV2CardId)
  ) {
    edges.push({
      id: "workspace-canvas-tutorial-edge",
      source: WORKSPACE_CANVAS_TUTORIAL_NODE_ID,
      target: tutorialEdgeTargetId,
      type: "smoothstep",
      animated: false,
      style: {
        stroke: "rgba(148, 163, 184, 0.58)",
        strokeWidth: presentationMode ? 1.15 : 1.4,
        strokeDasharray: "8 6",
        opacity: presentationMode ? 0.56 : 0.74,
      },
      data: {
        role: "workspace-canvas-tutorial",
      },
    })
  }

  return { edges, droppedConnectionIds, droppedConnections }
}

export function shouldLogWorkspaceCanvasDroppedConnections(
  droppedConnections: WorkspaceCanvasDroppedConnection[]
) {
  return droppedConnections.some(
    (connection) => connection.reason !== "hidden-node-id"
  )
}

export function resolveWorkspaceCanvasDisconnectActionSets({
  connections,
  edgeId,
  source,
  target,
}: {
  connections: WorkspaceBoardState["connections"]
  edgeId: string
  source: WorkspaceCanvasV2CardId
  target: WorkspaceCanvasV2CardId
}): WorkspaceCanvasDisconnectActionSets {
  const edgeConnectionIds = connections
    .filter((connection) => connection.id === edgeId)
    .map((connection) => connection.id)
  const sourceConnectionIds = connections
    .filter((connection) => connection.source === source)
    .map((connection) => connection.id)
  const targetConnectionIds = connections
    .filter((connection) => connection.target === target)
    .map((connection) => connection.id)

  return {
    edgeConnectionIds,
    sourceConnectionIds,
    targetConnectionIds,
  }
}
