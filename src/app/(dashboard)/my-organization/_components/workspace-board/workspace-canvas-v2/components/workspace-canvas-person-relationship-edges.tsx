"use client"

import type { Edge as ReactFlowEdge } from "@xyflow/react"
import { memo, useCallback } from "react"
import {
  BaseEdge,
  MarkerType,
  Position,
  getBezierPath,
  useStore,
  type Edge,
  type EdgeProps,
  type Node,
  type InternalNode,
  type XYPosition,
} from "@xyflow/react"

import type { OrgPersonWithImage } from "@/components/people/supporters-showcase"
import type { PersonCategory } from "@/lib/people/categories"

import {
  WORKSPACE_CANVAS_PERSON_NODE_SIZE,
  getWorkspaceCanvasPersonNodeId,
  type WorkspaceCanvasPersonPlacement,
} from "./workspace-canvas-person-node-model"
import {
  buildWorkspaceCanvasPersonRelationships,
  type WorkspaceCanvasPersonRelationshipKind,
} from "./workspace-canvas-person-relationship-engine"

export const WORKSPACE_CANVAS_PERSON_RELATIONSHIP_EDGE_TYPE =
  "workspace-person-relationship"

type WorkspaceFloatingNodeRect = {
  x: number
  y: number
  width: number
  height: number
}

export type WorkspaceCanvasPersonRelationshipEdgeData = {
  role: "workspace-person-relationship"
  relationship: WorkspaceCanvasPersonRelationshipKind
  relationshipId: string
  sourcePersonId: string
  targetPersonId: string
}

const WORKSPACE_PERSON_RELATIONSHIP_EDGE_COLORS: Record<
  PersonCategory,
  string
> = {
  staff: "rgba(14, 165, 233, 0.76)",
  governing_board: "rgba(139, 92, 246, 0.76)",
  advisory_board: "rgba(245, 158, 11, 0.78)",
  volunteers: "rgba(16, 185, 129, 0.78)",
  supporters: "rgba(244, 63, 94, 0.72)",
  contractors: "rgba(6, 182, 212, 0.74)",
  vendors: "rgba(249, 115, 22, 0.74)",
}

function resolveNodeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function resolveNodePosition(node: Node | InternalNode): XYPosition {
  return "internals" in node ? node.internals.positionAbsolute : node.position
}

function resolveFloatingNodeRect(node: Node): WorkspaceFloatingNodeRect {
  const style = node.style ?? {}
  const position = resolveNodePosition(node)
  return {
    x: position.x,
    y: position.y,
    width:
      resolveNodeNumber(node.measured?.width) ??
      resolveNodeNumber(node.width) ??
      resolveNodeNumber(style.width) ??
      WORKSPACE_CANVAS_PERSON_NODE_SIZE.width,
    height:
      resolveNodeNumber(node.measured?.height) ??
      resolveNodeNumber(node.height) ??
      resolveNodeNumber(style.height) ??
      resolveNodeNumber(style.minHeight) ??
      WORKSPACE_CANVAS_PERSON_NODE_SIZE.height,
  }
}

export function getWorkspaceFloatingNodeIntersection(
  intersectionNode: Node,
  targetNode: Node
) {
  const intersectionRect = resolveFloatingNodeRect(intersectionNode)
  const targetRect = resolveFloatingNodeRect(targetNode)
  const w = intersectionRect.width / 2
  const h = intersectionRect.height / 2

  if (w <= 0 || h <= 0) return null

  const x2 = intersectionRect.x + w
  const y2 = intersectionRect.y + h
  const x1 = targetRect.x + targetRect.width / 2
  const y1 = targetRect.y + targetRect.height / 2
  const xx1 = (x1 - x2) / (2 * w) - (y1 - y2) / (2 * h)
  const yy1 = (x1 - x2) / (2 * w) + (y1 - y2) / (2 * h)
  const a = 1 / (Math.abs(xx1) + Math.abs(yy1))
  const xx3 = a * xx1
  const yy3 = a * yy1

  return {
    x: w * (xx3 + yy3) + x2,
    y: h * (-xx3 + yy3) + y2,
  }
}

function getWorkspaceFloatingEdgePosition(
  node: Node,
  intersectionPoint: XYPosition
) {
  const rect = resolveFloatingNodeRect(node)
  const nx = Math.round(rect.x)
  const ny = Math.round(rect.y)
  const px = Math.round(intersectionPoint.x)
  const py = Math.round(intersectionPoint.y)

  if (px <= nx + 1) return Position.Left
  if (px >= nx + rect.width - 1) return Position.Right
  if (py <= ny + 1) return Position.Top
  if (py >= ny + rect.height - 1) return Position.Bottom

  return Position.Top
}

