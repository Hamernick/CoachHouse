import type { Particle } from "../types"
import { particleRegistry } from "./particle-registry"

export function filterParticleLibrary(
  particles: readonly Particle[],
  query: string
) {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  return particles.filter((particle) => {
    const text =
      `${particle.title} ${particleRegistry[particle.type].label}`.toLocaleLowerCase()
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
