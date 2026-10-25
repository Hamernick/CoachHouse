import type { z } from "zod"
import type {
  particleSchema,
  particleConnectionSchema,
  particleGraphSchema,
} from "./lib/particle-schema"
import type {
  particleBatchSchema,
  particleOperationSchema,
} from "./lib/operation-schema"

export type Particle = z.infer<typeof particleSchema>
export type ParticleType = Particle["type"]
export type ParticleStatus = Particle["status"]
export type ParticlePosition = Particle["position"]
export type ParticleConnection = z.infer<typeof particleConnectionSchema>
export type ParticleGraph = z.infer<typeof particleGraphSchema>
export type ParticleOperation = z.infer<typeof particleOperationSchema>
export type ParticleBatch = z.infer<typeof particleBatchSchema>
export type ParticleFailureCode =
  | "invalid"
  | "conflict"
  | "scope"
  | "locked"
  | "unsupported"
  | "unavailable"
export type ParticleResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: ParticleFailureCode; error: string }
export type ParticleCommit = {
  graph: ParticleGraph
  inverse: ParticleOperation[]
  replayed: boolean
}
