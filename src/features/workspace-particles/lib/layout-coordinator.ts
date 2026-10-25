import type { ParticleResult } from "../types"
import {
  layoutParticleGraph,
  type ParticleLayout,
  type ParticleLayoutRunner,
} from "./graph-layout"

export function createParticleLayoutCoordinator(runner?: ParticleLayoutRunner) {
  let active: AbortController | undefined
  let sequence = 0
  return {
    cancel() {
      sequence += 1
      active?.abort()
    },
    async run(
      input: Omit<Parameters<typeof layoutParticleGraph>[0], "signal">
    ): Promise<ParticleResult<ParticleLayout>> {
      active?.abort()
      const token = ++sequence
      const controller = new AbortController()
      active = controller
      const result = await layoutParticleGraph(
        { ...input, signal: controller.signal },
        runner
      )
      if (token !== sequence)
        return {
          ok: false,
          code: "conflict",
          error: "A newer layout request replaced this result.",
        }
      return result
    },
  }
}
