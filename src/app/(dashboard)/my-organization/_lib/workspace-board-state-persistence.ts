import { preferNewerParticleState } from "@/features/workspace-particles/client"
import type {
  WorkspaceBoardState,
  WorkspaceCardId,
} from "../_components/workspace-board/workspace-board-types"
import { buildAutoLayoutNodesForMode } from "../_components/workspace-board/workspace-board-auto-layout-modes"
import { mergeWorkspaceBoardForwardCompatibilityState } from "../_components/workspace-board/workspace-board-forward-compatibility"

function parseWorkspaceBoardTimestamp(value: string) {
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : null
}

function isPersistedWorkspaceBoardStateNewer({
  incoming,
  persisted,
}: {
  incoming: WorkspaceBoardState
  persisted: WorkspaceBoardState
}) {
  const incomingUpdatedAt = parseWorkspaceBoardTimestamp(incoming.updatedAt)
  const persistedUpdatedAt = parseWorkspaceBoardTimestamp(persisted.updatedAt)

  if (persistedUpdatedAt === null) return false
  if (incomingUpdatedAt === null) return true

  return persistedUpdatedAt > incomingUpdatedAt
}

function isPersistedWorkspaceOntologyNewer({
  incoming,
  persisted,
}: {
  incoming: WorkspaceBoardState
  persisted: WorkspaceBoardState
}) {
  if (!persisted.ontology) return false
  const incomingUpdatedAt = incoming.ontology?.updatedAt
    ? parseWorkspaceBoardTimestamp(incoming.ontology.updatedAt)
    : null
  const persistedUpdatedAt = persisted.ontology.updatedAt
    ? parseWorkspaceBoardTimestamp(persisted.ontology.updatedAt)
    : null
  if (persistedUpdatedAt === null) return false
  if (incomingUpdatedAt === null) return true
  return persistedUpdatedAt > incomingUpdatedAt
}

function buildWorkspaceAutoLayoutNodeLookup(boardState: WorkspaceBoardState) {
  return new Map(
    buildAutoLayoutNodesForMode({
      mode: boardState.autoLayoutMode,
      hiddenCardIds: boardState.hiddenCardIds,
      connections: boardState.connections,
    }).map((node) => [node.id, node] as const)
  )
}

function isNodeAtPosition(
  node: { x: number; y: number },
  position: { x: number; y: number } | undefined
) {
  return position ? node.x === position.x && node.y === position.y : false
}

function resolveWorkspaceNodePositionMode({
  node,
  autoLayoutNode,
}: {
  node: WorkspaceBoardState["nodes"][number]
  autoLayoutNode: WorkspaceBoardState["nodes"][number] | undefined
}) {
  if (node.positionMode === "managed" || node.positionMode === "manual") {
    return node.positionMode
  }
  return isNodeAtPosition(node, autoLayoutNode) ? "managed" : "manual"
}

export function mergeNewerPersistedWorkspaceNodeState({
  incoming,
  persisted,
}: {
  incoming: WorkspaceBoardState
  persisted: WorkspaceBoardState | null
}) {
  if (!persisted) return incoming

  const persistedNodesById = new Map(
    persisted.nodes.map((node) => [node.id, node] as const)
  )
  const persistedIsNewer = isPersistedWorkspaceBoardStateNewer({
    incoming,
    persisted,
  })
  const incomingAutoLayoutNodesById =
    buildWorkspaceAutoLayoutNodeLookup(incoming)
  const persistedAutoLayoutNodesById =
    buildWorkspaceAutoLayoutNodeLookup(persisted)
  let changed = false
  const nodes = incoming.nodes.map((node) => {
    const persistedNode = persistedNodesById.get(node.id)
    if (!persistedNode) return node
    const incomingPositionMode = resolveWorkspaceNodePositionMode({
      node,
      autoLayoutNode: incomingAutoLayoutNodesById.get(node.id),
    })
    const persistedPositionMode = resolveWorkspaceNodePositionMode({
      node: persistedNode,
      autoLayoutNode: persistedAutoLayoutNodesById.get(node.id),
    })
    const shouldPreservePersistedNode =
      persistedIsNewer ||
      (incomingPositionMode === "managed" && persistedPositionMode === "manual")
    if (!shouldPreservePersistedNode) return node

    if (
      persistedNode.x === node.x &&
      persistedNode.y === node.y &&
      persistedNode.size === node.size &&
      persistedPositionMode === node.positionMode
    ) {
      return node
    }

    changed = true
    return {
      ...node,
      x: persistedNode.x,
      y: persistedNode.y,
      size: persistedNode.size,
      positionMode: persistedPositionMode,
    }
  })

  const ontology = isPersistedWorkspaceOntologyNewer({ incoming, persisted })
    ? persisted.ontology
    : incoming.ontology
  if (ontology !== incoming.ontology) changed = true
  const particles = preferNewerParticleState(
    incoming.particles,
    persisted.particles
  )
  if (particles !== incoming.particles) changed = true

  const forwardCompatibility = mergeWorkspaceBoardForwardCompatibilityState(
    persistedIsNewer
      ? persisted.forwardCompatibility
      : incoming.forwardCompatibility,
    persistedIsNewer
      ? incoming.forwardCompatibility
      : persisted.forwardCompatibility
  )
  if (forwardCompatibility) changed = true

  return changed
    ? {
        ...incoming,
        nodes,
        ontology,
        ...(particles ? { particles } : {}),
        ...(forwardCompatibility ? { forwardCompatibility } : {}),
      }
    : incoming
}

export function reconcileWorkspaceBoardSaveResult({
  current,
  persisted,
}: {
  current: WorkspaceBoardState
  persisted: WorkspaceBoardState
}) {
  return {
    ...current,
    nodes: persisted.nodes,
    ...(persisted.particles ? { particles: persisted.particles } : {}),
    forwardCompatibility: persisted.forwardCompatibility,
    updatedAt: persisted.updatedAt,
  }
}

export function buildWorkspaceBoardStateWithPersistedNodePosition({
  boardState,
  cardId,
  x,
  y,
}: {
  boardState: WorkspaceBoardState
  cardId: WorkspaceCardId
  x: number
  y: number
}) {
  let changed = false
  const nodes = boardState.nodes.map((node) => {
    if (node.id !== cardId) return node
    if (node.x === x && node.y === y && node.positionMode === "manual") {
      return node
    }

    changed = true
    return {
      ...node,
      x,
      y,
      positionMode: "manual" as const,
    }
  })

  return changed
    ? {
        ...boardState,
        nodes,
      }
    : boardState
}
