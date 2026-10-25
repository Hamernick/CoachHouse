import { Position, type InternalNode } from "@xyflow/react"
import { particleHandleId, semanticParticleHandle } from "./particle-handle-ids"
import { isWorkspaceToolId } from "./workspace-tool-contract"

export const PARTICLE_HANDLE_SIDES = [
  Position.Left,
  Position.Right,
  Position.Top,
  Position.Bottom,
] as const

export function resolveParticleEdgeGeometry(
  source: InternalNode | undefined,
  target: InternalNode | undefined,
  sourceHandle = "out",
  targetHandle = "in"
) {
  if (!source || !target) return null
  const sw = source.measured.width,
    sh = source.measured.height
  const tw = target.measured.width,
    th = target.measured.height
  if (!sw || !sh || !tw || !th) return null
  const a = source.internals.positionAbsolute,
    b = target.internals.positionAbsolute
  const dx = b.x + tw / 2 - a.x - sw / 2
  const dy = b.y + th / 2 - a.y - sh / 2
  // Account for both card shapes instead of treating their centers as points.
  const horizontal = Math.abs(dx) / (sw + tw) >= Math.abs(dy) / (sh + th)
  const sourcePosition = horizontal
    ? dx >= 0
      ? Position.Right
      : Position.Left
    : dy >= 0
      ? Position.Bottom
      : Position.Top
  const targetPosition = horizontal
    ? dx >= 0
      ? Position.Left
      : Position.Right
    : dy >= 0
      ? Position.Top
      : Position.Bottom
  const endpoint = (
    node: InternalNode,
    type: "source" | "target",
    semantic: string,
    side: Position
  ) => {
    const id = isWorkspaceToolId(node.id)
      ? `workspace-card-${type}-${side}`
      : particleHandleId(semanticParticleHandle(semantic), side)
    const handle = node.internals.handleBounds?.[type]?.find(
      (item) => item.id === id
    )
    if (!handle) return null
    const position = node.internals.positionAbsolute
    // Use React Flow's measured native handle, including outcome-port offsets.
    return {
      x:
        position.x +
        handle.x +
        (side === Position.Left
          ? 0
          : side === Position.Right
            ? handle.width
            : handle.width / 2),
      y:
        position.y +
        handle.y +
        (side === Position.Top
          ? 0
          : side === Position.Bottom
            ? handle.height
            : handle.height / 2),
    }
  }
  const from = endpoint(source, "source", sourceHandle, sourcePosition)
  const to = endpoint(target, "target", targetHandle, targetPosition)
  return from && to
    ? {
        sourceX: from.x,
        sourceY: from.y,
        targetX: to.x,
        targetY: to.y,
        sourcePosition,
        targetPosition,
      }
    : null
}