export function resolveWorkspaceFloatingEdgeParams({
  sourceNode,
  targetNode,
}: {
  sourceNode: Node | undefined
  targetNode: Node | undefined
}) {
  if (!sourceNode || !targetNode) return null

  const sourceIntersectionPoint = getWorkspaceFloatingNodeIntersection(
    sourceNode,
    targetNode
  )
  const targetIntersectionPoint = getWorkspaceFloatingNodeIntersection(
    targetNode,
    sourceNode
  )
  if (!sourceIntersectionPoint || !targetIntersectionPoint) return null

  return {
    sourceX: sourceIntersectionPoint.x,
    sourceY: sourceIntersectionPoint.y,
    targetX: targetIntersectionPoint.x,
    targetY: targetIntersectionPoint.y,
    sourcePosition: getWorkspaceFloatingEdgePosition(
      sourceNode,
      sourceIntersectionPoint
    ),
    targetPosition: getWorkspaceFloatingEdgePosition(
      targetNode,
      targetIntersectionPoint
    ),
  }
}

export const WorkspaceCanvasPersonRelationshipEdge = memo(
  function WorkspaceCanvasPersonRelationshipEdge({
    id,
    source,
    target,
    markerEnd,
    style,
    interactionWidth,
  }: EdgeProps<ReactFlowEdge<WorkspaceCanvasPersonRelationshipEdgeData>>) {
    const selectSourceNode = useCallback(
      (state: { nodeLookup: Map<string, InternalNode> }) =>
        state.nodeLookup.get(source),
      [source]
    )
    const selectTargetNode = useCallback(
      (state: { nodeLookup: Map<string, InternalNode> }) =>
        state.nodeLookup.get(target),
      [target]
    )
    const sourceNode = useStore(selectSourceNode)
    const targetNode = useStore(selectTargetNode)
    const params = resolveWorkspaceFloatingEdgeParams({
      sourceNode,
      targetNode,
    })

    if (!params) return null

    const [edgePath] = getBezierPath(params)

    return (
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        interactionWidth={interactionWidth ?? 18}
        style={style}
      />
    )
  }
)

export function buildWorkspaceCanvasPersonRelationshipEdges({
  placements,
  peopleById,
  presentationMode,
}: {
  placements: WorkspaceCanvasPersonPlacement[]
  peopleById: ReadonlyMap<string, OrgPersonWithImage>
  presentationMode: boolean
}): Edge<WorkspaceCanvasPersonRelationshipEdgeData>[] {
  const placedPersonIds = new Set(
    placements.map((placement) => placement.personId)
  )
  const relationships = buildWorkspaceCanvasPersonRelationships({
    personIds: Array.from(placedPersonIds),
    peopleById,
  })
  const edges: Edge<WorkspaceCanvasPersonRelationshipEdgeData>[] = []

  for (const relationship of relationships) {
    const person = peopleById.get(relationship.sourcePersonId)
    if (
      !person ||
      !placedPersonIds.has(relationship.sourcePersonId) ||
      !placedPersonIds.has(relationship.targetPersonId)
    ) {
      continue
    }

    const stroke =
      WORKSPACE_PERSON_RELATIONSHIP_EDGE_COLORS[person.category] ??
      "rgba(148, 163, 184, 0.74)"

    edges.push({
      id: `workspace-person-relationship:${relationship.sourcePersonId}:${relationship.targetPersonId}`,
      source: getWorkspaceCanvasPersonNodeId(relationship.sourcePersonId),
      target: getWorkspaceCanvasPersonNodeId(relationship.targetPersonId),
      type: WORKSPACE_CANVAS_PERSON_RELATIONSHIP_EDGE_TYPE,
      animated: false,
      deletable: false,
      focusable: false,
      reconnectable: false,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: stroke,
        width: 14,
        height: 14,
      },
      style: {
        stroke,
        strokeWidth: presentationMode ? 1.2 : 1.45,
        opacity: presentationMode ? 0.72 : 0.86,
      },
      data: {
        role: "workspace-person-relationship",
        relationship: relationship.kind,
        relationshipId: relationship.id,
        sourcePersonId: relationship.sourcePersonId,
        targetPersonId: relationship.targetPersonId,
      },
    })
  }

  return edges
}
