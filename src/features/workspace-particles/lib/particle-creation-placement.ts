import { hasParticleMembership } from "./particle-membership-responsibility"
import { withParticleAssignmentBounds } from "./particle-assignment-geometry"
import type { Particle, ParticleGraph, ParticlePosition } from "../types"
import type { ParticlePlan, ParticlePlanning } from "./particle-plan-schema"
import { particleFamilyDimensions, PARTICLE_SIZE_SUPPORT } from "./particle-size"

export const PARTICLE_PLACEMENT_GAP = 80
export const UNASSIGNED_ORIGIN = { x: -1100, y: 100 }
export type ParticlePlacementMeasurement = { id: string; x: number; y: number; width: number; height: number }
type Objective = Extract<Particle, { type: "objective" }>
type Plan = Pick<ParticlePlan, "id" | "title" | "particleIds" | "links">
export type ParticleCreationContext = { objective: Objective; plan: Plan }

export function particlePlacementBounds(particle: Particle, membership = false) {
  const size = withParticleAssignmentBounds(particle, particleFamilyDimensions(particle, particle.size ?? PARTICLE_SIZE_SUPPORT[particle.type].defaultSize), membership)
  return { ...particle.position, ...size, ...(!particle.size && particle.width ? { width: particle.width } : {}) }
}

export function isSupportingParticle(particle: Particle) {
  return particle.type === "activity" && Boolean(particle.data.widget &&
    ["document", "image", "image_placeholder", "notes"].includes(particle.data.widget.kind))
}

export function particlePlanMemberships(graph: ParticleGraph) {
  return graph.particles.flatMap(objective => objective.type === "objective"
    ? [...(objective.data.planning?.plans ?? []), ...(objective.data.planning?.proposals ?? []).filter(plan => plan.status === "pending")]
      .map(plan => ({ objective, plan })) : [])
}

/** Creation chooses one free slot. Existing cards are obstacles, never a layout target. */
export function particleCreationPosition(graph: ParticleGraph, particle: Particle, context?: ParticleCreationContext, measurements: readonly ParticlePlacementMeasurement[] = []): ParticlePosition {
  const bounds = (item: Particle) => {
    const measured = measurements.find(box => box.id === item.id)
    return { ...particlePlacementBounds(item, hasParticleMembership(graph, item.id)), ...(measured ? { width: measured.width, height: measured.height } : {}) }
  }
  const visible = graph.particles.filter(item => item.id !== particle.id && !item.canvasHidden)
  let origin = particle.type === "objective" ? { x: 100, y: 100 } : { ...UNASSIGNED_ORIGIN }
  if (context) {
    const { objective, plan } = context
    const anchor = bounds(objective)
    const siblings = visible.filter(item => plan.particleIds.includes(item.id))
    const predecessors = visible.filter(item => plan.links?.some(link => link.target === particle.id && link.source === item.id))
    origin = { x: anchor.x + anchor.width + 144, y: anchor.y }
    // Only an explicit dependency advances a card to the next column.
    if (predecessors.length) origin.x = Math.max(...predecessors.map(item => { const box = bounds(item); return box.x + box.width + 144 }))
    if (siblings.length) origin.y = Math.max(origin.y, ...siblings.map(item => { const box = bounds(item); return box.y + box.height + PARTICLE_PLACEMENT_GAP }))
    else {
      const earlier = particlePlanMemberships(graph).filter(item => item.objective.id === objective.id)
      const index = earlier.findIndex(item => item.plan.id === plan.id)
      const preceding = new Set(earlier.slice(0, index < 0 ? earlier.length : index).flatMap(item => item.plan.particleIds))
      const above = visible.filter(item => preceding.has(item.id))
      if (above.length) origin.y = Math.max(origin.y, ...above.map(item => { const box = bounds(item); return box.y + box.height + 144 }))
    }
  }
  const size = particlePlacementBounds(particle, Boolean(context) || hasParticleMembership(graph, particle.id))
  const known = new Set(graph.particles.map(item => item.id))
  const obstacles = [...visible.map(bounds), ...measurements.filter(box => box.id !== particle.id && !known.has(box.id))]
  // Each collision advances past at least one obstacle; bounded by obstacle count.
  for (let attempt = 0; attempt <= obstacles.length; attempt++) {
    const collisions = obstacles.filter(box => origin.x < box.x + box.width + PARTICLE_PLACEMENT_GAP && origin.x + size.width + PARTICLE_PLACEMENT_GAP > box.x && origin.y < box.y + box.height + PARTICLE_PLACEMENT_GAP && origin.y + size.height + PARTICLE_PLACEMENT_GAP > box.y)
    if (!collisions.length) return origin
    origin = { ...origin, y: Math.max(...collisions.map(box => box.y + box.height + PARTICLE_PLACEMENT_GAP)) }
  }
  return origin
}

/** Membership and placement share the caller's revision-checked transaction. */
export function newlyAttachedParticles(graph: ParticleGraph, objective: Objective, planning: ParticlePlanning, created?: Particle, measurements: readonly ParticlePlacementMeasurement[] = []): Particle[] {
  const before = particlePlanMemberships(graph)
  const priorIds = new Set(before.flatMap(item => item.plan.particleIds))
  const updated = { ...objective, data: { ...objective.data, planning } }
  let scene = { ...graph, particles: graph.particles.map(item => item.id === objective.id ? updated : item) }
  const changed = new Map<string, Particle>()
  if (created) changed.set(created.id, { ...created, canvasHidden: false })
  const branches = particlePlanMemberships({ ...graph, particles: [updated] })
  for (const { plan } of branches) for (const id of plan.particleIds) {
    const item = changed.get(id) ?? graph.particles.find(particle => particle.id === id)
    if (!item || priorIds.has(id) || item.locked || item.positionMode === "manual") continue
    const placed = { ...item, position: particleCreationPosition(scene, item, { objective: updated, plan }, measurements), canvasHidden: false }
    changed.set(id, placed)
    scene = { ...scene, particles: [...scene.particles.filter(particle => particle.id !== id), placed] }
  }
  return [...changed.values()]
}

/** Whole-board arrange respects manual placement and the Unassigned region. */
export function particleArrangementIds(graph: ParticleGraph, selected?: ReadonlySet<string>, requested?: readonly string[]) {
  const attached = new Set(particlePlanMemberships(graph).flatMap(({ plan }) => plan.particleIds))
  const connected = new Set(graph.connections.flatMap(link => [link.source, link.target]))
  return graph.particles.filter(item => !item.canvasHidden && !item.locked &&
    (!requested || requested.includes(item.id)) &&
    (selected ? selected.has(item.id) : item.positionMode === "managed" && (item.type === "objective" || attached.has(item.id) || connected.has(item.id))))
    .map(item => item.id)
}
