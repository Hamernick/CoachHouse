import type { Particle } from "../types"

export type ParticleSteps = Extract<
  Particle,
  { type: "workflow" }
>["data"]["steps"]

export function replaceParticleSteps(
  particle: Particle,
  steps: ParticleSteps
): Particle {
  if (particle.type === "activity")
    return { ...particle, data: { ...particle.data, steps } }
  if (particle.type === "workflow")
    return { ...particle, data: { ...particle.data, steps } }
  return particle
}
