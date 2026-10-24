import type { Node, NodeChange } from "@xyflow/react"
import type { ParticleNodeData } from "../components/particle-node"
import type { Particle, ParticleGraph } from "../types"
import { particleRegistry } from "./particle-registry"
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
  return {
    id: particle.id,
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
    style: resizing
      ? old?.style
      : particleSizeStyle(particle, particleRegistry[particle.type].width),
    dragHandle: ".workspace-card-drag-handle",
    draggable: movable && !particle.locked,
    connectable: data.editable,
  }
}

// Native photo resizing follows width while the intrinsic ratio determines
// height. Normalize before React Flow applies changes so handles/rails agree.
export function particleResizeChanges(
  changes: NodeChange<Node<ParticleNodeData>>[],
  records: ReadonlyMap<string, Particle>
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
      dimensions: particleResizeDimensions(particle, change.dimensions),
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
