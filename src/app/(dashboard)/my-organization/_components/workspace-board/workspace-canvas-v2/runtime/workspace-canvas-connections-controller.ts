"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { Connection, EdgeMouseHandler, IsValidConnection } from "@xyflow/react"

import { ACCELERATOR_STEP_EDGE_ID } from "../../workspace-board-flow-surface-accelerator-graph-composition"
import type { WorkspaceCardEdgeGeometryLookup } from "../../workspace-board-connection-handles"
import { WORKSPACE_CARD_META } from "../../workspace-board-copy"
import type {
  WorkspaceAutoLayoutMode,
  WorkspaceBoardState,
  WorkspaceCardId,
} from "../../workspace-board-types"
import { WORKSPACE_CANVAS_EVENTS } from "../contracts/workspace-canvas-events"
import {
  WORKSPACE_CANVAS_V2_CARD_IDS,
  type WorkspaceCanvasV2CardId,
} from "../contracts/workspace-card-contract"
import {
  buildWorkspaceCanvasV2Edges,
  resolveWorkspaceCanvasConnectAttempt,
  resolveWorkspaceCanvasDisconnectActionSets,
  shouldLogWorkspaceCanvasDroppedConnections,
} from "./workspace-canvas-connections"
import type { WorkspaceCardReadiness } from "./workspace-canvas-card-readiness"
import {
  logWorkspaceCanvasEvent,
  logWorkspaceCanvasWarning,
} from "./workspace-canvas-logger"

const WORKSPACE_CANVAS_V2_CARD_ID_SET = new Set<WorkspaceCanvasV2CardId>(
  WORKSPACE_CANVAS_V2_CARD_IDS
)

function isWorkspaceCanvasV2CardId(
  value: string
): value is WorkspaceCanvasV2CardId {
  return WORKSPACE_CANVAS_V2_CARD_ID_SET.has(value as WorkspaceCanvasV2CardId)
}

type WorkspaceCanvasEdgeContextMenuState = {
  x: number
  y: number
  edgeId: string
  sourceId: WorkspaceCanvasV2CardId
  targetId: WorkspaceCanvasV2CardId
  sourceTitle: string
  targetTitle: string
  sourceConnectionCount: number
  targetConnectionCount: number
}

