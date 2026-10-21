import type { Particle } from "../types"
import { getParticleImage, isImagePlaceholder } from "./particle-image"
import { particleRegistry } from "./particle-registry"

export function filterParticleLibrary(
  particles: readonly Particle[],
  query: string
) {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  return particles.filter((particle) => {
    if (getParticleImage(particle) || isImagePlaceholder(particle)) return false
    const text =
      `${particle.title} ${particleRegistry[particle.type].label} ${particle.type === "activity" ? (particle.data.widget?.kind ?? "") : ""}`.toLocaleLowerCase()
    return terms.every((term) => text.includes(term))
  })
}

export function filterParticleLibraryTools<
  T extends { title: string; subtitle: string },
>(tools: readonly T[], query: string): T[] {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  return tools.filter((tool) => {
    const text = `${tool.title} ${tool.subtitle}`.toLocaleLowerCase()
    return terms.every((term) => text.includes(term))
  })
}

/** The reusable Activity preset already represents this untouched empty card. */
export function isEmptyActivityLibraryDuplicate(particle: Particle) {
  return particle.type === "activity" &&
    particle.title === "Activity" &&
    (!particle.description?.trim() || particle.description === "Create activity") &&
    particle.status === "backlog" && !particle.locked &&
    !particle.data.widget && particle.data.template === "task" &&
    particle.data.steps.length === 0
}
