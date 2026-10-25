import { z } from "zod"
import { workspaceToolIdSchema } from "./workspace-tool-contract"
import type { Particle, ParticleGraph, ParticlePosition } from "../types"

export const PARTICLE_DRAG_MIME = "application/x-coach-house-particle"
export {
  workspaceToolIdSchema,
  type WorkspaceToolId,
} from "./workspace-tool-contract"
export const particleDragSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("particle"),
    workspaceId: z.string().uuid(),
    id: z.string().uuid(),
  }),
  z.strictObject({
    kind: z.literal("tool"),
    workspaceId: z.string().uuid(),
    id: workspaceToolIdSchema,
  }),
])
export type ParticleDrag = z.infer<typeof particleDragSchema>

export function readParticleDrag(
  raw: string,
  workspaceId: string
): ParticleDrag | null {
  if (raw.length > 1024) return null
  try {
    const result = particleDragSchema.safeParse(JSON.parse(raw))
    return result.success && result.data.workspaceId === workspaceId
      ? result.data
      : null
  } catch {
    return null
  }
}

export function placeParticle(
  particle: Particle,
  visible: boolean,
  position?: ParticlePosition
): Particle {
  return {
    ...particle,
    canvasHidden: !visible,
    ...(visible && position && !particle.locked
      ? { position, positionMode: "manual" as const }
      : {}),
  }
}

export function visibleParticleConnections(
  graph: ParticleGraph,
  toolIds: readonly string[] = []
) {
  const visible = new Set(
    graph.particles.filter((item) => !item.canvasHidden).map((item) => item.id)
  )
  for (const id of toolIds)
    if (workspaceToolIdSchema.safeParse(id).success) visible.add(id)
  return graph.connections.filter(
    (item) => visible.has(item.source) && visible.has(item.target)
  )
}
