import type { Particle } from "../types"

export function particleInspectorMaxWidth(particle: Particle): number {
  if (particle.type === "activity" && particle.data.widget?.kind === "notes") return 960
  return particle.type === "calendar" ||
    particle.type === "workflow" ||
    particle.type === "decision" ||
    (particle.type === "activity" && !particle.data.widget)
    ? 720
    : 560
}

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
