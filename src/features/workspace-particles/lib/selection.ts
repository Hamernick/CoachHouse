import type { Particle, ParticleOperation, ParticlePosition } from "../types"

export type ParticleBounds = {
  id: string
  x: number
  y: number
  width: number
  height: number
}
export function selectParticle(
  current: readonly string[],
  id: string,
  additive: boolean
) {
  if (!additive) return current.includes(id) ? [...current] : [id]
  return current.includes(id)
    ? current.filter((item) => item !== id)
    : [...current, id]
}
export function marqueeParticles(
  bounds: readonly ParticleBounds[],
  from: ParticlePosition,
  to: ParticlePosition,
  previous: readonly string[] = []
) {
  const left = Math.min(from.x, to.x),
    right = Math.max(from.x, to.x)
  const top = Math.min(from.y, to.y),
    bottom = Math.max(from.y, to.y)
  const hits = bounds
    .filter(
      (item) =>
        item.x <= right &&
        item.x + item.width >= left &&
        item.y <= bottom &&
        item.y + item.height >= top
    )
    .map((item) => item.id)
  return [...new Set([...previous, ...hits])]
}
export function moveParticleSelection(
  particles: readonly Particle[],
  selected: readonly string[],
  delta: ParticlePosition
): ParticleOperation | null {
  const ids = new Set(selected)
  const positions = particles
    .filter((item) => ids.has(item.id) && !item.locked)
    .map((item) => ({
      id: item.id,
      expectedRevision: item.revision,
      position: { x: item.position.x + delta.x, y: item.position.y + delta.y },
    }))
  return positions.length
    ? { kind: "move_particles", mode: "manual", positions }
    : null
}