export function useWorkspaceCanvasConnectionsController({
  allowEditing,
  connections,
  visibleCardIdSet,
  presentationMode,
  readinessMap,
  acceleratorStepNodeVisible,
  autoLayoutMode,
  acceleratorWorkspaceNodeId,
  tutorialEdgeTargetId,
  nodeGeometryLookup,
  onConnectCards,
  onDisconnectConnection,
  onDisconnectAllConnections,
}: {
  allowEditing: boolean
  connections: WorkspaceBoardState["connections"]
  visibleCardIdSet: ReadonlySet<WorkspaceCanvasV2CardId>
  presentationMode: boolean
  readinessMap: Record<WorkspaceCanvasV2CardId, WorkspaceCardReadiness>
  acceleratorStepNodeVisible: boolean
  autoLayoutMode: WorkspaceAutoLayoutMode
  acceleratorWorkspaceNodeId: WorkspaceCanvasV2CardId | null
  tutorialEdgeTargetId: WorkspaceCardId | null
  nodeGeometryLookup: WorkspaceCardEdgeGeometryLookup
  onConnectCards: (source: WorkspaceCardId, target: WorkspaceCardId) => void
  onDisconnectConnection: (connectionId: string) => void
  onDisconnectAllConnections: () => void
}) {
  const [edgeContextMenuState, setEdgeContextMenuState] =
    useState<WorkspaceCanvasEdgeContextMenuState | null>(null)
  const { edges, droppedConnectionIds, droppedConnections } = useMemo(
    () =>
      buildWorkspaceCanvasV2Edges({
        connections,
        visibleCardIdSet,
        presentationMode,
        readinessMap,
        includeAcceleratorStepEdge:
          acceleratorStepNodeVisible && Boolean(acceleratorWorkspaceNodeId),
        autoLayoutMode,
        acceleratorWorkspaceNodeId,
        tutorialEdgeTargetId,
        nodeGeometryLookup,
      }),
    [
      acceleratorStepNodeVisible,
      autoLayoutMode,
      acceleratorWorkspaceNodeId,
      connections,
      nodeGeometryLookup,
      presentationMode,
      readinessMap,
      tutorialEdgeTargetId,
      visibleCardIdSet,
    ]
  )
  const droppedConnectionIdsSignature = useMemo(
    () => droppedConnectionIds.join("|"),
    [droppedConnectionIds]
  )
  const lastDroppedConnectionIdsSignatureRef = useRef("")

  useEffect(() => {
    if (droppedConnectionIds.length === 0) {
      lastDroppedConnectionIdsSignatureRef.current = ""
      return
    }

    if (!shouldLogWorkspaceCanvasDroppedConnections(droppedConnections)) {
      lastDroppedConnectionIdsSignatureRef.current =
        droppedConnectionIdsSignature
      return
    }

    if (
      lastDroppedConnectionIdsSignatureRef.current ===
      droppedConnectionIdsSignature
    )
      return
    lastDroppedConnectionIdsSignatureRef.current = droppedConnectionIdsSignature
    logWorkspaceCanvasWarning(
      WORKSPACE_CANVAS_EVENTS.CONNECTION_DROPPED_INVALID,
      {
        droppedCount: droppedConnectionIds.length,
        droppedConnectionIds,
        droppedConnections,
      }
    )
  }, [droppedConnectionIds, droppedConnectionIdsSignature, droppedConnections])

  useEffect(() => {
    if (!edgeContextMenuState) return
    const edgeStillExists = connections.some(
      (connection) => connection.id === edgeContextMenuState.edgeId
    )
    if (edgeStillExists) return
    setEdgeContextMenuState(null)
  }, [connections, edgeContextMenuState])

  useEffect(() => {
    if (!edgeContextMenuState) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      setEdgeContextMenuState(null)
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [edgeContextMenuState])

  const closeEdgeContextMenu = useCallback(() => {
    setEdgeContextMenuState(null)
  }, [])

  const resolveConnectionAttempt = useCallback(
    (connection: Pick<Connection, "source" | "target">) =>
      resolveWorkspaceCanvasConnectAttempt({
        connection,
        allowEditing,
        visibleCardIdSet,
      }),
    [allowEditing, visibleCardIdSet]
  )

  const handleIsValidConnection = useCallback<IsValidConnection>(
    (connection) => resolveConnectionAttempt(connection).allowed,
    [resolveConnectionAttempt]
  )

  const handleConnect = useCallback(
    (connection: Connection) => {
      const result = resolveConnectionAttempt(connection)
      if (!result.allowed) {
        logWorkspaceCanvasWarning(WORKSPACE_CANVAS_EVENTS.CONNECTION_REJECTED, {
          source: connection.source ?? null,
          target: connection.target ?? null,
          reason: result.reason,
        })
        return
      }

      onConnectCards(result.source, result.target)
      logWorkspaceCanvasEvent(WORKSPACE_CANVAS_EVENTS.CONNECTION_ACCEPTED, {
        source: result.source,
        target: result.target,
        portType: result.matchedPortType,
      })
    },
    [onConnectCards, resolveConnectionAttempt]
  )

  const disconnectMany = useCallback(
    (connectionIds: string[]) => {
      if (connectionIds.length === 0) return
      for (const connectionId of connectionIds) {
        onDisconnectConnection(connectionId)
      }
    },
    [onDisconnectConnection]
  )

  const handleEdgeDoubleClick = useCallback<EdgeMouseHandler>(
    (_event, edge) => {
      if (!allowEditing) return
      if (edge.id === ACCELERATOR_STEP_EDGE_ID) return
      if (edge.data?.role !== "workspace-card-connection") return

      onDisconnectConnection(edge.id)
      logWorkspaceCanvasEvent(WORKSPACE_CANVAS_EVENTS.CONNECTION_REMOVED, {
        edgeId: edge.id,
        source: edge.source,
        target: edge.target,
      })
    },
    [allowEditing, onDisconnectConnection]
  )

  const handleEdgeContextMenu = useCallback<EdgeMouseHandler>(
    (event, edge) => {
      if (!allowEditing) return
      if (edge.id === ACCELERATOR_STEP_EDGE_ID) return
      if (
        !isWorkspaceCanvasV2CardId(edge.source) ||
        !isWorkspaceCanvasV2CardId(edge.target)
      ) {
        return
      }
      event.preventDefault()
      setEdgeContextMenuState({
        x: event.clientX,
        y: event.clientY,
        edgeId: edge.id,
        sourceId: edge.source,
        targetId: edge.target,
        sourceTitle: WORKSPACE_CARD_META[edge.source].title,
        targetTitle: WORKSPACE_CARD_META[edge.target].title,
        sourceConnectionCount: connections.filter(
          (connection) => connection.source === edge.source
        ).length,
        targetConnectionCount: connections.filter(
          (connection) => connection.target === edge.target
        ).length,
      })
    },
    [allowEditing, connections]
  )

  const handleContextDisconnectEdge = useCallback(() => {
    if (!edgeContextMenuState) return
    const sets = resolveWorkspaceCanvasDisconnectActionSets({
      connections,
      edgeId: edgeContextMenuState.edgeId,
      source: edgeContextMenuState.sourceId,
      target: edgeContextMenuState.targetId,
    })
    disconnectMany(sets.edgeConnectionIds)
    closeEdgeContextMenu()
  }, [closeEdgeContextMenu, connections, disconnectMany, edgeContextMenuState])

  const handleContextDisconnectFromSource = useCallback(() => {
    if (!edgeContextMenuState) return
    const sets = resolveWorkspaceCanvasDisconnectActionSets({
      connections,
      edgeId: edgeContextMenuState.edgeId,
      source: edgeContextMenuState.sourceId,
      target: edgeContextMenuState.targetId,
    })
    disconnectMany(sets.sourceConnectionIds)
    closeEdgeContextMenu()
  }, [closeEdgeContextMenu, connections, disconnectMany, edgeContextMenuState])

  const handleContextDisconnectToTarget = useCallback(() => {
    if (!edgeContextMenuState) return
    const sets = resolveWorkspaceCanvasDisconnectActionSets({
      connections,
      edgeId: edgeContextMenuState.edgeId,
      source: edgeContextMenuState.sourceId,
      target: edgeContextMenuState.targetId,
    })
    disconnectMany(sets.targetConnectionIds)
    closeEdgeContextMenu()
  }, [closeEdgeContextMenu, connections, disconnectMany, edgeContextMenuState])

  const handleContextDisconnectAll = useCallback(() => {
    onDisconnectAllConnections()
    closeEdgeContextMenu()
  }, [closeEdgeContextMenu, onDisconnectAllConnections])

  return {
    edges,
    edgeContextMenuState,
    closeEdgeContextMenu,
    handleConnect,
    handleIsValidConnection,
    handleEdgeDoubleClick,
    handleEdgeContextMenu,
    handleContextDisconnectEdge,
    handleContextDisconnectFromSource,
    handleContextDisconnectToTarget,
    handleContextDisconnectAll,
  }
}
