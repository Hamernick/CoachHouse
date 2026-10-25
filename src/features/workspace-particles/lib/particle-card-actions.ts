import {
  PARTICLE_SIZE_NAMES,
  supportedParticleSizes,
  type ParticleSize,
} from "./particle-size"
import type { Particle, ParticleOperation } from "../types"
import { particleSchema } from "./particle-schema"
import { particleRegistry } from "./particle-registry"

export type ParticleCardAction =
  | `family_${ParticleSize}`
  | "duplicate"
  | "lock"
  | "unlock"
  | "remove"
  | "size_compact"
  | "size_default"
  | "size_wide"

export const PARTICLE_CARD_SIZES = [
  { action: "size_compact", label: "Compact" },
  { action: "size_default", label: "Default" },
  { action: "size_wide", label: "Wide" },
] as const

export function particleCardWidth(
  particle: Particle,
  action: ParticleCardAction
) {
  if (action === "size_compact") return 240
  if (action === "size_wide") return 440
  return particleRegistry[particle.type].width
}

export function duplicateParticle(
  source: Particle,
  uuid: () => string,
  now: string
): Particle {
  const copy = particleSchema.parse({
    ...structuredClone(source),
    id: uuid(),
    title: `${source.title.slice(0, 233)} (copy)`,
    revision: 0,
    locked: false,
    canvasHidden: false,
    positionMode: "manual",
    position: {
      x: Math.min(1_000_000, source.position.x + 40),
      y: Math.min(1_000_000, source.position.y + 40),
    },
    createdAt: now,
    updatedAt: now,
  })
  const cloneSteps = (
    steps: Extract<Particle, { type: "workflow" }>["data"]["steps"]
  ) =>
    steps.map((step) => ({
      ...step,
      id: uuid(),
      ...(step.particleId === source.id ? { particleId: copy.id } : {}),
    }))
  if (copy.type === "activity" || copy.type === "workflow")
    copy.data.steps = cloneSteps(copy.data.steps)
  if (copy.type === "decision")
    copy.data.criteria = cloneSteps(copy.data.criteria)
  if (copy.type === "calendar")
    copy.data.entries = copy.data.entries.map((entry) => ({
      ...entry,
      id: uuid(),
    }))
  return particleSchema.parse(copy)
}

export function particleCardOperation(
  particle: Particle,
  action: ParticleCardAction,
  uuid: () => string,
  now: string
): ParticleOperation | null {
  if (action === "duplicate")
    return {
      kind: "put_particle",
      particle: duplicateParticle(particle, uuid, now),
      expectedRevision: null,
    }
  if (
    (action.startsWith("size_") || action.startsWith("family_")) &&
    particle.locked
  )
    return null
  if (action.startsWith("family_")) {
    const size = PARTICLE_SIZE_NAMES.find((size) => `family_${size}` === action)
    if (
      !size ||
      !supportedParticleSizes(particle).includes(size) ||
      particle.size === size
    )
      return null
    const next = { ...particle, size }
    delete next.width
    return {
      kind: "put_particle",
      particle: particleSchema.parse(next),
      expectedRevision: particle.revision,
    }
  }
  const next = { ...particle }
  if (action.startsWith("size_")) delete next.size
  if (action === "lock" || action === "unlock") next.locked = action === "lock"
  if (action === "remove") next.canvasHidden = true
  if (action === "size_default") delete next.width
  else if (action === "size_compact" || action === "size_wide")
    next.width = particleCardWidth(particle, action)
  return {
    kind: "put_particle",
    particle: next,
    expectedRevision: particle.revision,
  }
}
