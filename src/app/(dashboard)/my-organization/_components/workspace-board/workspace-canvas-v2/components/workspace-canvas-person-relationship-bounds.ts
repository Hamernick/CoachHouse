import type { Node, InternalNode } from "@xyflow/react"

import {
  WORKSPACE_CANVAS_PERSON_NODE_SIZE,
  type WorkspaceCanvasPersonPlacement,
} from "./workspace-canvas-person-node-model"
import {
  WORKSPACE_PERSON_RELATIONSHIP_CARD_GAP,
  WORKSPACE_PERSON_RELATIONSHIP_MAX_RADIUS,
  WORKSPACE_PERSON_RELATIONSHIP_MIN_RADIUS,
  WORKSPACE_PERSON_RELATIONSHIP_RING_GAP,
  type WorkspaceCanvasPoint,
} from "./workspace-canvas-person-relationship-layout-constants"

function resolveNodeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function resolveNodePosition(node: Node | InternalNode) {
  return "internals" in node ? node.internals.positionAbsolute : node.position
}

function resolveNodeSize(node: Node) {
  const style = node.style ?? {}
  const width =
    resolveNodeNumber(node.measured?.width) ??
      resolveNodeNumber(node.width) ??
    resolveNodeNumber(style.width) ??
    WORKSPACE_CANVAS_PERSON_NODE_SIZE.width
  const height =
    resolveNodeNumber(node.measured?.height) ??
      resolveNodeNumber(node.height) ??
    resolveNodeNumber(style.height) ??
    resolveNodeNumber(style.minHeight) ??
    WORKSPACE_CANVAS_PERSON_NODE_SIZE.height

  return { width, height }
}

function resolveNodeBounds(nodes: Node[]) {
  if (nodes.length === 0) return null

  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  for (const node of nodes) {
    const position = resolveNodePosition(node)
    const { width, height } = resolveNodeSize(node)
    minX = Math.min(minX, position.x)
    minY = Math.min(minY, position.y)
    maxX = Math.max(maxX, position.x + width)
    maxY = Math.max(maxY, position.y + height)
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  }
}

function isWorkspaceCardCollisionNode(node: Node) {
  return (
    !node.hidden &&
    node.type !== "workspace-person" &&
    node.type !== "workspace-tutorial" &&
    node.type !== "accelerator-step"
  )
}

function resolvePlacementBounds(placements: WorkspaceCanvasPersonPlacement[]) {
  if (placements.length === 0) return null

  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  for (const placement of placements) {
    minX = Math.min(minX, placement.x)
    minY = Math.min(minY, placement.y)
    maxX = Math.max(
      maxX,
      placement.x + WORKSPACE_CANVAS_PERSON_NODE_SIZE.width
    )
    maxY = Math.max(
      maxY,
      placement.y + WORKSPACE_CANVAS_PERSON_NODE_SIZE.height
    )
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  }
}

export function resolveWorkspacePeopleRelationshipRingRadius(
  ringCount: number
) {
  if (ringCount <= 1) return WORKSPACE_PERSON_RELATIONSHIP_MIN_RADIUS

  const nodeStride =
    WORKSPACE_CANVAS_PERSON_NODE_SIZE.width +
    WORKSPACE_PERSON_RELATIONSHIP_RING_GAP
  const circumferenceRadius = Math.ceil(
    (ringCount * nodeStride) / (2 * Math.PI)
  )

  return Math.min(
    WORKSPACE_PERSON_RELATIONSHIP_MAX_RADIUS,
    Math.max(WORKSPACE_PERSON_RELATIONSHIP_MIN_RADIUS, circumferenceRadius)
  )
}

export function shiftWorkspacePeopleRelationshipPlacementsAwayFromWorkspaceCards({
  placements,
  nodes,
}: {
  placements: WorkspaceCanvasPersonPlacement[]
  nodes: Node[]
}) {
  const placementBounds = resolvePlacementBounds(placements)
  if (!placementBounds) return placements

  const nonPersonBounds = resolveNodeBounds(
    nodes.filter(isWorkspaceCardCollisionNode)
  )
  if (!nonPersonBounds) return placements

  const minAllowedX =
    nonPersonBounds.maxX + WORKSPACE_PERSON_RELATIONSHIP_CARD_GAP
  const shiftX = Math.ceil(Math.max(0, minAllowedX - placementBounds.minX))
  if (shiftX === 0) return placements

  return placements.map((placement) => ({
    ...placement,
    x: placement.x + shiftX,
  }))
}

export function resolveWorkspacePeopleRelationshipCanvasCenter({
  nodes,
  fallbackCenter,
  focusPersonId,
  existingPlacements,
  personCount,
}: {
  nodes: Node[]
  fallbackCenter: WorkspaceCanvasPoint
  focusPersonId: string | null
  existingPlacements: WorkspaceCanvasPersonPlacement[]
  personCount: number
}): WorkspaceCanvasPoint {
  const existingFocusPlacement = focusPersonId
    ? existingPlacements.find(
        (placement) => placement.personId === focusPersonId
      )
    : null
  if (existingFocusPlacement) {
    return {
      x: existingFocusPlacement.x + WORKSPACE_CANVAS_PERSON_NODE_SIZE.width / 2,
      y:
        existingFocusPlacement.y + WORKSPACE_CANVAS_PERSON_NODE_SIZE.height / 2,
    }
  }

  const existingPersonBounds = resolveNodeBounds(
    nodes.filter((node) => node.type === "workspace-person")
  )
  if (existingPersonBounds) {
    return {
      x: existingPersonBounds.minX + existingPersonBounds.width / 2,
      y: existingPersonBounds.minY + existingPersonBounds.height / 2,
    }
  }

  const nonPersonBounds = resolveNodeBounds(
    nodes.filter(isWorkspaceCardCollisionNode)
  )
  if (!nonPersonBounds) return fallbackCenter

  const estimatedRadius = resolveWorkspacePeopleRelationshipRingRadius(
    Math.max(0, personCount - 1)
  )
  return {
    x:
      nonPersonBounds.maxX +
      estimatedRadius +
      WORKSPACE_CANVAS_PERSON_NODE_SIZE.width / 2 +
      WORKSPACE_PERSON_RELATIONSHIP_CARD_GAP,
    y:
      nonPersonBounds.minY +
      Math.min(
        Math.max(nonPersonBounds.height / 2, estimatedRadius),
        nonPersonBounds.height + estimatedRadius
      ),
  }
}
