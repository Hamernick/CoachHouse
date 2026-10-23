import type { Particle, ParticleOperation } from "@/features/workspace-particles/client"

type Objective = Extract<Particle, { type: "objective" }>

export function orderedObjectives(particles: readonly Particle[]): Objective[] {
  return particles.filter((particle): particle is Objective => particle.type === "objective")
    .sort((a, b) => (a.data.listOrder ?? Infinity) - (b.data.listOrder ?? Infinity))
}

export function reorderObjectiveOperations(particles: readonly Particle[], id: string, targetId: string): ParticleOperation[] {
  const ordered = orderedObjectives(particles)
  const from = ordered.findIndex(item => item.id === id)
  const to = ordered.findIndex(item => item.id === targetId)
  if (from < 0 || to < 0 || from === to) return []
  const [moved] = ordered.splice(from, 1)
  ordered.splice(to, 0, moved)
  return ordered.flatMap((particle, listOrder) => particle.data.listOrder === listOrder ? [] : [{
    kind: "put_particle" as const,
    particle: { ...particle, data: { ...particle.data, listOrder } },
    expectedRevision: particle.revision,
  }])
}
