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
      `${particle.title} ${particle.type === "activity" ? "activity activities resource resources" : ""} ${particleRegistry[particle.type].label} ${particle.type === "activity" ? (particle.data.widget?.kind ?? "") : ""}`.toLocaleLowerCase()
    return terms.every((term) => text.includes(term))
  })
}

export function filterParticleLibraryTools<
  T extends { title: string; subtitle: string; id?: string },
>(tools: readonly T[], query: string): T[] {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  return tools.filter((tool) => {
    const text = `${tool.title} ${tool.subtitle} ${tool.id === "programs" ? "activity activities resource resources" : ""}`.toLocaleLowerCase()
    return terms.every((term) => text.includes(term))
  })
}

/** The reusable Resource preset already represents this untouched empty card. */
export function isEmptyActivityLibraryDuplicate(particle: Particle) {
  return particle.type === "activity" &&
    ["Activity", "Resource"].includes(particle.title) &&
    (!particle.description?.trim() || ["Create activity", "Create resource"].includes(particle.description)) &&
    particle.status === "backlog" && !particle.locked &&
    !particle.data.widget && particle.data.template === "task" &&
    particle.data.steps.length === 0
}
