import type { Particle } from "../types"

/** Pure geometry contract: safe in a layout worker without UI/capability imports. */
export function getParticleHandles(particle: Particle) {
  return {
    inputs: ["in"],
    outputs: [
      "out",
      ...(particle.type === "decision"
        ? particle.data.outcomes.map((outcome) => `outcome:${outcome.id}`)
        : []),
    ],
  }
}
