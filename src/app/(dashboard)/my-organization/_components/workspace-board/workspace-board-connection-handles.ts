import { Position } from "@xyflow/react"

import {
  DEFAULT_CARD_SIZES,
  resolveCardDimensions,
} from "./workspace-board-layout-config"
import {
  WORKSPACE_CARD_IDS,
  WORKSPACE_CARD_SIZES,
  type WorkspaceCardId,
  type WorkspaceCardSize,
  type WorkspaceNodeState,
} from "./workspace-board-types"

export const WORKSPACE_CARD_CONNECTION_HANDLE_SIDES = [
  "left",
  "right",
  "top",
  "bottom",
] as const

export type WorkspaceCardConnectionHandleSide =
  (typeof WORKSPACE_CARD_CONNECTION_HANDLE_SIDES)[number]

export const WORKSPACE_CARD_SOURCE_HANDLE_IDS: Record<
  WorkspaceCardConnectionHandleSide,
  string
> = {
  left: "workspace-card-source-left",
  right: "workspace-card-source-right",
  top: "workspace-card-source-top",
  bottom: "workspace-card-source-bottom",
}

export const WORKSPACE_CARD_TARGET_HANDLE_IDS: Record<
  WorkspaceCardConnectionHandleSide,
  string
> = {
  left: "workspace-card-target-left",
  right: "workspace-card-target-right",
  top: "workspace-card-target-top",
  bottom: "workspace-card-target-bottom",
}

export type WorkspaceCardEdgeGeometry = {
  x: number
  y: number
  width: number
  height: number
}

export type WorkspaceCardEdgeGeometryLookup = Partial<
  Record<WorkspaceCardId, WorkspaceCardEdgeGeometry>
>

type WorkspaceCardGeometryInput = {
  id: string
  position?: { x: number; y: number }
  width?: unknown
  height?: unknown
  measured?: {
    width?: unknown
    height?: unknown
  }
  style?: {
    width?: unknown
    height?: unknown
    minHeight?: unknown
  }
  data?: unknown
}

const WORKSPACE_CARD_ID_SET = new Set<WorkspaceCardId>(WORKSPACE_CARD_IDS)
const WORKSPACE_CARD_SIZE_SET = new Set<WorkspaceCardSize>(WORKSPACE_CARD_SIZES)

function isWorkspaceCardId(value: string): value is WorkspaceCardId {
  return WORKSPACE_CARD_ID_SET.has(value as WorkspaceCardId)
}

function resolveWorkspaceCardSize(
  value: unknown,
): WorkspaceCardSize | null {
  return WORKSPACE_CARD_SIZE_SET.has(value as WorkspaceCardSize)
    ? (value as WorkspaceCardSize)
    : null
}

function resolveWorkspaceCardSizeFromInputData(
  data: unknown,
): WorkspaceCardSize | null {
  if (!data || typeof data !== "object") return null
  return resolveWorkspaceCardSize((data as { size?: unknown }).size)
}

function resolveFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value !== "string") return null

  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : null
}

function resolveWorkspaceCardGeometry({
  cardId,
  position,
  size,
  width,
  height,
  measured,
  style,
}: {
  cardId: WorkspaceCardId
  position: { x: number; y: number }
  size: WorkspaceCardSize
  width?: unknown
  height?: unknown
  measured?: WorkspaceCardGeometryInput["measured"]
  style?: WorkspaceCardGeometryInput["style"]
}): WorkspaceCardEdgeGeometry {
  const fallback = resolveCardDimensions(size, cardId)
  return {
    x: position.x,
    y: position.y,
    width:
      resolveFiniteNumber(measured?.width) ??
      resolveFiniteNumber(width) ??
      resolveFiniteNumber(style?.width) ??
      fallback.width,
    height:
      resolveFiniteNumber(measured?.height) ??
      resolveFiniteNumber(height) ??
      resolveFiniteNumber(style?.height) ??
      resolveFiniteNumber(style?.minHeight) ??
      fallback.height,
  }
}

export function resolveWorkspaceCardHandlePosition(
  side: WorkspaceCardConnectionHandleSide,
) {
  switch (side) {
    case "left":
      return Position.Left
    case "right":
      return Position.Right
    case "top":
      return Position.Top
    case "bottom":
      return Position.Bottom
  }
}

export function buildWorkspaceCardEdgeGeometryLookup(
  nodes: readonly WorkspaceCardGeometryInput[],
): WorkspaceCardEdgeGeometryLookup {
  const lookup: WorkspaceCardEdgeGeometryLookup = {}

  for (const node of nodes) {
    if (!isWorkspaceCardId(node.id) || !node.position) continue

    lookup[node.id] = resolveWorkspaceCardGeometry({
      cardId: node.id,
      position: node.position,
      size:
        resolveWorkspaceCardSizeFromInputData(node.data) ??
        DEFAULT_CARD_SIZES[node.id],
      width: node.width,
      height: node.height,
      measured: node.measured,
      style: node.style,
    })
  }

  return lookup
}

export function buildWorkspaceCardEdgeGeometryLookupFromBoardNodes(
  nodes: readonly WorkspaceNodeState[],
): WorkspaceCardEdgeGeometryLookup {
  const lookup: WorkspaceCardEdgeGeometryLookup = {}

  for (const node of nodes) {
    lookup[node.id] = resolveWorkspaceCardGeometry({
      cardId: node.id,
      position: { x: node.x, y: node.y },
      size: node.size,
    })
  }

  return lookup
}

export function resolveWorkspaceCardConnectionHandleIds({
  source,
  target,
}: {
  source?: WorkspaceCardEdgeGeometry | null
  target?: WorkspaceCardEdgeGeometry | null
}) {
  if (!source || !target) return null

  const sourceCenter = {
    x: source.x + source.width / 2,
    y: source.y + source.height / 2,
  }
  const targetCenter = {
    x: target.x + target.width / 2,
    y: target.y + target.height / 2,
  }
  const deltaX = targetCenter.x - sourceCenter.x
  const deltaY = targetCenter.y - sourceCenter.y

  const sourceSide: WorkspaceCardConnectionHandleSide =
    Math.abs(deltaX) >= Math.abs(deltaY)
      ? deltaX >= 0
        ? "right"
        : "left"
      : deltaY >= 0
        ? "bottom"
        : "top"
  const targetSide: WorkspaceCardConnectionHandleSide =
    sourceSide === "right"
      ? "left"
      : sourceSide === "left"
        ? "right"
        : sourceSide === "bottom"
          ? "top"
          : "bottom"

  return {
    sourceSide,
    targetSide,
    sourceHandle: WORKSPACE_CARD_SOURCE_HANDLE_IDS[sourceSide],
    targetHandle: WORKSPACE_CARD_TARGET_HANDLE_IDS[targetSide],
  }
}
