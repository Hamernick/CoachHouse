import type { Node } from "@xyflow/react"
import type { ParticleNodeData } from "../components/particle-node"

type ParticleNode = Node<ParticleNodeData>

function inspectionDimensions(from: ParticleNode, to: ParticleNode) {
  if (from.data.expanded === to.data.expanded && !from.data.inspectionTransition) return null
  const width = typeof from.style?.width === "number" ? from.style.width : from.measured?.width
  const height = typeof from.style?.height === "number" ? from.style.height : from.measured?.height
  const nextWidth = to.style?.width, nextHeight = to.style?.height
  if (!width || !height || typeof nextWidth !== "number" || typeof nextHeight !== "number") return null
  return { width, height, nextWidth, nextHeight }
}

/** One motion owner updates measured node dimensions and positions, never text scale. */
export function particleNodeTransition(previous: ParticleNode[], next: ParticleNode[], progress: number): ParticleNode[] {
  const eased = progress * progress * (3 - 2 * progress)
  const old = new Map(previous.map(node => [node.id, node]))
  const ids = new Set(next.map(node => node.id))
  const present = next.map(node => {
    const from = old.get(node.id)
    if (!from || from.dragging || node.dragging || from.resizing || node.resizing) return node
    const sizes = progress < 1 ? inspectionDimensions(from, node) : null
    const projected = sizes ? {
      ...node,
      data: { ...node.data, inspectionTransition: { width: Math.max(sizes.width, sizes.nextWidth), height: Math.max(sizes.height, sizes.nextHeight) } },
      style: { ...node.style, width: sizes.width + (sizes.nextWidth - sizes.width) * eased, height: sizes.height + (sizes.nextHeight - sizes.height) * eased },
    } : node
    if (node.data.particle.locked || node.data.particle.positionMode === "manual") return projected
    return { ...projected, position: { x: from.position.x + (node.position.x - from.position.x) * eased, y: from.position.y + (node.position.y - from.position.y) * eased } }
  })
  if (progress >= 1) return present
  return [...present, ...previous.filter(node => !ids.has(node.id)).map(node => ({
    ...node, selected: false, draggable: false, connectable: false, focusable: false,
    data: { ...node.data, editable: false, exiting: true },
    style: { ...node.style, pointerEvents: "none" as const, opacity: Math.max(0, 1 - progress * 2) },
  }))]
}

export function animateParticleNodes(previous: ParticleNode[], next: ParticleNode[], setNodes: (update: ParticleNode[] | ((current: ParticleNode[]) => ParticleNode[])) => void, preserve: (id: string) => boolean, disabled = false) {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
  const changed = previous.some(node => {
    const target = next.find(item => item.id === node.id)
    return !target || Boolean(inspectionDimensions(node, target)) || (target.data.particle.positionMode === "managed" && !target.data.particle.locked && (node.position.x !== target.position.x || node.position.y !== target.position.y))
  })
  if (reduced || disabled || !changed) { setNodes(next); return }
  let active = true
  setNodes(current => active ? particleNodeTransition(previous, next, 0) : current)
  let frame = 0
  const start = performance.now()
  const tick = (now: number) => {
    if (!active) return
    const progress = Math.min(1, (now - start) / 240)
    const projected = particleNodeTransition(previous, next, progress)
    setNodes(current => !active ? current : projected.map(node => {
      const live = current.find(item => item.id === node.id)
      if (live && (live.dragging || live.resizing || preserve(node.id))) return live
      return live && !node.data.exiting ? { ...node, selected: live.selected, measured: live.measured } : node
    }))
    if (progress < 1) frame = requestAnimationFrame(tick)
  }
  frame = requestAnimationFrame(tick)
  return () => { active = false; cancelAnimationFrame(frame) }
}
