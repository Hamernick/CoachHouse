import { withParticleAssignmentBounds, particleAssignmentHeight } from "./particle-assignment-geometry"
import { PARTICLE_EXPANDED_SIZE } from "./particle-expansion"
import { Position, type Node, type NodeChange } from "@xyflow/react"
import type { ParticleNodeData } from "../components/particle-node"
import type { Particle, ParticleGraph } from "../types"
import { getParticleHandles, particleRegistry } from "./particle-registry"
import {
  isImageParticle,
  particleResizeDimensions,
  particleSizeStyle,
} from "./particle-size"

export function reconcileParticleNode({
  old,
  particle,
  selectedId,
  movable,
  resizing,
  keepPosition,
  data,
}: {
  old?: Node<ParticleNodeData>
  particle: Particle
  selectedId: string | null
  movable: boolean
  resizing: boolean
  keepPosition: boolean
  data: ParticleNodeData
}): Node<ParticleNodeData> {
  const baseStyle: Node<ParticleNodeData>["style"] = resizing ? old?.style : particleSizeStyle(particle, particleRegistry[particle.type].width)
  const cardStyle = data.expanded ? { ...baseStyle, width: Math.max(Number(baseStyle?.width) || 0, PARTICLE_EXPANDED_SIZE.width), height: Math.max(Number(baseStyle?.height) || 0, PARTICLE_EXPANDED_SIZE.height) } : baseStyle
  const style = resizing ? cardStyle : withParticleAssignmentBounds(particle, cardStyle ?? {}, Boolean(data.memberships))
  const width = typeof style?.width === "number" ? style.width : undefined
  const height = typeof style?.height === "number" ? style.height : undefined
  const cardHeight = height ? height - particleAssignmentHeight(particle, Boolean(data.memberships)) : undefined
  const outputs = getParticleHandles(particle).outputs
  return {
    id: particle.id,
    // Fixed-size cards can be culled before their first DOM measurement.
    // Native handles replace these semantic endpoints when a card mounts.
    initialWidth: width,
    initialHeight: height,
    handles: width && height ? [
      { id: "in", type: "target", position: Position.Left, x: 0, y: cardHeight! / 2, width: 0, height: 0 },
      ...outputs.map((id, index) => ({ id, type: "source" as const, position: Position.Right, x: width, y: cardHeight! * (index + 1) / (outputs.length + 1), width: 0, height: 0 })),
    ] : undefined,
    type: "workspace-particle",
    ariaLabel: `${particleRegistry[particle.type].label}: ${particle.title}`,
    position: old && keepPosition ? old.position : particle.position,
    measured: old?.measured,
    dragging: old?.dragging,
    resizing: old?.resizing,
    width: resizing ? old?.width : undefined,
    height: resizing ? old?.height : undefined,
    selected: old?.selected ?? particle.id === selectedId,
    data,
    style,
    dragHandle: ".workspace-card-drag-handle",
    draggable: movable && !particle.locked,
    connectable: data.editable,
  }
}

// Native photo resizing follows width while the intrinsic ratio determines
// height. Normalize before React Flow applies changes so handles/rails agree.
export function particleResizeChanges(
  changes: NodeChange<Node<ParticleNodeData>>[],
  records: ReadonlyMap<string, Particle>,
  memberIds?: ReadonlySet<string>
): NodeChange<Node<ParticleNodeData>>[] {
  return changes.map((change) => {
    if (
      change.type !== "dimensions" ||
      !change.dimensions ||
      !change.setAttributes
    )
      return change
    const particle = records.get(change.id)
    if (!particle || !isImageParticle(particle)) return change
    return {
      ...change,
      dimensions: withParticleAssignmentBounds(particle, particleResizeDimensions(particle, change.dimensions), memberIds?.has(particle.id)),
      setAttributes: true,
    }
  })
}

export function visibleParticleIds(graph: ParticleGraph | null) {
  return new Set(
    graph?.particles
      .filter((particle) => !particle.canvasHidden)
      .map((particle) => particle.id)
  )
}
